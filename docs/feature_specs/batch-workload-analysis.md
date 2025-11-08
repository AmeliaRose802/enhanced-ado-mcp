# Workload Analysis (Single & Batch)

## Overview

The `analyze-workload` tool provides flexible workload analysis that accepts **either a single email or an array of emails**. When given an array, it efficiently analyzes multiple team members' workloads in parallel, processing up to 20 people concurrently and returning all results with team-level aggregated metrics in a single response.

**Version:** 2.0.0 (Unified from separate tools)  
**Updated:** November 2025  
**Category:** AI Analysis Tools  
**Requires:** VS Code + GitHub Copilot with sampling support

## Purpose

- **Performance Optimization**: Analyze multiple team members 5-10x faster than sequential individual analyses
- **Team Health Assessment**: Quickly assess entire team workload health with aggregated metrics
- **Manager Reviews**: Enable efficient workload reviews across direct reports
- **Concurrent Processing**: Configurable concurrency (1-10, default 5) to balance speed and API load

## Input Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `assignedToEmail` | `string \| string[]` | **Single email** for individual analysis (e.g., `"user@domain.com"`) **OR** **array of emails** for batch team analysis (1-20 people, e.g., `["user1@domain.com", "user2@domain.com"]`). Tool automatically detects mode based on type. |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `analysisPeriodDays` | `number` | `90` | Days to analyze backward from today (min 7, max 365) |
| `additionalIntent` | `string` | - | Custom analysis intent applied to all team members |
| `continueOnError` | `boolean` | `true` | **[Batch mode only]** Continue analyzing remaining people if one fails |
| `maxConcurrency` | `number` | `5` | **[Batch mode only]** Maximum concurrent analyses (1-10). Lower values reduce API load. |
| `organization` | `string` | config | Azure DevOps organization name |
| `project` | `string` | config | Azure DevOps project name |
| `areaPath` | `string` | config | Area path to filter work items |

## Output Format

### Success Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAnalyzed": 5,
      "successCount": 5,
      "errorCount": 0,
      "analysisPeriodDays": 90,
      "startDate": "2025-08-09",
      "endDate": "2025-11-07",
      "additionalIntent": "assess readiness for promotion"
    },
    "results": [
      {
        "email": "user1@domain.com",
        "success": true,
        "analysis": {
          "executiveSummary": { /* PersonalWorkloadAnalysisResult */ },
          "workSummary": { /* ... */ },
          "riskFlags": { /* ... */ },
          "detailedAnalysis": { /* ... */ },
          "actionItems": { /* ... */ }
        }
      },
      {
        "email": "user2@domain.com",
        "success": false,
        "error": "Failed to fetch work items: HTTP 404"
      }
      // ... more results
    ],
    "teamMetrics": {
      "averageHealthScore": 72,
      "healthDistribution": {
        "Healthy": 3,
        "Concerning": 1,
        "At Risk": 1
      },
      "topConcerns": [
        { "concern": "High WIP (work in progress)", "count": 3 },
        { "concern": "Overspecialization in single work type", "count": 2 }
      ],
      "totalWorkItems": {
        "completed": 145,
        "active": 28
      }
    }
  },
  "metadata": {
    "source": "batch-personal-workload-analysis",
    "duration": 45320,
    "concurrency": 5,
    "continueOnError": true
  }
}
```

### Individual Analysis Structure

Each successful result contains a complete `PersonalWorkloadAnalysisResult` with:

- **Executive Summary**: Health score, status, primary concerns
- **Work Summary**: Completed/active work metrics, velocity, estimation quality
- **Risk Flags**: Critical, concerning, minor, and positive indicators
- **Detailed Analysis**: Workload balance, variety, coding balance, complexity growth, temporal health, growth trajectory
- **Action Items**: Immediate, short-term, long-term recommendations

See [Personal Workload Analysis](./AI_POWERED_FEATURES.md#personal-workload-analysis) for complete individual analysis structure.

### Team Metrics

When 1+ successful analyses complete, team-level aggregations are provided:

- **Average Health Score**: Mean health score across all team members
- **Health Distribution**: Count of team members in each health status
- **Top Concerns**: Most common concerns across the team (up to 10)
- **Total Work Items**: Aggregate completed and active work

## Examples

### Individual Analysis (Single Email)

```json
{
  "assignedToEmail": "user@contoso.com",
  "analysisPeriodDays": 90
}
```

### Basic Team Health Assessment (Array of Emails)

```json
{
  "assignedToEmail": [
    "alice@contoso.com",
    "bob@contoso.com",
    "charlie@contoso.com"
  ]
}
```

### Custom Analysis Intent (Batch)

```json
{
  "assignedToEmail": ["user1@contoso.com", "user2@contoso.com"],
  "analysisPeriodDays": 60,
  "additionalIntent": "assess readiness for promotion to senior engineer"
}
```

### High-Concurrency for Large Teams (Batch)

```json
{
  "assignedToEmail": ["user1@contoso.com", /* ... 15 more */],
  "maxConcurrency": 10,
  "continueOnError": true
}
```

### Strict Error Handling (Batch)

```json
{
  "assignedToEmail": ["user1@contoso.com", "user2@contoso.com"],
  "continueOnError": false
}
```
*Note: Analysis stops on first error when `continueOnError: false`*

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Server instance not available for sampling` | Sampling support not initialized | Ensure running in VS Code with GitHub Copilot |
| `Analysis failed for <email>` (continueOnError=false) | Single person analysis failed | Check email format, verify person exists, review individual error |
| `Failed to fetch work items: HTTP 404` | Person has no work items or invalid project | Verify email, check project/area path configuration |
| `Batch workload analysis failed` | Critical system error | Check logs for details, verify ADO connectivity |

