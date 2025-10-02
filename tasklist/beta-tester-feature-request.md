As an AI agent working on backlog hygiene, here's my honest feedback on the enhanced-ado MCP server:

## Tools That Would Significantly Improve This Workflow

### 1. **Bulk State Transition Tool** ⭐⭐⭐⭐⭐
**Critical Need:** I had to update ONE work item at a time. For backlog hygiene, I might need to move 10-20 items to "Removed" state.

**Desired Tool:**
```typescript
mcp_ado_wit_bulk_update_state({
  workItemIds: [12476027, 5816697, 13438317],
  newState: "Removed",
  comment: "Automated backlog hygiene...",
  reason: "Removed from the backlog"
})
```

**Why:** The current workflow requires N tool calls for N items. This is slow, expensive, and prone to partial failures.

---

### 2. **Enhanced WIQL with Computed Metrics** ⭐⭐⭐⭐⭐
**Current Pain:** The WIQL tool returns raw data, but I had to:
- Make ANOTHER batch call to get ChangedDate
- Calculate "days inactive" manually for 200 items
- Re-query to get descriptions

**Desired Enhancement:**
```typescript
mcp_ado_wit_get_work_items_by_query_wiql({
  wiqlQuery: "SELECT...",
  computedFields: {
    daysInactive: true,        // Auto-calculate from ChangedDate
    daysSinceCreated: true,
    hasDescription: true,       // Boolean if desc > 50 chars
    isStale: { threshold: 180 } // Pre-computed staleness flag
  },
  includeAllFields: true  // Don't make me specify every field
})
```

**Why:** I made 3 separate API calls to assemble data that should be in ONE response. This tripled latency and token usage.

---

### 3. **Bulk Comment Addition** ⭐⭐⭐⭐
**Current:** Adding comments to multiple work items = multiple sequential calls

**Desired:**
```typescript
mcp_ado_wit_add_comments_bulk({
  items: [
    { workItemId: 123, comment: "..." },
    { workItemId: 456, comment: "..." }
  ],
  format: "markdown"
})
```

---

### 4. **Work Item Age/Staleness Query Helper** ⭐⭐⭐⭐⭐
**Problem:** WIQL doesn't support date arithmetic. I can't write:
```sql
WHERE DATEDIFF(day, [System.ChangedDate], GETDATE()) > 180
```

**Desired Tool:**
```typescript
mcp_ado_wit_find_stale_items({
  project: "One",
  areaPath: "One\\Azure Compute\\...",
  maxInactiveDays: 180,
  excludeStates: ["Done", "Completed", "Closed", "Resolved"],
  includeSignals: true  // Returns why each item is flagged
})
```

**Why:** This is THE core use case for backlog hygiene. Forcing agents to manually calculate staleness is inefficient.

---

### 5. **Batch Get with Relationship Context** ⭐⭐⭐⭐
**Current Problem:** `get_work_items_batch_by_ids` returns flat data. For hygiene analysis, I need:
- Parent/child relationships
- Linked PRs/commits (shows activity)
- Comment count (signals engagement)

**Desired:**
```typescript
mcp_ado_wit_get_work_items_batch_by_ids({
  ids: [...],
  fields: [...],
  includeRelations: {
    parent: true,
    children: true,
    linkedPRs: true,
    commentCount: true
  }
})
```

**Why:** The existing `get-work-item-context-package` is for ONE item. I need this for 50+ items efficiently.

---

### 6. **Query by Multiple Criteria (Not Just WIQL)** ⭐⭐⭐
**Current:** WIQL is powerful but verbose. For common patterns, simpler API would help:

**Desired:**
```typescript
mcp_ado_wit_query_by_criteria({
  project: "One",
  areaPath: "One\\...",
  filters: {
    state: { notIn: ["Done", "Completed"] },
    changedDate: { olderThan: "180d" },
    assignedTo: { empty: true },
    hasDescription: false
  },
  limit: 200
})
```

