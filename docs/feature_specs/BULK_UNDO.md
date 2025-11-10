# Bulk Undo Operations

**Feature Category:** Bulk Operations  
**Status:** ✅ Implemented  
**Version:** 1.7.0  
**Last Updated:** 2025-10-16

## Recent Changes

### Version 1.7.0 (2025-10-16)
**Enhancement:** Added support for undoing all operations on a query handle:
- New `undoAll` parameter (boolean, default: false) to undo all operations instead of just the last one
- Operations undone in reverse chronological order (most recent first)
- Backward compatible: existing calls with no `undoAll` parameter behave identically
- New output fields: `undo_mode`, `operations_attempted`, `operations_undone`, `operations_summary`
- Maintains backward compatible fields `operation_to_undo` and `operation_undone` when `undoAll=false`

### Version 1.6.1 (2025-10-15)
**Bug Fix:** Query handle validation now properly distinguishes between:
- Non-existent or expired query handles (returns "not found or expired" error)
- Valid query handles with no operation history (returns "no bulk operations performed" error)

Previously, the tool would incorrectly report "not found or expired" for valid handles that simply had no operations recorded, causing confusion when testing the undo feature on freshly created handles.

## Overview

The Enhanced ADO MCP Server provides an undo capability for bulk operations performed on query handles. This feature allows users to safely revert changes made to work items through bulk operations - either the last operation only or all operations performed on the handle.

**Tool:** `wit-bulk-undo-by-query-handle`

## Purpose

Enable safe reversal of bulk operations with:
- Automatic tracking of operation history per query handle
- Undo support for comments, updates, assignments, state transitions, and iteration moves
- Dry-run mode to preview undo actions before execution
- Preservation of previous values for accurate rollback
- In-memory operation history (expires with query handle)
- **NEW:** Ability to undo all operations on a query handle (not just the last one)

## Supported Operations

The following bulk operations can be undone:

1. **bulk-comment** - Adds reversal comment (ADO API doesn't support comment deletion)
2. **bulk-update** - Reverts field values to previous state
3. **bulk-assign** - Reverts assignment to previous assignee
4. **bulk-transition** - Reverts state to previous state
5. **bulk-move-iteration** - Reverts iteration path to previous iteration

## Tool: wit-bulk-undo-by-query-handle

Undo bulk operations performed on a query handle (last operation or all operations).

### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-wiql-query

**Optional:**
- `undoAll` (boolean) - Undo all operations performed on this query handle (default: false, only undoes last operation)
- `dryRun` (boolean) - Preview undo operation without making changes (default true)
- `maxPreviewItems` (number) - Maximum items to preview in dry-run (default 10, max 50)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `dryRun` (boolean) - Preview undo operation without making changes (default true)
- `maxPreviewItems` (number) - Maximum items to preview in dry-run (default 10, max 50)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

### Output Format

**Success Response (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "query_handle": "qh_c1b1b9a3...",
    "operation_to_undo": "bulk-update",
    "operation_timestamp": "2024-10-14T10:30:00Z",
    "items_to_revert": 45,
    "preview_items": [
      {
        "work_item_id": 12345,
        "operation_type": "bulk-update",
        "changes_to_revert": {
          "/fields/System.State": {
            "from": "Active",
            "to": "Resolved"
          }
        },
        "undo_actions": [
          "Revert /fields/System.State from \"Resolved\" to \"Active\""
        ]
      }
    ],
    "preview_message": "Showing 10 of 45 items...",
    "summary": "DRY RUN: Would undo bulk-update on 45 work item(s)"
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (Execute):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3...",
    "operation_undone": "bulk-update",
    "operation_timestamp": "2024-10-14T10:30:00Z",
    "items_affected": 45,
    "successful": 45,
    "failed": 0,
    "results": [
      {
        "workItemId": 12345,
        "success": true,
        "operationType": "bulk-update",
        "actionsPerformed": ["Reverted 1 field(s)"]
      }
    ],
    "summary": "Successfully undid bulk-update on 45 of 45 work items"
  },
  "errors": [],
  "warnings": []
}
```

**Error Response (No History):**
```json
{
  "success": false,
  "data": null,
  "errors": [
    "No operation history found for query handle 'qh_c1b1b9a3...'. No actions have been performed on this handle yet."
  ],
  "warnings": []
}
```

**Error Response (Expired Handle):**
```json
{
  "success": false,
  "data": null,
  "errors": [
    "Query handle 'qh_c1b1b9a3...' not found or expired. Query handles expire after 24 hours."
  ],
  "warnings": []
}
```

## Examples

### Example 1: Preview Undo Operation

```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "dryRun": true
}
```

Shows what will be undone without making changes.

### Example 2: Execute Undo

```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "dryRun": false
}
```

Reverts the last operation on all affected work items.

### Example 3: Undo Comment Addition

```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "dryRun": false
}
```

For comments, adds a reversal comment like:
```
🔄 **UNDO:** Previous comment has been reversed.

