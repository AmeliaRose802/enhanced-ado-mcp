# Bulk Operations

**Feature Category:** Bulk Operations  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07

## Overview

The Enhanced ADO MCP Server provides safe bulk operation tools using the query handle pattern to prevent ID hallucination:

1. **wit-bulk-comment** - Add comments to multiple work items
2. **wit-bulk-update** - Update multiple work item fields
3. **wit-bulk-assign** - Assign multiple work items to a user
4. **wit-bulk-remove** - Move multiple work items to 'Removed' state

All bulk operations use query handles from `wit-query-wiql` to eliminate ID hallucination risk.

## Purpose

Enable safe bulk work item operations with:
- Query handle pattern prevents ID hallucination
- Template variables for personalized updates
- Dry-run mode for preview before execution
- Batch processing with progress tracking
- Automatic error handling and retry logic

## Tools

### 1. wit-bulk-comment

Add a comment to multiple work items identified by a query handle.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql
- `comment` (string) - Comment text (supports Markdown and template variables)

**Optional:**
- `dryRun` (boolean) - Preview operation without making changes (default false)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

**Template Variables:**
Available when query handle includes staleness data (`includeSubstantiveChange: true`):
- `{daysInactive}` - Days since last substantive change
- `{lastSubstantiveChangeDate}` - Date of last substantive change
- `{title}` - Work item title
- `{state}` - Work item state
- `{type}` - Work item type
- `{assignedTo}` - Assigned to user
- `{id}` - Work item ID

#### Output Format

**Success Response (Dry Run):**
```json
{
  "success": true,
  "data": {
    "dryRun": true,
    "itemCount": 5,
    "templateExamples": [
      {
        "id": 12345,
        "title": "Implement authentication",
        "renderedComment": "This item has been inactive for 180 days (last change: 2023-07-01). Please review and update."
      }
    ]
  },
  "errors": [],
  "warnings": ["Dry run mode - no changes made"]
}
```

**Success Response (Execute):**
```json
{
  "success": true,
  "data": {
    "itemsProcessed": 5,
    "itemsSucceeded": 5,
    "itemsFailed": 0,
    "results": [
      {
        "id": 12345,
        "success": true,
        "commentId": 123456,
        "renderedComment": "This item has been inactive for 180 days..."
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Simple Comment**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "comment": "Please review this item for accuracy.",
  "dryRun": true
}
```

**Example 2: Template Variables**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "comment": "This item has been inactive for {daysInactive} days (last change: {lastSubstantiveChangeDate}). Please review and update or close.",
  "dryRun": false
}
```
Adds personalized comment to each work item with staleness info.

**Example 3: Stale Item Warning**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "comment": "⚠️ **Staleness Alert**\n\n**Title:** {title}\n**State:** {state}\n**Inactive:** {daysInactive} days\n\nThis item will be closed in 30 days unless updated."
}
```
Adds formatted Markdown comment with warning.

### 2. wit-bulk-update

Update multiple work items using JSON Patch operations.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql
- `updates` (array) - Array of JSON Patch operations

**JSON Patch Operation:**
```typescript
{
  "op": "add" | "replace" | "remove",
  "path": "/fields/System.State" | "/fields/System.Tags" | ...,
  "value": any  // Not needed for 'remove' operation
}
```

**Optional:**
- `dryRun` (boolean) - Preview operation (default false)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "itemsProcessed": 5,
    "itemsSucceeded": 5,
    "itemsFailed": 0,
    "results": [
      {
        "id": 12345,
        "success": true,
        "appliedPatches": [
          {
            "op": "replace",
            "path": "/fields/System.State",
            "value": "Resolved"
          }
        ]
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Change State**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "updates": [
    {
      "op": "replace",
      "path": "/fields/System.State",
      "value": "Resolved"
    }
  ],
  "dryRun": true
}
```
Changes state to 'Resolved' for all items.

**Example 2: Add Tags**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "updates": [
    {
      "op": "add",
      "path": "/fields/System.Tags",
      "value": "Technical-Debt; Needs-Review"
    }
  ]
}
```
Adds tags to all items.

**Example 3: Multiple Updates**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "updates": [
    {
      "op": "replace",
      "path": "/fields/System.Priority",
      "value": 3
    },
    {
      "op": "replace",
      "path": "/fields/System.IterationPath",
      "value": "Project\\Sprint 11"
    }
  ]
}
```
Updates priority and iteration path.

### 3. wit-bulk-assign

Assign multiple work items to a user.

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql
- `assignTo` (string) - User email or display name

**Optional:**
- `dryRun` (boolean) - Preview operation (default false)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "itemsProcessed": 5,
    "itemsSucceeded": 5,
    "itemsFailed": 0,
    "assignedTo": "developer@company.com",
    "results": [
      {
        "id": 12345,
        "success": true,
        "previousAssignee": "olddev@company.com"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Assign to Team Member**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "assignTo": "newdeveloper@company.com",
  "dryRun": true
}
```

