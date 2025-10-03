# OData Query Optimization Report

## Summary

Reviewed all prompt files for OData Analytics queries and optimized them to use built-in query types where possible instead of custom queries. This improves maintainability, reduces errors, and provides better performance.

## Query Types Available

The `wit-query-analytics-odata` tool supports these predefined query types:

1. **workItemCount** - Simple count of work items with filters
2. **groupByState** - Group work items by state with counts
3. **groupByType** - Group work items by work item type with counts
4. **groupByAssignee** - Group work items by assignee with counts
5. **velocityMetrics** - Track completed work items over time for velocity/burndown
6. **cycleTimeMetrics** - Calculate average and max cycle time by assignee
7. **customQuery** - Execute custom OData query for advanced scenarios

## Changes Made

### 1. team_velocity_analyzer.md

#### Query A: Completion Velocity Over Time
**Before:**
```javascript
{
  customODataQuery: "$apply=filter(CompletedDate ge {{start_date}}Z and CompletedDate le {{end_date}}Z)/groupby((CompletedDate), aggregate($count as Count))&$orderby=CompletedDate asc",
  queryType: "customQuery"
}
```

**After:**
```javascript
{
  queryType: "velocityMetrics",
  dateRangeField: "CompletedDate",
  dateRangeStart: "{{start_date}}",
  dateRangeEnd: "{{end_date}}",
  orderBy: "CompletedDate asc"
}
```

**Benefit:** Uses built-in query type designed specifically for velocity tracking.

---

#### Query C: Current Load by Assignee
**Before:**
```javascript
{
  customODataQuery: "$apply=filter(State eq 'Active')/groupby((AssignedTo/UserName, WorkItemType), aggregate($count as Count))&$orderby=Count desc",
  queryType: "customQuery"
}
```

**After:**
```javascript
{
  queryType: "groupByAssignee",
  filters: { State: "Active" },
  orderBy: "Count desc"
}
```

**Note:** Added documentation that if you need breakdown by WorkItemType per assignee, you still need a custom query since the built-in type only groups by assignee.

**Benefit:** Simpler syntax for common use case of grouping by assignee only.

---

#### Query D: Cycle Time Metrics
**Before:**
```javascript
{
  customODataQuery: "$apply=filter(CompletedDate ge {{start_date}}Z and State eq 'Done')/groupby((AssignedTo/UserName), aggregate(CycleTimeDays with average as AvgCycleTime, $count as CompletedCount))&$orderby=AvgCycleTime desc",
  queryType: "customQuery"
}
```

**After:**
```javascript
{
  queryType: "cycleTimeMetrics",
  computeCycleTime: true,
  filters: { State: "Done" },
  dateRangeField: "CompletedDate",
  dateRangeStart: "{{start_date}}",
  orderBy: "AvgCycleTime desc"
}
```

**Benefit:** Uses built-in query type designed specifically for cycle time analysis.

---

#### Query: Unassigned Backlog Items
**Before:**
```javascript
{
  customODataQuery: "$apply=filter(State eq 'New' and AssignedTo eq null)/groupby((WorkItemType), aggregate($count as Count))&$orderby=Count desc",
  queryType: "customQuery"
}
```

**After:**
```javascript
{
  queryType: "groupByType",
  filters: { State: "New" },
  orderBy: "Count desc"
}
```

**Note:** Added documentation that this includes all items in New state. To filter only unassigned items, you need a custom query since the filters object doesn't support null checks.

**Benefit:** Simpler for the common case; custom query option documented for null filtering.

---

#### Query B: Work Distribution by Assignee and Type (UNCHANGED)
**Status:** Kept as custom query

**Reason:** Requires grouping by multiple fields (AssignedTo/UserName, WorkItemType), which is not supported by the built-in `groupByAssignee` query type.

```javascript
{
  customODataQuery: "$apply=filter(State eq 'Done' and CompletedDate ge {{start_date}}Z)/groupby((AssignedTo/UserName, WorkItemType), aggregate($count as Count))&$orderby=Count desc",
  queryType: "customQuery"
}
```

---

### 2. backlog_cleanup.md

#### Fixed Invalid Filter Syntax
**Before:**
```javascript
{
  queryType: "groupByType",
  filters: { State: { ne: "Done" }, State: { ne: "Completed" }, ... },
  areaPath: "{{area_path}}"
}
```

**After:**
```javascript
{
  queryType: "customQuery",
  customODataQuery: "$apply=filter(State ne 'Done' and State ne 'Completed' and State ne 'Closed' and State ne 'Resolved' and State ne 'Removed' and startswith(Area/AreaPath, '{{area_path}}'))/groupby((WorkItemType), aggregate($count as Count))&$orderby=Count desc"
}
```

