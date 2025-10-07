# Enhanced Query Handle Pattern - Staleness-Aware Operations

> **See Also:**
> - **Query tool details:** [Query Tools](./QUERY_TOOLS.md)
> - **Handle operations:** [Query Handle Operations](./QUERY_HANDLE_OPERATIONS.md)
> - **Bulk operations:** [Bulk Operations](./BULK_OPERATIONS.md), [Bulk AI Enhancement](./BULK_AI_ENHANCEMENT.md)

## Overview

The Enhanced ADO MCP Server now supports **staleness-aware query handles** that combine Azure DevOps work item data with computed staleness metrics (`lastSubstantiveChangeDate`, `daysInactive`) in a single, anti-hallucination workflow.

## The Problem We Solved

### Before Enhancement
Beta testers reported that they couldn't effectively use the query handle feature for staleness analysis:

1. ✅ `wit-get-work-items-by-query-wiql` with `includeSubstantiveChange=true` → Got work items with staleness data
2. ✅ `wit-get-work-items-by-query-wiql` with `returnQueryHandle=true` → Got query handle for bulk operations  
3. ❌ **Could not combine both flags** → Handle lacked staleness context for bulk operations

### After Enhancement  
Now supports **combined workflow**:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
  "includeSubstantiveChange": true,
  "returnQueryHandle": true,
  "maxResults": 200
}
```

**Response includes BOTH:**
- ✅ `work_items` array with `lastSubstantiveChangeDate` and `daysInactive` 
- ✅ `query_handle` with stored staleness context for bulk operations

## New Architecture Components

### 1. Enhanced Query Handle Storage

Query handles now store rich work item context:

```typescript
interface QueryHandleData {
  workItemIds: number[];
  workItemContext?: Map<number, {
    title?: string;
    state?: string; 
    type?: string;
    lastSubstantiveChangeDate?: string;  // ← NEW
    daysInactive?: number;               // ← NEW  
    createdDate?: string;
    assignedTo?: string;
    [key: string]: any;
  }>;
  analysisMetadata?: {
    includeSubstantiveChange?: boolean;   // ← NEW
    stalenessThresholdDays?: number;     // ← NEW
    analysisTimestamp?: string;          // ← NEW
    successCount?: number;               // ← NEW
    failureCount?: number;               // ← NEW
  };
}
```

### 2. Template Variable Substitution

Bulk operations now support template variables:

```json
{
  "queryHandle": "qh_a1b2c3d4...",
  "comment": "🤖 Automated Backlog Hygiene\n\nThis item has been inactive for **{daysInactive} days** since {lastSubstantiveChangeDate}.\n\nItem: {title}\nCurrent State: {state}\nAssigned To: {assignedTo}\n\nRecommendation: Review for removal or reactivation."
}
```

**Supported Variables:**
- `{daysInactive}` - Days since last substantive change
- `{lastSubstantiveChangeDate}` - Date of last meaningful change
- `{title}` - Work item title
- `{state}` - Current state
- `{type}` - Work item type
- `{assignedTo}` - Assigned user
- `{id}` - Work item ID

### 3. Query Handle Inspector

New tool: `wit-inspect-query-handle`

```json
{
  "queryHandle": "qh_a1b2c3d4...",
  "includePreview": true,
  "includeStats": true
}
```

**Shows:**
- Staleness statistics (min/max/avg days inactive)
- Analysis coverage (how many items have staleness data)
- Preview of first 10 items with their context
- Available template variables
- Handle expiration info

## Complete Staleness Workflow

### Step 1: Query with Combined Flags

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('New', 'Active') AND [System.CreatedDate] < @Today - 90",
  "includeFields": ["System.Title", "System.State", "System.AssignedTo"],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 200
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "work_items": [
      {
        "id": 5816697,
        "title": "Implement user authentication",
        "state": "New", 
        "lastSubstantiveChangeDate": "2023-06-20T10:30:00Z",
        "daysInactive": 469
      }
    ],
    "work_item_count": 159,
    "expires_at": "2025-10-06T16:30:00Z"
  }
}
```

### Step 2: Inspect Handle to Verify Data

```json
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "includePreview": true,
  "includeStats": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "work_item_count": 159,
    "analysis": {
      "staleness_analysis_included": true,
      "staleness_success_count": 159,
      "staleness_failure_count": 0,
      "staleness_coverage": "100.0%"
    },
    "preview": {
      "showing": "First 10 of 159 items",
      "items": [
        {
          "id": 5816697,
          "title": "Implement user authentication",
          "state": "New",
          "last_substantive_change": "2023-06-20T10:30:00Z",
          "days_inactive": 469
        }
      ]
    }
  }
}
```

### Step 3: Dry-Run with Template Variables

