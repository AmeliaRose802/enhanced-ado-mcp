# Tool Selection Guide

Quick decision guide for choosing the right tool for your task.

## 🔐 When to Use Query Handles

**Query handles eliminate ID hallucination in bulk operations.**

### Decision Tree

```
Are you performing bulk operations (updating/removing/assigning multiple items)?
├─ YES → Use Query Handles with Item Selection
│   └─ Steps:
│       1. Query with returnQueryHandle: true
│       2. Review work_items array to verify what will be affected
│       3. **NEW**: Select specific items using itemSelector:
│           • "all" → operate on all items (default)
│           • [0,2,5] → operate on specific items by index
│           • {states:["New"], daysInactiveMin:90} → criteria-based
│       4. Preview selection with analyze-bulk
│       5. Pass query_handle + itemSelector to bulk operation tool
│       6. Handle expires after 1 hour
│
└─ NO → Regular Query
    └─ Use query-wiql without returnQueryHandle
```

### ✅ Use Query Handles When:
- Operating on 2+ work items
- User says "remove those items" or "update all of them"
- Bulk state transitions (New → Removed)
- Bulk assignment operations
- Any operation where ID accuracy is critical

### Example: Query WITH Query Handle
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' AND [System.CreatedDate] < @Today - 180",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true
}
```

**Response includes BOTH:**
- `query_handle`: "qh_abc123..." (use for bulk operations)
- `work_items`: [...] (full array to review)

**Then use the handle with item selection:**
```json
// Select all items (default behavior)
{
  "queryHandle": "qh_abc123...",
  "itemSelector": "all",
  "dryRun": true
}

// Select specific items by position (user says "remove items 1, 3, and 5")
{
  "queryHandle": "qh_abc123...",
  "itemSelector": [0, 2, 4],  // Zero-based indices
  "dryRun": true
}

// Select by criteria (only stale items)
{
  "queryHandle": "qh_abc123...",
  "itemSelector": {
    "states": ["New"],
    "daysInactiveMin": 180
  },
  "dryRun": true
}
```

### ❌ Don't Need Query Handles When:
- Single work item operation
- Just reading/viewing items (no modifications)
- Creating new work items
- User explicitly provides one specific ID

## 🛡️ Enhanced Safety Features (NEW)

### Item Selection Preview
**Tool:** `analyze-bulk`  
**Purpose:** Preview exactly which items will be selected before bulk operations

```json
{
  "queryHandle": "qh_abc123...",
  "itemSelector": { "states": ["New"], "daysInactiveMin": 90 },
  "previewCount": 10
}
```

**Shows:**
- How many items match the criteria
- Preview of selected items with titles and states
- Selection percentage of total items
- Clear summary of what will be affected

### Index-Based Selection Safety
When user says "remove item 5 from that list":

```typescript
// 1. Show indexed list first
const inspection = await wit_inspect_query_handle({
  queryHandle: "qh_abc123",
  includePreview: true
});

// Shows: Index 4: "Fix authentication bug" (ID: 5816697)

// 2. Use zero-based index (item 5 = index 4)
const result = await wit_bulk_remove_by_query_handle({
  queryHandle: "qh_abc123",
  itemSelector: [4],  // Zero-based index for "item 5"
  dryRun: true
});
```

### Criteria-Based Selection Safety
Automatically filter items without manual ID extraction:

```json
// Instead of manually extracting IDs for stale items
// Let the server do the filtering
{
  "queryHandle": "qh_abc123",
  "itemSelector": {
    "daysInactiveMin": 180,
    "states": ["New", "Active"]
  },
  "removeReason": "Automated cleanup of stale items"
}
```

### Multi-Step Safety Pattern
```typescript
// Step 1: Query with handle
const query = await wit_get_work_items_by_query_wiql({
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE ...",
  returnQueryHandle: true,
  includeSubstantiveChange: true
});

