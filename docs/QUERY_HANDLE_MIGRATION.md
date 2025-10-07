# Query Handle Migration Guide

This guide helps you migrate to the enhanced query handle pattern with item selection. The new pattern eliminates ID hallucination and provides safe, validated item selection for bulk operations.

## Why Migrate?

### The Old Problem: ID Hallucination

**Before (Problematic Pattern):**
```typescript
// AI queries for work items
const result = await queryWorkItems("SELECT [System.Id] FROM WorkItems WHERE ...");
const ids = result.workItems.map(wi => wi.id);
// IDs: [12345, 12346, 12347]

// Later, AI tries to use those IDs
await bulkComment(ids, "Update needed");  
// ❌ PROBLEM: AI might hallucinate IDs like [12348, 12349] that don't exist
// ❌ PROBLEM: User can't verify which items will be affected
// ❌ PROBLEM: No audit trail of what was selected
```

**After (Safe Pattern):**
```typescript
// AI queries and gets a validated handle
const queryHandle = await queryWithHandle("SELECT...");
// queryHandle: "qh_abc123"

// User can inspect what's in the handle
await inspectQueryHandle(queryHandle);
// Shows: 3 items with titles, states, indices

// AI selects using validated criteria
await bulkCommentByHandle(queryHandle, {itemSelector: "all"}, "Update needed");
// ✅ SAFE: IDs never leave the server
// ✅ VALIDATED: Selection uses verified indices/criteria
// ✅ AUDITABLE: Clear trail of what was selected
```

### Benefits of New Pattern

1. **No ID Hallucination** - IDs stay server-side, AI never invents fake IDs
2. **Validated Selection** - All selections validated against real query results
3. **User Preview** - Inspect and preview before executing
4. **Flexible Filtering** - Select subsets by index, state, tags, or other criteria
5. **Audit Trail** - Clear record of selection criteria used
6. **Safety** - Dry-run mode and preview tools prevent mistakes

## Migration Steps

### Step 1: Update WIQL Queries

**Before:**
```typescript
const result = await queryWIQL(
  "SELECT [System.Id], [System.Title] FROM WorkItems WHERE ..."
);
const ids = result.workItems.map(wi => wi.id);
```

**After:**
```typescript
const queryHandle = await queryWIQL(
  "SELECT [System.Id], [System.Title] FROM WorkItems WHERE ...",
  { returnQueryHandle: true }
);
// Returns: "qh_abc123"
```

### Step 2: Update Bulk Operations

**Before:**
```typescript
await bulkComment(ids, "Comment text", template);
```

**After:**
```typescript
await bulkCommentByHandle(
  queryHandle,
  { itemSelector: "all" },  // or other selection
  "Comment text",
  template
);
```

### Step 3: Add Preview Steps

**New Workflow:**
```typescript
// 1. Query with handle
const queryHandle = await queryWIQL(..., { returnQueryHandle: true });

// 2. Inspect (optional but recommended)
await inspectQueryHandle(queryHandle);

// 3. Preview selection (optional for "all", recommended for criteria)
await selectItemsFromQueryHandle(queryHandle, { states: ["Active"] });

// 4. Execute
await bulkOperationByHandle(queryHandle, { itemSelector: "all" }, ...);
```

## Common Migration Scenarios

### Scenario 1: Simple "Affect All Items"

**Before:**
```typescript
// Get all Active bugs
const result = await queryWIQL("SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] = 'Bug'");
const ids = result.workItems.map(wi => wi.id);

// Assign to user
await bulkAssign(ids, "user@company.com");
```

**After:**
```typescript
// Get all Active bugs
const queryHandle = await queryWIQL(
  "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] = 'Bug'",
  { returnQueryHandle: true }
);

// Assign to user
await bulkAssignByHandle(
  queryHandle,
  { itemSelector: "all" },  // All items from query
  "user@company.com"
);
```

### Scenario 2: Select Subset by Criteria

**Before:**
```typescript
// Get all items, then filter in code
const result = await queryWIQL("SELECT [System.Id], [System.State] FROM WorkItems WHERE ...");
const activeIds = result.workItems
  .filter(wi => wi.fields['System.State'] === 'Active')
  .map(wi => wi.id);

await bulkUpdate(activeIds, { field: "System.Priority", value: "1" });
```

