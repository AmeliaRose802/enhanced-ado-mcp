# Tool Naming Migration Guide

## Overview

All MCP tools have been updated to use **verb-first naming convention** for better discoverability and alignment with MCP best practices. Old `wit-*` prefixed names have been replaced with verb-first names.

## Migration Status

✅ **COMPLETE** - All tool configurations use verb-first naming
⚠️ **IN PROGRESS** - Documentation and test references being updated

## Tool Name Mapping

### Work Item Creation (3 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-create-item`, `wit-create-new-item` | `create-workitem` | ✅ Updated |
| `wit-assign-copilot` | `assign-copilot` | ✅ No change needed |

### Work Item Context (2 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-get-context` | `get-context` | ✅ Updated |
| `wit-get-context-batch`, `wit-get-context-packages`, `wit-get-context-packages-by-query-handle` | `get-context-bulk` | ✅ Updated |
| `wit-extract-security-links`, `wit-extract` | `extract-security-links` | ✅ Updated |

### Query Tools (2 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-query-wiql`, `wit-wiql-query`, `wit-get-work-items-by-query-wiql`, `wit-generate-wiql-query`, `wit-ai-generate-wiql` | `query-wiql` | ✅ Updated |
| `wit-query-odata`, `wit-ai-generate-odata`, `wit-generate-odata-query` | `query-odata` | ✅ Updated |

### Bulk Operations (4 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-unified-bulk-operations`, `wit-unified-bulk-operations-by-query-handle`, `wit-bulk-update`, `wit-bulk-comment-by-query-handle`, `wit-bulk-update-by-query-handle`, `wit-bulk-assign-by-query-handle`, `wit-bulk-remove`, `wit-bulk-remove-by-query-handle`, `wit-bulk-transition-state-by-query-handle`, `wit-bulk-move-to-iteration-by-query-handle`, `wit-bulk-enhance-descriptions-by-query-handle` | `execute-bulk-operations` | ✅ Updated |
| `wit-link-work-items`, `wit-link-work-items-by-query-handles` | `link-workitems` | ✅ Updated |
| `wit-bulk-undo-by-query-handle` | `undo-bulk` | ✅ Updated |
| `wit-forensic-undo` | `undo-forensic` | ✅ Updated |

### AI Analysis (3 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-analyze-workload` | `analyze-workload` | ✅ No change needed |
| `wit-discover-tools` | `discover-tools` | ✅ No change needed |
| `wit-ai-intelligence`, `wit-analyze-query-handle` | `analyze-query-handle` | ✅ Updated |

### Query Handle Management (4 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-analyze-by-query-handle`, `wit-hierarchy-validator`, `wit-ai-assignment`, `wit-ai-assignment-analyzer`, `wit-find-parent-item-intelligent` | `analyze-bulk` | ✅ Updated |
| `wit-list-handles` | `list-handles` | ✅ No change needed |
| `wit-inspect-handle`, `wit-query-handle-info` | `inspect-handle` | ✅ Updated |

### Configuration & Discovery (4 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-get-config`, `wit-get-configuration` | `get-config` | ✅ Updated |
| `wit-get-team-members` | `get-team-members` | ✅ No change needed |
| `wit-get-prompts` | `get-prompts` | ✅ Updated |
| `wit-list-agents` | `list-agents` | ✅ No change needed |

### Repository Tools (2 tools)

| Old Name (wit-*) | New Name (Verb-First) | Status |
|------------------|------------------------|--------|
| `wit-get-pr-diff` | `get-pr-diff` | ✅ No change needed |
| `wit-get-pr-comments` | `get-pr-comments` | ✅ No change needed |

## Breaking Changes

⚠️ **This is a breaking change** for any existing automations or scripts that reference the old tool names.

### What Changed

1. **Tool Names** - All tool names now use verb-first convention
2. **Tool References** - References in error messages, descriptions, and documentation updated
3. **Handler Metadata** - Internal tool metadata updated to match new names

### What Didn't Change

