# Tool Discovery Guide

## Overview

The `wit-discover-tools` tool uses AI to help you find the right MCP server tools for your task. Instead of searching through documentation, just describe what you want to accomplish in natural language.

## When to Use

Use tool discovery when:
- You're not sure which tool to use for a task
- You want to explore available capabilities
- You need workflow guidance (multiple tools in sequence)
- You're new to the MCP server

## Basic Usage

```json
{
  "intent": "I want to find all bugs assigned to me"
}
```

**Returns**: Top 3 tool recommendations with confidence scores, reasoning, and usage examples.

## Parameters

### Required
- **intent** (string): Natural language description of what you want to accomplish

### Optional
- **context** (string): Additional details about your project, team, or requirements
- **maxRecommendations** (number): How many tools to recommend (1-10, default 3)
- **includeExamples** (boolean): Include usage examples (default true)
- **filterCategory** (enum): Filter to specific category
  - `creation` - Create/new work items
  - `analysis` - Analyze/detect/validate
  - `bulk-operations` - Bulk updates
  - `query` - WIQL/OData queries
  - `ai-powered` - AI-enhanced tools
  - `all` - No filter (default)

## Examples

### Example 1: Simple Query
```json
{
  "intent": "Find all active bugs in my area"
}
```

**Result**: Recommends `wit-get-work-items-by-query-wiql` or `wit-generate-wiql-query`

### Example 2: Bulk Operations
```json
{
  "intent": "I need to update the priority on 50 work items",
  "context": "Items are stale and need attention"
}
```

**Result**: Recommends workflow:
1. `wit-get-work-items-by-query-wiql` (with returnQueryHandle=true)
2. `wit-inspect-query-handle` (preview)
3. `wit-bulk-update-by-query-handle` (dryRun first)

### Example 3: Analysis Focus
```json
{
  "intent": "Analyze a work item to see if it's suitable for AI",
  "filterCategory": "analysis"
}
```

**Result**: Recommends `wit-ai-assignment-analyzer`

### Example 4: Complex Workflow
```json
{
  "intent": "Improve descriptions for all items in my backlog that are missing details",
  "context": "Sprint planning next week, need better documentation",
  "maxRecommendations": 5
}
```

**Result**: Full workflow with AI enhancement tools

## Understanding Results

### Confidence Scores
- **90-100**: Perfect match, clear intent
- **70-89**: Strong match, minor questions
- **50-69**: Good match, some ambiguity
- **30-49**: Possible match, gaps exist
- **0-29**: Weak match

### Response Structure
```json
{
  "recommendations": [
    {
      "toolName": "wit-create-new-item",
      "confidence": 95,
      "reasoning": "Direct match for creating single work item...",
      "exampleUsage": "wit-create-new-item with { title: '...', description: '...' }",
      "requiredParameters": ["title"],
      "optionalParameters": ["description", "parentWorkItemId", "tags"]
    }
  ],
  "alternativeApproaches": [
    "If you need to assign immediately, use wit-new-copilot-item"
  ],
  "warnings": [
    "Consider using wit-get-configuration first to see defaults"
  ]
}
```

## Tips

1. **Be Specific**: "Find stale bugs" is better than "find items"
2. **Provide Context**: Mention your goal or constraints
3. **Use Filters**: Narrow by category if you know the type
4. **Read Warnings**: Pay attention to bulk operation warnings
5. **Follow Workflows**: Multi-step recommendations are in order

## Common Patterns

### Creating Items
- Single: `wit-create-new-item`
- With assignment: `wit-new-copilot-item`

### Querying
- Known query: `wit-get-work-items-by-query-wiql`
- Natural language: `wit-generate-wiql-query` → execute

### Bulk Operations
Always: Query → Inspect → Bulk (dryRun) → Bulk (apply)

### Analysis
- Single item: `wit-get-work-item-context-package`
- AI suitability: `wit-ai-assignment-analyzer`
- Multiple items: `wit-analyze-by-query-handle`

## Fallback Behavior

If AI sampling is unavailable, tool discovery uses keyword matching:
- Lower confidence scores
- Basic recommendations
- Limited workflow guidance

## Requirements

- **AI Sampling**: Requires VS Code language model access
- **Fallback**: Keyword matching if AI unavailable

## AI vs Deterministic Tools

### When to Choose AI-Powered vs Rule-Based Tools

