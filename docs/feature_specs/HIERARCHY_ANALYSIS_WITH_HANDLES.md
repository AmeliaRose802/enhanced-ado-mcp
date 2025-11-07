# Hierarchy Analysis with Query Handles

**Status:** Implemented  
**Version:** 1.10.2 (Updated 2025-11-07)  
**MCP Tools:** 
- `wit-analyze-hierarchy-with-handles` (AI-powered analysis with recommendations)
- `wit-validate-hierarchy` (Fast rule-based validation, token-optimized)

## Overview

Hierarchy validation tools that group violations by type and create query handles for each violation category, enabling direct bulk operations on problematic items. Two variants are available:

1. **`wit-validate-hierarchy`** - Fast, rule-based validation with minimal token usage (default behavior)
2. **`wit-analyze-hierarchy-with-handles`** - AI-powered analysis with actionable recommendations (comprehensive)

Both tools use the query handle pattern to make validation results immediately actionable without exposing work item IDs to LLMs.

## Purpose

Standard hierarchy analysis identifies problems but requires manual work to act on them. These enhanced tools solve that by:
- **Grouping violations by granular categories** (e.g., `bug_under_feature`, `orphaned_task`, `state_issue_bug_under_epic`)
- **Creating query handles** for each violation category (not full violation arrays)
- **Enabling bulk operations** directly on problem sets using handles
- **Providing actionable recommendations** (in AI-powered variant)
- **Minimizing token usage** by returning handles instead of duplicate violation data (default)

## Token-Saving Default Behavior

**By default (`includeViolationDetails: false`), these tools return:**
- Summary counts of violations by category
- Query handles for each granular violation category
- Validation rules reference
- Usage guidance for retrieving details on-demand

**Full violation arrays are NOT included** to avoid bloat and token waste. The same violation data would otherwise appear in 3+ different structures.

**To view specific violations:**
1. Use the returned query handles with `wit-query-handle-get-items` or `inspect-query-handle`
2. Only fetch details for categories you need to review
3. Use bulk operations directly on handles without viewing details

Set `includeViolationDetails: true` only when you need the full violation arrays in the response (triples response size).

## User-Facing Behavior

### Invocation
```typescript
const result = await callTool('wit-analyze-hierarchy-with-handles', {
  AreaPath: "MyProject\\Team\\Area",
  MaxItemsToAnalyze: 100,
  AnalysisDepth: "deep"
});
```

### Output
Returns violation groups with query handles, detailed issues, and recommendations:
```json
{
  "summary": {
    "totalAnalyzed": 150,
    "itemsWithIssues": 23,
    "itemsHealthy": 127,
    "violationGroupsCreated": 4,
    "analysisTimestamp": "2025-10-28T12:00:00Z"
  },
  "violationGroups": [
    {
      "type": "orphaned_items",
      "severity": "critical",
      "count": 8,
      "queryHandle": "qh_abc123...",
      "workItemIds": [101, 102, 103, ...],
      "description": "Work items without required parent relationships",
      "suggestedActions": [
        "Link to appropriate parent",
        "Review backlog structure"
      ],
      "examples": [
        {
          "id": 101,
          "title": "User Authentication Task",
          "issue": "Task has no parent Feature or PBI"
        }
      ]
    }
  ],
  "queryHandles": {
    "orphaned_items": "qh_abc123...",
    "incorrect_parent_type": "qh_def456...",
    "state_progression_issues": "qh_ghi789..."
  }
}
```

## Input Parameters

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `WorkItemIds` | `number[]` | - | Specific work item IDs to analyze (includes descendants) |
| `AreaPath` | `string` | Config default | Area path to analyze |
| `Organization` | `string` | Config default | Azure DevOps organization |
| `Project` | `string` | Config default | Azure DevOps project |
| `IncludeChildAreas` | `boolean` | `true` | Include child area paths |
| `MaxItemsToAnalyze` | `number` | `100` | Maximum items to analyze (1-500) |
| `FilterByWorkItemType` | `string[]` | - | Limit to specific types |
| `ExcludeStates` | `string[]` | - | Exclude items in these states |
| `AnalysisDepth` | `'shallow' \| 'deep'` | `'deep'` | Analysis depth level |

**Note:** Provide either `WorkItemIds` OR `AreaPath`, not both.

## Configuration