// Step 2: Preview selection
const preview = await wit_select_items_from_query_handle({
  queryHandle: query.query_handle,
  itemSelector: { daysInactiveMin: 180 },
  previewCount: 10
});

// Step 3: Dry-run bulk operation
const dryRun = await wit_bulk_remove_by_query_handle({
  queryHandle: query.query_handle,
  itemSelector: { daysInactiveMin: 180 },
  dryRun: true
});

// Step 4: Execute (only after user confirmation)
const result = await wit_bulk_remove_by_query_handle({
  queryHandle: query.query_handle,
  itemSelector: { daysInactiveMin: 180 },
  dryRun: false
});
```

---

## Bulk Operations & Item Selection

When performing bulk operations on work items, choosing the right item selection strategy is critical for safety and efficiency.

### Selection Strategy Decision Tree

```
Do you want to affect ALL items from a query?
├─ YES → Use itemSelector: "all"
│
└─ NO → Do you know specific item positions/indices?
   ├─ YES → Use itemSelector: [0, 1, 2, ...]
   │
   └─ NO → Do items share common attributes (state, tags, etc.)?
      ├─ YES → Use itemSelector: { states: [...], tags: [...], ... }
      │
      └─ NO → Use inspect-handle first, then decide
```

### When to Use Each Selection Type

#### Use `itemSelector: "all"` When:
- ✅ Your WIQL query already filtered to exactly the items you want
- ✅ You want to affect every single item in the result
- ✅ The query result is small and manageable (<50 items)
- ✅ You've inspected the query handle and confirmed all items should be affected

**Example Use Cases:**
- "Comment on all items in Sprint 23"
- "Assign all bugs to the triage team"
- "Update all items tagged 'needs-review'"

**Performance:** Fastest - no additional filtering

#### Use Index-Based Selection `[0, 1, 2]` When:
- ✅ User specified "update the first N items"
- ✅ You inspected items and need specific ones by position
- ✅ Random sampling (e.g., "update every 3rd item")
- ✅ Preview showed exactly which items you want by their listed order

**Example Use Cases:**
- "Assign the first 5 unassigned bugs"
- "Comment on items at positions 0, 2, 4, 6 (every other item)"
- "After inspection, update items shown as #1, #3, and #7"

**Performance:** Very fast - direct index lookup

**Important:** Indices are 0-based. First item = index 0.

#### Use Criteria-Based Selection When:
- ✅ Items share common state, tags, or title keywords
- ✅ You need items matching specific conditions
- ✅ You want items based on activity (daysInactive)
- ✅ The selection logic needs to be criteria-driven, not positional

**Example Use Cases:**
- "Assign all Active bugs tagged 'security' to security team"
- "Comment on all stale items (inactive >7 days)"
- "Update all items with 'authentication' in the title"
- "Bulk-assign all New + In Progress items"

**Performance:** Good - O(n) filtering, but handles large result sets well

**Criteria Options:**
```typescript
{
  states: ["Active", "New"],           // Filter by work item state
  tags: ["critical", "security"],      // Filter by tags
  titleContains: "authentication",     // Filter by title keyword
  daysInactiveMin: 7,                  // Items inactive >= 7 days
  daysInactiveMax: 30                  // Items inactive <= 30 days
}
```

Multiple criteria use AND logic (all must match).

### Selection Safety Guidelines

#### ALWAYS Preview Before Destructive Operations

For `wit-bulk-remove`:
1. Run `analyze-bulk` first
2. Show user what will be deleted
3. Get explicit confirmation
4. Then execute removal

#### Use Dry-Run Mode

Most bulk operations support `dryRun: true`:
```
wit-bulk-update(
  queryHandle, 
  itemSelector: { states: ["Done"] },
  dryRun: true  // Shows what WOULD happen without executing
)
```

#### Inspect Query Handles

Before selecting, inspect to see what's available:
```
inspect-handle(queryHandle)
// Returns: indices, states, tags, counts, examples
```

### Selection Performance Considerations

**Small Result Sets (<20 items):**
- Any selection method works well
- Prefer "all" if affecting everything
- Use indices if user specified positions

**Medium Result Sets (20-100 items):**
- Prefer criteria-based selection for filtering
- Use indices only if you know specific positions
- Always preview before bulk operations

**Large Result Sets (>100 items):**
- Avoid index-based unless necessary (hard to manage 100+ indices)
- Prefer criteria-based selection
- Consider breaking into multiple WIQL queries instead
- Always use dry-run mode first

### Real-World Examples

#### Example 1: Bulk Assign Critical Bugs
```
User: "Assign all critical Active bugs to the security team"

