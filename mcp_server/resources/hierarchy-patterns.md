# Hierarchy Query Patterns

Patterns for building and querying work item hierarchies.

## Strategy: Level-by-Level Traversal

The most reliable approach is to query hierarchies level-by-level using `[System.Parent]`.

### Benefits
- ✅ Full ORDER BY support
- ✅ Different filters per level
- ✅ Better error handling
- ✅ Clear progress tracking

## Basic Parent-Child Pattern

### 1. Get Top-Level Items
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject\\MyArea'
AND [System.WorkItemType] IN ('Epic', 'Key Result')
AND ([System.Parent] = '' OR [System.Parent] IS NULL)
AND [System.State] NOT IN ('Removed', 'Done')
ORDER BY [System.Title]
```

### 2. Get Direct Children
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.Parent] = 12345
AND [System.State] NOT IN ('Removed', 'Done')
ORDER BY [System.WorkItemType], [System.Title]
```

### 3. Build Tree Recursively
```javascript
async function buildHierarchy(parentId) {
  // Get children
  const children = await wiqlQuery({
    WiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = ${parentId}`,
    IncludeFields: ["System.Title", "System.State", "System.WorkItemType", "System.Parent"]
  });
  
  // Recursively get their children
  for (const child of children.workItems) {
    child.children = await buildHierarchy(child.id);
  }
  
  return children.workItems;
}
```

## Complete Hierarchy Workflow

### Step 1: Get Root Items
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND ([System.Parent] = '' OR [System.Parent] IS NULL) AND [System.State] NOT IN ('Removed', 'Done')",
  "includeFields": ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  "maxResults": 100
}
```

### Step 2: For Each Root, Get Children
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = ${rootId}",
  "includeFields": ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  "maxResults": 200
}
```

### Step 3: Continue Recursively
Repeat Step 2 for each child until no more children found.

## Using Context Packages

### Single Item with Full Tree
```json
{
  "workItemIds": [12345],
  "includeParents": true,
  "includeChildren": true,
  "maxDepth": 5,
  "includeRelationships": true,
  "includeHistory": false
}
```
Tool: `wit-get-work-item-context-package`

### Batch Hierarchy
```json
{
  "workItemIds": [100, 101, 102],
  "includeParent": true,
  "includeChildren": true,
  "includeExtendedFields": true
}
```
Tool: `wit-get-context-packages-by-query-handle`

## Fast Validation

### Check Hierarchy Rules
```json
{
  "workItemIds": [100, 101, 102, 103]
}
```
Tool: `wit-validate-hierarchy`

**Returns:**
- Type compatibility (parent-child type rules)
- State consistency
- Orphaned items
- Circular references

## Finding Hierarchy Issues

### Find Orphaned Items
```sql
SELECT [System.Id] 
FROM WorkItems 
WHERE [System.AreaPath] UNDER 'MyProject'
AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Feature')
AND ([System.Parent] = '' OR [System.Parent] IS NULL)
AND [System.State] NOT IN ('Removed', 'Done')
ORDER BY [System.WorkItemType], [System.CreatedDate] DESC
```

### Find Items with Invalid Parents
```sql
-- First get all item IDs
SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject'

-- Then validate each item's parent exists
-- (Use wit-validate-hierarchy for automatic checking)
```

### Find Childless Parents
```sql
-- Get potential parents
SELECT [System.Id] FROM WorkItems 
WHERE [System.WorkItemType] IN ('Epic', 'Feature')
AND [System.State] = 'Active'

-- For each, check if it has children
SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = ${potentialParentId}
```

## WorkItemLinks Alternative

### All Descendants (No ORDER BY)
```sql
SELECT [System.Id] 
FROM WorkItemLinks 
WHERE [Source].[System.Id] = 12345 
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' 
MODE (Recursive)
```

**⚠️ Limitations:**
- No ORDER BY support
- Returns source/target pairs
- Complex result parsing
- Hard to filter on target fields

**Use Case:** When you need ALL descendants quickly and will sort in code.

## Best Practices

### 1. Always Include Essential Fields
```json
{
  "includeFields": [
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.Parent"  // Essential for hierarchy
  ]
}
```

### 2. Filter Out Closed Items
```sql
WHERE [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
```

### 3. Limit Recursion Depth
```javascript
async function buildHierarchy(parentId, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];
  // ... continue recursion
}
```

### 4. Batch Related Queries
```javascript
// Instead of querying one parent at a time
const parentIds = [100, 101, 102];
const allChildren = await Promise.all(
  parentIds.map(id => getChildren(id))
);
```

## Common Hierarchy Types

### Epic → Feature → PBI → Task
```
Epic (no parent)
  └─ Feature (parent: Epic)
      └─ Product Backlog Item (parent: Feature)
          └─ Task (parent: PBI)
```

### Key Result → Epic → Feature
```
Key Result (no parent)
  └─ Epic (parent: Key Result)
      └─ Feature (parent: Epic)
```

### Flat Structure
```
Product Backlog Item (no parent)
  └─ Task (parent: PBI)
```

## Validation Rules

Common parent-child type rules:
- Epic can have: Feature, Product Backlog Item
- Feature can have: Product Backlog Item, Task
- Product Backlog Item can have: Task, Bug
- Task can have: (typically no children)
- Bug can have: Task

**Use `wit-validate-hierarchy` to check these automatically.**

## Performance Tips

1. **Query by level** rather than recursive WorkItemLinks
2. **Limit maxDepth** to avoid infinite loops
3. **Use MaxResults** to prevent huge datasets
4. **Cache parent lookups** to avoid duplicate queries
5. **Batch operations** when processing multiple hierarchies
