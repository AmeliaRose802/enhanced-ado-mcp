---
name: backlog_cleanup
description: Comprehensive backlog hygiene analysis with AI-powered remediation - identifies dead items, quality issues, missing metadata, and auto-enhances content
arguments: {}
---

# Backlog Cleanup & Quality Analysis

## 🎯 Purpose

Perform comprehensive backlog hygiene analysis to identify and remediate quality issues across Azure DevOps work items using both manual and AI-powered tools.

### What This Prompt Detects

| Issue Type | Description | Impact |
|------------|-------------|--------|
| 💀 **Dead Items** | Inactive >180 days with no substantive changes | Clutters backlog, obscures real work |
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
  "filterByDaysInactiveMin": 180,
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

### Workflow 1: Find and Remove Dead Items

**Step 1: Query with Staleness Analysis**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' AND [System.CreatedDate] < @Today - 180 AND [System.AreaPath] UNDER '{{areaPath}}'",
  "returnQueryHandle": true,
  "filterByDaysInactiveMin": 180,
  "includeFields": ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo"],
  "maxResults": 200
}
```

**Alternative:** Use date filtering instead:
```json
{
  "filterBySubstantiveChangeBefore": "2024-06-01T00:00:00Z"
}
```

**Step 2: Review Results**

Analyze the returned `work_items` array:
- Total count and staleness distribution
- Last substantive change dates
- Present summary to user for approval

**Step 3: Add Audit Comments**
```json
{
  "queryHandle": "{handle}",
  "comment": "🤖 **Automated Backlog Hygiene**\n\nInactive for {daysInactive} days since {lastSubstantiveChangeDate}.\n\n**Action:** Moving to Removed state due to extended inactivity.\n\n**Recovery:** Update state and add comment if this work is still relevant.",
  "dryRun": true
}
```

**Template Variables:**
- `{daysInactive}` - Days since last change
- `{lastSubstantiveChangeDate}` - Date of last change
- `{title}`, `{state}`, `{type}`, `{assignedTo}` - Work item fields

**Step 4: Execute Removal**
```json
{
  "queryHandle": "{handle}",
  "removeReason": "Backlog cleanup: Items inactive >180 days",
  "dryRun": false
}
```

### Other Common Workflows

All follow the pattern: **Query → Analyze → Remediate**

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

## 💡 Auto-Remediation Strategies

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
  
  // � Server-side filtering (optional - pick one or combine)
  "filterByDaysInactiveMin": 180,
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
- Close dead items (>180 days)
- Refactor hierarchy and taxonomy
- Review and update team quality standards

## 📋 Complete Workflow Templates

### Template 1: Find and Remove Stale Items

```json
// 1. Query with staleness analysis
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' AND [System.CreatedDate] < @Today - 180",
  "returnQueryHandle": true,
  "filterByDaysInactiveMin": 180,
  "includeFields": ["System.Title", "System.State", "System.CreatedDate"]
}

// 2. Review work_items array, show user summary, get approval

// 3. Add audit comment
{
  "queryHandle": "{handle}",
  "comment": "🤖 Inactive for {daysInactive} days since {lastSubstantiveChangeDate}. Moving to Removed.",
  "dryRun": false
}

// 4. Dry-run removal
{"queryHandle": "{handle}", "removeReason": "Stale >180 days", "dryRun": true}

// 5. Execute after approval
{"queryHandle": "{handle}", "removeReason": "Stale >180 days", "dryRun": false}
```

### Template 2: Bulk State Transition

```json
// 1. Query target items
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'Deprecated'",
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

### Template 3: AI-Powered Progressive Enhancement

```json
// 1. Query items needing quality improvements
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('New', 'Active')",
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

### Template 4: Selective Enhancement with itemSelector

```json
// 1. Query all items
{"wiqlQuery": "SELECT [System.Id] FROM WorkItems", "returnQueryHandle": true}

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

### 1. Start with Analysis, Not Action
**Approach:**
1. Run analytical queries across multiple dimensions
2. Generate comprehensive report
3. Present findings to stakeholders
4. Get approval for remediation approach
5. Execute changes with audit trail

**Never:** Jump directly to bulk operations without understanding the problem space.

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