1. Query:
   query-wiql(
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.Tags] CONTAINS 'critical'",
     returnQueryHandle: true
   )
   Result: queryHandle "qh_xyz789"

2. Preview:
   analyze-bulk(
     queryHandle: "qh_xyz789",
     itemSelector: "all"  // Query already filtered to critical + Active
   )
   Result: "Would select all 8 items"

3. Execute:
   wit-bulk-assign(
     queryHandle: "qh_xyz789",
     itemSelector: "all",
     assignTo: "security-team@company.com"
   )
```

#### Example 2: Comment on Stale Items
```
User: "Add 'needs update' comment to all stale Active items"

1. Query (get Active items):
   query-wiql(
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
     returnQueryHandle: true,
     includeSubstantiveChange: true  // Get activity data
   )
   Result: queryHandle "qh_abc123"

2. Preview (select only stale ones):
   analyze-bulk(
     queryHandle: "qh_abc123",
     itemSelector: { daysInactiveMin: 7 }
   )
   Result: "Would select 12 of 45 Active items"

3. Execute:
   wit-bulk-comment(
     queryHandle: "qh_abc123",
     itemSelector: { daysInactiveMin: 7 },
     comment: "This item needs an update - inactive for {{daysInactive}} days"
   )
```

#### Example 3: Selective Update
```
User: "Update the first 3 unassigned PBIs"

1. Query:
   query-wiql(
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Product Backlog Item' AND [System.AssignedTo] = ''",
     returnQueryHandle: true
   )
   Result: queryHandle "qh_def456"

2. Inspect:
   inspect-handle(queryHandle: "qh_def456")
   Shows: 10 items with indices 0-9

3. Preview:
   analyze-bulk(
     queryHandle: "qh_def456",
     itemSelector: [0, 1, 2]  // First 3
   )
   Result: "Would select 3 of 10 items by index"

4. Execute:
   wit-bulk-update(
     queryHandle: "qh_def456",
     itemSelector: [0, 1, 2],
     updateFields: [{ field: "System.State", value: "Active" }]
   )
```

---

## 🤖 AI-Powered Query Generation

### Generate WIQL Queries from Natural Language
**Tool:** `query-wiql` (with `description` parameter)  
**When:** Need to construct complex WIQL queries from descriptions  
**Example:** "Find all active bugs assigned to me created in the last 30 days"

```json
{
  "description": "active bugs assigned to me from last 30 days",
  "includeExamples": true,
  "testQuery": true,
  "returnQueryHandle": true
}
```

**Benefits:**
- Converts natural language to valid WIQL syntax
- Iterative validation with up to 3 refinement attempts
- Auto-injects organization, project, area path, iteration path from config
- Returns validated query with sample results and query handle

### Generate OData Queries for Analytics
**Tool:** `query-odata` (with `description` parameter)  
**When:** Need metrics, aggregations, or historical data queries from descriptions  
**Example:** "Count completed items by type in the last 90 days"

```json
{
  "description": "count completed items grouped by type in last 90 days",
  "includeExamples": true,
  "testQuery": true
}
```

**Benefits:**
- Converts natural language to valid OData Analytics queries
- Handles complex aggregations, filters, grouping
- Iterative validation with error feedback
- Returns validated query with sample results

---

## Query Work Items

### Get Individual Work Items
**Tool:** `query-wiql`  
**When:** Need specific work items with full field data  
**Example:** Get all active bugs in an area

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "returnQueryHandle": true,
  "maxResults": 200
}
```

