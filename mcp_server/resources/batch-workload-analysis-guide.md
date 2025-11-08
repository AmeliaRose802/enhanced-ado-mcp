# Workload Analysis - Quick Reference

## Unified Tool: `analyze-workload`

The `analyze-workload` tool **automatically detects** whether you're analyzing one person or multiple people based on the `assignedToEmail` parameter type:

✅ **Single Person Mode** (pass a string):
```json
{ "assignedToEmail": "user@domain.com" }
```

✅ **Batch Team Mode** (pass an array):
```json
{ "assignedToEmail": ["user1@domain.com", "user2@domain.com"] }
```

### Batch Mode Benefits
- Analyzing 2+ team members at once (5-10x faster)
- Team health assessments with aggregated metrics
- Manager reviewing direct reports
- Concurrent processing (up to 10 parallel analyses)

## Quick Examples

### Single Person Analysis
```json
{
  "assignedToEmail": "alice@contoso.com",
  "analysisPeriodDays": 90
}
```

### Basic Team Analysis (Batch)
```json
{
  "assignedToEmail": [
    "alice@contoso.com",
    "bob@contoso.com",
    "charlie@contoso.com"
  ]
}
```

### Custom Intent for All (Batch)
```json
{
  "assignedToEmail": ["user1@contoso.com", "user2@contoso.com"],
  "additionalIntent": "assess readiness for promotion"
}
```

### Faster Processing - High Concurrency (Batch)
```json
{
  "assignedToEmail": ["user1@contoso.com", /* ... 15 more */],
  "maxConcurrency": 10
}
```

## Key Features

### Parallel Processing
- **Default**: 5 concurrent analyses
- **Configurable**: 1-10 concurrency
- **Performance**: ~60 seconds for 5 people (vs. ~5 minutes sequential)

### Error Handling
- **continueOnError: true** (default) - Partial results on failures
- **continueOnError: false** - Fail fast on first error

### Team Metrics
Automatic aggregation when 1+ analyses succeed:
- Average health score
- Health status distribution
- Top concerns across team
- Total work items (completed/active)

## Output Structure

```json
{
  "summary": {
    "totalAnalyzed": 5,
    "successCount": 4,
    "errorCount": 1,
    "analysisPeriodDays": 90
  },
  "results": [
    {
      "email": "user1@domain.com",
      "success": true,
      "analysis": { /* Full PersonalWorkloadAnalysisResult */ }
    },
    {
      "email": "user2@domain.com",
      "success": false,
      "error": "Failed to fetch work items"
    }
  ],
  "teamMetrics": {
    "averageHealthScore": 72,
    "healthDistribution": { "Healthy": 3, "Concerning": 1 },
    "topConcerns": [
      { "concern": "High WIP", "count": 3 }
    ]
  }
}
```

## Performance Tips

1. **Default concurrency (5)**: Good balance for most teams
2. **Lower concurrency (1-3)**: Use in high-traffic ADO orgs to avoid rate limits
3. **Higher concurrency (8-10)**: Use for large teams when API load is not a concern
4. **Batch size**: Process 5-10 people per batch for optimal performance

## Common Patterns

### Manager Review
```json
{
  "assignedToEmails": [
    "report1@contoso.com",
    "report2@contoso.com",
    "report3@contoso.com",
    "report4@contoso.com"
  ],
  "analysisPeriodDays": 60,
  "additionalIntent": "monthly health check"
}
```

### Team Health Dashboard
```json
{
  "assignedToEmails": ["team-member-1@contoso.com", /* ... all team */],
  "continueOnError": true,
  "maxConcurrency": 5
}
```
*Focus on team metrics for dashboard visualization*

## Troubleshooting

| Issue | Solution |
|-------|----------|
| All analyses fail | Check ADO connectivity, verify project/area path config |
| Some analyses fail | Review individual error messages in results array |
| Slow performance | Increase maxConcurrency (if API load allows) |
| Rate limit errors | Decrease maxConcurrency to 2-3 |

## Related Tools

- `analyze-workload` - Single person analysis with same features
- `discover-tools` - Find the right tool for your task




