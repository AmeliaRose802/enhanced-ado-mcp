# Parallel Execution Plan Validation

## Overview

The `Validate-ParallelExecutionPlan.ps1` script validates that the parallel execution plan meets critical scheduling requirements for task parallelization.

## Purpose

This script ensures that the task scheduling plan is:
1. **Conflict-Free**: Tasks modifying the same files are in different waves
2. **Dependency-Correct**: Tasks are scheduled after their dependencies
3. **Maximally Parallelized**: No unnecessary serialization of independent tasks

## Usage

### Basic Usage

```powershell
cd dev\dev_scripts
.\Validate-ParallelExecutionPlan.ps1
```

### Verbose Mode

For detailed validation output:

```powershell
.\Validate-ParallelExecutionPlan.ps1 -Verbose
```

### Custom Paths

If your artifacts are in non-standard locations:

```powershell
.\Validate-ParallelExecutionPlan.ps1 `
    -PlanPath "path\to\parallel_execution_plan.json" `
    -DependencyPath "path\to\dependency_graph.json" `
    -ConflictPath "path\to\conflict_graph.json" `
    -FilesPath "path\to\files_list.json"
```

## Validation Rules

### 1. File Conflict Detection

**Rule**: Tasks that modify the same files MUST be in different waves.

**Why**: Running conflicting tasks in parallel would cause merge conflicts and race conditions.

**Example Issue**:
```
✗ Wave 2: T2a and T5 have file conflicts
```

**Resolution**: Move one of the conflicting tasks to a later wave.

### 2. Dependency Ordering

**Rule**: If Task B depends on Task A, then Task B must be in a later wave than Task A.

**Why**: Dependencies must complete before dependent tasks can start.

**Example Issue**:
```
✗ T18 (Wave 8) depends on T17a (Wave 8) - INVALID
```

**Resolution**: Move T18 to Wave 9 or later, after T17a completes.

### 3. Maximal Parallelization

**Rule**: Tasks should be scheduled in the earliest possible wave that doesn't violate conflict or dependency rules.

**Why**: Earlier scheduling reduces total execution time.

**Example Issue**:
```
✗ T13 in Wave 6 could be in Wave 5
```

**Resolution**: Move T13 to Wave 5 if no conflicts or dependencies prevent it.

**Note**: The validator allows intentional delayed scheduling for load balancing. If moving a task to an earlier wave would create significant imbalance (earlier wave has more tasks), the validator won't flag it as an issue.

## Exit Codes

- `0`: All validations passed
- `1`: Validation failures detected
- `1`: Script execution error

## Output Format

### Success Output

```
✅ ALL VALIDATIONS PASSED

The parallel execution plan is valid and correctly optimized!

📊 Plan Statistics:
  Total Tasks: 26
  Total Waves: 9
  Sequential Time: 693 minutes
  Parallel Time: 116 minutes
  Speedup Factor: 5.97x
  Time Saved: 577 minutes
  Average Parallelism: 2.89
```

### Failure Output

```
❌ VALIDATION FAILED

Total Issues Found: 7
  File Conflicts: 3
  Dependency Violations: 3
  Parallelization Opportunities: 1

Please review and fix the issues above before proceeding.
```

## Integration with CI/CD

You can integrate this validation into your workflow:

```powershell
# Run validation as part of plan generation
.\Generate-ParallelExecutionPlan.ps1
$validationResult = .\Validate-ParallelExecutionPlan.ps1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Plan validated successfully"
    # Proceed with execution
} else {
    Write-Error "✗ Plan validation failed"
    exit 1
}
```

## Validation Logic Details

### File Overlap Detection

The script uses glob pattern matching to detect file overlaps:
- Exact path matches: `mcp_server/src/index.ts`
- Glob patterns: `mcp_server/src/**/*.ts` matches all TypeScript files in src
- Directory prefixes: Tasks modifying `src/services/**` and `src/services/handlers/**` are detected as overlapping

### Dependency Chain Resolution

The validator traces the full dependency chain, including transitive dependencies:
- If Task C depends on Task B, and Task B depends on Task A
- Then Task C has an implicit dependency on Task A
- Task C must be scheduled after both Task A and Task B

### Enabler Task Detection

The validator recognizes "enabler" tasks (T1, T4) that provide productivity benefits:
- Tasks that benefit from enablers should be scheduled after them
- Even if there's no explicit dependency, the validator considers enabler scheduling
- This ensures tasks receive the full benefit of infrastructure improvements

## Troubleshooting

### Issue: "Task not found in execution plan"

**Cause**: A task referenced in dependencies/conflicts doesn't exist in the plan.

**Fix**: Ensure all tasks are included in the parallel execution plan, or remove references to obsolete tasks.

### Issue: "Wave X tasks have file conflicts"

**Cause**: Multiple tasks in the same wave modify overlapping files.

**Fix**: Move one of the conflicting tasks to a different wave, respecting dependency ordering.

### Issue: "Dependency ordering violation"

**Cause**: A task is scheduled in the same wave or before its dependency.

**Fix**: Move the dependent task to a later wave.

## Related Files

- `tasklist/plan/parallel_execution_plan.json` - The execution plan being validated
- `tasklist/plan/dependency_graph.json` - Task dependency definitions
- `tasklist/plan/conflict_graph.json` - File conflict definitions
- `tasklist/plan/files_list.json` - File modification details per task

## Development

### Adding New Validation Rules

To add a new validation rule:

1. Add a new validation section after the existing three sections
2. Follow the pattern: header, loop through tasks, detect issues, report results
3. Add issue count to `$totalIssues`
4. Set `$allTestsPassed = $false` if issues found

Example:

```powershell
#region Validation 4: Your New Rule

Write-ValidationHeader "Validation 4: Your New Rule"
Write-Host "Ensuring your rule is met...`n"

$yourRuleIssues = @()

# Your validation logic here

if ($yourRuleIssues.Count -eq 0) {
    Write-ValidationResult -Message "Your rule is satisfied" -Success $true
} else {
    Write-ValidationResult -Message "Found issues" -Success $false
    $allTestsPassed = $false
    $totalIssues += $yourRuleIssues.Count
}

#endregion
```

## Version History

- **v1.0.0** (2025-10-07): Initial release with three core validation rules
