# Repository Structure Guide

**For AI Agents and Developers Working on Enhanced ADO MCP Server**

This document explains the logical organization of this repository and where different types of files should be placed.

## 📁 Top-Level Directory Structure

```
enhanced-ado-mcp/
├── docs/                    # All documentation files
├── mcp_server/              # Main MCP server implementation
│   ├── src/                 # TypeScript source code
│   ├── ado_scripts/         # [DEPRECATED] PowerShell scripts (being phased out)
│   ├── prompts/             # AI prompt templates
│   └── dist/                # Compiled JavaScript output (generated)
├── specs/                   # Feature specifications and design documents
├── tasklist/                # Development task tracking and notes
├── README.md                # Main project documentation
└── package.json             # Project metadata (if needed)
```

## 🎯 Detailed Structure & File Placement Rules

### `/docs` - Documentation

**Purpose:** Centralized location for all project documentation

**What belongs here:**
- API documentation
- Architecture guides
- Development guides (this file)
- User manuals
- Configuration examples
- Migration guides

**What does NOT belong here:**
- Feature specifications (→ `/specs`)
- Code comments (→ inline in source files)
- Task lists (→ `/tasklist`)

### `/mcp_server` - Core Server Implementation

The heart of the MCP server. All runtime code lives here.

#### `/mcp_server/src` - TypeScript Source Code

**Logical Organization by Concern:**

```
src/
├── config/              # Configuration management
│   ├── config.ts        # Config loading, types, validation
│   ├── schemas.ts       # Zod schemas for tool inputs
│   └── tool-configs.ts  # Tool registry and metadata
│
├── services/            # Business logic layer
│   ├── ado-discovery-service.ts    # ADO resource discovery
│   ├── ado-work-item-service.ts    # Work item CRUD operations
│   ├── prompt-service.ts           # Prompt loading and rendering
│   ├── sampling-service.ts         # VS Code LLM sampling
│   ├── tool-service.ts             # Tool execution orchestration
│   │
│   ├── handlers/        # Tool-specific request handlers
│   │   ├── create-new-item.handler.ts
│   │   ├── assign-to-copilot.handler.ts
│   │   ├── wiql-query.handler.ts
│   │   └── ...
│   │
│   └── analyzers/       # AI-powered analysis implementations
│       ├── work-item-intelligence.ts
│       ├── ai-assignment.ts
│       ├── feature-decomposer.ts
│       └── hierarchy-validator.ts
│
├── utils/               # Utility functions and helpers
│   ├── logger.ts        # Logging utilities
│   ├── ado-token.ts     # Azure authentication helpers
│   ├── response-builder.ts  # Response formatting
│   └── ...
│
├── types/               # TypeScript type definitions
│   └── index.ts         # Shared types and interfaces
│
├── test/                # Unit and integration tests
│   ├── *.test.ts        # Test files
│   └── fixtures/        # Test data
│
├── index.ts             # Server entry point
└── hybridTransport.ts   # Custom MCP transport layer
```

**File Placement Rules for `/src`:**

1. **Configuration** (`/config`):
   - Place anything related to server configuration, CLI args, or defaults
   - Schema definitions for tool inputs
   - Tool registry (tool-configs.ts)

2. **Services** (`/services`):
   - Business logic that orchestrates operations
   - Each service should have a clear, single responsibility
   - Services call utils but never other services (except ToolService as orchestrator)

3. **Handlers** (`/services/handlers`):
   - One handler per MCP tool
   - Naming: `{tool-name}.handler.ts` (e.g., `create-new-item.handler.ts`)
   - Handlers validate input, call services, format responses
   - Should be thin wrappers around service methods

4. **Analyzers** (`/services/analyzers`):
   - AI-powered analysis implementations
   - Use sampling-service to interact with LLMs
   - Complex prompt construction and response parsing

5. **Utils** (`/utils`):
   - Pure functions and helpers
   - No business logic
   - Reusable across services
   - Examples: logging, authentication, parsing, formatting

6. **Types** (`/types`):
   - All TypeScript interfaces, types, and type guards
   - Keep types close to where they're used when possible
   - Global types go in `/types/index.ts`

7. **Tests** (`/test`):
   - Test files mirror source structure
   - Naming: `{source-file}.test.ts`
   - Integration tests use `{feature}-integration.test.ts`
   - Keep test fixtures in `/test/fixtures`

