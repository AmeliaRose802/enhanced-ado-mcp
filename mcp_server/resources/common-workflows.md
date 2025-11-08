# Common Workflow Examples

End-to-end workflows combining multiple tools.

---

## Workflow 0: Building Queries with AI (NEW)

**Goal:** Construct complex WIQL or OData queries from natural language

### Option A: Generate WIQL Query for Work Items
```json
// Tool: wit-wiql-query (with description for AI generation)
{
  "description": "Find all active bugs assigned to me created in the last 30 days with high priority",
  "includeExamples": true,
  "testQuery": true,
  "maxIterations": 3,
  "returnQueryHandle": true
}
```

**Returns:**
- Validated WIQL query string
- Query handle for bulk operations
- Work items array for preview
- Query summary and validation status

**Or use direct WIQL:**
```json
// Tool: wit-wiql-query (with direct WIQL)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.AssignedTo] = @Me AND [System.CreatedDate] >= @Today - 30 AND [Microsoft.VSTS.Common.Priority] = 1",
  "includeFields": ["System.Title", "System.State", "Microsoft.VSTS.Common.Priority"],
  "returnQueryHandle": true,
  "maxResults": 200
}
```

### Option B: Generate OData Query for Analytics
```json
// Tool: wit-odata-query (with description for AI generation)
{
  "description": "Count completed work items grouped by type in the last 90 days",
  "includeExamples": true,
  "testQuery": true,
  "maxIterations": 3
}
```

**Returns:**
- Validated OData query string
- Sample results showing counts by type
- Query summary and validation status

**Or use predefined query type:**
```json
// Tool: wit-odata-query (with predefined query)
{
  "queryType": "groupByType",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-10-01"
}
```

**Benefits:**
- No need to memorize WIQL/OData syntax
- Iterative validation catches errors
- Auto-injects organization, project, area path from config
- Returns working queries ready to execute

---

## Workflow 1: Feature Decomposition

**Goal:** Break down a large feature into smaller work items

### Step 1: Analyze the Feature
```json
// Tool: wit-intelligence-analyzer
{
  "title": "User authentication system",
  "description": "Complete user authentication with OAuth2",
  "workItemType": "Feature",
  "analysisType": "full"
}
```

**AI will suggest:**
- Missing acceptance criteria
- Potential child items
- Technical considerations
- Risk areas

### Step 2: Create Child Items
```json
// Tool: wit-create-new-item (repeat for each child)
{
  "title": "Implement authentication API",
  "workItemType": "Task",
  "parentWorkItemId": 12345,
  "areaPath": "MyProject\\Backend",
  "description": "Create JWT-based authentication endpoint"
}
```

### Step 3: Validate Hierarchy
```json
// First, get a query handle for the items
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (12345, 12346, 12347, 12348)",
  "returnQueryHandle": true
}
// Returns: { query_handle: "qh_items_xyz" }

// Then validate using the handle
// Tool: wit-validate-hierarchy
{
  "queryHandle": "qh_items_xyz"
}
```

**Checks:**
- Parent-child type rules
- State consistency
- Orphaned items
- Returns query handles for each violation category

### Step 4: Assign to Copilot (Optional)
```json
// Tool: wit-assign-to-copilot
{
  "workItemId": 12346,
  "repository": "repo-abc-123"
}
```

---

## Workflow 2: Backlog Cleanup

**Goal:** Find and fix issues in work item backlog

### Step 1: Get All Items in Area
```json
// Option A: Build query with AI
// Tool: wit-wiql-query
{
  "description": "all items in my area that are not removed or done",
  "includeExamples": false,
  "testQuery": true,
  "returnQueryHandle": true
}

// Option B: Use direct WIQL query
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] NOT IN ('Removed', 'Done')",
  "includeFields": ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  "returnQueryHandle": true,
  "maxResults": 500
}
```