No configuration file needed - uses CLI arguments or configured defaults:

```bash
enhanced-ado-mcp myorg --area-path "MyProject\\Team"
```

## Output Format

### Success Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAnalyzed": 150,
      "itemsWithIssues": 23,
      "itemsHealthy": 127,
      "violationGroupsCreated": 4,
      "analysisTimestamp": "2025-10-28T12:00:00Z"
    },
    "violationGroups": [
      {
        "type": "orphaned_items",
        "severity": "critical",
        "count": 8,
        "queryHandle": "qh_...",
        "workItemIds": [101, 102, ...],
        "description": "Work items without required parent relationships",
        "suggestedActions": ["Link to appropriate parent"],
        "examples": [
          { "id": 101, "title": "...", "issue": "..." }
        ]
      }
    ],
    "detailedIssues": [...],
    "recommendations": {
      "highPriorityActions": ["Fix orphaned items immediately"],
      "improvementSuggestions": ["Review parent-child relationships"],
      "bestPractices": ["Maintain flat hierarchies"]
    },
    "queryHandles": {
      "orphaned_items": "qh_...",
      "incorrect_parent_type": "qh_..."
    }
  },
  "metadata": {
    "source": "hierarchy-analysis-with-handles",
    "violationGroupCount": 4,
    "totalIssues": 23
  }
}
```

### Violation Types

| Type | Severity | Description |
|------|----------|-------------|
| `orphaned_items` | Critical | Items without required parents |
| `circular_dependencies` | Critical | Circular parent-child relationships |
| `incorrect_parent_type` | High | Wrong parent type (Task under Epic) |
| `state_progression_issues` | Medium | Inconsistent parent/child states |
| `depth_violations` | Medium | Hierarchy too deep |
| `missing_assignments` | Low | Active items without owners |

### Error Response

```json
{
  "success": false,
  "errors": ["Hierarchy analysis failed: No work items found"]
}
```

## Examples

### Example 1: Analyze by Area Path

**Input:**
```typescript
{
  "AreaPath": "MyProject\\Team\\Backend",
  "MaxItemsToAnalyze": 200,
  "AnalysisDepth": "deep"
}
```

**Output:**
```json
{
  "summary": {
    "totalAnalyzed": 180,
    "itemsWithIssues": 15,
    "violationGroupsCreated": 3
  },
  "violationGroups": [
    {
      "type": "orphaned_items",
      "queryHandle": "qh_orphaned_abc123",
      "count": 5,
      "suggestedActions": ["Link to parent Feature"]
    }
  ]
}
```

**Follow-up Action:**
```typescript
// Bulk assign orphaned items to review
await callTool('wit-bulk-assign-by-query-handle', {
  queryHandle: "qh_orphaned_abc123",
  assignee: "team-lead@company.com"
});
```

### Example 2: Analyze Specific Epic

**Input:**
```typescript
{
  "WorkItemIds": [12345], // Epic ID
  "AnalysisDepth": "deep", // Analyzes entire epic tree
  "ExcludeStates": ["Closed", "Removed"]
}
```

**Output:**
```json
{
  "violationGroups": [
    {
      "type": "incorrect_parent_type",
      "queryHandle": "qh_wrongparent_def456",
      "count": 3,
      "examples": [
        {
          "id": 101,
          "title": "API Integration Task",
          "issue": "Task directly under Epic (should be under Feature or PBI)"
        }
      ]
    }
  ]
}
```

### Example 3: Fix State Progression Issues

**Input:**
```typescript
{
  "AreaPath": "MyProject\\Sprint10",
  "FilterByWorkItemType": ["Feature", "Product Backlog Item", "Task"]
}
```

**Output:**
```json
{
  "violationGroups": [
    {
      "type": "state_progression_issues",
      "queryHandle": "qh_states_ghi789",
      "count": 7,
      "description": "Parent and child items with inconsistent states",
      "suggestedActions": [
        "Update parent state to match children",
        "Review state workflow"
      ]
    }
  ]
}
```

**Follow-up:**
```typescript
// Bulk update states
await callTool('wit-bulk-update-by-query-handle', {
  queryHandle: "qh_states_ghi789",
  updates: {
    "System.State": "Active",
    "System.Tags": "StateReview"
  }
});
```

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "No work items found" | Invalid area path or no items | Check area path spelling |
| "Server instance not available" | Missing server context | Ensure AI sampling is enabled |
| "Hierarchy analysis failed" | API error or timeout | Reduce `MaxItemsToAnalyze` |
| "Exceeded timeout" | Too many items | Use smaller scope or shallow analysis |

### Error Recovery

- Tool automatically falls back to smaller batch sizes if needed
- Query handles remain valid for 1 hour for retry operations
- Detailed error messages include suggested parameter adjustments

## Implementation Details

### Key Components

- **Handler:** `src/services/handlers/analysis/hierarchy-analysis-with-handles.handler.ts`
- **Analyzer:** `src/services/analyzers/hierarchy-validator.ts` (reused)
- **Schema:** `src/config/schemas.ts` (`hierarchyAnalysisWithHandlesSchema`)
- **Tool Config:** `src/config/tool-configs/ai-analysis.ts`

### Integration Points

- **Depends on:**
  - `HierarchyValidatorAnalyzer` for AI-powered analysis
  - `QueryHandleService` for handle creation
  - VS Code Language Model API (AI sampling)
  
- **Used by:**
  - All bulk operation tools (via query handles)
  - Workflow automation scripts
  - CI/CD validation pipelines

### AI Features

- **AI-Powered:** Yes (requires VS Code sampling support)
- **System Prompt:** Uses existing `hierarchy-validator` prompt
- **Model Requirements:** Any VS Code language model
- **Token Usage:** ~1500 tokens per analysis

### Query Handle Lifecycle

1. **Creation:** Handles created during analysis (1-hour TTL)
2. **Storage:** Stored in `QueryHandleService` with work item context
3. **Usage:** Can be used immediately with any bulk operation tool
4. **Expiration:** Handles expire after 1 hour, but can be recreated

## Testing

### Test Files

- Unit tests: `test/unit/hierarchy-analysis-with-handles.test.ts` (to be created)
- Integration tests: Manual testing recommended with real data

### Test Coverage

- [ ] Violation grouping logic
- [ ] Query handle creation for each group
- [ ] Empty violation group handling
- [ ] Error scenarios (no items, AI failure)
- [ ] Multiple violation types
- [ ] Examples limiting (max 5 per group)

### Manual Testing

```bash
# 1. Build project
npm run build

