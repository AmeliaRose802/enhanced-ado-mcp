#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Monitors GitHub Copilot agent PRs with detailed status tracking.

.DESCRIPTION
    Continuously polls GitHub Copilot-created PRs to track their progress,
    displaying detailed status including CI checks, review status, and completion.
    Provides visual and audio feedback when all PRs are ready for merge.

.PARAMETER PRNumbers
    Array of PR numbers to monitor.

.PARAMETER Owner
    Repository owner. Defaults to "AmeliaRose802".

.PARAMETER Repo
    Repository name. Defaults to "enhanced-ado-mcp".

.PARAMETER PollIntervalSeconds
    Number of seconds between status checks. Defaults to 30.

.PARAMETER MaxPolls
    Maximum number of status checks before timeout. Defaults to 480 (~4 hours).

.EXAMPLE
    .\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3,4
    Monitor PRs 1-4 with default settings.

.EXAMPLE
    .\Watch-Copilot-PRs.ps1 -PRNumbers 1,2,3 -PollIntervalSeconds 60
    Monitor PRs with 60-second polling interval.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory, ValueFromRemainingArguments)]
    [int[]]$PRNumbers,
    
    [string]$Owner = "AmeliaRose802",
    
    [string]$Repo = "enhanced-ado-mcp",
    
    [int]$PollIntervalSeconds = 30,
    
    [int]$MaxPolls = 480
)

$ErrorActionPreference = "Stop"

# Track state between polls
$script:lastStatus = @{}
$script:monitorStartTime = Get-Date
$script:completedPRs = @()
$script:quotaErrorPRs = @{}  # Track quota errors: PR# => detection time
$script:workflowApprovalAttempts = @{}  # Track approval attempts
$script:testFailureNotified = @{}  # Track if we've notified about test failures

Write-Host "=== GITHUB COPILOT PR MONITOR ===" -ForegroundColor Cyan
Write-Host "Repository: $Owner/$Repo" -ForegroundColor White
Write-Host "Monitoring PRs: $($PRNumbers -join ', ')" -ForegroundColor White
Write-Host "Poll Interval: $PollIntervalSeconds seconds" -ForegroundColor White
Write-Host "Max Duration: ~$([math]::Round($MaxPolls * $PollIntervalSeconds / 3600, 1)) hours" -ForegroundColor White
Write-Host ""

#region Helper Functions

<#
.SYNOPSIS
    Formats a TimeSpan as a human-readable duration string.
#>
function Format-Duration {
    param([TimeSpan]$TimeSpan)
    
    if ($TimeSpan.TotalHours -ge 1) {
        return $TimeSpan.ToString("h\:mm\:ss")
    }
    return $TimeSpan.ToString("mm\:ss")
}

<#
.SYNOPSIS
    Gets PR information from GitHub.
#>
function Get-PRInfo {
    param([int]$PRNumber)
    
    try {
        $ErrorActionPreference = "Stop"
        # Separate stderr and stdout properly
        $output = gh pr view $PRNumber --repo "$Owner/$Repo" --json number,title,state,isDraft,author,mergeable,statusCheckRollup,reviewDecision,updatedAt,url,reviewRequests,closedAt,mergedAt,closed 2>&1
        
        # Check if we got an error
        if ($LASTEXITCODE -ne 0) {
            Write-Verbose "Could not get PR #$PRNumber - exit code: $LASTEXITCODE"
            return $null
        }
        
        # Filter out any error messages and get only the JSON
        $jsonLines = $output | Where-Object { $_ -is [string] -and $_ -match '^\s*\{' }
        if ($jsonLines) {
            $json = $jsonLines -join "`n"
            $parsed = $json | ConvertFrom-Json
            return $parsed
        } else {
            Write-Verbose "Could not parse PR #$PRNumber output"
        }
    } catch {
        Write-Warning "Failed to get PR #$PRNumber : $_"
    }
    return $null
}

<#
.SYNOPSIS
    Gets PR timeline events to detect Copilot completion.
#>
function Get-PRTimeline {
    param([int]$PRNumber)
    
    try {
        # Get recent events including review requests and title changes
        $json = gh api "/repos/$Owner/$Repo/pulls/$PRNumber/timeline" 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $json) {
            return $json | ConvertFrom-Json
        }
    } catch {
        Write-Verbose "Timeline fetch failed for PR #$PRNumber"
    }
    return @()
}

<#
.SYNOPSIS
    Checks if Copilot has finished work on a PR.
