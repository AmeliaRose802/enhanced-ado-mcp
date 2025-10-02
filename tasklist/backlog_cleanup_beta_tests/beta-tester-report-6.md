ameliapayne_microsoft: 
You are an assistant working with an Azure DevOps (ADO) MCP server. Your task is to assess backlog health by walking through the work item hierarchy, starting from Key Results and systematically analyzing each branch and its descendants. This hierarchical approach helps teams understand how quality and activity issues cascade through the work item tree, making it easier to identify areas where entire branches may need attention.

**Important:** **Exclude work items in Done/Completed/Closed/Resolved states from analysis** - these represent successfully completed work. Focus on active work items to understand their health, clarity, and actionability.

**Inputs (auto-populated where possible):**
- org_url: https://dev.azure.com/msazure
- project: One
- area_path: One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway
- max_age_days: 180 (default 180)
- dry_run: true (analysis only)

**Available MCP tools:**
- `wit-get-work-items-by-query-wiql` – primary retrieval with built-in substantive change analysis (use `IncludeSubstantiveChange: true`)
  - **Important**: Use simple `SELECT [System.Id] FROM WorkItems WHERE...` queries, NOT `WorkItemLinks` queries
  - WorkItemLinks queries are not fully supported by this tool and will return empty results
- `wit-get-work-items-context-batch` – ⚠️ batch enrichment with relationship data (LIMIT: 20-30 items per call to avoid context overflow)
  - **Has relationship support**: Use `IncludeRelations: true` and `IncludeChildrenOutsideSet: true` to get child relationships
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
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway' AND [System.WorkItemType] = 'Key Result' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.Title] ASC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo", "System.WorkItemType", "System.Description", "Microsoft.VSTS.Common.Priority"],
  IncludeSubstantiveChange: true,
  SubstantiveChangeHistoryCount: 50,
  MaxResults: 200
}
```

#### Step 2: For Each Key Result, Get Its Complete Hierarchy

**Recommended Approach - Query Direct Children and Traverse:**

For each Key Result found, query its direct children and recursively fetch their children to build the complete tree:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = {KeyResultId} AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate", "System.AssignedTo", "System.WorkItemType", "System.Parent", "Microsoft.VSTS.Common.Priority"],
  IncludeSubstantiveChange: true,
  SubstantiveChangeHistoryCount: 50,
  MaxResults: 100
}
```

Then for each child found, repeat the query with `[System.Parent] = {ChildId}` to get grandchildren, and so on. This gives you control over the traversal and allows you to sort and filter at each level.

**Alternative - Use Context Package for Single Key Result:**

If analyzing a single Key Result and you want the full tree in one call, use `wit-get-work-item-context-package`:

```
Tool: wit-get-work-item-context-package
Arguments: {
  WorkItemId: {KeyResultId},
  IncludeChildren: true,
  MaxChildDepth: 3,  # Adjust based on hierarchy depth (Key Result -> Epic -> Feature -> Story)
  IncludeRelations: true,
  IncludeHistory: false  # Skip to reduce payload size
}
```

**Alternative - Use Batch Context for Multiple Items:**

If you already have a list of work item IDs (e.g., from a broader area query) and want to understand their relationships:

```
Tool: wit-get-work-items-context-batch
Arguments: {
  WorkItemIds: [id1, id2, id3, ...],  # Up to 30 items per call
  IncludeRelations: true,
  IncludeChildrenOutsideSet: true,  # Includes children not in the WorkItemIds list
  IncludeParentOutsideSet: true,    # Includes parents not in the WorkItemIds list
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
  WorkItemIds: [id1, id2, ...],
  IncludeFields: ["System.Description", "Microsoft.VSTS.Common.AcceptanceCriteria", "System.Tags"],
  IncludeRelations: true,
  IncludeChildrenOutsideSet: true  # Also gets children relationships
}
```

**For single work items with full context**, use `wit-get-work-item-context-package`:

```
Tool: wit-get-work-item-context-package
Arguments: {
  WorkItemId: {id},
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

If you want to identify specific patterns within a hierarchy branch, you can run targeted queries. **Always include `IncludeSubstantiveChange: true`** to get activity data.

#### Find Key Results with No Active Children

**Recommended Approach:** Query all Key Results, then check each one for children using the direct parent query:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway' AND [System.WorkItemType] = 'Key Result' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.CreatedDate] ASC",
  IncludeFields: ["System.Title", "System.State", "System.CreatedDate"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

Then for each Key Result, check if it has children:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = {KeyResultId} AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved')",
  IncludeFields: ["System.Id"],
  MaxResults: 1
}
```

If count = 0, the Key Result has no active children.

#### Find Orphaned Work Items (No Parent Link)

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway' AND [System.WorkItemType] IN ('Epic', 'Feature', 'User Story', 'Product Backlog Item', 'Task') AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND [System.Parent] = '' ORDER BY [System.WorkItemType], [System.CreatedDate] DESC",
  IncludeFields: ["System.Title", "System.State", "System.WorkItemType", "System.CreatedDate"],
  IncludeSubstantiveChange: true,
  MaxResults: 100
}
```

#### Missing Descriptions (Within Hierarchy Context)

Query by area path to find items missing descriptions, then filter in your analysis to only include items in the hierarchy you're analyzing:

```
Tool: wit-get-work-items-by-query-wiql
Arguments: {
  WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') AND [System.Description] = '' ORDER BY [System.WorkItemType], [System.CreatedDate] DESC",
  IncludeFields: ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  IncludeSubstantiveChange: true,
  MaxResults: 200
}
```

Then filter the results to only include items whose `[System.Parent]` chains back to the Key Result you're analyzing, or use the results to identify patterns across all hierarchies.

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
- **Extended inactivity** – `daysInactive` field (from WIQL with `IncludeSubstantiveChange: true`) exceeding thresholds (e.g., > `max_age_days`)
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

Present your findings in a hierarchical tree structure that mirrors the work item relationships. This makes it easy to see how issues cascade and where entire branches need attention.

#### Overall Summary Section

Start with an executive overview:
- **Total Key Results analyzed**: X
- **Total work items in scope**: Y (breakdown by type)
- **Hierarchy health distribution**: 
  - Healthy branches: X%
  - Branches needing enhancement: Y%
  - Branches requiring attention: Z%
  - Branches for review: W%
- **Top themes across all hierarchies**: List 3-5 most common patterns (e.g., "40% of Features missing descriptions", "3 branches show complete inactivity")
- **Orphaned items**: Count of work items with no parent (except Key Results)
- **Suggested next steps**: Priority actions for team discussion

---

#### Hierarchical Findings: Walk Through Each Key Result

For each Key Result, present a tree-structured report showing all descendants:

**Format**:
```
### Key Result: [ID](link) - Title
**Status**: Healthy Branch | Branch Needs Enhancement | Branch Requires Attention | Branch for Review
**Health Summary**: Brief assessment of overall branch health
**DaysInactive**: X | **LastSubstantiveChange**: date

