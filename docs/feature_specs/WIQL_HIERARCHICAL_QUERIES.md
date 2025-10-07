# WIQL Hierarchical Query Support

> **See Also:**
> - **Query tools:** [Query Tools](./QUERY_TOOLS.md) - Full WIQL and OData documentation
> - **Best practices:** [WIQL Best Practices](../guides/WIQL_BEST_PRACTICES.md) - Common patterns and pitfalls
> - **Query generation:** [Query Tools](./QUERY_TOOLS.md) - AI-powered WIQL generation

## Overview

The WIQL query generator now has comprehensive support for hierarchical queries using `FROM WorkItemLinks`.

## What Changed

### Enhanced Rule Section

**Before**: Basic mention of WorkItemLinks
```
2. WorkItemLinks Queries:
   - NEVER use ORDER BY
   - Use MODE (Recursive) for hierarchical queries
   - Use appropriate link types
```

**After**: Comprehensive hierarchical query guidance
```
2. WorkItemLinks Queries (Hierarchical Queries):
   - Use FROM WorkItemLinks for parent-child, tree, and dependency queries
   - NEVER use ORDER BY - not supported and returns 0 results
   - MODE (Recursive) - finds all descendants
   - MODE (MustContain) - require both source and target match criteria
   - MODE (MayContain) - only source or target needs to match (default)
   - Link Types with direction:
     * Hierarchy-Forward - parent to children (downward)
     * Hierarchy-Reverse - child to parents (upward)
     * Related - related work items
     * Dependency-Forward/Reverse - dependencies
   - Filter on [Source].[FieldName] and [Target].[FieldName]
   - Results contain IDs only - fetch details separately
```

### New Decision Guide

Added "CHOOSING QUERY TYPE" section:

**Use WorkItemLinks (Hierarchical) when:**
- Finding all descendants/ancestors (tree traversal)
- Parent-child relationships across multiple levels
- Finding related work items or dependencies
- Building tree structures or hierarchies

**Use WorkItems (Flat) when:**
- Simple list queries with filters
- Direct children only (use `[System.Parent] = ID`)
- Need to ORDER BY results
- Want full work item details in one query

### Enhanced Examples (10 patterns instead of 6)

New hierarchical examples added:

**Example 3**: All children recursively
```sql
SELECT [System.Id]
FROM WorkItemLinks
WHERE [Source].[System.Id] = 12345
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
MODE (Recursive)
```

**Example 4**: All parents (ancestor chain)
```sql
SELECT [System.Id]
FROM WorkItemLinks
WHERE [Source].[System.Id] = 67890
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Reverse'
MODE (Recursive)
```

**Example 5**: Parent with filtered children
```sql
SELECT [System.Id]
FROM WorkItemLinks
WHERE [Source].[System.Id] = 12345
AND [Target].[System.State] = 'Active'
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
MODE (Recursive)
```

**Example 6**: Features and their PBIs (tree with type filters)
```sql
SELECT [System.Id]
FROM WorkItemLinks
WHERE [Source].[System.WorkItemType] = 'Feature'
AND [Source].[System.AreaPath] UNDER '{{AREA_PATH}}'
AND [Target].[System.WorkItemType] = 'Product Backlog Item'
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
MODE (MustContain)
```

**Example 7**: Direct children only (one level)
```sql
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.Parent] = 12345
AND [System.TeamProject] = '{{PROJECT}}'
ORDER BY [System.WorkItemType], [System.CreatedDate]
```

### Enhanced Error Prevention

Added 3 new common errors:

**Error 5**: Wrong link type direction
- Use `Hierarchy-Forward` for parent → children
- Use `Hierarchy-Reverse` for child → parents

**Error 6**: Filtering hierarchical queries incorrectly
- Use `[Source].[Field]` for source filters
- Use `[Target].[Field]` for linked item filters

**Error 7**: Using WorkItemLinks when WorkItems is simpler
- For direct children only, use `FROM WorkItems WHERE [System.Parent] = ID`
- WorkItemLinks is for multi-level/recursive queries

## Use Cases Now Supported

### ✅ Tree Traversal
- "Get all tasks under Feature 123"
- "Find all descendants of Epic 456"
- "Show me the parent chain for this Bug"

### ✅ Filtered Hierarchies
- "Get all active children of PBI 789"
- "Find all Features with Bug children"
- "Show all PBIs in area X with their tasks"

### ✅ Complex Relationships
- "Get all related work items"
- "Find all dependencies for Epic 123"
- "Show successor items"

### ✅ Multi-Level Queries
- "All levels of children recursively"
- "Entire parent chain to root"
- "Tree structure with state filters"

### ✅ Direct Children (Optimized)
- "Just the immediate children" → Uses `FROM WorkItems` with `[System.Parent]`
- Faster, includes full details, supports ORDER BY

## Testing Recommendations

Test the generator with these prompts:

1. **Simple hierarchy**: "Get all children of work item 12345"
2. **Filtered hierarchy**: "Get all active tasks under Feature 67890"
3. **Parent chain**: "Get all parents of work item 111"
4. **Complex tree**: "Get all Features and their PBIs in area ProjectX\TeamA"
5. **Direct children**: "Get immediate children of item 222"
6. **Related items**: "Get all related work items for Bug 333"

## Implementation Notes

- WorkItemLinks queries return **IDs only** - caller must fetch work item details separately
- WorkItems queries with `[System.Parent]` return **full details** in one call
- MODE clauses are critical for correct hierarchical behavior
- Link type direction matters: Forward = down tree, Reverse = up tree
- No ORDER BY allowed with WorkItemLinks queries

## Benefits

1. **Comprehensive Coverage**: Handles all hierarchical query scenarios
2. **Clear Guidance**: Decision tree helps AI choose correct query type
3. **Error Prevention**: Covers common mistakes with hierarchical queries
4. **Practical Examples**: Real-world patterns for immediate use
5. **Optimized Queries**: Suggests simpler WorkItems query when appropriate
