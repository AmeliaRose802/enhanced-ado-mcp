# Query Handle Operations

**Feature Category:** Query Handle Management  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07

## Overview

The Enhanced ADO MCP Server provides comprehensive query handle management tools for the anti-hallucination pattern:

1. **wit-query-handle-validate** - Validate handle and get metadata
2. **wit-query-handle-inspect** - Detailed inspection with staleness data
3. **wit-query-handle-select** - Preview item selection before bulk ops
4. **wit-query-handle-list** - List all active query handles
5. **wit-analyze-items** - Analyze work items using handle

These tools make query handles feel like persistent, manageable resources rather than ephemeral strings.

## Purpose

Enable safe query handle management with:
- Handle validation before bulk operations
- Staleness data inspection for template substitution
- Item selection preview to prevent wrong-item errors
- Handle lifecycle tracking and cleanup
- Handle-based analysis without ID hallucination

## Tools

### 1. wit-query-handle-validate

Validate a query handle and get metadata about stored query results.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle to validate

**Optional:**
- `includeSampleItems` (boolean) - Fetch first 5 items with titles/states (default false)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "queryHandle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "itemCount": 45,
    "createdAt": "2024-01-20T10:00:00Z",
    "expiresAt": "2024-01-20T11:00:00Z",
    "minutesRemaining": 42,
    "originalQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    "sampleItems": [
      { "id": 12345, "title": "Implement authentication", "state": "Active" },
      { "id": 12346, "title": "Design login UI", "state": "New" }
    ]
  },
  "errors": [],
  "warnings": []
}
```

**Error Response (Expired):**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "reason": "Query handle expired 15 minutes ago"
  },
  "errors": ["Query handle has expired. Re-query to get fresh handle."],
  "warnings": []
}
```

#### Examples

**Example: Check Handle Validity**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "includeSampleItems": true
}
```

### 2. wit-query-handle-inspect

🔍 **HANDLE INSPECTOR:** Detailed inspection including staleness data and analysis metadata.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle to inspect

**Optional:**
- `includePreview` (boolean) - Include first 10 items with context data (default true)
- `includeStats` (boolean) - Include staleness statistics (default true)
- `includeExamples` (boolean) - Include selection examples (default false, saves ~300 tokens)

#### Output Format

**Success Response:**
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
      "staleness_coverage": "100.0%",
      "template_variables_available": [
        "daysInactive",
        "lastSubstantiveChangeDate",
        "title",
        "state",
        "type",
        "assignedTo",
        "id"
      ]
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
    },
    "expiration": {
      "created_at": "2024-01-20T10:00:00Z",
      "expires_at": "2024-01-20T11:00:00Z",
      "minutes_remaining": 42
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Inspect for Template Substitution**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "includePreview": true,
  "includeStats": true
}
```
Shows what template variables are available for bulk comment operations.

### 3. wit-query-handle-select

🎯 **ITEM SELECTOR:** Preview item selection before bulk operations.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle
- `itemSelector` - Selection criteria:
  - `"all"` (string) - Select all items
  - `[0, 1, 2]` (array of numbers) - Zero-based indices
  - Criteria object with:
    - `states` (array of strings) - Filter by states
    - `titleContains` (array of strings) - Filter by title keywords
    - `tags` (array of strings) - Filter by tags
    - `daysInactiveMin` (number) - Min days inactive
    - `daysInactiveMax` (number) - Max days inactive

