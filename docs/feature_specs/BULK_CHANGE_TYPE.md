# Bulk Change Work Item Type

**Version:** 2.0.0  
**Last Updated:** 2025-10-28  
**Feature Status:** ✅ Implemented (Unified Operations Only)

---

## Overview

The Bulk Change Type feature allows users to safely change the type of multiple work items using the query handle pattern. This feature is now **only available through the unified bulk operations tool** with a `change-type` action.

**Migration Note**: The standalone tool `wit-bulk-change-type-by-query-handle` has been removed. Use `wit-unified-bulk-operations-by-query-handle` instead.

### Purpose

Enable bulk work item type conversion with:
- **Query handle pattern** - Prevents ID hallucination
- **Type validation** - Validates that type changes are allowed
- **Field preservation** - Maintains field values where applicable
- **Dry-run mode** - Preview changes before execution
- **Comment support** - Add context with template variables
- **Undo support** - Revert type changes if needed

### Common Use Cases

1. **Convert tasks to bugs** - When tasks are identified as defects
2. **Promote stories to features** - When scope grows beyond a story
3. **Demote features to stories** - When scope is reduced
4. **Convert issues to tasks** - Standardize work item types
5. **Change PBI to User Story** - Process standardization

---

## Using the Unified Bulk Operations Tool

The change-type operation is available as an action in `wit-unified-bulk-operations-by-query-handle`.

### Change-Type Action Schema

**Required:**
- `type` (string) - Must be `"change-type"`
- `targetType` (string) - Target work item type (e.g., 'Bug', 'Task', 'User Story', 'Product Backlog Item', 'Feature', 'Epic')

**Optional:**
- `validateTypeChanges` (boolean) - Validate that type changes are valid (default: `true`)
- `skipInvalidChanges` (boolean) - Skip items with invalid type changes (default: `true`)
- `preserveFields` (boolean) - Preserve field values where possible (default: `true`)
- `comment` (string) - Optional comment with template variables: `{previousType}`, `{targetType}`, `{id}`

### Example Usage

```json
{
  "tool": "wit-unified-bulk-operations-by-query-handle",
  "queryHandle": "qh_abc123",
  "actions": [
    {
      "type": "change-type",
      "targetType": "Bug",
      "validateTypeChanges": true,
      "skipInvalidChanges": true,
      "comment": "Converting {previousType} to {targetType} - identified as defect"
    }
  ],
  "dryRun": true
}

### Item Selector Options

```typescript
itemSelector: "all" | number[] | {
  states?: string[];
  titleContains?: string[];
  tags?: string[];
  daysInactiveMin?: number;
  daysInactiveMax?: number;
}
```

### Valid Type Transitions

The tool validates type changes based on Azure DevOps best practices:

| Source Type | Allowed Target Types |
|-------------|---------------------|
| Task | Bug, User Story, Product Backlog Item |
| Bug | Task, User Story, Product Backlog Item |
| User Story | Bug, Task, Product Backlog Item, Feature |
| Product Backlog Item | Bug, Task, User Story, Feature |
| Feature | Epic, User Story, Product Backlog Item |
| Epic | Feature |
| Issue | Task, Bug, User Story |
| Impediment | Task, Bug |

**Note:** Validation can be disabled with `validateTypeChanges: false` for custom process templates.

### Output Format

**Dry Run Response:**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "query_handle": "qh_c1b1b9a3...",
    "target_type": "Bug",
    "total_items_in_handle": 50,
    "selected_items_count": 25,
    "valid_changes_count": 23,
    "invalid_changes_count": 2,
    "validation_enabled": true,
    "skip_invalid": true,
    "preserve_fields": true,
    "work_item_ids": [101, 102, 103, ...],
    "preview_items": [
      {
        "work_item_id": 101,
        "title": "Task 1",
        "current_type": "Task",
        "new_type": "Bug",
        "state": "Active"
      }
    ],
    "preview_message": "Showing 10 of 23 valid changes...",
    "invalid_changes": [
      {
        "workItemId": 105,
        "currentType": "Epic",
        "valid": false,
        "reason": "Cannot change Epic to Bug. Allowed targets: Feature"
      }
    ],
    "allowed_types": ["Bug", "Epic", "Feature", "Issue", "Product Backlog Item", "Task", "User Story"],
    "summary": "DRY RUN: Would change 23 of 25 work item(s) to type 'Bug' (2 skipped)"
  },
  "errors": [],
  "warnings": [
    "⚠️ Work item 105: Cannot change Epic to Bug. Allowed targets: Feature"
  ]
}
```

