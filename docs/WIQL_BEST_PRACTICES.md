# WIQL Query Best Practices and Common Pitfalls

## Overview

This guide documents common issues with WIQL (Work Item Query Language) queries and best practices for the Enhanced ADO MCP Server.

## Critical: WorkItemLinks Query Limitations

### ❌ Problem: ORDER BY Not Supported

**This query will return 0 results:**
```sql
SELECT [System.Id] FROM WorkItemLinks 
WHERE [Source].[System.Id] = 12345 
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' 
MODE (Recursive) 
ORDER BY [System.WorkItemType], [System.Title] ASC  -- ❌ NOT SUPPORTED!
```

**Why it fails:**
- Azure DevOps `WorkItemLinks` queries do NOT support `ORDER BY` clause
- The query silently fails and returns 0 results
- No error message is provided

### ✅ Solution 1: Remove ORDER BY

```sql
SELECT [System.Id] FROM WorkItemLinks 
WHERE [Source].[System.Id] = 12345 
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' 
MODE (Recursive)
```

Then sort the results in your code after receiving them.

### ✅ Solution 2: Use WorkItems Query Instead

For better control and sorting support, use `WorkItems` queries with `[System.Parent]`:

```sql
-- Get direct children (sortable)
SELECT [System.Id] FROM WorkItems 
WHERE [System.Parent] = 12345 
AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
ORDER BY [System.WorkItemType], [System.Title] ASC  -- ✅ SUPPORTED!
```

Then recursively query each child to build the full tree.

## WorkItemLinks vs WorkItems Queries

### When to Use WorkItemLinks

**✅ Good for:**
- Getting all descendants in one query (recursive relationships)
- Finding items linked by specific link types
- Understanding relationship graphs

**❌ Limitations:**
- No ORDER BY support
- Cannot filter on [Target] fields easily
- More complex result structure (source/target pairs)
- Harder to apply state filters

**Example:**
```sql
SELECT [System.Id] FROM WorkItemLinks 
WHERE [Source].[System.Id] = 12345 
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' 
MODE (Recursive)
```

### When to Use WorkItems

**✅ Good for:**
- Direct queries with full filtering support
- ORDER BY, complex WHERE clauses
- Getting specific work item types
- Filtering by state, area path, etc.

**Example:**
```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.Parent] = 12345 
AND [System.State] NOT IN ('Removed', 'Done')
AND [System.WorkItemType] IN ('Feature', 'Epic')
ORDER BY [System.CreatedDate] DESC
```

## Recommended Hierarchical Query Pattern

### Pattern: Recursive Traversal

**Best Practice:** Query level-by-level using `[System.Parent]`

```javascript
// Step 1: Get top-level items (Key Results, Epics)
const topLevelQuery = `
  SELECT [System.Id] FROM WorkItems 
  WHERE [System.AreaPath] UNDER '${areaPath}' 
  AND [System.WorkItemType] = 'Key Result'
  AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
  ORDER BY [System.Title] ASC
`;

// Step 2: For each top-level item, get its direct children
const childrenQuery = `
  SELECT [System.Id] FROM WorkItems 
  WHERE [System.Parent] = ${parentId}
  AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
  ORDER BY [System.WorkItemType], [System.Title] ASC
`;

// Step 3: Recursively repeat for each child
```

**Benefits:**
- Full control over sorting at each level
- Can apply different filters per level
- Easier to handle large hierarchies (batch by level)
- Clearer error handling

## Common WIQL Pitfalls

### 1. ❌ Nested Subqueries with WorkItemLinks

**Don't do this:**
```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.Id] NOT IN (
  SELECT [Source].[System.Id] FROM WorkItemLinks 
  WHERE [Target].[System.State] = 'Active'
)
```

**Problem:** Complex, slow, hard to debug

**Do this instead:**
```sql
-- Query 1: Get all items
SELECT [System.Id] FROM WorkItems WHERE ...

-- Query 2: Get items with active children
SELECT DISTINCT [System.Parent] FROM WorkItems 
WHERE [System.State] = 'Active' AND [System.Parent] <> ''

-- Filter in code: items1 NOT IN items2
```

### 2. ❌ Filtering on [Target] Fields in WorkItemLinks

**Don't do this:**
```sql
SELECT [System.Id] FROM WorkItemLinks 
WHERE [Source].[System.Id] = 12345 
AND [Target].[System.Description] = ''  -- ❌ Often doesn't work
```

**Do this instead:**
```sql
-- Query 1: Get all descendants
SELECT [System.Id] FROM WorkItemLinks WHERE [Source].[System.Id] = 12345

-- Query 2: Get full details for all found IDs
SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (id1, id2, id3, ...)

-- Filter in code for missing descriptions
```

