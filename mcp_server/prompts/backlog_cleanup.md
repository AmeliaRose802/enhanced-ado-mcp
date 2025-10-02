---
name: backlog_cleanup
description: Identify Azure DevOps backlog removal candidates under a specific Area Path using wit-* search tooling.
version: 2
arguments: {}
---

You are an assistant working with an Azure DevOps (ADO) MCP server. Your task is to search the backlog for removal candidates within a specific Area Path, then produce a structured report. Do not delete or change any work items.

**Important:** **Exclude work items in Done/Completed/Closed/Resolved states from analysis** - these represent successfully completed work and should not be flagged for removal. Focus only on active, stale, or abandoned work items.

**Inputs (auto-populated where possible):**
- org_url: {{org_url}}
- project: {{project}}
- area_path: {{area_path}}
- max_age_days: {{max_age_days}} (default 180)
- dry_run: {{dry_run}} (analysis only)

**Available MCP tools:**
- `wit-get-work-items-by-query-wiql` – primary retrieval with built-in substantive change analysis (use `IncludeSubstantiveChange: true`)
- `wit-get-work-items-context-batch` – ⚠️ batch enrichment (LIMIT: 20-30 items per call to avoid context overflow)
- `wit-get-work-item-context-package` – ⚠️ deep dive for edge cases (use sparingly, returns large payload)
- (Create/assign tools available but not used for removal analysis): `wit-create-new-item`, `wit-assign-to-copilot`, `wit-new-copilot-item`, `wit-extract-security-links`

---

### Process Steps

1. **Search for work items with substantive change analysis**:
	 - **PRIMARY METHOD**: Use `wit-get-work-items-by-query-wiql` with `IncludeSubstantiveChange: true` to get work items AND their last substantive change dates in ONE call:
		 ```
		 Tool: wit-get-work-items-by-query-wiql
		 Arguments: {
		   WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.ChangedDate] ASC",
		   IncludeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo", "System.WorkItemType"],
		   IncludeSubstantiveChange: true,
		   SubstantiveChangeHistoryCount: 50,
		   MaxResults: 200
		 }
		 ```
	 - This returns items with computed `lastSubstantiveChangeDate` and `daysInactive` fields (server-side filtering of automated updates)
	 - **Benefits**: 50% fewer API calls, automatic filtering of system changes, immediate staleness categorization
2. **Optionally get additional context** (only if needed): Use `wit-get-work-items-context-batch` for descriptions, tags, or detailed relationships
3. **Analyze each item** using the `daysInactive` field for removal candidate signals
4. **Generate report** with recommendations (do not modify work items)

---

### Additional WIQL Queries for Quality Analysis

Use these targeted queries to identify specific quality issues in the backlog. **Remember to include `IncludeSubstantiveChange: true` in your tool calls to get activity data.**

#### Missing or Empty Descriptions
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND ([System.Description] = '' OR [System.Description] IS NULL) ORDER BY [System.CreatedDate] DESC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate", "System.Description"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

#### Missing Acceptance Criteria (for User Stories/PBIs)
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('User Story', 'Product Backlog Item') AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND ([Microsoft.VSTS.Common.AcceptanceCriteria] = '' OR [Microsoft.VSTS.Common.AcceptanceCriteria] IS NULL) ORDER BY [System.CreatedDate] DESC",
  IncludeFields: ["System.Title", "System.State", "System.WorkItemType", "Microsoft.VSTS.Common.AcceptanceCriteria"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

#### Unassigned Items in Active States
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] IN ('Active', 'In Progress', 'Committed') AND [System.AssignedTo] = '' ORDER BY [System.CreatedDate] ASC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

#### Very Old Items Still in Initial State
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] IN ('New', 'Proposed', 'To Do') AND [System.CreatedDate] < @Today - {{max_age_days}} ORDER BY [System.CreatedDate] ASC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

#### Items with Placeholder Titles
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND ([System.Title] CONTAINS 'TBD' OR [System.Title] CONTAINS 'TODO' OR [System.Title] CONTAINS 'test' OR [System.Title] CONTAINS 'placeholder') ORDER BY [System.CreatedDate] DESC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

#### Items with No Recent Activity
```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND [System.ChangedDate] < @Today - {{max_age_days}} ORDER BY [System.ChangedDate] ASC",
  IncludeFields: ["System.Title", "System.State", "System.ChangedDate"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

**Usage Tip:** All queries above include `IncludeSubstantiveChange: true` to automatically provide `daysInactive` and `lastSubstantiveChangeDate` fields. Run these queries individually to create focused cleanup reports by issue type, or combine results for comprehensive analysis.

### Removal candidate signals
Mark a work item as a `removal_candidate` if ANY apply (else classify as `needs_review`, `keep_but_fix`, or `keep`):

1. **True Inactivity** – `daysInactive` field (from WIQL with `IncludeSubstantiveChange: true`) is greater than `max_age_days`. This automatically excludes automated system changes.
2. **Stale Passive State** – Remains in initial state (e.g., New/Proposed/To Do) for > 50% of `max_age_days` with no substantive progress.
3. **No Clear Owner** – Unassigned OR assigned but no substantive change activity in `max_age_days`.
4. **Placeholder Quality** – Title or description is obviously placeholder (e.g., contains only TBD / test / spike / TODO / placeholder) or trivially short (< ~15 chars meaningful content), or description is completely empty.
5. **Obvious Duplication** – High lexical similarity (title+core description fragment) with a more recent active item (basic fuzzy match acceptable). Prefer anchor to newer item ID.
6. **Out of Scope / Deprecated** – Area path or tags indicate decommissioned component or superseded initiative.
7. **Missing Critical Fields** – Empty description AND no acceptance criteria (for User Stories/PBIs) AND older than 30 days with no substantive updates.

### Secondary hygiene bucket (`keep_but_fix`)
Use when the item is still relevant but needs improvement (e.g., missing acceptance criteria, vague description, empty description, outdated tags) yet shows some recent substantive activity (< 30 days). Common issues:
- Missing or inadequate description
- Missing acceptance criteria (User Stories/PBIs)
- Vague or unclear title
- Unassigned but actively discussed
- Missing priority or effort estimation

### Classification Output (per item)
Include: `ID | Type | State | DaysInactive | Category (removal_candidate|keep_but_fix|needs_review|keep) | Signals | LastSubstantiveChange`

**Note**: Use `daysInactive` and `lastSubstantiveChangeDate` fields directly from the WIQL response - no additional tool calls needed.
