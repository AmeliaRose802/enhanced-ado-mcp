# Query Tools: WIQL and OData

**Feature Category:** Querying & Search  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-08

## Overview

The Enhanced ADO MCP Server provides comprehensive query tools for finding and analyzing work items:

1. **wit-query-wiql** - WIQL query execution with query handle pattern
2. **wit-query-odata** - OData analytics for aggregations and metrics
3. **wit-ai-generate-wiql** - AI-powered WIQL query generation from natural language
4. **wit-ai-generate-odata** - AI-powered OData query generation from natural language

These tools enable both manual query construction and AI-assisted query generation.

## Purpose

Enable flexible work item querying with:
- WIQL for precise work item selection
- OData for analytics and aggregations
- Query handle pattern for safe bulk operations
- AI-powered natural language to query conversion
- Staleness filtering and analysis
- Pagination for large result sets

## Tools

### 1. wit-query-wiql

🔐 **ANTI-HALLUCINATION TOOL:** Execute WIQL query and get both work item details AND a query handle for safe operations.

#### Input Parameters

**Required:**
- `wiqlQuery` (string) - WIQL query string

**Optional:**
- `organization` (string) - Azure DevOps organization (uses config default)
- `project` (string) - Azure DevOps project (uses config default)
- `includeFields` (array of strings) - Additional fields to include
- `maxResults` (number) - Max results per page (default 200, max 1000)
- `skip` (number) - Number of items to skip for pagination (default 0)
- `top` (number) - Max items to return (alias for maxResults)
- `includeSubstantiveChange` (boolean) - Include lastSubstantiveChangeDate and daysInactive
- `filterBySubstantiveChangeAfter` (string) - Filter by substantive change after date (ISO 8601)
- `filterBySubstantiveChangeBefore` (string) - Filter by substantive change before date
- `filterByDaysInactiveMin` (number) - Filter by minimum days inactive
- `filterByDaysInactiveMax` (number) - Filter by maximum days inactive
- `filterByPatterns` (array of strings) - Filter by common work item patterns:
  - `"missing_description"` - Items with empty description or <10 chars
  - `"missing_acceptance_criteria"` - Items with empty acceptance criteria or <10 chars
  - `"duplicates"` - Items with similar titles (case-insensitive)
  - `"placeholder_titles"` - Items with TBD/TODO/FIXME/XXX/test/temp/foo/bar/baz markers
  - `"unassigned_committed"` - Active/Committed/In Progress items without assignee
  - `"stale_automation"` - Automation-created items inactive 180+ days
- `returnQueryHandle` (boolean) - Return query handle for safe operations (default true)
- `handleOnly` (boolean) - ⚡ **EFFICIENCY MODE:** Return ONLY query handle without fetching work item data (default false)
- `fetchFullPackages` (boolean) - Fetch full context packages for each item (expensive)
- `includePaginationDetails` (boolean) - Force include pagination details

#### Handle-Only Mode (New in v1.5.1)

When `handleOnly: true` is combined with `returnQueryHandle: true`, the tool returns **only the query handle and count** without including work item data in the response. However, full work item context is **still fetched and stored** in the query handle for later retrieval.

**Key Behavior:**
- Work item data IS fetched from Azure DevOps (to populate handle context)
- Work item data IS NOT returned in the response (only handle + count)
- Handle contains full context data for later retrieval via `wit-query-handle-get-items`
- This prevents "unknown" data issues when using the handle later

**This mode is efficient for workflows where:**

- You need to perform bulk operations without previewing items
- You have a large result set and don't need immediate details
- You want to minimize API calls and response payload size
- You'll analyze items later using `wit-query-handle-get-items`

**Benefits:**
- **Smaller response** - Only returns handle and count (not full work item array)
- **Lower token usage** - Minimal response payload for LLMs
- **Full context preserved** - Handle contains complete work item data for later operations
- **No "unknown" data** - Handle can be used immediately for informed operations

