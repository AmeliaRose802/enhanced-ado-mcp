# Common Workflow Examples

End-to-end workflows combining multiple tools.

## Workflow 1: Feature Decomposition

**Goal:** Break down a large feature into smaller work items

### Step 1: Analyze the Feature
```json
// Tool: wit-intelligence-analyzer
{
  "workItemId": 12345,
  "analysisType": "comprehensive"
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
  "Title": "Implement authentication API",
  "WorkItemType": "Task",
  "Parent": 12345,
  "AreaPath": "MyProject\\Backend",
  "Description": "Create JWT-based authentication endpoint"
}
```

### Step 3: Validate Hierarchy
```json
// Tool: wit-validate-hierarchy-fast
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
  "WorkItemId": 12346,
  "RepositoryId": "repo-abc-123"
}
```

---

## Workflow 2: Backlog Cleanup

**Goal:** Find and fix issues in work item backlog

### Step 1: Get All Items in Area
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyArea' AND [System.State] NOT IN ('Removed', 'Done')",
  "IncludeFields": ["System.Title", "System.State", "System.WorkItemType", "System.Parent"],
  "MaxResults": 500
}
```

### Step 2: Detect Patterns and Issues
```json
// Tool: wit-detect-patterns
{
  "workItemIds": [100, 101, 102, ...], // from step 1
  "patterns": ["orphaned", "missing_description", "duplicates"]
}
```

**Finds:**
- Items without parents
- Items missing descriptions
- Potential duplicates

### Step 3: Validate Hierarchies
```json
// Tool: wit-validate-hierarchy-fast
{
  "workItemIds": [100, 101, 102, ...]
}
```

### Step 4: Bulk Notify Owners
```json
// Tool: wit-bulk-add-comments
{
  "workItemIds": [100, 101, 102], // items with issues
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
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "IncludeFields": ["System.Title", "System.Priority", "System.StoryPoints"],
  "MaxResults": 200
}
```

### Step 3: Analyze for AI Assignment
```json
// Tool: wit-ai-assignment-analyzer (for each candidate)
{
  "workItemId": 12345,
  "analysisDepth": "quick"
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
  "Title": "Implement user service",
  "WorkItemType": "Task",
  "RepositoryId": "repo-abc-123",
  "AreaPath": "MyProject\\MyTeam",
  "Parent": 12300
}
```

---

## Workflow 4: Compliance/Security Review

**Goal:** Review work items for security requirements

### Step 1: Find Security Items
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'Security' OR [System.WorkItemType] = 'Security'",
  "IncludeFields": ["System.Title", "System.State", "System.Description"],
  "MaxResults": 200
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
  "workItemIds": [12345],
  "includeParents": true,
  "includeChildren": true,
  "includeRelationships": true,
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
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND ([System.Parent] = '' OR [System.Parent] IS NULL) AND [System.State] NOT IN ('Removed', 'Done')",
  "IncludeFields": ["System.Title", "System.WorkItemType"],
  "MaxResults": 100
}
```

### Step 2: For Each Root, Get Children
```json
// Tool: wit-get-work-items-by-query-wiql (repeat per root)
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = 12345",
  "IncludeFields": ["System.Title", "System.WorkItemType", "System.Parent"],
  "MaxResults": 200
}
```

### Step 3: Recursively Build Tree
Repeat Step 2 for each child until complete tree is built.

### Step 4: Validate Complete Hierarchy
```json
// Tool: wit-validate-hierarchy-fast
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
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject' AND [System.ChangedDate] >= @Today - 14 AND [System.State] = 'Active'",
  "IncludeFields": ["System.Title", "System.Description"],
  "MaxResults": 100
}
```

### Step 2: Analyze Each Item
```json
// Tool: wit-intelligence-analyzer
{
  "workItemId": 12345,
  "analysisType": "comprehensive"
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
  "patterns": ["missing_description", "missing_acceptance_criteria"]
}
```

### Step 4: Notify Team
```json
// Tool: wit-bulk-add-comments
{
  "workItemIds": [12345, 12346],
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
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task')",
  "IncludeFields": ["System.Title", "System.Description"],
  "MaxResults": 100
}
```

### Step 2: Analyze Each for AI Suitability
```json
// Tool: wit-ai-assignment-analyzer
{
  "workItemId": 12345,
  "analysisDepth": "comprehensive"
}
```

### Step 3: Create AI-Ready Tasks
```json
// Tool: wit-new-copilot-item
{
  "Title": "Well-defined task from analysis",
  "WorkItemType": "Task",
  "Description": "Clear requirements based on AI analysis",
  "RepositoryId": "repo-abc-123",
  "Parent": 12300
}
```

### Step 4: Monitor Progress
```json
// Tool: wit-get-work-items-by-query-wiql
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = 'GitHub Copilot' AND [System.State] = 'Active'"
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
