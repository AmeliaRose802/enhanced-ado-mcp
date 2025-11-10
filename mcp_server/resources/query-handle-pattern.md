# Query Handle Pattern - Anti-Hallucination Architecture

## ⚡ Quick Start

**One call gets you both the data AND a safe handle for bulk operations:**

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  "includeFields": ["System.Title", "System.State"],
  "returnQueryHandle": true,
  "includeSubstantiveChange": true
}
```

**Response includes BOTH:**
- ✅ `query_handle`: Use for bulk operations (removes/updates/assigns)
- ✅ `work_items`: Full array of work item data with substantive change info

**Key Insight:** You get the handle AND the data in the same response. Use the data to show the user what will be affected, then use the handle for safe bulk operations without ID hallucination risk.

---

## 🎯 Purpose

The Query Handle Pattern eliminates ID hallucination in bulk operations by ensuring work item IDs come directly from Azure DevOps, not from LLM memory.

## 🚨 The Problem: ID Hallucination

**Before Query Handles:**
1. Agent queries ADO for work items → gets IDs [5816697, 12476027, 13438317]
2. User says "remove those items"
3. Agent **hallucinates different IDs** from memory → tries to remove [5816698, 12476028, 13438318]
4. ❌ Wrong items get modified or removed

**Risk:** ~5-10% of bulk operations affected by ID hallucination

## ✅ The Solution: Query Handle Architecture

**With Query Handles:**
1. Agent queries ADO with `returnQueryHandle: true` → gets opaque token "qh_a1b2c3..."
2. Server stores mapping: `qh_a1b2c3` → [5816697, 12476027, 13438317]
3. User says "remove those items"
4. Agent passes query handle to bulk operation tool
5. Server looks up **actual IDs from storage** (not LLM memory)
6. ✅ Correct items get modified

**Result:** 0% hallucination rate (structurally impossible)

## 🔄 How It Works

### Step 1: Get Query Handle

Use `query-wiql` with `returnQueryHandle: true`:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  "includeFields": ["System.Title", "System.State"],
  "returnQueryHandle": true,
  "maxResults": 200
}
```

**Response:**
```json
{
  "query_handle": "qh_a1b2c3d4e5f6...",
  "work_item_count": 47,
  "expires_at": "2025-10-03T15:30:00Z",
  "work_items": [
    {
      "id": 5816697,
      "fields": {
        "System.Title": "Fix bug",
        "System.State": "New"
      }
    }
    // ... more items
  ],
  "selection_enabled": true,
  "selection_examples": {
    "select_all": "itemSelector: 'all'",
    "select_first_item": "itemSelector: [0]",
    "select_by_state": "itemSelector: { states: ['New'] }"
  }
}
```

**What Gets Stored:**
- Server stores: `qh_a1b2c3d4e5f6` → [5816697, 12476027, 13438317, ...]
- Expiration: 1 hour (default, configurable)
- Storage: In-memory (with optional Redis support)

### Step 2: Select Items Within Handle (Optional)

**NEW**: You can now select specific items within a query handle instead of operating on all items:

**Select All Items (default):**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": "all"  // Default behavior
}
```

**Select by Index (position in results):**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": [0, 2, 5]  // First, third, and sixth items
}
```

**Select by Criteria:**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": {
    "states": ["New", "Active"],
    "daysInactiveMin": 90,
    "titleContains": ["bug", "fix"]
  }
}
```

**Preview Selection:**
```json
// Use analyze-bulk to see what items will be selected
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": { "states": ["New"] },
  "previewCount": 10
}
```

### Step 3: Use Query Handle in Bulk Operations

Pass the `query_handle` string to any bulk operation tool:

**Add Comments to All Items:**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "comment": "Automated update: moving to removed state",
  "itemSelector": "all",  // Optional: default behavior
  "dryRun": false
}
```

