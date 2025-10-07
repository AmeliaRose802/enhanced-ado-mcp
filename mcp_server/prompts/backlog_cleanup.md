---
name: backlog_cleanup
description: Comprehensive backlog hygiene analysis with AI-powered remediation - identifies dead items, quality issues, missing metadata, and auto-enhances content
arguments:
  stalenessThresholdDays:
    type: number
    description: Number of days of inactivity before an item is considered stale (default: 180)
    required: false
    default: 180
---

# Backlog Cleanup & Quality Analysis

**Version:** Enhanced with two-pass query strategy and comprehensive staleness analysis

## 🎯 Purpose

Perform comprehensive backlog hygiene analysis to identify and remediate quality issues across Azure DevOps work items using both manual and AI-powered tools.

### Key Enhancements from find_dead_items.md

✅ **Two-Pass Query Strategy** - Fast Scan (date-filtered) + Comprehensive Scan (catches items with automated updates)  
✅ **Server-Side Staleness Analysis** - Automatic filtering of automated updates (iteration sweeps, system changes)  
✅ **Query Handle Inspection** - Verify staleness statistics and template variables before bulk operations  
✅ **Enhanced State Filtering** - Explicit exclusion of terminal states (Done, Closed, Removed)  
✅ **Template Variable System** - Rich context in audit comments using {daysInactive}, {lastSubstantiveChangeDate}, etc.  
✅ **Comprehensive Reporting** - Side-by-side comparison of Fast vs Comprehensive scan results

## 🚨 Critical Guardrails

- **ANTI-HALLUCINATION: NEVER manually specify work item IDs.** Always use `wit-get-work-items-by-query-wiql` with `returnQueryHandle: true` to get a handle, then pass the handle to bulk operations. Manual IDs lead to operations on wrong items.
- **REQUIRED PATTERN:** Query → Handle → Bulk Operation (never Query → Manual IDs → Bulk Operation)
- **CRITICAL: Only analyze ACTIVE work items.** Completely ignore and filter out work items already in Done, Completed, Closed, Resolved, or Removed states. These are already "dead" in the system and should never appear in the analysis.
- **EXCLUSIVE FOCUS: Tasks, Product Backlog Items (PBIs), and Bugs ONLY.** These are the actionable work items that represent actual development work. **Always exclude Features, Epics, and other planning items** from all queries and analysis. Use `[System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug')` in every WIQL query.
- When evaluating staleness, filter out automated updates (iteration/area path sweeps, system accounts, mass transitions).
- Pull revision history via `includeSubstantiveChange: true` to get server-side filtered staleness data (`daysInactive`, `lastSubstantiveChangeDate`).
- Never recommend removing items that are already in terminal states (Done, Completed, Closed, Resolved, Removed).

### What This Prompt Detects

| Issue Type | Description | Impact |
|------------|-------------|--------|
| 💀 **Dead Items** | Inactive >{{stalenessThresholdDays}} days with no substantive changes | Clutters backlog, obscures real work |

### Dead Item Signals (flag if any apply)
1. Last substantive change (from `daysInactive` field) is older than {{stalenessThresholdDays}} days.
2. Passive state (New, Proposed, Backlog, To Do) and age greater than {{stalenessThresholdDays}} / 2.
3. Description missing or shorter than 20 characters.
4. Unassigned, or assigned but idle longer than {{stalenessThresholdDays}} days.
5. Title is a placeholder ("TBD", "foo", "test", "spike").

**Note:** The `daysInactive` field is computed server-side by analyzing revision history and already excludes automated changes (iteration/area path sweeps, system accounts). This is the TRUE measure of staleness.

| Issue Type | Description | Impact |
| 📝 **Poor Descriptions** | Missing, vague, or insufficient content | Team confusion, poor handoffs |
| 🏷️ **Bad Titles** | Generic, unclear, or non-descriptive | Hard to search, identify, prioritize |
| 🔍 **Missing Metadata** | Unassigned, no priority, missing area/iteration | Cannot plan or track effectively |
| 📏 **Missing Story Points** | PBIs/Stories without effort estimates | Blocks sprint planning & velocity |
| 🏗️ **Orphaned Items** | Missing parent links in hierarchies | Lost context, unclear scope |
| 🔄 **State Issues** | Stuck in limbo states, blocked without reason | Work stalls, unclear status |
| 📊 **Planning Gaps** | Missing acceptance criteria, tags, planning fields | Cannot validate completion |

### Core Technical Pattern

**Single Query with Full Context:**
- Use `returnQueryHandle: true` to get both handle AND complete work item data
- Apply `filterByDaysInactiveMin` for server-side staleness filtering
- Returns ready-to-analyze data + handle for bulk operations
- Eliminates redundant queries and prevents ID hallucination

## ✅ Core Patterns

### Single-Query Pattern

