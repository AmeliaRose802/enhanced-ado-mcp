# Unified Query Handle Info Tool

**Tool Name:** `wit-query-handle-info`  
**Status:** ✅ Implemented  
**Version:** 1.6.0  
**Last Updated:** 2025-10-08

## Overview

A unified tool that combines the functionality of three separate query handle tools:
- `wit-query-handle-validate`
- `wit-query-handle-inspect`
- `wit-query-handle-select`

This provides a simpler, more streamlined API for working with query handles.

## Why Use This Tool?

**Benefits:**
- ✅ **Simpler API** - One tool instead of three
- ✅ **Flexible Output** - Basic or detailed mode based on your needs
- ✅ **Reduced Complexity** - Fewer tools to learn and choose from
- ✅ **Full Backward Compatibility** - Old tools still work

## Input Parameters

### Required
- `queryHandle` (string) - Query handle from `wit-get-work-items-by-query-wiql` with `returnQueryHandle=true`

### Optional
- `detailed` (boolean) - Include validation data and selection analysis (default: `false`)
- `includePreview` (boolean) - Include preview of first 10 work items (default: `true`)
- `includeStats` (boolean) - Include staleness statistics and metadata (default: `true`)
- `includeExamples` (boolean) - Include selection examples (default: `false`, saves ~300 tokens)
- `itemSelector` (string | number[] | object) - When provided with `detailed=true`, shows selection analysis
  - `"all"` - Select all items
  - `[0, 1, 2]` - Select specific items by index
  - `{ states: ["Active"], tags: ["bug"] }` - Select by criteria
- `previewCount` (number) - Number of items in selection preview (default: `10`)
- `includeSampleItems` (boolean) - Fetch actual work items from ADO API when `detailed=true` (default: `false`)
- `organization` (string) - Azure DevOps organization name
- `project` (string) - Azure DevOps project name

## Output Modes

### Basic Mode (`detailed=false`, default)

Returns inspection data similar to `wit-query-handle-inspect`:

```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123...",
    "work_item_count": 25,
    "created_at": "2024-01-20T10:00:00Z",
    "expires_at": "2024-01-20T11:00:00Z",
    "query": "SELECT [System.Id] FROM WorkItems...",
    "has_item_context": true,
    "selection_enabled": true,
    "itemPreview": [
      {
        "index": 0,
        "id": 123,
        "title": "Fix login bug",
        "state": "Active",
        "type": "Bug",
        "days_inactive": 45,
        "tags": ["frontend", "urgent"]
      }
    ],
    "selectionHints": [
      "Use index 0 to select the first item",
      "Use [0, 2, 5] to select specific items by index"
    ],
    "selectionStats": {
      "totalItems": 25,
      "byState": { "Active": 15, "New": 10 },
      "byType": { "Bug": 8, "Task": 17 }
    },
    "expiration_info": {
      "expires_in_minutes": 42,
      "is_expired": false
    }
  }
}
```

### Detailed Mode (`detailed=true`)

Adds validation data and optional selection analysis:

```json
{
  "data": {
    // ... all basic mode fields ...
    "validation": {
      "valid": true,
      "item_count": 25,
      "time_remaining_minutes": 42,
      "original_query": "SELECT [System.Id] FROM...",
      "sample_items": [...]  // When includeSampleItems=true
    },
    "selection_analysis": {  // When itemSelector provided
      "item_selector": [0, 1, 2],
      "analysis": {
        "selection_type": "index-based",
        "selected_items_count": 3,
        "selection_percentage": "12.0%"
      },
      "preview_items": [...]
    }
  }
}
```

## Usage Examples

### Example 1: Quick Handle Check

**Use Case:** Verify a handle exists and see what items it contains

```json
{
  "queryHandle": "qh_abc123..."
}
```

**Returns:** Basic inspection data (preview, stats, hints)

---

### Example 2: Full Validation

**Use Case:** Validate handle before critical bulk operation

```json
{
  "queryHandle": "qh_abc123...",
  "detailed": true,
  "includeSampleItems": true
}
```

**Returns:** Validation + inspection + actual work item data from ADO

---

### Example 3: Preview Selection

**Use Case:** See which items will be affected by a bulk operation

```json
{
  "queryHandle": "qh_abc123...",
  "detailed": true,
  "itemSelector": { "states": ["Active"], "daysInactiveMin": 30 }
}
```

**Returns:** Basic info + analysis of which items match criteria

---

### Example 4: Minimal Output

**Use Case:** Just check if handle is valid

```json
{
  "queryHandle": "qh_abc123...",
  "includePreview": false,
  "includeStats": false
}
```

**Returns:** Just handle metadata and expiration info

## Migration Guide

### From `wit-query-handle-inspect`

**No change needed!** Default behavior is identical.

```json
// Both work the same
{ "queryHandle": "qh_..." }
```

### From `wit-query-handle-validate`

**Add `detailed: true`:**

```json
// Old
{ "queryHandle": "qh_...", "includeSampleItems": true }

// New
{ "queryHandle": "qh_...", "detailed": true, "includeSampleItems": true }
```

### From `wit-query-handle-select`

**Add `detailed: true`:**

```json
// Old
{ "queryHandle": "qh_...", "itemSelector": [0, 1, 2] }

// New
{ "queryHandle": "qh_...", "detailed": true, "itemSelector": [0, 1, 2] }
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Query handle not found or expired` | Handle doesn't exist or TTL expired | Re-execute query to get fresh handle |
| `Failed to resolve item selector` | Invalid selector format | Use "all", number array, or criteria object |
| `Azure CLI not available` | Not logged in (when `includeSampleItems=true`) | Run `az login` |

## Best Practices

1. **Use Basic Mode by Default** - Simpler output, faster, fewer tokens
2. **Enable Detailed Mode for Critical Ops** - Use validation before destructive bulk operations
3. **Preview Selections First** - Always use `itemSelector` to verify what will be affected
4. **Monitor Expiration** - Check `expiration_info` and regenerate handles before they expire
5. **Use `includeExamples=false`** - Save ~300 tokens unless you need usage examples

## Related Tools

- `wit-get-work-items-by-query-wiql` - Create query handles
- `wit-bulk-update` - Use handles for safe bulk operations
- `wit-bulk-comment` - Add comments to selected items
- `wit-query-handle-list` - List all active handles

## See Also

- [Query Handle Operations](./QUERY_HANDLE_OPERATIONS.md) - Full documentation on all query handle tools
- [Anti-Hallucination Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Why query handles prevent ID errors
- [Bulk Operations](./BULK_OPERATIONS.md) - Safe bulk operations using handles
