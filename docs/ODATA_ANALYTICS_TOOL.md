# OData Analytics Query Tool

## Overview

The `wit-query-analytics-odata` tool provides efficient access to Azure DevOps Analytics using OData queries. This tool is ideal for **aggregations, metrics, and trend analysis** where you need server-side computation rather than fetching individual work items.

## When to Use This Tool vs WIQL

### Use OData Analytics (`wit-query-analytics-odata`) when:
- ✅ You need **aggregated data** (counts, averages, sums)
- ✅ You want **server-side grouping** (by state, type, assignee, etc.)
- ✅ You need **velocity metrics** or **cycle time analysis**
- ✅ You're building **dashboards** or **reports**
- ✅ You want **better performance** for large datasets with minimal data transfer

### Use WIQL (`wit-get-work-items-by-query-wiql`) when:
- ✅ You need **individual work item details**
- ✅ You want to **filter by complex field criteria**
- ✅ You need **all fields** from specific work items
- ✅ You're performing **CRUD operations** on work items

## Query Types

### 1. Work Item Count
Get the total count of work items matching filters.

```typescript
{
  queryType: "workItemCount",
  filters: { State: "Active", WorkItemType: "Bug" }
}
```

**Returns:**
```json
{
  "results": [{ "Count": 42 }],
  "summary": "Total work items: 42"
}
```

### 2. Group By State
Group work items by their state with counts.

```typescript
{
  queryType: "groupByState",
  filters: { WorkItemType: "Task" }
}
```

**Returns:**
```json
{
  "results": [
    { "State": "Active", "Count": 15 },
    { "State": "New", "Count": 8 },
    { "State": "Done", "Count": 120 }
  ]
}
```

### 3. Group By Type
Group work items by work item type with counts.

```typescript
{
  queryType: "groupByType",
  filters: { State: "Active" }
}
```

**Returns:**
```json
{
  "results": [
    { "WorkItemType": "Task", "Count": 45 },
    { "WorkItemType": "Bug", "Count": 12 },
    { "WorkItemType": "Product Backlog Item", "Count": 8 }
  ]
}
```

### 4. Group By Assignee
Group work items by assignee with counts.

```typescript
{
  queryType: "groupByAssignee",
  filters: { State: "Done" }
}
```

**Returns:**
```json
{
  "results": [
    { "AssignedTo": { "UserName": "john@example.com" }, "Count": 25 },
    { "AssignedTo": { "UserName": "jane@example.com" }, "Count": 18 }
  ]
}
```

### 5. Velocity Metrics
Track completed work items over time (for velocity/burndown charts).

```typescript
{
  queryType: "velocityMetrics",
  dateRangeField: "CompletedDate",
  dateRangeStart: "2024-01-01",
  dateRangeEnd: "2024-12-31",
  top: 30
}
```

**Returns:**
```json
{
  "results": [
    { "CompletedDate": "2024-10-03", "Count": 8 },
    { "CompletedDate": "2024-10-02", "Count": 5 },
    { "CompletedDate": "2024-10-01", "Count": 12 }
  ]
}
```

### 6. Cycle Time Metrics
Calculate average and max cycle time by assignee.

```typescript
{
  queryType: "cycleTimeMetrics",
  computeCycleTime: true,
  filters: { WorkItemType: "Task" }
}
```

**Returns:**
```json
{
  "results": [
    { 
      "AssignedTo": { "UserName": "john@example.com" },
      "AvgCycleTime": 3.5,
      "MaxCycleTime": 15.0
    }
  ]
}
```

### 7. Custom Query
Execute a custom OData query for advanced scenarios.

```typescript
{
  queryType: "customQuery",
  customODataQuery: "$apply=filter(State eq 'Active')/groupby((Priority), aggregate($count as Count))&$orderby=Count desc"
}
```

## Common Parameters

### Filters
Apply filters to narrow down results:

```typescript
{
  filters: {
    State: "Active",
    WorkItemType: "Bug",
    Priority: 1
  }
}
```

### Date Range Filtering
Filter by date ranges:

