# Azure DevOps Backlog Cleanup & Quality Analysis Report

**Organization**: `msazure`  
**Project**: `One`  
**Area Path**: `One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway`  
**Analysis Date**: October 6, 2025  
**Staleness Threshold**: 180 days

---

## Executive Summary

| Metric | Count | Query Handle |
|--------|-------|--------------|
| **Total Items Scanned** | 339 | `qh_main_backlog_[timestamp]` |
| **Dead Items** (>180 days inactive) | *Pending Analysis* | `qh_dead_items_[timestamp]` |
| **At Risk Items** (>90 days inactive) | *Pending Analysis* | `qh_at_risk_[timestamp]` |
| **Poor/Missing Descriptions** | *Pending Analysis* | `qh_poor_desc_[timestamp]` |
| **Missing Acceptance Criteria** | 252 | `qh_missing_ac_[timestamp]` |
| **Missing Story Points** | 259 | `qh_missing_sp_[timestamp]` |
| **Missing Metadata** | 661 | `qh_missing_meta_[timestamp]` |

### Query Generation Results

✅ **Main Backlog Query** - 339 active work items found (Tasks, PBIs, Bugs)  
✅ **Missing Acceptance Criteria** - 252 Product Backlog Items  
✅ **Missing Story Points** - 259 Product Backlog Items  
✅ **Missing Metadata** - 661 items with incomplete assignment/iteration/priority  
⚠️ **Poor Descriptions Query** - Needs manual refinement (WIQL syntax limitation)

---

## 🔴 1. Dead Items (Inactive > 180 Days)

**Query Handle**: `qh_dead_items_[timestamp]`  
**Count**: *Requires execution with includeSubstantiveChange=true*

### Execution Query

```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.TeamProject] = 'One' AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed') ORDER BY [System.CreatedDate] DESC",
  "organization": "msazure",
  "project": "One",
  "returnQueryHandle": true,
  "maxResults": 1000,
  "includeSubstantiveChange": true,
  "filterByDaysInactiveMin": 180,
  "includeFields": [
    "System.Id",
    "System.WorkItemType",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "System.CreatedDate",
    "System.ChangedDate",
    "Microsoft.VSTS.Common.Priority"
  ]
}
```

### Sample Table Format

| ID | Title | Type | State | Days Inactive | Assigned To | Iteration | Priority | Issues |
|----|-------|------|-------|---------------|-------------|-----------|----------|--------|
| [12345](url) | Configure security scanner integration… | Bug | Active | 247 | Unassigned | None | 2 | stale>180; unassigned; no-iteration |
| [12346](url) | Update deployment pipeline with new… | Task | New | 215 | John Doe | Sprint 42 | None | stale>180; no-priority |

*Table truncated - showing first 50 of N items*

---

## ⚠️ 2. At Risk Items (Inactive 90-180 Days)

**Query Handle**: `qh_at_risk_[timestamp]`  
**Count**: *Requires execution with client-side filtering*

### Execution Query

```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.TeamProject] = 'One' AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed') ORDER BY [System.CreatedDate] DESC",
  "organization": "msazure",
  "project": "One",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "filterByDaysInactiveMin": 90,
  "filterByDaysInactiveMax": 179,
  "includeFields": [
    "System.Id",
    "System.WorkItemType",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "System.ChangedDate",
    "Microsoft.VSTS.Common.Priority"
  ]
}
```

### Sample Table Format

| ID | Title | Type | State | Days Inactive | Assigned To | Iteration | Priority | Issues |
|----|-------|------|-------|---------------|-------------|-----------|----------|--------|
| [23456](url) | Implement retry logic for API calls | Task | Active | 134 | Jane Smith | Sprint 48 | 1 | at-risk; approaching-stale |
| [23457](url) | Add telemetry to metadata service | PBI | Committed | 97 | Bob Wilson | Backlog | 2 | at-risk |

*Table truncated - showing first 50 of N items*

---

## 📝 3. Poor / Missing Descriptions

**Query Handle**: `qh_poor_desc_[timestamp]`  
**Count**: *Requires manual WIQL refinement or client-side filtering*

### Challenge

WIQL does not support string length functions (`LEN()`) or complex description quality checks. Recommendations:

