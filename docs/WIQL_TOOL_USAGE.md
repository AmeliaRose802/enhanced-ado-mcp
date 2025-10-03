# WIQL Tool Usage Guide

## Tool Name
`wit-get-work-items-by-query-wiql`

## Status
✅ **WORKING** - Verified October 2, 2025

## Correct Parameter Format

**⚠️ IMPORTANT:** All parameters must use **camelCase** (not PascalCase)

### Required Parameters
- `wiqlQuery` (string) - The WIQL query string

### Optional Parameters
- `organization` (string) - Azure DevOps organization name (auto-filled from config)
- `project` (string) - Azure DevOps project name (auto-filled from config)
- `includeFields` (array of strings) - Additional fields to include
- `maxResults` (number) - Maximum number of results to return (default: 200)

## Example: Correct Usage ✅

```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
  "maxResults": 5
}
```

## Example: Incorrect Usage ❌

```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "MaxResults": 5
}
```

**Error you'll see:**
```
Validation error: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["wiqlQuery"],
    "message": "Required"
  }
]
```

## Common WIQL Query Examples

### Get Active Work Items
```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] = 'Active'"
}
```

### Get Work Items by Area Path
```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.AreaPath] UNDER 'ProjectName\\AreaName'"
}
```

### Get Recent Changes
```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.ChangedDate] FROM WorkItems ORDER BY [System.ChangedDate] DESC",
  "maxResults": 10
}
```

### Get Work Items with Additional Fields
```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = 'Bug'",
  "includeFields": ["System.Description", "Microsoft.VSTS.Common.Priority", "System.AssignedTo"]
}
```

## Troubleshooting

### Problem: "Validation error: Required parameter not found"
**Solution:** Check that you're using `wiqlQuery` (lowercase 'w'), not `WiqlQuery` (uppercase 'W')

### Problem: Tool returns empty results
**Solution:** 
- Verify your WIQL syntax is correct
- Check that you have access to the project/organization
- Ensure Azure CLI is logged in: `az login`

### Problem: "Azure CLI validation failed"
**Solution:**
1. Install Azure CLI
2. Login: `az login`
3. Install Azure DevOps extension: `az extension add --name azure-devops`

## Testing the Tool

You can test the tool directly:

```bash
# Verify it works with correct parameters
node -e "
import('C:/Users/ameliapayne/ADO-Work-Item-MSP/mcp_server/test-wiql-tool.js')
  .then(() => console.log('Test complete'))
  .catch(err => console.error(err));
"
```

## Migration from PascalCase

If you were using the old PascalCase format, here's the mapping:

| Old (PascalCase) ❌ | New (camelCase) ✅ |
|---------------------|-------------------|
| `WiqlQuery` | `wiqlQuery` |
| `Organization` | `organization` |
| `Project` | `project` |
| `IncludeFields` | `includeFields` |
| `MaxResults` | `maxResults` |

## Client Cache Issues

If you're still getting validation errors after updating your parameters:

1. **Restart your MCP client** - The client may have cached the old schema
2. **Rebuild the server** - `cd mcp_server && npm run build`
3. **Restart VS Code** - If using the MCP server in VS Code
4. **Clear cache** - Delete any client-side cache of the tool schema

## Verified Test Result

```json
// Input (correct camelCase)
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
  "maxResults": 5
}

// Output
{
  "success": true,
  "data": {
    "work_items": [...],
    "count": 0,
    "query": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
    "summary": "Found 0 work item(s) matching the query"
  },
  "metadata": {
    "source": "rest-api-wiql",
    "count": 0,
    "maxResults": 5,
    "substantiveChangeAnalysis": false
  },
  "errors": [],
  "warnings": []
}
```

✅ **Status: VERIFIED WORKING** - October 2, 2025
