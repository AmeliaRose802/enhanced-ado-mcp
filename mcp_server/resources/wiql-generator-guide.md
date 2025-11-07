# WIQL Query Generator - AI-Powered Natural Language to Query

## Overview

The **WIQL Query Generator** (`wit-generate-wiql-query`) is an AI-powered tool that converts natural language descriptions into valid WIQL (Work Item Query Language) queries. It uses iterative refinement with automatic validation to ensure the generated queries work correctly.

## Why Use This Tool?

- **No WIQL Knowledge Required**: Describe what you want in plain English
- **Automatic Validation**: Tests queries and fixes syntax errors automatically
- **Iterative Refinement**: Learns from errors and improves the query
- **Best Practices**: Generates queries following Azure DevOps best practices
- **Prevents Common Mistakes**: Avoids issues like ORDER BY in WorkItemLinks queries

## Basic Usage

```typescript
{
  "description": "Find all active bugs created in the last 7 days",
  "testQuery": true,
  "maxIterations": 3
}
```

## Natural Language Examples

### Simple Queries

**"All active bugs"**
```sql
SELECT [System.Id], [System.Title], [System.State]
FROM WorkItems
WHERE [System.WorkItemType] = 'Bug'
AND [System.State] = 'Active'
ORDER BY [System.CreatedDate] DESC
```

**"Unassigned tasks"**
```sql
SELECT [System.Id], [System.Title]
FROM WorkItems
WHERE [System.WorkItemType] = 'Task'
AND [System.AssignedTo] = ''
AND [System.State] NOT IN ('Closed', 'Removed')
```

### Time-Based Queries

**"Items modified in the last week"**
```sql
SELECT [System.Id], [System.Title], [System.ChangedDate]
FROM WorkItems
WHERE [System.ChangedDate] >= @Today-7
ORDER BY [System.ChangedDate] DESC
```

**"Bugs created this month"**
```sql
SELECT [System.Id], [System.Title], [System.CreatedDate]
FROM WorkItems
WHERE [System.WorkItemType] = 'Bug'
AND [System.CreatedDate] >= @Today-30
```

### Hierarchical Queries

**"All children of work item 12345"**
```sql
SELECT [System.Id]
FROM WorkItemLinks
WHERE [Source].[System.Id] = 12345
AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
MODE (Recursive)
```

**"Features in a specific area"**
```sql
SELECT [System.Id], [System.Title]
FROM WorkItems
WHERE [System.WorkItemType] = 'Feature'
AND [System.AreaPath] UNDER 'MyProject\\MyTeam'
AND [System.State] <> 'Removed'
```

### Complex Queries

**"High priority bugs assigned to me that are not closed"**
```sql
SELECT [System.Id], [System.Title], [System.Priority]
FROM WorkItems
WHERE [System.WorkItemType] = 'Bug'
AND [System.Priority] = 1
AND [System.AssignedTo] = @Me
AND [System.State] NOT IN ('Closed', 'Resolved', 'Removed')
ORDER BY [System.CreatedDate] DESC
```