#>
function Test-CopilotFinished {
    param(
        [object]$PRInfo,
        [array]$Timeline
    )
    
    # Check 1: Title no longer has "WIP" prefix
    $titleNoWIP = $PRInfo.title -notmatch '^\[?WIP\]?'
    
    # Check 2: Review requested from owner (check PR object directly)
    $reviewRequested = $false
    if ($PRInfo.reviewRequests -and $PRInfo.reviewRequests.Count -gt 0) {
        foreach ($request in $PRInfo.reviewRequests) {
            # Handle both direct login property and nested structure
            $requestLogin = if ($request.login) { $request.login } else { $request.requestedReviewer.login }
            if ($requestLogin -eq $Owner) {
                $reviewRequested = $true
                break
            }
        }
    }
    
    # Check 3: Timeline events as backup
    if (-not $reviewRequested -and $Timeline.Count -gt 0) {
        $latestEvents = $Timeline | Select-Object -Last 20
        foreach ($event in $latestEvents) {
            if ($event.event -eq 'review_requested' -and $event.requested_reviewer.login -eq $Owner) {
                $reviewRequested = $true
                break
            }
        }
    }
    
    # Check 4: Recent activity with "finished" pattern in events
    $finishedEvent = $false
    if ($Timeline.Count -gt 0) {
        $latestEvents = $Timeline | Select-Object -Last 20
        foreach ($event in $latestEvents) {
            if ($event.body -match 'finished work' -or $event.event -eq 'closed' -and $event.state_reason -eq 'completed') {
                $finishedEvent = $true
                break
            }
        }
    }
    
    # Copilot is finished if: title is final AND (review requested OR finished event found)
    return $titleNoWIP -and ($reviewRequested -or $finishedEvent)
}

<#
.SYNOPSIS
    Gets CI check status summary.
#>
function Get-ChecksSummary {
    param([object]$StatusCheckRollup)
    
    if (-not $StatusCheckRollup) {
        return @{ Total = 0; Passed = 0; Failed = 0; Pending = 0; Status = "No checks" }
    }
    
    $total = $StatusCheckRollup.Count
    $passed = ($StatusCheckRollup | Where-Object { $_.conclusion -eq 'success' }).Count
    $failed = ($StatusCheckRollup | Where-Object { $_.conclusion -eq 'failure' }).Count
    $pending = ($StatusCheckRollup | Where-Object { $_.status -in @('queued', 'in_progress', 'pending') }).Count
    
    $status = "Unknown"
    if ($pending -gt 0) {
        $status = "Running"
    } elseif ($failed -gt 0) {
        $status = "Failed"
    } elseif ($passed -eq $total -and $total -gt 0) {
        $status = "Passed"
    } elseif ($total -eq 0) {
        $status = "No checks"
    }
    
    return @{
        Total = $total
        Passed = $passed
        Failed = $failed
        Pending = $pending
        Status = $status
    }
}

<#
.SYNOPSIS
    Gets appropriate color for check status.
#>
function Get-ChecksColor {
    param([string]$Status)
    
    switch ($Status) {
        "Passed" { return "Green" }
        "Failed" { return "Red" }
        "Running" { return "Yellow" }
        default { return "Gray" }
    }
}

<#
.SYNOPSIS
    Plays a completion sound.
#>
function Invoke-CompletionSound {
    param([bool]$Success = $true)
    
    try {
        if ($Success) {
            # Success sound - ascending tones
            [System.Console]::Beep(523, 200)  # C
            [System.Console]::Beep(659, 200)  # E
            [System.Console]::Beep(784, 400)  # G
        } else {
            # Warning sound
            [System.Console]::Beep(784, 300)
            [System.Console]::Beep(659, 300)
        }
    } catch {
        Write-Host "`a"
    }
}

<#
.SYNOPSIS
    Checks if PR timeline indicates a quota/rate limit error.
#>
function Test-QuotaError {
    param(
        [int]$PRNumber,
        [array]$Timeline
    )
    
    if ($Timeline.Count -eq 0) { return $false }
    
    # Look for recent comments from Copilot indicating quota issues
    $recentEvents = $Timeline | Select-Object -Last 10
    foreach ($event in $recentEvents) {
        if ($event.event -eq 'commented' -and $event.user.login -eq 'github-copilot[bot]') {
            $body = $event.body
            if ($body -match 'quota|rate limit|429|too many requests|capacity|limit exceeded') {
                return $true
            }
        }
    }
    
    return $false
}

<#
.SYNOPSIS
    Posts a comment to a PR asking Copilot to retry after quota reset.
