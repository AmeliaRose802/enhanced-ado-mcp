# OData Analytics Quick Reference

Essential OData query patterns for metrics and aggregations.

## When to Use OData vs WIQL

**Use OData Analytics for:**
- ✅ Counts and aggregations
- ✅ Velocity metrics
- ✅ Cycle time analysis
- ✅ Grouping operations
- ✅ Dashboard metrics

**Use WIQL for:**
- ✅ Individual work item details
- ✅ Complex field filtering
- ✅ Hierarchy traversal
- ✅ Getting full work item data

## Quick Query Patterns

### 1. Count Active Items
```json
{
  "queryType": "workItemCount",
  "filters": {
    "State": "Active"
  }
}
```

### 2. Count by Type
```json
{
  "queryType": "groupByType",
  "filters": {
    "State": "Active"
  }
}
```
**Returns:** `[{"workItemType": "Task", "Count": 45}, ...]`

### 3. Count by State
```json
{
  "queryType": "groupByState",
  "filters": {
    "workItemType": "Bug"
  }
}
```
**Returns:** `[{"State": "Active", "Count": 12}, ...]`

### 4. Count by Assignee
```json
{
  "queryType": "groupByAssignee",
  "filters": {
    "State": "Active"
  }
}
```
**Returns:** `[{"AssignedTo": {"UserName": "john@example.com"}, "Count": 8}, ...]`

## Date Range Queries

### Velocity Over Last 30 Days
```json
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-09-03",
  "dateRangeEnd": "2024-10-03",
  "filters": {
    "State": "Done"
  },
  "top": 30
}
```
**Returns:** Daily completion counts

### Recently Created Items
```json
{
  "queryType": "groupByType",
  "dateRangeField": "CreatedDate",
  "dateRangeStart": "2024-09-01",
  "filters": {
    "State": "Active"
  }
}
```

## Cycle Time Analysis

### Cycle Time by Team Member
```json
{
  "queryType": "cycleTimeMetrics",
  "computeCycleTime": true,
  "filters": {
    "workItemType": "Product Backlog Item"
  }
}
```
**Returns:** Average and max cycle time per assignee

### Cycle Time for Specific Area
```json
{
  "queryType": "cycleTimeMetrics",
  "computeCycleTime": true,
  "areaPath": "MyProject\\MyTeam",
  "filters": {
    "State": "Done"
  }
}
```

## Area Path Filtering

### Count Items in Specific Area
```json
{
  "queryType": "workItemCount",
  "areaPath": "MyProject\\Backend",
  "filters": {
    "State": "Active"
  }
}
```

### Team Distribution
```json
{
  "queryType": "groupByType",
  "areaPath": "MyProject\\Backend"
}
```

## Custom Queries

### Group by Priority
```json
{
  "queryType": "customQuery",
  "customODataQuery": "$apply=filter(State eq 'Active')/groupby((Priority), aggregate($count as Count))&$orderby=Priority"
}
```

### Active Bugs by Severity
```json
{
  "queryType": "customQuery",
  "customODataQuery": "$apply=filter(WorkItemType eq 'Bug' and State eq 'Active')/groupby((Severity), aggregate($count as Count))&$orderby=Count desc"
}
```

### Items Created This Week by Type
```json
{
  "queryType": "customQuery",
  "customODataQuery": "$apply=filter(CreatedDate ge 2024-10-01)/groupby((WorkItemType), aggregate($count as Count))&$orderby=Count desc"
}
```

## Common Use Cases

### Sprint Metrics
```json
{
  "queryType": "groupByState",
  "iterationPath": "MyProject\\Sprint 42"
}
```

### Team Velocity
```json
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-09-01",
  "areaPath": "MyProject\\MyTeam",
  "top": 30
}
```

### Bug Distribution
```json
{
  "queryType": "groupByState",
  "filters": {
    "workItemType": "Bug"
  }
}
```

### Work Distribution
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

## Performance Tips

1. **Always use filters** to reduce dataset size
2. **Specify date ranges** when analyzing time-based data
3. **Limit results with top** parameter (default 100)
4. **Use predefined queryTypes** instead of custom queries when possible
5. **Avoid broad queries** across entire organization

## Response Structure

```json
{
  "success": true,
  "data": {
    "results": [...],
    "count": 42,
    "queryType": "groupByState",
    "summary": "Human readable summary"
  }
}
```

## Common Filters

```json
{
  "filters": {
    "State": "Active",
    "workItemType": "Task",
    "Priority": 1,
    "Severity": "2 - High"
  },
  "areaPath": "MyProject\\MyArea",
  "iterationPath": "MyProject\\Sprint 42",
  "dateRangeField": "CreatedDate",
  "dateRangeStart": "2024-01-01",
  "dateRangeEnd": "2024-12-31"
}
```

## Field Names Reference

- **Date Fields**: `CreatedDate`, `ChangedDate`, `CompletedDate`, `ClosedDate`
- **Filter Fields**: `State`, `WorkItemType`, `Priority`, `Severity`
- **Path Fields**: `AreaPath`, `IterationPath`
- **Computed Fields**: `CycleTimeDays` (when computeCycleTime: true)




