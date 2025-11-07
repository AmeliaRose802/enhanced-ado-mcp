# Sprint Planner Multi-Area Path Support

## Overview

The sprint planning analyzer now gracefully handles multiple configured area paths, allowing teams to plan sprints across multiple work areas within the same project. This is essential for organizations that manage multiple teams or components within a single Azure DevOps project.

## Feature Status

**Status:** ✅ Implemented  
**Version:** 1.10.1+  
**Related Feature:** [Sprint Planning Analyzer](./AI_POWERED_FEATURES.md#sprint-planning)

## Problem Statement

Previously, the sprint planner only supported planning within a single area path. Organizations with multiple configured area paths (e.g., `ProjectA\TeamAlpha`, `ProjectA\TeamBeta`) had to either:
- Run sprint planning separately for each team
- Manually specify a single area path each time
- Miss work items from other configured areas

This created friction in multi-team environments where sprint planning should consider all configured work areas.

## Solution

The sprint planner now automatically uses all configured area paths when analyzing historical velocity, active work, and candidate items. Users can also explicitly specify which area paths to include using the new `areaPathFilter` parameter.

### Priority Order

The tool resolves area paths in the following priority (highest to lowest):

1. **Explicit `areaPathFilter`** - Array of area paths specified in request
2. **Single `areaPath`** - Single area path specified in request  
3. **Configured `areaPaths`** - Array of area paths from server configuration
4. **Legacy `areaPath`** - Single configured area path (backward compatibility)
5. **No filter** - Query entire project if no area paths configured

## Input Parameters

### New Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `areaPathFilter` | `string[]` | No | - | Explicitly specify area paths to filter by. Takes precedence over single `areaPath` and config defaults. |

### Existing Parameters (Behavior Updated)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `areaPath` | `string` | No | - | Single area path to filter by. Overrides config defaults but lower priority than `areaPathFilter`. |

All other parameters remain unchanged. See [Sprint Planning Analyzer](./AI_POWERED_FEATURES.md#sprint-planning) for complete parameter list.

## Output Format

Output format remains unchanged. The sprint planning result includes work items from all specified area paths.

### Metadata Enhancements

The response metadata now includes informative logging about which area paths were used:

```typescript
// Logged during execution:
// "Sprint planning across 3 area path(s): ProjectA\TeamAlpha, ProjectA\TeamBeta, ProjectA\TeamGamma"
// or
// "Sprint planning across entire project (no area path filter)"
```

## Examples

### Example 1: Use All Configured Area Paths (Default Behavior)

When multiple area paths are configured, they are all used automatically:

```javascript
// Server configured with:
// areaPaths: ['ProjectA\TeamAlpha', 'ProjectA\TeamBeta', 'ProjectA\TeamGamma']

await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [
    { email: 'alice@company.com', name: 'Alice', capacityHours: 60 },
    { email: 'bob@company.com', name: 'Bob', capacityHours: 60 }
  ]
});

// ✅ Analyzes work items from ALL three configured area paths
```

### Example 2: Explicitly Filter to Specific Area Paths

Use `areaPathFilter` to plan across a subset of configured paths:

```javascript
await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [
    { email: 'alice@company.com', name: 'Alice', capacityHours: 60 }
  ],
  areaPathFilter: ['ProjectA\\TeamAlpha', 'ProjectA\\TeamBeta']
});

// ✅ Only analyzes TeamAlpha and TeamBeta (ignores TeamGamma)
```

### Example 3: Override with Single Area Path

Use `areaPath` to plan within a single area:

```javascript
await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [
    { email: 'alice@company.com', name: 'Alice', capacityHours: 60 }
  ],
  areaPath: 'ProjectA\\TeamAlpha'
});

// ✅ Only analyzes TeamAlpha (overrides configured areaPaths)
```

### Example 4: Priority Resolution

When both parameters are provided, `areaPathFilter` takes priority:

```javascript
await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [
    { email: 'alice@company.com', name: 'Alice', capacityHours: 60 }
  ],
  areaPath: 'ProjectA\\TeamGamma',           // Lower priority - ignored
  areaPathFilter: ['ProjectA\\TeamAlpha']    // Higher priority - used
});

// ✅ Only analyzes TeamAlpha (areaPathFilter takes precedence)
```

## Implementation Details

### WIQL Query Generation

When multiple area paths are provided, the tool generates WIQL queries with OR clauses:

```sql
-- Single area path:
WHERE [System.AreaPath] UNDER 'ProjectA\TeamAlpha'

-- Multiple area paths:
WHERE ([System.AreaPath] UNDER 'ProjectA\TeamAlpha' 
       OR [System.AreaPath] UNDER 'ProjectA\TeamBeta'
       OR [System.AreaPath] UNDER 'ProjectA\TeamGamma')
```

### Empty Area Paths Handling

If no area paths are configured or provided, the tool queries the entire project:

```sql
-- No area path filter
WHERE [System.State] NOT IN ('Done', 'Completed', 'Closed')
  AND [System.AssignedTo] <> ''
-- (No area path clause)
```

### Key Components

- **Schema:** `sprintPlanningAnalyzerSchema` - Added `areaPathFilter` array parameter
- **Type Definition:** `SprintPlanningAnalyzerArgs` - Added `areaPathFilter?: string[]`
- **Analyzer:** `SprintPlanningAnalyzer.analyze()` - Priority-based area path resolution
- **Helper:** `buildAreaPathFilter()` - Generates WIQL OR clauses for multiple paths

## Error Handling

### Validation

- Empty strings in `areaPathFilter` array are ignored
- Invalid area path format (missing backslash) triggers warning but continues
- Duplicate area paths in filter are deduplicated

### Edge Cases

- **Empty filter array:** Falls back to single `areaPath` or config defaults
- **Single-element filter:** Optimized to simple UNDER clause (no OR)
- **No area paths available:** Queries entire project with informative logging

## Testing

### Unit Tests

Test file: `test/unit/sprint-planner-multi-area.test.ts`

Tests cover:
- ✅ Uses all configured area paths by default
- ✅ Respects explicit `areaPathFilter` (takes priority)
- ✅ Single `areaPath` overrides config defaults
- ✅ Priority resolution: `areaPathFilter` > `areaPath` > config
- ✅ Backward compatibility with single configured path
- ✅ Generates valid WIQL OR clauses for multiple paths
- ✅ Returns success with appropriate metadata

### Integration Testing

Manual verification:
1. Configure multiple area paths in server config
2. Run sprint planning without parameters → uses all paths
3. Run with `areaPathFilter` → uses explicit filter
4. Run with `areaPath` → uses single path override
5. Verify WIQL queries include correct area path clauses

## Backward Compatibility

✅ **Fully backward compatible**

- Existing single `areaPath` parameter continues to work
- Legacy single configured path (`config.azureDevOps.areaPath`) still supported
- No breaking changes to output format
- Default behavior unchanged for single-area configurations

## Performance Considerations

### Query Efficiency

Multi-area path queries use OR clauses, which are efficiently handled by Azure DevOps:

- **Small projects (<1000 items):** Negligible performance impact
- **Large projects (>10,000 items):** OR clauses may be slightly slower than single UNDER clause
- **Recommendation:** Use explicit `areaPathFilter` to limit scope when possible

### Token Usage

AI analysis input includes work items from all specified area paths:

- More area paths → potentially more work items → larger AI context
- Consider using `candidateWorkItemIds` to limit scope
- Historical velocity queries automatically limited to 200 items

## Best Practices

### Multi-Team Sprint Planning

```javascript
// ✅ GOOD: Explicit filter for cross-team sprint
await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [...], // Members from both teams
  areaPathFilter: ['ProjectA\\Frontend', 'ProjectA\\Backend'],
  additionalConstraints: 'Balance work between frontend and backend teams'
});
```

### Single-Team Sprint Planning

```javascript
// ✅ GOOD: Single area path for focused planning
await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [...], // Frontend team only
  areaPath: 'ProjectA\\Frontend'
});
```

### Entire Project Sprint Planning

```javascript
// ⚠️ CAUTION: May include too many items for effective planning
await mcpClient.callTool('wit-sprint-planning-analyzer', {
  iterationPath: 'ProjectA\\Sprint 10',
  teamMembers: [...],
  // No area path parameters → queries entire project
  candidateWorkItemIds: [1234, 1235, 1236] // Recommended: Limit scope
});
```

## Related Features

- [Multi-Area Path Configuration](./multi-area-path-support.md)
- [Sprint Planning Analyzer](./AI_POWERED_FEATURES.md#sprint-planning)
- [WIQL Query Generation](./QUERY_TOOLS.md)

## Changelog

### Version 1.10.1 (2025-01-07)
- ✅ Added `areaPathFilter` parameter for explicit multi-area filtering
- ✅ Automatic use of all configured area paths
- ✅ Priority-based area path resolution
- ✅ Enhanced logging for multi-area planning
- ✅ WIQL OR clause generation for multiple paths
- ✅ Comprehensive unit test coverage