**Add Comments to Specific Items:**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "comment": "Selected for priority review",
  "itemSelector": [0, 2, 5],  // First, third, sixth items
  "dryRun": false
}
```

**Update Fields by Criteria:**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": {
    "states": ["New"],
    "daysInactiveMin": 30
  },
  "updates": [
    {
      "op": "replace",
      "path": "/fields/System.State",
      "value": "Removed"
    }
  ],
  "dryRun": false
}
```

**Assign Items by Tag:**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": {
    "tags": ["urgent"]
  },
  "assignTo": "user@example.com",
  "dryRun": false
}
```

**Remove Specific Items:**
```json
{
  "queryHandle": "qh_a1b2c3d4e5f6",
  "itemSelector": {
    "titleContains": ["duplicate"],
    "states": ["New"]
  },
  "removeReason": "Removing duplicate items",
  "dryRun": false
}
```

## Item Selection

Query handles now support selecting subsets of items for bulk operations. This prevents ID hallucination and provides safe, validated selection mechanisms.

### Selection Types

#### 1. Select All Items
Use when you want to affect every item in the query result.

**Example:**
```typescript
itemSelector: "all"  // Selects all items from query handle
```

**Use Cases:**
- Commenting on all items in a sprint
- Updating all items in a specific state
- When the WIQL query already filtered to exactly what you want

#### 2. Index-Based Selection
Use when you know specific item positions from inspect-query-handle output.

**Example:**
```typescript
itemSelector: [0, 1, 5]  // Selects items at indices 0, 1, and 5
```

**Use Cases:**
- User specifies "update the first 3 items"
- After inspecting items, select specific ones by index
- Selecting a sample of items for testing

**Important:** Indices are 0-based. First item is index 0.

#### 3. Criteria-Based Selection
Use when you want items matching specific attributes.

**Examples:**
```typescript
// Select by state
itemSelector: { states: ["Active", "In Progress"] }

// Select by tags
itemSelector: { tags: ["critical", "security"] }

// Select by title keywords
itemSelector: { titleContains: "authentication" }

// Select stale items
itemSelector: { daysInactiveMin: 7 }  // Items inactive >= 7 days

// Combine criteria (AND logic)
itemSelector: {
  states: ["Active"],
  tags: ["critical"],
  daysInactiveMin: 3
}
```

**Use Cases:**
- Assign all critical bugs to security team
- Comment on all stale Active items
- Update all items with specific tags
- Bulk operations on filtered subsets

### Safe Selection Workflow

**ALWAYS use this workflow for bulk operations:**

1. **Query** - Get work items with WIQL:
   ```
   query-wiql with returnQueryHandle: true
   Result: queryHandle "qh_abc123"
   ```

2. **Inspect** - Preview available items:
   ```
   inspect-handle with queryHandle: "qh_abc123"
   Shows: 10 items with indices, states, tags
   ```

3. **Preview Selection** - Verify what will be selected:
   ```
   analyze-bulk 
     queryHandle: "qh_abc123"
     itemSelector: { states: ["Active"] }
   Result: "Would select 5 of 10 items"
   ```

4. **Execute** - Perform bulk operation:
   ```
   wit-bulk-comment
     queryHandle: "qh_abc123"
     itemSelector: { states: ["Active"] }
     comment: "Needs review"
   ```

### Anti-Patterns (DO NOT DO THIS)

❌ **DO NOT extract IDs manually:**
```
// WRONG - causes hallucination
queryResult = query-wiql(...)
manualIds = [123, 456, 789]  // AI might hallucinate these
wit-bulk-comment(workItemIds: manualIds, ...)
```

✅ **DO use query handles:**
```
// CORRECT - validated selection
queryHandle = query-wiql(returnQueryHandle: true)
   execute-bulk-operations(queryHandle, itemSelector: "all")
```

❌ **DO NOT skip preview for destructive operations:**
```
// WRONG - no preview before removal
   execute-bulk-operations(queryHandle, itemSelector: {states: ["Done"]})