### 3. ❌ Empty String Comparisons

**Careful with:**
```sql
-- This might not work as expected
WHERE [System.Parent] = ''

-- Better:
WHERE [System.Parent] = '' OR [System.Parent] IS NULL
```

### 4. ❌ Case-Sensitive Comparisons

**Remember:** WIQL field comparisons are case-insensitive, but string values are case-sensitive in some contexts.

```sql
-- State names are typically case-sensitive
WHERE [System.State] = 'Active'  -- ✅
WHERE [System.State] = 'active'  -- ❌ Might not match

-- Work item types are case-sensitive
WHERE [System.WorkItemType] = 'Product Backlog Item'  -- ✅
WHERE [System.WorkItemType] = 'product backlog item'  -- ❌
```

## Optimal Query Patterns for This MCP Server

### Pattern 1: Area Path Scanning

**Use Case:** Analyze all items in an area

```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.AreaPath] UNDER 'Project\\Area'
AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
ORDER BY [System.WorkItemType], [System.CreatedDate] DESC
```

**With substantive change:**
```javascript
{
  WiqlQuery: "...",
  IncludeFields: ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  IncludeSubstantiveChange: true,
  SubstantiveChangeHistoryCount: 50,
  MaxResults: 500
}
```

**With substantive change filtering (find stale items):**
```javascript
{
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  IncludeFields: ["System.Title", "System.State"],
  FilterByDaysInactiveMin: 180,  // Items inactive for 6+ months
  MaxResults: 500
}
```

**With substantive change filtering (find recently active items):**
```javascript
{
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  FilterByDaysInactiveMax: 30,  // Items active in last 30 days
  // OR use date-based filtering:
  FilterBySubstantiveChangeAfter: "2024-10-01T00:00:00Z"  // Items changed after Oct 1, 2024
}
```

### Pattern 2: Get Children of Specific Parent

**Use Case:** Build hierarchy level by level

```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.Parent] = {parentId}
AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
ORDER BY [System.WorkItemType], [System.Title] ASC
```

### Pattern 3: Find Orphaned Items

**Use Case:** Items missing proper parent links

```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.AreaPath] UNDER 'Project\\Area'
AND [System.WorkItemType] IN ('Feature', 'Product Backlog Item', 'Task')
AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')
AND ([System.Parent] = '' OR [System.Parent] IS NULL)
ORDER BY [System.WorkItemType], [System.CreatedDate] DESC
```

### Pattern 4: Type-Specific Queries

**Use Case:** Find specific types with conditions

```sql
SELECT [System.Id] FROM WorkItems 
WHERE [System.AreaPath] UNDER 'Project\\Area'
AND [System.WorkItemType] = 'Product Backlog Item'
AND [System.State] = 'Active'
AND ([System.Description] = '' OR [System.Description] IS NULL)
ORDER BY [System.CreatedDate] DESC
```

### Pattern 5: Find Items Missing Description

**Use Case:** Backlog cleanup - find items that need documentation

```javascript
{
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  FilterByMissingDescription: true,
  MaxResults: 100
}
```

**What counts as missing:**
- Empty description field
- Description with only whitespace  
- HTML-only content that produces less than 10 characters of text

### Pattern 6: Find Items Missing Acceptance Criteria

**Use Case:** Quality gates - find PBIs/Features without completion criteria

```javascript
{
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Feature')",
  FilterByMissingAcceptanceCriteria: true,
  MaxResults: 100
}
```

### Pattern 7: Find Incomplete Items (Both Missing)

**Use Case:** Find items missing BOTH description AND acceptance criteria

```javascript
{
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  FilterByMissingDescription: true,
  FilterByMissingAcceptanceCriteria: true,
  MaxResults: 200
}
```

### Pattern 8: Combine Quality and Staleness Filters

**Use Case:** Find old, incomplete items that need attention

```javascript
{
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  FilterByMissingDescription: true,
  FilterByDaysInactiveMin: 90,
  MaxResults: 50
}
```

## Performance Tips

### 1. Use MaxResults Wisely
```javascript
{
  MaxResults: 200  // Don't query more than needed
}
```

### 2. Request Only Needed Fields
```javascript
{
  IncludeFields: [
    "System.Title",      // Always useful
    "System.State",      // For filtering
    "System.WorkItemType", // For categorization
    "System.Parent"      // For hierarchy
    // Don't request Description unless needed
  ]
}
```

### 3. Batch Large Queries
```javascript
// Instead of one query for 1000 items
// Break into multiple queries of 200-500 each
```

