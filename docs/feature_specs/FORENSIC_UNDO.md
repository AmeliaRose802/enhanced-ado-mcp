# Forensic Undo Operations

**Feature Category:** Bulk Operations  
**Status:** ✅ Implemented  
**Version:** 1.11.0  
**Last Updated:** 2025-10-29

## Overview

The Forensic Undo tool provides deterministic recovery from bulk work item changes by analyzing Azure DevOps revision history directly. Unlike the standard undo tool which only tracks operations made through the MCP server, this tool can detect and revert changes made through ANY interface (web UI, REST API, other tools) by examining work item revision history.

**Tool:** `wit-forensic-undo-by-query-handle`

## Purpose

Enable forensic analysis and recovery from work item changes with:
- **Direct revision history analysis** - Examines ADO revision history, not MCP operation tracking
- **User-based filtering** - Identify changes made by specific users
- **Time-based filtering** - Detect changes within a specific time window
- **Smart revert detection** - Only reverts items that haven't been manually fixed
- **Multi-change type support** - Handles type changes, state changes, field updates, and link operations
- **Deterministic operation** - Guarantees correct reverts by comparing current state with original state

## Use Cases

1. **Bulk mistake recovery** - Undo accidental bulk changes made in ADO web UI
2. **Migration rollback** - Revert changes from a failed migration script
3. **User error correction** - Fix mistakes made by a specific team member
4. **Time-based rollback** - Revert all changes made during a specific time window
5. **Selective field recovery** - Only revert specific field changes

## Tool: wit-forensic-undo-by-query-handle

Analyzes work item revision history and reverts detected changes.

### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-wiql-query containing work items to analyze

**Optional Filters:**
- `changedBy` (string) - Filter changes by user (display name or email, case-insensitive partial match)
- `afterTimestamp` (string) - Only detect changes after this ISO timestamp (e.g., '2025-10-28T10:00:00Z')
- `beforeTimestamp` (string) - Only detect changes before this ISO timestamp (e.g., '2025-10-29T18:00:00Z')
- `maxRevisions` (number) - Maximum revisions to analyze per work item (default 50, max 200)

**Detection Options:**
- `detectTypeChanges` (boolean) - Detect work item type changes (default true)
- `detectStateChanges` (boolean) - Detect state transitions (default true)
- `detectFieldChanges` (boolean) - Detect field value changes (default true)
- `detectLinkChanges` (boolean) - Detect parent/child link changes (default false, requires additional API calls)
- `fieldPaths` (string[]) - Specific field paths to check (e.g., ['System.AssignedTo', 'System.Tags']). If not specified, checks all fields.

**Execution Options:**
- `dryRun` (boolean) - Preview forensic analysis and revert actions without making changes (default true)
- `maxPreviewItems` (number) - Maximum items to preview in dry-run (default 10)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

### How It Works

1. **Fetch Revisions** - Retrieves revision history for each work item (up to `maxRevisions`)
2. **Apply Filters** - Filters revisions by user (`changedBy`) and time range (`afterTimestamp`/`beforeTimestamp`)
3. **Detect Changes** - Identifies type changes, state changes, and field modifications
4. **Compare Current State** - Checks if the current value matches the unwanted change or has been manually reverted
5. **Determine Reverts** - Only marks changes as needing revert if current state still has the unwanted value
6. **Execute Reverts** (if not dry-run) - Applies JSON Patch operations to revert detected changes

### Output Format

