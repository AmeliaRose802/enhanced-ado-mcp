# Tool Selection Guide

Quick decision guide for choosing the right tool for your task.

## Query Work Items

### Get Individual Work Items
**Tool:** `wit-get-work-items-by-query-wiql`  
**When:** Need specific work items with full field data  
**Example:** Get all active bugs in an area

```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "IncludeFields": ["System.Title", "System.State"],
  "MaxResults": 200
}
```

### Get Metrics/Aggregations
**Tool:** `wit-query-analytics-odata`  
**When:** Need counts, grouping, velocity, cycle time  
**Example:** Count active items by type

```json
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

## Get Work Item Details

### Single Item with Full Context
**Tool:** `wit-get-work-item-context-package`  
**When:** Need complete information about one item including relationships  
**Example:** Full context for planning work

```json
{
  "workItemIds": [12345],
  "includeParents": true,
  "includeChildren": true,
  "includeHistory": true
}
```

### Multiple Items Efficiently
**Tool:** `wit-get-work-items-context-batch`  
**When:** Need details for multiple items with relationships  
**Example:** Get context for a list of related items

```json
{
  "workItemIds": [100, 101, 102],
  "includeParents": true,
  "includeChildren": true,
  "maxDepth": 3
}
```

## Create & Modify Work Items

### Create New Work Item
**Tool:** `wit-create-new-item`  
**When:** Creating a standard work item  
**Example:** Create a new bug

```json
{
  "Title": "Fix login issue",
  "WorkItemType": "Bug",
  "AreaPath": "MyProject\\Backend",
  "AssignedTo": "john@example.com"
}
```

### Create and Assign to Copilot
**Tool:** `wit-new-copilot-item`  
**When:** Creating an item for Copilot to work on  
**Example:** Create task and auto-assign with branch

```json
{
  "Title": "Implement user authentication",
  "WorkItemType": "Task",
  "RepositoryId": "abc-123"
}
```

### Assign Existing Item to Copilot
**Tool:** `wit-assign-to-copilot`  
**When:** Assigning existing work to Copilot  
**Example:** Delegate existing task

```json
{
  "WorkItemId": 12345,
  "RepositoryId": "abc-123"
}
```

## AI-Powered Analysis

### Analyze for AI Assignment
**Tool:** `wit-ai-assignment-analyzer`  
**When:** Check if item is suitable for Copilot  
**Example:** Evaluate if task is ready for AI

```json
{
  "workItemId": 12345,
  "analysisDepth": "comprehensive"
}
```

### Intelligent Work Item Analysis
**Tool:** `wit-intelligence-analyzer`  
**When:** Get AI recommendations for improvement  
**Example:** Enhance work item quality

```json
{
  "workItemId": 12345,
  "analysisType": "comprehensive"
}
```

## AI-Powered Prompts

### Team Velocity Analysis
**Prompt:** `team_velocity_analyzer`  
**When:** Analyze team performance and get work assignment recommendations  
**Example:** Evaluate team capacity and optimize assignments

```json
{
  "analysis_period_days": 90,
  "max_recommendations": 3
}
```

### Project Completion Planning
**Prompt:** `project_completion_planner`  
**When:** Need comprehensive project timeline and completion forecast  
**Example:** Analyze entire project, estimate completion date, optimize AI/human assignments

```json
{
  "project_epic_id": 12345,
  "target_completion_date": "2025-12-31",
  "planning_horizon_weeks": 26,
  "include_buffer": true
}
```

### AI Assignment Analysis
**Prompt:** `ai_assignment_analyzer`  
**When:** Evaluate multiple items for GitHub Copilot assignment suitability  
**Example:** Batch analyze backlog for AI opportunities

### Work Item Enhancement
**Prompt:** `work_item_enhancer`  
**When:** Improve work item descriptions, acceptance criteria, and clarity  
**Example:** Enhance PBI before sprint planning

## Bulk Operations

### Add Comments to Multiple Items
**Tool:** `wit-bulk-add-comments`  
**When:** Need to notify or update multiple items  
**Example:** Add status update to all items in sprint

```json
{
  "workItemIds": [100, 101, 102],
  "comment": "Updated to use new API version"
}
```

## Pattern Detection & Validation

### Detect Issues in Work Items
**Tool:** `wit-detect-patterns`  
**When:** Find common problems across items  
**Example:** Find duplicates, orphans, incomplete items

```json
{
  "workItemIds": [100, 101, 102],
  "patterns": ["duplicates", "orphaned", "missing_description"]
}
```

### Validate Hierarchy Rules
**Tool:** `wit-validate-hierarchy-fast`  
**When:** Check parent-child type and state rules  
**Example:** Ensure hierarchy follows conventions

```json
{
  "workItemIds": [100, 101, 102, 103]
}
```

## Special Tools

### Extract Security Links
**Tool:** `wit-extract-security-links`  
**When:** Need to find security-related documentation links  
**Example:** Extract compliance references

```json
{
  "workItemId": 12345
}
```

### Get Configuration
**Tool:** `wit-get-configuration`  
**When:** Need to see current MCP server settings  
**Example:** View organization, project, area path

```json
{}
```

## Decision Flow

```
Need data?
├─ Individual items? → wit-get-work-items-by-query-wiql
├─ Metrics/counts? → wit-query-analytics-odata
└─ Full context? → wit-get-work-item-context-package