~~Original comment text~~
```

## Workflow Pattern

### Step 1: Perform Bulk Operation
```json
{
  "tool": "wit-bulk-update-by-query-handle",
  "arguments": {
    "queryHandle": "qh_c1b1b9a3...",
    "updates": [
      {
        "op": "replace",
        "path": "/fields/System.State",
        "value": "Resolved"
      }
    ]
  }
}
```
Operation is automatically tracked for undo.

### Step 2: Preview Undo
```json
{
  "tool": "wit-bulk-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_c1b1b9a3...",
    "dryRun": true
  }
}
```

### Step 3: Execute Undo
```json
{
  "tool": "wit-bulk-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_c1b1b9a3...",
    "dryRun": false
  }
}
```

## Operation History Tracking

### How It Works

1. **Recording Operations**
   - Each bulk operation automatically records:
     - Operation type (e.g., 'bulk-update', 'bulk-comment')
     - Timestamp of operation
     - Work items affected
     - Previous values before changes

2. **Storage**
   - Operation history stored in-memory with query handle
   - Expires when query handle expires (1 hour)
   - Lost if MCP server restarts

3. **History Management**
   - Only the last operation can be undone
   - Successfully undone operations are removed from history
   - Failed undo attempts keep the operation in history

### Supported Undo Actions

| Operation | Undo Action | Notes |
|-----------|-------------|-------|
| bulk-comment | Add reversal comment | Cannot delete comments via ADO API |
| bulk-update | Revert field values | Uses JSON Patch operations |
| bulk-assign | Revert assignment | Restores previous assignee or unassigns |
| bulk-transition | Revert state | Changes state back to previous value |
| bulk-move-iteration | Revert iteration path | Restores previous iteration |

## Limitations

### Comment Deletion
Azure DevOps API does not support deleting comments. When undoing a `bulk-comment` operation:
- A reversal comment is added instead
- Original comment text is shown with strikethrough formatting
- Warning is included in response

### Single Undo Level
- Only the last operation can be undone
- No redo functionality
- No support for undoing multiple operations in sequence

### Handle Expiration
- Operation history expires with query handle (1 hour)
- Server restart clears all operation history
- No persistent undo across sessions

### Partial Failures
- If some items fail to undo, the operation remains in history
- Successfully undone items cannot be re-undone
- Failed items can be retried by running undo again

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Query handle not found or expired" | Handle expired or invalid | Re-query to get fresh handle |
| "No operation history found" | No operations performed yet | Perform a bulk operation first |
| "Work item not found" | Work item deleted | Cannot undo deleted items |
| "State transition not allowed" | Invalid reverse transition | Manual intervention required |
| "Field is read-only" | Cannot modify system field | Cannot undo system field changes |

### Error Recovery

- Partial success: Some items may be undone even if others fail
- Failed items reported with specific error messages
- Operation remains in history for retry if any items failed
- Manual intervention required for state transition failures

## Performance Considerations

- **API Calls**: 1 GET + 1 PATCH/POST per work item
- **Batch Processing**: Processes all items sequentially
- **Memory**: Operation history stored in-memory (minimal overhead)
- **Cleanup**: History automatically cleaned up with query handle

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/bulk-operations/bulk-undo-by-query-handle.handler.ts`
- **Schema:** `src/config/schemas.ts` - `bulkUndoByQueryHandleSchema`
- **Service:** `src/services/query-handle-service.ts` - Operation history tracking
- **Tool Config:** `src/config/tool-configs/bulk-operations.ts`

### Integration Points

- **Query Handle Service** - Stores and retrieves operation history
- **Bulk Operation Handlers** - Automatically record operations for undo
- **Azure DevOps Work Items API** - Performs actual undo operations

### Operation History Structure

```typescript
interface OperationHistoryItem {
  operation: string;  // e.g., 'bulk-comment', 'bulk-update'
  timestamp: string;  // ISO 8601 timestamp
  itemsAffected: Array<{
    workItemId: number;
    changes: Record<string, any>;  // Previous values for rollback
  }>;
}
```

## Testing

### Test Files

- `test/unit/bulk-operations/bulk-undo.test.ts` (to be created)
- `test/integration/bulk-undo-workflow.test.ts` (to be created)

### Test Coverage

- [ ] Undo bulk-comment operation
- [ ] Undo bulk-update operation
- [ ] Undo bulk-assign operation
- [ ] Undo bulk-transition operation
- [ ] Undo bulk-move-iteration operation
- [ ] Dry run mode
- [ ] Error handling (expired handle, no history)
- [ ] Partial success scenarios
- [ ] Handle cleanup after successful undo

### Manual Testing

```bash
# Step 1: Create query handle and perform bulk operation
{
  "tool": "wit-wiql-query",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    "returnQueryHandle": true
  }
}

# Step 2: Perform bulk update
{
  "tool": "wit-bulk-update-by-query-handle",
  "arguments": {
    "queryHandle": "qh_...",
    "updates": [
      {
        "op": "replace",
        "path": "/fields/System.State",
        "value": "Resolved"
      }
    ]
  }
}

# Step 3: Preview undo
{
  "tool": "wit-bulk-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_...",
    "dryRun": true
  }
}

# Step 4: Execute undo
{
  "tool": "wit-bulk-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_...",
    "dryRun": false
  }
}
```

## Configuration

No special configuration required. Uses defaults from `.ado-mcp-config.json`.

## Security Considerations

- Only undoes operations performed via the same query handle
- Requires same Azure DevOps permissions as original operation
- No audit trail beyond operation timestamp
- Cannot undo operations performed outside of MCP server

## Future Enhancements

### Potential Improvements

1. **Multi-level Undo**
   - Support undoing multiple operations in sequence
   - Stack-based operation history

2. **Persistent History**
   - Store operation history in file or database
   - Survive server restarts
   - Cross-session undo support

3. **Redo Functionality**
   - Re-apply undone operations
   - Redo stack management

4. **Selective Undo**
   - Undo specific work items from an operation
   - Item-level undo control

5. **Audit Trail**
   - Detailed logging of undo operations
   - Export operation history
   - Compliance reporting

## Related Features

- [Bulk Operations](./BULK_OPERATIONS.md) - Operations that can be undone
- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe handle-based operations
- [Query Handle Operations](./QUERY_HANDLE_OPERATIONS.md) - Handle management tools

## References

- [Azure DevOps Work Items API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items)
- [JSON Patch RFC](https://datatracker.ietf.org/doc/html/rfc6902)

---

**Last Updated:** 2025-10-14  
**Author:** Enhanced ADO MCP Team
