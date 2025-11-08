# Tool Discovery Guide

## Overview

The `discover-tools` tool helps you find the right MCP server tools for your task. It can:
1. **List all tools** - Get a concise inventory of available tools
2. **AI-powered recommendations** - Analyze your intent and recommend the best tools

## When to Use

Use tool discovery when:
- You want to see all available tools (`listAll: true`)
- You're not sure which tool to use for a task
- You need workflow guidance (multiple tools in sequence)
- You're new to the MCP server

## Basic Usage

### List All Tools
```json
{
  "listAll": true
}
```

**Returns**: Concise list of all tools with names, descriptions, categories, and parameters.

### AI-Powered Recommendations
```json
{
  "intent": "I want to find all bugs assigned to me"
}
```

**Returns**: Top 3 tool recommendations with confidence scores and brief reasoning.

## Parameters

### Mode Selection (choose one)
- **listAll** (boolean): List all tools without AI analysis (default false)
- **intent** (string): Natural language description for AI-powered recommendations

### Optional (applies to both modes)
- **filterCategory** (enum): Filter to specific category
  - `creation` - Create/new work items
  - `analysis` - Analyze/detect/validate
  - `bulk-operations` - Bulk updates
  - `query` - WIQL/OData queries
  - `ai-powered` - AI-enhanced tools
  - `all` - No filter (default)

### Optional (AI mode only)
- **context** (string): Additional details about your project
- **maxRecommendations** (number): How many tools to recommend (1-10, default 3)
- **includeExamples** (boolean): Include usage examples (default false, saves tokens)

## Examples

### Example 1: List All Tools
```json
{
  "listAll": true
}
```

**Result**: Returns all 25+ tools with names, descriptions, categories, and parameters.

### Example 2: List Tools by Category
```json
{
  "listAll": true,
  "filterCategory": "bulk-operations"
}
```

**Result**: Returns only bulk operation tools.

### Example 3: Simple Query Recommendation
```json
{
  "intent": "Find all active bugs in my area"
}
```

**Result**: Recommends `query-wiql` with brief reasoning.

### Example 4: Bulk Operations Workflow
```json
{
  "intent": "I need to update the priority on 50 work items",
  "context": "Items are stale and need attention"
}
```

**Result**: Recommends workflow:
1. `query-wiql` (with returnQueryHandle=true)
2. `execute-bulk-operations` (with dryRun first)

### Example 5: With Examples Enabled
```json
{
  "intent": "Analyze a work item for AI assignment",
  "includeExamples": true
}
```

**Result**: Includes detailed usage examples (uses more tokens).

## Understanding Results

### List All Mode Response
```json
{
  "tools": [
    {
      "name": "create-workitem",
      "description": "Create a single work item...",
      "category": "creation",
      "requiredParams": ["title"],
      "optionalParams": ["description", "workItemType", "tags"]
    }
  ],
  "totalTools": 27,
  "filterCategory": "all"
}
```

### AI Recommendations Mode Response
```json
{
  "recommendations": [
    {
      "toolName": "create-workitem",
      "confidence": 95,
      "reasoning": "Direct match for single item creation",
      "requiredParameters": ["title"],
      "optionalParameters": ["description", "tags"]
    }
  ],
  "alternativeApproaches": [
    "Use create-workitem for basic creation, then assign-copilot if assigning to Copilot separately"
  ],
  "warnings": []
}
```

### Confidence Scores (AI mode only)
- **90-100**: Perfect match
- **70-89**: Strong match
- **50-69**: Good match with minor gaps
- **30-49**: Possible but not ideal
- **0-29**: Weak match

## Tips

1. **Start with listAll**: Use `listAll: true` to see what's available
2. **Be Specific**: "Find stale bugs" is better than "find items"
3. **Provide Context**: Mention your goal or constraints (AI mode)
4. **Use Filters**: Narrow by category to reduce noise
5. **Save Tokens**: Keep `includeExamples: false` (default) unless you need detailed examples
6. **Follow Workflows**: Multi-step recommendations are in order

## Verbosity Control

**Concise by default**: Responses are now brief and focused
- **Reasoning**: 1-2 sentences max
- **Warnings**: Only critical issues (destructive ops, missing requirements)
- **Alternatives**: 2-3 most relevant options only

**To get more detail**:
- Set `includeExamples: true` for usage examples
- Set `maxRecommendations: 5-10` for more options

## Common Patterns

### Creating Items
- Single: `create-workitem`
- Basic: `create-workitem`

### Querying
- Known query: `query-wiql`
- Natural language: `wit-generate-wiql-query` → execute

### Bulk Operations
Always: Query → Inspect → Bulk (dryRun) → Bulk (apply)

### Analysis
- Single item: `get-context`
- AI suitability: `analyze-workload-analyzer`
- Multiple items: `analyze-query-handle`

## Requirements

- **List All Mode**: No special requirements, works offline
- **AI Mode**: Requires VS Code language model access
- **Fallback**: Keyword matching if AI unavailable (AI mode only)

## Related Tools

- `get-config`: View server setup and configured tools
- Resource: `tool-selection-guide.md` for manual reference




