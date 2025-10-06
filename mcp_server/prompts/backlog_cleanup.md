# Backlog Cleanup - Corrected Workflow Example

## 🎯 Purpose

This prompt demonstrates the CORRECT way to use query handles for backlog cleanup workflows, showing how `returnQueryHandle` and `includeSubstantiveChange` work together in a single query call.

## ✅ Correct Single-Query Pattern

**⚠️ CRITICAL: Never manually specify work item IDs - always use query handles to prevent hallucination.**

**Key Insight:** One query call returns BOTH the handle AND the full work item data with substantive change analysis.

### 🎯 Item Selector Pattern (Selective Operations)

Use `itemSelector` to operate on a subset of query handle items:

```javascript
// Option 1: Select by indices (zero-based)
itemSelector: [0, 1, 2, 5, 10]  // Operate on specific items

// Option 2: Select by criteria
itemSelector: {
  states: ['Active', 'New'],        // Only these states
  tags: ['NeedsReview'],            // Must have this tag
  daysInactiveMin: 90               // At least 90 days inactive
}

// Option 3: Select all (default)
itemSelector: "all"
```

### Example: Find and Remove Dead Items

```
Step 1: Single Query Gets Everything (with Server-Side Filtering)
──────────────────────────────────────────────────────────────────
Tool: wit-get-work-items-by-query-wiql

{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  "includeFields": ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo"],
  "returnQueryHandle": true,
  "filterByDaysInactiveMin": 180,  // 🆕 NEW: Only items with no substantive changes in 180+ days
  "maxResults": 200
}

// Alternative: Use date-based filtering instead
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  "includeFields": ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo"],
  "returnQueryHandle": true,
  "filterBySubstantiveChangeBefore": "2024-06-01T00:00:00Z",  // Before June 1, 2024
  "maxResults": 200
}

Response contains BOTH:
✓ query_handle: "qh_a1b2c3d4e5f6..."
✓ work_items: [
    {
      "id": 5816697,
      "fields": {
        "System.Title": "Old task",
        "System.State": "New",
        "System.CreatedDate": "2024-01-15T10:30:00Z"
      },
      "lastSubstantiveChangeDate": "2024-01-20T14:22:00Z",
      "daysInactive": 259
    },
    // ... more items
  ]
✓ work_item_count: 47

Step 1a: ⭐ NEW - Inspect Query Handle
──────────────────────────────────────────
Tool: wit-inspect-query-handle

{
  "queryHandle": "qh_a1b2c3d4e5f6...",
  "includePreview": true,
  "includeStats": true
}

Response shows:
✓ staleness_statistics: {min: 92, max: 469, avg: 287}
✓ staleness_coverage: "100.0%" (all items have staleness data)
✓ template_variables_available: ["{daysInactive}", "{lastSubstantiveChangeDate}", "{title}", "{state}", etc.]
✓ preview_items: [first 10 items with context]
✓ next_steps: [...guidance on bulk operations...]


Step 2: Review and Show User
─────────────────────────────
Analyze the work_items array:
- Total: 47 items
- All inactive >180 days
- Last substantive changes from 6-9 months ago
- Present summary to user for approval


Step 3: Add Templated Audit Comments ⭐ ENHANCED
──────────────────────────────────────────────────────
Tool: wit-bulk-comment-by-query-handle

{
  "queryHandle": "qh_a1b2c3d4e5f6...",
  "comment": "🤖 **Automated Backlog Hygiene**\n\nThis {type} has been **inactive for {daysInactive} days** since {lastSubstantiveChangeDate}.\n\n**Item:** {title}\n**Current State:** {state}\n**Assigned To:** {assignedTo}\n\n**Action:** Moving to Removed state due to extended inactivity.\n\n**Recovery:** If this item should be retained, please update the state and add a comment explaining why this work is still relevant.",
  "dryRun": true  // Preview first
}

Template Variables Used:
✓ {daysInactive} - Days since last meaningful change
✓ {lastSubstantiveChangeDate} - Date of last substantive change  
✓ {title} - Work item title
✓ {state} - Current state
✓ {type} - Work item type
✓ {assignedTo} - Assigned user


Step 4: Execute Removal
───────────────────────
Tool: wit-bulk-remove-by-query-handle

{
  "queryHandle": "qh_a1b2c3d4e5f6...",
  "removeReason": "Backlog cleanup: Items inactive >180 days",
  "dryRun": false
}

Result: ✅ Successfully removed 47 items
```

## ❌ Anti-Patterns to Avoid

### Anti-Pattern 1: Querying Twice
```
❌ WRONG - Unnecessary double query:

1. Query without returnQueryHandle (to get data)
2. Query again WITH returnQueryHandle (to get handle)

Why wrong: Wastes API calls, data can change between calls
```

### Anti-Pattern 2: Passing IDs Directly
```
❌ WRONG - Prone to hallucination:

Step 1: Query returns IDs [5816697, 12476027, 13438317]
Step 2: Agent tries to remove using:
{
  "workItemIds": [5816698, 12476028, 13438318]  // ❌ Hallucinated IDs!
}

Why wrong: LLMs can misremember or confuse IDs
```

