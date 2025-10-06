# Query Handle Migration Guide

This guide helps you migrate from manual ID-based workflows to the safer query handle pattern.

## Why Migrate?

**Problem**: AI agents sometimes hallucinate work item IDs, leading to:
- Operations on wrong work items (5-10% error rate observed)
- Data corruption from bulk operations on incorrect items
- Time wasted debugging mysterious issues

**Solution**: Query handles eliminate hallucination by using opaque tokens instead of explicit IDs.

## Before and After Examples

### Example 1: Bulk Comment on Stale Items

**❌ BEFORE (Manual IDs - Hallucination Risk)**

```typescript
// Agent might hallucinate these IDs
const staleIds = [12345, 12346, 12347]; // ⚠️ Where did these come from?

await tools.execute('wit-bulk-add-comments', {
  items: staleIds.map(id => ({
    workItemId: id,
    comment: 'This item has been inactive for 90+ days'
  }))
});
```

**✅ AFTER (Query Handle - Safe)**

```typescript
// Step 1: Get query handle from WIQL
const result = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItems 
    WHERE [System.State] = 'Active'
    AND [System.ChangedDate] < @Today - 90
  `,
  returnQueryHandle: true // Default: true
});

// Step 2: Use handle for bulk operation (no IDs needed!)
await tools.execute('wit-bulk-comment-by-query-handle', {
  queryHandle: result.data.query_handle,
  comment: 'This item has been inactive for 90+ days',
  dryRun: true // Preview first!
});
```

### Example 2: Assign Work Items to User

**❌ BEFORE (Manual IDs)**

```typescript
// Agent might make up these IDs
const unassignedIds = [100, 101, 102]; // ⚠️ Hallucinated?

await tools.execute('wit-bulk-add-comments', {
  items: unassignedIds.map(id => ({
    workItemId: id,
    comment: 'Assigning to Sarah'
  }))
});
```

**✅ AFTER (Query Handle)**

```typescript
// Step 1: Query for unassigned items
const result = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItems 
    WHERE [System.AssignedTo] = '' 
    AND [System.State] = 'New'
  `,
  returnQueryHandle: true
});

// Step 2: Assign using handle
await tools.execute('wit-bulk-assign-by-query-handle', {
  queryHandle: result.data.query_handle,
  assignTo: 'sarah@company.com',
  dryRun: true
});
```

### Example 3: Selective Operations with Item Selector

**✅ NEW: Item Selector Pattern**

```typescript
// Step 1: Get query handle
const result = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: 'SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] = "MyProject\\MyArea"',
  includeFields: ['System.Tags', 'System.State'],
  returnQueryHandle: true
});

// Step 2: Preview selection before bulk operation
await tools.execute('wit-select-items-from-query-handle', {
  queryHandle: result.data.query_handle,
  itemSelector: {
    states: ['Active', 'New'],
    tags: ['NeedsReview'],
    daysInactiveMin: 30
  },
  previewCount: 10
});

// Step 3: Apply operation to selected items only
await tools.execute('wit-bulk-comment-by-query-handle', {
  queryHandle: result.data.query_handle,
  itemSelector: {
    states: ['Active', 'New'],
    tags: ['NeedsReview'],
    daysInactiveMin: 30
  },
  comment: 'This item needs review and has been inactive for 30+ days',
  dryRun: false
});
```

## Migration Checklist

### 1. Identify Manual ID Workflows

Search your codebase for:
- Direct work item ID arrays: `[12345, 12346, ...]`
- Manual ID input to bulk operations
- Hardcoded work item IDs

### 2. Replace with Query Handle Pattern

For each workflow:

1. **Write a WIQL query** that selects the items you need
2. **Execute with `returnQueryHandle: true`** (default)
3. **Use the handle** in subsequent bulk operations
4. **Always preview first** with `dryRun: true`

### 3. Add Safety Checks

```typescript
// Validate handle before use
const validation = await tools.execute('wit-validate-query-handle', {
  queryHandle: handle,
  includeSampleItems: true
});

if (!validation.success) {
  console.error('Handle expired or invalid');
  return;
}

// Inspect what the handle contains
const inspection = await tools.execute('wit-inspect-query-handle', {
  queryHandle: handle,
  includePreview: true,
  includeStats: true
});

console.log(`Handle contains ${inspection.data.itemCount} items`);
```

## Common Migration Patterns

