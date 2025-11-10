# AI-Powered Query Handle Analysis

**Feature Name:** `analyze-query-handle`  
**Category:** AI Analysis  
**Status:** ✅ Implemented  
**Version:** 1.6  
**Last Updated:** 2025-11-07

## Overview

The `analyze-query-handle` tool provides AI-powered intelligent analysis of work items from a query handle using natural language intent. Unlike deterministic analysis tools, this tool leverages AI to understand context and provide insights for complex scenarios that require intelligence rather than simple rule-based checks.

## Purpose

This tool addresses the need for flexible, intelligent analysis of work items based on user-specified intent. It consolidates the capability to perform any type of analysis by accepting natural language descriptions of what you want to learn or accomplish, then applying AI reasoning to provide actionable insights.

## Key Features

### Natural Language Intent
- Accepts any analysis request in plain English
- No need to know specific analysis types or categories
- AI interprets intent and applies appropriate analysis approach

### Full Context Retrieval
- Fetches complete work item data from Azure DevOps
- Configurable context depth (basic, standard, deep)
- Includes fields, relations, history based on depth setting

### Flexible Output Formats
- **Concise** (default): Brief, actionable 3-5 bullet points
- **Detailed**: Structured analysis with sections and reasoning
- **JSON**: Machine-readable structured data with metrics

### Query Handle Pattern
- Prevents ID hallucination by using query handles
- Safe bulk analysis without exposing raw IDs to LLM
- Integrates with existing query handle ecosystem

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryHandle` | string | ✅ | - | Query handle containing work items to analyze |
| `intent` | string | ✅ | - | Natural language description of desired analysis |
| `itemSelector` | 'all' \| number[] \| object | ❌ | 'all' | Which items to analyze from the query handle |
| `maxItemsToAnalyze` | number | ❌ | 50 | Maximum items to analyze (1-100) |
| `includeContextPackages` | boolean | ❌ | true | Retrieve full context for deeper analysis |
| `contextDepth` | enum | ❌ | 'standard' | Context detail level: basic, standard, deep |
| `outputFormat` | enum | ❌ | 'concise' | Output format: concise, detailed, json |
| `confidenceThreshold` | number | ❌ | 0.0 | Min confidence for recommendations (0-1) |
| `temperature` | number | ❌ | 0.3 | AI temperature for analysis (0-2) |
| `organization` | string | ❌ | config | Azure DevOps organization |
| `project` | string | ❌ | config | Azure DevOps project |

### Context Depth Options

- **basic**: Work item fields only (id, title, type, state, assignedTo, priority, storyPoints, tags, description, dates)
- **standard** (default): Basic fields + area path, iteration path
- **deep**: Standard fields + history, comment count

### Output Format Options

- **concise** (default): 200-400 words, 3-5 bullet points, most important insights
- **detailed**: 400-800 words, structured sections, detailed reasoning and recommendations
- **json**: Structured data with summary, findings array, recommendations array, metrics object, confidence score

## Output Structure

### Concise Format (Default)
```
**Analysis: <intent summary>**

• Finding 1 with specific work item IDs
• Finding 2 with actionable recommendations
• Finding 3 with confidence indicators
```

### Detailed Format
```
**Analysis: <intent summary>**

## Summary
High-level overview of findings

## Key Findings
Detailed observations with work item IDs