**Execute Response:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3...",
    "target_type": "Bug",
    "total_items_in_handle": 50,
    "selected_items": 25,
    "valid_changes": 23,
    "invalid_changes": 2,
    "item_selector": "all",
    "successful": 23,
    "failed": 0,
    "skipped": 2,
    "comments_added": 23,
    "results": [
      {
        "workItemId": 101,
        "success": true,
        "previousType": "Task",
        "commentAdded": true
      }
    ],
    "changed_items": [
      {
        "id": 101,
        "title": "Task 1",
        "previous_type": "Task",
        "new_type": "Bug",
        "state": "Active",
        "comment_added": true
      }
    ],
    "validation_enabled": true,
    "skip_invalid": true,
    "allowed_types": ["Bug", "Epic", "Feature", "Issue", "Product Backlog Item", "Task", "User Story"],
    "summary": "Changed 23 selected items to type 'Bug' (2 skipped) (23 with comments)"
  },
  "errors": [],
  "warnings": []
}
```

**Error Response:**
```json
{
  "success": false,
  "data": {
    "query_handle": "qh_c1b1b9a3...",
    "target_type": "InvalidType",
    "total_items_in_handle": 50,
    "selected_items": 50,
    "valid_changes": 0,
    "invalid_changes": 50,
    "validation_results": [...],
    "summary": "No valid type changes found"
  },
  "errors": ["No valid type changes found"],
  "warnings": [
    "⚠️ Work item 101: Cannot change Epic to InvalidType. Allowed targets: Feature"
  ]
}
```

---

## Examples

### Example 1: Convert Tasks to Bugs (Dry Run)

**Request:**
```json
{
  "tool": "wit-unified-bulk-operations-by-query-handle",
  "arguments": {
    "queryHandle": "qh_tasks_to_bugs_123",
    "actions": [
      {
        "type": "change-type",
        "targetType": "Bug",
        "comment": "Converting from {previousType} to {targetType} due to bug triage - Work Item {id}",
        "validateTypeChanges": true
      }
    ],
    "dryRun": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "actions_executed": 1,
    "preview": [
      {
        "action": "change-type",
        "valid_changes_count": 15,
        "invalid_changes_count": 0,
        "summary": "Would change 15 work items to Bug"
      }
    ]
  }
}
```

### Example 2: Promote User Stories to Features

**Request:**
```json
{
  "tool": "wit-unified-bulk-operations-by-query-handle",
  "arguments": {
    "queryHandle": "qh_large_stories_456",
    "actions": [
      {
        "type": "change-type",
        "targetType": "Feature",
        "comment": "Promoting to Feature due to increased scope",
        "validateTypeChanges": true,
        "skipInvalidChanges": true
      }
    ],
    "itemSelector": {
      "states": ["Active", "New"]
    },
    "dryRun": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "successful": 8,
    "failed": 0,
    "skipped": 2,
    "changed_items": [...],
    "summary": "Changed 8 selected items to type 'Feature' (2 skipped)"
  }
}
```

### Example 3: Combine Change Type with Other Operations

**Request:**
```json
{
  "tool": "wit-unified-bulk-operations-by-query-handle",
  "arguments": {
    "queryHandle": "qh_tasks_789",
    "actions": [
      {
        "type": "change-type",
        "targetType": "Bug",
        "validateTypeChanges": true
      },
      {
        "type": "transition-state",
        "targetState": "Active"
      },
      {
        "type": "assign",
        "assignTo": "user@example.com"
      }
    ],
    "dryRun": false
  }
}
```

**Note:** Disabling validation allows custom process templates but increases risk.

---

## Workflow Pattern

### Step 1: Query for Items
```json
{
  "tool": "wit-wiql-query",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND [System.State] = 'Active'",
    "returnQueryHandle": true
  }
}
```
Returns: `query_handle: "qh_active_tasks_123"`

### Step 2: Preview Changes (Dry Run)
```json
{
  "tool": "wit-unified-bulk-operations-by-query-handle",
  "arguments": {
    "queryHandle": "qh_active_tasks_123",
    "actions": [
      {
        "type": "change-type",
        "targetType": "Bug",
        "validateTypeChanges": true
      }
    ],
    "dryRun": true
  }
}
```

### Step 3: Execute Changes
```json
{
  "tool": "wit-unified-bulk-operations-by-query-handle",
  "arguments": {
    "queryHandle": "qh_active_tasks_123",
    "actions": [
      {
        "type": "change-type",
        "targetType": "Bug",
        "comment": "Converted to Bug per bug triage process"
      }
    ],
    "dryRun": false
  }
}
```

### Step 4: Undo if Needed
```json
{
  "tool": "wit-bulk-undo-by-query-handle",
  "arguments": {
    "queryHandle": "qh_active_tasks_123",
    "dryRun": false
  }
}
```

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| "Query handle not found" | Invalid or expired handle | Re-query and get new handle |
| "No valid type changes found" | All items already target type or invalid transitions | Check type validation rules |
| "Target type is required" | Missing targetType parameter | Provide targetType in request |
| "Failed to fetch work items" | API error or permissions | Check Azure DevOps access |

### Validation Warnings

When `validateTypeChanges: true`:
- Items with invalid type changes are skipped (if `skipInvalidChanges: true`)
- Warnings list which items and why they were skipped
- Provides allowed target types for each item

---

## Performance Considerations

- **Batch Processing:** Fetches up to 200 work items at once for validation
- **API Rate Limiting:** ~50 type changes per second
- **Large Batches:** Progress tracked for operations >50 items
- **Query Handle Expiration:** 1 hour from creation
- **Field Preservation:** Type change may lose some type-specific fields

---

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/bulk-operations/unified-bulk-operations.handler.ts`
- **Change Type Logic:** Implemented within the unified bulk operations handler
- **Schema:** `src/config/schemas.ts` - `unifiedBulkOperationsSchema`
- **Service:** `src/services/query-handle-service.ts` - Query handle resolution
- **Tool Config:** `src/config/tool-configs/bulk-operations.ts`