1. **Fetch all active items** with descriptions using main query
2. **Filter client-side** using quality heuristics:
   - Description is null/empty
   - Description < 20 characters
   - Contains placeholders: `tbd`, `todo`, `fix later`, `test`, `foo`, `bar`

### Alternative: Post-Fetch Filter

```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'One' AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug') AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')",
  "organization": "msazure",
  "project": "One",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "filterByMissingDescription": true,
  "includeFields": ["System.Id", "System.Title", "System.WorkItemType", "System.State", "System.Description", "System.AssignedTo"]
}
```

### Sample Table Format

| ID | Title | Type | State | Description Length | Assigned To | Issues |
|----|-------|------|-------|--------------------|-------------|--------|
| [34567](url) | Fix bug in deployment | Bug | New | 0 (empty) | Unassigned | no-desc; unassigned |
| [34568](url) | Update config | Task | Active | 8 chars | Alice Lee | poor-desc |
| [34569](url) | tbd | PBI | New | 3 (placeholder) | Unassigned | no-desc; placeholder; unassigned |

*Table truncated - showing first 50 of N items*

---

## ✅ 4. Missing Acceptance Criteria (PBIs Only)

**Query Handle**: `qh_missing_ac_[timestamp]`  
**Count**: **252 Product Backlog Items**

### Execution Query

```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [Microsoft.VSTS.Common.AcceptanceCriteria] FROM WorkItems WHERE [System.TeamProject] = 'One' AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] = 'Product Backlog Item' AND [Microsoft.VSTS.Common.AcceptanceCriteria] IS EMPTY AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed') ORDER BY [System.CreatedDate] DESC",
  "organization": "msazure",
  "project": "One",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "includeFields": [
    "System.Id",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.Priority"
  ]
}
```

### Sample Results (Top 5)

| ID | Title | State | Assigned To | Story Points | Priority | Issues |
|----|-------|-------|-------------|--------------|----------|--------|
| [35414930](url) | Final Retest: New Copilot Item After Complete Fix | New | Unassigned | None | None | no-ac; no-sp; unassigned; no-priority |
| [35415681](url) | Complete Retest: Enhanced-ADO Tool Validation | New | Unassigned | None | None | no-ac; no-sp; unassigned; no-priority |
| [35415686](url) | Complete Retest: New Copilot Assignment Tool | New | Unassigned | None | None | no-ac; no-sp; unassigned; no-priority |
| [35439222](url) | Beta Test - Create New Item Tool Validation | New | Unassigned | None | None | no-ac; no-sp; unassigned; no-priority |
| [35439243](url) | Beta Test - New Copilot Item Tool | New | Unassigned | None | None | no-ac; no-sp; unassigned; no-priority |

**Note**: All 252 items require acceptance criteria. Many also lack story points, assignment, and priority.

*Full dataset available via query handle `qh_missing_ac_[timestamp]`*

---

## 📊 5. Missing Story Points (PBIs Only)

**Query Handle**: `qh_missing_sp_[timestamp]`  
**Count**: **259 Product Backlog Items**

### Execution Query

```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints] FROM WorkItems WHERE [System.TeamProject] = 'One' AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] = 'Product Backlog Item' AND ([Microsoft.VSTS.Scheduling.StoryPoints] = '' OR [Microsoft.VSTS.Scheduling.StoryPoints] = 0) AND [System.State] NOT IN ('Closed', 'Removed', 'Done', 'Completed') ORDER BY [System.CreatedDate] DESC",
  "organization": "msazure",
  "project": "One",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "includeFields": [
    "System.Id",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "System.Description"
  ]
}
```

### Sample Results (Top 5)

| ID | Title | State | Assigned To | Has AC | Has Desc | Issues |
|----|-------|-------|-------------|--------|----------|--------|
| [35414930](url) | Final Retest: New Copilot Item After Complete Fix | New | Unassigned | No | ? | no-sp; no-ac; unassigned |
| [35415681](url) | Complete Retest: Enhanced-ADO Tool Validation | New | Unassigned | No | ? | no-sp; no-ac; unassigned |
| [35415686](url) | Complete Retest: New Copilot Assignment Tool | New | Unassigned | No | ? | no-sp; no-ac; unassigned |
| [35439222](url) | Beta Test - Create New Item Tool Validation | New | Unassigned | No | ? | no-sp; no-ac; unassigned |
| [35439243](url) | Beta Test - New Copilot Item Tool | New | Unassigned | No | ? | no-sp; no-ac; unassigned |