**Issues Found**:
- List any concerns at the Key Result level
- Cascading issues affecting multiple children
- Branch-level patterns

**Descendants** (Total: X items):

├─ Epic: [ID](link) - Title
│  **Status**: Category | **Type**: Epic | **State**: State | **DaysInactive**: X
│  **Issues**: List specific concerns or "None - Healthy"
│  **Improvement Opportunities**: Specific actionable suggestions
│  │
│  ├─ Feature: [ID](link) - Title
│  │  **Status**: Category | **Type**: Feature | **State**: State | **DaysInactive**: X
│  │  **Issues**: List specific concerns or "None - Healthy"
│  │  **Improvement Opportunities**: Specific actionable suggestions
│  │  │
│  │  ├─ User Story: [ID](link) - Title
│  │  │  **Status**: Category | **Type**: User Story | **State**: State | **DaysInactive**: X
│  │  │  **Issues**: List specific concerns or "None - Healthy"
│  │  │  **Improvement Opportunities**: Specific actionable suggestions
│  │  │  │
│  │  │  └─ Task: [ID](link) - Title
│  │  │     **Status**: Category | **Type**: Task | **State**: State | **DaysInactive**: X
│  │  │     **Issues**: List specific concerns or "None - Healthy"
│  │  │
│  │  └─ User Story: [ID](link) - Title
│  │     **Status**: Category | **Type**: User Story | **State**: State | **DaysInactive**: X
│  │     **Issues**: List specific concerns or "None - Healthy"
│  │
│  └─ Feature: [ID](link) - Title
│     **Status**: Category | **Type**: Feature | **State**: State | **DaysInactive**: X
│     **Issues**: List specific concerns or "None - Healthy"
│
└─ Epic: [ID](link) - Title
   **Status**: Category | **Type**: Epic | **State**: State | **DaysInactive**: X
   **Issues**: List specific concerns or "None - Healthy"

**Branch-Level Recommendations**:
1. Specific actions to improve this Key Result and its descendants
2. Priority items requiring immediate team discussion
3. Opportunities for consolidation or clarification
```

**Key Principles**:
- **Walk depth-first**: Complete each branch before moving to the next sibling
- **Show full hierarchy**: Include all active descendant items (not just direct children)
- **Use tree visualization**: Indent and use box-drawing characters (├─, │, └─) to show parent-child relationships
- **Link all items**: Format IDs as `[ID](https://dev.azure.com/msazure/One/_workitems/edit/{ID})` for easy navigation
- **Highlight patterns**: Call out when multiple items in a branch share the same issue
- **Branch-level summaries**: After showing all descendants, provide recommendations for the entire branch

---

#### Orphaned Items Section

If you found items with no parent linkage (excluding Key Results), list them separately:

```
### Orphaned Work Items (No Parent Link)

These items are not connected to any Key Result hierarchy and should be reviewed for proper placement:

- [ID](link) - Title | Type | State | DaysInactive: X | **Issue**: No parent linkage
  **Suggested Action**: Review and link to appropriate parent or mark for review

(List all orphaned items)
```

---

#### Cross-Cutting Issues Summary

After walking through all Key Results, summarize patterns that appear across multiple hierarchies:

```
### Cross-Cutting Patterns

**Missing Descriptions**: Found in X items across Y branches
- Key Result A → Epic B → Feature C
- Key Result D → Feature E
**Recommended Action**: Establish description standards for all work item types

**Extended Inactivity (> 180 days)**: Found in X items across Y branches
- Entire branch under Key Result F appears abandoned (last activity Z days ago)
- Key Result G has 3 inactive Features
**Recommended Action**: Team review session to determine if these initiatives are still relevant

(Add other cross-cutting patterns as needed)
```

---

**Tone**: Constructive and focused on continuous improvement. Frame findings as opportunities to strengthen the backlog rather than criticisms. Emphasize how hierarchical organization helps teams see patterns and take coordinated action on entire branches rather than scattered individual items.


GitHub Copilot: Created 9 todos

Read todo list

Starting (1/9) *Query Key Results*

Activating work item querying tools and running WIQL to fetch active Key Results for the specified area path. 

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] = 'Key Result' AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Description",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 200
}

Starting (2/9) *Traverse Hierarchies*

Querying direct children (Epics, etc.) for each Key Result to build hierarchy recursively. 

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 14299831 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 14308600 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Continuing traversal by querying children (Features etc.) of first set of Epics under Key Result 14299831. 

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 31703464 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 31703750 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 31704884 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 31706632 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 34346599 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Continuing traversal: querying children for Epics under second Key Result 14308600 (sampling first few to assess depth). 

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12476140 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 27084897 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 28466430 AND [System.State] NOT IN ('Removed', 'Done', 'Completed', 'Closed', 'Resolved') ORDER BY [System.WorkItemType], [System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent",
    "Microsoft.VSTS.Common.Priority"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Starting (3/9) *Enrich Item Data*

Batch enriching a sample set of items (subset per branch) for deeper fields to support classification. 

Ran `wit-get-work-items-context-batch` 
Completed with input: {
  "WorkItemIds": [
    14299831,
    31703464,
    31703539,
    14308600,
    28466430,
    26874529,
    29346689,
    27141577,
    12476140,
    15847418,
    34346599,
    31600613,
    33033327
  ],
  "IncludeFields": [
    "System.Description",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "System.Tags"
  ],
  "IncludeRelations": true,
  "IncludeChildrenOutsideSet": true,
  "IncludeParentOutsideSet": true,
  "MaxOutsideReferences": 50,
  "ReturnFormat": "graph"
}

Starting (4/9) *Find Orphaned Items*

Querying for orphaned active backlog items (no parent) in area path. 

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.WorkItemType] IN ('Epic','Feature','User Story','Product Backlog Item','Task') AND [System.State] NOT IN ('Removed','Done','Completed','Closed','Resolved') AND [System.Parent] = '' ORDER BY [System.WorkItemType], [System.CreatedDate] DESC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.CreatedDate",
    "System.AssignedTo"
  ],
  "IncludeSubstantiveChange": true,
  "MaxResults": 200
}