```typescript
{
  dateRangeField: "CreatedDate",  // or "ChangedDate", "CompletedDate", "ClosedDate"
  dateRangeStart: "2024-01-01",
  dateRangeEnd: "2024-12-31"
}
```

### Area Path Filtering
Filter by specific area paths:

```typescript
{
  areaPath: "MyProject\\MyTeam\\Backend"
}
```

### Iteration Path Filtering
Filter by specific iterations:

```typescript
{
  iterationPath: "MyProject\\Sprint 42"
}
```

### Result Limiting
Limit the number of results:

```typescript
{
  top: 50  // Return top 50 results
}
```

### Ordering
Specify custom ordering:

```typescript
{
  orderBy: "Count desc"  // Order by count descending
}
```

## Examples

### Example 1: Active Bug Count by Priority
```typescript
{
  queryType: "customQuery",
  customODataQuery: "$apply=filter(State eq 'Active' and WorkItemType eq 'Bug')/groupby((Priority), aggregate($count as Count))&$orderby=Priority"
}
```

### Example 2: Team Velocity Last 30 Days
```typescript
{
  queryType: "velocityMetrics",
  dateRangeField: "CompletedDate",
  dateRangeStart: "2024-09-03",
  filters: { State: "Done" },
  areaPath: "MyProject\\MyTeam",
  top: 30
}
```

### Example 3: Average Cycle Time by Team Member
```typescript
{
  queryType: "cycleTimeMetrics",
  computeCycleTime: true,
  filters: { WorkItemType: "Product Backlog Item" },
  areaPath: "MyProject\\MyTeam"
}
```

### Example 4: Work Distribution Across Types
```typescript
{
  queryType: "groupByType",
  filters: { State: "Active" },
  areaPath: "MyProject",
  orderBy: "Count desc"
}
```

## OData Query Reference

The tool builds OData queries following the Azure DevOps Analytics API v4.0-preview specification.

### Common OData Patterns

**Aggregation with Count:**
```
$apply=aggregate($count as Count)
```

**Filtering:**
```
$apply=filter(State eq 'Active')
```

**Grouping:**
```
$apply=groupby((State), aggregate($count as Count))
```

**Computing Cycle Time:**
```
$apply=compute((CompletedDate sub CreatedDate) div duration'P1D' as CycleTimeDays)
```

**Combining Operations:**
```
$apply=filter(State eq 'Done')/groupby((AssignedTo/UserName), aggregate($count as Count))&$orderby=Count desc
```

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": {
    "results": [...],          // Array of result objects
    "count": 42,               // Number of results
    "queryType": "groupByState",
    "query": "...",            // OData query executed
    "summary": "..."           // Human-readable summary
  },
  "metadata": {
    "source": "odata-analytics",
    "queryType": "groupByState",
    "count": 42,
    "analyticsUrl": "..."      // Full Analytics API URL (PAT redacted)
  },
  "errors": [],
  "warnings": []
}
```

## Performance Considerations

1. **Server-side Aggregation**: Analytics performs aggregation on the server, reducing data transfer
2. **Limited Result Sets**: Use `top` parameter to limit results
3. **Efficient Grouping**: Grouping is optimized in the Analytics service
4. **Date Filtering**: Always filter by date ranges when possible
5. **Avoid Custom Queries**: Use predefined query types when possible for better optimization

## Limitations

1. Analytics API has a **30-second timeout** for queries
2. Results are limited by the **`top` parameter** (default 100)
3. Some fields may not be available in Analytics (use WIQL for those)
4. Analytics data has **slight latency** (typically < 5 minutes)

## Error Handling

Common errors:

- **Authentication Error**: Ensure ADO_PAT environment variable is set
- **Invalid Filter**: Check field names and values
- **Timeout**: Simplify query or add more specific filters
- **Not Found**: Verify organization and project names

## Related Tools

- `wit-get-work-items-by-query-wiql` - For detailed work item queries
- `wit-get-work-item-context-package` - For single work item details
- `wit-get-work-items-context-batch` - For batch work item retrieval

## Resources

- [Azure DevOps Analytics Documentation](https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/wit-analytics)
- [OData v4.0 Specification](https://www.odata.org/documentation/)
- [Analytics Quick Reference](https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/quick-ref)