**Success Response (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "query_handle": "qh_forensic_123...",
    "analysis_summary": {
      "work_items_analyzed": 50,
      "changes_detected": 87,
      "changes_needing_revert": 45,
      "already_reverted": 42,
      "items_needing_revert": 23
    },
    "filters_applied": {
      "changed_by": "john.doe",
      "after_timestamp": "2025-10-28T10:00:00Z",
      "before_timestamp": "2025-10-29T18:00:00Z",
      "max_revisions": 50,
      "detect_type_changes": true,
      "detect_state_changes": true,
      "detect_field_changes": true,
      "detect_link_changes": false,
      "field_paths": "all fields"
    },
    "preview_items": [
      {
        "work_item_id": 12345,
        "current_type": "Bug",
        "current_state": "Active",
        "changes_detected": 3,
        "changes_needing_revert": 2,
        "already_reverted": 1,
        "revert_actions": [
          "Revert type from Bug to Task (changed in rev 45 by john.doe)",
          "Revert state from Active to New (changed in rev 46 by john.doe)"
        ]
      }
    ],
    "preview_message": "Showing 10 of 23 items needing revert...",
    "summary": "DRY RUN: Would revert 45 change(s) across 23 work item(s). 42 change(s) already reverted manually."
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
    "query_handle": "qh_forensic_123...",
    "analysis_summary": {
      "work_items_analyzed": 50,
      "changes_detected": 87,
      "changes_needing_revert": 45,
      "already_reverted": 42,
      "items_needing_revert": 23
    },
    "revert_summary": {
      "items_attempted": 23,
      "items_successful": 23,
      "items_failed": 0,
      "total_changes_reverted": 45
    },
    "results": [
      {
        "workItemId": 12345,
        "success": true,
        "changesReverted": 2,
        "actionsPerformed": [
          "Reverted type from Bug to Task",
          "Reverted state from Active to New"
        ]
      }
    ],
    "summary": "Reverted 45 change(s) across 23 of 23 work item(s). 42 change(s) already reverted manually."
  },
  "errors": [],
  "warnings": []
}
```

## Examples

### Example 1: Analyze All Changes by User

```json
{
  "queryHandle": "qh_affected_items...",
  "changedBy": "john.doe",
  "dryRun": true
}
```

Analyzes all work items in the query handle for changes made by "john.doe" and shows what would be reverted.

### Example 2: Time-Window Recovery

```json
{
  "queryHandle": "qh_area_items...",
  "afterTimestamp": "2025-10-28T14:30:00Z",
  "beforeTimestamp": "2025-10-28T16:00:00Z",
  "dryRun": true
}
```

Detects all changes made between 2:30 PM and 4:00 PM on October 28th.

### Example 3: Specific Field Recovery

```json
{
  "queryHandle": "qh_items...",
  "changedBy": "jane.smith",
  "fieldPaths": ["System.AssignedTo", "System.IterationPath"],
  "detectTypeChanges": false,
  "detectStateChanges": false,
  "dryRun": true
}
```

Only detects and reverts assignment and iteration path changes made by jane.smith.

### Example 4: Execute Forensic Undo

```json
{
  "queryHandle": "qh_affected_items...",
  "changedBy": "john.doe",
  "afterTimestamp": "2025-10-28T10:00:00Z",
  "dryRun": false
}
```

Executes the revert operation for all detected changes.

## Workflow Pattern

### Step 1: Query for Potentially Affected Items

```json
{
  "tool": "wit-wiql-query",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.ChangedDate] >= '2025-10-28'",
    "returnQueryHandle": true
  }
}
```

### Step 2: Preview Forensic Analysis

```json
{
  "tool": "wit-forensic-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_...",
    "changedBy": "john.doe",
    "afterTimestamp": "2025-10-28T10:00:00Z",
    "dryRun": true
  }
}
```

### Step 3: Execute Forensic Undo

```json
{
  "tool": "wit-forensic-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_...",
    "changedBy": "john.doe",
    "afterTimestamp": "2025-10-28T10:00:00Z",
    "dryRun": false
  }
}
```

## Smart Revert Detection

The tool is **deterministic** and **safe** because it:

1. **Compares against baseline state** - Establishes the state before time window and compares current state to baseline
2. **Detects self-reverted changes** - If user makes a change and then manually fixes it, recognizes it as net-zero
3. **Filters non-substantial changes** - Automatically skips administrative changes like:
   - `System.IterationPath` (bulk sprint assignments)
   - `System.AreaPath` (bulk area reassignments)  
   - `Microsoft.VSTS.Common.StackRank` (automated backlog reordering)
   - `Microsoft.VSTS.Common.BacklogPriority` (automated priority recalculation)
   - Board column metadata and internal ADO tracking fields
4. **Prevents double-reverts** - Won't revert changes that have already been undone
5. **Handles partial reverts** - If some fields were manually fixed, only reverts remaining issues

### Self-Revert Detection Example:
- **Rev 10**: User changed Type from Feature → Product Backlog Item (mistake)
- **Rev 11**: User changed Type from Product Backlog Item → Feature (self-correction)
- **Current State**: Feature (matches state before Rev 10)
- **Tool Action**: ✅ No revert needed - recognizes self-correction

### Filtered Administrative Changes:
- Bulk iteration path updates (e.g., moving 50 items to new sprint)
- Area path reorganization (e.g., team restructuring)
- Automated stack rank adjustments
- Board column metadata updates
- These changes are **detected but not reported** as they don't represent intentional work item modifications

### Partial Revert Example:
- User changed Type from Task → Bug and State from New → Active
- Someone manually fixed State back to New
- Forensic undo will:
  - ✅ Revert Type (still Bug, needs revert)
  - ❌ Skip State (already reverted to New, no action needed)

## Supported Change Types

| Change Type | Detection | Revert Action | Notes |
|-------------|-----------|---------------|-------|
| Type Change | ✅ Yes | Replace System.WorkItemType | Reverts to original type |
| State Change | ✅ Yes | Replace System.State | Reverts to original state |
| Field Update | ✅ Yes | Replace or Remove field | Handles all writable fields |
| Link Add | ⚠️ Limited | Remove added link | Requires additional API calls |
| Link Remove | ⚠️ Limited | Re-add removed link | Requires additional API calls |

## Limitations

### Link Change Detection
- Full link change detection requires separate API calls per revision
- `detectLinkChanges` defaults to false for performance
- When enabled, may significantly increase API calls and execution time
- Link revert operations require fetching current relations separately

### Read-Only Fields
- Cannot revert system fields: `System.Id`, `System.Rev`, `System.CreatedDate`, `System.CreatedBy`, `System.ChangedDate`, `System.ChangedBy`, `System.RevisedDate`
- These fields are automatically skipped during analysis

### Revision History Limits
- Maximum 200 revisions per work item can be analyzed
- Older changes beyond `maxRevisions` won't be detected
- If work item has >200 revisions, increase `maxRevisions` parameter

### State Transition Rules
- ADO may prevent certain state transitions
- If revert violates workflow rules, item will be marked as failed
- Manual intervention required for invalid state transitions

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Query handle not found or expired" | Handle expired or invalid | Re-query to get fresh handle |
| "Query handle contains no work items" | Empty result set | Check WIQL query |
| "Work item not found" | Work item deleted | Cannot revert deleted items |
| "State transition not allowed" | Invalid reverse transition | Manual intervention required |
| "Field is read-only" | Cannot modify system field | Field automatically skipped |

### Error Recovery

- **Partial success**: Some items may revert successfully even if others fail
- **Failed items reported**: Specific error messages for each failed item
- **Retry capability**: Can re-run with same parameters to retry failed items
- **Manual intervention**: Some failures require manual ADO web UI changes

## Performance Considerations

- **API Calls**: 2 calls per work item (1 GET current state + 1 GET revisions) + 1 PATCH per item with reverts
- **Batch Processing**: Analyzes items sequentially to avoid rate limiting
- **Memory**: Revision history kept in memory during analysis
- **Time Estimate**: ~2-3 seconds per work item for analysis + revert

### Performance Tips

1. **Reduce maxRevisions** - Use 20-30 for recent changes instead of default 50
2. **Use fieldPaths** - Specify only fields you care about instead of checking all
3. **Disable link detection** - Keep `detectLinkChanges: false` unless needed
4. **Filter by time** - Use narrow time windows to reduce revisions analyzed
5. **Split large batches** - Process 20-50 items at a time for large datasets

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/bulk-operations/forensic-undo-by-query-handle.handler.ts`
- **Schema:** `src/config/schemas.ts` - `forensicUndoByQueryHandleSchema`
- **Tool Config:** `src/config/tool-configs/bulk-operations.ts`