**After:**
```typescript
// Get all items
const queryHandle = await queryWIQL(
  "SELECT [System.Id], [System.State] FROM WorkItems WHERE ...",
  { returnQueryHandle: true }
);

// Select Active items server-side
await bulkUpdateByHandle(
  queryHandle,
  { itemSelector: { states: ["Active"] } },  // Filter on server
  { field: "System.Priority", value: "1" }
);
```

### Scenario 3: User-Specified Selection

**Before:**
```typescript
// User says "update the first 3 items"
const result = await queryWIQL(...);
const ids = result.workItems.slice(0, 3).map(wi => wi.id);
await bulkUpdate(ids, ...);
```

**After:**
```typescript
// User says "update the first 3 items"
const queryHandle = await queryWIQL(..., { returnQueryHandle: true });

// Show user what they'll get
await inspectQueryHandle(queryHandle);
// User confirms: "Yes, update items 0, 1, 2"

await bulkUpdateByHandle(
  queryHandle,
  { itemSelector: [0, 1, 2] },  // First 3 by index
  ...
);
```

### Scenario 4: Complex Filtering

**Before:**
```typescript
// Get items, filter by multiple criteria in code
const result = await queryWIQL(...);
const filtered = result.workItems.filter(wi => 
  wi.fields['System.State'] === 'Active' &&
  wi.fields['System.Tags']?.includes('critical') &&
  // ... complex logic ...
);
const ids = filtered.map(wi => wi.id);
await bulkOperation(ids, ...);
```

**After:**
```typescript
// Get items
const queryHandle = await queryWIQL(..., { returnQueryHandle: true });

// Filter server-side with criteria
await bulkOperationByHandle(
  queryHandle,
  { 
    itemSelector: {
      states: ["Active"],
      tags: ["critical"]
    }
  },
  ...
);
```

## Common Pitfalls & Solutions

### Pitfall 1: Forgetting to Request Query Handle

**Problem:**
```typescript
const result = await queryWIQL("SELECT...");
// result = { workItems: [...] }  - NO QUERY HANDLE!
await bulkOperationByHandle(result, ...);  // ❌ Doesn't work
```

**Solution:**
```typescript
const queryHandle = await queryWIQL("SELECT...", { returnQueryHandle: true });
// queryHandle = "qh_abc123"  ✅
await bulkOperationByHandle(queryHandle, ...);  // ✅ Works
```

### Pitfall 2: Using Expired Query Handles

**Problem:**
```typescript
const queryHandle = await queryWIQL(..., { returnQueryHandle: true });
// ... wait 2 hours ...
await bulkOperationByHandle(queryHandle, ...);  // ❌ Handle expired (default 1 hour TTL)
```

**Solution:**
```typescript
// For long-running workflows, re-query:
if (handleExpired) {
  queryHandle = await queryWIQL(..., { returnQueryHandle: true });
}
await bulkOperationByHandle(queryHandle, ...);  // ✅ Fresh handle
```

### Pitfall 3: Not Previewing Destructive Operations

**Problem:**
```typescript
await bulkRemoveByHandle(queryHandle, { itemSelector: { states: ["Done"] } });
// ❌ Didn't preview - might have deleted wrong items!
```

**Solution:**
```typescript
// Always preview removals
const preview = await selectItemsFromQueryHandle(
  queryHandle,
  { itemSelector: { states: ["Done"] } }
);
// Shows: "Would select 5 items: [list of items]"

// User confirms
await bulkRemoveByHandle(
  queryHandle,
  { itemSelector: { states: ["Done"] } },
  { dryRun: false }  // Execute after confirmation
);
```

### Pitfall 4: Confusing Index 0 vs ID

**Problem:**
```typescript
// User says "update item 1"
await bulkUpdateByHandle(queryHandle, { itemSelector: [1] }, ...);
// ❌ This selects the SECOND item (index 1), not item with ID 1!
```

**Solution:**
```typescript
// Always clarify: "Do you mean the first item (index 0) or item with ID 1?"

// If they mean "first item":
await bulkUpdateByHandle(queryHandle, { itemSelector: [0] }, ...);

// If they mean "item with specific ID":
// Run query that gets only that ID:
const queryHandle = await queryWIQL("SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 1", { returnQueryHandle: true });
await bulkUpdateByHandle(queryHandle, { itemSelector: "all" }, ...);
```

