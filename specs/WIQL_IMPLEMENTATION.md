# WIQL Query Tool Implementation Summary

## Overview
Implemented `wit-get-work-items-by-query-wiql` tool as requested by beta testers. This tool allows querying Azure DevOps work items using WIQL (Work Item Query Language).

## Implementation Details

### Files Modified
1. **src/config/schemas.ts** - Added `wiqlQuerySchema` with Zod validation
2. **src/config/tool-configs.ts** - Added tool configuration and MCP schema
3. **src/services/ado-work-item-service.ts** - Implemented `queryWorkItemsByWiql()` function
4. **src/services/tool-service.ts** - Wired up the tool handler
5. **README.md** - Added documentation and usage examples
6. **src/test/wiql-query.test.ts** - Created test suite

### Features Implemented

#### Core Functionality
- Execute WIQL queries via Azure DevOps REST API
- Return work item details including Id, Title, Type, State, AreaPath, IterationPath, AssignedTo
- Support for custom field selection via `IncludeFields` parameter
- Result limiting with `MaxResults` parameter (default: 200)

#### Configuration Defaults
- Organization and Project inherited from MCP config
- Authentication via Azure CLI (consistent with other tools)
- Temporary file handling for JSON payload (avoids shell escaping issues)

#### Error Handling
- Validates Azure CLI availability and login status
- Zod schema validation for input parameters
- Graceful handling of empty result sets
- Warning when results are truncated

### Tool Schema

```typescript
{
  name: "wit-get-work-items-by-query-wiql",
  inputSchema: {
    WiqlQuery: string (required) - WIQL query to execute
    Organization: string (optional) - Defaults from config
    Project: string (optional) - Defaults from config
    IncludeFields: string[] (optional) - Additional fields to include
    MaxResults: number (optional) - Default 200
  }
}
```

### Response Format

```json
{
  "success": true,
  "data": {
    "work_items": [
      {
        "id": 12345,
        "title": "Work item title",
        "type": "Task",
        "state": "Active",
        "areaPath": "Project\\Team",
        "iterationPath": "Sprint 1",
        "assignedTo": "user@example.com",
        "url": "https://dev.azure.com/org/project/_workitems/edit/12345",
        "fields": {
          "System.Id": 12345,
          "System.Title": "Work item title",
          // ... all requested fields
        }
      }
    ],
    "count": 1,
    "query": "SELECT [System.Id] FROM WorkItems...",
    "summary": "Found 1 work item(s) matching the query"
  }
}
```

## Usage Examples

### Simple Query
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
}
```

### Query with Area Path Filter
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam'",
  "MaxResults": 50
}
```

### Query with Additional Fields
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug'",
  "IncludeFields": [
    "System.Description",
    "Microsoft.VSTS.Common.Priority",
    "System.Tags"
  ]
}
```

## Testing

Created `src/test/wiql-query.test.ts` with test coverage for:
- Basic WIQL queries
- Area path filtering
- Additional field inclusion
- Work item type filtering
- Empty result handling

Build completed successfully with no errors related to the new implementation.

## Documentation

Updated README.md with:
- Tool listing in Configuration & Discovery Tools section
- Comprehensive WIQL Query Examples section
- Reference to official Azure DevOps WIQL documentation

## Benefits for Beta Testers

1. **Flexible Querying** - Full WIQL syntax support enables complex filtering and sorting
2. **Bulk Operations** - Fetch multiple work items efficiently in a single API call
3. **Custom Fields** - Request specific fields to optimize data transfer
4. **Integration Ready** - Consistent with existing tool patterns and error handling
5. **Well Documented** - Examples and documentation for common use cases

## Next Steps

1. Beta testers can now use the tool via MCP clients
2. Gather feedback on WIQL query patterns most commonly needed
3. Consider adding query templates for common scenarios
4. Monitor performance with large result sets

## Technical Notes

- Uses temporary file approach to avoid PowerShell escaping issues with complex WIQL queries
- Leverages existing `getAzureDevOpsToken()` and error handling patterns
- Compatible with both VS Code and Claude Desktop MCP clients
- No sampling/AI features required - pure REST API implementation