**⚠️ CRITICAL: Never manually specify work item IDs - always use query handles to prevent hallucination.**

One query call returns BOTH the handle AND full work item data:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE ...",
  "returnQueryHandle": true,
  "filterByDaysInactiveMin": {{stalenessThresholdDays}},
  "includeFields": ["System.Title", "System.State", "System.AssignedTo"]
}
```

**Returns:**
- Query handle for bulk operations
- Complete work item data with staleness metrics
- Pre-filtered results (server-side)

### Item Selector Pattern

Target specific subsets within a query handle:

```javascript
// By index (zero-based)
itemSelector: [0, 1, 2, 5, 10]

// By criteria
itemSelector: {
  states: ['Active', 'New'],
  tags: ['NeedsReview'],
  daysInactiveMin: 90
}

// All items (default)
itemSelector: "all"
```

## 🔍 Analysis Workflows

### Recommended Starting Workflow: Comprehensive Quality Analysis

**Goal:** Provide complete visibility into all quality issues with detailed item listings for targeted remediation.

**Step 1: Query All Active Actionable Items**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')",
  "includeFields": ["System.Title", "System.State", "System.Description", "System.AssignedTo", "Microsoft.VSTS.Scheduling.StoryPoints", "Microsoft.VSTS.Common.AcceptanceCriteria", "Microsoft.VSTS.Common.Priority", "System.IterationPath"],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 500
}
```

**Step 2: Analyze and Categorize**

Group items by issue type:
1. **Dead Items** - daysInactive > {{stalenessThresholdDays}}
2. **Poor/Missing Descriptions** - Empty, <20 chars, or "TBD"/"TODO"
3. **Poor/Generic Titles** - <15 chars, >120 chars, or generic words
4. **Missing Story Points** - PBIs without effort estimates
5. **Missing Metadata** - Unassigned active items, no priority, no iteration
6. **Missing Acceptance Criteria** - PBIs without criteria

**Step 3: Present Comprehensive Report**

Use the Required Report Format with complete item listings for each category. Each category section should include:
- Category name and count
- Complete table of ALL items in that category
- Relevant fields for the issue type
- Suggested remediation command

**Step 4: Enable Targeted Commands**

User can then say:
- "Enhance descriptions for all items in Poor/Missing Descriptions"
- "Estimate story points for PBIs in Missing Story Points"
- "Add acceptance criteria to all PBIs in Missing Acceptance Criteria"
- "Remove all dead Tasks"

### Workflow 1: Find and Remove Dead Items (Two-Pass Strategy)

**RECOMMENDED APPROACH: Two-pass analysis for maximum accuracy and minimal API calls.**

#### Pass 1: Fast Scan (Pre-filtered by Date)

**Step 1a: Query with Date Pre-filtering**

Query items with NO changes (including automated) for {{stalenessThresholdDays}}+ days:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] IN ('New', 'Proposed', 'Active', 'In Progress', 'To Do', 'Backlog', 'Committed', 'Open') AND [System.ChangedDate] < @Today - {{stalenessThresholdDays}} ORDER BY [System.ChangedDate] ASC",
  "includeFields": ["System.Title", "System.State", "System.CreatedDate", "System.CreatedBy", "System.AssignedTo", "System.Description"],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 200
}
```

✅ **Fast execution** - Returns only items with no changes (including automated) in {{stalenessThresholdDays}}+ days  
✅ **High confidence** - Items in this set are very likely dead  
✅ **Minimal false positives** - Date filter catches truly abandoned items

**Step 1b: Inspect Query Handle (Optional)**

Verify staleness data and statistics:

```json
{
  "queryHandle": "qh_fastScan_...",
  "includePreview": true,
  "includeStats": true
}
```

Returns:
- Staleness statistics (min/max/avg days inactive)
- Analysis coverage (how many items have staleness data)
- Preview of first 10 items with context
- Available template variables for bulk operations

#### Pass 2: Comprehensive Scan (Catch Items Missed by Fast Scan)

**Step 2a: Query Without Date Filtering**

Query all active items to catch those with automated updates but no substantive changes:

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] IN ('New', 'Proposed', 'Active', 'In Progress', 'To Do', 'Backlog', 'Committed', 'Open') ORDER BY [System.ChangedDate] ASC",
  "includeFields": ["System.Title", "System.State", "System.CreatedDate", "System.CreatedBy", "System.AssignedTo", "System.Description"],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 200
}
```

✅ **Comprehensive coverage** - Returns all active items for complete analysis  
⚠️ **Requires filtering** - Must filter by `daysInactive > {{stalenessThresholdDays}}` to find additional dead items  
✅ **Catches edge cases** - Items with automated updates but stale substantive activity

**Step 2b: Filter and Deduplicate**