**Optional:**
- `previewCount` (number) - Items to preview (default 10, max 50)

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3...",
    "total_items_in_handle": 159,
    "selected_count": 45,
    "selection_criteria": {
      "states": ["Active", "New"],
      "daysInactiveMin": 90
    },
    "preview": [
      {
        "index": 0,
        "id": 5816697,
        "title": "Implement user authentication",
        "state": "New",
        "days_inactive": 469,
        "matches": true,
        "match_reason": "State=New, daysInactive=469 (>=90)"
      },
      {
        "index": 1,
        "id": 5816698,
        "title": "Design login UI",
        "state": "Active",
        "days_inactive": 120,
        "matches": true,
        "match_reason": "State=Active, daysInactive=120 (>=90)"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Select by Indices**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": [0, 1, 2, 5, 10],
  "previewCount": 5
}
```
Previews items at indices 0, 1, 2, 5, 10.

**Example 2: Select by State**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": {
    "states": ["Active", "New"]
  }
}
```
Previews only Active and New items.

**Example 3: Select Stale Items**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "itemSelector": {
    "daysInactiveMin": 180
  },
  "previewCount": 20
}
```
Previews items inactive for 180+ days.

### 4. wit-query-handle-list

📋 **HANDLE REGISTRY:** List all active query handles for tracking and management.

#### Input Parameters

**Optional:**
- `includeExpired` (boolean) - Include expired handles (default false)

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "active_handles": [
      {
        "query_handle": "qh_c1b1b9a3...",
        "item_count": 45,
        "created_at": "2024-01-20T10:00:00Z",
        "expires_at": "2024-01-20T11:00:00Z",
        "minutes_remaining": 42,
        "has_staleness_data": true
      },
      {
        "query_handle": "qh_d2c2c0b4...",
        "item_count": 12,
        "created_at": "2024-01-20T10:15:00Z",
        "expires_at": "2024-01-20T11:15:00Z",
        "minutes_remaining": 57,
        "has_staleness_data": false
      }
    ],
    "expired_handles": [],
    "total_active": 2,
    "total_expired": 0,
    "cleanup_suggestion": "2 active handles will auto-expire"
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: List Active Handles**
```json
{
  "includeExpired": false
}
```

### 5. wit-analyze-items

🔐 **HANDLE-BASED ANALYSIS:** Analyze work items using handle to prevent ID hallucination.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle
- `analysisType` (array) - Analysis types to perform:
  - `"effort"` - Story Points breakdown
  - `"velocity"` - Completion trends
  - `"assignments"` - Team workload distribution
  - `"risks"` - Blockers and stale items
  - `"completion"` - State distribution
  - `"priorities"` - Priority breakdown

**Optional:**
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3...",
    "item_count": 45,
    "analyses": {
      "effort": {
        "total_story_points": 123,
        "estimated_items": 38,
        "unestimated_items": 7,
        "average_points": 3.24,
        "distribution": {
          "1-3 points": 18,
          "4-8 points": 15,
          "9+ points": 5
        }
      },
      "completion": {
        "state_distribution": {
          "Active": 25,
          "New": 15,
          "Resolved": 5
        },
        "completion_percentage": 11.1
      },
      "risks": {
        "high_risk_count": 3,
        "medium_risk_count": 8,
        "low_risk_count": 34,
        "blocked_items": 1,
        "stale_items": 5
      }
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Sprint Analysis**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "analysisType": ["effort", "completion", "assignments", "risks"]
}
```
Comprehensive sprint planning analysis.

## Workflow Pattern

### Step 1: Create Query Handle
```json
{
  "tool": "wit-query-wiql",
  "arguments": {
    "wiqlQuery": "...",
    "includeSubstantiveChange": true,
    "returnQueryHandle": true
  }
}
```

### Step 2: Inspect Handle
```json
{
  "tool": "wit-query-handle-inspect",
  "arguments": {
    "queryHandle": "qh_...",
    "includePreview": true,
    "includeStats": true
  }
}
```

### Step 3: Preview Selection
```json
{
  "tool": "wit-query-handle-select",
  "arguments": {
    "queryHandle": "qh_...",
    "itemSelector": { "states": ["Active"] }
  }
}
```

### Step 4: Execute Bulk Operation
```json
{
  "tool": "wit-bulk-comment",
  "arguments": {
    "queryHandle": "qh_...",
    "comment": "..."
  }
}
```

## Handle Lifecycle & Cleanup

### Handle Creation and Expiration

Query handles are temporary, in-memory references to work item query results:

**Creation:**
- Generated when querying with `returnQueryHandle: true`
- Format: `qh_<32-character-hex-string>`
- Stores work item IDs and optional context (staleness, titles, etc.)
- Timestamp of creation and expiration recorded

**Default Expiration:**
- **TTL (Time-To-Live):** 24 hours from creation (default)
- **Maximum TTL:** 48 hours (configurable, rarely needed)
- **Why 24 hours?** Balances memory usage with practical workflow needs

**Example Timeline:**
```
10:00 AM - Handle created: qh_abc123...
10:30 AM - Used for bulk comment (still valid)
11:30 AM - Used for bulk update (still valid)
10:00 AM next day - Handle expires (24 hours elapsed)
10:01 AM next day - Operations fail: "Query handle expired"
```

### Why Handles Expire

**1. Memory Management**
- Each handle stores work item IDs in server memory
- 100 handles × 200 items each = ~50KB RAM
- Without expiration, memory grows unbounded
- Risk: Server slowdown or crash with thousands of stale handles

**2. Data Freshness**
- Work items change frequently (state, assignment, etc.)
- 24-hour-old handle may contain outdated item lists
- Forced refresh ensures current data

