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
│       4. Preview selection with wit-query-handle-select
│       5. Pass query_handle + itemSelector to bulk operation tool
│       6. Handle expires after 1 hour
│
└─ NO → Regular Query
    └─ Use wit-query-wiql without returnQueryHandle
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
  "includeFields": ["System.Title", "System.State"],
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
**Tool:** `wit-query-handle-select`  
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
      └─ NO → Use wit-query-handle-inspect first, then decide
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
1. Run `wit-query-handle-select` first
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
wit-query-handle-inspect(queryHandle)
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
   wit-query-wiql(
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.Tags] CONTAINS 'critical'",
     returnQueryHandle: true
   )
   Result: queryHandle "qh_xyz789"

2. Preview:
   wit-query-handle-select(
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
   wit-query-wiql(
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
     returnQueryHandle: true,
     includeSubstantiveChange: true  // Get activity data
   )
   Result: queryHandle "qh_abc123"

2. Preview (select only stale ones):
   wit-query-handle-select(
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
   wit-query-wiql(
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Product Backlog Item' AND [System.AssignedTo] = ''",
     returnQueryHandle: true
   )
   Result: queryHandle "qh_def456"

2. Inspect:
   wit-query-handle-inspect(queryHandle: "qh_def456")
   Shows: 10 items with indices 0-9

3. Preview:
   wit-query-handle-select(
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

## 🤖 AI-Powered Query Generation (NEW)

### Generate WIQL Queries from Natural Language
**Tool:** `wit-ai-generate-wiql`  
**When:** Need to construct complex WIQL queries from descriptions  
**Example:** "Find all active bugs assigned to me created in the last 30 days"

```json
{
  "description": "active bugs assigned to me from last 30 days",
  "includeExamples": true,
  "testQuery": true
}
```

**Benefits:**
- Converts natural language to valid WIQL syntax
- Iterative validation with up to 3 refinement attempts
- Auto-injects organization, project, area path, iteration path from config
- Returns validated query with sample results

### Generate OData Queries for Analytics
**Tool:** `wit-ai-generate-odata`  
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
**Tool:** `wit-get-work-items-by-query-wiql`  
**When:** Need specific work items with full field data  
**Example:** Get all active bugs in an area

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "includeFields": ["System.Title", "System.State"],
  "maxResults": 200
}
```

**💡 Tip:** Use `wit-generate-wiql-query` to construct complex queries from natural language descriptions.

### Get Metrics/Aggregations
**Tool:** `wit-query-analytics-odata`  
**When:** Need counts, grouping, velocity, cycle time  
**Example:** Count active items by type

```json
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

**💡 Tip:** Use `wit-generate-odata-query` to construct complex analytics queries from natural language descriptions.

## Get Work Item Details

### Single Item with Full Context
**Tool:** `wit-get-work-item-context-package`  
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
**Tool:** `wit-get-work-items-context-batch`  
**When:** Need details for multiple items with relationships  
**Example:** Get context for a list of related items

```json
{
  "workItemIds": [100, 101, 102],
  "includeParent": true,
  "includeChildren": true,
  "includeExtendedFields": true
}
```

## Create & Modify Work Items

### Create New Work Item
**Tool:** `wit-create-new-item`  
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

### Create and Assign to Copilot
**Tool:** `wit-new-copilot-item`  
**When:** Creating an item for Copilot to work on  
**Example:** Create task and auto-assign with branch

```json
{
  "title": "Implement user authentication",
  "workItemType": "Task",
  "repository": "abc-123",
  "parentWorkItemId": 12345
}
```

### Assign Existing Item to Copilot
**Tool:** `wit-assign-to-copilot`  
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
**Tool:** `wit-ai-assignment-analyzer`  
**When:** Check if item is suitable for Copilot  
**Example:** Evaluate if task is ready for AI

```json
{
  "workItemId": 12345,
  "outputFormat": "detailed"
}
```

### Intelligent Work Item Analysis
**Tool:** `wit-intelligence-analyzer`  
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

## AI-Powered Prompts

### Team Velocity Analysis
**Prompt:** `team_velocity_analyzer`  
**When:** Analyze team performance and get work assignment recommendations  
**Example:** Evaluate team capacity and optimize assignments

```json
{
  "analysis_period_days": 90,
  "max_recommendations": 3
}
```

### Project Completion Planning
**Prompt:** `project_completion_planner`  
**When:** Need comprehensive project timeline and completion forecast  
**Example:** Analyze entire project, estimate completion date, optimize AI/human assignments

```json
{
  "project_epic_id": 12345,
  "target_completion_date": "2025-12-31",
  "planning_horizon_weeks": 26,
  "include_buffer": true
}
```

### AI Assignment Analysis
**Prompt:** `ai_assignment_analyzer`  
**When:** Evaluate multiple items for GitHub Copilot assignment suitability  
**Example:** Batch analyze backlog for AI opportunities

### Work Item Enhancement
**Prompt:** `work_item_enhancer`  
**When:** Improve work item descriptions, acceptance criteria, and clarity  
**Example:** Enhance PBI before sprint planning

## Bulk Operations

### ⚡ Query Handle-Based Bulk Operations (Recommended)

**Eliminates ID hallucination by using server-stored query results**

#### Validate Query Handle
**Tool:** `wit-validate-query-handle`  
**When:** Check if a query handle is still valid before using it  
**Example:** Verify handle hasn't expired

```json
{
  "queryHandle": "qh_abc123...",
  "includeSampleItems": true
}
```

**Returns:** Item count, expiration time, sample items, original query

#### Bulk Comment by Query Handle
**Tool:** `wit-bulk-comment-by-query-handle`  
**When:** Add same comment to multiple items safely  
**Example:** Document bulk state change reason

```json
{
  "queryHandle": "qh_abc123...",
  "comment": "Moving to backlog cleanup phase",
  "dryRun": true
}
```

#### Bulk Update by Query Handle
**Tool:** `wit-bulk-update-by-query-handle`  
**When:** Update fields on multiple items  
**Example:** Change state on all matching items

```json
{
  "queryHandle": "qh_abc123...",
  "updates": [
    {
      "op": "replace",
      "path": "/fields/System.State",
      "value": "Removed"
    }
  ],
  "dryRun": true
}
```

#### Bulk Assign by Query Handle
**Tool:** `wit-bulk-assign-by-query-handle`  
**When:** Assign multiple items to a user  
**Example:** Reassign all unassigned items

```json
{
  "queryHandle": "qh_abc123...",
  "assignTo": "user@example.com",
  "dryRun": true
}
```

#### Bulk Remove by Query Handle
**Tool:** `wit-bulk-remove-by-query-handle`  
**When:** Remove multiple items safely  
**Example:** Clean up stale items

```json
{
  "queryHandle": "qh_abc123...",
  "removeReason": "Stale items >180 days old",
  "dryRun": true
}
```

### Legacy: Direct ID-Based Bulk Operations

**⚠️ Prone to ID hallucination - use query handles instead**

#### Add Comments to Multiple Items
**Tool:** `wit-bulk-comment-by-query-handle`  
**When:** Need to notify or update multiple items  
**Example:** Add status update to all items in sprint

```json
{
  "queryHandle": "qh_sprint_items",
  "comment": "Updated to use new API version"
}
```

## Pattern Detection & Validation

### Detect Issues in Work Items
**Tool:** `wit-detect-patterns`  
**When:** Find common problems across items  
**Example:** Find duplicates, orphans, incomplete items

```json
{
  "workItemIds": [100, 101, 102],
  "patterns": ["duplicates", "orphaned_children", "no_description"]
}
```

### Validate Hierarchy Rules
**Tool:** `wit-validate-hierarchy`  
**When:** Check parent-child type and state rules  
**Example:** Ensure hierarchy follows conventions

```json
{
  "workItemIds": [100, 101, 102, 103]
}
```

## Special Tools

### Extract Security Links
**Tool:** `wit-extract-security-links`  
**When:** Need to find security-related documentation links  
**Example:** Extract compliance references

```json
{
  "workItemId": 12345
}
```

### Get Configuration
**Tool:** `wit-get-configuration`  
**When:** Need to see current MCP server settings  
**Example:** View organization, project, area path

```json
{}
```

## Decision Flow

```
Need to build a query?
├─ Complex WIQL needed? → wit-generate-wiql-query (natural language → WIQL)
└─ Analytics/metrics query? → wit-generate-odata-query (natural language → OData)

Need data?
├─ Individual items? → wit-get-work-items-by-query-wiql
├─ Metrics/counts? → wit-query-analytics-odata
└─ Full context? → wit-get-work-item-context-package

Creating items?
├─ Standard creation? → wit-create-new-item
├─ For Copilot? → wit-new-copilot-item
└─ Assign existing? → wit-assign-to-copilot

Analysis needed?
├─ AI suitability? → wit-ai-assignment-analyzer
├─ Quality check? → wit-intelligence-analyzer
├─ Find issues? → wit-detect-patterns
└─ Validate hierarchy? → wit-validate-hierarchy

Bulk operations?
├─ Add comments? → wit-bulk-comment-by-query-handle
└─ Process many? → Use batch tools

Configuration?
└─ View settings? → wit-get-configuration
```

## Performance Considerations

### Fast Operations
- `wit-get-configuration` - Instant
- `wit-validate-hierarchy` - < 1s for 100 items
- `wit-query-analytics-odata` - Server-side aggregation (fast)

### Moderate Operations
- `wit-get-work-items-by-query-wiql` - Depends on result count
- `wit-get-work-items-context-batch` - Depends on count
- `wit-detect-patterns` - Depends on item count

### Slower Operations (Use AI)
- `wit-ai-assignment-analyzer` - AI analysis (~5-10s)
- `wit-intelligence-analyzer` - AI analysis (~5-10s)

## Common Combinations

### Advanced Query Construction
1. `wit-generate-wiql-query` - Convert natural language to WIQL
2. `wit-get-work-items-by-query-wiql` - Execute generated query
3. Review results and refine if needed

### Metrics Analysis
1. `wit-generate-odata-query` - Convert description to OData query
2. `wit-query-analytics-odata` - Execute analytics query
3. Review metrics and trends

### Feature Decomposition
1. `wit-intelligence-analyzer` - Analyze feature
2. `wit-create-new-item` - Create child items
3. `wit-validate-hierarchy` - Verify structure

### Backlog Cleanup
1. `wit-generate-wiql-query` - Build query for stale items
2. `wit-get-work-items-by-query-wiql` - Get items with query handle
3. `wit-detect-patterns` - Find issues
4. `wit-bulk-comment-by-query-handle` - Notify owners

### Sprint Planning
1. `wit-generate-odata-query` - Build velocity query
2. `wit-query-analytics-odata` - Get velocity metrics
3. `wit-generate-wiql-query` - Build backlog query
4. `wit-get-work-items-by-query-wiql` - Get candidates
5. `wit-ai-assignment-analyzer` - Check Copilot suitability
6. `wit-assign-to-copilot` - Delegate to AI

### Project Completion Planning
1. `project_completion_planner` prompt - Comprehensive project analysis
2. Review timeline, capacity, and risks
3. `wit-assign-to-copilot` - Assign AI-suitable items
4. Track progress weekly against forecast

### Quality Check
1. `wit-get-work-items-by-query-wiql` - Get recent items
2. `wit-intelligence-analyzer` - Analyze quality
3. `wit-validate-hierarchy` - Check relationships
4. `wit-bulk-comment-by-query-handle` - Request updates
