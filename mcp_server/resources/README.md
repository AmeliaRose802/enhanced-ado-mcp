# MCP Resources

This directory contains focused documentation resources exposed via the Model Context Protocol (MCP) to help AI agents understand and use the Enhanced ADO MCP Server effectively.

## Overview

These resources provide tight, focused documentation with:
- ✅ Common query patterns and examples
- ✅ Tool selection guidance
- ✅ End-to-end workflow examples
- ✅ Best practices and anti-patterns

## Available Resources

### 1. WIQL Quick Reference (`wiql-quick-reference.md`)
**URI:** `ado://docs/wiql-quick-reference`

Essential WIQL (Work Item Query Language) patterns for Azure DevOps:
- Basic query patterns (by area, parent, type, state)
- Finding issues (orphans, missing descriptions)
- Hierarchical queries
- Common pitfalls and solutions

**Use when:** Agent needs to query work items using WIQL

### 2. OData Quick Reference (`odata-quick-reference.md`)
**URI:** `ado://docs/odata-quick-reference`

OData Analytics query examples for metrics and aggregations:
- Query types (count, groupBy, velocity, cycle time)
- Date range filtering
- Performance tips
- Common use cases

**Use when:** Agent needs metrics, counts, or aggregations

### 3. Hierarchy Query Patterns (`hierarchy-patterns.md`)
**URI:** `ado://docs/hierarchy-patterns`

Patterns for building and querying work item hierarchies:
- Level-by-level traversal strategy
- Parent-child relationships
- Using context packages
- Finding hierarchy issues
- Validation rules

**Use when:** Agent needs to work with parent-child relationships

### 4. Common Workflow Examples (`common-workflows.md`)
**URI:** `ado://docs/common-workflows`

End-to-end workflows combining multiple tools:
- Feature decomposition
- Backlog cleanup
- Sprint planning
- Quality improvement
- AI-first development

**Use when:** Agent needs to understand multi-step workflows

### 5. Tool Selection Guide (`tool-selection-guide.md`)
**URI:** `ado://docs/tool-selection-guide`

Decision guide for choosing the right tool:
- Query vs metrics tools
- Single vs batch operations
- AI-powered analysis tools
- Bulk operations
- Performance considerations

**Use when:** Agent is unsure which tool to use

### 6. Query Handle Pattern (`query-handle-pattern.md`)
**URI:** `ado://docs/query-handle-pattern`

Anti-hallucination architecture for bulk operations:
- Why query handles eliminate ID hallucination
- How to use query handles
- Complete workflow examples
- Best practices and safety features
- Troubleshooting

**Use when:** Agent needs to perform bulk operations on multiple work items

### 7. Bulk Intelligent Enhancement Guide (`bulk-intelligent-enhancement-guide.md`)
**URI:** `ado://docs/bulk-intelligent-enhancement-guide`

AI-powered bulk enhancement tools for work items:
- Bulk description enhancement (detailed, concise, technical, business styles)
- Bulk story point estimation (fibonacci, linear, t-shirt scales)
- Bulk acceptance criteria generation (gherkin, checklist, user-story formats)
- Complete workflow patterns
- Safety features and best practices
- Performance considerations and troubleshooting

**Use when:** Agent needs to enhance multiple work items with AI-generated content (descriptions, estimates, acceptance criteria)

## How Agents Access Resources

### List Available Resources
```typescript
// MCP Protocol: resources/list
const resources = await mcp.listResources();
```

Returns:
```json
{
  "resources": [
    {
      "uri": "ado://docs/wiql-quick-reference",
      "name": "WIQL Quick Reference",
      "description": "Common WIQL query patterns...",
      "mimeType": "text/markdown"
    },
    // ... more resources
  ]
}
```

### Read Resource Content
```typescript
// MCP Protocol: resources/read
const content = await mcp.readResource("ado://docs/wiql-quick-reference");
```

Returns:
```json
{
  "contents": [
    {
      "uri": "ado://docs/wiql-quick-reference",
      "mimeType": "text/markdown",
      "text": "# WIQL Quick Reference\n\n..."
    }
  ]
}
```

## Design Principles

### 1. Focused and Concise
- Each resource covers ONE specific topic
- No redundant information
- Quick to read and reference

### 2. Example-Driven
- Real, working code examples
- Common patterns first
- Anti-patterns clearly marked

### 3. Agent-Friendly
- Clear structure with headers
- Markdown formatting
- Searchable content
- JSON examples for tool inputs

### 4. Actionable
- Every example is ready to use
- No placeholders or "fill in the blank"
- Specific field names and values

## When to Use Resources vs Prompts

### Use Resources when:
- ✅ Agent needs reference documentation
- ✅ Quick lookup of query patterns
- ✅ Tool selection guidance
- ✅ No analysis required - just information

### Use Prompts when:
- ✅ Agent needs AI-powered analysis
- ✅ Complex decision making required
- ✅ Generating recommendations
- ✅ Work item enhancement

## Updating Resources

When updating resources:
1. Keep them focused and concise
2. Use real, tested examples
3. Update version in `package.json` if significant changes
4. Run tests: `npm test -- resource-service.test`
5. Build: `npm run build`

## File Structure

```
resources/
├── README.md (this file)
├── wiql-quick-reference.md
├── odata-quick-reference.md
├── hierarchy-patterns.md
├── common-workflows.md
├── tool-selection-guide.md
├── query-handle-pattern.md
├── bulk-intelligent-enhancement-guide.md
└── ... (other guides)
```

## Benefits for AI Agents

1. **Reduced Context Size**: Tight, focused docs vs full documentation
2. **Faster Lookups**: Specific patterns without searching
3. **Better Tool Selection**: Clear guidance on which tool to use
4. **Fewer Errors**: Working examples reduce trial-and-error
5. **Consistent Patterns**: Standardized approaches to common tasks

## Integration

Resources are automatically loaded and exposed by the MCP server:
- Service: `src/services/resource-service.ts`
- Handler: `src/index.ts` (resources/list, resources/read)
- Tests: `src/test/resource-service.test.ts`

No configuration needed - resources are available immediately upon server start.
