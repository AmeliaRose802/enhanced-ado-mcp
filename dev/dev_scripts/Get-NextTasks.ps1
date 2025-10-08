#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Shows the next available tasks after completing a given task.

.DESCRIPTION
    This script analyzes the parallel execution plan and shows which tasks can be started
    after a given task (or set of tasks) has been completed. It considers dependencies and
    conflicts to suggest the optimal next actions.

.PARAMETER CompletedTask
    The task ID that has just been completed (e.g., "T2_precommit_hooks")

.PARAMETER CompletedTasks
    Array of task IDs that have been completed (e.g., @("T2_precommit_hooks", "T8_consolidate_ado_types"))

.PARAMETER ShowAll
    Show all remaining tasks, not just immediately available ones

.PARAMETER Format
    Output format: Table (default), List, or Json

.EXAMPLE
    .\Get-NextTasks.ps1 -CompletedTask "T2_precommit_hooks"
    Shows what tasks can be started after completing T2_precommit_hooks

.EXAMPLE
    .\Get-NextTasks.ps1 -CompletedTasks @("T2_precommit_hooks", "T8_consolidate_ado_types")
    Shows what tasks can be started after completing multiple tasks

.EXAMPLE
    .\Get-NextTasks.ps1 -CompletedTask "T2_precommit_hooks" -ShowAll
    Shows all remaining tasks with their status
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CompletedTask,
    
    [Parameter(Mandatory=$false)]
    [string[]]$CompletedTasks = @(),
    
    [Parameter(Mandatory=$false)]
    [switch]$ShowAll,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("Table", "List", "Json")]
    [string]$Format = "Table"
)

# Combine single task and array into one list
$allCompletedTasks = @()
if ($CompletedTask) {
    $allCompletedTasks += $CompletedTask
}
if ($CompletedTasks.Count -gt 0) {
    $allCompletedTasks += $CompletedTasks
}

# Load the execution plan
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$planFile = Join-Path $repoRoot "tasklist\plan\parallel_execution_plan.json"
$outputFile = Join-Path $repoRoot "tasklist\plan\next_tasks.json"

if (-not (Test-Path $planFile)) {
    Write-Error "Execution plan not found at: $planFile"
    Write-Host "Please run generate_parallel_execution_plan.py first."
    exit 1
}

$plan = Get-Content $planFile -Raw | ConvertFrom-Json

# Build a flat list of all tasks
$allTasks = @()
foreach ($wave in $plan.execution_plan.waves) {
    foreach ($task in $wave.tasks) {
        $allTasks += [PSCustomObject]@{
            TaskId = $task.task_id
            Summary = $task.summary
            Description = $task.description
            RuntimeMin = $task.expected_runtime_min
            DependsOn = $task.depends_on
            ConflictsWith = $task.conflicts_with
            Files = $task.files
            Wave = $wave.wave_number
        }
    }
}

# If no completed tasks specified, show the first wave
if ($allCompletedTasks.Count -eq 0) {
    Write-Host "`n🚀 " -NoNewline -ForegroundColor Green
    Write-Host "GETTING STARTED - Wave 1 Tasks" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor DarkGray
    Write-Host "`nNo tasks completed yet. Here are the tasks you can start with:`n"
    
    $wave1Tasks = $allTasks | Where-Object { $_.Wave -eq 1 }
    
    # Build output data for file (always do this regardless of format)
    $wave1Output = @{
        timestamp = (Get-Date -Format "o")
        completed_tasks = @()
        available_tasks = $wave1Tasks | ForEach-Object {
            @{
                TaskId = $_.TaskId
                Summary = $_.Summary
                Description = $_.Description
                RuntimeMin = $_.RuntimeMin
                Wave = $_.Wave
                ConflictsWith = $_.ConflictsWith
                Files = $_.Files
            }
        }
        total_tasks = $allTasks.Count
        completed_count = 0
        progress_percent = 0
        can_run_in_parallel = $wave1Tasks.TaskId
    }
    
    if ($Format -eq "Json") {
        $wave1Output | ConvertTo-Json -Depth 10
    }
    elseif ($Format -eq "List") {
        foreach ($task in $wave1Tasks) {
            Write-Host "📋 " -NoNewline -ForegroundColor Yellow
            Write-Host "$($task.TaskId)" -ForegroundColor White -NoNewline
            Write-Host " ($($task.RuntimeMin) min)" -ForegroundColor DarkGray
            Write-Host "   $($task.Summary)" -ForegroundColor Gray
            Write-Host ""
        }
    }
    else {
        $wave1Tasks | Select-Object @{N='Task';E={$_.TaskId}}, 
                                     @{N='Time';E={"$($_.RuntimeMin)m"}}, 
                                     Summary | 
            Format-Table -AutoSize
    }
    
    Write-Host "`n💡 TIP: All Wave 1 tasks can run in parallel!" -ForegroundColor Yellow
    Write-Host "   Run multiple tasks simultaneously for maximum efficiency.`n"
    
    # Write to file for agent reference
    $wave1Output | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding utf8
    Write-Host "📁 Next tasks written to: $outputFile`n" -ForegroundColor DarkGray
    
    exit 0
}

