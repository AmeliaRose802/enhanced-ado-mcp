# Hierarchy Analysis with Query Handles - Quick Reference

## What It Does
Analyzes work item hierarchies, groups violations by type, and creates query handles for each violation group so you can immediately act on problems.

## When to Use
- **Analyzing backlogs** for structure issues
- **Validating hierarchies** before sprint planning
- **Finding orphaned items** that need parents
- **Identifying state inconsistencies** across parent-child relationships
- **Bulk fixing** hierarchy problems

## Basic Usage

```typescript
const result = await callTool('analyze-bulk', {
  queryHandle: "qh_...",  // From query-wiql with returnQueryHandle: true
  analysisType: ["hierarchy"]
});
```

## Key Outputs

### Violation Groups
Each group includes:
- `type`: Violation category (orphaned_items, incorrect_parent_type, etc.)
- `severity`: critical, high, medium, or low
- `count`: Number of problematic items
- `queryHandle`: Handle to use with bulk operations
- `suggestedActions`: What to do about it
- `examples`: Sample items with issues

### Query Handles Dictionary
```json
{
  "queryHandles": {
    "orphaned_items": "qh_abc123...",
    "incorrect_parent_type": "qh_def456...",
    "state_progression_issues": "qh_ghi789..."
  }
}
```

## Violation Types

| Type | Severity | What It Means |
|------|----------|---------------|
| `orphaned_items` | Critical | Items missing required parents |
| `circular_dependencies` | Critical | Circular parent-child links |
| `incorrect_parent_type` | High | Wrong parent type (Task under Epic) |
| `state_progression_issues` | Medium | Parent/child state mismatches |
| `depth_violations` | Medium | Hierarchy too deeply nested |
| `missing_assignments` | Low | Active items without owners |

## Common Workflows

### Fix Orphaned Items

```typescript
// 1. Query items
const query = await callTool('query-wiql', {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\Team'",
  returnQueryHandle: true
});

// 2. Analyze hierarchy
const analysis = await callTool('analyze-bulk', {
  queryHandle: query.data.query_handle,
  analysisType: ["hierarchy"]
});

// 3. Get orphaned items handle
const handle = analysis.data.queryHandles.orphaned_items;

// 4. Assign for review
await callTool('execute-bulk-operations', {
  queryHandle: handle,
  actions: [{
    type: "assign",
    assignTo: "tech-lead@company.com"
  }]
});

// 5. Add comment
await callTool('execute-bulk-operations', {
  queryHandle: handle,
  actions: [{
    type: "comment",
    comment: "Please link to appropriate parent Feature"
  }]
});
```

### Fix State Inconsistencies

```typescript
// 1. Query items
const query = await callTool('query-wiql', {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\Sprint10'",
  returnQueryHandle: true
});

// 2. Analyze hierarchy
const analysis = await callTool('analyze-bulk', {
  queryHandle: query.data.query_handle,
  analysisType: ["hierarchy"]
});

// 3. Get state issues handle
const handle = analysis.data.queryHandles.state_progression_issues;

// 4. Bulk update states
await callTool('execute-bulk-operations', {
  queryHandle: handle,
  actions: [{
    type: "update",
    updates: [
      { op: "replace", path: "/fields/System.State", value: "Active" },
      { op: "add", path: "/fields/System.Tags", value: "StateReview" }
    ]
  }]
});
```

### Analyze Specific Epic Tree

```typescript
// First query for the Epic and its descendants
const query = await callTool('query-wiql', {
  wiqlQuery: "SELECT [System.Id] FROM WorkItemLinks WHERE [Source].[System.Id] = 12345 AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' MODE (Recursive)",
  returnQueryHandle: true
});

// Then analyze the hierarchy
const analysis = await callTool('analyze-bulk', {
  queryHandle: query.data.query_handle,
  analysisType: ["hierarchy"],
  filters: {
    excludeStates: ["Closed", "Removed"]
  }
});

// Handle each violation group
for (const group of analysis.data.violationGroups) {
  console.log(`${group.type}: ${group.count} items (${group.severity})`);
  console.log(`Query Handle: ${group.queryHandle}`);
  console.log(`Actions: ${group.suggestedActions.join(', ')}`);
}
```

## Parameters

### Common Parameters
- `AreaPath`: Area path to analyze (OR WorkItemIds)
- `WorkItemIds`: Specific IDs to analyze (includes descendants)
- `MaxItemsToAnalyze`: Limit items (default 100, max 500)
- `AnalysisDepth`: "shallow" or "deep" (default "deep")
- `ExcludeStates`: Skip items in these states

### Full Example
```typescript
{
  AreaPath: "MyProject\\Team\\Backend",
  MaxItemsToAnalyze: 200,
  FilterByWorkItemType: ["Epic", "Feature", "Product Backlog Item"],
  ExcludeStates: ["Closed", "Removed"],
  AnalysisDepth: "deep"
}
```

## Tips

1. **Start with critical violations** (orphaned_items, circular_dependencies)
2. **Use examples** to understand each violation type
3. **Query handles are valid for 1 hour** - use them quickly
4. **Re-run analysis** after bulk fixes to verify
5. **Focus on one violation type at a time** for clarity

## Troubleshooting

### "No work items found"
- Check area path spelling
- Verify items exist in that area
- Try without `ExcludeStates` first

### "Exceeded timeout"
- Reduce `MaxItemsToAnalyze`
- Use `AnalysisDepth: "shallow"`
- Narrow scope with `FilterByWorkItemType`

### "Server instance not available"
- Ensure VS Code sampling support is enabled
- Check MCP server configuration
- Verify AI features are available

## Related Tools

- `execute-bulk-operations` - Perform bulk actions on violation groups (assign, update, comment)
- `inspect-handle` - Inspect query handle contents
- `query-wiql` - Query work items for analysis

## Performance

- **Typical analysis:** 2-5 seconds for 100 items
- **Deep analysis:** 5-15 seconds for 100 items with full tree
- **Query handle creation:** Instant (happens during analysis)
- **Handle validity:** 1 hour

---

**Pro Tip:** Combine with bulk operations for powerful workflow automation!




