# Backlog Cleanup Analyzer

**Feature Name:** `wit-backlog-cleanup-analyzer`  
**Status:** ✅ Implemented  
**Version:** 1.6  
**Last Updated:** 2025-10-09

## Overview

The Backlog Cleanup Analyzer is an AI-powered tool that analyzes backlog items for quality issues, staleness, and missing metadata. It categorizes findings by severity and returns separate query handles for each category, enabling targeted bulk remediation workflows.

## Purpose

- Identify stale work items that haven't been updated in a configurable time period
- Detect quality issues (missing descriptions, acceptance criteria, story points)
- Find metadata gaps (unassigned items, missing iterations, priorities)
- Prioritize cleanup efforts by severity (critical, warning, info)
- Enable bulk remediation through category-specific query handles

## Key Features

### 1. Configurable Staleness Detection

Work items are considered stale based on a configurable threshold (default: 180 days).

### 2. Multi-Dimensional Quality Checks

- **Quality Checks**: Missing descriptions, acceptance criteria (PBIs/User Stories), story points
- **Metadata Checks**: Unassigned items, missing iteration paths, missing priorities
- **Severity Classification**: Critical, warning, and info levels

### 3. Category-Specific Query Handles

**NEW in v1.6:** Returns a separate query handle for each severity category, allowing targeted bulk operations.

- `queryHandle`: All analyzed items (backward compatibility)
- `categoryHandles.critical`: Items requiring immediate attention
- `categoryHandles.warning`: Items needing review or updates
- `categoryHandles.info`: Informational findings

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `areaPath` | string | ✅ | - | Area path to analyze (required for scoping) |
| `stalenessThresholdDays` | number | ❌ | 180 | Days of inactivity to consider stale |
| `includeSubAreas` | boolean | ❌ | true | Include child area paths |
| `includeQualityChecks` | boolean | ❌ | true | Check for missing content quality elements |
| `includeMetadataChecks` | boolean | ❌ | true | Check for missing metadata fields |
| `maxResults` | number | ❌ | 500 | Maximum work items to analyze |
| `returnQueryHandle` | boolean | ❌ | true | Return query handles for bulk operations |
| `organization` | string | ❌ | (config) | Azure DevOps organization |
| `project` | string | ❌ | (config) | Azure DevOps project |

## Output Structure

```typescript
{
  success: boolean;
  data: {
    summary: {
      totalAnalyzed: number;
      totalIssues: number;
      critical: number;         // Count of critical issues
      warning: number;          // Count of warning issues
      info: number;             // Count of info issues
      stalenessThresholdDays: number;
      areaPath: string;
    };
    issues: {
      critical: CleanupIssue[];
      warning: CleanupIssue[];
      info: CleanupIssue[];
    };
    queryHandle: string;        // Handle for all items
    categoryHandles?: {         // NEW: Handles per category
      critical?: string;        // Only present if critical issues exist
      warning?: string;         // Only present if warning issues exist
      info?: string;            // Only present if info issues exist
    };
    recommendations: string[];  // Actionable recommendations
  };
  metadata: {
    source: "backlog-cleanup-analyzer";
    issueCount: number;
    queryHandle: string | null;
    categoryHandleCount: number;  // Number of category handles created
  };
}
```

### CleanupIssue Structure

```typescript
interface CleanupIssue {
  workItemId: number;
  title: string;
  type: string;              // Task, Bug, PBI, etc.
  state: string;             // Active, New, etc.
  issues: string[];          // List of identified issues
  severity: 'critical' | 'warning' | 'info';
  daysSinceChange?: number;  // Days since last change
}
```

## Severity Classification

### Critical Issues

- **Unassigned Active/Committed Items**: Work items in active or committed states without an assignee
- Items requiring immediate attention to unblock work

### Warning Issues

- **Stale Items**: No updates beyond the staleness threshold
- **Missing Descriptions**: Empty or missing description fields
- **Missing Acceptance Criteria**: PBIs/User Stories without acceptance criteria
- **Missing Story Points**: PBIs/User Stories without story points

### Info Issues

- **Unassigned Backlog Items**: Backlog items without assignment (not actively worked)
- **Missing Iteration**: Items not assigned to a specific iteration
- **Missing Priority**: Items without a defined priority

## Usage Examples

### Basic Analysis

```javascript
{
  "areaPath": "MyProject\\MyTeam",
  "stalenessThresholdDays": 180
}
```

### Analysis with Focused Checks

```javascript
{
  "areaPath": "MyProject\\MyTeam",
  "stalenessThresholdDays": 90,
  "includeQualityChecks": true,
  "includeMetadataChecks": false,  // Skip metadata checks
  "includeSubAreas": true
}
```

## Workflow: Using Category Handles

### 1. Analyze Backlog

