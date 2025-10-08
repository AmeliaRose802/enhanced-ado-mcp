#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Monitors GitHub Copilot agent PRs and exits when ANY PR finishes.

.DESCRIPTION
    Continuously polls GitHub Copilot-created PRs and exits immediately when
    the first PR completes (Copilot finished + checks passed + mergeable).
    Automatically generates next available tasks using Get-NextTasks.ps1.
    Useful for parallel workflows where you need to react to the first completion.

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

.PARAMETER TaskMappings
    Hashtable mapping PR numbers to task IDs. Example: @{123="T2_precommit_hooks"; 124="T8_consolidate_types"}

.PARAMETER GenerateNextTasks
    If set, automatically generates next available tasks when a PR finishes. Defaults to $true.

.EXAMPLE
    .\Watch-Copilot-PR-Any.ps1 -PRNumbers 1,2,3,4 -TaskMappings @{1="T2_precommit_hooks"}
    Monitor PRs 1-4 and show next tasks when PR 1 finishes.

.EXAMPLE
    .\Watch-Copilot-PR-Any.ps1 -PRNumbers 1,2,3 -PollIntervalSeconds 60 -GenerateNextTasks:$false
    Monitor PRs with 60-second polling interval without generating next tasks.

.NOTES
    Exit codes:
    0 = One or more PRs finished successfully
    1 = Error occurred during monitoring
    2 = Timeout reached without any PR finishing
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory, ValueFromRemainingArguments)]
    [int[]]$PRNumbers,
    
    [string]$Owner = "AmeliaRose802",
    
    [string]$Repo = "enhanced-ado-mcp",
    
    [int]$PollIntervalSeconds = 30,
    
    [int]$MaxPolls = 480,
    
    [hashtable]$TaskMappings = @{},
    
    [bool]$GenerateNextTasks = $true
)

$ErrorActionPreference = "Stop"

# Track state between polls
$script:lastStatus = @{}
$script:monitorStartTime = Get-Date

Write-Host "=== GITHUB COPILOT PR MONITOR (EXIT ON FIRST COMPLETION) ===" -ForegroundColor Cyan
Write-Host "Repository: $Owner/$Repo" -ForegroundColor White
Write-Host "Monitoring PRs: $($PRNumbers -join ', ')" -ForegroundColor White
if ($TaskMappings.Count -gt 0) {
    Write-Host "Task Mappings:" -ForegroundColor White
    foreach ($pr in $PRNumbers) {
        if ($TaskMappings.ContainsKey($pr)) {
            Write-Host "  PR #$pr -> $($TaskMappings[$pr])" -ForegroundColor Gray
        }
    }
}
Write-Host "Poll Interval: $PollIntervalSeconds seconds" -ForegroundColor White
Write-Host "Max Duration: ~$([math]::Round($MaxPolls * $PollIntervalSeconds / 3600, 1)) hours" -ForegroundColor White
Write-Host "Behavior: Exit when ANY PR finishes" -ForegroundColor Yellow
if ($GenerateNextTasks) {
    Write-Host "Auto-generate next tasks: Enabled" -ForegroundColor Green
}
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

#endregion

#region Main Monitoring Loop