#### `/mcp_server/ado_scripts` - [DEPRECATED] PowerShell Scripts

**Status:** Being phased out in favor of TypeScript REST API implementations

**Do NOT add new PowerShell scripts here.** All new functionality should be implemented in TypeScript using the Azure DevOps REST API.

These scripts remain temporarily for:
- Reference during TypeScript migration
- Backwards compatibility (if needed)

**When to remove:**
- Once all tools use TypeScript handlers
- After thorough testing of TypeScript implementations

#### `/mcp_server/prompts` - AI Prompt Templates

**Purpose:** Structured prompt templates for AI-powered features

```
prompts/
├── system/              # System-level prompts (internal use)
│   ├── ai-assignment-analyzer.md
│   ├── completeness-analyzer.md
│   └── ...
│
└── *.md                 # User-facing prompt templates
    ├── work_item_enhancer.md
    ├── ai_suitability_analyzer.md
    └── security_items_analyzer.md
```

**File Placement Rules:**

- **User-facing prompts** (exposed via MCP): Root of `/prompts`
- **System prompts** (internal AI features): `/prompts/system`
- All prompts use Markdown format
- Support variable substitution: `{{variable_name}}`

**Naming Convention:**
- User prompts: `snake_case.md`
- System prompts: `kebab-case.md`

### `/specs` - Feature Specifications

**Purpose:** High-level design documents and feature specifications

**What belongs here:**
- Feature design documents
- API specifications
- Architecture decision records (ADRs)
- Implementation summaries
- Refactoring plans

**Naming Convention:** `UPPER_CASE.md` or `Feature-Name-Spec.md`

**Examples:**
- `WIQL_IMPLEMENTATION.md`
- `REFACTORING_COMPLETE.md`
- `AI_SAMPLING_FEATURE.md`

### `/tasklist` - Development Task Tracking

**Purpose:** Development notes, task lists, and work-in-progress planning

**What belongs here:**
- Task lists and TODO files
- Development notes
- Research findings
- Temporary documentation

**What does NOT belong here:**
- Completed feature docs (→ `/specs`)
- Architecture docs (→ `/docs`)

## 🧭 Decision Tree: Where Does This File Go?

Use this flowchart to determine file placement:

```
Is it code?
├─ YES → Is it TypeScript?
│  ├─ YES → Is it a test?
│  │  ├─ YES → /mcp_server/src/test/
│  │  └─ NO → See source code decision tree below
│  └─ NO → Is it PowerShell?
│     └─ YES → DON'T CREATE IT (use TypeScript instead)
│
└─ NO → Is it documentation?
   ├─ YES → Is it a feature spec?
   │  ├─ YES → /specs/
   │  └─ NO → Is it a task/note?
   │     ├─ YES → /tasklist/
   │     └─ NO → /docs/
   │
   └─ NO → Is it a prompt template?
      ├─ YES → User-facing? → /mcp_server/prompts/
      │        System-level? → /mcp_server/prompts/system/
      └─ NO → Is it configuration?
         └─ YES → /mcp_server/mcp-config.json or /mcp_server/package.json
```

### Source Code Decision Tree:

```
What does this TypeScript file do?
│
├─ Configuration management?
│  └─ /mcp_server/src/config/
│
├─ Business logic (service)?
│  ├─ Tool execution orchestration? → /mcp_server/src/services/tool-service.ts
│  ├─ ADO operations? → /mcp_server/src/services/ado-*.service.ts
│  ├─ AI/LLM operations? → /mcp_server/src/services/sampling-service.ts
│  └─ Other business logic? → /mcp_server/src/services/{name}.service.ts
│
├─ Handles a specific MCP tool?
│  └─ /mcp_server/src/services/handlers/{tool-name}.handler.ts
│
├─ AI-powered analysis?
│  └─ /mcp_server/src/services/analyzers/{feature}.ts
│
├─ Utility/helper function?
│  └─ /mcp_server/src/utils/{purpose}.ts
│
├─ Type definitions?
│  └─ /mcp_server/src/types/index.ts (or colocate with source)
│
└─ Server entry point or transport?
   └─ /mcp_server/src/ (root level: index.ts, hybridTransport.ts)
```