### Integration Points

- **Query Handle Service** - Validates and retrieves work item IDs
- **Azure DevOps Work Items API** - Performs type changes
- **Undo Service** - Records operations for reversal
- **Type Validation** - Enforces allowed transitions
- **Unified Operations** - Part of consolidated bulk operations system

### Type Change Mechanics

Azure DevOps type changes:
1. Updates `System.WorkItemType` field
2. Preserves compatible fields
3. Removes incompatible type-specific fields
4. Maintains work item history
5. Updates search index

### Operation History

Type changes are recorded for undo:
```typescript
{
  operation: 'bulk-change-type',
  timestamp: '2025-10-28T18:00:00Z',
  itemsAffected: [
    {
      workItemId: 101,
      changes: {
        '/fields/System.WorkItemType': {
          from: 'Task',
          to: 'Bug'
        }
      }
    }
  ]
}
```

---

## Security & Permissions

### Required Permissions

- **Read:** Work Items - View work item in this node
- **Write:** Work Items - Edit work items in this node
- **Area Path:** Access to all area paths in query

### Best Practices

1. **Always use dry-run first** - Preview changes before execution
2. **Enable type validation** - Prevent invalid transitions
3. **Use specific item selectors** - Target only intended items
4. **Add descriptive comments** - Document why types were changed
5. **Test with small batches** - Verify process before large operations
6. **Keep query handles fresh** - Renew if operations span >1 hour

---

## Testing

### Unit Tests

Location: `test/unit/unified-bulk-operations.test.ts`

**Coverage includes:**
- Change-type action validation
- Type validation logic
- Field preservation
- Invalid type change handling
- Comment template variable substitution
- Dry-run mode
- Item selector filtering
- Combined actions with change-type

**Coverage:**
- Query handle resolution
- Type validation logic
- Dry run mode
- Comment template substitution
- Item selector filtering
- Error handling
- Schema validation
- Undo integration

### Integration Tests

Recommended manual testing:
1. Convert 5 Tasks to Bugs
2. Validate type change restrictions
3. Test with item selector
4. Test undo functionality
5. Verify field preservation

---

## Changelog

### Version 1.0.0 (2025-10-28)
- ✅ Initial implementation
- ✅ Query handle pattern support
- ✅ Type validation with allowed transitions map
- ✅ Dry-run mode with preview
- ✅ Comment support with template variables
- ✅ Item selector support
- ✅ Undo operation support
- ✅ Comprehensive unit tests

---

## Related Features

- [Bulk Operations](BULK_OPERATIONS.md) - Other bulk operation tools
- [Query Handle Pattern](ENHANCED_QUERY_HANDLE_PATTERN.md) - Query handle details
- [Bulk Undo](BULK_UNDO.md) - Undo bulk operations

---

## Future Enhancements

**Potential improvements:**
- [ ] Custom validation rules for custom process templates
- [ ] Field mapping configuration for type changes
- [ ] Bulk type change templates (predefined conversions)
- [ ] Child item cascade (change children when parent changes)
- [ ] Automatic acceptance criteria migration
- [ ] Type change impact analysis

---

**Maintained by:** Enhanced ADO MCP Server Team  
**Documentation Version:** 1.0.0