## Recommendations
1. Action 1 with rationale
2. Action 2 with priority
3. Action 3 with expected impact
```

### JSON Format
```json
{
  "summary": "Brief overview (1-2 sentences)",
  "findings": [
    {
      "category": "finding_category",
      "description": "What was found",
      "workItemIds": [12345, 12346],
      "severity": "info|warning|high|critical"
    }
  ],
  "recommendations": [
    {
      "action": "What to do",
      "priority": "low|medium|high|critical",
      "confidence": 0.95,
      "workItemIds": [12345]
    }
  ],
  "metrics": {
    "totalAnalyzed": 50,
    "customMetric1": 10,
    "customMetric2": 0.75
  },
  "confidence": 0.92
}
```

## Use Cases

### Deployment Readiness
```typescript
{
  queryHandle: "qh_sprint_items",
  intent: "find work items that are ready for deployment to production"
}
```

### Technical Debt Assessment
```typescript
{
  queryHandle: "qh_all_tasks",
  intent: "identify technical debt items and prioritize by risk",
  outputFormat: "detailed"
}
```

### AI Assignment Screening
```typescript
{
  queryHandle: "qh_backlog",
  intent: "assess which items are suitable for GitHub Copilot assignment",
  maxItemsToAnalyze: 30
}
```

### Missing Information Detection
```typescript
{
  queryHandle: "qh_features",
  intent: "identify work items with insufficient detail or missing acceptance criteria"
}
```

### Release Blocker Identification
```typescript
{
  queryHandle: "qh_release_candidates",
  intent: "find blockers preventing release and suggest mitigation",
  outputFormat: "json"
}
```

### Sprint Capacity Planning
```typescript
{
  queryHandle: "qh_proposed_sprint",
  intent: "analyze sprint capacity and identify overcommitment risks",
  contextDepth: "deep"
}
```

## Analysis Capabilities

The AI can perform various types of analysis based on intent:

### Readiness Assessment
- Deployment readiness
- AI assignment suitability
- Release readiness
- Sprint planning readiness

### Quality Analysis
- Technical debt identification
- Documentation completeness
- Test coverage gaps
- Code review status

### Risk Identification
- Blockers and dependencies
- Stale or abandoned work
- Under-estimated items
- Overdue items

### Team Analysis
- Workload distribution
- Assignment gaps
- Skill matching
- Collaboration patterns

### Planning Support
- Sprint capacity planning
- Priority recommendations
- Parent-child relationship issues
- Backlog health assessment

## Error Handling

### Query Handle Not Found
```json
{
  "success": false,
  "errors": ["Query handle 'qh_xyz' not found or expired. Query handles expire after 24 hours."]
}
```

### No Work Items
```json
{
  "success": false,
  "errors": ["No work items found in query handle"]
}
```

### Sampling Not Available
```json
{
  "success": false,
  "errors": ["This tool requires VS Code sampling support. Ensure you are using this MCP server within VS Code with language model access enabled."]
}
```

### Analysis Timeout
```json
{
  "success": false,
  "errors": ["AI query analysis exceeded 120 second timeout. The AI model may be overloaded. Try again with fewer items or simpler intent."]
}
```

## Performance Considerations

### Token Efficiency
- Concise format: ~800 max tokens
- Detailed format: ~1200 max tokens
- JSON format: ~1500 max tokens

### Analysis Limits
- Default max items: 50
- Hard limit: 100 items per analysis
- Timeout: 120 seconds

### Context Depth Impact
- **basic**: Minimal token usage, fastest
- **standard**: Moderate tokens, good balance
- **deep**: High token usage, slowest but most comprehensive

## Best Practices

### Writing Effective Intents

✅ **Good:**
- "find work items ready for deployment to production"
- "identify technical debt risks in order of priority"
- "assess which items need more detail before sprint planning"

❌ **Avoid:**
- "analyze items" (too vague)
- "do something with bugs" (unclear intent)
- "check everything" (not actionable)

### Choosing Output Format

- **concise**: Quick insights, daily standup summaries, rapid triage
- **detailed**: Sprint planning, release assessments, team reviews
- **json**: Automation, dashboards, integration with other tools

### Optimizing Performance

1. Use `maxItemsToAnalyze` to limit scope for faster results
2. Choose `contextDepth: 'basic'` when full context isn't needed
3. Use `concise` format when possible to reduce token usage
4. Set `confidenceThreshold` > 0 to filter low-confidence recommendations

## Integration with Existing Tools

### Works With
- All WIQL query tools (creates query handles)
- `inspect-handle` (view what will be analyzed)
- `get-context-bulk` (deep context retrieval)
- `execute-bulk-operations` (act on findings)

### Complements
- `analyze-bulk` (deterministic rule-based analysis)
- `analyze-workitem` (single item detailed analysis)
- `analyze-assignment` (AI assignment suitability check)

## Requirements

- VS Code with GitHub Copilot
- Azure CLI logged in
- Valid query handle (created by WIQL query)
- Language model access enabled

## Limitations

- Maximum 100 items per analysis
- 2-minute timeout for analysis
- Requires VS Code sampling support (not available in CLI)
- Query handles expire after 24 hours
- AI responses may vary slightly between runs

## Examples

### Example 1: Deployment Readiness Check

**Input:**
```typescript
{
  queryHandle: "qh_sprint_23",
  intent: "find work items ready for deployment",
  outputFormat: "concise"
}
```

**Output:**
```
**Analysis: Deployment Readiness**

