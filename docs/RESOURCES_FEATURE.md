# MCP Resources Feature

## Overview

The Enhanced ADO MCP Server exposes documentation resources via the Model Context Protocol (MCP) `resources` capability. This feature provides AI agents with focused, query-ready documentation without requiring prompts or AI analysis.

## What Are MCP Resources?

MCP Resources are static content (documentation, examples, references) that can be:
- Listed by AI agents to discover available documentation
- Read on-demand when needed
- Used for quick lookups and reference
- Cached by clients for performance

## Why Resources Instead of Prompts?

| Feature | Resources | Prompts |
|---------|-----------|---------|
| **Purpose** | Reference documentation | AI-powered analysis |
| **Cost** | Free (no LLM calls) | Uses LLM tokens |
| **Speed** | Instant | 5-10 seconds |
| **Content** | Static examples & patterns | Dynamic analysis |
| **Best For** | Quick lookups, examples | Complex decision-making |

## Available Resources

### 1. WIQL Quick Reference
**URI:** `ado://docs/wiql-quick-reference`

Essential WIQL query patterns:
- Basic queries (by area, parent, type, state)
- Finding issues (orphans, missing descriptions)
- Hierarchical queries
- Common pitfalls

**Example Content:**
```sql
-- Get children of a parent
SELECT [System.Id] FROM WorkItems 
WHERE [System.Parent] = 12345
ORDER BY [System.WorkItemType], [System.Title]
```

### 2. OData Quick Reference
**URI:** `ado://docs/odata-quick-reference`

OData Analytics patterns:
- Count and grouping queries
- Velocity metrics
- Cycle time analysis
- Date range filtering

**Example Content:**
```json
{
  "queryType": "groupByType",
  "filters": {"State": "Active"}
}
```

### 3. Hierarchy Query Patterns
**URI:** `ado://docs/hierarchy-patterns`

Work item hierarchy patterns:
- Level-by-level traversal
- Parent-child relationships
- Hierarchy validation
- Finding orphaned items

### 4. Common Workflow Examples
**URI:** `ado://docs/common-workflows`

End-to-end workflows:
- Feature decomposition
- Backlog cleanup
- Sprint planning
- Quality improvement

### 5. Tool Selection Guide
**URI:** `ado://docs/tool-selection-guide`

Decision guide:
- When to use WIQL vs OData
- Single vs batch operations
- AI-powered vs rule-based tools
- Performance considerations

## How Agents Access Resources

### MCP Protocol Methods

#### List Resources
```typescript
// Request
{
  "method": "resources/list"
}

// Response
{
  "resources": [
    {
      "uri": "ado://docs/wiql-quick-reference",
      "name": "WIQL Quick Reference",
      "description": "Common WIQL query patterns...",
      "mimeType": "text/markdown"
    }
    // ... more resources
  ]
}
```

#### Read Resource
```typescript
// Request
{
  "method": "resources/read",
  "params": {
    "uri": "ado://docs/wiql-quick-reference"
  }
}

// Response
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

## Use Cases

### 1. Agent Needs Query Example
**Without Resources:**
```
Agent: "I need to query work items by parent"
User: "Use WIQL with System.Parent field"
Agent: "What's the exact syntax?"
→ Multiple back-and-forth exchanges
```

**With Resources:**
```
Agent: Reads ado://docs/wiql-quick-reference
Agent: Finds exact pattern in "Get Children of a Parent" section
Agent: Uses pattern immediately
→ One-shot solution
```

### 2. Agent Chooses Wrong Tool
**Without Resources:**
```
Agent: Uses wit-get-work-items-by-query-wiql for counts
→ Fetches 1000 items unnecessarily
→ Wastes tokens and time
```

**With Resources:**
```
Agent: Reads ado://docs/tool-selection-guide
Agent: Sees "Use OData for counts/aggregations"
Agent: Uses wit-query-analytics-odata instead
→ Efficient server-side aggregation
```

### 3. Building Hierarchies
**Without Resources:**
```
Agent: Tries WorkItemLinks with ORDER BY
→ Gets 0 results (ORDER BY not supported)
→ Confused and retries multiple times
```

**With Resources:**
```
Agent: Reads ado://docs/hierarchy-patterns
Agent: Sees "WorkItemLinks queries do NOT support ORDER BY"
Agent: Uses level-by-level pattern instead
→ Works correctly first time
```

## Design Principles

### 1. Focused and Concise
- One topic per resource
- No redundancy
- Quick to scan

### 2. Example-Driven
- Real, working code
- No placeholders
- Copy-paste ready

### 3. Searchable Structure
- Clear headers
- Consistent formatting
- Semantic markup

### 4. Agent-Friendly
- Markdown format
- JSON examples
- Tool references

## Implementation

### Architecture

```
mcp_server/
├── src/
│   ├── services/
│   │   └── resource-service.ts    # Resource logic
│   ├── index.ts                    # Protocol handlers
│   └── test/
│       └── resource-service.test.ts
└── resources/
    ├── wiql-quick-reference.md
    ├── odata-quick-reference.md
    ├── hierarchy-patterns.md
    ├── common-workflows.md
    └── tool-selection-guide.md
```

### Server Capabilities

```typescript
const server = new Server({
  name: "enhanced-ado-mcp-server",
  version: "1.4.1"
}, {
  capabilities: {
    tools: {},
    prompts: {},
    resources: {},  // ← Resources capability
    sampling: {}
  }
});
```

### Request Handlers

```typescript
if (request.method === "resources/list") {
  const resources = listResources();
  return { resources };
}

if (request.method === "resources/read") {
  const { uri } = request.params || {};
  const content = await getResourceContent(uri);
  return {
    contents: [{
      uri: content.uri,
      mimeType: content.mimeType,
      text: content.text
    }]
  };
}
```

## Performance

### Metrics

- **List Resources:** < 1ms (in-memory)
- **Read Resource:** < 10ms (file system read)
- **Total Resources:** ~50KB markdown
- **No LLM Calls:** 0 tokens used

### Comparison

| Operation | Resource | Prompt | Savings |
|-----------|----------|--------|---------|
| Query example lookup | < 10ms | 5-10s | 500-1000x |
| Token usage | 0 | ~1000 | 100% |
| Context size | ~5KB | ~20KB | 75% |

## Future Enhancements

### Potential Additions

1. **Interactive Examples** - Executable query builder
2. **Schema Reference** - Work item field documentation
3. **Error Guide** - Common errors and solutions
4. **Migration Guides** - Upgrading from older versions

### Client Features

1. **Caching** - Client-side resource caching
2. **Search** - Full-text search across resources
3. **Bookmarks** - Favorite resources for quick access
4. **Updates** - Resource versioning and change notifications

## Testing

### Test Coverage

```bash
npm test -- resource-service.test

✓ should return all available resources
✓ should include WIQL quick reference
✓ should return content for WIQL quick reference
✓ WIQL reference should contain essential query patterns
# ... 17 tests total
```

### Manual Testing

```bash
# Build server
npm run build

# Start server (manual testing with MCP Inspector)
node dist/index.js YOUR_ORG YOUR_PROJECT

# Test resource listing
# Test resource reading
```

## Documentation

- **Main README:** [README.md](../../README.md)
- **Resources README:** [resources/README.md](../resources/README.md)
- **Architecture:** [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)

## See Also

- [MCP Specification - Resources](https://modelcontextprotocol.io/docs/concepts/resources)
- [Azure DevOps WIQL Syntax](https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax)
- [Azure DevOps Analytics](https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/)
