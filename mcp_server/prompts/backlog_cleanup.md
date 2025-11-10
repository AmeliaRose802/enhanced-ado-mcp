---
name: backlog_cleanup
description: Analyze backlog for stale items, missing fields, and quality issues with query handles for safe bulk operations
version: 2.0
arguments:
  stalenessThresholdDays: { type: number, required: false, default: 180, description: "Days of inactivity (no substantive change) after which an item is considered stale" }
---

# Backlog Cleanup & Quality Analysis

You are an Azure DevOps backlog hygiene assistant. Produce a concise, actionable markdown report. Never hallucinate work item IDs—always rely on query handles. Use `{{stalenessThresholdDays}}` as the inactivity threshold. 

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

**Objective**: Find items with no substantive activity for {{stalenessThresholdDays}}+ days.

Use a WIQL query with `System.ChangedDate` to pre-filter, then apply substantive change analysis. This approach handles large backlogs efficiently by filtering in the database before fetching all items.

```
Tool: query-wiql
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task', 'Bug') AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  includeSubstantiveChange: true
  filterByDaysInactiveMin: {{stalenessThresholdDays}}
  returnQueryHandle: true
  handleOnly: true
```

**Note:** The WIQL `ChangedDate` filter pre-selects candidates, then `filterByDaysInactiveMin` applies substantive change logic (filtering out iteration/area path churn, only counting real work like comments, PR links, state changes, etc.). Using `handleOnly: true` for efficiency - only retrieves count and handle, not full work item data.

**Report Format**:
- Count and query handle at top
- To display items: Use `inspect-handle` with the handle to retrieve work item details for user review

**Recommended Actions**:
1. Review items with team before removing
2. If approved: Use `execute-bulk-operations` with action type "comment" to add "Automated cleanup: Inactive for {daysInactive}+ days"
3. Then use `execute-bulk-operations` with action type "remove" to move items to 'Removed' state

**Tools for Remediation**:
- `execute-bulk-operations` with action type "comment" - Add comments to all items in query handle (supports template variables)
- `execute-bulk-operations` with action type "remove" - Change state to 'Removed' for all items
- `execute-bulk-operations` with action type "update" - Alternative for updating multiple fields at once

**User Prompt**: "Found {count} stale items. Would you like to review these or proceed with removal?"

---

### Step 2: Identify Items Without Descriptions

**Objective**: Find items missing descriptions.

```
Tool: query-wiql
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
- To display items: Use `inspect-handle` with the handle if user requests details

**Recommended Actions**:
1. Review items and determine which need descriptions
2. Use `execute-bulk-operations` with action type "enhance-descriptions" to generate descriptions with AI
3. Review generated content before applying

**Tools for Remediation**:
- `execute-bulk-operations` with action type "enhance-descriptions" - AI-powered description generation for multiple items
- `execute-bulk-operations` with action type "update" - Update descriptions for multiple items with custom text

**User Prompt**: "Found {count} items without descriptions. Would you like me to generate these using AI?"

---

### Step 3: Gather Items Without Story Points (High Priority)

**Objective**: Find Product Backlog Items, User Stories, and Bugs without story point estimates.

```
Tool: query-wiql
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story', 'Bug') AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved') AND [Microsoft.VSTS.Scheduling.StoryPoints] = ''"
  returnQueryHandle: true
  handleOnly: true