```javascript
const result = await callTool('wit-backlog-cleanup-analyzer', {
  areaPath: 'MyProject\\MyTeam'
});
```

### 2. Address Critical Issues First

```javascript
// Use the critical category handle
await callTool('wit-bulk-add-comments', {
  queryHandle: result.data.categoryHandles.critical,
  comment: 'CRITICAL: This active item needs immediate assignment',
  itemSelector: 'all'
});
```

### 3. Bulk Update Warning Items

```javascript
// Use the warning category handle
await callTool('wit-bulk-add-tags', {
  queryHandle: result.data.categoryHandles.warning,
  tags: ['needs-review', 'backlog-cleanup-2025'],
  itemSelector: 'all'
});
```

### 4. Review Info Items

```javascript
// Inspect info-level items for manual review
await callTool('wit-inspect-query-handle', {
  queryHandle: result.data.categoryHandles.info,
  showDetails: true
});
```

## Query Handle Metadata

Each category handle includes metadata for tracking:

```typescript
{
  project: string;
  queryType: 'backlog-cleanup' | 'backlog-cleanup-critical' | 'backlog-cleanup-warning' | 'backlog-cleanup-info';
}
```

Analysis metadata includes:

```typescript
{
  includeSubstantiveChange: true;
  stalenessThresholdDays: number;
  analysisTimestamp: string;  // ISO 8601 timestamp
}
```

## Integration Points

### With Bulk Operations

- `wit-bulk-add-comments`: Add cleanup notes
- `wit-bulk-add-tags`: Tag items for tracking
- `wit-bulk-transition-state`: Close/remove stale items
- `wit-bulk-update-fields`: Update priorities, iterations

### With Query Handle Tools

- `wit-inspect-query-handle`: Review items in each category
- `wit-validate-query-handle`: Verify handle validity
- `wit-select-from-query-handle`: Filter items further

## Error Handling

### Missing Area Path

```typescript
{
  success: false,
  errors: ['Area path is required for backlog cleanup analysis...'],
  hint: 'Use wit-list-area-paths to discover valid area paths'
}
```

### Invalid Area Path

```typescript
{
  success: false,
  errors: ['Area path "Invalid\\Path" does not exist']
}
```

## Best Practices

1. **Scope Appropriately**: Always provide an area path to avoid scanning entire projects
2. **Adjust Threshold**: Set `stalenessThresholdDays` based on your team's velocity
3. **Use Category Handles**: Leverage category-specific handles for targeted remediation
4. **Address Critical First**: Handle critical issues before warning/info items
5. **Regular Cadence**: Run analysis regularly (monthly/quarterly) for backlog hygiene
6. **Combine with AI**: Use AI-powered bulk enhancement for description improvements

## Performance Considerations

- Default `maxResults` limit: 500 items
- Analysis is client-side (fast, no LLM calls)
- Query handles expire after 1 hour (default TTL)
- Re-run analysis if handles expire before bulk operations complete

## Recommendations Output

The tool provides actionable recommendations based on findings:

- Critical issues: "Address critical issues immediately (unassigned active items)"
- Warning issues: "Review warning items for potential cleanup or updates"
- Extremely stale: "Consider closing or archiving extremely stale items" (>2x threshold)

## Testing

Comprehensive unit tests cover:

- ✅ Category handle creation for each severity level
- ✅ Handles only created for categories with issues
- ✅ Backward compatibility with main `queryHandle`
- ✅ Correct severity categorization
- ✅ Query handle metadata accuracy

Test file: `mcp_server/test/unit/backlog-cleanup-analyzer.test.ts`

## Implementation Details

**Handler:** `mcp_server/src/services/handlers/ai-powered/backlog-cleanup-analyzer.handler.ts`  
**Schema:** `backlogCleanupAnalyzerSchema` in `mcp_server/src/config/schemas.ts`  
**Prompt:** `mcp_server/prompts/backlog_cleanup.md`

## Related Features

- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md)
- [Bulk Operations](./BULK_OPERATIONS.md)
- [Bulk AI Enhancement](./BULK_AI_ENHANCEMENT.md)
- [Analysis Tools](./ANALYSIS_TOOLS.md)

## Changelog

### Version 1.6 (2025-10-09)
- **NEW**: Added category-specific query handles (`categoryHandles.critical`, `.warning`, `.info`)
- **NEW**: Added `categoryHandleCount` to metadata
- **IMPROVED**: Enhanced query handle metadata with category-specific `queryType`
- **ENHANCED**: Comprehensive unit test coverage for category handles

### Version 1.5 (2025-10-07)
- Initial implementation with single query handle
- AI-powered analysis with configurable thresholds
- Multi-dimensional quality and metadata checks

---

**Maintained by:** Principal Software Engineer  
**Review Status:** ✅ Approved  
**Implementation Status:** ✅ Complete with Category Handles