Analyze the returned `work_items` array:
1. Filter to items where `daysInactive > {{stalenessThresholdDays}}`
2. Remove any items already found in Fast Scan (compare IDs)
3. These are items with recent automated updates but stale substantive work

**Benefits of Two-Pass Approach:**
- ✅ **50% fewer API calls** - Get work items AND staleness dates in one request per pass
- ✅ **Zero ID hallucination risk** - Query handle stores actual IDs from ADO
- ✅ **Minimal token overhead** - Only adds 2 fields per item: `lastSubstantiveChangeDate` and `daysInactive`
- ✅ **Automatic filtering** - Server-side removal of automated updates (iteration path sweeps, system accounts)
- ✅ **Immediate categorization** - Use `daysInactive` directly to categorize items
- ✅ **Safe bulk operations** - Use returned query handle for all cleanup actions
- ✅ **Complete coverage** - Fast Scan catches obvious items; Comprehensive Scan ensures nothing is missed

#### Step 3: Review and Categorize Results

**For Fast Scan Results:**
- **Validation:** Verify each item's state is NOT in ['Done', 'Completed', 'Closed', 'Resolved', 'Removed']
- **Categorization:** All items are strong candidates since they passed the date filter
- **Dead:** `daysInactive > {{stalenessThresholdDays}}`
- **At Risk:** `daysInactive > ({{stalenessThresholdDays}} / 2)` or passive state + high age

**For Comprehensive Scan Results:**
- **Validation:** Verify each item's state is NOT in ['Done', 'Completed', 'Closed', 'Resolved', 'Removed']
- **Client-side Filtering:** Filter to only items where `daysInactive > {{stalenessThresholdDays}}`
- **Deduplication:** Remove any items already found in Fast Scan (compare IDs)
- **These are items with automated updates but stale substantive activity**

Present summary to user:
- Total dead items from both scans
- Fast Scan coverage percentage
- Additional items found by Comprehensive Scan
- Get approval before proceeding

#### Step 4: Add Audit Comments

```json
{
  "queryHandle": "{handle}",
  "comment": "🤖 **Automated Backlog Hygiene Action**\n\nThis {type} has been identified as a stale/abandoned item and is being moved to \"Removed\" state.\n\n**Analysis Details:**\n- **Item:** {title}\n- **Days Inactive:** {daysInactive} days\n- **Last Substantive Change:** {lastSubstantiveChangeDate}\n- **Current State:** {state}\n- **Assigned To:** {assignedTo}\n\n**Recovery:** If this item should be retained, please update the state and add a comment explaining why this work is still relevant.\n\n**Analysis Date:** 2025-10-06\n**Automated by:** Backlog Hygiene Assistant",
  "dryRun": true
}
```

⭐ **Template Variables Available:** `{daysInactive}`, `{lastSubstantiveChangeDate}`, `{title}`, `{state}`, `{type}`, `{assignedTo}`, `{id}` - These are automatically substituted per work item when the query handle contains staleness context.

#### Step 5: Execute Removal

```json
{
  "queryHandle": "{handle}",
  "removeReason": "Backlog cleanup: Items inactive >{{stalenessThresholdDays}} days",
  "dryRun": false
}
```

**Error Handling & Safety:**
- **Pre-removal validation:** Before any removal action, verify the item's current state is NOT already in ['Done', 'Completed', 'Closed', 'Resolved', 'Removed']. Skip items already in terminal states.
- If `Removed` is invalid, attempt `Closed` or surface valid states.
- If comment creation fails, proceed with the state change but warn that the audit trail is incomplete.
- Always log actions for traceability.
- Do not remove items in active working states (In Progress, Active with recent updates) or touched within the last 30 days without additional confirmation.
- Validate state transitions are allowed by the work item type's workflow before attempting updates.

### Other Common Workflows

All follow the pattern: **Query → Analyze → Remediate**

**Available Tools:**

**Discovery & Analysis**
- `wit-query-analytics-odata` - ⭐ PREFERRED for getting counts and distributions of stale items
- `wit-get-work-items-by-query-wiql` - Query for candidate IDs **with optional substantive change analysis** ⭐ NEW
  - ⚠️ **Pagination:** Returns first 200 items by default. For large backlogs (>200 items), use `skip` and `top` parameters to paginate
- `wit-inspect-query-handle` - ⭐ **NEW** Inspect query handle contents, verify staleness data, see template variables
- `wit-get-work-items-context-batch` - ⚠️ Batch details (max 25-30 items per call)
- `wit-get-work-item-context-package` - ⚠️ Single item deep dive (large payload)
- `wit-get-last-substantive-change` - Single item activity check (usually not needed if using WIQL enhancement)

**Cleanup Actions** ⭐ **ENHANCED QUERY HANDLE APPROACH**
- `wit-bulk-comment-by-query-handle` - Add comments with template variables
- `wit-bulk-update-by-query-handle` - Update multiple work items safely using handles
- `wit-bulk-assign-by-query-handle` - Assign multiple work items safely using handles
- `wit-bulk-remove-by-query-handle` - Remove multiple work items safely using handles