**3. Security**
- Handles are session-specific but persist in memory
- Expiration limits exposure window
- Prevents accumulation of old handles with potentially sensitive IDs

**4. Best Practice Enforcement**
- Encourages atomic workflows (query → analyze → act)
- Discourages long-running processes with stale references
- Aligns with agent conversation patterns

### Automatic Cleanup

The server performs automatic cleanup of expired handles:

**Cleanup Schedule:**
- **Interval:** Every 5 minutes
- **Process:** Background task scans all handles
- **Action:** Deletes handles where `expiresAt < currentTime`
- **Impact:** Zero performance impact (runs during idle cycles)

**Cleanup Process:**
```typescript
// Runs automatically every 5 minutes
function cleanup() {
  const now = new Date();
  let deletedCount = 0;
  
  for (const [handle, data] of handles.entries()) {
    if (now > data.expiresAt) {
      handles.delete(handle);
      deletedCount++;
    }
  }
  
  logger.debug(`Cleaned up ${deletedCount} expired query handles`);
}
```

**What Gets Cleaned:**
- Expired handles (past TTL)
- Associated operation history (undo tracking)
- Stored work item context data

**What's Preserved:**
- Active handles (not yet expired)
- Handles created in last 24 hours
- All Azure DevOps data (only handle removed, not actual work items)

**Startup Behavior:**
- Cleanup starts when MCP server starts
- Runs continuously until server shutdown
- Cannot be disabled (protects against memory leaks)

**Memory Impact:**
```
Before Cleanup: 150 handles (50 expired) = 75KB RAM
After Cleanup:  100 handles (0 expired)  = 50KB RAM
Savings:        33% memory reduction
```

### Manual Handle Management

#### Checking Handle Validity

Before using a handle, check if it's still valid:

```json
{
  "tool": "inspect-handle",
  "arguments": {
    "queryHandle": "qh_abc123...",
    "detailed": true
  }
}
```

**Response includes expiration info:**
```json
{
  "expiration": {
    "created_at": "2025-11-18T10:00:00Z",
    "expires_at": "2025-11-19T10:00:00Z",
    "minutes_remaining": 1380  // 23 hours left
  }
}
```

**Expiration Warnings:**
- **< 30 minutes remaining:** Warning logged when accessing handle
- **Expired:** Returns `null` when trying to retrieve work items
- **Not found:** Handle never existed or already cleaned up

#### Listing Active Handles

Track all your active query handles:

```json
{
  "tool": "list-handles",
  "arguments": {
    "includeExpired": false
  }
}
```

**Response shows all handles with status:**
```json
{
  "active_handles": [
    {
      "query_handle": "qh_abc123...",
      "item_count": 47,
      "created_at": "2025-11-18T10:00:00Z",
      "expires_at": "2025-11-19T10:00:00Z",
      "minutes_remaining": 1380
    }
  ],
  "total_active": 1,
  "total_expired": 0
}
```

#### Manual Deletion

Rarely needed, but you can delete handles manually:

**Use Cases:**
- Finished with bulk operations early
- Want to free memory immediately
- Need to regenerate handle with fresh data

**Not Exposed via MCP Tools:**
Manual deletion is an internal operation. To "delete" a handle:
1. Simply stop using it
2. Wait for automatic cleanup (max 5 minutes after expiration)
3. Or re-query to get a fresh handle (old one ignored)

### Refreshing Handles (Advanced)

**Not currently exposed via MCP, but available in service layer:**

For long-running workflows, you could extend handle TTL:

```typescript
// Internal API (not exposed to agents)
queryHandleService.refreshHandle('qh_abc123', 30);  // Extend 30 minutes
```

**Why this isn't exposed:**
- Encourages better workflow design (query fresh data)
- Prevents stale data issues
- Simpler mental model for agents
- Automatic cleanup works better with predictable expiration

**Recommended Instead:**
Re-query to get fresh handle with current data:

```json
// After 23 hours, instead of refreshing:
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "<same query as before>",
    "returnQueryHandle": true
  }
}
```

### Handle Persistence

**Important Limitation: Handles are not persistent**

**What this means:**
- Handles stored in **memory only** (not database)
- Server restart = **all handles lost**
- Cannot share handles across MCP server instances
- Cannot resume workflows after server restart

**Example:**
```
10:00 AM - Create handle: qh_abc123
10:30 AM - Use handle successfully
10:45 AM - Server restarts (maintenance)
10:50 AM - Try to use qh_abc123 → ERROR: Handle not found
```

