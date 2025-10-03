# WIQL Quick Reference

Essential WIQL query patterns for Azure DevOps work items.

## Basic Patterns

### Get All Active Work Items in Area
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
ORDER BY [System.WorkItemType], [System.Title]
```

### Get Children of a Parent
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.Parent] = 12345
AND [System.State] <> 'Removed'
ORDER BY [System.WorkItemType], [System.Title]
```

### Get Specific Work Item Type
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.WorkItemType] = 'Product Backlog Item'
AND [System.State] = 'Active'
ORDER BY [System.Priority], [System.Title]
```

## Finding Issues

### Items Without Parents (Orphans)
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Feature')
AND [System.State] NOT IN ('Removed', 'Done')
AND ([System.Parent] = '' OR [System.Parent] IS NULL)
ORDER BY [System.WorkItemType], [System.CreatedDate] DESC
```

### Items Without Description
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.WorkItemType] = 'Product Backlog Item'
AND [System.State] = 'Active'
AND ([System.Description] = '' OR [System.Description] IS NULL)
ORDER BY [System.CreatedDate] DESC
```

### Recently Changed Items
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.ChangedDate] >= @Today - 7
ORDER BY [System.ChangedDate] DESC
```

## Hierarchical Queries

### Top-Level Items (No Parent)
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.WorkItemType] IN ('Epic', 'Key Result')
AND ([System.Parent] = '' OR [System.Parent] IS NULL)
AND [System.State] NOT IN ('Removed', 'Done')
ORDER BY [System.Title]
```

### All Descendants (Recursive) - WARNING: No ORDER BY Support
```sql
SELECT [System.Id] 
FROM WorkItemLinks 
WHERE [Source].[System.Id] = 12345 
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' 
MODE (Recursive)
```
**Note:** WorkItemLinks queries do NOT support ORDER BY. Sort results in code.

## State Filtering

### Active Work
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.State] IN ('New', 'Active', 'Committed')
ORDER BY [System.WorkItemType], [System.Priority]
```

### Recently Completed
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.State] IN ('Done', 'Completed', 'Closed', 'Resolved')
AND [System.ClosedDate] >= @Today - 30
ORDER BY [System.ClosedDate] DESC
```

## Type-Specific Queries

### All Bugs
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.WorkItemType] = 'Bug'
AND [System.State] = 'Active'
ORDER BY [System.Priority], [System.Severity]
```

### Unassigned Tasks
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.WorkItemType] = 'Task'
AND [System.State] = 'Active'
AND ([System.AssignedTo] = '' OR [System.AssignedTo] IS NULL)
ORDER BY [System.Parent]
```

## Advanced Patterns

### Items by Iteration
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.IterationPath] = 'MyProject\\Sprint 42'
AND [System.State] NOT IN ('Removed')
ORDER BY [System.WorkItemType], [System.State]
```

### Items Assigned to Copilot
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.AssignedTo] = 'GitHub Copilot <your-copilot-guid>'
AND [System.State] = 'Active'
ORDER BY [System.CreatedDate] DESC
```

### High Priority Items
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.Priority] <= 2
AND [System.State] NOT IN ('Removed', 'Done')
ORDER BY [System.Priority], [System.WorkItemType]
```

## Tool Usage Example

```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345",
  "IncludeFields": [
    "System.Title",
    "System.State", 
    "System.WorkItemType",
    "System.Parent"
  ],
  "MaxResults": 200
}
```

## Critical Notes

⚠️ **ORDER BY not supported in WorkItemLinks queries**  
⚠️ **State names are case-sensitive** ('Active' not 'active')  
⚠️ **WorkItemType names are case-sensitive** ('Product Backlog Item')  
⚠️ **Empty parent check:** `[System.Parent] = '' OR [System.Parent] IS NULL`  
⚠️ **Use UNDER for area paths** not = for sub-areas