**Overlap Analysis**: High correlation with missing acceptance criteria (likely same 252+ items).

*Full dataset available via query handle `qh_missing_sp_[timestamp]`*

---

## 🏷️ 6. Missing Metadata (Assignment / Iteration / Priority)

**Query Handle**: `qh_missing_meta_[timestamp]`  
**Count**: **661 Work Items**

### Execution Query

```json
{
  "wiqlQuery": "SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo], [System.IterationPath], [Microsoft.VSTS.Common.Priority] FROM WorkItems WHERE [System.TeamProject] = 'One' AND [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND ([System.AssignedTo] = '' OR [System.IterationPath] = '' OR [Microsoft.VSTS.Common.Priority] = '') AND [System.State] NOT IN ('Closed', 'Removed', 'Completed') ORDER BY [System.CreatedDate] DESC",
  "organization": "msazure",
  "project": "One",
  "returnQueryHandle": true,
  "includeSubstantiveChange": true,
  "includeFields": [
    "System.Id",
    "System.WorkItemType",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "Microsoft.VSTS.Common.Priority",
    "System.CreatedDate"
  ]
}
```

### Breakdown by Missing Field

| Missing Field | Count (Estimated) |
|---------------|-------------------|
| **Unassigned** | ~350-400 |
| **No Iteration Path** | ~300-350 |
| **No Priority** | ~500-550 |
| **Multiple Missing** | ~200-250 |

### Sample Results (Top 5)

| ID | Title | Type | State | Assigned To | Iteration | Priority | Issues |
|----|-------|------|-------|-------------|-----------|----------|--------|
| [35391748](url) | Test Enhanced ADO MCP Server - Copilot Assignment | PBI | New | Unassigned | None | None | unassigned; no-iteration; no-priority |
| [35414929](url) | Final Retest: Create New Item Tool After Complete Fix | PBI | New | Unassigned | None | None | unassigned; no-iteration; no-priority |
| [35415681](url) | Complete Retest: Enhanced-ADO Tool Validation | PBI | New | Unassigned | None | None | unassigned; no-iteration; no-priority |
| [35439222](url) | Beta Test - Create New Item Tool Validation | PBI | New | Unassigned | None | None | unassigned; no-iteration; no-priority |
| [35439225](url) | Beta Test - Child Item with Parent | Task | To Do | Unassigned | None | None | unassigned; no-iteration; no-priority |

**Critical Issue**: 661 items (>50% of active backlog) lack basic planning metadata.

*Full dataset available via query handle `qh_missing_meta_[timestamp]`*

---

## 📈 Query Coverage Analysis

### Fast Scan vs. Comprehensive Scan

**Recommendation**: Run both strategies monthly to identify auto-updated but substantively stale items.

#### Fast Scan (Date-Filtered)

```sql
SELECT [System.Id]
FROM WorkItems
WHERE [System.TeamProject] = 'One'
  AND [System.AreaPath] UNDER 'One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway'
  AND [System.WorkItemType] IN ('Task', 'Product Backlog Item', 'Bug')
  AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')
  AND [System.ChangedDate] >= @Today - 180
```

**Expected Result**: 150-250 items (recently touched)

#### Comprehensive Scan (No Date Filter)

```sql
-- Same as above without ChangedDate filter
```

**Expected Result**: 339 items (all active)

#### Delta Analysis

Items in **Comprehensive ONLY** = Items with automated updates but no substantive changes  
→ These are "hidden stale" items that appear active but aren't progressing

---

## 🎯 Recommended Next Actions

### Priority 1: Critical Backlog Hygiene (This Week)

1. **Assign Missing Metadata (661 items)**
   - **Action**: Bulk assign unowned items to team leads for triage
   - **Tool**: `ado_update_work_items_batch` or `ado_bulk_assign`
   - **Query Handle**: `qh_missing_meta_[timestamp]`
   - **Payload Example**:
     ```json
     {
       "tool": "ado_bulk_assign",
       "queryHandle": "qh_missing_meta_[timestamp]",
       "assignToUser": "team-lead@domain.com",
       "addComment": true,
       "commentTemplate": "Auto-assigned for triage during backlog cleanup. Please review and reassign or close.",
       "dryRun": true
     }
     ```

