---
name: backlog_cleanup_by_hierarchy
description: Assess Azure DevOps backlog health hierarchically, starting from Key Results and analyzing all descendant work items in a structured tree format.
version: 2
arguments: {}
---

You are an assistant working with an Azure DevOps (ADO) MCP server. Your task is to assess backlog health by walking through the work item hierarchy, starting from Key Results and systematically analyzing each branch and its descendants. This hierarchical approach helps teams understand how quality and activity issues cascade through the work item tree, making it easier to identify areas where entire branches may need attention.

**Important:** **Exclude work items in Done/Completed/Closed/Resolved states from analysis** - these represent successfully completed work. Focus on active work items to understand their health, clarity, and actionability.

**Configuration (Auto-Populated):**
- **Organization & Project:** Auto-filled from configuration
- **Area Path:** {{area_path}} (defaults to configured area path)
- **Max Age Days:** {{max_age_days}} (default: 180)

**Note:** This prompt provides hierarchical analysis only and does not modify work items.

**Available MCP tools:**
- `wit-query-analytics-odata` – ⭐ PREFERRED for aggregated metrics (counts by state/type/assignee, distributions)
- `wit-get-work-items-by-query-wiql` – primary retrieval with built-in substantive change analysis (use `includeSubstantiveChange: true`)
  - **Important**: Use simple `SELECT [System.Id] FROM WorkItems WHERE...` queries, NOT `WorkItemLinks` queries
  - WorkItemLinks queries are not fully supported by this tool and will return empty results
- `wit-get-work-items-context-batch` – ⚠️ batch enrichment with relationship data (LIMIT: 20-30 items per call to avoid context overflow)
  - **Has relationship support**: Use `includeRelations: true` and `includeChildrenOutsideSet: true` to get child relationships
- `wit-get-work-item-context-package` – ⚠️ deep dive for individual items with full hierarchy (use sparingly, returns large payload)
  - **Best for single-item hierarchy**: Use `IncludeChildren: true` and `MaxChildDepth` to get full child tree
- (Create/assign tools available but not used for analysis): `wit-create-new-item`, `wit-assign-to-copilot`, `wit-new-copilot-item`, `wit-extract-security-links`

---

### Hierarchical Analysis Process

**The goal is to analyze work items in their natural hierarchy, starting from Key Results and walking down through each level sequentially.** This provides context about how issues cascade through parent-child relationships and helps identify systemic problems at branch level.

#### Step 1: Find All Key Results

Start by identifying all Key Results (top-level strategic items) in the specified area path:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] = 'Key Result' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.Title] ASC",
  includeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo", "System.WorkItemType", "System.Description", "Microsoft.VSTS.Common.Priority"],
  includeSubstantiveChange: true,
  substantiveChangeHistoryCount: 50,
  maxResults: 200
}
```

#### Step 2: For Each Key Result, Get Its Complete Hierarchy

**Recommended Approach - Query Direct Children and Traverse:**

For each Key Result found, query its direct children and recursively fetch their children to build the complete tree:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = {KeyResultId} AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  includeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo", "System.WorkItemType", "System.Parent", "Microsoft.VSTS.Common.Priority"],
  includeSubstantiveChange: true,
  substantiveChangeHistoryCount: 50,
  maxResults: 100
}
```

Then for each child found, repeat the query with `[System.Parent] = {ChildId}` to get grandchildren, and so on. This gives you control over the traversal and allows you to sort and filter at each level.

**Alternative - Use Context Package for Single Key Result:**

If analyzing a single Key Result and you want the full tree in one call, use `wit-get-work-item-context-package`:

```
Tool: wit-get-work-item-context-package
Arguments: {
  workItemId: {KeyResultId},
  IncludeChildren: true,
  MaxChildDepth: 3,  # Adjust based on hierarchy depth (Key Result -> Epic -> Feature -> Story)
  includeRelations: true,
  IncludeHistory: false  # Skip to reduce payload size
}
```

