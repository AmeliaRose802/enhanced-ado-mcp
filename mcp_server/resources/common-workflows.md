# Common Workflow Examples

End-to-end workflows combining multiple tools.

---

## Workflow 0: Building Queries with AI (NEW)

**Goal:** Construct complex WIQL or OData queries from natural language

### Option A: Generate WIQL Query for Work Items
```json
// Tool: wit-generate-wiql-query
{
  "description": "Find all active bugs assigned to me created in the last 30 days with high priority",
  "includeExamples": true,
  "testQuery": true,
  "maxIterations": 3
}
```

**Returns:**
- Validated WIQL query string
- Sample results (if testQuery: true)
- Query summary and validation status

**Then execute:**
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.AssignedTo] = @Me AND [System.CreatedDate] >= @Today - 30 AND [Microsoft.VSTS.Common.Priority] = 1",
  "includeFields": ["System.Title", "System.State", "Microsoft.VSTS.Common.Priority"],
  "maxResults": 200
}
```

### Option B: Generate OData Query for Analytics
```json
// Tool: wit-generate-odata-query
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

**Then execute directly or use in further analysis:**
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "customQuery",
  "customODataQuery": "$apply=filter(CompletedDate ge 2024-10-01Z)/groupby((WorkItemType), aggregate($count as Count))"
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
// Tool: wit-validate-hierarchy
{
  "workItemIds": [12345, 12346, 12347, 12348]
}
```

**Checks:**
- Parent-child type rules
- State consistency
- No circular references

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
// Tool: wit-generate-wiql-query
{
  "description": "all items in my area that are not removed or done",
  "includeExamples": false,
  "testQuery": true
}

// Option B: Use direct WIQL query
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] NOT IN ('Removed', 'Done')",
  "includeFields": ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  "maxResults": 500
}
```

### Step 2: Detect Patterns and Issues
```json
// Tool: wit-detect-patterns
{
  "workItemIds": [100, 101, 102, ...], // from step 1
  "patterns": ["orphaned_children", "no_description", "duplicates"]
}
```

**Finds:**
- Items without parents
- Items missing descriptions
- Potential duplicates

### Step 3: Validate Hierarchies
```json
// Tool: wit-validate-hierarchy
{
  "workItemIds": [100, 101, 102, ...]
}
```

### Step 4: Bulk Notify Owners
```json
// Tool: wit-bulk-comment-by-query-handle
{
  "queryHandle": "qh_items_with_issues",
  "comment": "Please review and update this work item. Missing required information."
}
```

---

## Workflow 3: Sprint Planning

**Goal:** Plan upcoming sprint with AI assistance

### Step 1: Check Team Velocity
```json
// Tool: wit-query-analytics-odata
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
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "includeFields": ["System.Title", "System.Priority", "Microsoft.VSTS.Scheduling.StoryPoints"],
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

### Step 4: Assign Work
```json
// Tool: wit-new-copilot-item (for AI-suitable items)
{
  "title": "Implement user service",
  "workItemType": "Task",
  "repository": "repo-abc-123",
  "areaPath": "MyProject\\MyTeam",
  "parentWorkItemId": 12300
}
```

---

## Workflow 4: Compliance/Security Review

**Goal:** Review work items for security requirements

### Step 1: Find Security Items
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'Security' OR [System.WorkItemType] = 'Security'",
  "includeFields": ["System.Title", "System.State", "System.Description"],
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
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND ([System.Parent] = '' OR [System.Parent] IS NULL) AND [System.State] NOT IN ('Removed', 'Done')",
  "includeFields": ["System.Title", "System.WorkItemType"],
  "maxResults": 100
}
```

### Step 2: For Each Root, Get Children
```json
// Tool: wit-get-work-items-by-query-wiql (repeat per root)
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345",
  "includeFields": ["System.Title", "System.WorkItemType", "System.Parent"],
  "maxResults": 200
}
```

### Step 3: Recursively Build Tree
Repeat Step 2 for each child until complete tree is built.

### Step 4: Validate Complete Hierarchy
```json
// Tool: wit-validate-hierarchy
{
  "workItemIds": [12345, 12346, ...] // all items in tree
}
```

---

## Workflow 6: Quality Improvement

**Goal:** Improve quality of existing work items

### Step 1: Get Recent Items
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND [System.ChangedDate] >= @Today - 14 AND [System.State] = 'Active'",
  "includeFields": ["System.Title", "System.Description"],
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
// Tool: wit-detect-patterns
{
  "workItemIds": [12345, 12346, ...],
  "patterns": ["no_description"]
}
```

### Step 4: Notify Team
```json
// Tool: wit-bulk-comment-by-query-handle
{
  "queryHandle": "qh_analyzed_items",
  "comment": "AI analysis suggests improvements. Please review attached recommendations."
}
```

---

## Workflow 7: Metrics Dashboard

**Goal:** Build comprehensive metrics view

### Step 1: Overall Counts
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "groupByState",
  "areaPath": "MyProject\\MyTeam"
}
```

### Step 2: Type Distribution
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

### Step 3: Team Velocity
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "velocityMetrics",
  "dateRangeField": "CompletedDate",
  "dateRangeStart": "2024-09-01",
  "top": 30
}
```

### Step 4: Cycle Time
```json
// Tool: wit-query-analytics-odata
{
  "queryType": "cycleTimeMetrics",
  "computeCycleTime": true,
  "filters": {"State": "Done"}
}
```

### Step 5: Work Distribution
```json
// Tool: wit-query-analytics-odata
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
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "includeFields": ["System.Title", "System.Description"],
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

### Step 3: Create AI-Ready Tasks
```json
// Tool: wit-new-copilot-item
{
  "title": "Well-defined task from analysis",
  "workItemType": "Task",
  "description": "Clear requirements based on AI analysis",
  "repository": "repo-abc-123",
  "parentWorkItemId": 12300
}
```

### Step 4: Monitor Progress
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = 'GitHub Copilot' AND [System.State] = 'Active'"
}
```

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