### Pattern: Stale Item Cleanup

```typescript
// Old way: Manual ID list (hallucination risk)
const staleIds = findStaleItems(); // ⚠️ How?

// New way: Query-based
const { data } = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItems 
    WHERE [System.State] IN ('Active', 'New')
    ORDER BY [System.ChangedDate] DESC
  `,
  includeSubstantiveChange: true, // Compute staleness
  staleThresholdDays: 90,
  returnQueryHandle: true
});

// Use itemSelector for criteria-based filtering
await tools.execute('wit-bulk-comment-by-query-handle', {
  queryHandle: data.query_handle,
  itemSelector: { daysInactiveMin: 90 },
  comment: 'Stale item detected: {daysInactive} days inactive',
  dryRun: true
});
```

### Pattern: Hierarchy-Based Operations

```typescript
// Select all child items under a feature
const { data } = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItemLinks 
    WHERE [Source].[System.Id] = 12345 
    AND [System.Links.LinkType] = 'Child'
    MODE (MustContain)
  `,
  returnQueryHandle: true
});

await tools.execute('wit-bulk-update-by-query-handle', {
  queryHandle: data.query_handle,
  updates: [
    { op: 'replace', path: '/fields/System.State', value: 'Closed' }
  ],
  dryRun: true
});
```

## Item Selector Reference

The `itemSelector` parameter allows fine-grained control over which items are affected:

```typescript
// Select all items
itemSelector: "all"

// Select by index (zero-based)
itemSelector: [0, 1, 2, 5, 10]

// Select by criteria
itemSelector: {
  states: ['Active', 'New'],           // Filter by state
  titleContains: ['bug', 'issue'],     // Filter by title keywords
  tags: ['Priority1', 'Security'],     // Filter by tags (requires System.Tags in query)
  daysInactiveMin: 30,                 // Minimum days inactive
  daysInactiveMax: 180                 // Maximum days inactive
}
```

## Best Practices

### 1. Always Use Dry Run First

```typescript
// Preview changes
await bulkOperation({ ..., dryRun: true });

// Review output carefully
// Then apply for real
await bulkOperation({ ..., dryRun: false });
```

### 2. Check Handle Validity

```typescript
// Handles expire after 1 hour
const validation = await tools.execute('wit-validate-query-handle', {
  queryHandle: handle
});

if (!validation.success) {
  // Re-run query to get fresh handle
}
```

### 3. Use Item Selector for Safety

```typescript
// Instead of operating on ALL items
await tools.execute('wit-select-items-from-query-handle', {
  queryHandle: handle,
  itemSelector: { states: ['Active'] }, // Only active items
  previewCount: 50
});
```

### 4. Include Required Fields in Query

```typescript
// For criteria-based selection, include necessary fields
const { data } = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: 'SELECT [System.Id] FROM WorkItems WHERE ...',
  includeFields: [
    'System.Tags',        // For tag-based filtering
    'System.State',       // For state-based filtering
    'System.Title'        // For title-based filtering
  ],
  includeSubstantiveChange: true, // For staleness filtering
  returnQueryHandle: true
});
```

## Troubleshooting

### "Query handle not found or expired"

**Cause**: Handle expired (1 hour TTL) or was never created

**Solution**: Re-run the WIQL query with `returnQueryHandle: true`

### "itemSelector returned no items"

**Cause**: Criteria didn't match any items in the handle

**Solution**: 
1. Use `wit-inspect-query-handle` to see what data is available
2. Adjust your criteria
3. Ensure required fields are included in the original query

### "Criteria-based selection not working"

**Cause**: Missing fields in the query handle

**Solution**: Add required fields to your WIQL query:

```typescript
const { data } = await tools.execute('wit-get-work-items-by-query-wiql', {
  wiqlQuery: '...',
  includeFields: ['System.Tags', 'System.State'], // ✅ Add these!
  includeSubstantiveChange: true, // ✅ For daysInactive filtering
  returnQueryHandle: true
});
```

## Support and Resources

- **Query Handle Pattern Guide**: `/mcp_server/resources/query-handle-pattern.md`
- **Tool Selection Guide**: `/mcp_server/resources/tool-selection-guide.md`
- **WIQL Quick Reference**: `/mcp_server/resources/wiql-quick-reference.md`

## Questions?

If you encounter issues during migration, check the logs for deprecation warnings and hallucination detection alerts.