### 4. Use Targeted Queries
```sql
-- ❌ Don't: Get everything then filter
SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project'

-- ✅ Do: Filter in WIQL
SELECT [System.Id] FROM WorkItems 
WHERE [System.AreaPath] UNDER 'Project\\SpecificArea'
AND [System.State] = 'Active'
AND [System.WorkItemType] = 'Bug'
```

## Testing Your Queries

### Test in Azure DevOps Web UI First

1. Go to Azure DevOps → Boards → Queries
2. Create a new query
3. Switch to "Editor" mode (not visual)
4. Paste your WIQL
5. Run and verify results
6. Then use in MCP tool

### Common Test Scenarios

```sql
-- Test 1: Does it return any results?
SELECT [System.Id] FROM WorkItems WHERE [System.Id] = {knownId}

-- Test 2: Does ORDER BY work?
SELECT [System.Id] FROM WorkItems WHERE ... ORDER BY [System.ChangedDate] DESC

-- Test 3: Are filters working?
SELECT [System.Id] FROM WorkItems 
WHERE [System.State] = 'Active' 
AND [System.WorkItemType] = 'Task'

-- Test 4: Parent relationship
SELECT [System.Id] FROM WorkItems 
WHERE [System.Parent] = {knownParentId}
```

## Summary: Key Takeaways

1. **Never use ORDER BY with WorkItemLinks queries** ⚠️
2. **Prefer WorkItems queries over WorkItemLinks** for most cases
3. **Build hierarchies recursively** using `[System.Parent]` field
4. **Test queries in Azure DevOps UI** before using in MCP
5. **Request only needed fields** to minimize context usage
6. **Use MaxResults** to prevent huge responses
7. **Handle empty parents** with `= '' OR IS NULL`
8. **Case matters** for state names and work item types
9. **Use content quality filters** to find incomplete work items
10. **Combine filters** for powerful cleanup queries (staleness + missing content)

## Advanced Feature: Fetch Full Context Packages

### Overview

The `wit-get-work-items-by-query-wiql` tool now supports an optional `fetchFullPackages` flag that retrieves comprehensive context for each work item in a single query.

### When to Use `fetchFullPackages`

✅ **Use when:**
- You need detailed descriptions, comments, and history for each work item
- Analyzing small result sets (<50 items) that require deep context
- Building comprehensive reports or documentation
- Investigating specific work items in detail

❌ **Avoid when:**
- Querying large result sets (>50 items) - causes many API calls
- Only need basic fields (ID, title, state, etc.)
- Performing bulk operations where minimal context is sufficient
- Performance is a concern

### API Cost Warning

⚠️ **Important:** Using `fetchFullPackages: true` significantly increases API calls:
- Each work item requires 2-3 additional API calls (details + comments + relations)
- A query returning 50 items could make 100-150 API calls
- Use pagination and filters to limit result sets

### Example Usage

```typescript
// Basic query without full packages (default)
{
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  top: 100
}

// Query WITH full context packages (for deep analysis)
{
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  top: 10,  // ⚠️ Keep small!
  fetchFullPackages: true  // Fetches descriptions, comments, history, relations, etc.
}
```

### What's Included in Full Packages

When `fetchFullPackages: true`, each work item includes:

- ✅ **Description** - Full markdown/HTML content
- ✅ **Acceptance Criteria** - Complete acceptance criteria
- ✅ **Comments** - All discussion threads
- ✅ **History** - Recent change history (last 10 revisions)
- ✅ **Relations** - Parent, children, related items
- ✅ **Pull Requests** - Linked PRs and commits
- ✅ **Extended Fields** - Story points, priority, risk, etc.
- ✅ **Tags** - All tags associated with the work item

### Response Structure

```typescript
{
  success: true,
  data: {
    query_handle: "qh_xxx",
    work_items: [...],           // Basic work item data
    full_packages: [...],        // ⭐ Comprehensive context packages
    fullPackagesIncluded: true,
    fullPackagesCount: 10
  }
}
```

### Best Practices

1. **Combine with filters** to minimize result sets:
   ```sql
   SELECT [System.Id] FROM WorkItems 
   WHERE [System.AreaPath] = 'MyProject\Area1'
   AND [System.State] = 'Active'
   AND [System.WorkItemType] = 'Bug'
   ```

2. **Use with pagination** for large analyses:
   ```typescript
   {
     wiqlQuery: "...",
     top: 20,
     skip: 0,
     fetchFullPackages: true
   }
   ```

3. **Monitor API usage** - check warnings in response
4. **Start small** - test with `top: 5` first

## When You Need Help

- Check Azure DevOps WIQL documentation
- Test in Azure DevOps query editor
- Start simple, add complexity incrementally
- Use `wit-validate-hierarchy-fast` for quick checks
- Review query results count before processing
- Use `fetchFullPackages` sparingly for deep analysis only