# 2. Run MCP server
npm run dev

# 3. Test with MCP client
# Call wit-analyze-hierarchy-with-handles with test area path

# 4. Verify query handles work
# Use returned handles with bulk operations
```

## Related Features

- [Hierarchy Validation](./WIQL_HIERARCHICAL_QUERIES.md) - Standard hierarchy validation
- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md) - Query handle system
- [Bulk Operations](./BULK_OPERATIONS.md) - Operations that consume query handles
- [AI-Powered Features](./AI_POWERED_FEATURES.md) - AI analysis overview

## Workflow Integration

### Typical Workflow

1. **Analyze:** Run hierarchy analysis with handles
2. **Review:** Examine violation groups and examples
3. **Prioritize:** Focus on critical/high severity groups first
4. **Action:** Use query handles with bulk operations
5. **Verify:** Re-run analysis to confirm fixes

### Example Full Workflow

```typescript
// 1. Analyze
const analysis = await callTool('wit-analyze-hierarchy-with-handles', {
  AreaPath: "MyProject\\Team"
});

// 2. Fix orphaned items
const orphanedHandle = analysis.data.queryHandles.orphaned_items;
await callTool('wit-bulk-assign-by-query-handle', {
  queryHandle: orphanedHandle,
  assignee: "tech-lead@company.com"
});

// 3. Add comments for review
await callTool('wit-bulk-comment-by-query-handle', {
  queryHandle: orphanedHandle,
  comment: "Please link this item to an appropriate parent Feature or Epic"
});

// 4. Re-analyze to verify
const recheck = await callTool('wit-analyze-hierarchy-with-handles', {
  AreaPath: "MyProject\\Team"
});
```

## Changelog

- **v1.10.1** (2025-10-28) - Initial implementation
  - Created violation grouping system
  - Added query handle creation for each group
  - Integrated with existing hierarchy validator
  - Added severity levels and actionable suggestions

## References

- [Azure DevOps Work Item Hierarchy](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/organize-backlog)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)

---

**Last Updated:** 2025-10-28  
**Author:** Enhanced ADO MCP Team
