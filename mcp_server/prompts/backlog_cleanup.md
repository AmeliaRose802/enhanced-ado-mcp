---
name: backlog_cleanup
description: Assess Azure DevOps backlog health and identify improvement opportunities under a specific Area Path.
version: 5
arguments: {}
---

Assess backlog health within area path `{{area_path}}`. Identify quality issues, stale items, and improvement opportunities. **Exclude Done/Completed/Closed/Resolved states** - focus on active work items only. Analysis only - do not modify work items.

**Configuration:**
- Area Path: `{{area_path}}`
- Max Age: `{{max_age_days}}` days

**Available Tools:**
- `wit-query-analytics-odata` - Aggregated metrics (counts, distributions)
- `wit-get-work-items-by-query-wiql` - Work item retrieval with `includeSubstantiveChange: true` ⚠️ **Pagination:** Returns first 200 items by default. Use `skip` and `top` parameters for larger result sets (e.g., `skip: 200, top: 200` for next page).
- `wit-get-work-items-context-batch` - Batch context (limit 20-30 items per call)
- `wit-detect-patterns` - Pattern identification

### Analysis Steps

1. **Get high-level metrics** (use OData first):
   ```
   Tool: wit-query-analytics-odata
   Arguments: {
     queryType: "groupByState",
     filters: {},
     areaPath: "{{area_path}}"
   }
   ```
   
   Work item type distribution (exclude completed):
   ```
   Tool: wit-query-analytics-odata
   Arguments: {
     queryType: "customQuery",
     customODataQuery: "$apply=filter(State ne 'Done' and State ne 'Completed' and State ne 'Closed' and State ne 'Resolved' and State ne 'Removed' and startswith(Area/AreaPath, '{{area_path}}'))/groupby((WorkItemType), aggregate($count as Count))&$orderby=Count desc"
   }
   ```

2. **Get work items with activity data**:
   ```
   Tool: wit-get-work-items-by-query-wiql
   Arguments: {
     wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.ChangedDate] ASC",
     includeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo", "System.WorkItemType"],
     includeSubstantiveChange: true,
     substantiveChangeHistoryCount: 50,
     maxResults: 200
   }
   ```
   Returns items with `lastSubstantiveChangeDate` and `daysInactive` fields.

3. **Get additional context if needed**: Use `wit-get-work-items-context-batch` (20-30 items max per call) for descriptions, tags, relationships.

4. **Analyze and report**: Use `daysInactive` and quality indicators to generate health report.

---

### Quality Check Queries

**All queries use `includeSubstantiveChange: true` to get activity data.**

#### Missing Descriptions
Description is a long-text field - cannot query in WIQL. Retrieve items first, then check with `wit-get-work-items-context-batch`:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.CreatedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.CreatedDate"],
  includeSubstantiveChange: true,
  maxResults: 200
}
```
Then use `wit-get-work-items-context-batch` (20-30 items per call) to get descriptions and filter client-side.

#### Missing Acceptance Criteria
AcceptanceCriteria is a long-text field - cannot query in WIQL. Get User Stories/PBIs first:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('User Story', 'Product Backlog Item') AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.CreatedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.WorkItemType"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```
Then use `wit-get-work-items-context-batch` with `includeFields: ["Microsoft.VSTS.Common.AcceptanceCriteria"]` and filter client-side.

#### Old Items in Initial State
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] IN ('New', 'Proposed', 'To Do') AND [System.CreatedDate] < @Today - {{max_age_days}} ORDER BY [System.CreatedDate] ASC",
  includeFields: ["System.Title", "System.State", "System.CreatedDate"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```

#### Placeholder Titles
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND ([System.Title] CONTAINS 'TBD' OR [System.Title] CONTAINS 'TODO' OR [System.Title] CONTAINS 'test' OR [System.Title] CONTAINS 'placeholder') ORDER BY [System.CreatedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.CreatedDate"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```

#### No Recent Activity
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND [System.ChangedDate] < @Today - {{max_age_days}} ORDER BY [System.ChangedDate] ASC",
  includeFields: ["System.Title", "System.State", "System.ChangedDate"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```

---

### Health Indicators

**Quality & Clarity:**
- Missing/inadequate descriptions
- Missing acceptance criteria (User Stories/PBIs)
- Vague/placeholder titles (TBD, TODO, test, placeholder)
- Unassigned items in active states
- Missing priority/effort

**Activity:**
- Extended inactivity (`daysInactive` > `max_age_days`)
- Stalled in initial state (> 50% of `max_age_days` in New/Proposed/To Do)
- Assigned but no substantive activity

**Organization:**
- Potential duplicates
- Aging items in early states
- Possible scope drift

### Health Categories

1. **Healthy** - Well-defined, actively maintained, clear ownership
2. **Needs Enhancement** - Valid but could use better descriptions/criteria
3. **Requires Attention** - Extended inactivity, missing critical info, unclear purpose
4. **Consider for Review** - Multiple indicators suggest team discussion needed

---

### Report Format

**Per Item:** `[ID]({{org_url}}/{{project}}/_workitems/edit/{ID}) | Type | State | DaysInactive | Health | Improvements | LastSubstantiveChange`

**Summary:**
- Total items analyzed
- Distribution across health categories
- Top improvement themes
- Suggested next steps

**Detailed Findings:** Group by health category with actionable recommendations. Use `daysInactive` and `lastSubstantiveChangeDate` directly from WIQL response.

Be constructive - frame as opportunities for improvement.