```json
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "comment": "🤖 **Automated Backlog Hygiene Alert**\n\nThis {type} has been **inactive for {daysInactive} days** since {lastSubstantiveChangeDate}.\n\n**Item:** {title}  \n**Current State:** {state}  \n**Assigned To:** {assignedTo}\n\n**Recommendation:** Items inactive for >365 days should be reviewed for removal or reactivation.",
  "dryRun": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "work_item_count": 159,
    "comment_template": "🤖...",
    "has_template_variables": true,
    "context_data_available": true,
    "preview_items": [
      {
        "work_item_id": 5816697,
        "title": "Implement user authentication",
        "substituted_comment": "🤖 **Automated Backlog Hygiene Alert**\n\nThis Task has been **inactive for 469 days** since 2023-06-20T10:30:00Z.\n\n**Item:** Implement user authentication  \n**Current State:** New  \n**Assigned To:** john.doe@company.com\n\n**Recommendation:** Items inactive for >365 days should be reviewed for removal or reactivation.",
        "template_variables_found": {
          "daysInactive": true,
          "lastSubstantiveChangeDate": true,
          "title": true,
          "state": true,
          "assignedTo": true
        }
      }
    ]
  }
}
```

### Step 4: Execute Bulk Operation

```json
{
  "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
  "comment": "🤖 **Automated Backlog Hygiene Alert**\n\nThis {type} has been **inactive for {daysInactive} days** since {lastSubstantiveChangeDate}.\n\n**Item:** {title}  \n**Current State:** {state}  \n**Assigned To:** {assignedTo}\n\n**Recommendation:** Items inactive for >365 days should be reviewed for removal or reactivation.",
  "dryRun": false
}
```

## Benefits for Beta Testers

### ✅ Before vs After

**Before (Broken Workflow):**
```javascript
// Step 1: Get staleness data
const stalenessData = await wit_get_work_items_by_query_wiql({
  wiqlQuery: "...",
  includeSubstantiveChange: true,
  returnQueryHandle: false  // ← Had to choose: staleness OR handle
});

// Step 2: Get handle separately  
const handleData = await wit_get_work_items_by_query_wiql({
  wiqlQuery: "...",  // ← Same query again (inefficient)
  includeSubstantiveChange: false,  // ← No staleness data
  returnQueryHandle: true
});

// Step 3: Manual correlation (error-prone)
// Agent had to manually match IDs between responses
// High risk of ID hallucination

// Step 4: Static comments only
await wit_bulk_comment_by_query_handle({
  queryHandle: handleData.query_handle,
  comment: "Generic message - no staleness context"  // ← No per-item data
});
```

**After (Fixed Workflow):**
```javascript
// Step 1: Get BOTH staleness data AND handle
const response = await wit_get_work_items_by_query_wiql({
  wiqlQuery: "...",
  includeSubstantiveChange: true,  // ← Get staleness data
  returnQueryHandle: true          // ← Get handle too
});

// Step 2: Inspect handle (optional)
await wit_inspect_query_handle({
  queryHandle: response.query_handle
});

// Step 3: Templated comments with staleness data  
await wit_bulk_comment_by_query_handle({
  queryHandle: response.query_handle,
  comment: "Item inactive for {daysInactive} days since {lastSubstantiveChangeDate}"
});
```

### 🎯 Key Improvements

1. **50% Fewer API Calls** - Single call gets both data and handle
2. **100% Anti-Hallucination** - Handle stores actual staleness context  
3. **Per-Item Comments** - Template variables provide personalized messages
4. **Better UX** - Dry-run shows actual substituted comments
5. **Visibility** - Inspector shows exactly what data is available

## Migration Guide

### For Existing Prompts/Workflows

**Old Pattern:**
```markdown
1. Query work items with includeSubstantiveChange=true
2. Analyze the results manually  
3. Create generic bulk comments
```

**New Pattern:**
```markdown
1. Query work items with BOTH includeSubstantiveChange=true AND returnQueryHandle=true
2. Use wit-inspect-query-handle to verify staleness data
3. Use templated bulk comments with {daysInactive} and {lastSubstantiveChangeDate}
```

### Update Your Prompts

Replace:
```
Use wit-get-work-items-by-query-wiql with includeSubstantiveChange: true to get staleness data
```

With:
```
Use wit-get-work-items-by-query-wiql with BOTH includeSubstantiveChange: true AND returnQueryHandle: true to get staleness data with a safe handle for bulk operations. Then use wit-bulk-comment-by-query-handle with template variables like {daysInactive} and {lastSubstantiveChangeDate} for personalized comments.
```

## Error Prevention

### Common Mistakes Fixed

1. **"Handle has no staleness data"**
   - **Cause:** Query created with `returnQueryHandle=true` but `includeSubstantiveChange=false`
   - **Fix:** Always use both flags together for staleness workflows

2. **"Template variables not substituted"**  
   - **Cause:** Query handle created without context data
   - **Fix:** Use `wit-inspect-query-handle` to verify context availability

3. **"ID hallucination in staleness analysis"**
   - **Cause:** Manually correlating separate query responses
   - **Fix:** Single query with both flags eliminates correlation errors

## Backwards Compatibility

- Existing query handles without context data continue to work
- Template variables gracefully degrade (no substitution) if context unavailable  
- All existing bulk operations work unchanged
- Legacy workflows continue to function

---

**This enhancement makes the query handle feature fully usable for beta testers' staleness analysis workflows while maintaining 100% backwards compatibility.**