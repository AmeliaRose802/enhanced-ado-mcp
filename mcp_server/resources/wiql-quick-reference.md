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
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345",
  "includeFields": [
    "System.Title",
    "System.State", 
    "System.WorkItemType",
    "System.Parent"
  ],
  "maxResults": 200
}
```

## Substantive Change Filtering

Filter results by last **meaningful** change (excludes automated updates like iteration path changes):

### Find Stale Items (Inactive 6+ Months)
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "FilterByDaysInactiveMin": 180,
  "maxResults": 500
}
```

### Find Recently Active Items (Last 30 Days)
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "FilterByDaysInactiveMax": 30
}
```

### Filter by Specific Date
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "FilterBySubstantiveChangeAfter": "2024-10-01T00:00:00Z",
  "FilterBySubstantiveChangeBefore": "2024-12-31T23:59:59Z"
}
```

**What counts as substantive:**
- Title changes
- Description updates
- State transitions
- Assignee changes
- Priority changes
- Acceptance criteria edits

**What's excluded (automated):**
- Iteration path bulk updates
- Area path changes
- Stack rank adjustments
- Backlog priority changes

**Note:** Filtering automatically enables `IncludeSubstantiveChange`, which adds `lastSubstantiveChangeDate` and `daysInactive` fields to results.

## Content Quality Filters

Find incomplete work items that need documentation or refinement:

### Find Items Missing Description
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "FilterByMissingDescription": true
}
```

### Find Items Missing Acceptance Criteria
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Feature')",
  "FilterByMissingAcceptanceCriteria": true
}
```

### Find Items Missing Both
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "FilterByMissingDescription": true,
  "FilterByMissingAcceptanceCriteria": true
}
```

**What counts as "missing":**
- Empty field
- Only whitespace
- HTML-only content producing <10 characters of text

**Common use cases:**
- ✅ Backlog cleanup before sprint planning
- ✅ Quality gates enforcement
- ✅ Finding items that need refinement
- ✅ Documentation requirements tracking

**Combine with staleness filters:**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "FilterByMissingDescription": true,
  "FilterByDaysInactiveMin": 90
}
```

## Pagination Support

Use `skip` and `top` parameters for pagination:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "top": 50,
  "skip": 0
}
```

- `top` - Maximum items per page (overrides `MaxResults`)
- `skip` - Number of items to skip (use for subsequent pages)
- Response includes `pagination.hasMore` flag and `pagination.nextSkip` value

**Example: Get page 2:**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "top": 50,
  "skip": 50
}
```

## Full Context Packages

⭐ **NEW:** Fetch comprehensive context for each work item in a query:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "top": 10,
  "fetchFullPackages": true
}
```

### What's Included

When `fetchFullPackages: true`, each work item includes:
- Full description (Markdown/HTML)
- Acceptance criteria
- Comments and discussion
- Change history (last 10 revisions)
- Parent and children details
- Related work items
- Linked pull requests and commits
- Extended fields (story points, priority, etc.)
- Tags

### API Cost Warning

⚠️ **IMPORTANT:** Each work item with `fetchFullPackages` makes 2-3 additional API calls:
- A query of 50 items = 100-150 API calls
- **Recommended:** Use with small result sets (<50 items)
- Combine with filters and pagination to minimize costs

### Example: Deep Analysis of Priority 1 Bugs

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.Priority] = 1 AND [System.State] = 'Active'",
  "top": 20,
  "fetchFullPackages": true,
  "returnQueryHandle": true
}
```

**Response includes:**
- `work_items` - Basic work item data
- `full_packages` - Comprehensive context packages
- `fullPackagesIncluded: true`
- `fullPackagesCount` - Number of packages fetched

### Best Practices

✅ **DO:**
- Use with small, targeted queries (<50 items)
- Combine with specific filters
- Use pagination for larger analyses
- Check `fullPackagesCount` in response

❌ **DON'T:**
- Use with broad queries (>50 items)
- Use for bulk operations (use basic query instead)
- Use when only basic fields needed
- Ignore API cost warnings in response

## Critical Notes

⚠️ **ORDER BY not supported in WorkItemLinks queries**  
⚠️ **State names are case-sensitive** ('Active' not 'active')  
⚠️ **WorkItemType names are case-sensitive** ('Product Backlog Item')  
⚠️ **Empty parent check:** `[System.Parent] = '' OR [System.Parent] IS NULL`  
⚠️ **Use UNDER for area paths** not = for sub-areas  
⚠️ **fetchFullPackages significantly increases API calls** - use sparingly  
✅ **Use content quality filters** for backlog cleanup and quality gates  
✅ **Combine filters** for powerful queries (staleness + missing content)