The Enhanced ADO MCP Server offers both **AI-powered** and **deterministic (rule-based)** tools. Understanding when to use each type is critical for optimal performance, cost-effectiveness, and accuracy.

### Decision Matrix

```
Need to build a query from description?
├─ Complex query with natural language → AI Tool (wit-ai-generate-wiql/odata)
│   • Cost: Moderate (LLM tokens)
│   • Speed: 2-5 seconds
│   • Accuracy: 85-95%
│   • When: "Find all stale bugs assigned to inactive users"
│
└─ Simple/known query syntax → Deterministic Tool (wit-get-work-items-by-query-wiql)
    • Cost: Free (no LLM)
    • Speed: <1 second
    • Accuracy: 100% (if query is correct)
    • When: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"

Need to analyze work items?
├─ Subjective/complex analysis → AI Tool (wit-ai-assignment-analyzer)
│   • Cost: Moderate to High
│   • Speed: 3-8 seconds per item
│   • Accuracy: 80-90%
│   • When: "Is this suitable for GitHub Copilot?"
│
└─ Objective validation → Deterministic Tool (wit-validate-hierarchy)
    • Cost: Free
    • Speed: <1 second
    • Accuracy: 100%
    • When: "Check parent-child relationship validity"

Need to update work items?
├─ Custom content generation → AI Tool (wit-bulk-enhance-descriptions)
│   • Cost: High (per item)
│   • Speed: 2-5 seconds per item
│   • Accuracy: Variable (requires review)
│   • When: "Improve descriptions with technical details"
│
└─ Fixed/template updates → Deterministic Tool (wit-bulk-update-by-query-handle)
    • Cost: Free
    • Speed: <1 second total
    • Accuracy: 100%
    • When: "Set all items to Priority 2"
```

### Tool Comparison Examples

#### Query Generation: AI vs Deterministic

**AI Tool: `wit-ai-generate-wiql`**
- **Use When:**
  - Complex natural language query ("stale bugs not updated in 30 days")
  - Don't know exact WIQL syntax
  - Multiple conditions with date arithmetic
  - Custom field queries with unclear reference names
- **Tradeoffs:**
  - ✅ No WIQL knowledge required
  - ✅ Handles complex descriptions
  - ✅ Auto-validates and refines
  - ❌ 2-5 second latency
  - ❌ 85-95% accuracy (may require iteration)
  - ❌ Uses LLM tokens (VS Code quota)
- **Example:**
  ```json
  {
    "description": "all active bugs in Engineering area assigned to inactive users from last 90 days",
    "testQuery": true
  }
  ```

**Deterministic Tool: `wit-get-work-items-by-query-wiql`**
- **Use When:**
  - You know exact WIQL syntax
  - Simple state/type filters
  - Need guaranteed query format
  - Want fastest possible execution
- **Tradeoffs:**
  - ✅ Instant execution (<1s)
  - ✅ 100% deterministic
  - ✅ No token cost
  - ❌ Requires WIQL knowledge
  - ❌ Manual syntax debugging
- **Example:**
  ```json
  {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active'"
  }
  ```

#### Analysis: AI vs Deterministic

**AI Tool: `wit-ai-assignment-analyzer`**
- **Use When:**
  - Subjective evaluation ("Is this suitable for AI?")
  - Need confidence scores
  - Context-based recommendations
  - Quality assessment
- **Tradeoffs:**
  - ✅ Intelligent context analysis
  - ✅ Reasoning provided
  - ✅ Confidence scoring
  - ❌ 3-8 seconds per item
  - ❌ 80-90% accuracy
  - ❌ Moderate token cost
  - ❌ Requires VS Code Language Model API
- **Example:**
  ```json
  {
    "workItemId": 12345
  }
  ```

**Deterministic Tool: `wit-validate-hierarchy`**
- **Use When:**
  - Objective validation (types, states, relationships)
  - Fast batch validation
  - 100% accuracy required
  - Pattern detection
- **Tradeoffs:**
  - ✅ Instant results
  - ✅ 100% rule-based accuracy
  - ✅ No token cost
  - ✅ Works offline
  - ❌ Limited to predefined rules
  - ❌ No subjective assessment
- **Example:**
  ```json
  {
    "workItemIds": [100, 101, 102]
  }
  ```

#### Bulk Enhancement: AI vs Deterministic