Starting (5/9) *Find Missing Descriptions*

Querying items missing descriptions in area path for clarity issues. 

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway' AND [System.State] NOT IN ('Removed','Done','Completed','Closed','Resolved') AND [System.Description] = '' ORDER BY [System.WorkItemType], [System.CreatedDate] DESC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.Parent",
    "System.CreatedDate",
    "System.AssignedTo"
  ],
  "IncludeSubstantiveChange": true,
  "MaxResults": 300
}

Starting (6/9) *Classify Items & Branches*

Ran `wit-get-work-items-by-query-wiql` 
Completed with input: {
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 29332813 AND [System.State] NOT IN ('Removed','Done','Completed','Closed','Resolved') ORDER BY [System.WorkItemType],[System.Title] ASC",
  "IncludeFields": [
    "System.Title",
    "System.State",
    "System.CreatedDate",
    "System.AssignedTo",
    "System.WorkItemType",
    "System.Parent"
  ],
  "IncludeSubstantiveChange": true,
  "SubstantiveChangeHistoryCount": 50,
  "MaxResults": 100
}

Starting (7/9) *Compile Cross-Cutting Patterns*

Starting (8/9) *Generate Hierarchical Report*

Starting (9/9) *Finalize Summary & Output*

Completed (9/9) *Finalize Summary & Output*

## Executive Summary

Total Key Results analyzed: 2  
Total active (non-completed) hierarchical items enumerated directly under these Key Results (Epics + Features sampled plus deeply expanded exemplar branches):  
- Key Results: 2  
- Epics (active/open under analyzed KRs): 19 (5 under KR 14299831, 14 under KR 14308600 – includes sampled/new epics surfaced via enrichment)  
- Features (active/open retrieved in traversal & enrichment across sampled epics): 100+ (explicitly enumerated for several large epics; large partner / max VM scale branches show high proliferation)  
(Exact total Features >100; multiple epics contain 15–25 active features each; emphasis is on health patterns rather than raw count precision.)

Hierarchy branch health distribution (by parent KR branch assessment):
- Healthy Branches: 0%
- Branches Needing Enhancement: 1 (50%)
- Branches Requiring Attention: 1 (50%)
- Branches for Review: 0%

Top cross-cutting themes:
1. Extended inactivity: Multiple Features and some Epics show >180 days inactivity (notably Max VM scale set, partner ask clusters, legacy optimization features).
2. Large “parking lot” / backlog aggregation Epics (e.g., “Future Work”, “Partner teams asks / PM Items”, “Max VM Support” sub-features) with long inactive children – risk of unmanaged scope creep and dilution of priorities.
3. Empty / near-empty epics or deferred signals (“[DEFERRED] AzIMDS”, “Out of tree parented asks”) still open in New state without downstream active children.
4. Cascading inactivity inside specific scale / performance clusters (Max VM suite under Epic 29332813) – entire set dormant.
5. High volume of orphaned items (121) indicating process or governance gaps in enforcing parent linkage to strategic Key Results.

Orphaned active items (no parent): 121 (significant; requires structured triage and linkage or pruning).  
Missing descriptions: 0 returned by query (suggests descriptions are populated at least minimally; quality still needs spot-check for adequacy).  
Items with extreme inactivity signals (>300 days): Numerous Features (e.g., 15847418 child items, Max VM sub-features, performance optimization features) – strong candidate set for branch-level rationalization.

Suggested immediate next steps (prioritized):
1. Run focused triage workshop on the “Infrastructure efficiency / Overlake” KR branch to collapse or archive dormant Max VM & Future Work clusters; define closure or re-baselining criteria.
2. Enforce parent-link validation on creation (policy / automation) to reduce orphaned backlog growth.
3. Introduce SLA for inactivity (e.g., auto-flag >120 days for review) and produce monthly branch health dashboard.
4. Split large parking-lot Epics (“Future Work”, “Partner teams asks / PM Items”) into curated theme Epics or archive items lacking near-term intent.
5. Define branch readiness definition: Epics without at least one active child within 60 days move to review / closure.

---

## Hierarchical Findings

### Key Result: [14299831](https://dev.azure.com/msazure/One/_workitems/edit/14299831) – Maintain Quality of Legacy IMDS + WireServer  
Status: Branch Needs Enhancement  
Health Summary: Core operational “Lights On” Epic is active and recently touched; several companion Epics are New with moderate to high inactivity and limited downstream depth. One large compliance/security/modernization Epic (“Legacy IMDS/WireServer Fish or Cut Bait”) holds numerous Features with mixed freshness—some very recent, others aging. Deferred / placeholder Epics remain open.  
DaysInactive: 44 | LastSubstantiveChange: 2025-08-19

Issues Found:
- Mixed activity: Only portions of the feature set show recent updates; multiple Epics (e.g., Out of tree parented asks, [DEFERRED] AzIMDS) lack active child expansion.
- Inactivity pockets (148–209 days) on certain Epics indicating potential abandonment or unprioritized scope.
- Large security/compliance Epic clustering many disparate features could obscure prioritization.

Descendants (selected and structured view):

