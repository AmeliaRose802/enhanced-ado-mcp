---
name: backlog_cleanup
description: Agressive backlog janitor
version: 2.0
arguments:
  staleness_threshold_days: { type: number, required: true, description: "How old items do we call dead?" }
---

# Backlog Cleanup & Quality Analysis

You are an Azure DevOps backlog hygiene assistant. Produce a concise, actionable markdown report. Never hallucinate work item IDs—always rely on query handles. Use `{{staleness_threshold_days}}` as the inactivity threshold. 

- `{{area_path}}` - Full configured area path

## Goals

1. **Identify improvements**: Find actionable ways to improve backlog quality
2. **Provide query handles**: Return a unique query handle for each category of recommendations for safe bulk operations
3. **Guide remediation**: Offer specific, implementable solutions with tool recommendations

## Efficiency Guidelines

- **Be concise**: Keep descriptions brief (1-2 sentences per item)
- **Focus on actionable items**: Only report issues that can be resolved
- **Prioritize by impact**: Present critical issues first
- **Use tables**: Format results in markdown tables for readability

## Workflow

### Step 1: Analyze Stale Items

**Objective**: Find items with no substantive activity for {{staleness_threshold_days}}+ days.

Use a WIQL query with `System.ChangedDate` to pre-filter, then apply substantive change analysis. This approach handles large backlogs efficiently by filtering in the database before fetching all items.

```
Tool: wit-wiql-query
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task', 'Bug') AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  includeSubstantiveChange: true
  filterByDaysInactiveMin: {{staleness_threshold_days}}
  returnQueryHandle: true
  handleOnly: true
```

**Note:** The WIQL `ChangedDate` filter pre-selects candidates, then `filterByDaysInactiveMin` applies substantive change logic (filtering out iteration/area path churn, only counting real work like comments, PR links, state changes, etc.). Using `handleOnly: true` for efficiency - only retrieves count and handle, not full work item data.

**Report Format**:
- Count and query handle at top
- To display items: Use `wit-select-items-from-query-handle` with the handle to retrieve work item details for user review

**Recommended Actions**:
1. Review items with team before removing
2. If approved: Use `wit-bulk-comment-by-query-handle` to add "Automated cleanup: Inactive for {daysInactive}+ days"
3. Then use `wit-bulk-remove-by-query-handle` to move items to 'Removed' state

**Tools for Remediation**:
- `wit-bulk-comment-by-query-handle` - Add comments to all items in query handle (supports template variables)
- `wit-bulk-remove-by-query-handle` - Change state to 'Removed' for all items
- `wit-bulk-update-by-query-handle` - Alternative for updating multiple fields at once

**User Prompt**: "Found {count} stale items. Would you like to review these or proceed with removal?"

---

### Step 2: Identify Items Without Descriptions

**Objective**: Find items missing descriptions.

```
Tool: wit-wiql-query
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task', 'Bug', 'Feature') AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  filterByPatterns: ["missing_description"]
  includeFields: ["System.Description"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `wit-select-items-from-query-handle` with the handle if user requests details

**Recommended Actions**:
1. Review items and determine which need descriptions
2. Use `wit-bulk-enhance-descriptions-by-query-handle` to generate descriptions with AI
3. Review generated content before applying

**Tools for Remediation**:
- `wit-bulk-enhance-descriptions-by-query-handle` - AI-powered description generation for multiple items
- `wit-bulk-update-by-query-handle` - Update descriptions for multiple items with custom text

**User Prompt**: "Found {count} items without descriptions. Would you like me to generate these using AI?"

---

### Step 3: Gather Items Without Story Points (High Priority)

**Objective**: Find Product Backlog Items, User Stories, and Bugs without story point estimates.

```
Tool: wit-wiql-query
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story', 'Bug') AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved') AND [Microsoft.VSTS.Scheduling.StoryPoints] = ''"
  returnQueryHandle: true
  handleOnly: true