### Step 2: Detect Patterns and Issues
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] NOT IN ('Removed', 'Done')",
  "filterByPatterns": ["missing_description", "duplicates"],
  "returnQueryHandle": true
}
```

**Finds:**
- Items missing descriptions
- Potential duplicates

### Step 3: Validate Hierarchies
```json
// Use the query handle from Step 2
// Tool: wit-validate-hierarchy
{
  "queryHandle": "qh_items_with_issues"
}
```

### Step 4: Bulk Notify Owners
```json
// Tool: wit-unified-bulk-operations-by-query-handle
{
  "queryHandle": "qh_items_with_issues",
  "actions": [
    {
      "type": "comment",
      "comment": "Please review and update this work item. Missing required information."
    }
  ],
  "dryRun": true
}
```

---

## Workflow 3: Sprint Planning

**Goal:** Plan upcoming sprint with AI assistance

### Step 1: Check Team Velocity
```json
// Tool: wit-odata-query
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-09-03",
  "areaPath": "MyProject\\MyTeam",
  "top": 30
}
```

### Step 2: Get Candidate Items
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "includeFields": ["System.Title", "System.Priority", "Microsoft.VSTS.Scheduling.StoryPoints"],
  "returnQueryHandle": true,
  "maxResults": 200
}
```

### Step 3: Analyze for AI Assignment
```json
// Tool: wit-ai-assignment-analyzer-analyzer (for each candidate)
{
  "workItemId": 12345,
  "outputFormat": "json"
}
```

**Determines:**
- Is item ready for Copilot?
- Complexity level
- Missing information

### Step 4: Create Work Item
```json
// Tool: wit-create-new-item
{
  "title": "Implement user service",
  "workItemType": "Task",
  "areaPath": "MyProject\\MyTeam",
  "parentWorkItemId": 12300
}
```

### Step 5: Assign to Copilot if AI-suitable
```json
// Tool: wit-assign-to-copilot
{
  "workItemId": <created-item-id>,
  "repository": "repo-abc-123"
}
```

---

## Workflow 4: Compliance/Security Review

**Goal:** Review work items for security requirements

### Step 1: Find Security Items
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'Security' OR [System.WorkItemType] = 'Security'",
  "includeFields": ["System.Title", "System.State", "System.Description"],
  "returnQueryHandle": true,
  "maxResults": 200
}
```

### Step 2: Extract Security Links
```json
// Tool: wit-extract-security-links (for each security item)
{
  "workItemId": 12345
}
```

**Extracts:**
- Compliance document links
- Security policy references
- Threat model links

### Step 3: Get Full Context
```json
// Tool: wit-get-work-item-context-package
{
  "workItemId": 12345,
  "includeParent": true,
  "includeChildren": true,
  "includeRelations": true,
  "includeHistory": true
}
```

---

## Workflow 5: Hierarchy Rebuilding

**Goal:** Build or rebuild work item hierarchy

### Step 1: Get Root Items
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND ([System.Parent] = '' OR [System.Parent] IS NULL) AND [System.State] NOT IN ('Removed', 'Done')",
  "includeFields": ["System.Title", "System.WorkItemType"],
  "returnQueryHandle": true,
  "maxResults": 100
}
```

### Step 2: For Each Root, Get Children
```json
// Tool: wit-wiql-query (repeat per root)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345",
  "includeFields": ["System.Title", "System.WorkItemType", "System.Parent"],
  "returnQueryHandle": true,
  "maxResults": 200
}
```

### Step 3: Recursively Build Tree
Repeat Step 2 for each child until complete tree is built.

### Step 4: Validate Complete Hierarchy
```json
// First, create a query handle for all items
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (12345, 12346, ...)",
  "returnQueryHandle": true
}
// Returns: { query_handle: "qh_tree_xyz" }

// Then validate using the handle
// Tool: wit-validate-hierarchy
{
  "queryHandle": "qh_tree_xyz"
}
```

---

## Workflow 6: Quality Improvement

**Goal:** Improve quality of existing work items

### Step 1: Get Recent Items
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND [System.ChangedDate] >= @Today - 14 AND [System.State] = 'Active'",
  "includeFields": ["System.Title", "System.Description"],
  "returnQueryHandle": true,
  "maxResults": 100
}
```

### Step 2: Analyze Each Item
```json
// Tool: wit-intelligence-analyzer
{
  "title": "Feature title",
  "description": "Feature description",
  "workItemType": "Feature",
  "analysisType": "full"
}
```

**Gets recommendations for:**
- Better descriptions
- Missing acceptance criteria
- Clearer titles
- Technical considerations

### Step 3: Detect Common Issues
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND [System.State] = 'Active'",
  "filterByPatterns": ["missing_description"],
  "returnQueryHandle": true
}
```

