#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Assigns work to GitHub Copilot agent via pull request creation.

.DESCRIPTION
    Creates a pull request and assigns it to GitHub Copilot coding agent.
    The agent will work on the task in the background and create a PR with implementation.
    
    Use this script to delegate implementation work to Copilot agents while you
    focus on orchestration, review, and integration tasks.

.PARAMETER Owner
    Repository owner. Defaults to "AmeliaRose802".

.PARAMETER Repo
    Repository name. Defaults to "enhanced-ado-mcp".

.PARAMETER Title
    Title for the pull request that will be created.

.PARAMETER ProblemStatement
    Detailed description of the task to be performed. Should include:
    - Specific files to modify
    - Exact changes needed
    - Validation steps (tests to run, build to verify)
    - Success criteria

.PARAMETER BaseRef
    Git reference (branch) to start from. Defaults to "master".

.PARAMETER WaitForCompletion
    If set, blocks until the Copilot agent completes the work.
    Uses Watch-Copilot-PRs.ps1 to monitor progress.

.PARAMETER PollIntervalSeconds
    Polling interval when WaitForCompletion is set. Defaults to 30 seconds.

.EXAMPLE
    .\Assign-To-Copilot.ps1 `
        -Title "feat: Add item selection to query handle service" `
        -ProblemStatement "Enhance src/services/query-handle-service.ts to support item selection..."

.EXAMPLE
    # Assign and wait for completion
    .\Assign-To-Copilot.ps1 `
        -Title "test: Add unit tests for selection" `
        -ProblemStatement "Add comprehensive unit tests..." `
        -WaitForCompletion

.EXAMPLE
    # Assign to different branch
    .\Assign-To-Copilot.ps1 `
        -Title "fix: Resolve merge conflict" `
        -ProblemStatement "Resolve conflict in schemas.ts" `
        -BaseRef "feature/query-handles"
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$Title,
    
    [Parameter(Mandatory)]
    [string]$ProblemStatement,
    
    [string]$Owner = "AmeliaRose802",
    
    [string]$Repo = "enhanced-ado-mcp",
    
    [string]$BaseRef = "master",
    
    [switch]$WaitForCompletion,
    
    [int]$PollIntervalSeconds = 30
)

$ErrorActionPreference = "Stop"

Write-Host "=== GITHUB COPILOT ASSIGNMENT ===" -ForegroundColor Cyan
Write-Host "Repository: $Owner/$Repo" -ForegroundColor White
Write-Host "Base Branch: $BaseRef" -ForegroundColor White
Write-Host "Title: $Title" -ForegroundColor White
Write-Host ""
Write-Host "Problem Statement:" -ForegroundColor Yellow
Write-Host $ProblemStatement -ForegroundColor Gray
Write-Host ""

# Validate gh CLI is available
try {
    $null = gh --version
} catch {
    Write-Error "GitHub CLI (gh) is not installed or not in PATH. Install from: https://cli.github.com/"
    exit 1
}

# Confirm assignment
if (-not $PSCmdlet.ShouldProcess("Create PR and assign to GitHub Copilot", "Confirm")) {
    if (-not $WhatIfPreference) {
        Write-Host "Create this PR and assign to Copilot? (y/n): " -NoNewline -ForegroundColor Yellow
        $confirm = Read-Host
        if ($confirm -ne 'y') {
            Write-Host "Cancelled." -ForegroundColor Red
            exit 0
        }
    }
}

# Create the PR using GitHub Copilot
Write-Host "🤖 Creating pull request and assigning to GitHub Copilot..." -ForegroundColor Cyan

