# Hierarchy Validation Tool

## Overview

The `wit-validate-hierarchy-fast` tool provides fast, rule-based validation of Azure DevOps work item hierarchies. It checks parent-child type relationships and state consistency without using AI, making it extremely efficient for large backlogs.

## Tool Name

`wit-validate-hierarchy-fast`

## Purpose

- **Fast validation** of work item parent-child type relationships
- **State consistency checking** between parents and children
- **Orphaned item detection** for items missing proper parent links
- **Minimal context usage** - returns focused, actionable results

## Key Features

### 1. Parent-Child Type Validation

Enforces Azure DevOps standard hierarchy rules:

```
Key Result → Epic
Epic → Feature
Feature → Product Backlog Item / User Story
Product Backlog Item → Task / Bug
User Story → Task / Bug
```

**Invalid relationships detected:**
- Epic → Task (skips Feature level)
- Feature → Task (skips PBI/Story level)
- Task/Bug → Any child (leaf nodes cannot have children)

### 2. State Progression Validation

Checks that parent and child states are consistent:

**State Hierarchy Levels:**
- **Level 1 (Initial):** New, Proposed, To Do
- **Level 2 (Active):** Active, Committed, In Progress, Doing
- **Level 3 (Resolved):** Resolved
- **Level 4 (Done):** Done, Completed, Closed
- **Level 5 (Removed):** Removed

**Rules:**
- Parent cannot be in "New" state if child is "Active" or beyond
- Parent cannot be "Done" if any children are still in "Active" or earlier states
- Parent can be "Active" with children in "Active" or "Done" states

### 3. Orphaned Item Detection

Identifies items that should have parent links but don't:

**Should have parents:**
- Features (should link to Epic or Key Result)
- Product Backlog Items (should link to Feature)
- User Stories (should link to Feature)
- Tasks (should link to PBI or User Story)
- Bugs (should link to PBI or User Story)

**Can be top-level:**
- Key Results (strategic items)
- Epics (can be top-level or under Key Result)

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `WorkItemIds` | number[] | No* | - | Specific work item IDs to validate |
| `AreaPath` | string | No* | - | Area path to validate all work items within |
| `Organization` | string | No | (from config) | Azure DevOps organization name |
| `Project` | string | No | (from config) | Azure DevOps project name |
| `MaxResults` | number | No | 500 | Maximum items when using AreaPath |
| `IncludeSubAreas` | boolean | No | true | Include child area paths |
| `ValidateTypes` | boolean | No | true | Validate parent-child type relationships |
| `ValidateStates` | boolean | No | true | Validate state consistency |

*Either `WorkItemIds` or `AreaPath` must be provided.