**AI-Powered Enhancement Tools**
- `wit-bulk-enhance-descriptions-by-query-handle` - Generate improved descriptions
- `wit-bulk-assign-story-points-by-query-handle` - AI-powered effort estimation
- `wit-bulk-add-acceptance-criteria-by-query-handle` - Generate testable acceptance criteria

| Workflow | Query Target | Key Checks | Remediation |
|----------|-------------|------------|-------------|
| **Poor Descriptions** | Active items with Description field | Empty, <20 chars, "TBD"/"TODO" | AI-enhance or tag for review |
| **Poor Titles** | All active items | Generic, <15 or >120 chars, no verb | AI-enhance or manual fix |
| **Missing Metadata** | Items with metadata fields | Unassigned, no priority/iteration/points | Tag and assign for completion |
| **Blocked/Stuck Items** | Active or "Blocked" tagged | Stale >30 days, no blocker details | Request details or reassign |
| **Missing Story Points** | PBIs/Stories without estimates | No effort value | AI-estimate with reasoning |
| **Comprehensive Health** | Entire active backlog | Score across all dimensions | Prioritized action plan |

## 🎯 Quality Scoring Rubrics

### Description Quality Rubric

| Score | Criteria | Example |
|-------|----------|---------|
| 10 | Complete: Context, rationale, acceptance criteria, >200 chars | "This feature enables bulk user import via CSV. Currently, admins must add users individually (15min each). CSV import will reduce onboarding from 5 hours to 15 minutes for 20-user batches. Success: Upload CSV, validate, preview, confirm, import with rollback." |
| 7 | Good: Clear purpose, some context, >100 chars | "Add CSV upload for bulk user creation. Will save time for large customer onboarding." |
| 4 | Minimal: Brief statement, <100 chars | "Allow CSV import for users" |
| 1 | Poor: Generic or placeholder | "TBD" or "TODO" |
| 0 | Missing: Empty or null | "" |

### Title Quality Rubric

| Score | Criteria | Example |
|-------|----------|---------|
| 10 | Excellent: Action verb, component, specific issue, 40-80 chars | "Fix: OAuth token refresh fails for Azure AD users after 60min" |
| 7 | Good: Clear intent, context, 25-80 chars | "Update user import to support CSV format" |
| 4 | Acceptable: Somewhat vague, 15-80 chars | "User import improvements" |
| 1 | Poor: Generic, too short/long | "Bug" or "TODO: Fix the thing" |
| 0 | Unacceptable: Placeholder or broken | "..." or "NEW TASK!!!!" |

### Metadata Completeness Rubric

**Critical Fields** (must have):
- ✅ Title
- ✅ State
- ✅ Work Item Type
- ✅ Area Path

**Important Fields** (should have):
- 🎯 Assigned To (for Active items)
- 📅 Iteration Path (for planned items)
- ⭐ Priority
- 📏 Effort Estimate (Story Points/Hours)

**Nice to Have**:
- 🏗️ Parent Link
- 🏷️ Tags
- ✅ Acceptance Criteria (Stories/Features)
- 🔗 Related Links

## � Required Report Format

Present results from both scans separately to show the value of each approach.

### Fast Scan Results (Pre-filtered by Date)
**Summary**
- Counts per category (dead, at_risk, healthy) from Fast Scan
- Parameter values used: {{stalenessThresholdDays}} days, area path, work item types
- Note: "These items have had NO changes (including automated) for {{stalenessThresholdDays}}+ days"

**Breakdown by Work Item Type**
List counts for each category per type (Tasks, Product Backlog Items, Bugs).

**Dead Candidates - Fast Scan**
Group by work item type. Each section includes a table:
`ID | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals | LastSubstantiveChange`

**Format:** Make the ID column a clickable link using the work item's URL field from the query response. Format as `[ID](url)`.

**At Risk - Fast Scan**
Mirror the structure above with clickable ID links: `[ID](url) | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals`

---

### Comprehensive Scan Results (Additional Items Found)
**Summary**
- Counts per category (dead, at_risk, healthy) from Comprehensive Scan
- **Items unique to this scan:** Count of dead items NOT found in Fast Scan
- Note: "These items had automated updates recently but no substantive changes for {{stalenessThresholdDays}}+ days"

**Breakdown by Work Item Type**
List counts for each category per type (Tasks, Product Backlog Items, Bugs).

**Dead Candidates - Additional from Comprehensive Scan**
Group by work item type. Each section includes a table:
`ID | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals | LastSubstantiveChange | LastChangedDate`

**Format:** Make the ID column a clickable link: `[ID](url) | Title | ...`

Include `LastChangedDate` to show the recent automated update that caused Fast Scan to miss this item.