**Recovery:**
```json
// Re-run the original query
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "<original query>",
    "returnQueryHandle": true
  }
}
// New handle: qh_def456
```

**Why No Persistence?**
- Simplicity: No database dependency
- Performance: Memory access is instant
- Security: Sensitive data not written to disk
- Cleanup: Automatic on restart
- Design: Handles meant for short workflows

### Memory Footprint

**Per Handle Storage:**
```typescript
Base handle: ~200 bytes
+ Work item IDs: ~8 bytes per ID
+ Context data: ~100-500 bytes per item (if includeSubstantiveChange)
+ Metadata: ~100 bytes

Example:
100 items with context = 200 + 800 + 50,000 + 100 = ~51 KB
100 items without context = 200 + 800 + 100 = ~1.1 KB
```

**Server Capacity:**
```
Typical MCP Server: 512 MB - 1 GB available RAM

With context data:
- 1000 handles × 50 KB = 50 MB (10% of 512 MB)

Without context data:
- 1000 handles × 1 KB = 1 MB (0.2% of 512 MB)

Conclusion: Memory is not a practical constraint
```

**Optimization:**
Context data (staleness, titles) is optional:
- Use `includeSubstantiveChange: true` only when needed
- Basic handles (IDs only) use minimal memory
- 24-hour expiration keeps memory stable

### Best Practices

#### ✅ DO

1. **Check expiration before reuse**
   ```json
   // After delays or long analysis
   { "tool": "inspect-handle", "arguments": { "queryHandle": "qh_..." } }
   ```

2. **Re-query when expired**
   ```json
   // Don't try to "fix" expired handle, just re-query
   { "tool": "query-wiql", "arguments": { "wiqlQuery": "...", "returnQueryHandle": true } }
   ```

3. **Use handles within same workflow**
   ```
   Same conversation:
   1. Query → Get handle
   2. Inspect handle
   3. Execute bulk operation
   4. All within minutes/hours
   ```

4. **Include context when needed**
   ```json
   // For staleness analysis
   { "includeSubstantiveChange": true, "returnQueryHandle": true }
   ```

#### ❌ DON'T

1. **Don't store handles for later**
   ```javascript
   // ❌ WRONG - Handle will expire
   const handle = await query();
   // ... 2 days later ...
   await bulkOperation(handle);  // ERROR: Expired
   ```

2. **Don't try to persist handles**
   ```javascript
   // ❌ WRONG - Handles are session-specific
   saveToFile(queryHandle);  // Won't work after server restart
   ```

3. **Don't assume handles survive restarts**
   ```javascript
   // ❌ WRONG - All handles lost on restart
   // Before restart: qh_abc123 (valid)
   // After restart: qh_abc123 (not found)
   ```

4. **Don't skip dry-run for old handles**
   ```json
   // ❌ WRONG - Data may be stale
   { "queryHandle": "<20-hour-old-handle>", "dryRun": false }
   
   // ✅ CORRECT - Preview first
   { "queryHandle": "<20-hour-old-handle>", "dryRun": true }
   ```

### Troubleshooting Handle Issues

#### Issue: "Query handle not found"

**Symptoms:**
```json
{
  "success": false,
  "errors": ["Query handle 'qh_abc123' not found"]
}
```

**Causes:**
1. **Never existed** - Typo in handle string
2. **Expired** - Created >24 hours ago
3. **Server restarted** - All handles lost
4. **Already cleaned up** - Expired + cleanup ran

**Diagnosis:**
```json
// Check if handle exists
{ "tool": "list-handles", "arguments": { "includeExpired": false } }

// Check server uptime (in logs)
"Query Handle Service initialized at 2025-11-18T12:00:00Z"
```

**Resolution:**
Re-run the original query:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "<original query>",
    "returnQueryHandle": true
  }
}
```

#### Issue: "Query handle expired"

**Symptoms:**
```json
{
  "success": false,
  "errors": ["Query handle expired 15 minutes ago"]
}
```

**Causes:**
- Handle created >24 hours ago
- Long-running analysis workflow
- Forgot about handle between sessions

**Diagnosis:**
```json
{
  "tool": "inspect-handle",
  "arguments": {
    "queryHandle": "qh_abc123",
    "detailed": true
  }
}
// Shows: "minutes_remaining": -15 (negative = expired)
```

**Resolution:**
Get fresh handle:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "<same query>",
    "returnQueryHandle": true
  }
}
```

#### Issue: "Handle has no staleness data"