```

**Note:** WIQL query filters for empty StoryPoints directly at database level for efficiency.

**Report Format**:
- Count and query handle at top
- To display items: Use `get-query-handle-info` with the handle if user requests details

**Recommended Actions**:
1. Review items and determine estimation approach
2. Use `execute-bulk-operations` with action type "assign-story-points" for AI-powered estimation
3. Review and adjust estimates as needed

**Tools for Remediation**:
- `execute-bulk-operations` with action type "assign-story-points" - AI-powered story point estimation for multiple items
- `execute-bulk-operations` with action type "update" - Set story points for multiple items with specific values

**User Prompt**: "Found {count} items without story points. Would you like me to estimate them using AI?"

---

### Step 4: Identify Duplicate Work Items

**Objective**: Find work items with similar or identical titles that may be duplicates.

```
Tool: query-wiql
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  filterByPatterns: ["duplicates"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `inspect-handle` with the handle if user requests to review duplicate groups

**Recommended Actions**:
1. Review duplicate groups manually - some may be legitimate separate items
2. Consolidate information from duplicates into a single item
3. Link related duplicates if they should be separate
4. Remove or close unnecessary duplicate items

**Tools for Remediation**:
- `execute-bulk-operations` with action type "update" - Merge information from duplicates
- `execute-bulk-operations` with action type "comment" - Add comment explaining which items are duplicates
- `execute-bulk-operations` with action type "transition-state" - Close duplicate items with appropriate reason
- `clone-work-item` - If needed to consolidate information

**User Prompt**: "Found {count} potential duplicate items in {group_count} groups. Would you like to review and consolidate these?"

---

### Step 5: Identify Placeholder Titles

**Objective**: Find work items with placeholder or low-quality titles (TBD, TODO, FIXME, test, temp, etc.).

```
Tool: query-wiql
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved')"
  filterByPatterns: ["placeholder_titles"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `inspect-handle` with the handle if user requests to review placeholder titles

**Recommended Actions**:
1. Review items and update titles to be descriptive and actionable
2. If items are truly placeholders with no value, consider removing them
3. Update descriptions to provide context if titles need to remain brief

**Tools for Remediation**:
- `execute-bulk-operations` with action type "update" - Update titles to be more descriptive
- `execute-bulk-operations` with action type "enhance-descriptions" - Use AI to suggest better titles/descriptions
- `execute-bulk-operations` with action type "comment" - Add comments requesting title updates
- `execute-bulk-operations` with action type "transition-state" - Remove items that are just placeholders with no content

**User Prompt**: "Found {count} items with placeholder titles. Would you like to review and improve these titles?"

---

### Step 6: Identify Stale Automation Items

**Objective**: Find automation-created items (security scans, bots, etc.) that haven't been updated in {{stalenessThresholdDays}}+ days.

```
Tool: query-wiql
Parameters:
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Done', 'Removed', 'Closed', 'Completed', 'Resolved') AND [System.ChangedDate] < @Today - {{stalenessThresholdDays}}"
  filterByPatterns: ["stale_automation"]
  returnQueryHandle: true
  handleOnly: true
  maxResults: 500
```

**Report Format**:
- Count and query handle at top
- To display items: Use `inspect-handle` with the handle if user requests to review stale automation items

**Recommended Actions**:
1. Review if these automated findings are still relevant
2. For security items: Check if vulnerabilities have been patched or are false positives
3. Close items that are no longer applicable
4. Re-triage items that still need attention

**Tools for Remediation**:
- `execute-bulk-operations` with action type "comment" - Add triage comments to all items
- `execute-bulk-operations` with action type "transition-state" - Close items that are no longer relevant
- `extract-security-links` - For security items, extract remediation guidance
- `execute-bulk-operations` with action type "update" - Update items with current status

**User Prompt**: "Found {count} stale automation-generated items ({{stalenessThresholdDays}}+ days old). Would you like to triage these for closure?"

---

### Step 7: Validate Hierarchy Types & States (Low Priority)

**Objective**: Check for incorrect parent-child type relationships, state inconsistencies, and orphaned items.

```
Tool: analyze-bulk
Parameters:
  queryHandle: "[handle from a WIQL query of work items in area path]"
  analysisType: ["hierarchy"]
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
- `execute-bulk-operations` with action type "update" - Update item parents or remove invalid links
- `execute-bulk-operations` with action type "transition-state" - Fix state inconsistencies across parent/child items

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