### Anti-Pattern 3: Not Using includeSubstantiveChange
```
❌ WRONG - Removes items with recent real activity:

{
  "wiqlQuery": "... WHERE [System.CreatedDate] < @Today - 180",
  "returnQueryHandle": true
  // Missing: includeSubstantiveChange: true
}

Why wrong: Item might be old but recently had meaningful updates
```

### Anti-Pattern 4: Skipping Dry-Run
```
❌ WRONG - No safety preview:

{
  "queryHandle": "qh_...",
  "dryRun": false  // ❌ Directly to production!
}

Why wrong: Can't verify what will be affected before committing
```

## 🎓 Best Practices

### 1. Single Query for Everything (with Optional Filtering)
```json
{
  "wiqlQuery": "your query here",
  "includeFields": ["all", "fields", "you", "need"],
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,  // Optional if not using filters
  "computeMetrics": true,  // Optional: adds daysInactive, isStale, etc.
  
  // 🆕 NEW: Server-side filtering options (pick one or combine)
  "filterByDaysInactiveMin": 180,  // Only items inactive >= 180 days
  "filterByDaysInactiveMax": 30,   // Only items inactive <= 30 days
  "filterBySubstantiveChangeAfter": "2024-01-01T00:00:00Z",  // Changed after date
  "filterBySubstantiveChangeBefore": "2024-12-31T23:59:59Z"  // Changed before date
}
```

**You get:**
- Query handle for bulk operations
- Full work item data for review
- Substantive change analysis (auto-enabled by filters)
- Computed metrics
- **Filtered results** - only items matching your criteria

**Benefits of filtering:**
- ⚡ Faster - server filters before returning results
- 💰 Lower cost - fewer tokens in response
- 🎯 More precise - only relevant items returned
- 🛡️ Safer - less data to accidentally process

### 2. Always Review Before Acting
```typescript
// After query, analyze the work_items array
console.log(`Found ${data.work_item_count} items`);
console.log(`Sample: ${data.work_items.slice(0, 3).map(wi => wi.id)}`);

// Show user what will be affected
// Get approval before proceeding
```

### 3. Use Dry-Run First
```json
{
  "queryHandle": "qh_...",
  "dryRun": true  // ✅ Preview first!
}
```

### 4. Add Audit Trail
```json
// Before removal/state change, add comment
{
  "queryHandle": "qh_...",
  "comment": "Reason for this action: ...",
  "dryRun": false
}
```

### 5. Handle Expiration
```typescript
// Query handles expire after 1 hour
// If expired, simply re-query:
if (error.includes("expired")) {
  // Re-run the same WIQL query with returnQueryHandle: true
}
```

## 📋 Complete Workflow Templates

### Template 1: Find and Remove Stale Items
```json
// 1. Query with both features
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' AND [System.CreatedDate] < @Today - 180",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "includeFields": ["System.Title", "System.State", "System.CreatedDate"]
}

// 2. Review work_items array, show user

// 3. Dry-run removal
{
  "queryHandle": "{returned_handle}",
  "removeReason": "Stale items >180 days",
  "dryRun": true
}

// 4. Execute removal
{
  "queryHandle": "{returned_handle}",
  "removeReason": "Stale items >180 days",
  "dryRun": false
}
```

### Template 2: Bulk State Transition
```json
// 1. Query with both features
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.Tags] CONTAINS 'Deprecated'",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true
}

// 2. Review work_items array

// 3. Add comment explaining change
{
  "queryHandle": "{returned_handle}",
  "comment": "Moving deprecated items to Removed state",
  "dryRun": false
}

// 4. Update state
{
  "queryHandle": "{returned_handle}",
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

### Template 3: Bulk Assignment
```json
// 1. Query unassigned items
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.AssignedTo] = ''",
  "returnQueryHandle": true,
  "includeFields": ["System.Title", "System.WorkItemType"]
}

// 2. Review work_items array, determine assignee

// 3. Assign items
{
  "queryHandle": "{returned_handle}",
  "assignTo": "user@example.com",
  "dryRun": false
}
```

## 🔍 Validation Checklist

Before executing bulk operations, verify:

- [ ] Query returned expected number of items
- [ ] Work items array reviewed and correct
- [ ] Substantive change data shows items are actually inactive
- [ ] User approved the operation
- [ ] Dry-run executed successfully
- [ ] Query handle hasn't expired (< 1 hour old)
- [ ] Audit comment added (for state changes/removals)

## 🎯 Key Takeaways

1. **One Query, Two Results**: `returnQueryHandle: true` gives you BOTH handle AND data
2. **Use Both Features Together**: `returnQueryHandle` + `includeSubstantiveChange` in single call
3. **Review Before Acting**: Always analyze work_items array before bulk operations
4. **Dry-Run Is Mandatory**: Never skip preview step
5. **Add Audit Trail**: Comment before destructive operations
6. **Handles Expire**: Re-query if handle is >1 hour old

## 📚 Related Resources

- [Query Handle Pattern](../resources/query-handle-pattern.md) - Complete architecture guide
- [WIQL Best Practices](../resources/wiql-quick-reference.md) - Query optimization
- [Tool Selection Guide](../resources/tool-selection-guide.md) - When to use what
- [Common Workflows](../resources/common-workflows.md) - More examples
