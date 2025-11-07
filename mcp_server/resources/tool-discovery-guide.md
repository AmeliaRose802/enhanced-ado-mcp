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

**Result**: Recommends `wit-wiql-query`

### Example 2: Bulk Operations
```json
{
  "intent": "I need to update the priority on 50 work items",
  "context": "Items are stale and need attention"
}
```

**Result**: Recommends workflow:
1. `wit-wiql-query` (with returnQueryHandle=true)
2. `wit-query-handle-info` (preview and validate)
3. `wit-bulk-update-by-query-handle` (dryRun first)

### Example 3: Analysis Focus
```json
{
  "intent": "Analyze a work item to see if it's suitable for AI",
  "filterCategory": "analysis"
}
```

**Result**: Recommends `wit-ai-assignment-analyzer-analyzer`

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
    "Consider using wit-get-configurationuration first to see defaults"
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
- AI suitability: `wit-ai-assignment-analyzer-analyzer`
- Multiple items: `wit-analyze-by-query-handle`

## Fallback Behavior

If AI sampling is unavailable, tool discovery uses keyword matching:
- Lower confidence scores
- Basic recommendations
- Limited workflow guidance

## Requirements

- **AI Sampling**: Requires VS Code language model access
- **Fallback**: Keyword matching if AI unavailable

## Related Tools

- `wit-get-configurationuration`: View server setup
- Resource: `tool-selection-guide.md` for manual reference