### Step 4: Notify Team
```json
// Tool: wit-unified-bulk-operations-by-query-handle
{
  "queryHandle": "qh_analyzed_items",
  "actions": [
    {
      "type": "comment",
      "comment": "AI analysis suggests improvements. Please review attached recommendations."
    }
  ],
  "dryRun": false
}
```

---

## Workflow 7: Metrics Dashboard

**Goal:** Build comprehensive metrics view

### Step 1: Overall Counts
```json
// Tool: wit-odata-query
{
  "queryType": "groupByState",
  "areaPath": "MyProject\\MyTeam"
}
```

### Step 2: Type Distribution
```json
// Tool: wit-odata-query
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

### Step 3: Team Velocity
```json
// Tool: wit-odata-query
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-09-01",
  "top": 30
}
```

### Step 4: Cycle Time
```json
// Tool: wit-odata-query
{
  "queryType": "cycleTimeMetrics",
  "computeCycleTime": true,
  "filters": {"State": "Done"}
}
```

### Step 5: Work Distribution
```json
// Tool: wit-odata-query
{
  "queryType": "groupByAssignee",
  "filters": {"State": "Active"},
  "orderBy": "Count desc",
  "top": 10
}
```

---

## Workflow 8: AI-First Development

**Goal:** Maximize Copilot utilization

### Step 1: Get Backlog Items
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "includeFields": ["System.Title", "System.Description"],
  "returnQueryHandle": true,
  "maxResults": 100
}
```

### Step 2: Analyze Each for AI Suitability
```json
// Tool: wit-ai-assignment-analyzer-analyzer
{
  "workItemId": 12345,
  "outputFormat": "json"
}
```

### Step 3: Create Task
```json
// Tool: wit-create-new-item
{
  "title": "Well-defined task from analysis",
  "workItemType": "Task",
  "description": "Clear requirements based on AI analysis",
  "parentWorkItemId": 12300
}
```

### Step 4: Assign to Copilot
```json
// Tool: wit-assign-to-copilot
{
  "workItemId": <created-task-id>,
  "repository": "repo-abc-123"
}
```

### Step 5: Monitor Progress
```json
// Tool: wit-wiql-query
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = 'GitHub Copilot' AND [System.State] = 'Active'",
  "returnQueryHandle": true
}
```

---

## Workflow 9: Unified Bulk Operations (NEW)

**Goal:** Use the unified bulk operations tool to perform multiple actions in sequence

### Example: Complete Backlog Cleanup with Multiple Actions

```typescript
// Step 1: Query for stale items
const response = await wit_wiql_query({
  description: "all items created more than 180 days ago that are still new",
  returnQueryHandle: true,
  includeSubstantiveChange: true
});

// Step 2: Execute multiple operations in sequence with unified tool
await wit_unified_bulk_operations_by_query_handle({
  queryHandle: response.query_handle,
  actions: [
    // Action 1: Add audit comment
    {
      type: "comment",
      comment: "🤖 Automated Backlog Review: Item inactive for >180 days. Please update or close."
    },
    // Action 2: Add tag for tracking
    {
      type: "add-tag",
      tags: "BacklogReview;Stale"
    },
    // Action 3: Update priority to low
    {
      type: "update",
      updates: [
        {
          op: "replace",
          path: "/fields/Microsoft.VSTS.Common.Priority",
          value: 4
        }
      ]
    },
    // Action 4: Assign to backlog owner for review
    {
      type: "assign",
      assignTo: "backlog-owner@example.com",
      comment: "Please review and determine if this item should be kept or removed."
    }
  ],
  dryRun: true,  // Preview first
  stopOnError: true
});
```

### Example: AI Enhancement with State Transition

```typescript
// Enhance items and move them to ready state
await wit_unified_bulk_operations_by_query_handle({
  queryHandle: "qh_abc123",
  actions: [
    // Action 1: Enhance descriptions with AI
    {
      type: "enhance-descriptions",
      enhancementStyle: "detailed",
      preserveOriginal: true,  // Append to existing
      minConfidenceScore: 0.7
    },
    // Action 2: Add acceptance criteria
    {
      type: "add-acceptance-criteria",
      criteriaFormat: "gherkin",
      minCriteria: 3,
      maxCriteria: 7
    },
    // Action 3: Estimate story points
    {
      type: "assign-story-points",
      estimationScale: "fibonacci",
      includeReasoning: true
    },
    // Action 4: Transition to Ready state
    {
      type: "transition-state",
      targetState: "Ready",
      reason: "Enhanced with AI-generated content and estimates",
      validateTransitions: true
    }
  ],
  itemSelector: {
    states: ["New"],
    daysInactiveMax: 30  // Only recently active items
  },
  dryRun: false
});
```