#>
function Add-RetryComment {
    param(
        [int]$PRNumber,
        [datetime]$QuotaDetectedTime
    )
    
    $waitedMinutes = [math]::Round(((Get-Date) - $QuotaDetectedTime).TotalMinutes, 1)
    
    $comment = @"
@github-copilot The previous attempt encountered a quota/rate limit error. 

It has been $waitedMinutes minutes since the error was detected. Please retry implementing this task.

If you continue to encounter quota errors, consider:
1. Breaking the task into smaller pieces
2. Retrying after a longer wait period
3. Checking GitHub Copilot quota limits
"@

    try {
        gh pr comment $PRNumber --repo "$Owner/$Repo" --body $comment 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "     ✅ Posted retry comment to PR #$PRNumber" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Verbose "Failed to post retry comment: $_"
    }
    return $false
}

<#
.SYNOPSIS
    Checks if workflow runs need approval and approves them.
#>
function Approve-WorkflowRuns {
    param([int]$PRNumber)
    
    try {
        # Get workflow runs for this PR
        $runsJson = gh api "/repos/$Owner/$Repo/pulls/$PRNumber/commits" 2>$null
        if ($LASTEXITCODE -ne 0) { return $false }
        
        $commits = $runsJson | ConvertFrom-Json
        $headSha = $commits[0].sha
        
        if (-not $headSha) { return $false }
        
        # Get workflow runs for the head commit
        $workflowRunsJson = gh api "/repos/$Owner/$Repo/actions/runs?head_sha=$headSha" 2>$null
        if ($LASTEXITCODE -ne 0) { return $false }
        
        $workflowRuns = ($workflowRunsJson | ConvertFrom-Json).workflow_runs
        
        $approvedAny = $false
        foreach ($run in $workflowRuns) {
            # Check if workflow requires approval (status: action_required)
            if ($run.status -eq 'action_required' -or $run.status -eq 'waiting') {
                Write-Host "     🔓 Workflow run #$($run.id) needs approval" -ForegroundColor Yellow
                
                # Approve the workflow run
                $approveResult = gh api --method POST "/repos/$Owner/$Repo/actions/runs/$($run.id)/approve" 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "     ✅ Approved workflow run #$($run.id)" -ForegroundColor Green
                    $approvedAny = $true
                } else {
                    Write-Host "     ⚠️  Failed to approve workflow run: $approveResult" -ForegroundColor Yellow
                }
            }
        }
        
        return $approvedAny
    } catch {
        Write-Verbose "Failed to check/approve workflows: $_"
        return $false
    }
}

<#
.SYNOPSIS
    Checks for test failures and posts comment to fix them.
#>
function Test-AndReportFailures {
    param(
        [int]$PRNumber,
        [object]$StatusCheckRollup
    )
    
    if (-not $StatusCheckRollup) { return $false }
    
    $failedChecks = $StatusCheckRollup | Where-Object { $_.conclusion -eq 'failure' }
    
    if ($failedChecks.Count -eq 0) { return $false }
    
    # Check if we've already notified about failures
    if ($script:testFailureNotified[$PRNumber]) { return $true }
    
    Write-Host "     ⚠️  Detected $($failedChecks.Count) failed check(s)" -ForegroundColor Yellow
    
    # Get check details
    $failureDetails = @()
    foreach ($check in $failedChecks) {
        $failureDetails += "- **$($check.name)**: $($check.conclusion)"
    }
    
    $comment = @"
@github-copilot Test failures detected:

$($failureDetails -join "`n")

Please fix the failing tests. **Do not bypass or skip failing tests.**

Steps to resolve:
1. Review the test failure logs above
2. Identify the root cause of the failures
3. Fix the code to make the tests pass
4. Ensure all tests pass locally: ``npm test``
5. Push the fixes to this PR

If you need help understanding the test failures, ask for clarification.
"@

    try {
        gh pr comment $PRNumber --repo "$Owner/$Repo" --body $comment 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "     ✅ Posted test failure fix request to PR #$PRNumber" -ForegroundColor Green
            $script:testFailureNotified[$PRNumber] = $true
            return $true
        }
    } catch {
        Write-Verbose "Failed to post test failure comment: $_"
    }
    
    return $true  # Still return true so we know there are failures
}

#endregion

#region Main Monitoring Loop