### Integration Points

- **Query Handle Service** - Validates and retrieves work item IDs
- **ADO Work Item Repository** - Fetches revisions and current state
- **Azure DevOps Work Items API** - Performs revert operations

### Detection Algorithm

```typescript
for each revision in history (newest to oldest):
  if revision matches filters (user, time):
    for each field changed:
      compare current_value with revision_value:
        if current_value == new_value AND current_value != old_value:
          mark as needing revert to old_value
        else:
          mark as already reverted (skip)
```

## Comparison with Standard Undo

| Feature | wit-bulk-undo-by-query-handle | wit-forensic-undo-by-query-handle |
|---------|------------------------------|----------------------------------|
| Data Source | MCP operation history | ADO revision history |
| Scope | Only MCP-tracked operations | ANY changes (web UI, API, etc.) |
| User Filtering | ❌ No | ✅ Yes |
| Time Filtering | ❌ No | ✅ Yes |
| Field Filtering | ❌ No | ✅ Yes |
| Smart Revert Detection | ❌ No | ✅ Yes |
| Link Changes | ✅ Yes | ⚠️ Limited |
| Performance | Fast (in-memory) | Slower (API calls per item) |

**Use Standard Undo When:**
- You made changes through MCP server
- You want to undo immediately after operation
- You need to undo link operations

**Use Forensic Undo When:**
- Changes were made outside MCP (web UI, scripts, etc.)
- You need user-based filtering
- You need time-based filtering
- Some items may have been manually fixed already
- You want deterministic revert behavior

## Security Considerations

- Requires same Azure DevOps permissions as original changes
- No audit trail beyond ADO work item history
- User filter is case-insensitive partial match (not strict)
- Cannot undo changes by system accounts or automation

## Future Enhancements

### Potential Improvements

1. **Full Link Change Support**
   - Efficient relation diff algorithm
   - Bulk link operation support

2. **Change Grouping**
   - Group changes by revision for bulk revert
   - Atomic revert operations

3. **Undo History**
   - Track forensic undo operations
   - Redo capability for forensic undos

4. **Advanced Filters**
   - Filter by specific revision numbers
   - Filter by change reason/comment
   - Exclude automated changes

5. **Validation Preview**
   - Check state transition validity before revert
   - Warn about field constraint violations

## Related Features

- [Bulk Undo](./BULK_UNDO.md) - Standard MCP operation undo
- [Bulk Operations](./BULK_OPERATIONS.md) - Unified bulk operations tool
- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe handle-based operations

## References

- [Azure DevOps Work Items API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items)
- [Work Item Revisions API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/revisions)
- [JSON Patch RFC](https://datatracker.ietf.org/doc/html/rfc6902)

---

**Last Updated:** 2025-10-29  
**Author:** Enhanced ADO MCP Team
