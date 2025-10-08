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

## Configuration

No special configuration required. Query handles managed in-memory by server.

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
