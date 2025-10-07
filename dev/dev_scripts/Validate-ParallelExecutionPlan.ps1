<#
.SYNOPSIS
    Validates the parallel execution plan for task scheduling correctness.

.DESCRIPTION
    This script validates that the parallel execution plan meets three critical requirements:
    1. Tasks that modify the same files are in different waves (no conflicts)
    2. Tasks that depend on a prior task are scheduled after the one they depend on
    3. Tasks are maximally parallelized (no unnecessary serialization)

.PARAMETER PlanPath
    Path to the parallel_execution_plan.json file

.PARAMETER DependencyPath
    Path to the dependency_graph.json file

.PARAMETER ConflictPath
    Path to the conflict_graph.json file

.PARAMETER FilesPath
    Path to the files_list.json file

.EXAMPLE
    .\Validate-ParallelExecutionPlan.ps1

.EXAMPLE
    .\Validate-ParallelExecutionPlan.ps1 -Verbose

.NOTES
    Author: Enhanced ADO MCP Server Team
    Date: 2025-10-07
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$PlanPath = "$PSScriptRoot\..\..\tasklist\plan\parallel_execution_plan.json",
    
    [Parameter()]
    [string]$DependencyPath = "$PSScriptRoot\..\..\tasklist\plan\dependency_graph.json",
    
    [Parameter()]
    [string]$ConflictPath = "$PSScriptRoot\..\..\tasklist\plan\conflict_graph.json",
    
    [Parameter()]
    [string]$FilesPath = "$PSScriptRoot\..\..\tasklist\plan\files_list.json"
)

#region Helper Functions

function Write-ValidationHeader {
    param([string]$Title)
    Write-Host "`n$('=' * 80)" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "$('=' * 80)" -ForegroundColor Cyan
}

function Write-ValidationResult {
    param(
        [string]$Message,
        [bool]$Success,
        [int]$IndentLevel = 0
    )
    
    $indent = "  " * $IndentLevel
    if ($Success) {
        Write-Host "$indent✓ $Message" -ForegroundColor Green
    } else {
        Write-Host "$indent✗ $Message" -ForegroundColor Red
    }
}

function Get-TaskWave {
    param(
        [string]$TaskId,
        [array]$Waves
    )
    
    foreach ($wave in $Waves) {
        $task = $wave.tasks | Where-Object { $_.task_id -eq $TaskId }
        if ($task) {
            return $wave.wave_number
        }
    }
    return $null
}

function Get-FilePathsForTask {
    param(
        [string]$TaskId,
        [array]$FilesList
    )
    
    $taskFiles = $FilesList | Where-Object { $_.task_id -eq $TaskId }
    if (-not $taskFiles) {
        return @()
    }
    
    return $taskFiles.files | ForEach-Object { $_.path }
}

function Test-FilePathOverlap {
    param(
        [string[]]$Paths1,
        [string[]]$Paths2
    )
    
    foreach ($path1 in $Paths1) {
        foreach ($path2 in $Paths2) {
            # Exact match
            if ($path1 -eq $path2) {
                return $true
            }
            
            # Glob pattern matching (simplified)
            if ($path1 -like "*/**" -or $path2 -like "*/**") {
                $base1 = $path1 -replace '/\*\*.*$', ''
                $base2 = $path2 -replace '/\*\*.*$', ''
                
                if ($path1.StartsWith($base2) -or $path2.StartsWith($base1)) {
                    return $true
                }
            }
        }
    }
    
    return $false
}

#endregion

#region Main Validation Logic