1. **Tool Functionality** - All tools work exactly the same way
2. **Parameters** - All input/output schemas remain unchanged
3. **Query Handles** - Query handle patterns and behaviors unchanged
4. **APIs** - All Azure DevOps API integrations remain the same

## Migration Checklist

If you have existing code or documentation that references these tools:

- [ ] Update tool names in MCP client code
- [ ] Update documentation references
- [ ] Update any saved queries or scripts
- [ ] Test all workflows to ensure they work with new names
- [ ] Update any CI/CD pipelines that reference tool names

## Examples

### Before (Old wit-* Names)

```typescript
// Creating a work item
await callTool('wit-create-item', { title: 'New Task', parentWorkItemId: 123 });

// Querying with WIQL
await callTool('wit-wiql-query', { wiqlQuery: 'SELECT [System.Id] FROM WorkItems' });

// Bulk operations
await callTool('wit-unified-bulk-operations-by-query-handle', {
  queryHandle: 'qh_123',
  actions: [{ type: 'comment', comment: 'Updated' }]
});

// Analysis
await callTool('wit-analyze-by-query-handle', {
  queryHandle: 'qh_123',
  analysisType: ['hierarchy']
});
```

### After (New Verb-First Names)

```typescript
// Creating a work item
await callTool('create-workitem', { title: 'New Task', parentWorkItemId: 123 });

// Querying with WIQL
await callTool('query-wiql', { wiqlQuery: 'SELECT [System.Id] FROM WorkItems' });

// Bulk operations
await callTool('execute-bulk-operations', {
  queryHandle: 'qh_123',
  actions: [{ type: 'comment', comment: 'Updated' }]
});

// Analysis
await callTool('analyze-bulk', {
  queryHandle: 'qh_123',
  analysisType: ['hierarchy']
});
```

## Benefits of Verb-First Naming

1. **Better Discoverability** - Easier to find tools by action (create, query, execute, analyze)
2. **Consistent with MCP Best Practices** - Follows Model Context Protocol conventions
3. **Clearer Intent** - Tool names immediately convey what action they perform
4. **Reduced Namespace Pollution** - Eliminates redundant `wit-` prefix
5. **Better Autocomplete** - IDEs and tools can group by action verb

## Tool Categories by Verb

### Create
- `create-workitem` - Create new work items

### Get
- `get-context` - Retrieve work item context
- `get-context-bulk` - Bulk context retrieval
- `get-config` - Server configuration
- `get-team-members` - Team member discovery
- `get-prompts` - Prompt templates
- `get-pr-diff` - PR diffs
- `get-pr-comments` - PR comments

### Query
- `query-wiql` - WIQL queries
- `query-odata` - OData analytics queries

### Execute
- `execute-bulk-operations` - Unified bulk operations

### Analyze
- `analyze-bulk` - Bulk analysis on query handles
- `analyze-query-handle` - AI-powered query analysis
- `analyze-workload` - Workload analysis

### Link
- `link-workitems` - Create work item relationships

### Undo
- `undo-bulk` - Undo bulk operations
- `undo-forensic` - Forensic undo with history analysis

### Extract
- `extract-security-links` - Extract security finding links

### Assign
- `assign-copilot` - Assign to GitHub Copilot

### List
- `list-handles` - List query handles
- `list-agents` - List specialized agents

### Inspect
- `inspect-handle` - Inspect query handle details

### Discover
- `discover-tools` - AI-powered tool discovery

## Support

For questions or issues with the migration:
1. Check the feature specifications in `docs/feature_specs/`
2. Review the updated tool configurations in `mcp_server/src/config/tool-configs/`
3. Run `discover-tools` with `listAll: true` to see all current tool names
4. Check error messages - they now reference the correct new tool names

## Rollback

If you need to temporarily use old tool names, you can:
1. Create tool aliases in your MCP client
2. Use the query handle pattern which is name-agnostic
3. Update your code to use the new names (recommended)

**Note:** The old `wit-*` names are not supported and will result in "Unknown tool" errors.