**Use Cases:**
- Backlog cleanup workflows (get counts before reviewing)
- Bulk operations where preview isn't needed
- Large query result sets (>500 items)
- Query validation before committing to full fetch

#### Output Format

**Success Response (Standard Mode):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "work_items": [
      {
        "id": 12345,
        "title": "Implement authentication",
        "state": "Active",
        "type": "Product Backlog Item",
        "assignedTo": "developer@company.com",
        "lastSubstantiveChangeDate": "2024-01-15T10:00:00Z",
        "daysInactive": 5
      }
    ],
    "totalCount": 45,
    "pagination": {
      "currentPage": 1,
      "pageSize": 200,
      "totalPages": 1,
      "hasNextPage": false
    }
  },
  "errors": [],
  "warnings": ["Query handle expires in 1 hour. Use bulk operations within this timeframe."]
}
```

**Success Response (Standard Mode with AI Generation):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "generated_query": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active'",
    "work_items": [
      {
        "id": 12345,
        "title": "Fix login issue",
        "state": "Active",
        "type": "Bug",
        "assignedTo": "developer@company.com"
      }
    ],
    "totalCount": 45,
    "query": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active'",
    "summary": "Query handle created for 45 work item(s) along with full work item details..."
  },
  "errors": [],
  "warnings": []
}
```

**Note:** When natural language is used to generate a query via the `description` parameter (unified WIQL tool in AI generation mode), the `generated_query` field will always be present in the response, allowing you to verify and reuse the exact query that was executed. This ensures transparency and enables query refinement.

**Success Response (Handle-Only Mode with `handleOnly: true` and AI generation):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "generated_query": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    "work_item_count": 45,
    "total_count": 45,
    "query": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    "summary": "Query handle created for 45 work item(s). Handle-only mode: work item details not fetched for efficiency. Use the handle with bulk operation tools or wit-query-handle-get-items to retrieve items. Handle expires in 1 hour.",
    "next_steps": [
      "Use wit-query-handle-get-items to retrieve work item details if needed",
      "Use wit-bulk-comment to add comments to all items",
      "Use wit-bulk-update to update fields on all items",
      "Use wit-bulk-assign to assign all items to a user",
      "Use wit-bulk-remove to remove all items",
      "Always use dryRun: true first to preview changes before applying them"
    ],
    "expires_at": "2025-10-09T14:30:00Z"
  },
  "metadata": {
    "source": "rest-api-wiql",
    "queryHandleMode": true,
    "handleOnlyMode": true,
    "handle": "qh_c1b1b9a3ab3ca2f2ae8af6114c4a50e3",
    "count": 45,
    "totalCount": 45
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Find Active Bugs**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active'"
}
```

**Example 2: Find Stale Items**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('New', 'Active')",
  "includeSubstantiveChange": true,
  "filterByDaysInactiveMin": 180
}
```
Returns items inactive for 180+ days with staleness analysis.

**Example 2b: Find Items with Missing Description**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task', 'Bug')",
  "filterByPatterns": ["missing_description"],
  "maxResults": 50
}
```
Returns active items with empty or very short descriptions (< 10 characters).

**Example 3: Hierarchical Query with Pagination**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345 ORDER BY [System.WorkItemType], [System.Title]",
  "maxResults": 50,
  "skip": 0
}
```
Returns first 50 children of work item 12345.

**Example 4: Handle-Only Mode for Bulk Operations** ⚡ **NEW**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] = 'New'",
  "returnQueryHandle": true,
  "handleOnly": true
}
```
Returns only the query handle and count (e.g., 250 items) without fetching work item details. Use this when you plan to perform bulk operations and don't need to preview items first. Reduces API calls and response size significantly.

**Example 5: Backlog Cleanup Workflow with Handle-Only**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] NOT IN ('Done', 'Removed') AND [System.ChangedDate] < @Today - 180",
  "includeSubstantiveChange": true,
  "filterByDaysInactiveMin": 180,
  "returnQueryHandle": true,
  "handleOnly": true
}
```
Efficiently finds stale items without fetching full details. Returns handle for bulk commenting/removal. If user wants to review items, follow up with `wit-query-handle-get-items`.