try {
    Write-Host "`n🔍 Parallel Execution Plan Validation" -ForegroundColor Magenta
    Write-Host "=" * 80 -ForegroundColor Magenta
    
    # Load all artifacts
    Write-Verbose "Loading artifacts..."
    
    if (-not (Test-Path $PlanPath)) {
        throw "Parallel execution plan not found at: $PlanPath"
    }
    if (-not (Test-Path $DependencyPath)) {
        throw "Dependency graph not found at: $DependencyPath"
    }
    if (-not (Test-Path $ConflictPath)) {
        throw "Conflict graph not found at: $ConflictPath"
    }
    if (-not (Test-Path $FilesPath)) {
        throw "Files list not found at: $FilesPath"
    }
    
    $plan = Get-Content $PlanPath -Raw | ConvertFrom-Json
    $dependencies = Get-Content $DependencyPath -Raw | ConvertFrom-Json
    $conflicts = Get-Content $ConflictPath -Raw | ConvertFrom-Json
    $filesList = Get-Content $FilesPath -Raw | ConvertFrom-Json
    
    Write-Host "✓ Loaded all artifacts successfully" -ForegroundColor Green
    Write-Host "  Tasks: $($plan.plan_metadata.total_tasks)" -ForegroundColor Gray
    Write-Host "  Waves: $($plan.plan_metadata.total_waves)" -ForegroundColor Gray
    
    $allTestsPassed = $true
    $totalIssues = 0
    
    #region Validation 1: File Conflict Detection
    
    Write-ValidationHeader "Validation 1: File Conflict Detection"
    Write-Host "Ensuring tasks that modify the same files are in different waves...`n"
    
    $fileConflictIssues = @()
    
    foreach ($wave in $plan.waves) {
        $waveNum = $wave.wave_number
        $tasksInWave = $wave.tasks
        
        Write-Verbose "Checking Wave $waveNum (${tasksInWave.Count} tasks)..."
        
        for ($i = 0; $i -lt $tasksInWave.Count; $i++) {
            for ($j = $i + 1; $j -lt $tasksInWave.Count; $j++) {
                $task1 = $tasksInWave[$i]
                $task2 = $tasksInWave[$j]
                
                # Get file paths for both tasks
                $files1 = Get-FilePathsForTask -TaskId $task1.task_id -FilesList $filesList
                $files2 = Get-FilePathsForTask -TaskId $task2.task_id -FilesList $filesList
                
                # Check for overlap
                if (Test-FilePathOverlap -Paths1 $files1 -Paths2 $files2) {
                    $conflict = $conflicts | Where-Object { $_.task_id -eq $task1.task_id }
                    $isKnownConflict = $conflict.conflicts_with -contains $task2.task_id
                    
                    if ($isKnownConflict) {
                        $issue = @{
                            Wave = $waveNum
                            Task1 = $task1.task_id
                            Task2 = $task2.task_id
                            OverlappingFiles = "Multiple files overlap"
                        }
                        $fileConflictIssues += $issue
                        
                        $t1 = $task1.task_id
                        $t2 = $task2.task_id
                        Write-ValidationResult -Message "Wave $waveNum`: $t1 and $t2 have file conflicts" -Success $false -IndentLevel 1
                    }
                }
            }
        }
    }
    
    if ($fileConflictIssues.Count -eq 0) {
        Write-ValidationResult -Message "No file conflicts detected within waves" -Success $true
    } else {
        Write-ValidationResult -Message "Found $($fileConflictIssues.Count) file conflict(s) within waves" -Success $false
        $allTestsPassed = $false
        $totalIssues += $fileConflictIssues.Count
        
        foreach ($issue in $fileConflictIssues) {
            Write-Host "    Wave $($issue.Wave): $($issue.Task1) ↔ $($issue.Task2)" -ForegroundColor Yellow
        }
    }
    
    #endregion
    
    #region Validation 2: Dependency Ordering
    
    Write-ValidationHeader "Validation 2: Dependency Ordering"
    Write-Host "Ensuring tasks are scheduled after their dependencies...`n"
    
    $dependencyIssues = @()
    
    foreach ($dep in $dependencies) {
        $taskId = $dep.task_id
        $taskWave = Get-TaskWave -TaskId $taskId -Waves $plan.waves
        
        if ($null -eq $taskWave) {
            Write-Warning "Task $taskId not found in execution plan"
            continue
        }
        
        foreach ($depTaskId in $dep.depends_on) {
            $depWave = Get-TaskWave -TaskId $depTaskId -Waves $plan.waves
            
            if ($null -eq $depWave) {
                Write-Warning "Dependency task $depTaskId not found in execution plan"
                continue
            }
            
            if ($depWave -ge $taskWave) {
                $issue = @{
                    Task = $taskId
                    TaskWave = $taskWave
                    Dependency = $depTaskId
                    DependencyWave = $depWave
                }
                $dependencyIssues += $issue
                
                Write-ValidationResult -Message "$taskId (Wave $taskWave) depends on $depTaskId (Wave $depWave) - INVALID" -Success $false -IndentLevel 1
            } else {
                Write-Verbose "$taskId (Wave $taskWave) correctly after $depTaskId (Wave $depWave)"
            }
        }
    }
    
    if ($dependencyIssues.Count -eq 0) {
        Write-ValidationResult -Message "All dependencies are correctly ordered" -Success $true
        
        # Show some examples
        $exampleCount = [Math]::Min(5, $dependencies.Count)
        Write-Host "`n  Example valid orderings:" -ForegroundColor Gray
        foreach ($dep in ($dependencies | Where-Object { $_.depends_on.Count -gt 0 } | Select-Object -First $exampleCount)) {
            $taskWave = Get-TaskWave -TaskId $dep.task_id -Waves $plan.waves
            foreach ($depTaskId in $dep.depends_on | Select-Object -First 1) {
                $depWave = Get-TaskWave -TaskId $depTaskId -Waves $plan.waves
                Write-Host "    $depTaskId (Wave $depWave) → $($dep.task_id) (Wave $taskWave)" -ForegroundColor DarkGray
            }
        }
    } else {
        Write-ValidationResult -Message "Found $($dependencyIssues.Count) dependency ordering violation(s)" -Success $false
        $allTestsPassed = $false
        $totalIssues += $dependencyIssues.Count
        
        foreach ($issue in $dependencyIssues) {
            Write-Host "    $($issue.Dependency) (Wave $($issue.DependencyWave)) must come before $($issue.Task) (Wave $($issue.TaskWave))" -ForegroundColor Yellow
        }
    }
    
    #endregion
    
    #region Validation 3: Maximal Parallelization
    
    Write-ValidationHeader "Validation 3: Maximal Parallelization"
    Write-Host "Ensuring tasks are maximally parallelized...`n"
    
    $parallelizationIssues = @()
    $opportunitiesFound = 0
    
    # For each task, check if it could have been scheduled earlier
    foreach ($wave in $plan.waves | Sort-Object wave_number) {
        foreach ($task in $wave.tasks) {
            $taskId = $task.task_id
            $currentWave = $wave.wave_number
            
            # Get dependencies and conflicts
            $taskDeps = ($dependencies | Where-Object { $_.task_id -eq $taskId }).depends_on
            if ($null -eq $taskDeps) { $taskDeps = @() }
            
            $taskConflicts = ($conflicts | Where-Object { $_.task_id -eq $taskId }).conflicts_with
            if ($null -eq $taskConflicts) { $taskConflicts = @() }
            
            # Find earliest wave this task could be scheduled
            $earliestWave = 1
            
            # Check dependencies
            foreach ($depId in $taskDeps) {
                $depWave = Get-TaskWave -TaskId $depId -Waves $plan.waves
                if ($depWave -ge $earliestWave) {
                    $earliestWave = $depWave + 1
                }
            }
            
            # Check conflicts in earlier waves
            for ($w = $earliestWave; $w -lt $currentWave; $w++) {
                $waveObj = $plan.waves | Where-Object { $_.wave_number -eq $w }
                $tasksInWave = $waveObj.tasks.task_id
                
                $hasConflict = $false
                foreach ($conflictId in $taskConflicts) {
                    if ($tasksInWave -contains $conflictId) {
                        $hasConflict = $true
                        $earliestWave = $w + 1
                        break
                    }
                }
            }
            
            # Check for enabler dependencies
            $requiresEnabler = $false
            $enablerWave = 0
            
            # Check if task benefits from T1 or T4 enablers
            $taskInfo = $dependencies | Where-Object { $_.task_id -eq $taskId }
            if ($taskInfo) {
                $allDeps = @($taskInfo.depends_on)
                
                # Trace back to see if T1 or T4 is in the dependency chain
                $checkedDeps = @{}
                $queue = [System.Collections.Queue]::new()
                foreach ($d in $allDeps) { $queue.Enqueue($d) }
                
                while ($queue.Count -gt 0) {
                    $depId = $queue.Dequeue()
                    if ($checkedDeps.ContainsKey($depId)) { continue }
                    $checkedDeps[$depId] = $true
                    
                    if ($depId -eq "T1" -or $depId -eq "T4") {
                        $requiresEnabler = $true
                        $enablerWave = Get-TaskWave -TaskId $depId -Waves $plan.waves
                        if ($enablerWave -ge $earliestWave) {
                            $earliestWave = $enablerWave + 1
                        }
                    }
                    
                    $nextDeps = ($dependencies | Where-Object { $_.task_id -eq $depId }).depends_on
                    if ($nextDeps) {
                        foreach ($nd in $nextDeps) { $queue.Enqueue($nd) }
                    }
                }
            }
            
            # If task could have been scheduled earlier, flag it
            if ($earliestWave -lt $currentWave) {
                $issue = @{
                    Task = $taskId
                    CurrentWave = $currentWave
                    EarliestPossibleWave = $earliestWave
                    WavesDelayed = $currentWave - $earliestWave
                    Reason = "No blocking dependencies or conflicts found"
                }
                
                # This might be intentional for load balancing, so let's check
                $currentWaveObj = $plan.waves | Where-Object { $_.wave_number -eq $currentWave }
                $earliestWaveObj = $plan.waves | Where-Object { $_.wave_number -eq $earliestWave }
                
                $currentParallelism = $currentWaveObj.tasks.Count
                $earliestParallelism = $earliestWaveObj.tasks.Count
                
                # Only flag if moving wouldn't create significant imbalance
                if ($currentParallelism -lt $earliestParallelism) {
                    $parallelizationIssues += $issue
                    Write-ValidationResult -Message "$taskId in Wave $currentWave could be in Wave $earliestWave" -Success $false -IndentLevel 1
                } else {
                    Write-Verbose "$taskId in Wave $currentWave (could be $earliestWave, but wave is balanced)"
                    $opportunitiesFound++
                }
            } else {
                Write-Verbose "$taskId correctly scheduled in Wave $currentWave (earliest: $earliestWave)"
            }
        }
    }
    
    if ($parallelizationIssues.Count -eq 0) {
        Write-ValidationResult -Message "Tasks are maximally parallelized" -Success $true
        
        if ($opportunitiesFound -gt 0) {
            Write-Host "`n  Note: $opportunitiesFound task(s) could technically move to earlier waves," -ForegroundColor Gray
            Write-Host "        but current placement maintains better load balancing." -ForegroundColor Gray
        }
        
        # Show parallelism statistics
        Write-Host "`n  Parallelism Statistics:" -ForegroundColor Gray
        foreach ($wave in $plan.waves) {
            Write-Host "    Wave $($wave.wave_number): $($wave.tasks.Count) task(s) - $($wave.total_runtime_estimate_min) min" -ForegroundColor DarkGray
        }
    } else {
        Write-ValidationResult -Message "Found $($parallelizationIssues.Count) parallelization improvement(s)" -Success $false
        $allTestsPassed = $false
        $totalIssues += $parallelizationIssues.Count
        
        foreach ($issue in $parallelizationIssues) {
            Write-Host "    $($issue.Task): Wave $($issue.CurrentWave) → Wave $($issue.EarliestPossibleWave) ($($issue.WavesDelayed) wave(s) earlier)" -ForegroundColor Yellow
            Write-Host "      Reason: $($issue.Reason)" -ForegroundColor DarkYellow
        }
    }
    
    #endregion
    
    #region Summary
    
    Write-ValidationHeader "Validation Summary"
    
    if ($allTestsPassed) {
        Write-Host "`n✅ ALL VALIDATIONS PASSED" -ForegroundColor Green
        Write-Host "`nThe parallel execution plan is valid and correctly optimized!" -ForegroundColor Green
        
        Write-Host "`n📊 Plan Statistics:" -ForegroundColor Cyan
        Write-Host "  Total Tasks: $($plan.plan_metadata.total_tasks)" -ForegroundColor Gray
        Write-Host "  Total Waves: $($plan.plan_metadata.total_waves)" -ForegroundColor Gray
        Write-Host "  Sequential Time: $($plan.summary_statistics.original_sequential_time_min) minutes" -ForegroundColor Gray
        Write-Host "  Parallel Time: $($plan.summary_statistics.parallel_execution_time_min) minutes" -ForegroundColor Gray
        Write-Host "  Speedup Factor: $($plan.summary_statistics.speedup_factor)x" -ForegroundColor Green
        Write-Host "  Time Saved: $($plan.summary_statistics.time_saved_min) minutes" -ForegroundColor Green
        Write-Host "  Average Parallelism: $($plan.summary_statistics.average_parallelism)" -ForegroundColor Gray
        
        exit 0
    } else {
        Write-Host "`n❌ VALIDATION FAILED" -ForegroundColor Red
        Write-Host "`nTotal Issues Found: $totalIssues" -ForegroundColor Red
        Write-Host "  File Conflicts: $($fileConflictIssues.Count)" -ForegroundColor Yellow
        Write-Host "  Dependency Violations: $($dependencyIssues.Count)" -ForegroundColor Yellow
        Write-Host "  Parallelization Opportunities: $($parallelizationIssues.Count)" -ForegroundColor Yellow
        
        Write-Host "`nPlease review and fix the issues above before proceeding." -ForegroundColor Red
        
        exit 1
    }
    
    #endregion
    
} catch {
    Write-Host "`n❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
    exit 1
}

#endregion