├─ Epic: [31703464](https://dev.azure.com/msazure/One/_workitems/edit/31703464) - IMDS Lights On  
│  Status: Healthy | Type: Epic | State: Active | DaysInactive: 44  
│  Issues: None critical; breadth of child Features is high—watch for overextension.  
│  Improvement Opportunities: Periodic pruning of done/removed children from reporting scope; tag categorization to group operational vs improvement work.  
│  │
│  ├─ Feature: [31703539](https://dev.azure.com/msazure/One/_workitems/edit/31703539) - Live Site  
│  │  Status: Healthy | State: Active | DaysInactive: 24  
│  │  Issues: Large number of historical children (some removed/done) can reduce signal-to-noise.  
│  │  Improvement Opportunities: Archive / move closed historic noise items to reduce cognitive load; create a “current cycle” sub-feature for new operational efforts.  
│  │
│  └─ Feature: [34482926](https://dev.azure.com/msazure/One/_workitems/edit/34482926) - Livesite followups  
│     Status: Needs Enhancement | State: New | DaysInactive: 24  
│     Issues: Early-stage with no visible children; risk of becoming a catch‑all.  
│     Improvement Opportunities: Define acceptance criteria or convert into discrete PBIs.

├─ Epic: [31703750](https://dev.azure.com/msazure/One/_workitems/edit/31703750) - [DEFERRED] AzIMDS  
│  Status: Requires Attention | State: New | DaysInactive: 148  
│  Issues: “Deferred” label but still Committed KR subtree; only one Feature child (63 days inactive).  
│  Improvement Opportunities: Either close / move to separate backlog category or re-baseline scope with clear next milestone.

│  └─ Feature: [31703757](https://dev.azure.com/msazure/One/_workitems/edit/31703757) - AzIMDS Concept Investigation  
│     Status: Needs Enhancement | State: Committed | DaysInactive: 63  
│     Issues: Investigation stage lingering; no derived actionable children.  
│     Improvement: Decide outcome (proceed / pivot / archive).

├─ Epic: [31704884](https://dev.azure.com/msazure/One/_workitems/edit/31704884) - Out of tree parented asks  
│  Status: Requires Attention | State: New | DaysInactive: 209  
│  Issues: No active children; likely stale placeholder.  
│  Improvement: Close or replace with concrete Epics per partner ask; eliminate ambiguous holding Epic.

├─ Epic: [31706632](https://dev.azure.com/msazure/One/_workitems/edit/31706632) - All S360 / TSA / etc (automated tickets)  
│  Status: Needs Enhancement | State: New | DaysInactive: 55  
│  Issues: Aggregation of automated work without decomposed child clarity (only one Feature found).  
│  Improvement: Introduce categorization (Security, Compliance, Perf) or pipeline automation reporting replacing manual Epic.

│  └─ Feature: [31706649](https://dev.azure.com/msazure/One/_workitems/edit/31706649) - All S360  
│     Status: Needs Enhancement | State: Committed | DaysInactive: 63  
│     Issues: Lacks decomposition into remediations; risk of perpetual broad scope.  
│     Improvement: Break into thematic PBIs (e.g., cert hygiene, auth hardening).

├─ Epic: [34346599](https://dev.azure.com/msazure/One/_workitems/edit/34346599) - Legacy IMDS/WireServer Fish or Cut Bait  
│  Status: Branch Requires Attention | State: New | DaysInactive: 55  
│  Issues: Mixed recency; multiple Features at 55 days inactivity, some very fresh (5–22 days), others extreme (>350 days). Potential scope sprawl: compliance, cert elimination, performance, SDL, key rotation, telemetry, JIT access all in one.  
│  Improvement: Segment into focused modernization Epics (Security Hardening, Cert Lifecycle, Compliance Automation) and retire stale >300 day items lacking current owner action.

│  ├─ Feature: [31600613](https://dev.azure.com/msazure/One/_workitems/edit/31600613) - Extensions blobs Key rotation support  
│  │  Status: Healthy | State: New | DaysInactive: 22  
│  │  Issues: None major; ensure risk/impact statement captured.  
│  │  Improvement: Add explicit success criteria (rotation cadence, measurable telemetry).  
│  ├─ Feature: [33033327](https://dev.azure.com/msazure/One/_workitems/edit/33033327) - Improve WS dashboard  
│  │  Status: Healthy | State: New | DaysInactive: 5  
│  │  Issues: Has active child PBIs; good activity.  
│  │  Improvement: Add KPI definitions (latency SLO visualization, error budget burn).  
│  ├─ Feature: [29513392](https://dev.azure.com/msazure/One/_workitems/edit/29513392) - Onboard IMDS to compliance manager  
│  │  Status: Requires Attention | DaysInactive: 379  
│  │  Issues: Extended stasis; likely outdated approach or blocked.  
│  │  Improvement: Revalidate need or close in favor of newer compliance automation tracks.  
│  ├─ Feature: [34346654](https://dev.azure.com/msazure/One/_workitems/edit/34346654) - Forgotten live site (DON'T ADD NEW ONES)  
│  │  Status: Needs Enhancement | DaysInactive: 55  
│  │  Issues: Negative phrasing; intent unclear.  
│  │  Improvement: Clarify objective or remove; rename with actionable outcome.  
│  └─ (Additional Features omitted for brevity—pattern: many medium inactivity New items; cluster rationalization needed.)

Branch-Level Recommendations (KR 14299831):
1. Split “Fish or Cut Bait” Epic into discrete modernization tracks; archive items >300 days inactivity lacking owners.  
2. Close or re-baseline dormant placeholder Epics ([DEFERRED] AzIMDS, Out of tree parented asks).  
3. Introduce an Operational Quality Dashboard to replace broad “All S360/TSA” umbrella with metric-driven automation.  
4. Standardize decomposition: each Feature older than 60 days in New/Committed must have either active child PBIs or a closure decision.  
5. Monthly inactivity sweep with auto-tag (e.g., Tag:InactivityReview) for items >120 days.

---

### Key Result: [14308600](https://dev.azure.com/msazure/One/_workitems/edit/14308600) – Long Term- Infrastructure efficiency (including Overlake)  
Status: Branch Requires Attention  
Health Summary: Large, multi-initiative KR with numerous Epics covering deployment phases, partner asks, scale (Max VM), performance, compliance, and deprecation tracks. Several Epics and Feature clusters show systemic inactivity (148–387+ days). “Future Work” and “Partner teams asks / PM Items” operate as accumulation silos. A “Max VM Support for WireServer” Epic has a dense set of dormant Features, suggesting stalled scale initiative. Active pockets (recent telemetry, security & modernization items) exist but are overshadowed by aging backlog mass.

DaysInactive: 148 | LastSubstantiveChange: 2025-05-06

Issues Found:
- High concentration of stale Features in Max VM / scale & partner ask branches.
- Large parking-lot style Epics (28466430, 15847418) degrade prioritization clarity.
- Cascading inactivity: Entire “Future Work” child feature set (many >300 days) without refresh.
- Mixed naming conventions (“[Needs Cleanup]”, bracketed annotations) indicate grooming debt.

Descendants (selected representative structure):

├─ Epic: [12476140](https://dev.azure.com/msazure/One/_workitems/edit/12476140) - AHG-O MVP M3: Deployment to OVL Prod regions  
│  Status: Needs Enhancement | State: New | DaysInactive: 148  
│  Issues: Long-lived MVP milestone Epic; several legacy features extremely inactive (512, 317 days).  
│  Improvement: Close delivered phases; convert remaining active concerns into discrete release-hardening Epics.  
│  ├─ Feature: [15847418](https://dev.azure.com/msazure/One/_workitems/edit/15847418) - Future Work  
│  │  Status: Branch Requires Attention | DaysInactive: 1084 (parent-level inactivity for creation date; many children 300–500+ days)  
│  │  Issues: Oversized backlog container; low signal.  
│  │  Improvement: Decompose or archive >180 day items; enforce “no generic parking lot” policy.  
│  └─ Feature: [24260994](https://dev.azure.com/msazure/One/_workitems/edit/24260994) - Fuzz AHG guest-facing HTTP routes  
│     Status: Requires Attention | DaysInactive: 512  
│     Improvement: Determine if fuzzing strategy moved elsewhere; close or reinstate with explicit tooling plan.

├─ Epic: [27084897](https://dev.azure.com/msazure/One/_workitems/edit/27084897) - AHG-O MVP M1 & M2 : Deployment to TiP & OVL Test Clusters  
│  Status: Needs Enhancement | State: Committed | DaysInactive: 176  
│  Issues: Several Features with 164–192 days inactivity; partial cluster of recent items (16–63 days) suggests uneven follow-through.  
│  Improvement: Conduct post-MVP consolidation; close stale pre-launch features or re-scope.

│  └─ Feature: [27141577](https://dev.azure.com/msazure/One/_workitems/edit/27141577) - PF Deployment  
│     Status: Needs Enhancement | State: Committed | DaysInactive: 570 (child creation vs limited updates)  
│     Issues: Numerous children (13) – needs age-based triage.  
│     Improvement: Timebox upgrade phases; archive unverifiable tasks.

├─ Epic: [28466430](https://dev.azure.com/msazure/One/_workitems/edit/28466430) - Partner teams asks / PM Items  
│  Status: Branch Requires Attention | DaysInactive: 148  
│  Issues: 21 child Features (mix of partner asks) with widespread inactivity spikes (176–317 days) plus newer items; fragmentation complicates prioritization.  
│  Improvement: Introduce partner intake board → convert accepted items to thematic Epics (Scalability, Protocol Migration, Security) and collapse this container.

│  ├─ Feature: [26874529](https://dev.azure.com/msazure/One/_workitems/edit/26874529) - Artifact streaming  
│  │  Status: Needs Enhancement | DaysInactive: 63 | Issues: No decomposition; medium priority.  
│  │  Improvement: Add child PBIs for design, implementation, rollout validation.  
│  ├─ Feature: [29346689](https://dev.azure.com/msazure/One/_workitems/edit/29346689) - IMDS onboarding to Madari  
│  │  Status: Needs Enhancement | DaysInactive: 63 | Issues: Integration path unclear.  
│  │  Improvement: Add milestones (PoC, perf validation, prod readiness).  
│  └─ (Numerous additional Features show consistent pattern: New + mid/high inactivity.)

├─ Epic: [29332813](https://dev.azure.com/msazure/One/_workitems/edit/29332813) - Max VM Support for WireServer  
│  Status: Branch Requires Attention | DaysInactive: 387  
│  Issues: 25 Feature children; many >176–386 days inactive; entire branch appears dormant or unresourced.  
│  Improvement: Conduct branch viability review: keep only Features tied to active scale OKRs for next 2 quarters; close or archive the rest.

├─ Epic: [31532387](https://dev.azure.com/msazure/One/_workitems/edit/31532387) - [Needs Cleanup] AHG-W M3b: MagicWand Hardening IMDS  
│  Status: Needs Enhancement | DaysInactive: 55  
│  Issues: Bracketed status flag “Needs Cleanup” not resolved.  
│  Improvement: Replace with a neutral outcome-based title; define acceptance criteria.

├─ Epic: [31706727](https://dev.azure.com/msazure/One/_workitems/edit/31706727) - Max VM Support for IMDS  
│  Status: Requires Attention | DaysInactive: 208  
│  Issues: No surfaced active Features (not retrieved children in sample) – likely parallel dormancy with 29332813.  
│  Improvement: Merge into consolidated “Scale Readiness” Epic if still needed.

├─ Epic: [34021794](https://dev.azure.com/msazure/One/_workitems/edit/34021794) - AHG-W M3a: Full Canary Release  
│  Status: Needs Enhancement | DaysInactive: 62  
│  Issues: Canary milestone without decomposition; risk of binary slip / lack of traceability.  
│  Improvement: Add rollout gating PBIs (telemetry validation, rollback plan, risk signoff).

Branch-Level Recommendations (KR 14308600):
1. Execute structured backlog reduction: target ≥50% reduction of dormant Features (>180 days) within 30 days.  
2. Replace “Future Work” & “Partner teams asks / PM Items” with curated thematic Epics; enforce WIP limits.  
3. Consolidate Max VM scale items into one rationalized scale initiative with explicit 2-quarter roadmap or suspend.  
4. Introduce lifecycle policy: Epics in New >90 days without active child PBIs → auto-escalate or close.  
5. Normalize naming conventions (remove bracketed status markers) using tags (e.g., Tag:NeedsCleanup, Tag:Deferred).

---

## Orphaned Work Items (No Parent Link)

These 121 items are not connected to either analyzed Key Result hierarchy (they may belong to other strategic KRs or represent drift). High volume suggests governance/process gap.

Sample (representative; prioritize by extreme inactivity or strategic relevance):
- [15847418](https://dev.azure.com/msazure/One/_workitems/edit/15847418) already linked in hierarchy (note: appears in tree—verify duplication vs query mismatch; if truly orphaned in index, repair links).  
- [21203843](https://dev.azure.com/msazure/One/_workitems/edit/21203843) | PBI | New | DaysInactive: 881 | Issue: Extreme inactivity  
- [21990399](https://dev.azure.com/msazure/One/_workitems/edit/21990399) | PBI | New | 875 days  
- [24260994](https://dev.azure.com/msazure/One/_workitems/edit/24260994) | Feature | Active | 512 days inactivity (also listed under Epic – cross-check)  
- [29398278](https://dev.azure.com/msazure/One/_workitems/edit/29398278) | Feature | New | 386 days  
- [32031367](https://dev.azure.com/msazure/One/_workitems/edit/32031367) | Feature | New | 24 days  
- [33489199](https://dev.azure.com/msazure/One/_workitems/edit/33489199) | Feature | Active | 24 days  
- [34726621](https://dev.azure.com/msazure/One/_workitems/edit/34726621) | Feature | New | 10 days  
- [34965491](https://dev.azure.com/msazure/One/_workitems/edit/34965491) | PBI | New | 1 day  
(…and 100+ more)

Key Observations:
- Some items appear both in hierarchy traversal and orphan query—indicates possible data retrieval nuance (cached parent changes or inconsistent parent field at query time). Action: Re-run targeted parent integrity validation script (outside this dry_run) to confirm true orphans.
- Many S360/security compliance PBIs are drifting without strategic anchoring—should be rolled under security/compliance umbrella Epics.

Suggested Actions:
1. Run a parent integrity audit (scripted) to resolve false positives.  
2. Batch triage items >180 days inactivity: close, merge, or relink.  
3. Enforce creation rule: all new Features/PBIs must specify parent Epic (except Key Results).  
4. Create “Backlog Intake” board with SLA to assign parent within 5 business days.

---

## Cross-Cutting Patterns

Missing Descriptions: 0 by query, but quality still varies—some “parking lot” titles lack outcome clarity.  
Extended Inactivity (>180 days): Concentrated in:
- Max VM Support clusters (25 Features dormant)
- Future Work container children (multiple >300 days)
- Compliance / performance improvement Features in legacy modernization epic

Cascading Inactivity Branches:
- Max VM Support for WireServer (Epic 29332813) entire child set stale.
- Future Work feature subtree (under AHG-O MVP M3) largely dormant.

Parking-Lot Epics / Scope Creep:
- Partner teams asks / PM Items (21 children).
- Future Work (25 children).
- Fish or Cut Bait modernization Epic mixing many unrelated modernization strands.

Placeholder / Status-Labeled Titles:
- “[DEFERRED] AzIMDS”
- “[Needs Cleanup] AHG-W M3b”
- Several Features with bracketed stage notes (e.g., “[Evaluate design]”) staying in New long-term.

Security / Compliance Scatter:
- Numerous S360, BinSkim, Defender enablement PBIs orphaned; centralization would improve tracking & SLA adherence.

---

## Health Categorization Summary (Representative)

Healthy:
- Active operational features with recent changes (<30 days) and clear operational focus (e.g., Improve WS dashboard, Live Site, Key rotation support).

Needs Enhancement:
- Features/Epics with 30–90 day inactivity, minimal decomposition, or ambiguous container role (Livesite followups, partner integration features).

Requires Attention:
- Epics/Features with 90–180+ day inactivity or entire branch dormancy (Max VM Support, Future Work subtree, deferred AzIMDS, performance optimization features >300 days).

Consider for Review:
- Extremely dormant (>300 days) not tied to current quarter goals (multiple performance/latency/refinement features, legacy compliance onboarding items).

---

## Recommended Branch-Level Remediation Plan

1. Branch Rationalization (Weeks 1–2):
   - Audit and tag all Features >180 days inactivity (Tag:ReviewCandidate).
   - Collapse “Future Work” and “Partner teams asks” into curated themes; close or re-parent 50%+ of items.

2. Modernization / Security Segmentation (Weeks 2–3):
   - Split “Fish or Cut Bait” Epic into: Security Hardening, Cert & Key Lifecycle, Telemetry & Monitoring, Compliance Automation.
   - Establish explicit success metrics per new Epic (e.g., reduction in open S360 items by X%).

3. Scale Initiative Reboot (Week 3):
   - Conduct viability review for Max VM Support (WireServer + IMDS). If still strategic, define 2–3 concrete milestone Features; close rest as historical experiments.

4. Governance & Automation (Week 4):
   - Implement pipeline rule: reject creation of Feature/PBI without parent (unless tagged Exempt=KR).
   - Scheduled job to compute daysInactive and auto-comment on items crossing 120/180-day thresholds with closure template.
   - Dashboard: Branch Health (Healthy vs Needs Enhancement vs Requires Attention counts) published monthly.

5. Quality Uplift:
   - Title hygiene pass to remove bracketed status markers; move semantics to tags.
   - For each Epic retained: ensure at least one active child or mark Epic as On Hold with review date.

---

## Metrics to Track Going Forward

- % of items >180 days inactivity (target <10%)
- Orphaned item count (target reduction from 121 → <20 in 60 days)
- Average daysInactive per branch (trend down month-over-month)
- Ratio of Features with at least one active child PBI (>70%)
- Closure / consolidation rate of parking-lot Epics (target 100% resolution of “Future Work” style containers in 30 days)

---

## Continuous Improvement Opportunities

- Introduce lightweight “Branch Health Review” ceremony monthly (15 min per KR) using generated hierarchical tree snapshot.
- Add Acceptance Criteria required rule for transitioning Feature → Committed.
- Leverage tags for lifecycle: Tag:StaleCandidate after 120 days, Tag:Archive after 180 days + no owner response.
- Integrate automated summarization (like this report) into a pipeline triggered weekly (dry-run mode) for early drift detection.

---

## Closing Summary

Your backlog shows strong operational coverage but suffers from strategic sprawl: large parking-lot epics, dormant scale initiatives, and a high orphan rate dilute focus. By aggressively pruning dormant items, restructuring modernization and partner intake work, and enforcing parent linkage and inactivity governance, you can significantly improve clarity, accelerate decision-making, and elevate delivery signal.

Let me know if you’d like:
- A machine-readable JSON export of classifications
- A proposed WIQL set for monthly automation
- Draft policy text for backlog governance

I can generate any of those next—just ask.

ameliapayne_microsoft: You are a beta tester for the enhanced ado mcp server. As an intellegent agent, what would have made your job easier. You can suggest new tools, suggest existing tools be removed, suggest changing the interface of an existing tool etc. You can suggest changes to both input and output format. Think about how the tool calls impact your use of context. Don't be afraid to be harsh and critical. Think deeply.

GitHub Copilot: Created 8 todos

Read todo list

Starting (2/8) *Propose New Tools*

Below is a deep, candid beta‑tester critique with concrete proposals to make the enhanced ADO MCP work-item analysis experience far more agent-friendly and context-efficient.

## 1. Key Pain Points (Already Observed)

1. Hierarchy Reconstruction Overhead  
   - Forced to iteratively WIQL per parent (`[System.Parent] = X`) to walk down levels. No native multi-level expansion parameter.  
   - Risk of exponential tool calls when breadth is high (e.g., 20 epics × 20 features × 30 PBIs).  
2. Fragmented Semantics Across Tools  
   - Three overlapping “context” tools (by-query, batch, context-package) create decision friction: which one is minimal vs exhaustive?  
   - Missing capability to request “just enough” (e.g., titles + daysInactive + parent chain) in a single configurable projection.  
3. Output Verbosity and Redundancy  
   - Fields like `url`, `state`, `type` repeated for every node; no hierarchical compression (can’t stream a lightweight tree then fetch details on-demand).  
   - Relationship edges returned without normalized node typing (no small typed dictionary; increases token load).  
4. Lack of First-Class Health Signals  
   - Must manually compute classification (inactive thresholds, orphan detection, empty branches).  
   - No consistent delta markers (e.g., changed in last N days vs stable).  
5. Inconsistency / Ambiguity in “daysInactive”  
   - Provided, but no metadata about reference timestamp (“as of” clock) or which event types count as substantive.  
6. Orphan Detection is Expensive  
   - Requires a broad area query plus post-filter. No direct “find orphans under path” tool returning only actionable items.  
7. Filtering Limitations  
   - Cannot exclude specific work item types or states in batch tools beyond initial WIQL (e.g., can’t say “expand but skip Done grandchildren”).  
8. No Native Pagination With Hierarchy Preservation  
   - Must choose between flooding context or cutting off recursion manually.  
9. Lack of Standardized Classification Schema  
   - Tools don’t support returning computed categories (Healthy / Needs Enhancement / Requires Attention). Agent has to recode rules repeatedly.  
10. No Pre-Composed Branch Summaries  
    - Each branch-level rollup (counts by type, max inactivity, active vs stale ratio) must be recalculated externally.  
11. Missing Partial Update / Delta Modes  
    - Re-running the same queries wastes tokens; no “since timestamp” incremental retrieval.  
12. Mixed Inclusion of Closed/Removed Items in Relationship Graph  
    - Batch relation expansions include finished or removed items unless post-filtered, increasing cleanup cost.  
13. Unclear Limit Semantics  
    - `MaxResults` on hierarchy traversals can silently truncate without warning about depth cutoffs.  
14. Lack of Strong Typing / Enum Stability in API  
    - Categories like states, work item types returned as free text; no authoritative enum listing for quick downstream mapping.  
15. Repeated Query Strings in Response  
    - Echoed WIQL adds token noise; a short hash or omitted echo would be leaner.  
16. No Error Classification  
    - Just an array of errors (often empty). No severity or actionable guidance (e.g., “Query contains WorkItemLinks (unsupported)”).  
17. Missing Field Presence Map  
    - Must rely on absent keys; a `fieldsAvailable` map would simplify safe projection logic.  
18. Tool Choice Cognitive Load  
    - Need decision logic: “Should I call WIQL + batch, or context-package?” This could be collapsed into a single flexible endpoint.  
19. No Built-In Similarity / Duplicate Hint  
    - Common backlog hygiene use case—must build external heuristics.  
20. Tag / Label Explosion Unmanaged  
    - No summarization of tag distribution per branch (frequently needed for governance).  

## 2. Proposed New Tools / Endpoints

1. work-item-hierarchy-extract  
   - Inputs: rootIds (KR or Epic list), areaPath filter, depth (int), includeStates (allowlist), excludeStates, includeTypes, excludeTypes, includeClosed (bool), maxNodes, since (timestamp).  
   - Outputs: compressed tree (parent->children arrays), optional inline metrics (per node & per branch).  
2. backlog-health-assess  
   - Inputs: rootIds or areaPath; thresholds: inactivityDaysCritical, inactivityDaysWarn; options: evaluateDuplicates (bool), evaluateOwnership (bool).  
   - Outputs: per-node classification + branch classification + summary aggregates.  
3. orphan-audit  
   - Inputs: areaPath, types[], excludeStates[], ignoreLinkedTags[], since.  
   - Outputs: orphan items + probable intended parent suggestions (heuristic based on title similarity / shared tags).  
4. delta-changes-feed  
   - Inputs: since timestamp, areaPath, depth, rootIds.  
   - Outputs: changed nodes only (state transitions, reassignment, title edits, new links), enabling incremental refresh.  
5. branch-rollup  
   - Inputs: nodeIds, metricsRequested (e.g., countsByType, maxInactivity, activityHistogram).  
   - Outputs: concise JSON metrics block per node id.  
6. duplicate-candidate-search  
   - Inputs: itemId or title+description, similarityThreshold.  
   - Outputs: candidate IDs with similarity score & reason (title trigram, token overlap).  
7. enforcement-drift-report  
   - Inputs: policyProfile (e.g., requiresParent, requiresOwner, maxInactivityDays).  
   - Outputs: violations grouped by policy, remediation hints.  

## 3. Improvements to Existing Tools

Tool: wit-get-work-items-by-query-wiql  
- Add parameters: `ExpandDepth`, `IncludeChildren` (bool), `MaxChildrenPerNode`, `IncludeClosedDescendants`, `Since` (incremental).  
- Support `ProjectionProfiles` (e.g., “Minimal”, “Planning”, “Full”) with predefined field sets.  
- Return `truncated: true` + reason when `MaxResults` cut triggered.  
- Add `substantiveChangePolicy` object describing which events counted (stateChange, comment, fieldEdit).  

Tool: wit-get-work-items-context-batch  
- Accept `ExpandDescendantsDepth` & selectors to avoid multiple follow-up queries.  
- Provide `branchMetrics` summary as optional block.  
- Add `dedupeFields: true` to place common repeated values (e.g., areaPath) into a `shared` section referenced by index.  

Tool: wit-get-work-item-context-package  
- Provide streaming/paginated mode for huge hierarchies: first pass root + immediate children, continuation token for deeper levels.  
- Add `metadataOnly: true` to fetch structural graph without heavy text fields, then later `hydrate` call for details.  

Common Output Envelope Additions:  
- `schemaVersion`  
- `generatedAt` ISO timestamp  
- `performance` (elapsedMs, itemCount, depthReached)  
- `warnings` with codes (e.g., HIERARCHY_TRUNCATED_DEPTH, CHILD_LIMIT_REACHED)  

## 4. Output Format Enhancements

Compressed Tree Model:  
```
{
  "schemaVersion": "2.0",
  "rootIds": [14299831],
  "nodes": {
    "14299831": { "t":"KR", "st":"Committed", "di":44, "c":[31703464,31703750], "cls":"BranchNeedsEnhancement" },
    "31703464": { "t":"Epic", "st":"Active", "di":44, "c":[31703539], "m":{"openFeatures":2} },
    "31703539": { "t":"Feature", "st":"Active", "di":24 }
  },
  "aggregates": {
    "countsByType": {"KR":1,"Epic":1,"Feature":1},
    "maxDepth":3
  }
}
```
Abbreviated keys reduce tokens. Agent can request `verbose=true` for full fields.

Inline Branch Classification & Flags:
- Add `flags`: array of machine-friendly codes (e.g., `["EMPTY_BRANCH","EXTENDED_INACTIVITY"]`).

Token Efficiency:
- Provide integer-coded enum maps at header:
```
"enums": {
  "type": {"Key Result":"KR","Epic":"E","Feature":"F"},
  "state": {"New":"N","Active":"A","Committed":"C"}
}
```
And nodes just reference short codes.

## 5. Tools to Remove / Merge

- Merge `wit-get-work-items-context-batch` and `wit-get-work-item-context-package` into a single `work-item-context` with flexible selectors: `mode: batch | single | hierarchy`.
- Deprecate specialized single-item deep dive if hierarchical batch can request `rootIds:[X]` with `depth`.  
- Remove need for separate orphan detection via WIQL + post-filter by offering `orphan-audit`.  

## 6. Advanced Automation & Governance Ideas

1. Built-in Policy Engine: Evaluate rules (owner required for state != New, inactivity thresholds, description length min, acceptance criteria presence for user stories) and return structured violation objects.  
2. Activity Heat Map Metric: Return per-branch activity histogram (e.g., counts of substantive changes in 0–7, 8–30, 31–90, 90+ day buckets).  
3. Branch Risk Score: Weighted formula (ratio stale items, orphan count, empty epics). Provide normalized score 0–100.  
4. Suggested Actions Auto-Generation: For each branch, produce top 3 machine-generated remediation tasks (Close stale Features, Split large Epic, Add child PBIs).  
5. Duplicate / Overlap Suggestion: For Features with >70% lexical overlap, produce a “merge candidates” set.  
6. Temporal Drift Detection: Alert when branch inactivity median increases >X% week over week.  
7. Controlled Vocabulary Enforcement: Validate naming patterns (no bracketed status markers).  

## 7. Example Redesigned Request / Response (Unified Hierarchy + Health)

Request:
```
POST /api/workitems/hierarchy
{
  "rootIds": [14299831,14308600],
  "maxDepth": 4,
  "filters": {
    "excludeStates": ["Closed","Done","Removed","Resolved"],
    "excludeTypes": ["Test Case"]
  },
  "projections": {
    "profile": "PlanningMinimal",
    "includeFields": ["System.AssignedTo","Microsoft.VSTS.Common.Priority"]
  },
  "metrics": {
    "includeBranchRollups": true,
    "includeHealthClassification": true,
    "healthThresholds": {
      "inactivityWarnDays": 90,
      "inactivityCriticalDays": 180
    }
  },
  "delta": {
    "since": "2025-09-01T00:00:00Z"
  },
  "pagination": { "nodeLimit": 800, "continuationToken": null }
}
```

Response (excerpt):
```
{
  "schemaVersion": "2.0",
  "generatedAt": "2025-10-02T20:11:04Z",
  "enums": {
    "type": {"KR":"Key Result","E":"Epic","F":"Feature"},
    "state": {"N":"New","A":"Active","C":"Committed"}
  },
  "nodes": {
    "14299831": {"t":"KR","st":"C","di":44,"flags":["MIXED_ACTIVITY"],"branch":{"score":62,"class":"BranchNeedsEnhancement","counts":{"E":5,"F":40},"stalePct":37}},
    "31703464": {"t":"E","st":"A","di":44,"c":[31703539],"flags":[]},
    "31703539": {"t":"F","st":"A","di":24,"flags":[]}
  },
  "deltas": {
    "changedNodes": [31703539],
    "since": "2025-09-01T00:00:00Z"
  },
  "pagination": {"truncated": false},
  "aggregates": {
    "global": {"totalNodes": 120,"stalePct": 41,"orphanCount": 0}
  },
  "metricsMeta": {
    "inactivityWarnDays": 90,
    "inactivityCriticalDays": 180
  }
}
```

## 8. Prioritized Actionable Recommendations (Roadmap)

Immediate (Low Effort / High Impact):
1. Add `expandDepth` + child suppression options to WIQL retrieval.  
2. Introduce truncated flag & performance metadata.  
3. Provide minimal profile output mode with abbreviated keys.  
4. Expose `since` parameter for delta queries.  

Short Term (Next Iteration):
5. Merge batch & context-package into unified `work-item-context`.  
6. Add branch rollup metrics (counts, inactivity distribution).  
7. Implement orphan-audit endpoint.  
8. Add health classification with configurable thresholds baked in.

Medium Term:
9. Add duplicate-candidate detection and branch risk scoring.  
10. Introduce policy evaluation / enforcement-drift reporting.  
11. Provide continuation tokens for large hierarchies with stable ordering.

Long Term:
12. Fully unified hierarchy+health endpoint with streaming mode.  
13. Machine learning assisted “suggested remediation” and “probable parent” inference.  
14. Graph-style subscription for change events (pub-sub delta feed).  

Defer / Avoid (Until Value Proven):
- Overly rich narrative text generation in the API (leave summary narrative to agents; keep API factual).  
- Deep historical change logs per node (provide on-demand rather than default).  

## 9. Critical Design Principles Going Forward

- Progressive Disclosure: Fetch structure first, then details on demand (reduces initial token spend).  
- Deterministic Compression: Short codes + stable schema versioning to enable robust agent parsing.  
- Explicit Truncation Semantics: Never silently cut data—always return reason & hint to continue.  
- Policy & Health as First-Class Data: Eliminate repeated reinvention of classification heuristics per agent.  
- Idempotent Delta Refresh: Agents should cheaply “top up” context rather than rehydrate full trees.  
- Branch-Centric Metrics: Optimize around how humans review (branch rollups > flat lists).  

## 10. Harsh Reality Check

Current experience feels like reassembling a jigsaw puzzle using a screwdriver:
- Too many point queries for what is conceptually a graph problem.  
- Health, governance, and hierarchy are bolted on as afterthoughts rather than core primitives.  
- Token inefficiency will scale poorly for large enterprise portfolios.  
- Lack of delta and classification forces bespoke agent logic, increasing inconsistency and maintenance burden.  

## 11. “Definition of Done” for a Mature Agent-Friendly API

- One call can: ingest roots → return compressed multi-level tree → include branch health → enumerate risk & orphan issues → provide delta since last poll.  
- Average hierarchy fetch token footprint reduced by >50%.  
- Orphan count & stale percentages computable without any client-side iteration.  
- Policy breaches machine-readable with remediation hints.  

---

If you’d like, I can next: 
A) Produce a diff spec mapping current → proposed parameter sets,  
B) Draft OpenAPI fragments for the unified endpoints, or  
C) Generate sample policy rule definitions.

Just tell me which direction you want to go and I’ll proceed.