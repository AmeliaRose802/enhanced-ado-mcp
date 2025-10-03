# Quick Reference: wit-validate-hierarchy-fast

## Tool Purpose
Fast, rule-based validation of Azure DevOps work item hierarchies without AI processing.

## When to Use This Tool
- ✅ Quick hierarchy health checks
- ✅ Pre-deployment validation
- ✅ Regular backlog maintenance (weekly/sprint)
- ✅ After bulk work item operations
- ✅ When you need minimal context usage
- ✅ Validate parent-child type relationships
- ✅ Check state consistency between parents and children

## Quick Start

### Validate an Area Path
```json
{
  "AreaPath": "MyProject\\MyTeam"
}
```

### Validate Specific Items
```json
{
  "WorkItemIds": [12345, 23456, 34567]
}
```

### Check Only Type Relationships
```json
{
  "AreaPath": "MyProject\\Area",
  "ValidateTypes": true,
  "ValidateStates": false
}
```

### Check Only State Consistency
```json
{
  "AreaPath": "MyProject\\Area",
  "ValidateTypes": false,
  "ValidateStates": true
}
```

## Valid Hierarchy Rules

```
Key Result
  └─ Epic
      └─ Feature
          └─ Product Backlog Item / User Story
              └─ Task / Bug
```

## Common Violations

### 🔴 Error: Invalid Parent Type
**Example:** Task → Epic (skips Feature and PBI/Story)  
**Fix:** Re-parent to correct type

### ⚠️ Warning: Invalid State Progression
**Example:** Parent "New", Child "Active"  
**Fix:** Update parent to "Active" or adjust child

**Example:** Parent "Done", Children "Active"  
**Fix:** Complete children before marking parent done

### ⚠️ Warning: Orphaned Child
**Example:** Feature with no parent  
**Fix:** Link to Epic or Key Result

## Response Quick Look

```json
{
  "summary": {
    "totalViolations": 5,
    "errors": 2,
    "warnings": 3
  },
  "violations": [
    {
      "workItemId": 12345,
      "issue": "Task cannot be a child of Epic",
      "expectedCorrection": "Valid children for Epic: Feature",
      "severity": "error"
    }
  ]
}
```

## Performance Notes

- ⚡ Very fast: No AI processing
- 📊 Scalable: Handles 500+ items
- 🎯 Focused: Returns only violations
- 🔄 Batch-friendly: Fetches parents in batches

## Integration Examples

### Find violations, then fix states
```bash
# 1. Find violations
wit-validate-hierarchy-fast { "AreaPath": "Project\\Area" }

# 2. Fix state violations in bulk
wit-bulk-state-transition { "WorkItemIds": [...], "NewState": "Active" }
```

### Validate before closing parent
```bash
# Check if children are done before closing parent
wit-validate-hierarchy-fast { 
  "WorkItemIds": [parentId, ...childIds],
  "ValidateStates": true 
}
```

## Common Patterns

### Weekly Backlog Health Check
```json
{
  "AreaPath": "MyProject\\MyTeam",
  "IncludeSubAreas": true,
  "MaxResults": 500
}
```

### Pre-Sprint Planning
```json
{
  "AreaPath": "MyProject\\NextSprint",
  "ValidateTypes": true,
  "ValidateStates": true
}
```

### After Bulk Import
```json
{
  "AreaPath": "MyProject\\ImportedItems",
  "ValidateTypes": true,
  "ValidateStates": false
}
```

## Troubleshooting

### "Parent work item not found"
- Parent may be Removed or Closed
- Tool excludes these to avoid false orphan detection
- Check parent state manually

### "Unknown state"
- Custom states are skipped in state validation
- No error - just not validated
- Validation continues for known states

### Too many results
- Use `MaxResults` parameter to limit
- Process in batches by area path
- Filter by work item type if needed

## See Also

- Full documentation: `docs/HIERARCHY_VALIDATION_TOOL.md`
- Implementation details: `docs/HIERARCHY_VALIDATION_IMPLEMENTATION.md`
- Hierarchical cleanup prompt: `prompts/backlog_cleanup-by-hierarchy.md`