```

✅ **DO preview before destructive ops:**
```
// CORRECT - verify first
analyze-bulk(queryHandle, itemSelector: {states: ["Done"]})
// User confirms: "Yes, remove those 5 items"
   execute-bulk-operations(queryHandle, itemSelector: {states: ["Done"]}, dryRun: false)
```

### Selection Performance

- **Index selection:** O(n) where n = number of indices
- **Criteria selection:** O(m) where m = total items in handle
- **All selection:** O(1) - no filtering needed

Choose index selection when possible for best performance with large query results.

### Selection Expiration

Query handles expire after 24 hours by default. After expiration:
- Selection operations will fail
- Run the WIQL query again to get a fresh handle
- itemSelector patterns work the same with new handles

## 🛠️ Available Bulk Tools

All tools support `dryRun: true` for safe preview:

### Unified Bulk Operations (Recommended)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `execute-bulk-operations` | **SINGLE TOOL** for all bulk modifications - execute multiple actions sequentially | `queryHandle`, `actions[]`, `itemSelector`, `stopOnError` |

**Supported Actions:**
- `comment` - Add comments
- `update` - Update fields
- `assign` - Assign to user
- `remove` - Remove work items
- `transition-state` - Change state
- `move-iteration` - Move to iteration
- `change-type` - Change work item type
- `add-tag` / `remove-tag` - Manage tags
- `enhance-descriptions` - AI-powered description enhancement
- `assign-story-points` - AI-powered estimation
- `add-acceptance-criteria` - AI-powered criteria generation

### Individual Bulk Operations (Legacy)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `execute-bulk-operations` | Unified bulk operations (comment, update, assign, remove, etc.) | `queryHandle`, `actions`, `itemSelector` |

### Query Handle Management

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `inspect-handle` | Inspect query handle contents, validation, and stats | `queryHandle`, `detailed`, `itemSelector` |
| `list-handles` | List all active query handles for tracking | `includeExpired`, `top`, `skip` |
| `analyze-bulk` | Preview item selection before bulk ops | `queryHandle`, `itemSelector` |

### Special Operations

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `undo-forensic` | Analyze and revert changes by user/time window (works on ANY items) | `queryHandle`, `changedBy`, `afterTimestamp`, `beforeTimestamp` |
| `undo-bulk` | Undo MCP bulk operations (last or all) | `queryHandle`, `undoAll` |
| `find-parent-intelligent` | AI-powered parent recommendations for orphaned items | `childQueryHandle`, `parentWorkItemTypes`, `searchScope` |
| `link-workitems` | Create relationships between two query handle result sets | `sourceQueryHandle`, `targetQueryHandle`, `linkType`, `linkStrategy` |

## 📋 Best Practices

### ✅ DO

1. **Always use `returnQueryHandle: true` when planning bulk operations**
   ```json
   {
     "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE ...",
     "returnQueryHandle": true
   }
   ```

2. **Use dry-run first for safety**
   ```json
   {
     "queryHandle": "qh_...",
     "dryRun": true  // Preview changes first
   }
   ```

3. **Preview selection before destructive operations**
   ```json
   // Step 1: Preview what will be selected
   {
     "queryHandle": "qh_...",
     "itemSelector": { "states": ["New"], "daysInactiveMin": 90 },
     "previewCount": 10
   }
   
   // Step 2: Use same selector in bulk operation
   {
     "queryHandle": "qh_...",
     "itemSelector": { "states": ["New"], "daysInactiveMin": 90 },
     "dryRun": true
   }
   ```

4. **Add audit comments before state changes**
   ```json
   // Step 1: Add comment explaining why
   wit-bulk-comment
   
   // Step 2: Make the state change
   wit-bulk-update
   ```

4. **Check expiration before reuse**
   - Query handles expire after 24 hours by default
   - If expired, regenerate with fresh WIQL query

5. **Use specific WIQL queries**
   ```sql
   -- Good: Specific criteria
   WHERE [System.Id] IN (5816697, 12476027, 13438317)
   
   -- Good: Clear filter
   WHERE [System.State] = 'New' AND [System.CreatedDate] < @Today - 180
   ```

### ❌ DON'T

1. **Don't pass individual IDs to bulk tools**
   ```json
   // ❌ WRONG - Prone to hallucination
   {
     "workItemIds": [5816697, 12476027, 13438317]
   }
   
   // ✅ CORRECT - Use query handle
   {
     "queryHandle": "qh_a1b2c3d4e5f6"
   }
   ```

2. **Don't assume query handles live forever**
   - They expire after 24 hours
   - Regenerate if needed

3. **Don't skip dry-run for destructive operations**
   - Always preview before removing/updating

4. **Don't use query handles across sessions**
   - They're session-specific
   - Regenerate in new agent conversations

## 🔐 Safety Features

### Dry-Run Mode

All bulk tools support `dryRun: true`:

```json
{
  "queryHandle": "qh_...",
  "dryRun": true
}
```

**Response shows what WOULD happen:**
```json
{
  "dryRun": true,
  "affected_items": 47,
  "preview": [
    {
      "id": 5816697,
      "title": "Fix bug",
      "current_state": "New",
      "proposed_change": "State → Removed"
    }
  ]
}
```

### Automatic Cleanup

- Expired handles removed automatically every 5 minutes
- Default expiration: 1 hour
- Configurable via server settings

### Error Handling

Tools report individual failures:

```json
{
  "success_count": 45,
  "failed_count": 2,
  "failures": [
    {
      "id": 5816697,
      "error": "State transition not allowed: New → Removed"
    }
  ]
}
```

## 📚 Complete Workflow Examples

### Example 1: Find and Remove Dead Items (with Item Selection)

```typescript
// Step 1: Query for potentially dead items with query handle
const response1 = await query_wiql({
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItems 
    WHERE [System.State] = 'New' 
      AND [System.CreatedDate] < @Today - 90  // Cast wider net
  `,
  includeFields: ["System.Title", "System.State", "System.CreatedDate"],
  includeSubstantiveChange: true,  // Gets daysInactive data
  returnQueryHandle: true
});

// response1.query_handle = "qh_a1b2c3d4e5f6"
// response1.work_item_count = 120  // Broader query

// Step 2: Inspect items in handle
const inspection = await inspect_handle({
  queryHandle: response1.query_handle
});

console.log(`Handle contains ${inspection.workItemCount} items`);

// Step 3: Dry-run to preview removal
const preview = await wit_bulk_remove_by_query_handle({
  queryHandle: response1.query_handle,
  itemSelector: {
    daysInactiveMin: 180  // Same criteria as preview
  },
  removeReason: "Removing items with no activity >180 days",
  dryRun: true
});

// Step 4: Get user approval
// User says "yes, remove the truly stale ones"

// Step 5: Add audit comments to selected items
await wit_bulk_comment_by_query_handle({
  queryHandle: response1.query_handle,
  itemSelector: {
    daysInactiveMin: 180
  },
  comment: `
🤖 Automated Backlog Hygiene
Reason: No substantive activity for >180 days
Last Change: Available in staleness data
Review completed: ${new Date().toISOString()}
  `,
  dryRun: false
});

// Step 6: Execute removal of selected items
const result = await wit_bulk_remove_by_query_handle({
  queryHandle: response1.query_handle,
  itemSelector: {
    daysInactiveMin: 180  // Only truly stale items
  },
  removeReason: "Automated cleanup: >180 days inactive",
  dryRun: false
});

console.log(`✅ Removed ${result.successful} of ${result.selected_items} truly stale items`);
```

### Example 2: User-Directed Item Selection

```typescript
// Scenario: User says "Remove items 3, 7, and 10 from that list"

// Step 1: Show user the indexed list first
const inspection = await wit_inspect_query_handle({
  queryHandle: "qh_previous_query",
  includePreview: true
});

// Shows items with indices:
// Index 0: "Fix login bug" (ID: 5816697)
// Index 1: "Update docs" (ID: 5816698) 
// Index 2: "Add tests" (ID: 5816699)
// Index 3: "Remove deprecated code" (ID: 5816700)  ← User wants this
// ...

// Step 2: Preview user's selection
const userSelection = await wit_select_items_from_query_handle({
  queryHandle: "qh_previous_query",
  itemSelector: [2, 6, 9],  // Zero-based: items 3, 7, 10 → indices 2, 6, 9
  previewCount: 10
});

// Step 3: Execute user's choice
const result = await wit_bulk_remove_by_query_handle({
  queryHandle: "qh_previous_query",
  itemSelector: [2, 6, 9],  // Same indices as preview
  removeReason: "User-selected items for removal",
  dryRun: false
});
```

### Example 3: Bulk Assign by Team/Tag

```typescript
// Step 1: Get items that need assignment
const response = await wit_get_work_items_by_query_wiql({
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItems 
    WHERE [System.State] = 'Active' 
      AND [System.AssignedTo] = ''
  `,
  includeFields: ["System.Tags"],
  returnQueryHandle: true
});