**💡 Tip:** Use `description` parameter to generate complex queries from natural language descriptions.

### Get Metrics/Aggregations
**Tool:** `query-odata`  
**When:** Need counts, grouping, velocity, cycle time  
**Example:** Count active items by type

```json
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

**💡 Tip:** Use `description` parameter to generate complex analytics queries from natural language descriptions.

## Get Work Item Details

### Single Item with Full Context
**Tool:** `get-context`  
**When:** Need complete information about one item including relationships  
**Example:** Full context for planning work

```json
{
  "workItemId": 12345,
  "includeParent": true,
  "includeChildren": true,
  "includeHistory": true
}
```

### Multiple Items Efficiently
**Tool:** `get-context-bulk`  
**When:** Need details for multiple items with relationships  
**Example:** First execute a query, then get context packages for the results

```json
{
  "queryHandle": "qh_abc123",
  "includeParent": true,
  "includeChildren": true,
  "includeExtendedFields": true
}
```

## Create & Modify Work Items

### Create New Work Item
**Tool:** `create-workitem`  
**When:** Creating a standard work item  
**Example:** Create a new bug

```json
{
  "title": "Fix login issue",
  "workItemType": "Bug",
  "areaPath": "MyProject\\Backend",
  "assignedTo": "john@example.com"
}
```

### Assign Existing Item to Copilot
**Tool:** `assign-copilot`  
**When:** Assigning existing work to Copilot  
**Example:** Delegate existing task

```json
{
  "workItemId": 12345,
  "repository": "abc-123"
}
```

## AI-Powered Analysis

### Analyze for AI Assignment
**Tool:** `analyze-workload`  
**When:** Check if item is suitable for Copilot  
**Example:** Evaluate if task is ready for AI

```json
{
  "workItemId": 12345,
  "outputFormat": "detailed"
}
```

### Intelligent Work Item Analysis
**Tool:** `analyze-workload`  
**When:** Get AI recommendations for improvement  
**Example:** Enhance work item quality

```json
{
  "title": "Feature title",
  "description": "Feature description",
  "workItemType": "Feature",
  "analysisType": "full"
}
```

### Personal Workload Analysis
**Tool:** `analyze-workload`  
**When:** Analyze individual workload for burnout risk, career development  
**Example:** Quarterly check-in or promotion readiness

```json
{
  "assignedToEmail": "user@example.com",
  "analysisPeriodDays": 90,
  "additionalIntent": "assess readiness for senior engineer promotion"
}
```

## AI-Powered Prompts

Available prompts can be listed using `get-prompts` tool. Common prompts include sprint planning, backlog cleanup, and team health analysis.

## Bulk Operations

### 🎯 Unified Bulk Operations (Recommended)

**Single tool for all bulk modifications - eliminates tool confusion**

#### Unified Bulk Operations by Query Handle
**Tool:** `execute-bulk-operations`  
**When:** Need to perform multiple operations on work items in sequence  
**Example:** Add comment, update fields, assign, and transition state all at once

```json
{
  "queryHandle": "qh_abc123...",
  "actions": [
    {
      "type": "comment",
      "comment": "Automated review: moving to backlog cleanup"
    },
    {
      "type": "add-tag",
      "tags": "BacklogReview;Stale"
    },
    {
      "type": "update",
      "updates": [
        {
          "op": "replace",
          "path": "/fields/Microsoft.VSTS.Common.Priority",
          "value": 4
        }
      ]
    },
    {
      "type": "assign",
      "assignTo": "backlog-owner@example.com"
    }
  ],
  "dryRun": true,
  "stopOnError": true
}
```

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

**Benefits:**
- Single tool for all bulk operations
- Sequential action execution
- Item selection support
- Error handling strategies
- Atomic operation tracking

### ⚡ Legacy Query Handle-Based Operations

**Individual bulk operation tools - use unified tool instead**

#### Validate Query Handle
**Tool:** `inspect-handle`  
**When:** Check if a query handle is still valid before using it  
**Example:** Verify handle hasn't expired

```json
{
  "queryHandle": "qh_abc123...",
  "includeSampleItems": true
}
```

**Returns:** Item count, expiration time, sample items, original query

#### List Active Query Handles
**Tool:** `list-handles`  
**When:** Track and manage all active query handles  
**Example:** View all handles to avoid expiration issues

```json
{
  "includeExpired": false,
  "top": 50
}
```

### Forensic Undo Operations

#### Forensic Undo by Query Handle
**Tool:** `undo-forensic`  
**When:** Revert changes made by specific user in time window (works on ANY items, not just MCP-changed)  
**Example:** Undo accidental bulk removal

```json
{
  "queryHandle": "qh_abc123...",
  "changedBy": "user@example.com",
  "afterTimestamp": "2025-11-06T14:00:00Z",
  "beforeTimestamp": "2025-11-06T16:00:00Z",
  "detectTypeChanges": true,
  "detectStateChanges": true,
  "detectFieldChanges": true,
  "dryRun": true
}
```

### Intelligent Parent Finding

#### Find Parent Items (AI-Powered)
**Tool:** `wit-find-parent-item-intelligent`  
**When:** Need to find appropriate parent work items for orphaned items using AI  
**Example:** Fix orphaned tasks by finding suitable Feature/PBI parents

```json
{
  "childQueryHandle": "qh_orphans...",
  "searchScope": "area",
  "includeSubAreas": false,
  "parentWorkItemTypes": ["Feature", "Product Backlog Item"],
  "requireActiveParents": true,
  "maxParentCandidates": 20,
  "maxRecommendations": 3,
  "confidenceThreshold": 0.5,
  "dryRun": false
}
```

### Individual Bulk Operations (Legacy)

#### Bulk Comment by Query Handle (Legacy)
**Tool:** `execute-bulk-operations` (recommended) or legacy individual tools  
**When:** Add same comment to multiple items safely  
**Example:** Document bulk state change reason

```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "comment",
    "comment": "Moving to backlog cleanup phase"
  }],
  "dryRun": true
}
```

#### Bulk Update by Query Handle (Legacy)
**Tool:** `execute-bulk-operations` (recommended) or legacy individual tools  
**When:** Update fields on multiple items  
**Example:** Change state on all matching items

```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "update",
    "updates": [
      {
        "op": "replace",
        "path": "/fields/System.State",
        "value": "Removed"
      }
    ]
  }],
  "dryRun": true
}
```

#### Bulk Assign by Query Handle (Legacy)
**Tool:** `execute-bulk-operations` (recommended) or legacy individual tools  
**When:** Assign multiple items to a user  
**Example:** Reassign all unassigned items

```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "assign",
    "assignTo": "user@example.com"
  }],
  "dryRun": true
}
```

#### Bulk Remove by Query Handle (Legacy)
**Tool:** `execute-bulk-operations` (recommended) or legacy individual tools  
**When:** Remove multiple items safely  
**Example:** Clean up stale items

```json
{
  "queryHandle": "qh_abc123...",
  "actions": [{
    "type": "remove",
    "removeReason": "Stale items >180 days old"
  }],
  "dryRun": true
}
```

### Legacy: Direct ID-Based Bulk Operations

**⚠️ Prone to ID hallucination - use query handles instead**

Use `execute-bulk-operations` with query handles for all bulk modifications.

## Pattern Detection & Validation

### Validate Hierarchy Rules
**Tool:** `analyze-bulk` with `analysisType: ['hierarchy']`  
**When:** Check parent-child type and state rules  
**Example:** Ensure hierarchy follows conventions

```json
{
  "queryHandle": "qh_abc123...",
  "analysisType": ["hierarchy"]
}
```

## Special Tools

### Extract Security Links
**Tool:** `extract-security-links`  
**When:** Need to find security-related documentation links  
**Example:** Extract compliance references

```json
{
  "workItemId": 12345
}
```

### Get Configuration
**Tool:** `get-config`  
**When:** Need to see current MCP server settings  
**Example:** View organization, project, area path

```json
{}
```

## Decision Flow

```
Need to build a query?
├─ Complex WIQL needed? → query-wiql with description parameter (natural language → WIQL)
└─ Analytics/metrics query? → query-odata with description parameter (natural language → OData)

