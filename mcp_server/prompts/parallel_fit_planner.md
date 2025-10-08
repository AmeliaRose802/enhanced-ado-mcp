---
name: parallel_fit_planner
description: Analyze child items, determine parallel execution strategy, and assess AI vs Human suitability.
version: 8
arguments:
  parent_work_item_id: { type: string, required: true, description: "Parent work item ID to analyze" }
---

Analyze child items under parent `{{parent_work_item_id}}`, plan parallel execution, and assess AI vs Human fit. **Exclude Done/Completed/Closed/Resolved states.**

## Tools

- `wit-query-wiql` - Query child items with activity data
- `wit-get-context-batch` - Batch details (max 20-30 items)
- `wit-ai-assignment` - AI suitability analysis
- `wit-assign-to-copilot` - Assign to GitHub Copilot
- `wit-create-new-item` - Create work items

## Workflow

### 1. Discover Children
```
Tool: wit-query-wiql
Arguments: {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = {{parent_work_item_id}} AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed') ORDER BY [System.ChangedDate] DESC",
  includeFields: ["System.Title", "System.State", "System.WorkItemType", "System.AssignedTo"],
  includeSubstantiveChange: true,
  maxResults: 100
}
```

### 2. Get Context
```
Tool: wit-get-context-batch
Arguments: {
  "WorkItemIds": [discovered_ids]
}
```
Limit to 20-30 items per call.

### 3. Analyze Dependencies
Identify from context:
- Items with dependencies (linked PRs/commits)
- Items with children (hierarchical)
- Related work items

### 4. Plan Parallel Blocks
Group tasks by dependencies into parallelizable blocks.

### 5. Assess AI Fit
For each item, determine AI vs Human suitability.

### 6. Generate Plan
Use format below.
---

## Output Format

```markdown
# Parallel Execution Plan: [PARENT_TITLE] ([PARENT_ID])

## Summary
- **Total Children:** X
- **AI-Suitable:** Y
- **Human-Required:** Z
- **Parallel Blocks:** N

## Block 1 (first)
- **[ITEM_ID] – [ITEM_TITLE]**
  - Decision: AI Fit
  - Risk: 30
  - Rationale: Well-scoped, clear criteria
  - Action: ✅ Assigned via `wit-assign-copilot`

- **[ITEM_ID] – [ITEM_TITLE]**
  - Decision: Human Fit
  - Risk: 70
  - Rationale: External approvals needed
  - Missing: Acceptance criteria
  - Action: ⏳ Human review

## Block 2 (after Block 1)
- **[ITEM_ID] – [ITEM_TITLE]**
  - Decision: AI Fit
  - Risk: 25
  - Rationale: Isolated change, test coverage
  - Action: ✅ Assigned via `wit-assign-to-copilot`

## Next Steps
1. Human review for X items
2. Y items assigned to AI
3. Monitor dependencies between blocks
```  