**Why:** Saves me from constructing complex WIQL strings. The server can optimize the query.

---

### 7. **"Dry Run" Mode for Bulk Operations** ⭐⭐⭐⭐⭐
**Critical for Production Use:**
```typescript
mcp_ado_wit_bulk_update_state({
  workItemIds: [...],
  newState: "Removed",
  dryRun: true  // Returns what WOULD happen without actually doing it
})
```

**Why:** I was nervous making the actual state change. A dry-run mode would show:
- Which items would be updated
- Any validation errors
- Permission issues
- Before actually modifying production data

---

### 8. **Better Error Handling in Responses** ⭐⭐⭐
**Current:** When a tool fails, the error message is sometimes cryptic.

**Desired:** Return structured errors:
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "User lacks permission to change state to 'Removed'",
    "workItemId": 12476027,
    "suggestedAction": "Request 'Contributor' role for area path",
    "documentation": "https://aka.ms/ado-permissions"
  }
}
```

---

### 9. **Work Item History/Activity Summary** ⭐⭐⭐⭐
**Missing Capability:** I couldn't easily see:
- Last comment date (different from ChangedDate)
- Number of state transitions
- Recent assignee changes

**Desired:**
```typescript
mcp_ado_wit_get_activity_summary({
  workItemId: 12476027,
  includeMetrics: {
    lastCommentDate: true,
    stateTransitionCount: true,
    assigneeChangeCount: true,
    lastMeaningfulActivity: true  // Excludes automated updates
  }
})
```

**Why:** ChangedDate might be a bot updating tags. Real human activity is a better staleness signal.

---

### 10. **Template-Based Commenting** ⭐⭐⭐
**For Bulk Operations:**
```typescript
mcp_ado_wit_add_comment_from_template({
  workItemIds: [...],
  template: "backlog_hygiene_removal",
  variables: {
    analysisDate: "2025-10-01",
    daysInactive: "{{computed}}",  // Auto-fill per item
    reportPath: "..."
  }
})
```

**Why:** I wrote the same comment structure. Templates would ensure consistency.

---

## Critical Issues Encountered

### ❌ **No Way to Filter WIQL Results Server-Side**
The initial query returned 200 items, but I only needed ~69 after filtering out completed states. The server should filter before returning.

### ❌ **Token Inefficiency** 
Getting basic staleness data required:
1. WIQL query (26K tokens)
2. Batch get details (61K tokens)
3. Manual calculation
Total: ~87K tokens for what could be ONE optimized call

### ❌ **No Batch Operations**
Everything is one-at-a-time. For enterprise backlog hygiene (100s of items), this doesn't scale.

---

## What Worked Well ✅

1. **WIQL flexibility** - Powerful for complex queries
2. **Work item update tool** - Clean API, worked perfectly
3. **Comment formatting** - Markdown support is great
4. **Error messages** - Generally clear (though could be better)

---

## Priority Ranking for Implementation

1. 🔥 **Bulk state transitions** (most urgent)
2. 🔥 **Enhanced WIQL with computed fields** (biggest efficiency gain)
3. 🔥 **Stale item finder** (purpose-built for this use case)
4. ⚡ **Dry-run mode** (critical for production confidence)
5. ⚡ **Batch comments**
6. 💡 **Activity summary tool**
7. 💡 **Improved error handling**
8. 💡 **Query by criteria helper**

---

## Bottom Line

The server is **functional** but designed for **human-driven scenarios**, not **agent-driven bulk operations**. For an AI doing backlog hygiene at scale, I need:
- **Batching** (1 call instead of N)
- **Server-side computation** (staleness, metrics)
- **Safety nets** (dry-run, better errors)
- **Purpose-built queries** (not just generic WIQL)

The gap between "works" and "works efficiently at scale" is significant. These improvements would make agent-driven backlog management 10x more practical.