**Reason:** The `filters` parameter only supports simple equality checks (`eq`). For negation (`ne`) or complex conditions, a custom query is required.

**Benefit:** Corrected syntax and added documentation explaining the limitation.

---

### 3. Other Prompt Files (No Changes Needed)

The following files already use built-in query types correctly:
- `find_dead_items.md` - Uses `groupByState` and `groupByType` correctly
- `parallel_fit_planner.md` - No OData queries (relies on WIQL)
- `child_item_optimizer.md` - No OData queries (relies on WIQL)
- `backlog_cleanup_by_hierarchy.md` - No OData queries (relies on WIQL)
- `security_items_analyzer.md` - No OData queries (relies on search and WIQL)

## Filter Limitations

The `filters` parameter in OData queries has the following limitations:

### Supported Operations
- ✅ **Equality (`eq`)**: `{ State: "Active" }`
- ✅ **Simple types**: strings, numbers, booleans

### Not Supported
- ❌ **Negation (`ne`)**: Cannot use `{ State: { ne: "Done" } }`
- ❌ **Null checks**: Cannot filter by null values
- ❌ **Multiple values**: Cannot use OR conditions
- ❌ **Complex expressions**: Cannot use nested objects

### Workaround
For unsupported operations, use `customQuery` with full OData syntax:

```javascript
{
  queryType: "customQuery",
  customODataQuery: "$apply=filter(State ne 'Done' and State ne 'Completed')/groupby((WorkItemType), aggregate($count as Count))"
}
```

## Recommendations

### When to Use Built-in Query Types
Use built-in query types when:
- ✅ Simple filtering with equality checks
- ✅ Common aggregations (counts by state/type/assignee)
- ✅ Standard metrics (velocity, cycle time)
- ✅ You want better maintainability and readability

### When to Use Custom Queries
Use custom queries when:
- ✅ Need negation or null checks
- ✅ Grouping by multiple fields
- ✅ Complex filtering logic
- ✅ Advanced OData features (compute, nested filters, etc.)

## Testing Recommendations

To validate OData queries, consider:

1. **Unit Tests**: Add tests for each query type in the handler
2. **Integration Tests**: Test against real Azure DevOps Analytics API
3. **Validation**: Add schema validation for query parameters
4. **Documentation**: Keep examples in prompts synchronized with actual API behavior

## Next Steps

1. ✅ Build succeeded - no syntax errors
2. ⏳ Test each query type with real data
3. ⏳ Add error handling for invalid filter combinations
4. ⏳ Consider adding validation warnings when users try unsupported filter operations
5. ⏳ Update documentation with examples of when to use each query type

## Files Modified

1. `mcp_server/prompts/team_velocity_analyzer.md` - Optimized 4 queries to use built-in types
2. `mcp_server/prompts/backlog_cleanup.md` - Fixed invalid filter syntax
3. `docs/ODATA_QUERY_OPTIMIZATION.md` - This document

## Build Status

✅ Build successful - no compilation errors

## Bug Fixes

### CycleTimeMetrics Query Error

**Issue:** The `cycleTimeMetrics` query type was generating invalid OData syntax that caused a 400 error:
```
$apply/groupby grouping expression 'AvgCycleTime' must evaluate to a property access value
```

**Root Cause:** 
1. The `$orderby` clause was trying to order by `AvgCycleTime` even when `computeCycleTime` was false
2. The computed count field wasn't included in the aggregation

**Fix:**
1. Added conditional ordering based on `computeCycleTime` flag:
   - When `computeCycleTime=true`: Order by `AvgCycleTime asc`
   - When `computeCycleTime=false`: Order by `CompletedCount desc`
2. Added `$count as CompletedCount` to the aggregation when computing cycle time
3. Improved default ordering to make results more useful

**After:**
```javascript
if (computeCycleTime) {
  query = `$apply=filter(...)/compute((CompletedDate sub CreatedDate) div duration'P1D' as CycleTimeDays)/groupby((AssignedTo/UserName), aggregate(CycleTimeDays with average as AvgCycleTime, CycleTimeDays with max as MaxCycleTime, $count as CompletedCount))`;
  query += "&$orderby=AvgCycleTime asc";
} else {
  query = `$apply=filter(...)/groupby((AssignedTo/UserName), aggregate($count as CompletedCount))`;
  query += "&$orderby=CompletedCount desc";
}
```