**At Risk - Additional from Comprehensive Scan**
Mirror the structure above with clickable ID links and `LastChangedDate` column: `[ID](url) | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals | LastChangedDate`

---

### Combined Summary
- **Total Dead Items Found:** [Fast Scan count] + [Additional from Comprehensive] = [Total]
- **Fast Scan Coverage:** [Fast Scan count] / [Total] = [Percentage]%
- **Comprehensive Scan Value:** [Additional count] items would have been missed by Fast Scan alone

### Recommendations
Provide clear actions (close, merge, clarify, re-scope, delete). Report only—no destructive changes without explicit user approval.

## � Required Report Format

Present results from both scans separately to show the value of each approach.

### Fast Scan Results (Pre-filtered by Date)
**Summary**
- Counts per category (dead, at_risk, healthy) from Fast Scan
- Parameter values used: {{stalenessThresholdDays}} days, area path, work item types
- Note: "These items have had NO changes (including automated) for {{stalenessThresholdDays}}+ days"

**Breakdown by Work Item Type**
List counts for each category per type (Tasks, Product Backlog Items, Bugs).

**Dead Candidates - Fast Scan**
Group by work item type. Each section includes a table:
`ID | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals | LastSubstantiveChange`

**Format:** Make the ID column a clickable link using the work item's URL field from the query response. Format as `[ID](url)`.

**At Risk - Fast Scan**
Mirror the structure above with clickable ID links: `[ID](url) | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals`

---

### Comprehensive Scan Results (Additional Items Found)
**Summary**
- Counts per category (dead, at_risk, healthy) from Comprehensive Scan
- **Items unique to this scan:** Count of dead items NOT found in Fast Scan
- Note: "These items had automated updates recently but no substantive changes for {{stalenessThresholdDays}}+ days"

**Breakdown by Work Item Type**
List counts for each category per type (Tasks, Product Backlog Items, Bugs).

**Dead Candidates - Additional from Comprehensive Scan**
Group by work item type. Each section includes a table:
`ID | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals | LastSubstantiveChange | LastChangedDate`

**Format:** Make the ID column a clickable link: `[ID](url) | Title | ...`

Include `LastChangedDate` to show the recent automated update that caused Fast Scan to miss this item.

**At Risk - Additional from Comprehensive Scan**
Mirror the structure above with clickable ID links and `LastChangedDate` column: `[ID](url) | Title | State | DaysInactive | AssignedTo | CreatedBy | ReasonSignals | LastChangedDate`

---

### Combined Summary
- **Total Dead Items Found:** [Fast Scan count] + [Additional from Comprehensive] = [Total]
- **Fast Scan Coverage:** [Fast Scan count] / [Total] = [Percentage]%
- **Comprehensive Scan Value:** [Additional count] items would have been missed by Fast Scan alone

### Recommendations
Provide clear actions (close, merge, clarify, re-scope, delete). Report only—no destructive changes without explicit user approval.

## �💡 Auto-Remediation Strategies

**Add Audit Comments** - Tag items with templated comments requesting owner action
**Tag for Review** - Add "NeedsReview", "QualityIssue", "NeedsEstimate" tags
**Close Dead Items** - Update state to Closed with inactivity reason in History
**Bulk Updates** - Use query handles with JSON patch operations for field updates
**🆕 AI-Powered Enhancement** - Use bulk intelligent tools to enhance descriptions, estimate story points, and add acceptance criteria

## 🤖 AI-Powered Enhancement Tools

Three intelligent tools for automated work item quality improvement:

### 1. Enhance Descriptions (`wit-bulk-enhance-descriptions-by-query-handle`)

Generate improved descriptions for items with missing or poor content.

**Styles:** `detailed` | `concise` | `technical` | `business`

```json
{
  "queryHandle": "{handle}",
  "enhancementStyle": "technical",
  "preserveExisting": true,
  "sampleSize": 20,
  "dryRun": true
}
```

### 2. Estimate Story Points (`wit-bulk-assign-story-points-by-query-handle`)

AI-powered effort estimation with reasoning and confidence scores.

**Scales:** `fibonacci` (1,2,3,5,8,13) | `linear` (1-10) | `t-shirt` (XS-XXL)

```json
{
  "queryHandle": "{handle}",
  "pointScale": "fibonacci",
  "onlyUnestimated": true,
  "dryRun": true
}
```

**Features:**
- Analyzes complexity, scope, and risk
- Suggests decomposition for large items
- Auto-skips completed/closed items

### 3. Add Acceptance Criteria (`wit-bulk-add-acceptance-criteria-by-query-handle`)

Generate testable acceptance criteria for stories and features.

**Formats:** `gherkin` (Given/When/Then) | `checklist` | `user-story`