**Alternative - Use Batch Context for Multiple Items:**

If you already have a list of work item IDs (e.g., from a broader area query) and want to understand their relationships:

```
Tool: wit-get-work-items-context-batch
Arguments: {
  workItemIds: [id1, id2, id3, ...],  # Up to 30 items per call
  includeRelations: true,
  includeChildrenOutsideSet: true,  # Includes children not in the WorkItemIds list
  includeParentOutsideSet: true,    # Includes parents not in the WorkItemIds list
  MaxOutsideReferences: 50,
  ReturnFormat: "graph"  # Returns nodes and edges for relationship analysis
}
```

**Why Not WorkItemLinks Queries?**

The `wit-get-work-items-by-query-wiql` tool doesn't fully support `WorkItemLinks` queries (queries with `FROM WorkItemLinks` and `MODE (Recursive)`). These queries return a different response structure (`workItemRelations` instead of `workItems`) that the tool doesn't parse correctly, resulting in empty results. Stick with simple `FROM WorkItems WHERE [System.Parent] = ...` queries instead.

#### Step 3: Optionally Enrich with Context

If you need additional details like descriptions, acceptance criteria, or tags for specific items:

**For small batches (20-30 items)**, use `wit-get-work-items-context-batch`:

```
Tool: wit-get-work-items-context-batch
Arguments: {
  workItemIds: [id1, id2, ...],
  includeFields: ["System.Description", "Microsoft.VSTS.Common.AcceptanceCriteria", "System.Tags"],
  includeRelations: true,
  includeChildrenOutsideSet: true  # Also gets children relationships
}
```

**For single work items with full context**, use `wit-get-work-item-context-package`:

```
Tool: wit-get-work-item-context-package
Arguments: {
  workItemId: {id},
  IncludeChildren: true,
  IncludeParent: true,
  IncludeComments: true,
  IncludeHistory: false  # Skip to reduce payload
}
```

#### Step 4: Build Hierarchical Tree and Analyze

For each Key Result:
1. **Build the tree structure** using parent-child relationships from the WIQL response
2. **Walk the tree depth-first** (Key Result → Epics → Features → Stories → Tasks)
3. **Analyze each item** using health indicators (see below) and note the `daysInactive` value
4. **Track cascading issues** – does a parent's problems cascade to children? Are all children of a parent problematic?

#### Step 5: Generate Hierarchical Report

Present findings organized by Key Result hierarchy (see Report Output Format below).

---

### Hierarchical Quality Queries

If you want to identify specific patterns within a hierarchy branch, you can run targeted queries. **Always include `includeSubstantiveChange: true`** to get activity data.

#### Find Key Results with No Active Children