### Pitfall 5: Over-Complicated Criteria

**Problem:**
```typescript
// Trying to replicate complex WIQL filtering with itemSelector
await bulkOperationByHandle(
  queryHandle,
  { itemSelector: {
    states: ["Active", "New"],
    tags: ["critical", "important", "urgent"],
    titleContains: "authentication",
    daysInactiveMin: 3,
    daysInactiveMax: 10
  }},
  ...
);
// ❌ Too complex - hard to understand what will be selected
```

**Solution:**
```typescript
// Use WIQL for complex filtering, itemSelector for simple refinement:
const queryHandle = await queryWIQL(
  "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('Active', 'New') AND [System.Tags] CONTAINS 'critical' AND [System.Title] CONTAINS 'authentication'",
  { returnQueryHandle: true, includeSubstantiveChange: true }
);

// Simple itemSelector for final filter
await bulkOperationByHandle(
  queryHandle,
  { itemSelector: { daysInactiveMin: 3 } },  // ✅ Simple, clear
  ...
);
```

## FAQ

### Q: When should I use itemSelector: "all" vs criteria?

**A:** Use "all" when:
- Your WIQL query already filtered to exactly what you want
- You've inspected the query handle and confirmed all items should be affected
- The query result is small and manageable

Use criteria when:
- You need a subset based on states, tags, or activity
- The WIQL query was broad and you want to refine server-side
- You want to filter without writing more WIQL

### Q: What happens to old bulk operation functions?

**A:** Old functions still work for backward compatibility but should be avoided:
- `bulkComment(ids, ...)` - Still works but allows ID hallucination
- `bulkAssign(ids, ...)` - Still works but lacks audit trail
- **Recommendation:** Migrate to `*ByHandle` variants for safety

### Q: How do I migrate prompts/workflows?

**A:** Update prompts to use the new pattern:

**Old Prompt:**
```
Query for all Active bugs, extract their IDs, and assign them to the security team.
```

**New Prompt:**
```
Query for all Active bugs using returnQueryHandle: true, then use bulkAssignByHandle with itemSelector: "all" to assign them to the security team.
```

### Q: Can I still get work item details?

**A:** Yes! Use `includeFields` in the WIQL query:

```typescript
const queryHandle = await queryWIQL(
  "SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo] FROM WorkItems WHERE ...",
  { 
    returnQueryHandle: true,
    includeFields: true  // Returns full details
  }
);

// Then inspect to see details:
await inspectQueryHandle(queryHandle);
// Shows: full field data for all items
```

### Q: What about performance with large result sets?

**A:** Query handles scale well:
- Handles store references, not full item data
- Selection operations are O(n) where n = items in handle
- For very large sets (>1000 items), consider:
  - More specific WIQL queries
  - Batching operations
  - Using criteria-based selection (more efficient than indices)

### Q: How do I test with the new pattern?

**A:** Use dry-run mode:

```typescript
// Test without executing
await bulkOperationByHandle(
  queryHandle,
  { itemSelector: ... },
  ...params,
  { dryRun: true }  // Shows what WOULD happen
);

// Then execute for real
await bulkOperationByHandle(
  queryHandle,
  { itemSelector: ... },
  ...params,
  { dryRun: false }
);
```

## Summary

**Key Takeaways:**
1. Always use `returnQueryHandle: true` for bulk operations
2. Never extract IDs manually - use query handles
3. Preview selections before destructive operations
4. Use itemSelector for safe, validated selection
5. Leverage dry-run mode for testing

**Migration Checklist:**
- [ ] Update all WIQL queries to return handles
- [ ] Replace `bulk*` with `bulk*ByHandle` functions
- [ ] Add itemSelector to all bulk operations
- [ ] Add preview steps for destructive operations
- [ ] Test with dry-run mode before executing
- [ ] Update prompts/workflows to use new pattern

**Still Have Questions?**
- See `resources/query-handle-pattern.md` for detailed pattern documentation
- See `resources/tool-selection-guide.md` for selection strategy guidance
- File an issue if you encounter migration problems
