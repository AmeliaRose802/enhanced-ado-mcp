#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Convenience wrapper for Watch-Copilot-PR-Any.ps1 with task tracking.

.DESCRIPTION
    Monitors GitHub Copilot PRs and automatically tracks task completion.
    When a PR finishes, displays next available tasks from the execution plan.
    
    This script simplifies the workflow by:
    1. Accepting PR-to-task mappings in a simple format
    2. Monitoring PRs until one completes
    3. Automatically showing what to work on next
    4. Saving task data in JSON format for automation

.PARAMETER PRTaskPairs
    Array of "PR:TaskID" pairs. Example: @("123:T2_precommit_hooks", "124:T8_consolidate_types")

.PARAMETER Owner
    Repository owner. Defaults to "AmeliaRose802".

.PARAMETER Repo
    Repository name. Defaults to "enhanced-ado-mcp".

.PARAMETER PollIntervalSeconds
    Polling interval in seconds. Defaults to 30.

.EXAMPLE
    .\Watch-With-Tasks.ps1 -PRTaskPairs @("123:T2_precommit_hooks", "124:T48_audit_resources")
    Monitor PRs 123 and 124, exit when either finishes, show next tasks.

.EXAMPLE
    .\Watch-With-Tasks.ps1 -PRTaskPairs @("10:T12_repository_pattern") -PollIntervalSeconds 60
    Monitor single PR with custom poll interval.

.EXAMPLE
    # Read from file
    $pairs = Get-Content "active-prs.txt"
    .\Watch-With-Tasks.ps1 -PRTaskPairs $pairs
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string[]]$PRTaskPairs,
    
    [string]$Owner = "AmeliaRose802",
    
    [string]$Repo = "enhanced-ado-mcp",
    
    [int]$PollIntervalSeconds = 30
)

$ErrorActionPreference = "Stop"

# Parse PR:Task pairs
$prNumbers = @()
$taskMappings = @{}

Write-Host "=== PARSING PR-TO-TASK MAPPINGS ===" -ForegroundColor Cyan
Write-Host ""

foreach ($pair in $PRTaskPairs) {
    if ($pair -match '^(\d+):(.+)$') {
        $prNum = [int]$matches[1]
        $taskId = $matches[2].Trim()
        
        $prNumbers += $prNum
        $taskMappings[$prNum] = $taskId
        
        Write-Host "✓ PR #$prNum -> $taskId" -ForegroundColor Green
    } else {
        Write-Warning "Invalid format: '$pair'. Expected format: 'PR:TaskID' (e.g., '123:T2_precommit_hooks')"
    }
}

if ($prNumbers.Count -eq 0) {
    Write-Error "No valid PR-to-task mappings found. Use format: 'PR:TaskID'"
    Write-Host ""
    Write-Host "Example: .\Watch-With-Tasks.ps1 -PRTaskPairs @('123:T2_precommit_hooks', '124:T48_audit_resources')"
    exit 1
}

Write-Host ""
Write-Host "Monitoring $($prNumbers.Count) PR(s) with task tracking enabled" -ForegroundColor Cyan
Write-Host ""

# Call Watch-Copilot-PR-Any.ps1 with task mappings
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$watchScript = Join-Path $scriptDir "Watch-Copilot-PR-Any.ps1"

if (-not (Test-Path $watchScript)) {
    Write-Error "Watch-Copilot-PR-Any.ps1 not found at: $watchScript"
    exit 1
}

# Execute with splatting
& $watchScript `
    -PRNumbers $prNumbers `
    -Owner $Owner `
    -Repo $Repo `
    -PollIntervalSeconds $PollIntervalSeconds `
    -TaskMappings $taskMappings `
    -GenerateNextTasks $true

# Exit with same code as Watch-Copilot-PR-Any.ps1
exit $LASTEXITCODE