### 4. wit-bulk-remove

Move multiple work items to 'Removed' state (does NOT permanently delete).

#### Input Parameters

**Required:**
- `queryHandle` (string) - Query handle from wit-query-wiql

**Optional:**
- `removeReason` (string) - Reason for removing (added as comment before state change)
- `dryRun` (boolean) - Preview operation (default false)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "itemsProcessed": 5,
    "itemsSucceeded": 5,
    "itemsFailed": 0,
    "removeReason": "Duplicate work items",
    "results": [
      {
        "id": 12345,
        "success": true,
        "previousState": "Active",
        "commentAdded": true
      }
    ]
  },
  "errors": [],
  "warnings": ["Items moved to 'Removed' state, not permanently deleted"]
}
```

#### Examples

**Example: Remove Stale Items**
```json
{
  "queryHandle": "qh_c1b1b9a3...",
  "removeReason": "Stale for 365+ days with no activity. Removed during backlog cleanup.",
  "dryRun": true
}
```

## Workflow Pattern

### Step 1: Query with Query Handle
```json
{
  "tool": "wit-query-wiql",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.CreatedDate] < @Today - 180",
    "includeSubstantiveChange": true,
    "returnQueryHandle": true
  }
}
```
Returns: `query_handle: "qh_c1b1b9a3..."`

### Step 2: Preview with Dry Run
```json
{
  "tool": "wit-bulk-comment",
  "arguments": {
    "queryHandle": "qh_c1b1b9a3...",
    "comment": "Inactive for {daysInactive} days. Please review.",
    "dryRun": true
  }
}
```
Shows template substitution examples without making changes.

### Step 3: Execute Operation
```json
{
  "tool": "wit-bulk-comment",
  "arguments": {
    "queryHandle": "qh_c1b1b9a3...",
    "comment": "Inactive for {daysInactive} days. Please review.",
    "dryRun": false
  }
}
```
Executes bulk operation on all items.

## Configuration

No special configuration required. Uses defaults from `.ado-mcp-config.json`.

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Query handle not found" | Handle expired or invalid | Re-query with returnQueryHandle=true |
| "Query handle expired" | Handle older than 1 hour | Re-query to get fresh handle |
| "Invalid field path" | Wrong JSON Patch path | Use /fields/System.FieldName format |
| "State transition not allowed" | Invalid state change | Check allowed state transitions |
| "User not found" | Invalid assignee | Verify user exists in organization |

### Error Recovery

- Partial success: Some items may succeed even if others fail
- Failed items reported in results with error details
- Retry logic for transient failures
- Rollback not automatic - requires manual intervention

## Performance Considerations

- Batch size: Processes all items in query handle (up to 1000)
- API rate limiting: ~50 updates per second
- Large batches: Progress tracking every 10 items
- Query handle expiration: 1 hour from creation

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/bulk-operations/*.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/ado-work-item-service.ts`
- **Query Handle Service:** `src/services/query-handle-service.ts`

### Integration Points

- **Query Handle Service** - Validates and retrieves work item IDs
- **Azure DevOps Work Items API** - Updates and comments
- **Template Engine** - Variable substitution for comments

## Testing

### Test Files

- `test/unit/bulk-operations/*.test.ts`
- `test/integration/bulk-operations.test.ts`

### Test Coverage

- [x] Dry run mode
- [x] Template variable substitution
- [x] JSON Patch operations
- [x] Error handling (invalid handles, failed updates)
- [x] Partial success scenarios
- [x] Progress tracking

### Manual Testing

```bash
# Test bulk comment with dry run
{
  "tool": "wit-bulk-comment",
  "arguments": {
    "queryHandle": "qh_test...",
    "comment": "Test comment with {daysInactive} days",
    "dryRun": true
  }
}
```

## Related Features

- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe handle-based operations
- [Query Tools](./QUERY_TOOLS.md) - Creating query handles
- [Bulk AI Enhancement](./BULK_AI_ENHANCEMENT.md) - AI-powered bulk operations

## References

- [Azure DevOps JSON Patch](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update)
- [JSON Patch RFC](https://datatracker.ietf.org/doc/html/rfc6902)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