**Symptoms:**
```
Template variable {daysInactive} not substituted
```

**Cause:**
Query created without `includeSubstantiveChange: true`

**Diagnosis:**
```json
{
  "tool": "inspect-handle",
  "arguments": { "queryHandle": "qh_abc123" }
}
// Shows: "staleness_analysis_included": false
```

**Resolution:**
Re-query with staleness data:
```json
{
  "tool": "query-wiql",
  "arguments": {
    "wiqlQuery": "...",
    "includeSubstantiveChange": true,
    "returnQueryHandle": true
  }
}
```

#### Issue: "Too many handles active"

**Symptoms:**
Server using excessive memory

**Diagnosis:**
```json
{ "tool": "list-handles", "arguments": {} }
// Shows: "total_active": 500
```

**Causes:**
- Creating handles in loops
- Not reusing handles
- Very long workflow

**Resolution:**
1. **Reuse handles:**
   ```javascript
   // ✅ GOOD - One handle, multiple operations
   const handle = await query();
   await bulkComment(handle);
   await bulkUpdate(handle);
   await bulkAssign(handle);
   
   // ❌ BAD - Three handles for same data
   const h1 = await query();
   await bulkComment(h1);
   const h2 = await query();  // Unnecessary
   await bulkUpdate(h2);
   ```

2. **Wait for cleanup:**
   - Automatic cleanup runs every 5 minutes
   - Old handles will expire and be removed

3. **Restart server if critical:**
   - Clears all handles immediately
   - Only for emergency situations

### When to Use Handles vs Direct IDs

**✅ Use Query Handles When:**
- Bulk operations (2+ items)
- User says "update those items"
- Risk of ID hallucination
- Need item selection (by index, criteria)
- Want audit trail (operation history)

**❌ Use Direct IDs When:**
- Single work item operation
- User provides specific ID: "Update work item 12345"
- Reading/querying only (no modifications)
- Creating new work items

**Example Decision Tree:**
```
User request: "Remove those stale items"
↓
Multiple items? YES
↓
Use query handle:
1. query-wiql (returnQueryHandle: true)
2. inspect-handle (verify)
3. execute-bulk-operations (itemSelector)
```

## Configuration

No special configuration required. Query handles managed in-memory by server.

**Default Settings:**
- Default TTL: 24 hours
- Max TTL: 48 hours
- Cleanup interval: 5 minutes
- Expiration warning: 30 minutes before expiry

**Server Startup Log:**
```
Query Handle Service initialized at 2025-11-18T10:00:00Z
Query handle expiration: 1440 minutes (max: 2880 minutes)
```

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Query handle not found" | Invalid or expired handle | Re-query to get fresh handle |
| "Query handle expired" | Handle older than 1 hour | Re-query to get fresh handle |
| "Invalid item selector" | Malformed selection criteria | Check selector format |
| "No items match criteria" | Selection criteria too strict | Broaden criteria |

### Error Recovery

- Expired handles: Re-query to get fresh handle
- Invalid selectors: Provides detailed error messages
- Empty selections: Returns count of 0 with explanation

## Performance Considerations

- Query handles stored in-memory (max 1 hour)
- Handle inspection: 0 API calls (reads from memory)
- Item selection: 0 API calls (filters cached data)
- Handle validation: 0 API calls (checks memory)
- Analysis: 0-1 API calls (depends on cached data)

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/query-handles/*.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/query-handle-service.ts`

### Integration Points

- **Query Handle Service** - In-memory handle storage and lifecycle
- **Item Selection Logic** - Filtering and preview generation

## Testing

### Test Files

- `test/unit/query-handles/*.test.ts`
- `test/integration/query-handle-lifecycle.test.ts`

### Test Coverage

- [x] Handle validation (valid, expired, invalid)
- [x] Handle inspection with staleness data
- [x] Item selection (all, indices, criteria)
- [x] Handle listing and cleanup
- [x] Handle-based analysis

### Manual Testing

```bash
# Create handle
# Then inspect it
{
  "tool": "wit-query-handle-inspect",
  "arguments": {
    "queryHandle": "qh_test..."
  }
}
```

## Related Features

- [Query Tools](./QUERY_TOOLS.md) - Creating query handles
- [Bulk Operations](./BULK_OPERATIONS.md) - Using handles for bulk ops
- [Enhanced Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Architecture

## References

- [Query Handle Pattern Documentation](./ENHANCED_QUERY_HANDLE_PATTERN.md)
- [Anti-Hallucination Architecture](../ARCHITECTURE.md#query-handle-service)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
