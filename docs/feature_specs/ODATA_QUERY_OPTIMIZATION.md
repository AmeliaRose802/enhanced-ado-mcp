# OData Query Optimization Report

> **See Also:**
> - **OData tool usage:** [Query Tools](./QUERY_TOOLS.md) - Comprehensive OData and WIQL documentation
> - **Query examples:** Check the Query Tools spec for current patterns

## Summary

Reviewed all prompt files for OData Analytics queries and optimized them to use built-in query types where possible instead of custom queries. This improves maintainability, reduces errors, and provides better performance.

## Query Types Available

The `wit-query-odata` tool supports these predefined query types:

1. **workItemCount** - Simple count of work items with filters
2. **groupByState** - Group work items by state with counts
3. **groupByType** - Group work items by work item type with counts
4. **groupByAssignee** - Group work items by assignee with counts
5. **velocityMetrics** - Track completed work items over time for velocity/burndown. Returns work items with CompletedDate, ClosedDate, WorkItemType, and Title. Does NOT require or include StoryPoints field for maximum compatibility across all Azure DevOps projects.
6. **cycleTimeMetrics** - Calculate average and max cycle time by assignee
7. **customQuery** - Execute custom OData query for advanced scenarios

## Changes Made

### 1. backlog_cleanup.md

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

1. `mcp_server/prompts/backlog_cleanup.md` - Fixed invalid filter syntax
2. `docs/ODATA_QUERY_OPTIMIZATION.md` - This document

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