**AI Tool: `wit-bulk-enhance-descriptions`**
- **Use When:**
  - Need rich, contextual content
  - Generating unique descriptions per item
  - Story point estimation
  - Acceptance criteria generation
- **Tradeoffs:**
  - ✅ High-quality, contextual content
  - ✅ Adapts to each work item
  - ✅ Multiple style options
  - ❌ 2-5 seconds per item (slow for large batches)
  - ❌ High token cost (50-100 items max)
  - ❌ Requires review for accuracy
  - ❌ Requires VS Code Language Model API
- **Example:**
  ```json
  {
    "queryHandle": "qh_abc123",
    "enhancementStyle": "technical",
    "sampleSize": 10
  }
  ```

**Deterministic Tool: `wit-bulk-update-by-query-handle`**
- **Use When:**
  - Template-based updates
  - Fixed values across items
  - State transitions
  - Tag/priority changes
- **Tradeoffs:**
  - ✅ Instant execution (all items at once)
  - ✅ 100% consistent
  - ✅ No token cost
  - ✅ Safe dry-run mode
  - ❌ Fixed content only
  - ❌ No context awareness
- **Example:**
  ```json
  {
    "queryHandle": "qh_abc123",
    "updateFields": [
      { "field": "System.Tags", "value": "needs-review" }
    ]
  }
  ```

### Cost/Speed/Accuracy Tradeoffs

| Factor | AI Tools | Deterministic Tools |
|--------|----------|-------------------|
| **Speed** | 2-8 seconds per operation | <1 second |
| **Cost** | Moderate-High (LLM tokens) | Free |
| **Accuracy** | 80-95% (requires review) | 100% (rule-based) |
| **Context Awareness** | High (understands nuance) | None (literal only) |
| **Flexibility** | Very High | Limited to rules |
| **Determinism** | Low (may vary) | Perfect |
| **Offline Use** | No (requires VS Code API) | Yes |
| **Batch Size** | 10-100 items | Unlimited |
| **Setup Required** | VS Code Language Model API | None |

### Best Practices

#### Use AI Tools When:
1. **Natural Language Input** - User provides descriptions, not syntax
2. **Subjective Analysis** - "Should this be assigned to AI?"
3. **Content Generation** - Creating unique descriptions, criteria
4. **Complex Queries** - Multi-condition with date math
5. **Quality Assessment** - Evaluating completeness, suitability

#### Use Deterministic Tools When:
1. **Known Syntax** - You already know the exact query/update
2. **Objective Validation** - Rule-based checks (types, states)
3. **Bulk Operations** - Fixed updates to many items
4. **Speed Critical** - Need instant results
5. **Cost Sensitive** - Avoiding LLM token usage
6. **100% Accuracy Required** - No tolerance for variance

#### Hybrid Approach (Recommended):
Many workflows benefit from combining both:

**Example: Intelligent Bulk Update**
1. **AI Tool**: `wit-ai-generate-wiql` - Build complex query from description
2. **Deterministic**: `wit-get-work-items-by-query-wiql` - Execute with handle
3. **Deterministic**: `wit-query-handle-select` - Preview selection
4. **AI Tool**: `wit-bulk-enhance-descriptions` - Improve subset (10 items)
5. **Deterministic**: `wit-bulk-update-by-query-handle` - Apply fixed tags to all

This maximizes AI value while minimizing cost and latency.

### Performance Expectations

**AI Tools:**
- Single item analysis: 3-8 seconds
- Query generation: 2-5 seconds (with validation)
- Bulk enhancement (10 items): 30-60 seconds
- Bulk enhancement (50 items): 3-5 minutes

**Deterministic Tools:**
- Single query: <1 second
- Bulk update (100 items): 1-2 seconds
- Validation (50 items): <1 second
- Pattern detection: 1-3 seconds

### Rate Limits and Quotas

**AI Tools:**
- Subject to VS Code Language Model API limits
- Typically: 10-20 requests per minute
- May throttle on heavy usage
- Check VS Code settings for quota

**Deterministic Tools:**
- Subject to Azure DevOps API limits only
- 200 requests per minute per user
- No LLM quotas
- Higher throughput capability

## Related Tools

- `wit-get-configuration`: View server setup
- Resource: `tool-selection-guide.md` for manual reference
- Resource: `tool-limitations.md` for detailed constraints