Need data?
├─ Individual items? → query-wiql (with returnQueryHandle for bulk ops)
├─ Metrics/counts? → query-odata
└─ Full context? → get-context (single) or get-context-bulk (multiple)

Creating items?
├─ Standard creation? → create-workitem
├─ Creating? → create-workitem
├─ Clone existing? → clone-workitem
└─ Assign existing? → assign-copilot

Analysis needed?
├─ AI suitability? → analyze-workload
├─ Quality check? → analyze-workload
├─ Find issues? → query-wiql (with content quality filters)
├─ Validate hierarchy? → analyze-bulk (with analysisType: ['hierarchy'])
├─ Personal workload? → analyze-workload
└─ Analyze by handle? → analyze-bulk

Bulk operations?
├─ Multiple actions? → execute-bulk-operations (RECOMMENDED)
├─ Single action? → wit-bulk-comment-by-query-handle, wit-bulk-update-by-query-handle, etc.
├─ Undo changes? → undo-bulk or undo-forensic
└─ Find parents? → wit-find-parent-item-intelligent

Query handle management?
├─ Inspect handle? → inspect-handle
├─ List handles? → list-handles
└─ Link items? → link-workitems

Configuration?
├─ View settings? → get-config
├─ List agents? → wit-list-subagents
└─ Get prompts? → get-prompts
```

## Performance Considerations

### Fast Operations
- `get-config` - Instant
- `analyze-query-handle (with analysisType: ['hierarchy'])` - < 1s for 100 items
- `query-odata` - Server-side aggregation (fast)

### Moderate Operations
- `query-wiql` - Depends on result count
- `query-wiql` with content quality filters - Depends on item count

### Slower Operations (Use AI)
- `analyze-workload` - AI analysis (~5-10s for single item, ~30-90s for batch)
- `find-parent-intelligent` - AI matching (~10-30s)

## Common Combinations

### Advanced Query Construction
1. `query-wiql` with description - Convert natural language to WIQL and execute
2. Review results with query handle
3. Use handle for bulk operations

### Metrics Analysis
1. `query-odata` with description - Convert description to OData query and execute
2. Review metrics and trends
3. Use for capacity planning

### Unified Bulk Operations
1. `query-wiql` - Build query with returnQueryHandle
2. `inspect-handle` - Inspect items in handle
3. `execute-bulk-operations` - Execute multiple actions sequentially

### Feature Decomposition
1. `analyze-workload` - Analyze feature
2. `create-workitem` - Create child items
3. `analyze-bulk` with analysisType: ['hierarchy'] - Verify structure

### Backlog Cleanup
1. `query-wiql` with description - Build query for stale items
2. `query-wiql` with content quality filters - Find issues
3. `execute-bulk-operations` - Add comments, tags, and reassign

### Sprint Planning
1. `query-odata` - Get velocity metrics
2. `query-wiql` - Query items for sprint with returnQueryHandle
3. `execute-bulk-operations` - Assign work to team members
4. `analyze-workload` - Check Copilot suitability
5. `assign-copilot` - Delegate to AI

### Quality Check
1. `query-wiql` - Get recent items
2. `analyze-workload` - Analyze quality
3. `analyze-bulk` with analysisType: ['hierarchy'] - Check relationships
4. `execute-bulk-operations` - Add comments requesting updates