for ($i = 1; $i -le $MaxPolls; $i++) {
    $currentTime = Get-Date
    $monitorElapsed = $currentTime - $script:monitorStartTime

    Write-Host ""
    Write-Host "[$($currentTime.ToString('HH:mm:ss'))] Poll #$i (Monitor Running: $(Format-Duration $monitorElapsed))" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray

    $allFinished = $true
    $allChecksPassed = $true
    $anyFailed = $false

    foreach ($prNum in $PRNumbers) {
        # Skip if already marked as complete
        if ($script:completedPRs -contains $prNum) {
            Write-Host "  ✅ PR #$prNum - Previously completed and validated" -ForegroundColor Green
            continue
        }

        Write-Host ""
        Write-Host "  📋 PR #$prNum" -ForegroundColor White -NoNewline
        
        $prInfo = Get-PRInfo -PRNumber $prNum
        
        if ($prInfo) {
            Write-Host " - $($prInfo.title)" -ForegroundColor Cyan
            Write-Host "     URL: $($prInfo.url)" -ForegroundColor Gray
            Write-Host "     State: $($prInfo.state)$(if ($prInfo.mergedAt) { ' (Merged)' })$(if ($prInfo.closedAt -and -not $prInfo.mergedAt) { ' (Closed)' })" -ForegroundColor Gray
            
            # Get timeline for Copilot completion detection
            $timeline = Get-PRTimeline -PRNumber $prNum
            
            # Check for quota errors
            $hasQuotaError = Test-QuotaError -PRNumber $prNum -Timeline $timeline
            if ($hasQuotaError) {
                if (-not $script:quotaErrorPRs.ContainsKey($prNum)) {
                    $script:quotaErrorPRs[$prNum] = Get-Date
                    Write-Host "     ⚠️  Quota/rate limit error detected" -ForegroundColor Yellow
                } else {
                    $waitTime = (Get-Date) - $script:quotaErrorPRs[$prNum]
                    # Wait at least 15 minutes before posting retry comment
                    if ($waitTime.TotalMinutes -ge 15) {
                        Write-Host "     🔄 Quota wait time elapsed (15+ min), posting retry comment" -ForegroundColor Cyan
                        if (Add-RetryComment -PRNumber $prNum -QuotaDetectedTime $script:quotaErrorPRs[$prNum]) {
                            # Remove from quota tracking after posting retry
                            $script:quotaErrorPRs.Remove($prNum)
                        }
                    } else {
                        Write-Host "     ⏳ Waiting for quota reset... ($([math]::Round($waitTime.TotalMinutes, 1))/15 min)" -ForegroundColor Yellow
                        $allFinished = $false
                        continue
                    }
                }
            }
            
            # Check for workflow runs needing approval
            if (-not $script:workflowApprovalAttempts.ContainsKey($prNum)) {
                $script:workflowApprovalAttempts[$prNum] = 0
            }
            
            # Try to approve workflows (max 3 attempts per PR)
            if ($script:workflowApprovalAttempts[$prNum] -lt 3) {
                if (Approve-WorkflowRuns -PRNumber $prNum) {
                    $script:workflowApprovalAttempts[$prNum]++
                }
            }
            
            $copilotFinished = Test-CopilotFinished -PRInfo $prInfo -Timeline $timeline
            
            # Display Copilot status
            if ($copilotFinished) {
                Write-Host "     🤖 Copilot: Finished ✅" -ForegroundColor Green
            } else {
                Write-Host "     🤖 Copilot: Working... ⏳" -ForegroundColor Yellow
                $allFinished = $false
            }
            
            # Display draft status
            if ($prInfo.isDraft) {
                Write-Host "     📝 Status: Draft (normal for Copilot PRs)" -ForegroundColor Gray
            }
            
            # Display CI checks
            $checks = Get-ChecksSummary -StatusCheckRollup $prInfo.statusCheckRollup
            $checksColor = Get-ChecksColor -Status $checks.Status
            Write-Host "     ✓ Checks: $($checks.Status) ($($checks.Passed)/$($checks.Total) passed)" -ForegroundColor $checksColor
            
            if ($checks.Status -eq "Failed") {
                $anyFailed = $true
                $allChecksPassed = $false
                Write-Host "     ⚠️  CI checks failed - requesting fix from Copilot" -ForegroundColor Red
                
                # Post comment asking Copilot to fix tests (not bypass)
                Test-AndReportFailures -PRNumber $prNum -StatusCheckRollup $prInfo.statusCheckRollup | Out-Null
                
            } elseif ($checks.Status -ne "Passed" -and $checks.Total -gt 0) {
                $allChecksPassed = $false
            }
            
            # Display mergeable status
            if ($prInfo.mergeable -eq 'CONFLICTING') {
                Write-Host "     ⚠️  Merge conflicts detected!" -ForegroundColor Red
                $anyFailed = $true
            } elseif ($prInfo.mergeable -eq 'MERGEABLE') {
                Write-Host "     ✅ Mergeable" -ForegroundColor Green
            }
            
            # Display review status
            if ($prInfo.reviewDecision -eq 'APPROVED') {
                Write-Host "     👍 Approved" -ForegroundColor Green
            } elseif ($prInfo.reviewDecision -eq 'CHANGES_REQUESTED') {
                Write-Host "     🔄 Changes requested" -ForegroundColor Yellow
            } elseif ($prInfo.reviewDecision -eq 'REVIEW_REQUIRED') {
                Write-Host "     👀 Review required" -ForegroundColor Yellow
            }
            
            # Detect status changes
            $currentStatus = "$($copilotFinished):$($checks.Status):$($prInfo.mergeable)"
            if ($script:lastStatus.ContainsKey($prNum)) {
                if ($script:lastStatus[$prNum] -ne $currentStatus) {
                    Write-Host "     ✨ Status changed!" -ForegroundColor Magenta
                }
            }
            $script:lastStatus[$prNum] = $currentStatus
            
            # Check if this PR is ready for merge
            # Ready = Copilot finished + (checks passed OR no checks) + mergeable
            $checksOK = ($checks.Status -eq "Passed") -or ($checks.Status -eq "No checks")
            if ($copilotFinished -and $checksOK -and $prInfo.mergeable -eq 'MERGEABLE') {
                Write-Host "     🎉 READY FOR MERGE!" -ForegroundColor Green -BackgroundColor DarkGreen
                $script:completedPRs += $prNum
            }
            
        } else {
            Write-Host " - Unable to fetch PR info (may be closed/merged)" -ForegroundColor Yellow
            # Don't mark as not finished if we can't fetch - it might be completed
            # The PR will be considered incomplete for this iteration
        }
    }

    # Check if all PRs are complete
    if ($script:completedPRs.Count -eq $PRNumbers.Count) {
        Write-Host ""
        Write-Host ("=" * 80) -ForegroundColor Green
        Write-Host "🎉 ALL PRS READY FOR MERGE! 🎉" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host ("=" * 80) -ForegroundColor Green
        Write-Host ""
        Write-Host "Monitor Duration: $(Format-Duration $monitorElapsed)" -ForegroundColor Cyan
        Write-Host "Completed PRs: $($script:completedPRs -join ', ')" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ All Copilot agents have finished their work" -ForegroundColor Green
        Write-Host "✅ All CI checks have passed" -ForegroundColor Green
        Write-Host "✅ All PRs are mergeable" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔍 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. Review each PR for quality and correctness" -ForegroundColor White
        Write-Host "2. Run integration tests: npm test; npm run build" -ForegroundColor White
        Write-Host "3. Merge PRs in dependency order" -ForegroundColor White
        Write-Host "4. Proceed to next block" -ForegroundColor White
        Write-Host ""
        
        Invoke-CompletionSound -Success $true
        
        # Exit the monitoring loop - all PRs are ready
        break
    }

    # Summary status
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host "  📊 Summary: $($script:completedPRs.Count)/$($PRNumbers.Count) PRs ready" -ForegroundColor Cyan
    if ($anyFailed) {
        Write-Host "  ⚠️  Some PRs have issues - may need manual intervention" -ForegroundColor Yellow
    }
    Write-Host ""

    # Only sleep if we're not on the last iteration
    if ($i -lt $MaxPolls) {
        Start-Sleep -Seconds $PollIntervalSeconds
    }
}

# If we reach here, check if we exited due to completion or timeout
if ($script:completedPRs.Count -eq $PRNumbers.Count) {
    # All PRs completed successfully
    exit 0
} else {
    # Maximum polls reached without all PRs completing
    Write-Host ""
    Write-Host "⏰ Maximum monitoring time reached ($MaxPolls polls)" -ForegroundColor Yellow
    Write-Host "Monitor Duration: $(Format-Duration $monitorElapsed)" -ForegroundColor Cyan
    Write-Host "Completed PRs: $($script:completedPRs.Count)/$($PRNumbers.Count)" -ForegroundColor White
    Write-Host ""
    Write-Host "PRs may still be in progress. Check GitHub for current status." -ForegroundColor White
    exit 2
}

#endregion