for ($i = 1; $i -le $MaxPolls; $i++) {
    $currentTime = Get-Date
    $monitorElapsed = $currentTime - $script:monitorStartTime

    Write-Host ""
    Write-Host "[$($currentTime.ToString('HH:mm:ss'))] Poll #$i (Monitor Running: $(Format-Duration $monitorElapsed))" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray

    $completedPRs = @()

    foreach ($prNum in $PRNumbers) {
        Write-Host ""
        Write-Host "  📋 PR #$prNum" -ForegroundColor White -NoNewline
        
        $prInfo = Get-PRInfo -PRNumber $prNum
        
        if ($prInfo) {
            Write-Host " - $($prInfo.title)" -ForegroundColor Cyan
            Write-Host "     URL: $($prInfo.url)" -ForegroundColor Gray
            Write-Host "     State: $($prInfo.state)$(if ($prInfo.mergedAt) { ' (Merged)' })$(if ($prInfo.closedAt -and -not $prInfo.mergedAt) { ' (Closed)' })" -ForegroundColor Gray
            
            # Get timeline for Copilot completion detection
            $timeline = Get-PRTimeline -PRNumber $prNum
            $copilotFinished = Test-CopilotFinished -PRInfo $prInfo -Timeline $timeline
            
            # Display Copilot status
            if ($copilotFinished) {
                Write-Host "     🤖 Copilot: Finished ✅" -ForegroundColor Green
            } else {
                Write-Host "     🤖 Copilot: Working... ⏳" -ForegroundColor Yellow
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
                Write-Host "     ⚠️  CI checks failed - needs investigation" -ForegroundColor Red
            }
            
            # Display mergeable status
            if ($prInfo.mergeable -eq 'CONFLICTING') {
                Write-Host "     ⚠️  Merge conflicts detected!" -ForegroundColor Red
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
                $completedPRs += $prNum
            }
            
        } else {
            Write-Host " - Unable to fetch PR info (may be closed/merged)" -ForegroundColor Yellow
        }
    }

    # Check if ANY PR completed in this iteration - EXIT IMMEDIATELY
    if ($completedPRs.Count -gt 0) {
        Write-Host ""
        Write-Host ("=" * 80) -ForegroundColor Green
        Write-Host "🎉 PR(S) FINISHED - EXITING! 🎉" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host ("=" * 80) -ForegroundColor Green
        Write-Host ""
        Write-Host "Monitor Duration: $(Format-Duration $monitorElapsed)" -ForegroundColor Cyan
        Write-Host "Completed PRs: $($completedPRs -join ', ')" -ForegroundColor Green
        
        # Map completed PRs to task IDs
        $completedTaskIds = @()
        foreach ($pr in $completedPRs) {
            if ($TaskMappings.ContainsKey($pr)) {
                $completedTaskIds += $TaskMappings[$pr]
                Write-Host "  PR #$pr -> Task: $($TaskMappings[$pr])" -ForegroundColor Cyan
            }
        }
        
        Write-Host "Still Working PRs: $(($PRNumbers | Where-Object { $_ -notin $completedPRs }) -join ', ')" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "✅ Copilot agent(s) have finished work on PR(s): $($completedPRs -join ', ')" -ForegroundColor Green
        Write-Host "✅ CI checks passed and PR(s) are mergeable" -ForegroundColor Green
        Write-Host ""
        
        # Generate next tasks if requested and we have task mappings
        if ($GenerateNextTasks -and $completedTaskIds.Count -gt 0) {
            Write-Host ("=" * 80) -ForegroundColor Cyan
            Write-Host "📋 GENERATING NEXT AVAILABLE TASKS..." -ForegroundColor Cyan
            Write-Host ("=" * 80) -ForegroundColor Cyan
            Write-Host ""
            
            $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
            $getNextTasksScript = Join-Path $scriptDir "Get-NextTasks.ps1"
            
            if (Test-Path $getNextTasksScript) {
                try {
                    # Call Get-NextTasks.ps1 with completed task IDs
                    & $getNextTasksScript -CompletedTasks $completedTaskIds -Format List
                    
                    Write-Host ""
                    Write-Host ("=" * 80) -ForegroundColor Cyan
                    Write-Host "� MACHINE-READABLE OUTPUT (JSON)" -ForegroundColor Cyan
                    Write-Host ("=" * 80) -ForegroundColor Cyan
                    
                    # Also get JSON output for automation
                    $jsonOutput = & $getNextTasksScript -CompletedTasks $completedTaskIds -Format Json | ConvertFrom-Json
                    
                    Write-Host ""
                    Write-Host "Next Available Tasks (for automation):" -ForegroundColor Yellow
                    if ($jsonOutput.available_tasks -and $jsonOutput.available_tasks.Count -gt 0) {
                        foreach ($task in $jsonOutput.available_tasks) {
                            Write-Host "  • $($task.TaskId) - $($task.Summary)" -ForegroundColor White
                        }
                        
                        Write-Host ""
                        Write-Host "Tasks that can run in parallel:" -ForegroundColor Yellow
                        Write-Host "  $($jsonOutput.can_run_in_parallel -join ', ')" -ForegroundColor Green
                        
                        # Save to file for easy access
                        $outputFile = Join-Path $scriptDir "next-tasks.json"
                        $jsonOutput | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding utf8
                        Write-Host ""
                        Write-Host "💾 Full task data saved to: $outputFile" -ForegroundColor Gray
                    } else {
                        Write-Host "  No tasks available (all remaining tasks are blocked)" -ForegroundColor Yellow
                    }
                    
                } catch {
                    Write-Warning "Failed to generate next tasks: $_"
                }
            } else {
                Write-Warning "Get-NextTasks.ps1 not found at: $getNextTasksScript"
            }
            
            Write-Host ""
        }
        
        Write-Host "�🔍 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. Review completed PR(s): $($completedPRs -join ', ')" -ForegroundColor White
        Write-Host "2. Run tests and merge if ready" -ForegroundColor White
        if ($GenerateNextTasks -and $completedTaskIds.Count -gt 0) {
            Write-Host "3. Assign next available tasks shown above" -ForegroundColor White
        } else {
            Write-Host "3. Continue monitoring remaining PRs if needed" -ForegroundColor White
        }
        Write-Host ""
        
        Invoke-CompletionSound -Success $true
        
        # Exit immediately with success - at least one PR finished
        exit 0
    }

    # Summary status
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host "  📊 Summary: No PRs ready yet - continuing to monitor" -ForegroundColor Cyan
    Write-Host ""

    # Only sleep if we're not on the last iteration
    if ($i -lt $MaxPolls) {
        Start-Sleep -Seconds $PollIntervalSeconds
    }
}

# If we reach here, timeout was reached without any PR finishing
Write-Host ""
Write-Host "⏰ Maximum monitoring time reached ($MaxPolls polls)" -ForegroundColor Yellow
Write-Host "Monitor Duration: $(Format-Duration (Get-Date - $script:monitorStartTime))" -ForegroundColor Cyan
Write-Host "No PRs finished during monitoring period" -ForegroundColor White
Write-Host ""
Write-Host "PRs may still be in progress. Check GitHub for current status." -ForegroundColor White
exit 2

#endregion
