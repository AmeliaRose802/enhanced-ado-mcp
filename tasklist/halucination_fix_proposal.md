# Proposal: Core WIQL Anti-Hallucination Architecture

**Date:** October 3, 2025  
**Author:** Backlog Hygiene System  
**Status:** Proposal  
**Priority:** Critical - Addresses systemic data integrity risk across ALL modification workflows

---

## Problem Statement

### Current Issue
**ALL Azure DevOps agent workflows that modify work items** suffer from **LLM hallucination of work item IDs**:

**Example 1: Dead Items Removal**

**Example 1: Dead Items Removal**
1. Agent queries for dead items (e.g., IDs: 5816697, 12476027, 13438317)
2. User requests removal: "remove these items"
3. Agent hallucinates **different IDs** and removes wrong items

**Example 2: Bulk State Updates**
1. Agent finds items in "New" state to move to "Active"
2. User: "activate those items"
3. Agent hallucinates different IDs, updates wrong items

**Example 3: Bulk Assignments**
1. Agent queries unassigned tasks
2. User: "assign them to Jane"
3. Agent hallucinates IDs, assigns wrong items to Jane

**Example 4: Bulk Comment Addition**
1. Agent finds stale items needing updates
2. User: "add a comment to remind owners"
3. Agent hallucinates IDs, comments on wrong items

**Root Cause:** The agent uses `wit-get-work-items-by-query-wiql` for analysis, then passes IDs through LLM context to modification tools (`mcp_ado_wit_update_work_item`, `mcp_ado_wit_add_work_item_comment`, etc.). IDs are hallucinated during this transition.

### Why Prompting Cannot Fix This
- LLMs are probabilistic and can confabulate numbers
- No amount of prompt engineering can guarantee numerical accuracy
- IDs must pass through LLM context, creating hallucination opportunity
- Validation in prompts adds complexity but doesn't eliminate root cause

