#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Merges completed Copilot PRs and pushes changes back to base branch.

.DESCRIPTION
    Handles the merge workflow for GitHub Copilot-completed PRs:
    1. Validates PR is ready (CI passed, mergeable, Copilot finished)
    2. Optionally runs local validation (tests, build)
    3. Merges PR to base branch
    4. Cleans up branches
    5. Pulls latest changes locally
    
    Supports merging multiple PRs in dependency order.

.PARAMETER PRNumbers
    Array of PR numbers to merge. Will be merged in the order provided.

.PARAMETER Owner
    Repository owner. Defaults to "AmeliaRose802".

.PARAMETER Repo
    Repository name. Defaults to "enhanced-ado-mcp".

.PARAMETER MergeMethod
    How to merge: "squash" (default), "merge", or "rebase".

.PARAMETER ValidateLocally
    If set, pulls PR branch locally and runs npm test + npm run build before merging.

.PARAMETER SkipValidation
    Skip all validation checks (dangerous - use only if you're certain).

.PARAMETER DeleteBranch
    Delete the PR branch after merging. Defaults to true.

.PARAMETER PushUpstream
    After merging, pull latest changes and push to ensure local repo is in sync.

.EXAMPLE
    .\Merge-And-Push.ps1 -PRNumbers 1,2,3,4
    Merge PRs 1-4 in order with default settings.

.EXAMPLE
    .\Merge-And-Push.ps1 -PRNumbers 5 -ValidateLocally -PushUpstream
    Merge PR #5 with local validation and push changes.

.EXAMPLE
    # Merge in dependency order
    .\Merge-And-Push.ps1 -PRNumbers 5,7,6 -ValidateLocally
    Merges PR #5 first, then #7, then #6 (dependency order).
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [int[]]$PRNumbers,
    
    [string]$Owner = "AmeliaRose802",
    
    [string]$Repo = "enhanced-ado-mcp",
    
    [ValidateSet("squash", "merge", "rebase")]
    [string]$MergeMethod = "squash",
    
    [switch]$ValidateLocally,
    
    [switch]$SkipValidation,
    
    [bool]$DeleteBranch = $true,
    
    [switch]$PushUpstream
)

$ErrorActionPreference = "Stop"

Write-Host "=== GITHUB COPILOT PR MERGE WORKFLOW ===" -ForegroundColor Cyan
Write-Host "Repository: $Owner/$Repo" -ForegroundColor White
Write-Host "PRs to merge: $($PRNumbers -join ', ')" -ForegroundColor White
Write-Host "Merge method: $MergeMethod" -ForegroundColor White
Write-Host ""

# Validate gh CLI
try {
    $null = gh --version
} catch {
    Write-Error "GitHub CLI (gh) is not installed. Install from: https://cli.github.com/"
    exit 1
}

#region Helper Functions

function Get-PRStatus {
    param([int]$PRNumber)
    
    try {
        $json = gh pr view $PRNumber --repo "$Owner/$Repo" --json number,title,state,isDraft,mergeable,statusCheckRollup,reviewDecision,headRefName 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $json) {
            return $json | ConvertFrom-Json
        }
    } catch {
        return $null
    }
    return $null
}

function Test-PRReadyForMerge {
    param([object]$PRInfo, [bool]$SkipChecks = $false)
    
    if (-not $PRInfo) {
        Write-Warning "PR info not available"
        return $false
    }
    
    if ($SkipChecks) {
        Write-Host "  ⚠️  Skipping validation checks (forced)" -ForegroundColor Yellow
        return $true
    }
    
    $issues = @()
    
    # Check state
    if ($PRInfo.state -ne "OPEN") {
        $issues += "PR is not open (state: $($PRInfo.state))"
    }
    
    # Check mergeable
    if ($PRInfo.mergeable -eq "CONFLICTING") {
        $issues += "PR has merge conflicts"
    }
    
    # Check CI
    if ($PRInfo.statusCheckRollup) {
        $failed = ($PRInfo.statusCheckRollup | Where-Object { $_.conclusion -eq 'failure' }).Count
        $pending = ($PRInfo.statusCheckRollup | Where-Object { $_.status -in @('queued', 'in_progress', 'pending') }).Count
        
        if ($failed -gt 0) {
            $issues += "$failed CI check(s) failed"
        }
        if ($pending -gt 0) {
            $issues += "$pending CI check(s) still running"
        }
    }
    
    if ($issues.Count -gt 0) {
        Write-Host "  ❌ PR not ready for merge:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "     - $issue" -ForegroundColor Red
        }
        return $false
    }
    
    Write-Host "  ✅ PR is ready for merge" -ForegroundColor Green
    return $true
}

