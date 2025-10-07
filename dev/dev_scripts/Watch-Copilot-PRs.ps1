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
    [Parameter(Mandatory)]
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
        $json = gh pr view $PRNumber --repo "$Owner/$Repo" --json number,title,state,isDraft,author,mergeable,statusCheckRollup,reviewDecision,updatedAt,url,reviewRequests 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $json) {
            return $json | ConvertFrom-Json
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
            if ($request.login -eq $Owner) {
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
            
            # Get timeline for Copilot completion detection
            $timeline = Get-PRTimeline -PRNumber $prNum
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
                Write-Host "     ⚠️  CI checks failed - needs investigation" -ForegroundColor Red
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
            Write-Host " - Unable to fetch PR info" -ForegroundColor Red
            $allFinished = $false
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
        Write-Host "2. Run integration tests: npm test && npm run build" -ForegroundColor White
        Write-Host "3. Merge PRs in dependency order" -ForegroundColor White
        Write-Host "4. Proceed to next block" -ForegroundColor White
        Write-Host ""
        
        Invoke-CompletionSound -Success $true
        exit 0
    }

    # Summary status
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host "  📊 Summary: $($script:completedPRs.Count)/$($PRNumbers.Count) PRs ready" -ForegroundColor Cyan
    if ($anyFailed) {
        Write-Host "  ⚠️  Some PRs have issues - may need manual intervention" -ForegroundColor Yellow
    }
    Write-Host ""

    Start-Sleep -Seconds $PollIntervalSeconds
}

# Maximum polls reached
Write-Host ""
Write-Host "⏰ Maximum monitoring time reached ($MaxPolls polls)" -ForegroundColor Yellow
Write-Host "Monitor Duration: $(Format-Duration ($currentTime - $script:monitorStartTime))" -ForegroundColor Cyan
Write-Host "Completed PRs: $($script:completedPRs.Count)/$($PRNumbers.Count)" -ForegroundColor White
Write-Host ""
Write-Host "PRs may still be in progress. Check GitHub for current status." -ForegroundColor White
exit 2

#endregion