## Response Format

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalItemsAnalyzed": 150,
      "totalViolations": 12,
      "errors": 5,
      "warnings": 7,
      "byViolationType": {
        "invalid_parent_type": 5,
        "invalid_state_progression": 4,
        "orphaned_child": 3
      }
    },
    "violations": [
      {
        "workItemId": 12345,
        "title": "Implement authentication",
        "type": "Task",
        "state": "Active",
        "parentId": 11111,
        "parentTitle": "User Management Epic",
        "parentType": "Epic",
        "parentState": "New",
        "violationType": "invalid_parent_type",
        "severity": "error",
        "issue": "Task cannot be a child of Epic",
        "expectedCorrection": "Valid children for Epic: Feature"
      },
      {
        "workItemId": 23456,
        "title": "User Registration Feature",
        "type": "Feature",
        "state": "Active",
        "parentId": 22222,
        "parentTitle": "Authentication Epic",
        "parentType": "Epic",
        "parentState": "New",
        "violationType": "invalid_state_progression",
        "severity": "warning",
        "issue": "Parent is in 'New' but child is in 'Active'. Parent should be at least 'Active' when children are in progress.",
        "expectedCorrection": "Update parent to appropriate state or adjust child state to align with parent"
      },
      {
        "workItemId": 34567,
        "title": "Implement password reset",
        "type": "Product Backlog Item",
        "state": "Active",
        "violationType": "orphaned_child",
        "severity": "warning",
        "issue": "Product Backlog Item has no parent link",
        "expectedCorrection": "Product Backlog Item items should be linked to a parent (e.g., Feature)"
      }
    ],
    "categorized": {
      "byType": {
        "invalid_parent_type": [...],
        "invalid_state_progression": [...],
        "orphaned_child": [...]
      },
      "bySeverity": {
        "error": [...],
        "warning": [...]
      }
    },
    "validationRules": {
      "validChildTypes": {
        "Key Result": ["Epic"],
        "Epic": ["Feature"],
        "Feature": ["Product Backlog Item", "User Story"],
        "Product Backlog Item": ["Task", "Bug"],
        "User Story": ["Task", "Bug"],
        "Task": [],
        "Bug": []
      },
      "stateHierarchy": {
        "New": 1,
        "Active": 2,
        "Resolved": 3,
        "Done": 4,
        "Removed": 5
      }
    }
  },
  "metadata": {
    "source": "validate-hierarchy",
    "itemsAnalyzed": 150,
    "violationCount": 12
  },
  "errors": [],
  "warnings": ["Found 12 hierarchy violations"]
}
```

## Usage Examples

### Example 1: Validate Specific Work Items

```typescript
{
  "WorkItemIds": [12345, 23456, 34567],
  "ValidateTypes": true,
  "ValidateStates": true
}
```

### Example 2: Validate Entire Area Path

```typescript
{
  "AreaPath": "MyProject\\Authentication",
  "IncludeSubAreas": true,
  "MaxResults": 500
}
```

### Example 3: Check Only Type Relationships

```typescript
{
  "AreaPath": "MyProject\\FeatureArea",
  "ValidateTypes": true,
  "ValidateStates": false
}
```

### Example 4: Check Only State Consistency

```typescript
{
  "WorkItemIds": [11111, 22222, 33333],
  "ValidateTypes": false,
  "ValidateStates": true
}
```

## Violation Types

### Invalid Parent Type (Error)

**Severity:** Error  
**Cause:** Work item is linked to a parent of incorrect type  
**Example:** Task linked directly to Epic (should be under PBI/Story)  
**Fix:** Re-parent the item to the correct parent type

### Invalid State Progression (Warning)

**Severity:** Warning  
**Cause:** Parent-child states are inconsistent  
**Examples:**
- Parent in "New" state with child in "Active" state
- Parent marked "Done" but children still "Active"  
**Fix:** Update parent state to reflect children's progress, or adjust child states

### Orphaned Child (Warning)

**Severity:** Warning  
**Cause:** Work item has no parent link but should  
**Example:** Feature with no parent Epic  
**Fix:** Link to appropriate parent or verify if item should be top-level

## Best Practices

1. **Regular Validation:** Run this tool regularly (weekly/sprint) to maintain hierarchy health
2. **Fix Errors First:** Address "error" severity violations before "warning" severity
3. **Batch Operations:** For large backlogs, use AreaPath with MaxResults to process in chunks
4. **State Alignment:** When closing parent items, ensure all children are completed first
5. **Proper Parenting:** Always create work items with proper parent links from the start

## Performance

- **Fast:** No AI processing, pure rule-based validation
- **Scalable:** Can handle 500+ items efficiently
- **Minimal Context:** Returns only violations, not full work item details
- **Batch-Friendly:** Fetches parent data in batches of 200 for efficiency

## Integration with Other Tools

- Use `wit-get-work-item-context-package` to get full details on flagged items
- Combine with `backlog_cleanup-by-hierarchy` prompt for comprehensive analysis
- Use Azure DevOps tools to fix identified violations

## Error Handling

- Returns `success: false` if Azure CLI validation fails
- Requires either `WorkItemIds` or `AreaPath` parameter
- Gracefully handles unknown work item states
- Skips validation for parent items outside query scope (Removed/Closed)

## Notes

- Removed, Closed, Done, Completed, and Resolved items are excluded from area path queries to focus on active work
- Unknown states are skipped during state validation to avoid false positives
- The tool returns validation rules in response for transparency and documentation
- All violations include both the issue description and expected correction guidance