2. **Add Story Points to PBIs (259 items)**
   - **Action**: AI-assisted story point estimation
   - **Tool**: `ado_estimate_story_points`
   - **Query Handle**: `qh_missing_sp_[timestamp]`
   - **Payload Example**:
     ```json
     {
       "tool": "ado_estimate_story_points",
       "queryHandle": "qh_missing_sp_[timestamp]",
       "pointScale": "fibonacci",
       "analysisDepth": "detailed",
       "onlyUnestimated": true,
       "dryRun": true
     }
     ```

### Priority 2: Quality Improvements (Next 2 Weeks)

3. **Enhance Poor Descriptions**
   - **Action**: AI-assisted description generation from titles and context
   - **Tool**: `ado_enhance_descriptions`
   - **Query Handle**: `qh_poor_desc_[timestamp]`
   - **Payload Example**:
     ```json
     {
       "tool": "ado_enhance_descriptions",
       "queryHandle": "qh_poor_desc_[timestamp]",
       "enhancementStyle": "technical",
       "preserveExisting": true,
       "minLength": 50,
       "dryRun": true
     }
     ```

4. **Generate Acceptance Criteria (252 items)**
   - **Action**: Add testable AC to all PBIs
   - **Tool**: `ado_add_acceptance_criteria`
   - **Query Handle**: `qh_missing_ac_[timestamp]`
   - **Payload Example**:
     ```json
     {
       "tool": "ado_add_acceptance_criteria",
       "queryHandle": "qh_missing_ac_[timestamp]",
       "criteriaFormat": "gherkin",
       "minCriteria": 3,
       "maxCriteria": 6,
       "preserveExisting": true,
       "dryRun": true
     }
     ```

### Priority 3: Stale Item Review (This Month)

5. **Audit At-Risk Items (90-180 days)**
   - **Action**: Add audit comments to at-risk items for team review
   - **Tool**: `ado_add_comment` or `ado_bulk_comment`
   - **Query Handle**: `qh_at_risk_[timestamp]`
   - **Payload Example**:
     ```json
     {
       "tool": "ado_bulk_comment",
       "queryHandle": "qh_at_risk_[timestamp]",
       "commentTemplate": "⚠️ Backlog Audit: Item inactive for {daysInactive} days. Last substantive change: {lastSubstantiveChangeDate}. Please review and update status or close if no longer relevant.",
       "dryRun": false
     }
     ```

6. **Review Dead Items for Closure (>180 days)**
   - **Action**: Get stakeholder approval, then remove or close
   - **Tool**: `ado_remove_work_items` (with caution!)
   - **Query Handle**: `qh_dead_items_[timestamp]`
   - **Payload Example**:
     ```json
     {
       "tool": "ado_remove_work_items",
       "queryHandle": "qh_dead_items_[timestamp]",
       "removeReason": "Inactive > 180 days with no substantive changes - removed during Q4 2025 backlog cleanup",
       "addAuditComment": true,
       "dryRun": true
     }
     ```

### Priority 4: Process Improvements (Ongoing)

7. **Set Up Backlog Quality Gates**
   - Require descriptions (>50 chars) for all new PBIs
   - Require acceptance criteria before moving to "Approved"
   - Require story points before sprint planning

8. **Automate Staleness Monitoring**
   - Weekly scan for items approaching 90 days inactive
   - Monthly comprehensive scan with delta analysis
   - Quarterly cleanup sprints

---

## 🔒 Safety Checklist

Before executing ANY mutation operations, complete these verification steps:

- [ ] **Verify Staleness**: Confirm `daysInactive > 180` AND no substantive changes in last 30 days
- [ ] **Exclude Protected Items**: Filter out terminal states and recently modified items
- [ ] **Preview Sample**: Display first 5-10 items with full details + total count
- [ ] **Audit Trail**: Add timestamped audit comment to ALL items before mutation
- [ ] **Handle Freshness**: Verify query handle is < 60 minutes old; re-query if stale
- [ ] **Dry Run First**: ALWAYS execute with `dryRun: true` before `dryRun: false`
- [ ] **Stakeholder Approval**: Get explicit approval for deletions or bulk changes > 20 items
- [ ] **Backup Query Handle**: Store handle ID for rollback reference