### Benefits of Unified Bulk Operations

1. **Single Tool:** One tool for all bulk modifications
2. **Sequential Actions:** Execute multiple operations in order
3. **Item Selection:** Select subsets within query handle
4. **Error Handling:** Choose to stop or continue on errors
5. **Dry-Run Support:** Preview all actions before executing
6. **Atomic Operations:** All actions tracked together

---

## Workflow 10: Forensic Undo (NEW)

**Goal:** Analyze and revert changes made by a specific user within a time window

### Example: Undo Accidental Bulk Removal

```typescript
// Scenario: User accidentally removed items yesterday between 2-4 PM

// Step 1: Query for all items (including removed)
const response = await wit_wiql_query({
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject'",
  returnQueryHandle: true,
  maxResults: 500
});

// Step 2: Forensic analysis - detect changes by user in time window
await wit_forensic_undo_by_query_handle({
  queryHandle: response.query_handle,
  changedBy: "user@example.com",
  afterTimestamp: "2025-11-06T14:00:00Z",
  beforeTimestamp: "2025-11-06T16:00:00Z",
  detectTypeChanges: true,
  detectStateChanges: true,
  detectFieldChanges: true,
  maxRevisions: 50,
  dryRun: true  // Preview what would be reverted
});

// Step 3: Review the preview, then execute revert
await wit_forensic_undo_by_query_handle({
  queryHandle: response.query_handle,
  changedBy: "user@example.com",
  afterTimestamp: "2025-11-06T14:00:00Z",
  beforeTimestamp: "2025-11-06T16:00:00Z",
  dryRun: false
});
```

### Features of Forensic Undo

- **Works on ANY items:** Not limited to MCP-changed items
- **Revision history analysis:** Examines ADO revision history directly
- **Smart detection:** Automatically detects already-reverted changes
- **User filtering:** Revert only changes by specific user
- **Time window:** Limit to specific time range
- **Change type selection:** Detect type changes, state changes, field changes, link changes

---

## Workflow 11: Intelligent Parent Finding (NEW)

**Goal:** Use AI to find and recommend appropriate parent work items for orphaned items

### Example: Fix Orphaned Tasks

```typescript
// Step 1: Find orphaned items (items without parents)
const orphans = await wit_wiql_query({
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] IN ('Task', 'Bug') AND [System.Parent] = '' AND [System.State] = 'Active'",
  returnQueryHandle: true
});

// Step 2: Use AI to find appropriate parents
const recommendations = await wit_find_parent_item_intelligent({
  childQueryHandle: orphans.query_handle,
  searchScope: "area",  // Search within same area path
  includeSubAreas: false,  // Enforce same area path
  parentWorkItemTypes: ["Feature", "Product Backlog Item"],
  requireActiveParents: true,
  maxParentCandidates: 20,
  maxRecommendations: 3,  // Top 3 recommendations per child
  confidenceThreshold: 0.5,
  dryRun: false
});

// Step 3: Review recommendations and create links
// The tool returns recommendations with confidence scores
// Use wit-link-work-items-by-query-handles to create the links
```

### Features of Intelligent Parent Finder

- **AI-powered matching:** Analyzes context, scope, and logical fit
- **Type hierarchy enforcement:** Validates parent-child type relationships
- **Area path enforcement:** By default, only searches same area path
- **Confidence scoring:** Ranks candidates by suitability
- **Bulk processing:** Handles multiple orphaned items at once
- **Safe recommendations:** Dry-run mode to preview before linking

---

## Tips for Combining Tools

1. **Start with queries** to identify work
2. **Use AI analysis** for insights
3. **Validate structure** before making changes
4. **Bulk operations** for efficiency
5. **Check configuration** when troubleshooting

## Common Patterns

- **Query → Analyze → Act** - Most workflows
- **Create → Validate → Assign** - New work
- **Detect → Notify → Fix** - Issue resolution
- **Aggregate → Report → Plan** - Metrics & planning