```json
{
  "queryHandle": "{handle}",
  "criteriaFormat": "gherkin",
  "minCriteria": 3,
  "maxCriteria": 7,
  "preserveExisting": true,
  "dryRun": true
}
```

### Best Practices for AI Tools

- ✅ Always start with `dryRun: true`
- ✅ Review AI-generated content before applying
- ✅ Use `preserveExisting: true` to keep manual edits
- ✅ Process in batches (default 10, max 100)
- ✅ Check confidence scores for quality assessment
- ✅ Combine with `itemSelector` for targeted enhancement

## ❌ Anti-Patterns to Avoid

| Anti-Pattern | ❌ Wrong | ✅ Correct | Why It Matters |
|--------------|------------|--------------|----------------|
| **Duplicate Queries** | Query twice: once for data, once for handle | Single query with `returnQueryHandle: true` | Wastes API calls, data drift risk |
| **Manual ID Passing** | Copy work item IDs: `[5816698, 12476028]` | Always use query handles | LLMs hallucinate IDs, causing errors |
| **Ignoring Staleness** | Filter by `CreatedDate` only | Use `filterByDaysInactiveMin` | Old items may have recent updates |
| **Skip Dry-Run** | Execute changes directly | Always dry-run first, review, then execute | Can't preview impact |
| **Dead Items Only** | Focus only on removal | Analyze quality + metadata + staleness | Active items can have quality issues |
| **No Team Approval** | Bulk changes without consultation | Get stakeholder approval for >10 items | Damages trust, may close valuable work |

## ✅ Pre-Execution Validation

Before executing bulk operations:

**Data Validation:**
- [ ] Query returned expected item count
- [ ] Work items array reviewed and accurate
- [ ] Staleness data confirms items are truly inactive

**Approval & Safety:**
- [ ] Stakeholder approved the operation
- [ ] Dry-run executed successfully
- [ ] Query handle is fresh (<1 hour old)

**Documentation:**
- [ ] Audit comments added for state changes
- [ ] Issues documented and reported to owners
- [ ] Bulk changes >10 items reviewed with team

### Query Pattern: Single Call with Optional Filtering

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE ...",
  "includeFields": ["System.Title", "System.State", "..."],
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "computeMetrics": true,
  
  // 🔍 Server-side filtering (optional - pick one or combine)
  "filterByDaysInactiveMin": {{stalenessThresholdDays}},
  "filterByDaysInactiveMax": 30,
  "filterBySubstantiveChangeAfter": "2024-01-01T00:00:00Z",
  "filterBySubstantiveChangeBefore": "2024-12-31T23:59:59Z"
}
```

**Returns:**
✓ Query handle for bulk operations  
✓ Full work item data for review  
✓ Substantive change analysis  
✓ Computed metrics (daysInactive, isStale)  
✓ Pre-filtered results matching criteria

**Benefits:**
⚡ Faster - server-side filtering  
💰 Lower token cost  
🎯 More precise results  
🛡️ Safer operations

### Essential Workflow Steps

**1. Review Before Acting**

After querying, analyze the returned `work_items` array:
- Check total count matches expectations
- Review sample of item IDs and titles
- Verify staleness data (if applicable)
- Present summary to user and get approval

**2. Always Use Dry-Run First**
```json
{"queryHandle": "qh_...", "dryRun": true}
```

**3. Add Audit Trail**
```json
{"queryHandle": "qh_...", "comment": "Reason: ...", "dryRun": false}
```

**4. Handle Expiration**

Query handles expire after 1 hour. If you encounter an expiration error:
- Re-run the same WIQL query with `returnQueryHandle: true`
- The handle will be regenerated with current data
- Resume bulk operations with the new handle

**5. Quality Standards**

Establish team agreements:
- User Stories require acceptance criteria
- Titles: 25-80 chars with action verbs
- Descriptions explain "what", "why", "how"
- Active items have assigned owners
- Child items link to parents
- Stories/PBIs have effort estimates

## 🎯 Key Takeaways

### Technical Patterns
1. **Single Query Pattern** - `returnQueryHandle: true` returns BOTH handle AND full data
2. **Staleness Analysis** - Use `filterByDaysInactiveMin` for server-side filtering
3. **Handle Lifecycle** - Handles expire after 1 hour; re-query if needed
4. **Dry-Run First** - Always preview before executing bulk operations

### Quality Analysis
5. **Multi-Dimensional Assessment** - Evaluate content, metadata, freshness, hierarchy
6. **Scoring Rubrics** - Use objective criteria to prioritize improvements
7. **Comprehensive Coverage** - Check dead items + quality + completeness + clarity

### Process & Governance
8. **Analysis Before Action** - Understand problem space before making changes
9. **Audit Trail** - Comment before destructive operations
10. **Team Ownership** - Get stakeholder approval for bulk operations
11. **Continuous Improvement** - Regular health checks prevent technical debt

### Impact Focus
12. **Story Point Priority** - Missing estimates block sprint planning and velocity tracking
13. **Quality Over Quantity** - Well-documented items > numerous vague ones
14. **Enable Self-Service** - Tag for owner action rather than centralized fixes

## 📊 Recommended Cadence

**Weekly**: 
- Review blocked items
- Check unassigned active work

**Bi-Weekly**:
- Analyze new items for quality
- Update stale item priorities

**Monthly**:
- Full backlog health report
- Triage items >90 days old

**Quarterly**:
- Close dead items (>{{stalenessThresholdDays}} days)
- Refactor hierarchy and taxonomy
- Review and update team quality standards

## 📊 Available Template Variables

**Prompt Arguments:**
- `{{stalenessThresholdDays}}` - Days threshold for staleness detection (default: 180)

**Configuration Variables:**
- `{{area_path}}` - Full escaped area path for WIQL queries (e.g., `'Project\\Team\\Component'`)
- `{{area_path_simple_substring}}` - Simple substring for OData contains() queries without backslashes (e.g., `Component`)
  - Extracted from: `One\Azure Compute\OneFleet Node\Azure Host` → `Azure Host`
  - Use in OData: `$apply=filter(contains(Area/AreaPath, '{{area_path_simple_substring}}'))`
- `{{project}}` - Project name
- `{{organization}}` - Organization name

**Bulk Operation Template Variables** (available in query handles with staleness context):
- `{daysInactive}` - Days since last substantive change
- `{lastSubstantiveChangeDate}` - Date of last substantive change (ISO 8601 format)
- `{title}` - Work item title
- `{state}` - Current state
- `{type}` - Work item type (Task, Product Backlog Item, Bug, etc.)
- `{assignedTo}` - Assigned user (display name)
- `{id}` - Work item ID
- `{url}` - Direct link to work item

**Usage Example:**
```json
{
  "comment": "Item {id}: '{title}' inactive for {daysInactive} days (last change: {lastSubstantiveChangeDate})"
}
```

## �📋 Complete Workflow Templates

### Template 1: Comprehensive Quality Analysis (Recommended Starting Point)

```json
// Query all active actionable work items (Tasks, PBIs, Bugs only - excludes Features/Epics)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed') ORDER BY [System.WorkItemType], [System.State]",
  "includeFields": [
    "System.Title", 
    "System.State", 
    "System.Description",
    "System.AssignedTo",
    "System.CreatedDate",
    "System.CreatedBy",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "System.IterationPath"
  ],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 500
}

