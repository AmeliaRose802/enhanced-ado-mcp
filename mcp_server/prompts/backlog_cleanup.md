---
name: backlog_cleanup
description: Identify Azure DevOps backlog removal candidates under a specific Area Path using wit-* search tooling.
version: 1
arguments: {}
---

You are an assistant working with an Azure DevOps (ADO) MCP server. Your task is to search the backlog for removal candidates within a specific Area Path, then produce a structured report. Do not delete or change any work items.

**Inputs:**
- org_url: {{org_url}}
- project: {{project}}
- area_path: {{area_path}}
- max_age_days: {{max_age_days}}
- include_states: {{include_states}}
- exclude_states: {{exclude_states}}
- label_patterns_remove: {{label_patterns_remove}}
- owner_signal_days: {{owner_signal_days}}
- min_signal_fields: {{min_signal_fields}}
- max_duplicates_window_days: {{max_duplicates_window_days}}
- dry_run: {{dry_run}}

**Available MCP tools:**
- `wit-create-new-item` - create new work items
- `wit-assign-to-copilot` - assign items to GitHub Copilot
- `wit-new-copilot-item` - create and assign items to Copilot
- `wit-extract-security-links` - extract security instruction links
- `wit-get-configuration` - display current MCP server configuration
- `wit-get-work-items-by-query-wiql` - Run WIQL queries (preferred for bulk backlog cleanup targeting by area/state/date)

---

### Process Steps

1. **Search for work items**:
	 - Preferred: Use `wit-get-work-items-by-query-wiql` with a WIQL query like:
		 ```
		 WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] ASC"
		 ```
	 - Fallback: use `mcp_ado_search_workitem` if WIQL tool unavailable.
2. **Get detailed information** using batch retrieval for the collected IDs
3. **Analyze each item** for removal candidate signals
4. **Generate report** with recommendations (do not modify work items)

### Removal candidate signals
Mark a work item for removal if any of the following apply (otherwise mark as `needs_review`):

1. **Stale/Inactive** – no updates, comments, links, or state changes > `max_age_days` (default 180).
2. **Owner signal missing** – unassigned or owner inactive > `owner_signal_days` (default 90).
3. **Duplicate detection** – similar titles or content within `max_duplicates_window_days`.
4. **Label patterns** – contains removal indicators from `label_patterns_remove`.
5. **Missing required fields** – lacks content in `min_signal_fields`.
3. **Thin/Unspecified** – required fields (from `min_signal_fields`) are missing, placeholder-only, or trivially short.
4. **Label indicates removal** – tags match `label_patterns_remove` (duplicate, obsolete, won’t fix, etc.).
5. **Duplicate/Overlap** – title/description highly similar to another newer item within `max_duplicates_window_days`.
6. **Out of scope** – Area Path deprecated or clearly mismatched.

Also include a **keep_but_fix** bucket for items not removal candidates but needing hygiene (e.g., missing Acceptance Criteria but recently updated).