**"All work items in current iteration"**
```sql
SELECT [System.Id], [System.Title], [System.WorkItemType]
FROM WorkItems
WHERE [System.IterationPath] = @CurrentIteration
AND [System.State] NOT IN ('Removed', 'Closed')
ORDER BY [System.WorkItemType], [System.Priority]
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `description` | string | *required* | Natural language description of desired query |
| `maxIterations` | number | 3 | Maximum attempts to generate valid query (1-5) |
| `testQuery` | boolean | true | Execute query to validate syntax |
| `includeExamples` | boolean | true | Include example patterns in AI prompt |
| `areaPath` | string | - | Optional area path context |
| `iterationPath` | string | - | Optional iteration path context |
| `returnQueryHandle` | boolean | false | Execute query and return query handle for bulk operations |
| `maxResults` | number | 200 | Max work items when returnQueryHandle=true (1-1000) |
| `includeFields` | string[] | - | Additional fields when returnQueryHandle=true |

## Response Structure

**Without Query Handle (default):**
```json
{
  "success": true,
  "data": {
    "query": "SELECT [System.Id] FROM WorkItems WHERE...",
    "isValidated": true,
    "resultCount": 42,
    "sampleResults": [
      { "id": 123, "title": "Example Bug", "type": "Bug", "state": "Active" }
    ],
    "summary": "Successfully generated WIQL query (found 42 matching work items)"
  },
  "metadata": {
    "source": "ai-sampling-wiql-generator",
    "validated": true,
    "iterationCount": 1,
    "usage": { "inputTokens": 150, "outputTokens": 50, "totalTokens": 200 }
  }
}
```

**With Query Handle:**
```json
{
  "success": true,
  "data": {
    "query_handle": "qh_abc123...",
    "query": "SELECT [System.Id] FROM WorkItems WHERE...",
    "work_item_count": 42,
    "work_items": [
      { "id": 123, "title": "Test Item", "type": "Task", "state": "Active", "url": "..." }
    ],
    "isValidated": true,
    "summary": "Query handle created for 42 work item(s). Use the handle with bulk operation tools...",
    "next_steps": [
      "Review the work_items array to see what will be affected",
      "Use wit-bulk-comment to add comments to all items",
      "Use wit-bulk-update to update fields on all items",
      "Always use dryRun: true first to preview changes"
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
  }
}
```

## How It Works

1. **Natural Language Parsing**: AI understands your intent
2. **Query Generation**: Creates syntactically correct WIQL
3. **Validation**: Tests the query against your Azure DevOps instance
4. **Error Detection**: Catches syntax errors and common mistakes
5. **Refinement**: If validation fails, generates improved query with error context
6. **Iteration**: Repeats up to `maxIterations` times until successful

## Common Patterns Recognized

### Work Item Types
- "bugs", "tasks", "features", "epics", "user stories"
- "Product Backlog Items", "PBIs"

### States
- "active", "new", "closed", "resolved", "removed"
- "in progress", "done", "completed"

### Assignment
- "assigned to me", "unassigned", "assigned to [email]"
- "@me", "my items"

### Time References
- "today", "this week", "last 7 days", "this month"
- "created recently", "modified in the last N days"

### Hierarchy
- "children of", "parent", "descendants"
- "under [area path]", "in [iteration]"

### Priority/Severity
- "high priority", "critical", "P1", "P2"
- "severity 1", "blocker"

## Best Practices

### ✅ Good Descriptions

- **Specific and clear**: "Find all active bugs in MyProject area created in last 30 days"
- **Use work item type names**: "Get all Features in current iteration"
- **Include state criteria**: "List unassigned tasks that are not closed"
- **Mention time ranges**: "Show items modified this week"

### ❌ Avoid

- **Vague requests**: "Find stuff" (too ambiguous)
- **Complex logic**: Better to describe one clear query than multiple conditions
- **Custom field names without context**: Mention full field reference names if possible

## Error Handling

The tool automatically detects and fixes common WIQL errors:

### ORDER BY with WorkItemLinks
```
❌ Error: ORDER BY not supported in WorkItemLinks queries
✅ Fix: Removes ORDER BY or converts to WorkItems query
```

### Invalid Field Names
```
❌ Error: Invalid field 'Status'
✅ Fix: Corrects to [System.State]
```

### Syntax Errors
```
❌ Error: Missing brackets around field name
✅ Fix: Adds proper [System.FieldName] syntax
```

## Workflow Integration

### Step 1: Generate Query Only
```typescript
{
  "description": "All features in active state under Engineering area",
  "testQuery": true
}
```

Returns just the query text with validation results.

### Step 2a: Use Generated Query Directly
Copy the validated query from response and use it with:
- `wit-wiql-query` - Execute the query
- Save to documentation for reuse
- Modify and refine as needed

### Step 2b: Generate Query + Handle (One Step)
```typescript
{
  "description": "All features in active state under Engineering area",
  "returnQueryHandle": true,
  "maxResults": 100
}
```

Returns query handle immediately for bulk operations - **this is the recommended approach** as it combines generation and handle creation in one step.

### Step 3: Use Query Handle with Bulk Operations
```typescript
{
  "queryHandle": "qh_abc123...",
  "dryRun": true  // Always preview first!
}
```

Then use query handle with:
- `wit-bulk-comment-by-query-handle` - Add comments
- `wit-bulk-update-by-query-handle` - Update fields
- `wit-bulk-assign-by-query-handle` - Reassign items
- `wit-bulk-remove-by-query-handle` - Delete items

## Tips for Better Results

1. **Be Specific**: More details = better query
2. **Use Standard Terms**: Stick to Azure DevOps terminology
3. **Test Incrementally**: Start simple, then add complexity
4. **Provide Context**: Include areaPath/iterationPath if relevant
5. **Review Results**: Check sample results to verify correctness

## Limitations

- Maximum 5 iterations per request
- Query complexity limited by AI model capabilities
- Custom fields may require explicit reference names
- Validation requires Azure DevOps access

## See Also

- [WIQL Quick Reference](./wiql-quick-reference.md) - Manual WIQL patterns
- [WIQL Best Practices](../docs/WIQL_BEST_PRACTICES.md) - Common pitfalls
- [Query Handle Pattern](./query-handle-pattern.md) - Using queries with bulk operations