# Validate completed tasks exist
foreach ($taskId in $allCompletedTasks) {
    if (-not ($allTasks | Where-Object { $_.TaskId -eq $taskId })) {
        Write-Error "Task not found: $taskId"
        Write-Host "`nAvailable tasks:"
        $allTasks | Select-Object TaskId, Summary | Format-Table -AutoSize
        exit 1
    }
}

# Calculate which tasks are now available
$availableTasks = @()
$blockedTasks = @()
$stillRunningTasks = @()

foreach ($task in $allTasks) {
    # Skip if already completed
    if ($allCompletedTasks -contains $task.TaskId) {
        continue
    }
    
    # Check if dependencies are satisfied
    $dependenciesMet = $true
    $missingDeps = @()
    foreach ($dep in $task.DependsOn) {
        if ($allCompletedTasks -notcontains $dep) {
            $dependenciesMet = $false
            $missingDeps += $dep
        }
    }
    
    if ($dependenciesMet) {
        $availableTasks += [PSCustomObject]@{
            TaskId = $task.TaskId
            Summary = $task.Summary
            RuntimeMin = $task.RuntimeMin
            Wave = $task.Wave
            ConflictsWith = $task.ConflictsWith
            Files = $task.Files
            Description = $task.Description
        }
    }
    else {
        $blockedTasks += [PSCustomObject]@{
            TaskId = $task.TaskId
            Summary = $task.Summary
            MissingDeps = $missingDeps
            Wave = $task.Wave
        }
    }
}

# Display results
Write-Host "`n✅ " -NoNewline -ForegroundColor Green
Write-Host "COMPLETED: " -NoNewline -ForegroundColor Cyan
Write-Host ($allCompletedTasks -join ", ") -ForegroundColor White
Write-Host ("=" * 80) -ForegroundColor DarkGray