// Analyze returned work_items array and categorize:
// 1. Dead items: daysInactive > {{stalenessThresholdDays}}
// 2. Poor descriptions: empty, <20 chars, or placeholder text
// 3. Poor titles: <15 chars, >120 chars, or generic
// 4. Missing story points: PBIs without estimates
// 5. Missing metadata: unassigned active items, no priority, no iteration
// 6. Missing acceptance criteria: PBIs without criteria

// Present comprehensive report with item listings per category
// User can then request targeted actions like:
// - "Enhance descriptions for all items in Poor/Missing Descriptions"
// - "Estimate story points for all unestimated PBIs"
// - "Remove all dead items"
```

### Template 2: Find and Remove Stale Items (Two-Pass Strategy)

```json
// PASS 1: Fast Scan - Date-filtered query (ACTIONABLE ITEMS ONLY)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] IN ('New', 'Proposed', 'Active', 'In Progress', 'To Do', 'Backlog', 'Committed', 'Open') AND [System.ChangedDate] < @Today - {{stalenessThresholdDays}} ORDER BY [System.ChangedDate] ASC",
  "includeFields": ["System.Title", "System.State", "System.CreatedDate", "System.CreatedBy", "System.AssignedTo"],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 200
}

// Optional: Inspect query handle from Pass 1
{"queryHandle": "{fastScanHandle}", "includePreview": true, "includeStats": true}

// PASS 2: Comprehensive Scan - No date filter (ACTIONABLE ITEMS ONLY)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] IN ('New', 'Proposed', 'Active', 'In Progress', 'To Do', 'Backlog', 'Committed', 'Open') ORDER BY [System.ChangedDate] ASC",
  "includeFields": ["System.Title", "System.State", "System.CreatedDate"],
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 50,
  "returnQueryHandle": true,
  "maxResults": 200
}

// Filter Pass 2 results client-side: daysInactive > {{stalenessThresholdDays}} AND not in Pass 1 IDs
// Review both result sets, show user summary with complete item listings, get approval

// Add audit comments (use Pass 1 or Pass 2 handle)
{
  "queryHandle": "{handle}",
  "comment": "🤖 Inactive for {daysInactive} days since {lastSubstantiveChangeDate}. Moving to Removed.",
  "dryRun": false
}