• **5 items ready**: Tasks #12345, #12346, #12349, #12350, #12352 have completed testing and code review
• **2 blockers**: Bug #12347 (critical auth issue), Feature #12351 (awaiting security approval)
• **Recommendation**: Deploy the 5 ready items immediately, prioritize bug #12347 before next deployment
```

### Example 2: Technical Debt Assessment

**Input:**
```typescript
{
  queryHandle: "qh_all_code_tasks",
  intent: "identify and prioritize technical debt",
  outputFormat: "detailed",
  maxItemsToAnalyze: 30
}
```

**Output:**
```
**Analysis: Technical Debt Assessment**

## Summary
Analyzed 30 code tasks for technical debt indicators. Found 8 high-priority debt items, 12 medium, 10 low.

## High-Priority Technical Debt (8 items)
- Task #11234 "Refactor authentication module" - Blocking new features, affects 5+ components
- Task #11235 "Remove deprecated API endpoints" - Security risk, external dependencies
- Task #11240 "Update test coverage" - Current coverage 42%, target 80%

## Medium-Priority Technical Debt (12 items)
- Task #11250 "Modernize build pipeline" - Slowing CI/CD by 15 minutes
- Task #11255 "Document microservices architecture" - Onboarding friction
...

## Recommendations
1. **Immediate action**: Address authentication refactor (#11234) - blocks 3 planned features
2. **Security sprint**: Allocate 1 sprint to deprecated APIs (#11235) and test coverage (#11240)
3. **Ongoing**: Dedicate 20% of each sprint to medium-priority debt items
```

### Example 3: AI Assignment Screening (JSON)

**Input:**
```typescript
{
  queryHandle: "qh_backlog_items",
  intent: "assess suitability for GitHub Copilot assignment",
  outputFormat: "json",
  maxItemsToAnalyze: 20
}
```

**Output:**
```json
{
  "summary": "Analyzed 20 backlog items for AI assignment suitability. 7 suitable, 13 require human expertise.",
  "findings": [
    {
      "category": "suitable_for_ai",
      "description": "Well-defined tasks with clear acceptance criteria and technical specifications",
      "workItemIds": [15001, 15003, 15005, 15009, 15012, 15018, 15020],
      "severity": "info"
    },
    {
      "category": "requires_human",
      "description": "Items requiring architectural decisions or unclear requirements",
      "workItemIds": [15002, 15004, 15006, 15007, 15008, 15010, 15011, 15013, 15014, 15015, 15016, 15017, 15019],
      "severity": "warning"
    }
  ],
  "recommendations": [
    {
      "action": "Assign to GitHub Copilot immediately",
      "priority": "high",
      "confidence": 0.92,
      "workItemIds": [15001, 15003, 15005, 15009, 15012, 15018, 15020]
    },
    {
      "action": "Refine requirements before AI assignment",
      "priority": "medium",
      "confidence": 0.88,
      "workItemIds": [15002, 15010, 15014]
    }
  ],
  "metrics": {
    "totalAnalyzed": 20,
    "suitableForAI": 7,
    "requiresHuman": 13,
    "aiReadinessRate": 0.35
  },
  "confidence": 0.90
}
```

## Changelog

### Version 1.6 (2025-11-07)
- Initial implementation
- Natural language intent parameter
- Configurable context depth
- Three output formats (concise, detailed, json)
- Confidence filtering
- Query handle integration
- VS Code sampling support

---

**Related Documentation:**
- [AI Intelligence Tools](./AI_INTELLIGENCE_TOOLS.md)
- [Query Handle Pattern](./ENHANCED_QUERY_HANDLE_PATTERN.md)
- [Query Tools](./QUERY_TOOLS.md)