if ($availableTasks.Count -eq 0) {
    if ($blockedTasks.Count -eq 0) {
        Write-Host "`n🎉 " -NoNewline -ForegroundColor Green
        Write-Host "ALL TASKS COMPLETED!" -ForegroundColor Green
        Write-Host "`nCongratulations! The entire task list has been finished.`n"
        
        # Write completion status to file
        $totalTasks = $allTasks.Count
        $completedData = @{
            timestamp = (Get-Date -Format "o")
            status = "ALL_COMPLETED"
            completed_tasks = $allCompletedTasks
            total_tasks = $totalTasks
            completed_count = $totalTasks
            progress_percent = 100
            available_tasks = @()
            can_run_in_parallel = @()
        }
        $completedData | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding utf8
        Write-Host "📁 Completion status written to: $outputFile`n" -ForegroundColor DarkGray
    }
    else {
        Write-Host "`n⏳ " -NoNewline -ForegroundColor Yellow
        Write-Host "NO TASKS AVAILABLE" -ForegroundColor Yellow
        Write-Host "`nAll available tasks are blocked by dependencies."
        Write-Host "Complete one of the following to unblock more tasks:`n"
        
        # Find tasks that would unblock the most
        $depCounts = @{}
        foreach ($blocked in $blockedTasks) {
            foreach ($dep in $blocked.MissingDeps) {
                if (-not $depCounts.ContainsKey($dep)) {
                    $depCounts[$dep] = 0
                }
                $depCounts[$dep]++
            }
        }
        
        $topBlockers = $depCounts.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 5
        foreach ($blocker in $topBlockers) {
            $blockerTask = $allTasks | Where-Object { $_.TaskId -eq $blocker.Key }
            Write-Host "  • " -NoNewline -ForegroundColor Red
            Write-Host "$($blocker.Key) " -NoNewline -ForegroundColor White
            Write-Host "- blocks $($blocker.Value) task(s)" -ForegroundColor DarkGray
            Write-Host "    $($blockerTask.Summary)" -ForegroundColor Gray
        }
        
        # Write blocked status to file
        $totalTasks = $allTasks.Count
        $completedCount = $allCompletedTasks.Count
        $progressPercent = [math]::Round(($completedCount / $totalTasks) * 100, 1)
        
        $blockedData = @{
            timestamp = (Get-Date -Format "o")
            status = "NO_TASKS_AVAILABLE"
            completed_tasks = $allCompletedTasks
            total_tasks = $totalTasks
            completed_count = $completedCount
            progress_percent = $progressPercent
            available_tasks = @()
            can_run_in_parallel = @()
            blocked_tasks = $blockedTasks | ForEach-Object {
                @{
                    TaskId = $_.TaskId
                    Summary = $_.Summary
                    MissingDeps = $_.MissingDeps
                    Wave = $_.Wave
                }
            }
            top_blockers = $topBlockers | ForEach-Object {
                @{
                    TaskId = $_.Key
                    BlocksCount = $_.Value
                }
            }
        }
        $blockedData | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding utf8
        Write-Host "`n📁 Status written to: $outputFile`n" -ForegroundColor DarkGray
    }
}
else {
    Write-Host "\n🎯 " -NoNewline -ForegroundColor Green
    Write-Host "AVAILABLE TASKS ($($availableTasks.Count) ready to start)" -ForegroundColor Cyan
    Write-Host ""
    
    # Calculate progress (needed for all output formats and file writing)
    $totalTasks = $allTasks.Count
    $completedCount = $allCompletedTasks.Count
    $progressPercent = [math]::Round(($completedCount / $totalTasks) * 100, 1)
    
    # Calculate parallelizable tasks (needed for all output formats and file writing)
    $canRunInParallel = @()
    foreach ($task in $availableTasks) {
        $hasConflict = $false
        foreach ($other in $availableTasks) {
            if ($task.TaskId -ne $other.TaskId -and 
                ($task.ConflictsWith -contains $other.TaskId)) {
                $hasConflict = $true
                break
            }
        }
        if (-not $hasConflict) {
            $canRunInParallel += $task.TaskId
        }
    }
    
    if ($Format -eq "Json") {
        $output = @{
            timestamp = (Get-Date -Format "o")
            completed_tasks = $allCompletedTasks
            available_tasks = $availableTasks
            total_tasks = $totalTasks
            completed_count = $completedCount
            progress_percent = $progressPercent
            can_run_in_parallel = $canRunInParallel
        }
        
        $output | ConvertTo-Json -Depth 10
    }
    elseif ($Format -eq "List") {
        foreach ($task in ($availableTasks | Sort-Object Wave, RuntimeMin)) {
            Write-Host "📋 " -NoNewline -ForegroundColor Yellow
            Write-Host "$($task.TaskId)" -ForegroundColor White -NoNewline
            Write-Host " ⏱️  $($task.RuntimeMin) min" -ForegroundColor DarkGray -NoNewline
            Write-Host " 🌊 Wave $($task.Wave)" -ForegroundColor DarkCyan
            Write-Host "   $($task.Summary)" -ForegroundColor Gray
            
            if ($task.ConflictsWith.Count -gt 0) {
                $conflictingAvailable = $task.ConflictsWith | Where-Object { 
                    $availableTasks.TaskId -contains $_ 
                }
                if ($conflictingAvailable.Count -gt 0) {
                    Write-Host "   ⚠️  Conflicts with: " -NoNewline -ForegroundColor Yellow
                    Write-Host ($conflictingAvailable -join ", ") -ForegroundColor DarkYellow
                }
            }
            
            Write-Host "   📁 Files: $($task.Files.Count) file pattern(s)" -ForegroundColor DarkGray
            Write-Host ""
        }
    }
    else {
        $availableTasks | 
            Sort-Object Wave, RuntimeMin |
            Select-Object @{N='Task';E={$_.TaskId}}, 
                          @{N='Time';E={"$($_.RuntimeMin)m"}}, 
                          @{N='Wave';E={$_.Wave}},
                          @{N='Conflicts';E={$_.ConflictsWith.Count}},
                          Summary | 
            Format-Table -AutoSize
    }
    
    # Show parallelization hints
    if ($canRunInParallel.Count -gt 1) {
        Write-Host "💡 " -NoNewline -ForegroundColor Yellow
        Write-Host "PARALLELIZATION TIP:" -ForegroundColor Yellow
        Write-Host "   These $($canRunInParallel.Count) tasks have no conflicts and can run simultaneously:"
        Write-Host "   $($canRunInParallel -join ', ')" -ForegroundColor Green
        Write-Host ""
    }
    
    # Show priority recommendations
    $priorityTasks = $availableTasks | Sort-Object RuntimeMin -Descending | Select-Object -First 3
    if ($priorityTasks.Count -gt 0) {
        Write-Host "🔥 " -NoNewline -ForegroundColor Red
        Write-Host "RECOMMENDED PRIORITY:" -ForegroundColor Yellow
        Write-Host "   Start with longer tasks to maximize parallel efficiency:"
        foreach ($task in $priorityTasks) {
            Write-Host "   • $($task.TaskId) " -NoNewline -ForegroundColor White
            Write-Host "($($task.RuntimeMin) min)" -ForegroundColor DarkGray
        }
        Write-Host ""
    }
    
    # Write detailed output to file for agent reference
    $outputData = @{
        timestamp = (Get-Date -Format "o")
        completed_tasks = $allCompletedTasks
        available_tasks = $availableTasks | ForEach-Object {
            @{
                TaskId = $_.TaskId
                Summary = $_.Summary
                Description = $_.Description
                RuntimeMin = $_.RuntimeMin
                Wave = $_.Wave
                ConflictsWith = $_.ConflictsWith
                Files = $_.Files
            }
        }
        total_tasks = $totalTasks
        completed_count = $completedCount
        progress_percent = $progressPercent
        can_run_in_parallel = $canRunInParallel
        blocked_tasks = $blockedTasks | ForEach-Object {
            @{
                TaskId = $_.TaskId
                Summary = $_.Summary
                MissingDeps = $_.MissingDeps
                Wave = $_.Wave
            }
        }
    }
    
    $outputData | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding utf8
    Write-Host "📁 Next tasks written to: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$outputFile" -ForegroundColor Cyan
    Write-Host ""
}