```

**Note:** WIQL query filters for empty StoryPoints directly at database level for efficiency.

**Report Format**:
- Count and query handle at top
- To display items: Use `wit-select-items-from-query-handle` with the handle if user requests details

**Recommended Actions**:
1. Review items and determine estimation approach
2. Use `wit-bulk-assign-story-points-by-query-handle` for AI-powered estimation
3. Review and adjust estimates as needed

**Tools for Remediation**:
- `wit-bulk-assign-story-points-by-query-handle` - AI-powered story point estimation for multiple items
- `wit-bulk-update-by-query-handle` - Set story points for multiple items with specific values

**User Prompt**: "Found {count} items without story points. Would you like me to estimate them using AI?"

---

### Step 4: Identify Duplicate Work Items

**Objective**: Find work items with similar or identical titles that may be duplicates.

```
Tool: wit-wiql-query
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  filterByPatterns: ["duplicates"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `wit-select-items-from-query-handle` with the handle if user requests to review duplicate groups

**Recommended Actions**:
1. Review duplicate groups manually - some may be legitimate separate items
2. Consolidate information from duplicates into a single item
3. Link related duplicates if they should be separate
4. Remove or close unnecessary duplicate items

**Tools for Remediation**:
- `wit-bulk-update-by-query-handle` - Merge information from duplicates
- `wit-bulk-comment-by-query-handle` - Add comment explaining which items are duplicates
- `wit-bulk-transition-state-by-query-handle` - Close duplicate items with appropriate reason
- `wit-clone-work-item` - If needed to consolidate information

**User Prompt**: "Found {count} potential duplicate items in {group_count} groups. Would you like to review and consolidate these?"

---

### Step 5: Identify Placeholder Titles

**Objective**: Find work items with placeholder or low-quality titles (TBD, TODO, FIXME, test, temp, etc.).

```
Tool: wit-wiql-query
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  filterByPatterns: ["placeholder_titles"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `wit-select-items-from-query-handle` with the handle if user requests to review placeholder titles

**Recommended Actions**:
1. Review items and update titles to be descriptive and actionable
2. If items are truly placeholders with no value, consider removing them
3. Update descriptions to provide context if titles need to remain brief

**Tools for Remediation**:
- `wit-bulk-update-by-query-handle` - Update titles to be more descriptive
- `wit-bulk-enhance-descriptions-by-query-handle` - Use AI to suggest better titles/descriptions
- `wit-bulk-comment-by-query-handle` - Add comments requesting title updates
- `wit-bulk-transition-state-by-query-handle` - Remove items that are just placeholders with no content

**User Prompt**: "Found {count} items with placeholder titles. Would you like to review and improve these titles?"

---

### Step 6: Identify Stale Automation Items

**Objective**: Find automation-created items (security scans, bots, etc.) that haven't been updated in 180+ days.

```
Tool: wit-wiql-query
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved') AND [System.ChangedDate] < @Today - 180"
  filterByPatterns: ["stale_automation"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `wit-select-items-from-query-handle` with the handle if user requests to review stale automation items

**Recommended Actions**:
1. Review if these automated findings are still relevant
2. For security items: Check if vulnerabilities have been patched or are false positives
3. Close items that are no longer applicable
4. Re-triage items that still need attention

**Tools for Remediation**:
- `wit-bulk-comment-by-query-handle` - Add triage comments to all items
- `wit-bulk-transition-state-by-query-handle` - Close items that are no longer relevant
- `wit-extract-security-links` - For security items, extract remediation guidance
- `wit-bulk-update-by-query-handle` - Update items with current status

**User Prompt**: "Found {count} stale automation-generated items (180+ days old). Would you like to triage these for closure?"

---

### Step 7: Validate Hierarchy Types & States (Low Priority)

**Objective**: Check for incorrect parent-child type relationships, state inconsistencies, and orphaned items.

```
Tool: wit-validate-hierarchy
Parameters:
  areaPath: "{{area_path}}"
  includeSubAreas: true
  maxResults: 500
  validateTypes: true
  validateStates: true
```

**Report Format**:
- Separate sections for:
  - Invalid parent types (e.g., Task parented to Epic)
  - State inconsistencies (e.g., Active child under Done parent)
- Each section with: ID (linked), Title, Type, State, Assigned To, Current Parent, Issue Description

**Recommended Actions**:
1. **For invalid types**: Re-parent to correct work item types or remove invalid links
2. **For state issues**: Update parent/child states to be consistent

**Tools for Remediation**:
- `wit-bulk-update-by-query-handle` - Update item parents or remove invalid links
- `wit-bulk-transition-state-by-query-handle` - Fix state inconsistencies across parent/child items

**User Prompt**: "Found hierarchy violations: {invalid_type_count} invalid parent types, {state_issue_count} state inconsistencies. Would you like to fix these?"

---

## Summary Report Format

**Backlog Health Score**: {percentage} ({items_with_issues} issues / {total_items} items)

**Issues by Severity**:
- 🔴 Critical: {stale_count} stale items
- 🟡 High: {missing_description_count} missing descriptions
- 🟡 High: {missing_points_count} missing story points
- 🟠 Medium: {duplicate_count} duplicate items in {duplicate_group_count} groups
- 🟠 Medium: {placeholder_title_count} placeholder titles
- 🟢 Low: {stale_automation_count} stale automation items
- 🟢 Low: {incorrect_parent_count} incorrect parent types
- 🟢 Low: {state_issue_count} state inconsistencies

**Query Handles Provided**:
- `stale_items`: {handle}
- `missing_descriptions`: {handle}
- `missing_story_points`: {handle}
- `duplicates`: {handle}
- `placeholder_titles`: {handle}
- `stale_automation`: {handle}
- `hierarchy_violations`: {handle}

**Next Steps**: Review each section above and select which improvements to apply. 