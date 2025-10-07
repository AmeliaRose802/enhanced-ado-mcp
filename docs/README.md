# Enhanced ADO MCP Server Documentation

This directory contains comprehensive documentation for the Enhanced Azure DevOps Model Context Protocol (MCP) Server.

## 📚 Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── toc.yml                      # Main table of contents
├── ARCHITECTURE.md              # System architecture and design
├── CONTRIBUTING.md              # Contribution guidelines
├── feature_specs/               # Feature specifications
│   ├── toc.yml                 # Feature specs index
│   ├── AI_POWERED_FEATURES.md
│   ├── ENHANCED_QUERY_HANDLE_PATTERN.md
│   ├── MODEL_SELECTION.md
│   ├── ODATA_QUERY_OPTIMIZATION.md
│   ├── RESOURCES_FEATURE.md
│   └── WIQL_HIERARCHICAL_QUERIES.md
└── guides/                      # User guides
    ├── toc.yml                  # Guides index
    ├── WIQL_BEST_PRACTICES.md
    └── WIQL_GENERATOR_CONFIG_USAGE.md
```

## 🎯 Quick Navigation

### Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | System architecture, components, data flow, design patterns | Developers, Contributors |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | How to contribute, code standards, documentation rules | Contributors |

### Feature Specifications

Detailed specifications for all major features. See [feature_specs/toc.yml](./feature_specs/toc.yml) for complete list.

| Feature | Description | Status |
|---------|-------------|--------|
| [**AI-Powered Features**](./feature_specs/AI_POWERED_FEATURES.md) | Work item intelligence, AI analysis, enhancement suggestions | ✅ Implemented |
| [**Query Handle Pattern**](./feature_specs/ENHANCED_QUERY_HANDLE_PATTERN.md) | Anti-hallucination architecture for safe bulk operations | ✅ Implemented |
| [**Model Selection**](./feature_specs/MODEL_SELECTION.md) | LLM model selection and configuration | ✅ Implemented |
| [**OData Optimization**](./feature_specs/ODATA_QUERY_OPTIMIZATION.md) | OData query patterns and performance optimization | ✅ Implemented |
| [**Resources Feature**](./feature_specs/RESOURCES_FEATURE.md) | MCP resources for AI agent guidance | ✅ Implemented |
| [**WIQL Hierarchical Queries**](./feature_specs/WIQL_HIERARCHICAL_QUERIES.md) | Patterns for hierarchy queries and parent-child relationships | ✅ Implemented |

### User Guides

Practical guides for using the MCP server. See [guides/toc.yml](./guides/toc.yml) for complete list.

| Guide | Description | Use Case |
|-------|-------------|----------|
| [**WIQL Best Practices**](./guides/WIQL_BEST_PRACTICES.md) | Essential WIQL patterns, common pitfalls, optimization tips | Writing WIQL queries |
| [**WIQL Generator Configuration**](./guides/WIQL_GENERATOR_CONFIG_USAGE.md) | Using the AI-powered WIQL query generator | Generating queries from natural language |

## 🤖 For AI Agents

### Essential Reading Order

1. **Start here:** [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system structure
2. **Query patterns:** [feature_specs/ENHANCED_QUERY_HANDLE_PATTERN.md](./feature_specs/ENHANCED_QUERY_HANDLE_PATTERN.md) - Safe bulk operations
3. **AI features:** [feature_specs/AI_POWERED_FEATURES.md](./feature_specs/AI_POWERED_FEATURES.md) - AI-powered analysis tools
4. **Resources:** [feature_specs/RESOURCES_FEATURE.md](./feature_specs/RESOURCES_FEATURE.md) - MCP resources for guidance

### Quick Reference by Task

**Building queries:**
- [WIQL Best Practices](./guides/WIQL_BEST_PRACTICES.md)
- [WIQL Hierarchical Queries](./feature_specs/WIQL_HIERARCHICAL_QUERIES.md)
- [OData Query Optimization](./feature_specs/ODATA_QUERY_OPTIMIZATION.md)

**Bulk operations:**
- [Enhanced Query Handle Pattern](./feature_specs/ENHANCED_QUERY_HANDLE_PATTERN.md)

**AI-powered analysis:**
- [AI-Powered Features](./feature_specs/AI_POWERED_FEATURES.md)
- [Model Selection](./feature_specs/MODEL_SELECTION.md)

**Understanding the system:**
- [Architecture](./ARCHITECTURE.md)
- [Resources Feature](./feature_specs/RESOURCES_FEATURE.md)

## 📖 Documentation Standards

### File Naming Conventions

- **Feature specs:** `SCREAMING_SNAKE_CASE.md` (e.g., `AI_POWERED_FEATURES.md`)
- **Guides:** `SCREAMING_SNAKE_CASE.md` (e.g., `WIQL_BEST_PRACTICES.md`)
- **Core docs:** `SCREAMING_SNAKE_CASE.md` (e.g., `ARCHITECTURE.md`, `CONTRIBUTING.md`)
- **TOC files:** `toc.yml` (lowercase)

### Creating New Documentation

**Before adding new docs, ask:**
1. Can this update an existing document?
2. Is this essential for users/developers?
3. Will this stay relevant long-term?
4. Does it have clear examples?

If you answered "no" to any, reconsider creating it.

**When adding a feature spec:**
1. Create `feature_specs/<FEATURE_NAME>.md`
2. Add entry to `feature_specs/toc.yml`
3. Follow the feature spec template (see [documentation.instructions.md](../.github/instructions/documentation.instructions.md))
4. Include: overview, inputs, outputs, examples, errors, testing

**When adding a guide:**
1. Create `guides/<GUIDE_NAME>.md`
2. Add entry to `guides/toc.yml`
3. Focus on practical, actionable guidance
4. Include real working examples

### ❌ Do NOT Create

- Summary files (`*_SUMMARY.md`, `*_COMPLETE.md`, `*_REPORT.md`)
- Implementation status documents
- Changelog files (use git commits)
- Redundant guides (update existing instead)
- Verbose architecture expansions

### ✅ Do Update

- Existing feature specs when behavior changes
- Architecture docs for major changes
- Guides when adding new capabilities
- TOC files when adding new documents

## 🔍 Finding Information

### By Feature Category

**Work Item Operations:**
- Creating, updating, managing work items
- See [ARCHITECTURE.md](./ARCHITECTURE.md) → ADO Work Item Service

**Querying:**
- WIQL queries: [WIQL Best Practices](./guides/WIQL_BEST_PRACTICES.md)
- OData queries: [OData Optimization](./feature_specs/ODATA_QUERY_OPTIMIZATION.md)
- Hierarchies: [WIQL Hierarchical Queries](./feature_specs/WIQL_HIERARCHICAL_QUERIES.md)

**Bulk Operations:**
- Query handle pattern: [Enhanced Query Handle Pattern](./feature_specs/ENHANCED_QUERY_HANDLE_PATTERN.md)
- Anti-hallucination architecture

**AI Features:**
- Analysis tools: [AI-Powered Features](./feature_specs/AI_POWERED_FEATURES.md)
- Model selection: [Model Selection](./feature_specs/MODEL_SELECTION.md)

**Integration:**
- MCP resources: [Resources Feature](./feature_specs/RESOURCES_FEATURE.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)

### By Audience

**New Contributors:**
1. [CONTRIBUTING.md](./CONTRIBUTING.md) - Start here
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
3. Feature specs - Learn individual features

**Users/AI Agents:**
1. [Resources Feature](./feature_specs/RESOURCES_FEATURE.md) - MCP resources
2. [AI-Powered Features](./feature_specs/AI_POWERED_FEATURES.md) - What's available
3. Guides - How to use specific features

**Maintainers:**
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
2. Feature specs - Feature details
3. [CONTRIBUTING.md](./CONTRIBUTING.md) - Standards

## 📝 Updating Documentation

### Regular Maintenance

Review documentation quarterly to:
- [ ] Verify technical accuracy
- [ ] Update version numbers
- [ ] Check links aren't broken
- [ ] Test code examples still work
- [ ] Update screenshots/diagrams if changed
- [ ] Remove outdated information

### When Code Changes

**Always update documentation when:**
- Adding new features (create feature spec)
- Changing APIs or tool interfaces (update feature spec)
- Modifying behavior (update affected docs)
- Deprecating features (mark as deprecated)
- Removing features (update but don't delete docs)

### Documentation Checklist

Before committing documentation changes:
- [ ] Spell check completed
- [ ] Code examples tested
- [ ] Links verified and working
- [ ] TOC updated if new files added
- [ ] Version/date updated
- [ ] Follows naming conventions
- [ ] Includes all required sections
- [ ] Clear, concise, and actionable
- [ ] Technically accurate

## 🔗 Related Documentation

**In Repository:**
- [Root AGENTS.md](../AGENTS.md) - General project structure and workflow
- [Custom Instructions](../.github/instructions/) - Directory-specific guidance
- [MCP Resources](../mcp_server/resources/) - Quick reference guides for AI agents

**External:**
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/)
- [WIQL Syntax Reference](https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax)

## 📊 Documentation Health

### Coverage Status

| Category | Files | Status |
|----------|-------|--------|
| Core Documentation | 2/2 | ✅ Complete |
| Feature Specifications | 6/6 | ✅ Complete |
| User Guides | 2/2 | ✅ Complete |
| TOC Files | 3/3 | ✅ Complete |

### Known Gaps

None currently. All major features are documented.

### Planned Additions

See [tasklist.md](../tasklist/tasklist.md) for planned documentation updates.

## 💬 Questions?

- **Can't find what you need?** Check the [MCP Resources](../mcp_server/resources/) for quick references
- **Found an error?** Please update the doc and submit a PR
- **Need clarification?** Open an issue with the `documentation` label

---

**Last Updated:** 2025-10-07  
**Documentation Version:** 1.5.0  
**Maintained by:** Enhanced ADO MCP Server Team