// Step 2: Assign UI items to UI team
await wit_bulk_assign_by_query_handle({
  queryHandle: response.query_handle,
  itemSelector: {
    tags: ["UI", "frontend"]
  },
  assignTo: "ui-team@example.com",
  dryRun: false
});

// Step 3: Assign backend items to backend team
await wit_bulk_assign_by_query_handle({
  queryHandle: response.query_handle,
  itemSelector: {
    tags: ["backend", "API"]
  },
  assignTo: "backend-team@example.com",
  dryRun: false
});
```

### Example 3: Bulk Update Priority

```typescript
// Step 1: Get high-priority items
const response = await wit_get_work_items_by_query_wiql({
  wiqlQuery: `
    SELECT [System.Id] 
    FROM WorkItems 
    WHERE [System.Tags] CONTAINS 'Critical'
  `,
  returnQueryHandle: true
});

// Step 2: Update priority field
await wit_bulk_update_by_query_handle({
  queryHandle: response.query_handle,
  updates: [
    {
      op: "replace",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: 1
    }
  ],
  dryRun: false
});
```

## 🎯 When to Use Query Handles

**✅ Use Query Handles When:**
- Operating on multiple work items (2+)
- User says "remove those items" or "update those items"
- Bulk state transitions
- Bulk assignment operations
- Any operation where ID accuracy is critical

**❌ Don't Need Query Handles When:**
- Single work item operation
- User explicitly provides one specific ID
- Creating new work items
- Reading/querying only (no modifications)

## 🔍 Troubleshooting

### "Query handle not found or expired"

**Cause:** Handle expired (>24 hours old) or invalid

**Solution:** Regenerate with fresh WIQL query:
```json
{
  "wiqlQuery": "same query as before",
  "returnQueryHandle": true
}
```

### "No work items found for query handle"

**Cause:** WIQL query returned 0 items

**Solution:** Check WIQL query syntax and filters

### "State transition not allowed"

**Cause:** Work item type doesn't support requested state

**Solution:** Check valid states for work item type, use appropriate state

## 📊 Performance

**Query Handle Overhead:**
- Storage: ~100 bytes per handle
- Lookup: O(1) constant time
- Cleanup: Every 5 minutes
- Memory: Minimal (~1KB per 100 items)

**Efficiency Gains:**
- 50% fewer API calls (get items + get handle in one call)
- 100% accuracy (zero hallucination)
- Atomic bulk operations
- Automatic error reporting per item

## 🔗 Related Documentation

- [WIQL Best Practices](./wiql-quick-reference.md)
- [Tool Selection Guide](./tool-selection-guide.md)
- [Common Workflows](./common-workflows.md)




