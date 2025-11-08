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
const result = await callTool('wit-analyze-hierarchy-with-handles', {
  AreaPath: "MyProject\\Team"
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
// 1. Analyze
const analysis = await callTool('wit-analyze-hierarchy-with-handles', {
  AreaPath: "MyProject\\Team"
});

// 2. Get orphaned items handle
const handle = analysis.data.queryHandles.orphaned_items;

// 3. Assign for review
await callTool('wit-bulk-assign-by-query-handle', {
  queryHandle: handle,
  assignee: "tech-lead@company.com"
});

// 4. Add comment
await callTool('wit-bulk-comment-by-query-handle', {
  queryHandle: handle,
  comment: "Please link to appropriate parent Feature"
});
```

### Fix State Inconsistencies

```typescript
// 1. Analyze
const analysis = await callTool('wit-analyze-hierarchy-with-handles', {
  AreaPath: "MyProject\\Sprint10"
});

// 2. Get state issues handle
const handle = analysis.data.queryHandles.state_progression_issues;

// 3. Bulk update states
await callTool('wit-bulk-update-by-query-handle', {
  queryHandle: handle,
  updates: {
    "System.State": "Active",
    "System.Tags": "StateReview"
  }
});
```

### Analyze Specific Epic Tree

```typescript
const analysis = await callTool('wit-analyze-hierarchy-with-handles', {
  WorkItemIds: [12345], // Epic ID
  AnalysisDepth: "deep", // Analyzes full tree
  ExcludeStates: ["Closed", "Removed"]
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

- `wit-bulk-assign-by-query-handle` - Assign items in violation groups
- `wit-bulk-update-by-query-handle` - Update fields on violation groups  
- `wit-bulk-comment-by-query-handle` - Add comments to violation groups
- `inspect-handle` - Inspect query handle contents

## Performance

- **Typical analysis:** 2-5 seconds for 100 items
- **Deep analysis:** 5-15 seconds for 100 items with full tree
- **Query handle creation:** Instant (happens during analysis)
- **Handle validity:** 1 hour

---

**Pro Tip:** Combine with bulk operations for powerful workflow automation!