## 📝 Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| TypeScript source | `kebab-case.ts` | `ado-work-item-service.ts` |
| Handlers | `{tool-name}.handler.ts` | `create-new-item.handler.ts` |
| Tests | `{source}.test.ts` | `ado-work-item-service.test.ts` |
| Integration tests | `{feature}-integration.test.ts` | `wiql-query-integration.test.ts` |
| Docs | `UPPER_SNAKE.md` | `REPOSITORY_STRUCTURE.md` |
| Specs | `UPPER_SNAKE.md` | `WIQL_IMPLEMENTATION.md` |
| Prompts (user) | `snake_case.md` | `work_item_enhancer.md` |
| Prompts (system) | `kebab-case.md` | `ai-assignment-analyzer.md` |

### Directories

- Use `kebab-case` for all directories: `ado-scripts`, `work-items`, etc.
- Use singular names when representing a category: `config`, `service`, `handler`
- Use plural names when containing items: `prompts`, `handlers`, `analyzers`

## 🚫 Common Anti-Patterns to Avoid

### ❌ Don't Create:
1. **PowerShell scripts** - Use TypeScript with REST API instead
2. **Duplicate utilities** - Check `/utils` before creating new helpers
3. **God files** - Keep files focused and under 500 lines
4. **Mixed concerns** - Don't put business logic in utils or handlers
5. **Orphan test files** - Tests should mirror source structure

### ❌ Don't Place:
1. Build output (`dist/`, `node_modules/`) in version control
2. Secrets or credentials anywhere in the repo
3. Personal notes in `/docs` or `/specs`
4. Business logic in handlers (put it in services)
5. Documentation in comments when it should be in `/docs`

## ✅ Best Practices

### When Creating a New Feature:

1. **Spec first** → Create or update `/specs/{FEATURE_NAME}.md`
2. **Types** → Define interfaces in `/src/types/index.ts`
3. **Service** → Implement business logic in `/src/services/{name}.service.ts`
4. **Handler** → Create thin handler in `/src/services/handlers/{tool-name}.handler.ts`
5. **Register** → Add to `/src/config/tool-configs.ts`
6. **Wire up** → Update `/src/services/tool-service.ts`
7. **Test** → Create tests in `/src/test/{name}.test.ts`
8. **Document** → Update `/docs` and README as needed

### When Refactoring:

1. Update `/specs` with refactoring summary
2. Keep old files until new implementation is tested
3. Update tests to match new structure
4. Move files, don't copy (to preserve git history)
5. Update all imports and references

## 📊 File Organization Checklist

Before committing, verify:

- [ ] Files are in correct directory per this guide
- [ ] Naming conventions are followed
- [ ] No deprecated PowerShell scripts added
- [ ] Tests mirror source structure
- [ ] Documentation updated if public API changed
- [ ] No business logic in utils or handlers
- [ ] Types are properly defined
- [ ] Imports are clean (no circular dependencies)

## 🔄 Migration Status

### Completed:
- ✅ All core work item operations converted to TypeScript
- ✅ WIQL query support implemented in TypeScript
- ✅ AI-powered analysis tools using sampling
- ✅ Configuration management in TypeScript

### In Progress:
- 🔄 Deprecating PowerShell scripts
- 🔄 Comprehensive test coverage
- 🔄 Full API documentation

### Planned:
- 📋 Additional AI-powered tools
- 📋 Enhanced error handling
- 📋 Performance optimizations

## 🤖 For AI Agents

When working on this repository:

1. **Always check this guide** before creating new files
2. **Use the decision trees** to determine proper placement
3. **Follow naming conventions** strictly
4. **Keep concerns separated** - don't mix business logic with utilities
5. **Test thoroughly** - create tests that mirror source structure
6. **Document changes** - update specs and docs as needed
7. **Never create PowerShell scripts** - use TypeScript REST API implementations
8. **Ask if unsure** - it's better to clarify than to misplace files

## 📚 Related Documentation

- [Main README](../README.md) - Project overview and setup
- [Tool Configurations](../mcp_server/src/config/tool-configs.ts) - Available tools
- [Configuration Guide](../docs/CONFIGURATION.md) - Configuration options
- [Testing Guide](../docs/TESTING.md) - Testing strategy and examples

---

**Last Updated:** 2025-10-01  
**Maintained by:** Enhanced ADO MCP Server Team