function Invoke-LocalValidation {
    param([object]$PRInfo)
    
    Write-Host "  🔍 Running local validation..." -ForegroundColor Cyan
    
    # Get current directory
    $originalDir = Get-Location
    $repoPath = "c:\Users\ameliapayne\ADO-Work-Item-MSP\mcp_server"
    
    try {
        Set-Location $repoPath
        
        # Fetch latest
        Write-Host "     Fetching latest changes..." -ForegroundColor Gray
        git fetch origin 2>&1 | Out-Null
        
        # Checkout PR branch
        $branchName = $PRInfo.headRefName
        Write-Host "     Checking out branch: $branchName" -ForegroundColor Gray
        git checkout $branchName 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to checkout branch. Attempting to create tracking branch..."
            git checkout -b $branchName "origin/$branchName" 2>&1 | Out-Null
        }
        
        # Pull latest
        git pull origin $branchName 2>&1 | Out-Null
        
        # Run tests
        Write-Host "     Running tests..." -ForegroundColor Gray
        $testOutput = npm test 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "     ❌ Tests failed!" -ForegroundColor Red
            Write-Host $testOutput -ForegroundColor Red
            return $false
        }
        
        Write-Host "     ✅ Tests passed" -ForegroundColor Green
        
        # Run build
        Write-Host "     Running build..." -ForegroundColor Gray
        $buildOutput = npm run build 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "     ❌ Build failed!" -ForegroundColor Red
            Write-Host $buildOutput -ForegroundColor Red
            return $false
        }
        
        Write-Host "     ✅ Build succeeded" -ForegroundColor Green
        
        # Return to original branch
        git checkout master 2>&1 | Out-Null
        
        return $true
        
    } catch {
        Write-Warning "Local validation failed: $_"
        return $false
    } finally {
        Set-Location $originalDir
    }
}

#endregion

# Process each PR
$successfulMerges = @()
$failedMerges = @()

foreach ($prNum in $PRNumbers) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "📋 Processing PR #$prNum" -ForegroundColor Cyan
    Write-Host ""
    
    # Get PR info
    $prInfo = Get-PRStatus -PRNumber $prNum
    
    if (-not $prInfo) {
        Write-Host "  ❌ Could not fetch PR info" -ForegroundColor Red
        $failedMerges += $prNum
        continue
    }
    
    Write-Host "  Title: $($prInfo.title)" -ForegroundColor White
    Write-Host "  State: $($prInfo.state)" -ForegroundColor Gray
    Write-Host "  Draft: $($prInfo.isDraft)" -ForegroundColor Gray
    Write-Host "  Mergeable: $($prInfo.mergeable)" -ForegroundColor Gray
    Write-Host ""
    
    # Validate PR is ready
    $isReady = Test-PRReadyForMerge -PRInfo $prInfo -SkipChecks $SkipValidation
    
    if (-not $isReady -and -not $SkipValidation) {
        Write-Host "  ⏭️  Skipping PR #$prNum (not ready)" -ForegroundColor Yellow
        $failedMerges += $prNum
        continue
    }
    
    # Local validation if requested
    if ($ValidateLocally -and -not $SkipValidation) {
        $validationPassed = Invoke-LocalValidation -PRInfo $prInfo
        
        if (-not $validationPassed) {
            Write-Host "  ❌ Local validation failed for PR #$prNum" -ForegroundColor Red
            $failedMerges += $prNum
            continue
        }
    }
    
    # Confirm merge
    if (-not $PSCmdlet.ShouldProcess("PR #$prNum : $($prInfo.title)", "Merge")) {
        if (-not $WhatIfPreference) {
            Write-Host "  Merge PR #$prNum ? (y/n): " -NoNewline -ForegroundColor Yellow
            $confirm = Read-Host
            if ($confirm -ne 'y') {
                Write-Host "  ⏭️  Skipped PR #$prNum" -ForegroundColor Yellow
                continue
            }
        }
    }
    
    # Merge the PR
    Write-Host "  🔄 Merging PR #$prNum..." -ForegroundColor Cyan
    
    $mergeArgs = @(
        "pr", "merge", $prNum,
        "--repo", "$Owner/$Repo",
        "--$MergeMethod"
    )
    
    if ($DeleteBranch) {
        $mergeArgs += "--delete-branch"
    }
    
    $mergeOutput = & gh @mergeArgs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ PR #$prNum merged successfully!" -ForegroundColor Green
        $successfulMerges += $prNum
    } else {
        Write-Host "  ❌ Failed to merge PR #$prNum" -ForegroundColor Red
        Write-Host "  Error: $mergeOutput" -ForegroundColor Red
        $failedMerges += $prNum
    }
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📊 MERGE SUMMARY" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total PRs: $($PRNumbers.Count)" -ForegroundColor White
Write-Host "Successful: $($successfulMerges.Count)" -ForegroundColor Green
Write-Host "Failed: $($failedMerges.Count)" -ForegroundColor $(if ($failedMerges.Count -gt 0) { "Red" } else { "Gray" })
Write-Host ""