### Partial Failures

With `continueOnError: true` (default), partial failures are reported in individual results:

```json
{
  "summary": {
    "totalAnalyzed": 5,
    "successCount": 4,
    "errorCount": 1
  },
  "results": [
    { "email": "user1@domain.com", "success": true, "analysis": {...} },
    { "email": "user2@domain.com", "success": false, "error": "HTTP 404" }
  ]
}
```

## Performance Characteristics

### Concurrency Impact

| Concurrency | 5 People | 10 People | 20 People |
|-------------|----------|-----------|-----------|
| 1 (sequential) | ~5 min | ~10 min | ~20 min |
| 5 (default) | ~60 sec | ~2 min | ~4 min |
| 10 (high) | ~30 sec | ~60 sec | ~2 min |

*Times are approximate and depend on work item counts and AI model response time*

### API Load Considerations

- **Lower concurrency (1-3)**: Gentler on Azure DevOps API, recommended for shared organizations
- **Default concurrency (5)**: Balanced performance and API load
- **Higher concurrency (8-10)**: Fastest but may trigger rate limits in high-traffic organizations

## Implementation Details

### Architecture

1. **Batch Processing**: Emails split into batches of size `maxConcurrency`
2. **Parallel Execution**: `Promise.all()` processes each batch concurrently
3. **Error Isolation**: Individual failures don't stop the batch (when `continueOnError: true`)
4. **Aggregation**: Team metrics calculated from successful individual analyses

### Integration Points

- **PersonalWorkloadAnalyzer**: Reuses existing single-person analyzer
- **SamplingService**: Orchestrates batch analysis through sampling client
- **ToolService**: Routes `analyze-workload-batch` tool calls
- **Query Execution**: Each person's analysis fetches work items via WIQL

### Validation

- Email format validation (Zod schema)
- 1-20 email limit enforcement
- Concurrency bounds (1-10)
- Analysis period bounds (7-365 days)

## Testing

### Unit Tests

```typescript
describe('PersonalWorkloadAnalyzer', () => {
  it('should process multiple people in parallel (batch mode)', async () => {
    const result = await analyzer.analyze({
      assignedToEmail: ['user1@test.com', 'user2@test.com'],
      maxConcurrency: 2
    });
    expect(result.success).toBe(true);
    expect(result.data.summary.totalAnalyzed).toBe(2);
  });

  it('should continue on error when continueOnError=true', async () => {
    // Mock one failure
    const result = await analyzer.analyze({
      assignedToEmail: ['valid@test.com', 'invalid@test.com'],
      continueOnError: true
    });
    expect(result.data.summary.successCount).toBe(1);
    expect(result.data.summary.errorCount).toBe(1);
  });

  it('should calculate team metrics in batch mode', async () => {
    const result = await analyzer.analyze({
      assignedToEmail: ['user1@test.com', 'user2@test.com']
    });
    expect(result.data.teamMetrics.averageHealthScore).toBeGreaterThan(0);
  });
});
```

### Manual Testing

1. **Small Team (3-5 people)**: Verify basic functionality
2. **Large Team (15-20 people)**: Test concurrency and performance
3. **Error Scenarios**: Test with invalid emails, missing work items
4. **Custom Intent**: Verify intent propagation to all analyses

## Changelog

### 2.0.0 (November 2025)
- **BREAKING**: Unified `analyze-workload-batch` into `analyze-workload`
- Tool now accepts either `string` (single person) or `string[]` (batch mode)
- Automatic mode detection based on parameter type
- Batch-specific parameters (`continueOnError`, `maxConcurrency`) only used in array mode
- Maintains backward compatibility for single-person analysis
- All batch functionality preserved with improved API simplicity

### 1.0.0 (November 2025)
- Initial release
- Support for 1-20 concurrent team member analyses
- Configurable concurrency (1-10)
- Team-level metric aggregation
- Continue-on-error support for partial failures