**Recommended Approach:** Query all Key Results, then check each one for children using the direct parent query:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] = 'Key Result' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.CreatedDate] ASC",
  includeFields: ["System.Title", "System.State", "System.CreatedDate"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```

Then for each Key Result, check if it has children:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = {KeyResultId} AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')",
  includeFields: ["System.Id"],
  maxResults: 1
}
```

If count = 0, the Key Result has no active children.

#### Find Orphaned Work Items (No Parent Link)

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.WorkItemType] IN ('Epic', 'Feature', 'User Story', 'Product Backlog Item', 'Task') AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND [System.Parent] = '' ORDER BY [System.WorkItemType], [System.CreatedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.WorkItemType", "System.CreatedDate"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```

#### Missing Descriptions (Within Hierarchy Context)

**IMPORTANT: System.Description is a long-text field and cannot be queried with equality operators in WIQL.**

Instead, query by area path to get all items first, then check descriptions using `wit-get-work-items-context-batch`:

```
Step 1: Get all work items in the hierarchy
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER '{{area_path}}' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.CreatedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  includeSubstantiveChange: true,
  maxResults: 200
}

Step 2: Use wit-get-work-items-context-batch (max 20-30 items per call) to retrieve descriptions
Step 3: Filter results client-side for empty or missing descriptions
Step 4: Filter to only include items whose [System.Parent] chains back to the Key Result you're analyzing
```

### Backlog Health Indicators

Assess work items across multiple dimensions to understand backlog health. Consider these indicators when categorizing items, and **pay special attention to patterns that appear throughout an entire hierarchy branch**:

#### Quality & Clarity Issues
- **Missing or inadequate descriptions** – Work items without clear context or explanation
- **Missing acceptance criteria** – User Stories/PBIs lacking success criteria
- **Vague or placeholder titles** – Titles containing TBD, TODO, test, placeholder, or < ~15 chars meaningful content
- **Missing ownership** – Unassigned items in active states
- **Missing priority/effort** – Items lacking estimation or priority fields
- **Orphaned items** – Work items with no parent linkage (except Key Results)
- **Empty branches** – Parent items with no active children

#### Activity & Engagement Signals
- **Extended inactivity** – `daysInactive` field (from WIQL with `includeSubstantiveChange: true`) exceeding thresholds (e.g., > `max_age_days`)
- **Stalled in initial state** – Remains in New/Proposed/To Do for extended periods (> 50% of `max_age_days`) without progression
- **Limited ownership engagement** – Assigned but showing no substantive activity
- **Cascading inactivity** – Parent and all children showing extended inactivity (suggests abandoned initiative)

#### Organizational Health
- **Potential duplicates** – Similar titles or descriptions that may indicate redundant work
- **Aging items in early states** – Old items still in initial workflow stages
- **Possible scope drift** – Items with outdated area paths or deprecated tags
- **Broken hierarchy** – Inconsistent relationships or missing intermediate levels (e.g., Feature with Tasks but no Stories)

### Health Categories

Classify each work item into one of these categories based on the indicators above:

1. **Healthy** – Well-defined, actively maintained, clear ownership and direction
2. **Needs Enhancement** – Valid work item but could benefit from improved descriptions, acceptance criteria, or clarity
3. **Requires Attention** – Shows concerning signals (extended inactivity, missing critical information, unclear purpose)
4. **Consider for Review** – Multiple indicators suggest this may need team discussion (potential duplicate, out of scope, or abandonment candidate)

**Hierarchy-Level Categories** (apply to parent items with children):
- **Healthy Branch** – Parent and majority of children are healthy
- **Branch Needs Enhancement** – Parent is healthy but several children need work
- **Branch Requires Attention** – Parent or majority of children show concerning signals
- **Branch for Review** – Entire branch may be abandoned, out of scope, or duplicated

**Note**: The goal is improvement, not removal. Even items in "Consider for Review" should be evaluated collaboratively with the team.

### Hierarchical Report Output Format

Present your findings in a **clean, scannable format** using tables and structured sections. Prioritize readability over exhaustive detail.

---

## 📊 Executive Summary

| Metric | Value |
|--------|-------|
| **Key Results Analyzed** | X |
| **Total Active Work Items** | Y (X Key Results, Y Epics, Z Features, A Stories, B Tasks) |
| **Overall Health** | X% Healthy, Y% Need Enhancement, Z% Require Attention, W% Need Review |
| **Orphaned Items** | X items with no parent link |
| **Critical Issues** | X high-priority items requiring immediate attention |

### 🎯 Top 3 Priorities
1. **[Brief description]** - Affects X items across Y branches
2. **[Brief description]** - Affects X items across Y branches
3. **[Brief description]** - Affects X items across Y branches

---

## 🌳 Hierarchy Analysis by Key Result

For each Key Result, present findings in a **compact, table-based format**:

### Key Result [12345](link): Brief Title ⚠️ Status Icon
> **Branch Health**: Healthy Branch | Needs Enhancement | Requires Attention | For Review  
> **Activity**: Last change X days ago | **Children**: Y total (Z healthy, W need work)

#### 📋 Issues at This Level
- Brief bullet point summary of Key Result-level concerns (if any)
- Use **bold** for critical issues
- Keep to 1-3 most important items

#### 📂 Direct Children Summary

| ID | Type | Title | Status | Days Inactive | Issues |
|----|------|-------|--------|---------------|--------|
| [123](link) | Epic | Brief Title | 🟢 Healthy | 5 | None |
| [124](link) | Epic | Brief Title | 🟡 Needs Work | 45 | Missing description |
| [125](link) | Feature | Brief Title | 🔴 Attention | 120 | No children, stale |

**Status Legend**: 🟢 Healthy | 🟡 Needs Enhancement | 🟠 Requires Attention | 🔴 For Review

#### 🔍 Items Requiring Attention (Priority Order)

Only list items with issues - skip healthy items to reduce noise.

**1. [ID](link) - Title** (Type | State | X days inactive)
- **Issue**: Brief description of primary concern
- **Action**: Specific, actionable recommendation

**2. [ID](link) - Title** (Type | State | X days inactive)
- **Issue**: Brief description of primary concern
- **Action**: Specific, actionable recommendation

*(Continue for items needing attention only)*

#### ✅ Branch Recommendations
1. **[Action]** - Brief justification (affects X items)
2. **[Action]** - Brief justification
3. **[Action]** - Brief justification

---

*(Repeat above format for each Key Result)*

---

## 🚨 Critical Issues Across All Branches

### Orphaned Items (No Parent Link)

| ID | Type | Title | State | Days Inactive | Suggested Action |
|----|------|-------|-------|---------------|------------------|
| [123](link) | Feature | Title | Active | 30 | Link to Key Result ABC |
| [124](link) | Story | Title | New | 60 | Archive or link to parent |

---

### Cross-Branch Patterns

| Pattern | Count | Affected Branches | Recommended Action |
|---------|-------|-------------------|-------------------|
| Missing descriptions | X items | KR-A, KR-B, KR-C | Create description template |
| Stale (>{{max_age_days}} days) | X items | KR-B (entire branch) | Team review meeting |
| No acceptance criteria | X stories | KR-A, KR-D | Add AC to stories |
| Unassigned items | X items | All branches | Assignment review |

---

## 📈 Health Breakdown by Work Item Type

| Type | Total | 🟢 Healthy | 🟡 Needs Enhancement | 🟠 Requires Attention | 🔴 For Review |
|------|-------|-----------|---------------------|----------------------|---------------|
| Key Result | X | X% | X% | X% | X% |
| Epic | X | X% | X% | X% | X% |
| Feature | X | X% | X% | X% | X% |
| Story | X | X% | X% | X% | X% |
| Task | X | X% | X% | X% | X% |

---

## 🎯 Recommended Next Steps

**Immediate Actions (Next Sprint)**
1. **[Specific action]** - Brief justification
2. **[Specific action]** - Brief justification
3. **[Specific action]** - Brief justification

**Longer Term Improvements**
1. **[Strategic improvement]** - Brief justification
2. **[Process change]** - Brief justification

---

**Formatting Guidelines**:
- **Use tables** for lists of work items - far more readable than nested text
- **Use status icons** (🟢🟡🟠🔴) for quick visual scanning
- **Skip healthy items** in detailed sections - only show what needs attention
- **Keep descriptions brief** - 1-2 sentences max per item
- **Link all work item IDs** as `[ID]({{org_url}}/{{project}}/_workitems/edit/{ID})`
- **Prioritize by severity** - critical issues first
- **Group similar issues** - don't repeat the same problem X times
- **Use hierarchy only where needed** - tables are clearer than deep trees
- **Be concise** - teams need actionable insights, not exhaustive catalogs

**Tone**: Constructive and focused on continuous improvement. Frame findings as opportunities to strengthen the backlog rather than criticisms. Emphasize how hierarchical organization helps teams see patterns and take coordinated action.