Creating items?
├─ Standard creation? → wit-create-new-item
├─ For Copilot? → wit-new-copilot-item
└─ Assign existing? → wit-assign-to-copilot

Analysis needed?
├─ AI suitability? → wit-ai-assignment-analyzer
├─ Quality check? → wit-intelligence-analyzer
├─ Find issues? → wit-detect-patterns
└─ Validate hierarchy? → wit-validate-hierarchy-fast

Bulk operations?
├─ Add comments? → wit-bulk-add-comments
└─ Process many? → Use batch tools

Configuration?
└─ View settings? → wit-get-configuration
```

## Performance Considerations

### Fast Operations
- `wit-get-configuration` - Instant
- `wit-validate-hierarchy-fast` - < 1s for 100 items
- `wit-query-analytics-odata` - Server-side aggregation (fast)

### Moderate Operations
- `wit-get-work-items-by-query-wiql` - Depends on result count
- `wit-get-work-items-context-batch` - Depends on depth/count
- `wit-detect-patterns` - Depends on item count

### Slower Operations (Use AI)
- `wit-ai-assignment-analyzer` - AI analysis (~5-10s)
- `wit-intelligence-analyzer` - AI analysis (~5-10s)

## Common Combinations

### Feature Decomposition
1. `wit-intelligence-analyzer` - Analyze feature
2. `wit-create-new-item` - Create child items
3. `wit-validate-hierarchy-fast` - Verify structure

### Backlog Cleanup
1. `wit-get-work-items-by-query-wiql` - Get items
2. `wit-detect-patterns` - Find issues
3. `wit-bulk-add-comments` - Notify owners

### Sprint Planning
1. `wit-query-analytics-odata` - Get velocity metrics
2. `wit-get-work-items-by-query-wiql` - Get candidates
3. `wit-ai-assignment-analyzer` - Check Copilot suitability
4. `wit-assign-to-copilot` - Delegate to AI

### Project Completion Planning
1. `project_completion_planner` prompt - Comprehensive project analysis
2. Review timeline, capacity, and risks
3. `wit-assign-to-copilot` - Assign AI-suitable items
4. Track progress weekly against forecast

### Quality Check
1. `wit-get-work-items-by-query-wiql` - Get recent items
2. `wit-intelligence-analyzer` - Analyze quality
3. `wit-validate-hierarchy-fast` - Check relationships
4. `wit-bulk-add-comments` - Request updates