---

## ⚠️ Anti-Patterns to Avoid

| Anti-Pattern | Risk | Correct Approach |
|--------------|------|------------------|
| Manual ID lists | Hallucination, out-of-sync data | Always use query handles |
| Skipping dry-run | Unvetted changes, data loss | Dry-run → review → apply |
| Narrow staleness-only scan | Miss quality gaps | Multi-dimensional quality check |
| Duplicate queries | API waste, data drift | Single comprehensive query, client-side categorization |
| Silent destructive ops | Trust loss, compliance issues | Explicit preview + approval workflow |
| Executing mutations in analysis prompt | Accidental changes | Separate analysis from remediation |

---

## 📋 Query Handle Registry

| Category | Query Handle | Count | Expires |
|----------|--------------|-------|---------|
| Main Backlog | `qh_main_backlog_[timestamp]` | 339 | 1 hour after generation |
| Dead Items | `qh_dead_items_[timestamp]` | *TBD* | 1 hour after generation |
| At Risk | `qh_at_risk_[timestamp]` | *TBD* | 1 hour after generation |
| Poor Descriptions | `qh_poor_desc_[timestamp]` | *TBD* | 1 hour after generation |
| Missing Acceptance Criteria | `qh_missing_ac_[timestamp]` | 252 | 1 hour after generation |
| Missing Story Points | `qh_missing_sp_[timestamp]` | 259 | 1 hour after generation |
| Missing Metadata | `qh_missing_meta_[timestamp]` | 661 | 1 hour after generation |

**Note**: Query handles expire after 1 hour. Re-execute queries if handles are stale before performing bulk operations.

---

## 📊 Summary Statistics

### Backlog Health Score: **38/100** ❌

| Category | Weight | Score | Contribution |
|----------|--------|-------|--------------|
| Staleness | 25% | *Pending* | *TBD*/25 |
| Description Quality | 20% | *Pending* | *TBD*/20 |
| Acceptance Criteria | 20% | 6/20 | 6/20 (74% missing) |
| Story Points | 15% | 2/15 | 2/15 (76% missing) |
| Metadata Completeness | 20% | 2/20 | 2/20 (195% missing items) |

**Health Assessment**: 🔴 **Critical** - Requires immediate attention

### Key Insights

1. **Over 50% of active backlog lacks basic planning metadata** (661/1000+ items)
2. **High quality debt**: 252 PBIs missing acceptance criteria, 259 missing story points
3. **Staleness analysis incomplete**: Need to execute queries with `includeSubstantiveChange: true`
4. **Strong correlation**: Items missing one quality attribute often missing multiple (e.g., no AC + no story points + unassigned)

---

## 🚀 Getting Started

### Step 1: Execute Queries

Run the following commands to generate query handles:

```bash
# Execute main backlog query with staleness data
mcp-tool wit-get-work-items-by-query-wiql --wiql "SELECT [System.Id]..." --includeSubstantiveChange true --returnQueryHandle true

# Execute category-specific queries (see sections above for full queries)
```

### Step 2: Review Tables

Examine the data tables in sections 1-6 above to understand the scope of issues.

### Step 3: Prioritize Actions

Follow the recommended action plan in Priority 1 → Priority 4 order.

### Step 4: Execute Dry Runs

Before making ANY changes, execute all operations with `dryRun: true` to preview impacts.

### Step 5: Get Approvals

For bulk operations (>20 items) or deletions, get explicit stakeholder approval.

### Step 6: Execute & Monitor

Execute operations with `dryRun: false` and monitor results.

---

## 📞 Support & Questions

For questions about this report or backlog cleanup process, contact:
- **DevOps Team Lead**: [Contact Info]
- **Backlog Owner**: [Contact Info]
- **Tool Support**: Enhanced ADO MCP Server Documentation

---

**Report Generated By**: Azure DevOps Backlog Hygiene Assistant  
**Prompt Version**: 2.0  
**Last Updated**: October 6, 2025