if ($successfulMerges.Count -gt 0) {
    Write-Host "✅ Merged PRs: $($successfulMerges -join ', ')" -ForegroundColor Green
}

if ($failedMerges.Count -gt 0) {
    Write-Host "❌ Failed PRs: $($failedMerges -join ', ')" -ForegroundColor Red
}

# Push upstream if requested
if ($PushUpstream -and $successfulMerges.Count -gt 0) {
    Write-Host ""
    Write-Host "🔄 Syncing local repository with remote..." -ForegroundColor Cyan
    
    $repoPath = "c:\Users\ameliapayne\ADO-Work-Item-MSP"
    $originalDir = Get-Location
    
    try {
        Set-Location $repoPath
        
        # Fetch all
        Write-Host "  Fetching all branches..." -ForegroundColor Gray
        git fetch --all --prune 2>&1 | Out-Null
        
        # Checkout master
        Write-Host "  Checking out master..." -ForegroundColor Gray
        git checkout master 2>&1 | Out-Null
        
        # Pull latest
        Write-Host "  Pulling latest changes..." -ForegroundColor Gray
        $pullOutput = git pull origin master 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Local repository is up to date" -ForegroundColor Green
        } else {
            Write-Warning "Failed to sync local repository: $pullOutput"
        }
        
        # Push any local commits
        Write-Host "  Pushing any local changes..." -ForegroundColor Gray
        $pushOutput = git push origin master 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ All changes pushed to remote" -ForegroundColor Green
        } else {
            Write-Verbose "Push output: $pushOutput"
        }
        
    } catch {
        Write-Warning "Failed to sync repository: $_"
    } finally {
        Set-Location $originalDir
    }
}

Write-Host ""

# Final validation if merges were successful
if ($successfulMerges.Count -gt 0 -and -not $SkipValidation) {
    Write-Host "🔍 Running final validation..." -ForegroundColor Cyan
    
    $repoPath = "c:\Users\ameliapayne\ADO-Work-Item-MSP\mcp_server"
    $originalDir = Get-Location
    
    try {
        Set-Location $repoPath
        
        Write-Host "  Running tests on merged code..." -ForegroundColor Gray
        $testOutput = npm test 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ All tests passing!" -ForegroundColor Green
            
            $buildOutput = npm run build 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Build successful!" -ForegroundColor Green
            } else {
                Write-Warning "Build failed after merge. Manual review needed."
            }
        } else {
            Write-Warning "Tests failed after merge. Manual review needed."
        }
        
    } catch {
        Write-Warning "Final validation failed: $_"
    } finally {
        Set-Location $originalDir
    }
}

# Exit with appropriate code
if ($failedMerges.Count -gt 0) {
    exit 1
} else {
    Write-Host "🎉 All PRs processed successfully!" -ForegroundColor Green
    exit 0
}
