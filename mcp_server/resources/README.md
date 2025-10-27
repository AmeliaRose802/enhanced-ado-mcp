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
- **NEW:** AI-powered query generation (WIQL and OData from natural language)
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

### 8. Tool Discovery Guide (`tool-discovery-guide.md`)
**URI:** `ado://docs/tool-discovery-guide`

AI-powered tool discovery for finding the right tools:
- Using natural language to find tools
- Understanding confidence scores
- Common usage patterns
- Workflow recommendations
- Filter by category
- **AI vs Deterministic tool selection** - Decision matrix for choosing between AI-powered and rule-based tools
- Cost/speed/accuracy tradeoffs
- Tool comparison examples (query generation, analysis, bulk operations)
- Best practices and hybrid approaches

**Use when:** Agent is unsure which tool to use or wants to explore capabilities with natural language, or needs guidance on AI vs deterministic tool selection

### 9. Handle-First Analysis Guide (`handle-first-analysis-guide.md`)
**URI:** `ado://docs/handle-first-analysis-guide`

Query handle patterns for safe analysis workflows:
- Prevention of ID hallucination in AI workflows
- Complete analyze-then-act patterns
- Validation and inspection workflows
- Handle lifecycle management
- Best practices for multi-step operations

**Use when:** Agent needs to analyze work items before performing bulk operations

### 10. WIQL Generator Guide (`wiql-generator-guide.md`)
**URI:** `ado://docs/wiql-generator-guide`

AI-powered WIQL query generation from natural language:
- Converting natural language to WIQL
- Iterative validation and refinement
- Common query patterns
- Testing and verification
- Troubleshooting failed generations

**Use when:** Agent needs to construct complex WIQL queries from descriptions

### 11. Personal Workload Analyzer Guide (`personal-workload-analyzer-guide.md`)
**URI:** `ado://docs/personal-workload-analyzer-guide`

Individual workload health analysis for burnout prevention and career development:
- Burnout risk assessment
- Overspecialization detection
- Work-life balance patterns
- Career growth opportunities
- Custom intent analysis (promotion readiness, skill development)
- Responsible use and privacy guidelines

**Use when:** Agent needs to analyze an individual's work patterns for health risks, career development, or growth opportunities

### 12. Sprint Planning Guide (`sprint-planning-guide.md`)
**URI:** `ado://docs/sprint-planning-guide`

AI-powered sprint planning for optimal work assignment:
- Historical velocity analysis
- Team capacity assessment
- Balanced work distribution
- Skill matching and load balancing
- Risk assessment and mitigation
- Sprint planning workflows
- Integration with other tools

**Use when:** Agent needs to create a sprint plan, analyze team capacity, or propose work assignments

### 13. Tool Limitations and Constraints (`tool-limitations.md`)
**URI:** `ado://docs/tool-limitations`

Comprehensive guide to tool limitations, constraints, and restrictions:
- WIQL vs OData query limitations
- Bulk operation constraints
- AI-powered tool limitations (accuracy, context window, rate limits)
- Azure DevOps API limitations (rate limits, field restrictions)
- Query handle expiration and scope
- Performance constraints and benchmarks
- When to avoid certain tools
- Common workarounds for limitations
- Authentication constraints

**Use when:** Agent needs to understand what tools can/cannot do before attempting operations, troubleshooting failures, or choosing between alternative approaches

## How Agents Access Resources
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

## Choosing Between AI and Deterministic Tools

When selecting tools, consider this decision framework:

### Use AI-Powered Tools When:
- **Natural Language Input**: User describes needs in plain language
- **Subjective Analysis**: Questions like "Is this suitable for AI assignment?"
- **Content Generation**: Creating unique descriptions, acceptance criteria, or estimates
- **Complex Queries**: Multi-condition queries with date arithmetic or custom fields
- **Quality Assessment**: Evaluating completeness, readiness, or suitability

**Tradeoffs:**
- ⏱️ Slower (2-8 seconds per operation)
- 💰 Moderate-High cost (uses LLM tokens/VS Code quota)
- 🎯 85-95% accuracy (may require iteration/review)
- 🧠 High context awareness and flexibility
- 🔌 Requires VS Code Language Model API access

### Use Deterministic (Rule-Based) Tools When:
- **Known Syntax**: You already know the exact query or update syntax
- **Objective Validation**: Rule-based checks (types, states, relationships)
- **Bulk Operations**: Applying fixed updates to many items
- **Speed Critical**: Need instant results (<1 second)
- **Cost Sensitive**: Avoiding LLM token usage
- **100% Accuracy Required**: No tolerance for variance

**Tradeoffs:**
- ⚡ Fast (<1 second)
- 💰 Free (no LLM costs)
- 🎯 100% accuracy for rule-based operations
- 🔒 No context awareness (literal only)
- 📏 Limited to predefined rules
- ✅ Works offline, no API dependencies

### Tool Comparison Examples:

| Task | AI Tool | Deterministic Tool | Recommendation |
|------|---------|-------------------|----------------|
| **Query from description** | `wit-ai-generate-wiql` (2-5s, 85-95%) | `wit-get-work-items-by-query-wiql` (instant, 100%) | AI if unknown syntax, Deterministic if known |
| **Suitability analysis** | `wit-ai-assignment-analyzer` (3-8s, subjective) | `wit-validate-hierarchy` (instant, objective) | AI for "should I?", Deterministic for "can I?" |
| **Content generation** | `wit-bulk-enhance-descriptions` (2-5s/item, unique) | `wit-bulk-update-by-query-handle` (instant, template) | AI for rich content, Deterministic for fixed values |
| **Pattern detection** | `wit-ai-intelligence` (complex patterns) | `wit-analyze-patterns` (known patterns) | AI for discovery, Deterministic for validation |

### Hybrid Approach (Recommended):
Combine both for optimal results:
1. **AI Tool**: Generate complex query from description (`wit-ai-generate-wiql`)
2. **Deterministic**: Execute query with handle (`wit-get-work-items-by-query-wiql`)
3. **Deterministic**: Preview selection (`wit-query-handle-select`)
4. **AI Tool**: Enhance descriptions for subset (`wit-bulk-enhance-descriptions`)
5. **Deterministic**: Apply fixed updates to all (`wit-bulk-update-by-query-handle`)

**See `tool-discovery-guide.md` for detailed AI vs Deterministic decision matrix and examples.**

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
├── handle-first-analysis-guide.md
├── tool-discovery-guide.md
├── wiql-generator-guide.md
├── personal-workload-analyzer-guide.md
├── sprint-planning-guide.md
└── tool-limitations.md
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