# Show blocked tasks if requested
if ($ShowAll -and $blockedTasks.Count -gt 0) {
    Write-Host "`n🔒 " -NoNewline -ForegroundColor DarkYellow
    Write-Host "BLOCKED TASKS ($($blockedTasks.Count) waiting on dependencies)" -ForegroundColor DarkYellow
    Write-Host ""
    
    foreach ($blocked in ($blockedTasks | Sort-Object Wave)) {
        Write-Host "   $($blocked.TaskId) " -NoNewline -ForegroundColor DarkGray
        Write-Host "- waiting for: " -NoNewline -ForegroundColor DarkGray
        Write-Host ($blocked.MissingDeps -join ", ") -ForegroundColor DarkRed
    }
    Write-Host ""
}

# Show progress
$totalTasks = $allTasks.Count
$completedCount = $allCompletedTasks.Count
$progressPercent = [math]::Round(($completedCount / $totalTasks) * 100, 1)

Write-Host "📊 " -NoNewline -ForegroundColor Cyan
Write-Host "PROGRESS: " -NoNewline -ForegroundColor Cyan
Write-Host "$completedCount / $totalTasks tasks completed " -NoNewline -ForegroundColor White
Write-Host "($progressPercent%)" -ForegroundColor Green

# Progress bar
$barWidth = 50
$filledWidth = [math]::Floor($barWidth * $completedCount / $totalTasks)
$emptyWidth = $barWidth - $filledWidth
$progressBar = "   [" + ("█" * $filledWidth) + ("░" * $emptyWidth) + "]"
Write-Host $progressBar -ForegroundColor Green

Write-Host ""