**Example 6: Find Incomplete Work Items (Multiple Patterns)**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] = 'Product Backlog Item'",
  "filterByPatterns": ["missing_description", "missing_acceptance_criteria"],
  "maxResults": 100
}
```
Finds Product Backlog Items missing BOTH description AND acceptance criteria. Multiple patterns are applied as AND conditions.

### 2. wit-query-odata

Query Azure DevOps Analytics using OData for efficient aggregations, metrics, and trend analysis.

#### Input Parameters

**Required:**
- `queryType` (string) - Type of analytics query:
  - `workItemCount` - Count work items
  - `groupByState` - Group by state with counts
  - `groupByType` - Group by work item type with counts
  - `groupByAssignee` - Group by assignee with counts
  - `velocityMetrics` - Completion velocity over time
  - `cycleTimeMetrics` - Average cycle time analysis
  - `customQuery` - Custom OData query string

**Optional:**
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `filters` (object) - Filter conditions (e.g., `{ "State": "Active", "WorkItemType": "Bug" }`)
- `groupBy` (array of strings) - Fields to group by for aggregation
- `select` (array of strings) - Specific fields to return
- `orderBy` (string) - Field to order by (e.g., "Count desc")
- `customODataQuery` (string) - Custom OData query for advanced scenarios
- `dateRangeField` (string) - Date field to filter by (CreatedDate, ChangedDate, CompletedDate, ClosedDate)
- `dateRangeStart` (string) - Start date (ISO 8601: YYYY-MM-DD)
- `dateRangeEnd` (string) - End date (ISO 8601: YYYY-MM-DD)
- `areaPath` (string) - Filter by Area Path
- `iterationPath` (string) - Filter by Iteration Path
- `top` (number) - Max results (default 100)
- `computeCycleTime` (boolean) - Compute cycle time for completed items
- `includeMetadata` (boolean) - Include query and URL metadata
- `includeOdataMetadata` (boolean) - Include OData metadata fields

#### Output Format

**Success Response (groupByState):**
```json
{
  "success": true,
  "data": {
    "results": [
      { "State": "Active", "Count": 45 },
      { "State": "New", "Count": 23 },
      { "State": "Resolved", "Count": 12 }
    ],
    "totalCount": 80,
    "metadata": {
      "queryType": "groupByState",
      "queryUrl": "https://analytics.dev.azure.com/..."
    }
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (velocityMetrics):**
```json
{
  "success": true,
  "data": {
    "summary": "Velocity metrics for 163 completed work items",
    "count": 163,
    "results": [
      {
        "WorkItemId": 12345,
        "State": "Closed",
        "CompletedDate": "2024-01-15T10:30:00Z",
        "ClosedDate": "2024-01-15T11:00:00Z",
        "WorkItemType": "User Story",
        "Title": "Implement authentication"
      },
      {
        "WorkItemId": 12346,
        "State": "Done",
        "CompletedDate": "2024-01-16T14:20:00Z",
        "ClosedDate": "2024-01-16T14:30:00Z",
        "WorkItemType": "Bug",
        "Title": "Fix login bug"
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

**Note:** velocityMetrics returns completed work items with their completion dates. It does NOT require or include StoryPoints field - this ensures compatibility with all Azure DevOps projects regardless of whether they track story points.

#### Examples

**Example 1: Count Active Bugs**
```json
{
  "queryType": "workItemCount",
  "filters": {
    "State": "Active",
    "WorkItemType": "Bug"
  }
}
```

**Example 2: Team Velocity**
```json
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-01-01",
  "dateRangeEnd": "2024-01-31",
  "areaPath": "Project\\Team"
}
```

**Example 3: Work Distribution**
```json
{
  "queryType": "groupByAssignee",
  "filters": {
    "State": "Active"
  },
  "orderBy": "Count desc",
  "top": 10
}
```

### 3. wit-ai-generate-wiql

🤖 **AI-POWERED:** Generate valid WIQL queries from natural language with iterative validation.

#### Input Parameters

**Required:**
- `description` (string) - Natural language description of what to find

**Optional:**
- `maxIterations` (number) - Max attempts to generate valid query (1-5, default 3)
- `includeExamples` (boolean) - Include example patterns in prompt (default true)
- `testQuery` (boolean) - Test query by executing it (default true)
- `areaPath` (string) - Override default area path (auto-scopes queries)
- `iterationPath` (string) - Override default iteration path
- `returnQueryHandle` (boolean) - Execute query and return query handle for bulk operations (default false)
- `maxResults` (number) - Max work items when returnQueryHandle=true (1-1000, default 200)
- `includeFields` (string[]) - Additional fields to include when returnQueryHandle=true

#### Output Format

**Success Response (without query handle):**
```json
{
  "success": true,
  "data": {
    "query": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.CreatedDate] >= @Today - 7",
    "isValidated": true,
    "resultCount": 12,
    "sampleResults": [
      { "id": 12345, "title": "Login fails...", "type": "Bug", "state": "Active" }
    ],
    "summary": "Successfully generated WIQL query (found 12 matching work items)"
  },
  "metadata": {
    "source": "ai-sampling-wiql-generator",
    "validated": true,
    "iterationCount": 1,
    "usage": {
      "inputTokens": 150,
      "outputTokens": 50,
      "totalTokens": 200
    }
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (with query handle):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123...",
    "query": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    "work_item_count": 42,
    "work_items": [
      { "id": 12345, "title": "Test Item", "type": "Task", "state": "Active", "url": "..." }
    ],
    "isValidated": true,
    "summary": "Query handle created for 42 work item(s). Use the handle with bulk operation tools...",
    "next_steps": [
      "Review the work_items array to see what will be affected",
      "Use wit-bulk-comment to add comments to all items",
      "Use wit-bulk-update to update fields on all items",
      "Use wit-bulk-assign to assign all items to a user",
      "Use wit-bulk-remove to remove all items",
      "Always use dryRun: true first to preview changes before applying them"
    ],
    "expires_at": "2025-01-20T11:00:00Z"
  },
  "metadata": {
    "source": "ai-sampling-wiql-generator",
    "validated": true,
    "iterationCount": 1,
    "queryHandleMode": true,
    "handle": "qh_abc123...",
    "count": 42
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Generate Query Only (default behavior)**
```json
{
  "description": "all active bugs created in the last week"
}
```
Generates and tests WIQL query: `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.CreatedDate] >= @Today - 7`

**Example 2: Generate Query and Create Handle for Bulk Operations**
```json
{
  "description": "all unassigned tasks in my area",
  "returnQueryHandle": true,
  "maxResults": 100
}
```
Returns query handle along with work items for safe bulk operations.

### 4. wit-ai-generate-odata

🤖 **AI-POWERED:** Generate valid OData Analytics queries from natural language with iterative validation.

🔐 **DEFAULT BEHAVIOR:** Returns a query handle by default for safe bulk operations (as of v1.5.0).

#### Input Parameters

**Required:**
- `description` (string) - Natural language description of analytics query

**Optional:**
- `maxIterations` (number) - Max attempts (1-5, default 3)
- `includeExamples` (boolean) - Include example patterns (default true)
- `testQuery` (boolean) - Test query by executing it (default true)
- `areaPath` (string) - Override default area path
- `iterationPath` (string) - Override default iteration path
- `returnQueryHandle` (boolean) - Return a query handle for safe bulk operations (default true, set to false to get only query text)
- `maxResults` (number) - Max work items to fetch when returnQueryHandle is true (default 200, max 1000)
- `includeFields` (array of strings) - Additional fields to include when returnQueryHandle is true

#### Output Format

**Success Response (with query handle - default):**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123...",
    "query": "$filter=State eq 'Active'",
    "work_item_count": 45,
    "work_items": [
      {
        "WorkItemId": 123,
        "Title": "Bug in login",
        "State": "Active",
        "WorkItemType": "Bug"
      }
    ],
    "isValidated": true,
    "summary": "Query handle created for 45 work item(s)...",
    "next_steps": [
      "Review the work_items array to see what will be affected",
      "Use wit-bulk-comment to add comments to all items",
      "Use wit-bulk-update to update fields on all items"
    ],
    "expires_at": "2025-10-08T01:45:00Z"
  },
  "metadata": {
    "source": "ai-sampling-odata-generator",
    "validated": true,
    "iterationCount": 1,
    "queryHandleMode": true,
    "handle": "qh_abc123...",
    "count": 45
  },
  "errors": [],
  "warnings": []
}
```

**Success Response (query text only - when returnQueryHandle: false):**
```json
{
  "success": true,
  "data": {
    "query": "$filter=State eq 'Active'",
    "isValidated": true,
    "resultCount": 45,
    "sampleResults": [
      { "WorkItemId": 123, "Title": "Bug in login" }
    ],
    "summary": "Successfully generated OData query (found 45 results)"
  },
  "metadata": {
    "source": "ai-sampling-odata-generator",
    "validated": true,
    "iterationCount": 1
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Natural Language Analytics**
```json
{
  "description": "count active bugs by assignee"
}
```
Generates query: `{ "queryType": "groupByAssignee", "filters": { "State": "Active", "WorkItemType": "Bug" } }`

## Configuration

Uses defaults from `.ado-mcp-config.json`:

```json
{
  "organization": "my-org",
  "project": "my-project",
  "defaultAreaPath": "Project\\Team",
  "defaultIterationPath": "Project\\Sprint 10"
}
```

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Invalid WIQL syntax" | Malformed WIQL query | Check field names and syntax |
| "Field not found" | Invalid field reference | Use valid Azure DevOps field names |
| "OData query failed" | Analytics not enabled | Enable Analytics for project |
| "Query timeout" | Query too complex | Add filters to narrow results |
| "AI generation failed" | Natural language unclear | Provide more specific description |

## Performance Considerations

- WIQL queries return max 1000 items per page
- Use pagination for large result sets
- Query handles expire after 1 hour
- OData queries optimized for aggregations
- AI generation uses 2-10 API calls for validation

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/query/*.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/ado-work-item-service.ts`
- **AI Service:** `src/services/analyzers/query-generator.ts`

### Integration Points

- **Azure DevOps Work Items API** - WIQL execution
- **Azure DevOps Analytics API** - OData queries
- **VS Code Sampling API** - AI query generation
- **Query Handle Service** - Safe bulk operations

## Testing

### Test Files

- `test/unit/query/wiql-query.test.ts`
- `test/unit/query/odata-analytics.test.ts`
- `test/integration/query-generation.test.ts`

### Manual Testing

```bash
# Test WIQL query
{
  "tool": "wit-query-wiql",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    "maxResults": 10
  }
}

# Test AI query generation
{
  "tool": "wit-ai-generate-wiql",
  "arguments": {
    "description": "find all bugs assigned to me created this week"
  }
}
```

## Related Features

- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe bulk operations
- [WIQL Hierarchical Queries](./WIQL_HIERARCHICAL_QUERIES.md) - Hierarchy patterns
- [OData Optimization](./ODATA_QUERY_OPTIMIZATION.md) - Performance tips
- [WIQL Best Practices](../guides/WIQL_BEST_PRACTICES.md) - Query patterns

## References

- [WIQL Syntax Reference](https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax)
- [Azure DevOps Analytics](https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/)
- [OData Specification](https://www.odata.org/documentation/)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