try {
    # Use GitHub CLI to create PR body
    $prBody = @"
## Problem Statement

$ProblemStatement

## Assignment

This PR has been created for GitHub Copilot coding agent to implement.

**Agent Instructions:**
- Read the problem statement carefully
- Implement the changes as specified
- Ensure all tests pass: ``npm test``
- Ensure TypeScript compiles: ``npm run build``
- Follow existing code patterns and style
- Add unit tests for new functionality
- Update documentation if needed

## Success Criteria

- [ ] All specified changes implemented
- [ ] All tests passing (99+ tests)
- [ ] TypeScript compilation succeeds
- [ ] No regressions introduced
- [ ] Code follows project conventions

---

*This PR was created by automation. Agent will update when work is complete.*
"@

    # Create a temporary file for the PR body
    $tempFile = [System.IO.Path]::GetTempFileName()
    $prBody | Out-File -FilePath $tempFile -Encoding utf8

    # Create the PR
    # Note: GitHub Copilot integration happens through GitHub's UI/API
    # This creates the PR structure; actual Copilot assignment may need to be done via web UI
    $prOutput = gh pr create `
        --repo "$Owner/$Repo" `
        --base $BaseRef `
        --title $Title `
        --body-file $tempFile `
        --draft 2>&1

    Remove-Item $tempFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create PR: $prOutput"
        exit 1
    }

    # Extract PR number from output
    $prUrl = $prOutput | Select-String -Pattern "https://github.com/$Owner/$Repo/pull/(\d+)" | ForEach-Object { $_.Matches[0].Value }
    $prNumber = $prUrl -replace ".*pull/(\d+).*", '$1'

    Write-Host ""
    Write-Host "✅ Pull request created successfully!" -ForegroundColor Green
    Write-Host "PR #$prNumber : $prUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Provide instructions for Copilot assignment
    Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Open PR in browser: $prUrl" -ForegroundColor White
    Write-Host "2. Look for 'Copilot' button or assign to GitHub Copilot" -ForegroundColor White
    Write-Host "3. Copilot will begin work automatically" -ForegroundColor White
    Write-Host ""
    Write-Host "ALTERNATIVE: Use GitHub Copilot chat to assign:" -ForegroundColor Yellow
    Write-Host "  '@github assign copilot to issue $Owner/$Repo#$prNumber'" -ForegroundColor Gray
    Write-Host ""

    # If using GitHub API directly (requires appropriate permissions and setup)
    Write-Host "💡 TIP: You can also use GitHub's API:" -ForegroundColor Cyan
    Write-Host "  gh api '/repos/$Owner/$Repo/pulls/$prNumber/requested_reviewers' -f reviewers[]='github-copilot'" -ForegroundColor Gray
    Write-Host ""

    if ($WaitForCompletion) {
        Write-Host "⏳ Waiting for Copilot to complete work..." -ForegroundColor Yellow
        Write-Host "Starting polling script..." -ForegroundColor Gray
        Write-Host ""
        
        # Use the Watch-Copilot-PRs script
        $watchScript = Join-Path $PSScriptRoot "Watch-Copilot-PRs.ps1"
        
        if (Test-Path $watchScript) {
            & $watchScript -PRNumbers @([int]$prNumber) -Owner $Owner -Repo $Repo -PollIntervalSeconds $PollIntervalSeconds
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Copilot has completed the work!" -ForegroundColor Green
                Write-Host "PR #$prNumber is ready for review and merge." -ForegroundColor Green
                Write-Host ""
                
                # Offer to merge
                Write-Host "Merge this PR now? (y/n): " -NoNewline -ForegroundColor Yellow
                $mergeConfirm = Read-Host
                if ($mergeConfirm -eq 'y') {
                    Write-Host "🔄 Merging PR #$prNumber..." -ForegroundColor Cyan
                    gh pr merge $prNumber --repo "$Owner/$Repo" --squash --delete-branch 2>&1
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ PR #$prNumber merged successfully!" -ForegroundColor Green
                    } else {
                        Write-Warning "Failed to merge PR. You can merge manually: $prUrl"
                    }
                }
            }
        } else {
            Write-Warning "Watch-Copilot-PRs.ps1 not found. Monitor manually: $prUrl"
        }
    } else {
        Write-Host "✅ Assignment complete. Monitor progress at: $prUrl" -ForegroundColor Green
        Write-Host ""
        Write-Host "To monitor this PR, run:" -ForegroundColor Cyan
        Write-Host "  .\Watch-Copilot-PRs.ps1 -PRNumbers $prNumber" -ForegroundColor Gray
    }

    exit 0

} catch {
    Write-Error "Failed to create PR: $_"
    exit 1
}