// Execute removal
{"queryHandle": "{handle}", "removeReason": "Stale >{{stalenessThresholdDays}} days", "dryRun": false}
```

### Template 3: Bulk State Transition

```json
// 1. Query target items (actionable items only - excludes Features/Epics)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'Deprecated' AND [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug')",
  "returnQueryHandle": true
}

// 2. Review and get approval

// 3. Add comment
{"queryHandle": "{handle}", "comment": "🔄 Moving deprecated items to Removed state"}

// 4. Update state (dry-run, then execute)
{
  "queryHandle": "{handle}",
  "updates": [{"op": "replace", "path": "/fields/System.State", "value": "Removed"}],
  "dryRun": false
}
```

### Template 4: AI-Powered Progressive Enhancement

```json
// 1. Query items needing quality improvements (actionable items only - excludes Features/Epics)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('New', 'Active') AND [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug')",
  "returnQueryHandle": true,
  "includeFields": ["System.Title", "System.Description", "Microsoft.VSTS.Common.AcceptanceCriteria"]
}

// 2. Review items and identify gaps

// 3. Enhance descriptions (dry-run, review, apply)
{
  "queryHandle": "{handle}",
  "enhancementStyle": "detailed",
  "preserveExisting": true,
  "dryRun": false
}

// 4. Add acceptance criteria (dry-run, review, apply)
{
  "queryHandle": "{handle}",
  "criteriaFormat": "gherkin",
  "minCriteria": 3,
  "maxCriteria": 7,
  "dryRun": false
}

// 5. Estimate story points (dry-run, review, apply)
{
  "queryHandle": "{handle}",
  "itemSelector": {"states": ["Active"]},
  "pointScale": "fibonacci",
  "onlyUnestimated": true,
  "dryRun": false
}

// Result: Items have complete descriptions, acceptance criteria, and estimates
```

### Template 5: Selective Enhancement with itemSelector

```json
// 1. Query all actionable items in area path (excludes Features/Epics)
{"wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug')", "returnQueryHandle": true}

// 2. Enhance only high-priority items
{
  "queryHandle": "{handle}",
  "itemSelector": {"tags": ["High-Priority"], "states": ["Active"]},
  "enhancementStyle": "business"
}

// 3. Estimate only stale items
{
  "queryHandle": "{handle}",
  "itemSelector": {"daysInactiveMin": 30, "daysInactiveMax": 180},
  "pointScale": "t-shirt"
}

// 4. Add criteria to specific items by index
{
  "queryHandle": "{handle}",
  "itemSelector": [0, 2, 5, 8],
  "criteriaFormat": "checklist"
}
```

## 🎓 Best Practices for Quality Analysis

### 1. Start with Comprehensive Analysis and Categorized Listings
**Approach:**
1. Run comprehensive query for all active actionable work items (Tasks, PBIs, Bugs)
2. Categorize items by issue type (dead, poor descriptions, missing metadata, etc.)
3. Present detailed listings with ALL items in each category
4. Enable targeted remediation commands like:
   - "Enhance descriptions for all items in Poor/Missing Descriptions"
   - "Estimate story points for active PBIs in Missing Story Points"
   - "Remove all dead Tasks"
   - "Add acceptance criteria to PBIs with missing criteria"

**Never:** Jump directly to bulk operations without showing user the complete item list for each category.

### 2. Use Category-Based Remediation Commands
The report format provides named categories that users can reference:
- **"Dead Items"** - For removal or commenting
- **"Poor/Missing Descriptions"** - For AI enhancement
- **"Poor/Generic Titles"** - For title improvements
- **"Missing Story Points/Estimates"** - For AI estimation
- **"Missing Critical Metadata"** - For assignment/tagging
- **"Missing Acceptance Criteria"** - For criteria generation

Users can filter within categories:
- "...for Tasks" or "...for PBIs" or "...for Bugs"
- "...for active items" or "...for unassigned items"
- "...for items assigned to [person]"

### 2. Use Progressive Disclosure
- **First Pass:** High-level metrics (counts, percentages)
- **Second Pass:** Detailed breakdown by category
- **Third Pass:** Specific items requiring action
- **Final Step:** Remediation plan with priorities

### 3. Combine Multiple Quality Dimensions
Don't analyze in isolation - combine:
- Staleness (daysInactive)
- Content quality (description, title)
- Metadata completeness (assignee, priority, story points)
- Hierarchy (parent links, work item type)

### 4. Provide Context, Not Just Data
For each issue found:
- **What:** The specific problem
- **Why:** Business impact or risk
- **How:** Suggested remediation
- **Who:** Responsible party
- **When:** Recommended timeline

### 5. Enable Self-Service
Tag items for owner action rather than making all changes centrally:
- Add "NeedsReview" tags
- Post templated comments with clear actions
- Set reasonable deadlines
- Follow up on non-compliance