### Risk Assessment
- **Severity:** CRITICAL - Incorrect data modification/deletion across all workflows
- **Frequency:** Intermittent but reproducible across multiple use cases
- **Scope:** Affects ALL bulk modification operations (state changes, assignments, comments, field updates)
- **Impact:** Loss of valid work items, broken workflows, incorrect assignments, manual recovery needed
- **Current Mitigation:** Manual review (prone to human error, doesn't scale)

---

## Proposed Solution: Query Handle Architecture in Core WIQL

### Architecture Change
**Add a "query handle" system to `wit-get-work-items-by-query-wiql` that allows subsequent operations to reference the query results without passing IDs through the LLM.**

### Core Principle
> **The server maintains query result sets. The agent passes query handles (tokens), not IDs.**

---

## Implementation Plan

### Phase 1: Query Handle System (CORE - Implement First)

#### Enhancement to Existing Tool: `wit-get-work-items-by-query-wiql`

**Add query handle support to the existing WIQL tool - no new tools needed.**

#### Enhanced API Specification

```typescript
// REQUEST - Enhanced with return_query_handle option
interface WIQLQueryRequest {
  // Existing parameters
  wiqlQuery: string;
  includeFields?: string[];
  includeSubstantiveChange?: boolean;
  substantiveChangeHistoryCount?: number;
  maxResults?: number;
  
  // NEW: Query handle support
  return_query_handle?: boolean;    // Default: false for backward compatibility
  query_handle_ttl?: number;        // Default: 3600 seconds (1 hour)
  query_handle_name?: string;       // Optional: Human-readable name for debugging
}

// RESPONSE - Enhanced with query handle
interface WIQLQueryResponse {
  // Existing fields
  workItems: WorkItem[];
  count: number;
  
  // NEW: Query handle returned when requested
  query_handle?: string;            // e.g., "qh_20251003_142530_abc123"
  query_handle_expires_at?: string; // ISO timestamp
  query_handle_item_count?: number; // Number of IDs stored in handle
}

interface WorkItem {
  // All existing fields remain unchanged
  id: number;
  title: string;
  state: string;
  // ... all other existing fields
}
```

#### Server-Side Implementation

```typescript
// In-memory or Redis cache for query handles
interface QueryHandleCache {
  [handle: string]: {
    work_item_ids: number[];
    created_at: Date;
    expires_at: Date;
    query: string;              // Original WIQL for audit
    query_name?: string;
    requested_by?: string;
  };
}

const queryHandles: QueryHandleCache = {};

async function executeWIQLQuery(request: WIQLQueryRequest): Promise<WIQLQueryResponse> {
  // Execute query as normal (existing logic unchanged)
  const workItems = await runWIQLQuery(request.wiqlQuery, {
    includeFields: request.includeFields,
    includeSubstantiveChange: request.includeSubstantiveChange,
    substantiveChangeHistoryCount: request.substantiveChangeHistoryCount,
    maxResults: request.maxResults
  });
  
  const response: WIQLQueryResponse = {
    workItems,
    count: workItems.length
  };
  
  // NEW: If query handle requested, create and store it
  if (request.return_query_handle) {
    const handle = generateQueryHandle(); // e.g., "qh_20251003_142530_abc123"
    const ttl = request.query_handle_ttl || 3600;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    // Store work item IDs in cache
    queryHandles[handle] = {
      work_item_ids: workItems.map(wi => wi.id),
      created_at: new Date(),
      expires_at: expiresAt,
      query: request.wiqlQuery,
      query_name: request.query_handle_name,
      requested_by: getCurrentUser()
    };
    
    // Schedule cleanup
    setTimeout(() => delete queryHandles[handle], ttl * 1000);
    
    response.query_handle = handle;
    response.query_handle_expires_at = expiresAt.toISOString();
    response.query_handle_item_count = workItems.length;
  }
  
  return response;
}

function generateQueryHandle(): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const random = Math.random().toString(36).substring(2, 8);
  return `qh_${timestamp}_${random}`;
}
```

#### New Bulk Operation Tools (Accept Query Handles)

**These tools operate on query handles instead of explicit ID lists:**

```typescript
// Tool 1: Bulk Update Work Items by Query Handle
interface BulkUpdateByHandleRequest {
  query_handle: string;           // Reference to query results
  updates: {
    [field: string]: any;         // e.g., { "System.State": "Active" }
  };
  dry_run?: boolean;              // Default: true
  validate_before_update?: boolean; // Re-check items still meet criteria
}

interface BulkUpdateByHandleResponse {
  query_handle: string;
  total_items_in_handle: number;
  updated?: UpdatedItem[];
  would_update_count?: number;    // If dry_run=true
  skipped?: SkippedItem[];
  errors?: ErrorItem[];
}

// Tool 2: Bulk Add Comments by Query Handle
interface BulkCommentByHandleRequest {
  query_handle: string;
  comment: string;
  dry_run?: boolean;
}

interface BulkCommentByHandleResponse {
  query_handle: string;
  total_items_in_handle: number;
  commented?: CommentedItem[];
  would_comment_count?: number;
  errors?: ErrorItem[];
}

// Tool 3: Bulk Assign by Query Handle
interface BulkAssignByHandleRequest {
  query_handle: string;
  assign_to: string;              // User email or ID
  dry_run?: boolean;
}

// Tool 4: Bulk Delete/Remove by Query Handle
interface BulkRemoveByHandleRequest {
  query_handle: string;
  target_state: "Removed" | "Closed" | "Deleted";
  removal_reason: string;
  add_audit_comment?: boolean;    // Default: true
  dry_run?: boolean;
}
```

#### Implementation of Bulk Operations

```typescript
async function bulkUpdateByHandle(request: BulkUpdateByHandleRequest): Promise<BulkUpdateByHandleResponse> {
  // Step 1: Retrieve work item IDs from handle
  const handleData = queryHandles[request.query_handle];
  
  if (!handleData) {
    throw new Error(`Query handle ${request.query_handle} not found or expired`);
  }
  
  if (handleData.expires_at < new Date()) {
    delete queryHandles[request.query_handle];
    throw new Error(`Query handle ${request.query_handle} has expired`);
  }
  
  const workItemIds = handleData.work_item_ids;
  
  // Step 2: Optionally re-validate items
  let validIds = workItemIds;
  const skipped: SkippedItem[] = [];
  
  if (request.validate_before_update) {
    const currentItems = await getWorkItemsBatch(workItemIds);
    validIds = [];
    
    for (const item of currentItems) {
      // Check if item still meets original criteria (re-run query)
      // Or check if state is valid for update
      if (isValidForUpdate(item, request.updates)) {
        validIds.push(item.id);
      } else {
        skipped.push({
          id: item.id,
          title: item.title,
          reason: `State changed to ${item.state}, no longer eligible`
        });
      }
    }
  }
  
  // Step 3: Dry run - return what would be updated
  if (request.dry_run !== false) {
    return {
      query_handle: request.query_handle,
      total_items_in_handle: workItemIds.length,
      would_update_count: validIds.length,
      skipped
    };
  }
  
  // Step 4: Execute updates
  const updated: UpdatedItem[] = [];
  const errors: ErrorItem[] = [];
  
  for (const id of validIds) {
    try {
      await updateWorkItem(id, request.updates);
      updated.push({
        id,
        updated_at: new Date().toISOString(),
        fields_updated: Object.keys(request.updates)
      });
    } catch (error) {
      errors.push({
        id,
        error: error.message,
        error_code: error.code || "UPDATE_FAILED"
      });
    }
  }
  
  return {
    query_handle: request.query_handle,
    total_items_in_handle: workItemIds.length,
    updated,
    skipped,
    errors
  };
}

// Similar implementations for:
// - bulkCommentByHandle
// - bulkAssignByHandle  
// - bulkRemoveByHandle
```

---

### Phase 2: Query Handle Tools Registration

**Register new tools that accept query handles:**

```typescript
// Tool Registry
const tools = [
  {
    name: "wit-bulk-update-by-query-handle",
    description: "Update multiple work items referenced by a query handle. Prevents ID hallucination by operating on server-stored query results.",
    parameters: BulkUpdateByHandleRequest
  },
  {
    name: "wit-bulk-comment-by-query-handle",
    description: "Add comments to multiple work items referenced by a query handle.",
    parameters: BulkCommentByHandleRequest
  },
  {
    name: "wit-bulk-assign-by-query-handle",
    description: "Assign multiple work items referenced by a query handle to a user.",
    parameters: BulkAssignByHandleRequest
  },
  {
    name: "wit-bulk-remove-by-query-handle",
    description: "Remove/close multiple work items referenced by a query handle.",
    parameters: BulkRemoveByHandleRequest
  }
];
```

#### Agent Workflow Changes

**OLD WORKFLOW (Hallucination-Prone - ALL bulk operations):**
```
1. Agent: wit-get-work-items-by-query-wiql(query) → Gets IDs [123, 456, 789]
2. Agent: Analyzes and formats for display
3. Agent: Shows user "Found items 123, 456, 789"
4. User: "update/remove/assign them"
5. Agent: ❌ HALLUCINATES different IDs [111, 222, 333]
6. Agent: Calls mcp_ado_wit_update_work_item with WRONG IDs
```

**NEW WORKFLOW (Hallucination-Proof):**
```
1. Agent: wit-get-work-items-by-query-wiql(query, return_query_handle=true)
   → Gets items + query_handle="qh_abc123"
   
2. Agent: Displays items from response (never copies IDs)
   "Found 3 items matching your criteria"
   
3. User: "update/remove/assign them"

4. Agent: wit-bulk-update-by-query-handle(query_handle="qh_abc123", dry_run=true)
   → Server shows what WOULD be updated using stored IDs
   
5. Agent: Displays preview "Would update 3 items: [list from server]"

6. User: "yes, proceed"

7. Agent: wit-bulk-update-by-query-handle(query_handle="qh_abc123", dry_run=false)
   → Server updates the EXACT items from original query
   
8. Agent: Displays confirmation from server
```

**Key Changes:**
- Agent NEVER manipulates, copies, or remembers IDs
- Agent passes `query_handle` token only
- Server maintains the authoritative ID list
- Same items guaranteed between preview and execution

---

### Universal Agent Prompt Pattern

**This pattern applies to ALL workflows that modify work items:**

```markdown
## CRITICAL: Query Handle Pattern for All Bulk Modifications

**Step 1: Query with Handle**
Always request a query handle when querying items you may modify:
```
wit-get-work-items-by-query-wiql {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE ...",
  includeFields: [...],
  return_query_handle: true,        ← REQUEST HANDLE
  query_handle_name: "dead_items_analysis"  ← Optional: descriptive name
}
```

**Step 2: Display Results (Never Copy IDs)**
Show items from the response. Display for human readability only:
```
Found {count} items:
{for each item in response.workItems}
- {item.id}: {item.title} ({item.state})

Query Handle: {response.query_handle}  ← Keep this visible for debugging
Expires: {response.query_handle_expires_at}
```

**CRITICAL: Do NOT extract, copy, store, or manipulate the item IDs. They are for display only.**

**Step 3: Preview Action (dry_run=true)**
Use the query handle for preview:
```
wit-bulk-{operation}-by-query-handle {
  query_handle: "{response.query_handle}",  ← Use handle from Step 1
  dry_run: true,
  ... operation-specific params
}
```

Display what WOULD happen:
```
Preview: Would {operation} {would_update_count} items:
{for each item in preview_response}
- {item.id}: {item.title}
```

**Step 4: Execute (dry_run=false)**
After user confirms, execute with same handle:
```
wit-bulk-{operation}-by-query-handle {
  query_handle: "{response.query_handle}",  ← SAME handle
  dry_run: false,
  ... same params as preview
}
```

**Step 5: Report Results**
Show actual results from server:
```
✅ {operation} complete
Successfully processed {success_count} items
{list actual items from response}
```

## Anti-Hallucination Guarantees

1. ✅ Agent never sees IDs except in display strings
2. ✅ Agent passes opaque token (query_handle) only
3. ✅ Server maintains authoritative ID list
4. ✅ Same handle = same items (deterministic)
5. ✅ Handle expires after 1 hour (prevents stale operations)
```

---

### Phase 3: Backward Compatibility & Migration

**The query handle system is backward compatible:**

```typescript
// Old code (still works, but hallucination-prone)
const response = await witGetWorkItemsByQueryWiql({
  wiqlQuery: "SELECT [System.Id] FROM ...",
  includeFields: ["System.Title"]
  // No return_query_handle specified
});
// response.workItems available as before
// response.query_handle will be undefined

// New code (hallucination-proof)
const response = await witGetWorkItemsByQueryWiql({
  wiqlQuery: "SELECT [System.Id] FROM ...",
  includeFields: ["System.Title"],
  return_query_handle: true  // ← NEW
});
// response.workItems available (same as before)
// response.query_handle available (new)
```

**Migration Strategy:**
1. Deploy enhanced WIQL tool and bulk operation tools
2. Update agent prompts to use query handles for new workflows
3. Gradually migrate existing workflows
4. Monitor hallucination incidents (should drop to zero)
5. Eventually deprecate direct ID-based bulk operations (Phase 4)

---

## Example Use Cases

### Use Case 1: Dead Items Removal (find_dead_items)

**Agent Workflow:**

```markdown
User: "Find and remove dead items in MyProduct area older than 180 days"

Step 1: Query with handle
wit-get-work-items-by-query-wiql {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProduct' AND [System.State] NOT IN ('Done', 'Closed', 'Removed')",
  includeFields: ["System.Title", "System.State", "System.AssignedTo"],
  includeSubstantiveChange: true,
  return_query_handle: true,
  query_handle_name: "dead_items_myproduct_180d"
}

Response:
{
  workItems: [
    { id: 5816697, title: "Move dsms entries...", state: "Active", daysInactive: 469 },
    { id: 12476027, title: "Update feature...", state: "New", daysInactive: 312 }
  ],
  count: 2,
  query_handle: "qh_20251003_142530_abc123",
  query_handle_expires_at: "2025-10-03T15:25:30Z",
  query_handle_item_count: 2
}

Agent displays:
"Found 2 dead items (inactive > 180 days):
- 5816697: Move dsms entries... (Active, 469 days)
- 12476027: Update feature... (New, 312 days)

Query Handle: qh_20251003_142530_abc123"

User: "Remove them"

Step 2: Preview removal
wit-bulk-remove-by-query-handle {
  query_handle: "qh_20251003_142530_abc123",
  target_state: "Removed",
  removal_reason: "Abandoned - no activity for 180+ days",
  dry_run: true
}

Response:
{
  would_update_count: 2,
  preview: [
    { id: 5816697, title: "Move dsms entries...", action: "Active → Removed" },
    { id: 12476027, title: "Update feature...", action: "New → Removed" }
  ]
}

Agent displays:
"Preview: Would remove 2 items:
- 5816697: Move dsms entries... (Active → Removed)
- 12476027: Update feature... (New → Removed)

Confirm removal?"

User: "Yes"

Step 3: Execute removal
wit-bulk-remove-by-query-handle {
  query_handle: "qh_20251003_142530_abc123",
  target_state: "Removed",
  removal_reason: "Abandoned - no activity for 180+ days",
  dry_run: false
}

Response:
{
  removed: [
    { id: 5816697, title: "Move dsms entries...", new_state: "Removed", audit_comment_id: 12345 },
    { id: 12476027, title: "Update feature...", new_state: "Removed", audit_comment_id: 12346 }
  ]
}

Agent displays:
"✅ Successfully removed 2 items:
- 5816697: Move dsms entries... → Removed
- 12476027: Update feature... → Removed"
```

**Key Points:**
- Agent NEVER copies or manipulates IDs
- Query handle "qh_20251003_142530_abc123" references the exact 2 items throughout
- Impossible to hallucinate different IDs

---

### Use Case 2: Bulk State Transition

**Agent Workflow:**

```markdown
User: "Move all 'New' tasks in Sprint 42 to 'Active'"

Step 1: Query
wit-get-work-items-by-query-wiql {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = 'Sprint 42' AND [System.State] = 'New' AND [System.WorkItemType] = 'Task'",
  return_query_handle: true
}

Response: { workItems: [...], query_handle: "qh_xyz789" }

Agent: "Found 15 tasks in 'New' state. Activate them?"
User: "Yes"

Step 2: Execute
wit-bulk-update-by-query-handle {
  query_handle: "qh_xyz789",
  updates: { "System.State": "Active" },
  dry_run: false
}

✅ Result: Exactly those 15 tasks updated, zero hallucination risk
```

### Use Case 3: Bulk Assignment

```markdown
User: "Assign all unassigned P0 bugs to Jane"

wit-get-work-items-by-query-wiql {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [Microsoft.VSTS.Common.Priority] = 0 AND [System.AssignedTo] = ''",
  return_query_handle: true
}
→ query_handle: "qh_bugs_p0"

wit-bulk-assign-by-query-handle {
  query_handle: "qh_bugs_p0",
  assign_to: "jane@example.com",
  dry_run: false
}

✅ Result: Exact bugs from query assigned to Jane
```

### Use Case 4: Bulk Comment Addition

```markdown
User: "Add reminder comment to all items idle > 30 days"

wit-get-work-items-by-query-wiql {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE ...",
  includeSubstantiveChange: true,
  return_query_handle: true
}
→ query_handle: "qh_idle_items"

wit-bulk-comment-by-query-handle {
  query_handle: "qh_idle_items",
  comment: "⏰ This item has been idle for 30+ days. Please update or close.",
  dry_run: false
}

✅ Result: Comments added to exact items from query
```

---

## Implementation Checklist

### Phase 1: Core WIQL Enhancement (Priority: P0 - CRITICAL)
- [ ] Add `return_query_handle` parameter to `wit-get-work-items-by-query-wiql`
- [ ] Implement query handle generation and storage (in-memory/Redis)
- [ ] Add query handle expiration (default 1 hour, configurable)
- [ ] Add query handle cleanup job
- [ ] Implement handle retrieval and validation functions
- [ ] Add comprehensive error handling for expired/invalid handles
- [ ] Unit tests for query handle lifecycle
- [ ] Load tests (1000+ items, concurrent handles)
- [ ] Document enhanced WIQL API
- [ ] Deploy WIQL enhancement to staging
- [ ] Run pilot with limited scope (dead items only)

### Phase 2: Bulk Operation Tools (Priority: P0 - CRITICAL)
- [ ] Implement `wit-bulk-update-by-query-handle`
- [ ] Implement `wit-bulk-comment-by-query-handle`
- [ ] Implement `wit-bulk-assign-by-query-handle`
- [ ] Implement `wit-bulk-remove-by-query-handle`
- [ ] Add dry_run support to all bulk tools
- [ ] Add re-validation option (check items still meet criteria)
- [ ] Add audit logging for all bulk operations
- [ ] Unit tests for each bulk operation
- [ ] Integration tests (WIQL → bulk operation flow)
- [ ] Error handling and recovery tests
- [ ] Document all bulk operation tools
- [ ] Deploy to staging

### Phase 3: Agent Prompt Updates (Priority: P0 - CRITICAL)
- [ ] Update `find_dead_items` prompt to use query handles
- [ ] Create universal query handle pattern documentation
- [ ] Update all bulk operation prompts across all agents
- [ ] Add anti-hallucination verification steps to prompts
- [ ] Test prompts with various scenarios
- [ ] Validate zero hallucination incidents in testing

### Phase 4: Production Rollout (Priority: P0)
- [ ] Deploy enhanced WIQL and bulk tools to production
- [ ] Enable for 10% of queries (canary)
- [ ] Monitor error rates, latency, memory usage
- [ ] Enable for 50% of queries
- [ ] Monitor hallucination incident rates (should be 0)
- [ ] Enable for 100% of queries
- [ ] Update all agent prompts to use query handles
- [ ] Deprecate direct ID-based bulk operations (6 month sunset period)

### Phase 5: Monitoring & Observability (Priority: P1)
- [ ] Add metrics: query handles created, used, expired
- [ ] Add metrics: bulk operations by type, success/failure rates
- [ ] Add alerting: high error rates, memory exhaustion
- [ ] Dashboard: query handle usage patterns
- [ ] Dashboard: hallucination incident tracking (should remain at 0)

### Phase 6: Advanced Features (Priority: P2 - Future)
- [ ] Query handle persistence (Redis/database for multi-hour sessions)
- [ ] Query handle sharing across team members
- [ ] Query handle filtering (operate on subset of results)
- [ ] Query handle merging (combine multiple query results)
- [ ] Query handle diff (show what changed between executions)

---

## Testing Strategy

### Unit Tests
```typescript
describe('Query Handle System', () => {
  test('WIQL with return_query_handle creates handle', async () => {
    const response = await witGetWorkItemsByQueryWiql({
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
      return_query_handle: true
    });
    
    expect(response.query_handle).toBeDefined();
    expect(response.query_handle).toMatch(/^qh_\d+_[a-z0-9]+$/);
    expect(response.query_handle_item_count).toBe(response.workItems.length);
    
    // Verify handle is retrievable
    const stored = await getQueryHandle(response.query_handle);
    expect(stored.work_item_ids).toEqual(response.workItems.map(w => w.id));
  });
  
  test('query handle expires after TTL', async () => {
    const response = await witGetWorkItemsByQueryWiql({
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
      return_query_handle: true,
      query_handle_ttl: 2  // 2 seconds
    });
    
    const handle = response.query_handle;
    
    // Should work immediately
    await expect(getQueryHandle(handle)).resolves.toBeDefined();
    
    // Should expire after 3 seconds
    await sleep(3000);
    await expect(getQueryHandle(handle)).rejects.toThrow('expired');
  });
  
  test('bulk update by handle modifies exact items from query', async () => {
    // Create query with known items
    const queryResponse = await witGetWorkItemsByQueryWiql({
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (123, 456, 789)",
      return_query_handle: true
    });
    
    // Update via handle
    const updateResponse = await witBulkUpdateByQueryHandle({
      query_handle: queryResponse.query_handle,
      updates: { "System.State": "Active" },
      dry_run: false
    });
    
    expect(updateResponse.updated.map(u => u.id).sort()).toEqual([123, 456, 789]);
    
    // Verify actual state changes in ADO
    for (const id of [123, 456, 789]) {
      const item = await getWorkItem(id);
      expect(item.state).toBe('Active');
    }
  });
  
  test('dry_run=true previews without modifying', async () => {
    const queryResponse = await witGetWorkItemsByQueryWiql({
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 999",
      return_query_handle: true
    });
    
    const beforeState = (await getWorkItem(999)).state;
    
    const updateResponse = await witBulkUpdateByQueryHandle({
      query_handle: queryResponse.query_handle,
      updates: { "System.State": "Closed" },
      dry_run: true
    });
    
    expect(updateResponse.would_update_count).toBe(1);
    expect(updateResponse.updated).toBeUndefined();
    
    // Verify no actual change
    const afterState = (await getWorkItem(999)).state;
    expect(afterState).toBe(beforeState);
  });
});

describe('Anti-Hallucination Verification', () => {
  test('agent cannot modify IDs between query and update', async () => {
    // Simulate agent workflow
    const queryResponse = await witGetWorkItemsByQueryWiql({
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
      return_query_handle: true
    });
    
    const originalIds = queryResponse.workItems.map(w => w.id);
    
    // Even if agent tries to manipulate (it can't - just passes handle)
    const updateResponse = await witBulkUpdateByQueryHandle({
      query_handle: queryResponse.query_handle,  // Opaque token only
      updates: { "System.State": "Active" },
      dry_run: false
    });
    
    const updatedIds = updateResponse.updated.map(u => u.id);
    
    // Guarantee: Updated IDs match original query exactly
    expect(updatedIds.sort()).toEqual(originalIds.sort());
  });
});
```

### Integration Tests
```typescript
describe('Agent Integration', () => {
  test('agent displays server IDs without modification', async () => {
    const agentOutput = await runAgent('analyze dead items in TestArea');
    
    // Extract IDs from agent output
    const displayedIds = extractIdsFromOutput(agentOutput);
    
    // Call server directly to get ground truth
    const serverResponse = await removeValidatedDeadItems({
      area_path: 'TestArea',
      max_age_days: 180,
      dry_run: true
    });
    const serverIds = serverResponse.analyzed.map(i => i.id);
    
    // Agent should display EXACTLY the IDs from server
    expect(displayedIds).toEqual(serverIds);
  });
  
  test('agent removal uses same criteria as analysis', async () => {
    // Analysis phase
    const analysisOutput = await runAgent('analyze dead items in TestArea');
    
    // Removal phase
    const removalOutput = await runAgent('yes, remove them');
    
    // Verify same items were removed
    const analyzedIds = extractIdsFromOutput(analysisOutput);
    const removedIds = extractIdsFromOutput(removalOutput);
    
    expect(removedIds.sort()).toEqual(analyzedIds.sort());
  });
});
```

### Load Testing
- Test with 1000+ dead items
- Verify dry_run performance
- Verify removal batch performance
- Test concurrent executions

### Security Testing
- Verify authorization checks
- Test with invalid area paths
- Test privilege escalation attempts
- Verify audit logging

---

## Migration Plan

### Week 1: Development
- Implement Phase 1 API
- Unit tests
- Internal documentation

### Week 2: Internal Testing
- Deploy to dev environment
- Integration tests
- Performance testing
- Security review

### Week 3: Pilot
- Deploy to staging
- Update agent prompt
- Select 2-3 pilot teams
- Limited scope (max 50 items)
- Monitor for issues

### Week 4: Gradual Rollout
- Deploy to production
- Enable for 25% of teams
- Monitor error rates
- Gather feedback

### Week 5: Full Rollout
- Enable for 100% of teams
- Document lessons learned
- Plan Phase 2 if needed

---

## Success Metrics

### Before (Current State - ALL Bulk Operations)
- ID hallucination rate: ~5-10% of bulk modification requests
- Affects: Dead item removal, state transitions, assignments, comments
- Manual recovery time: 30-60 minutes per incident
- User trust: Low (manual verification required for all bulk operations)
- Blast radius: Can affect wrong items across entire ADO project

### After (Target State - Query Handle Architecture)
- ID hallucination rate: 0% (structurally impossible)
- Manual recovery time: 0 (no incorrect modifications)
- User trust: High (can confidently approve bulk operations)
- Blast radius: Limited to exact query results, deterministic
- Applies to: ALL bulk modification workflows universally

### Monitoring
- Track API error rates
- Monitor dry_run vs execution ratio
- Track user confirmations vs rejections
- Measure time from analysis to removal
- Count hallucination-related incidents (should be 0)

---

## Risks and Mitigations

### Risk: Server re-analysis finds different items
**Mitigation:** Document this as expected behavior. Items may be updated between analysis and removal. This is safer than using stale IDs.

### Risk: Performance degradation with large item counts
**Mitigation:** Add pagination, implement batch processing, add timeouts

### Risk: Agent still tries to manipulate IDs in response display
**Mitigation:** Phase 2 validation API as safety net, comprehensive testing

### Risk: Breaking change for existing workflows
**Mitigation:** Gradual rollout, maintain backward compatibility during transition period

---

## Alternatives Considered

### Alternative 1: Prompt Engineering Only
**Rejected:** Cannot guarantee numerical accuracy with LLMs

### Alternative 2: Client-side validation
**Rejected:** Still requires passing IDs through LLM, doesn't eliminate root cause

### Alternative 3: Use titles instead of IDs
**Rejected:** Titles can be ambiguous, duplicated, or hallucinated more easily than IDs

### Alternative 4: Manual copy-paste workflow
**Rejected:** Poor user experience, still prone to errors

---

## Conclusion

**Recommendation:** Implement Query Handle Architecture as P0 CRITICAL priority.

This architectural change:
- ✅ Eliminates ID hallucination structurally (not through prompting)
- ✅ Applies universally to ALL bulk modification workflows
- ✅ Backward compatible (existing code continues to work)
- ✅ Improves user experience (simpler, safer workflow)
- ✅ Enhances data integrity (server is source of truth)
- ✅ Enables better auditing (query handles trace operations)
- ✅ Reduces agent complexity (becomes stateless display layer)
- ✅ No new tools needed (enhancement to existing `wit-get-work-items-by-query-wiql`)

**Estimated effort:** 3-4 weeks for full implementation and rollout

**Risk level:** Low (backward compatible, progressive rollout, dry_run by default)

**Impact:** Critical (eliminates entire class of data integrity bugs across ALL workflows)

**Scope:** Universal fix for:
- Dead item removal
- Bulk state transitions
- Bulk assignments
- Bulk comment addition
- Any future bulk operation

---

## Appendix A: API Examples

### Example 1: Query Handle Creation

### Example 1: Query Handle Creation

**Request to Enhanced WIQL:**
```bash
POST /api/work-items/query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProduct\\Backend' AND [System.State] IN ('New', 'Active')",
  "includeFields": ["System.Title", "System.State", "System.AssignedTo"],
  "includeSubstantiveChange": true,
  "return_query_handle": true,
  "query_handle_ttl": 3600,
  "query_handle_name": "backend_new_active_tasks"
}
```

**Response:**
```json
{
  "workItems": [
    {
      "id": 5816697,
      "title": "Move the dsms entries from AzLinux to IMDS service tree",
      "state": "Active",
      "assignedTo": null,
      "daysInactive": 469
    },
    {
      "id": 12476027,
      "title": "Update feature documentation",
      "state": "New",
      "assignedTo": "jane@example.com",
      "daysInactive": 312
    }
  ],
  "count": 2,
  "query_handle": "qh_20251003_142530_abc123",
  "query_handle_expires_at": "2025-10-03T15:25:30.123Z",
  "query_handle_item_count": 2
}
```

### Example 2: Bulk Operation with Query Handle (Removal)

**Step 1: Preview (dry_run=true)**
```bash
POST /api/work-items/bulk-remove-by-handle
{
  "query_handle": "qh_20251003_142530_abc123",
  "target_state": "Removed",
  "removal_reason": "Abandoned - no activity for 180+ days",
  "add_audit_comment": true,
  "dry_run": true
}
```

**Response:**
```json
{
  "query_handle": "qh_20251003_142530_abc123",
  "total_items_in_handle": 2,
  "would_update_count": 2,
  "preview": [
    {
      "id": 5816697,
      "title": "Move the dsms entries from AzLinux to IMDS service tree",
      "current_state": "Active",
      "target_state": "Removed",
      "action": "Active → Removed"
    },
    {
      "id": 12476027,
      "title": "Update feature documentation",
      "current_state": "New",
      "target_state": "Removed",
      "action": "New → Removed"
    }
  ]
}
```

**Step 2: Execute (dry_run=false)**
```bash
POST /api/work-items/bulk-remove-by-handle
{
  "query_handle": "qh_20251003_142530_abc123",
  "target_state": "Removed",
  "removal_reason": "Abandoned - no activity for 180+ days",
  "add_audit_comment": true,
  "dry_run": false
}
```

**Response:**
```json
{
  "query_handle": "qh_20251003_142530_abc123",
  "total_items_in_handle": 2,
  "removed": [
    {
      "id": 5816697,
      "title": "Move the dsms entries from AzLinux to IMDS service tree",
      "removed_at": "2025-10-03T14:26:15.789Z",
      "previous_state": "Active",
      "new_state": "Removed",
      "audit_comment_id": 9876543
    },
    {
      "id": 12476027,
      "title": "Update feature documentation",
      "removed_at": "2025-10-03T14:26:16.123Z",
      "previous_state": "New",
      "new_state": "Removed",
      "audit_comment_id": 9876544
    }
  ],
  "skipped": [],
  "errors": []
}
```

### Example 3: Bulk State Update with Query Handle

```bash
# Query
POST /api/work-items/query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = 'Sprint 42' AND [System.State] = 'New'",
  "return_query_handle": true
}

# Response: query_handle = "qh_sprint42_new"

# Update
POST /api/work-items/bulk-update-by-handle
{
  "query_handle": "qh_sprint42_new",
  "updates": {
    "System.State": "Active",
    "System.Reason": "Started sprint work"
  },
  "dry_run": false
}

# Result: Exact items from query updated to Active state
```

### Example 4: Bulk Assignment with Query Handle

```bash
# Query
POST /api/work-items/query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [Microsoft.VSTS.Common.Priority] = 0 AND [System.AssignedTo] = ''",
  "return_query_handle": true
}

# Response: query_handle = "qh_p0_unassigned_bugs"

# Assign
POST /api/work-items/bulk-assign-by-handle
{
  "query_handle": "qh_p0_unassigned_bugs",
  "assign_to": "jane@example.com",
  "dry_run": false
}

# Result: Exact unassigned P0 bugs assigned to Jane
```

---

## Appendix B: Query Handle Storage Schema

### In-Memory/Redis Cache Structure

```typescript
interface QueryHandleStorage {
  [handle: string]: QueryHandleData;
}

interface QueryHandleData {
  work_item_ids: number[];      // The authoritative ID list
  created_at: string;            // ISO timestamp
  expires_at: string;            // ISO timestamp
  query: string;                 // Original WIQL (for audit/debugging)
  query_name?: string;           // Optional human-readable name
  requested_by?: string;         // User who created the handle
  project: string;               // ADO project
  organization: string;          // ADO organization
}
```

### Redis Implementation Example

```typescript
// Store query handle
await redis.setex(
  `query_handle:${handle}`,
  3600,  // TTL in seconds
  JSON.stringify({
    work_item_ids: [5816697, 12476027],
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    query: "SELECT [System.Id] FROM...",
    query_name: "dead_items_analysis",
    requested_by: "user@example.com",
    project: "MyProject",
    organization: "MyOrg"
  })
);

// Retrieve query handle
const data = await redis.get(`query_handle:${handle}`);
if (!data) {
  throw new Error(`Query handle ${handle} not found or expired`);
}
const handleData = JSON.parse(data);
```

### Audit Log Schema

```sql
CREATE TABLE query_handle_audit (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  query_handle VARCHAR(50) NOT NULL,
  operation VARCHAR(50) NOT NULL,  -- 'created', 'used', 'expired'
  work_item_count INT,
  operation_type VARCHAR(50),      -- 'update', 'remove', 'assign', 'comment'
  requested_by VARCHAR(255),
  project VARCHAR(255),
  organization VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_handle (query_handle),
  INDEX idx_requested_by (requested_by),
  INDEX idx_created_at (created_at)
);

CREATE TABLE bulk_operation_audit (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  query_handle VARCHAR(50) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  work_item_id INT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  field_name VARCHAR(255),
  success BOOLEAN,
  error_message TEXT,
  requested_by VARCHAR(255),
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_handle (query_handle),
  INDEX idx_work_item (work_item_id),
  INDEX idx_executed_at (executed_at)
);
```

---

## Appendix C: Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        LLM AGENT                             │
│  (Stateless - Never manipulates IDs directly)                │
└──────────────┬──────────────────────────────────┬───────────┘
               │                                  │
               │ 1. Query + return_query_handle   │ 4. Bulk operation
               │                                  │    + query_handle
               ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    ENHANCED WIQL API                          │
│  wit-get-work-items-by-query-wiql(return_query_handle=true)  │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ 2. Store: handle → [IDs]
               ▼
┌──────────────────────────────────────────────────────────────┐
│              QUERY HANDLE CACHE (Redis/Memory)                │
│                                                               │
│  qh_abc123 → [5816697, 12476027, 13438317]                   │
│  qh_def456 → [2234567, 3345678]                              │
│  qh_ghi789 → [9876543]                                       │
│                                                               │
│  (Expires after 1 hour)                                       │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ 5. Retrieve IDs from handle
               ▼
┌──────────────────────────────────────────────────────────────┐
│                  BULK OPERATION TOOLS                         │
│                                                               │
│  • wit-bulk-update-by-query-handle                            │
│  • wit-bulk-remove-by-query-handle                            │
│  • wit-bulk-assign-by-query-handle                            │
│  • wit-bulk-comment-by-query-handle                           │
│                                                               │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ 6. Execute operations on IDs from cache
               ▼
┌──────────────────────────────────────────────────────────────┐
│                   AZURE DEVOPS API                            │
│  (Actual work item modifications happen here)                 │
└──────────────────────────────────────────────────────────────┘

KEY INSIGHT: The agent never sees or manipulates work item IDs.
It only passes opaque tokens (query_handle) between API calls.
The server maintains the authoritative ID list throughout.
```

---

## Appendix D: FAQ

**Q: What happens if a query handle expires between preview and execution?**
A: The bulk operation will return an error: "Query handle expired". The user must re-run the query to get a fresh handle. This is by design to prevent stale operations.

**Q: Can users cherry-pick items from a query handle?**
A: Phase 1 operates on all items in the handle. Phase 6 (future) will add filtering support to operate on a subset.

**Q: How much memory does this consume?**
A: Minimal. Each handle stores only an array of integers (4 bytes each). A query with 1000 items = 4KB. With 1 hour TTL and 1000 concurrent handles = 4MB max.

**Q: What if items change state between query and execution?**
A: Set `validate_before_update: true` in bulk operations. The server will re-check each item's state and skip items no longer eligible.

**Q: Does this work with the existing `mcp_ado_wit_update_work_item` tool?**
A: Yes, for backward compatibility. But we recommend migrating to query handle-based bulk operations for hallucination prevention.

**Q: Can query handles be shared across users?**
A: Phase 1: No (bound to creating user). Phase 6: Yes (with proper permissions).

**Q: How do we monitor for hallucination attempts?**
A: Audit logs track all bulk operations. If an agent tries to pass invalid handles or patterns suggest ID manipulation attempts, alerts are triggered.

**Q: What about performance with very large query results (10,000+ items)?**
A: Implement pagination in bulk operations. Process in batches of 100-200 items, with progress reporting back to the agent.

---

## Summary

This proposal solves LLM ID hallucination **universally** by:

1. **Core Enhancement**: Add query handles to existing `wit-get-work-items-by-query-wiql`
2. **New Tools**: Bulk operation tools that accept handles instead of IDs
3. **Architecture**: Server stores IDs, agent passes opaque tokens
4. **Result**: Structurally impossible to hallucinate IDs

**Next Steps:**
1. Review and approve this proposal
2. Create engineering tickets
3. Assign development team
4. Target: 3-4 weeks to production
5. Expected outcome: Zero ID hallucination incidents across ALL workflows
5. Begin Phase 1 development
