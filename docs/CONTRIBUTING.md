# Contributing Guidelines

## Code Organization

```
enhanced-ado-mcp/
├── docs/                           # Essential documentation only
│   ├── feature_specs/              # Feature specifications
│   ├── guides/                     # User guides
│   ├── ARCHITECTURE.md             # System architecture
│   ├── CONTRIBUTING.md             # This file
│   └── README.md                   # Documentation index
├── mcp_server/                     # Server implementation
│   ├── src/                        # TypeScript source
│   │   ├── config/                 # Configuration & schemas
│   │   ├── services/               # Business logic
│   │   │   ├── handlers/           # Tool implementations
│   │   │   │   ├── core/           # Basic operations
│   │   │   │   ├── query/          # WIQL & OData
│   │   │   │   ├── bulk-operations/ # Bulk updates
│   │   │   │   ├── ai-powered/     # AI enhancements
│   │   │   │   └── ...             # Other categories
│   │   │   └── analyzers/          # AI-powered analysis
│   │   ├── types/                  # TypeScript types
│   │   └── utils/                  # Shared utilities
│   ├── prompts/                    # AI prompt templates
│   ├── resources/                  # Quick reference guides
│   └── test/                       # Unit & integration tests
├── tasklist/                       # Development notes (don't touch unless asked)
└── README.md                       # Main documentation
```

## Documentation Rules

### ❌ DO NOT CREATE:
- `*_SUMMARY.md` files
- `*_COMPLETE.md` files
- `*_REPORT.md` files
- `IMPLEMENTATION_STATUS.md`
- Verbose architecture docs
- Duplicate guides

### ✅ INSTEAD:
- Update existing documentation
- Use clear git commit messages
- Keep docs concise and actionable
- Put details in code comments
- Focus on HOW to use, not implementation history

## File Placement Guide

### Quick Reference

- **User documentation** → `/docs`
- **Code** → `/mcp_server/src`
- **Tests** → `/mcp_server/test`
- **Prompts** → `/mcp_server/prompts`
- **Quick references** → `/mcp_server/resources`
- **Task tracking** → `/tasklist` (rarely modified)

### Detailed File Placement

#### Handler Files (`mcp_server/src/services/handlers/`)

Handlers are organized by functional category for better maintainability:

```
handlers/
├── core/               # Basic CRUD, config, discovery
│   ├── create-new-item.handler.ts
│   ├── get-configuration.handler.ts
│   └── get-work-items-context-batch.handler.ts
├── query/              # Query execution (WIQL/OData)
│   ├── wiql-query.handler.ts
│   ├── odata-analytics.handler.ts
│   └── generate-wiql-query.handler.ts
├── query-handles/      # Query handle management
│   ├── list-query-handles.handler.ts
│   ├── inspect-query-handle.handler.ts
│   └── validate-query-handle.handler.ts
├── bulk-operations/    # Non-AI bulk updates
│   ├── bulk-update-by-query-handle.handler.ts
│   ├── bulk-assign-by-query-handle.handler.ts
│   └── bulk-comment-by-query-handle.handler.ts
├── ai-powered/         # AI-enhanced operations
│   ├── bulk-enhance-descriptions.handler.ts
│   ├── bulk-add-acceptance-criteria.handler.ts
│   └── analyze-by-query-handle.handler.ts
├── analysis/           # Pattern detection & validation
│   ├── detect-patterns.handler.ts
│   ├── validate-hierarchy.handler.ts
│   └── extract-security-links.handler.ts
├── integration/        # External integrations
│   ├── assign-to-copilot.handler.ts
│   └── new-copilot-item.handler.ts
└── context/            # Rich context packages
    └── get-work-item-context-package.handler.ts
```

**Decision Tree for Handler Placement:**

```
Is it external integration (GitHub, etc.)?
├─ YES → integration/
└─ NO ↓

Does it require AI/LLM sampling?
├─ YES → ai-powered/
└─ NO ↓

Does it provide rich context packages?
├─ YES → context/
└─ NO ↓

Does it execute queries (WIQL/OData)?
├─ YES → query/
└─ NO ↓

Does it manage query handle lifecycle?
├─ YES → query-handles/
└─ NO ↓

Does it perform bulk operations via handles?
├─ YES → bulk-operations/
└─ NO ↓

Does it analyze/validate work items?
├─ YES → analysis/
└─ NO ↓

Default → core/
```

**Naming Convention:** `<action>-<subject>.handler.ts`
- ✅ `create-new-item.handler.ts`
- ✅ `bulk-assign-by-query-handle.handler.ts`
- ✅ `get-work-item-context-package.handler.ts`
- ❌ `handler-create-item.ts` (wrong order)
- ❌ `createNewItem.handler.ts` (use kebab-case)

**Why categorized?**
- Easier to find related functionality
- Clear separation of concerns
- Simpler onboarding for new contributors
- Logical grouping reduces cognitive load

See `mcp_server/src/services/handlers/README.md` for complete category descriptions.

#### Service Files (`mcp_server/src/services/`)

```
services/
├── ado-work-item-service.ts      # Azure DevOps work item operations
├── ado-discovery-service.ts      # Resource discovery (areas, iterations)
├── query-handle-service.ts       # Query handle management & selection
├── sampling-service.ts            # LLM sampling integration
├── prompt-service.ts              # Prompt loading & rendering
├── resource-service.ts            # MCP resource serving
├── tool-service.ts                # Tool routing orchestrator
└── analyzers/                     # AI-powered analyzers
    ├── ai-assignment-analyzer.ts
    ├── completeness-analyzer.ts
    └── ...
```

**When to create a new service:**
- New external system integration (e.g., `github-service.ts`)
- Distinct business domain requiring multiple operations
- Complex shared logic used by multiple handlers

**When to extend existing service:**
- Adding operations to existing domain
  - Work item ops → `ado-work-item-service.ts`
  - Query operations → `query-handle-service.ts`
  - LLM sampling → `sampling-service.ts`

**Naming:** `<domain>-service.ts` (kebab-case)

#### Test Files (`mcp_server/test/`)

```
test/
├── unit/                          # Fast, isolated tests
│   ├── config-types.test.ts
│   ├── bulk-update.test.ts
│   ├── unified-query-generator.test.ts
│   └── ...
├── integration/                   # End-to-end workflows
│   ├── bulk-operations-integration.test.ts
│   └── ...
└── setup.ts                       # Jest configuration
```

**Test Naming:**
- Unit tests: `<feature-name>.test.ts`
- Integration tests: `<feature>-integration.test.ts`

**Where to place:**
- All tests in flat structure (no subdirectories by feature)
- Unit tests test individual functions with mocks
- Integration tests test complete workflows

**Why flat structure?**
- Faster test discovery
- Simpler import paths
- No need to mirror complex source structure
- Focus on what's tested, not implementation details

#### Documentation Files

**Feature Specifications (`docs/feature_specs/`):**
```
feature_specs/
├── toc.yml                        # Table of contents
├── AI_POWERED_FEATURES.md
├── BULK_OPERATIONS.md
├── QUERY_HANDLE_PATTERN.md
└── ...
```

**Requirements:**
- **REQUIRED** for all new features
- Naming: `SCREAMING_SNAKE_CASE.md`
- Must update `toc.yml` with new entry
- Include: overview, inputs, outputs, examples, errors, testing

**User Guides (`docs/guides/`):**
```
guides/
├── toc.yml
├── WIQL_BEST_PRACTICES.md
├── GETTING_STARTED.md
└── ...
```

**Quick References (`mcp_server/resources/`):**
```
resources/
├── README.md
├── wiql-quick-reference.md
├── query-handle-pattern.md
├── common-workflows.md
├── tool-selection-guide.md
└── ...
```

**Purpose:** Concise, scannable references for AI agents
- Naming: `kebab-case.md`
- Focus on practical usage
- No implementation details

**Core Documentation (`docs/`):**
- `ARCHITECTURE.md` - System architecture
- `CONTRIBUTING.md` - This file
- `README.md` - Documentation index

**Why split documentation?**
- `docs/` - User-facing, comprehensive
- `resources/` - Agent-facing, quick lookups
- Separation by audience improves usability

#### Prompt Templates (`mcp_server/prompts/`)

```
prompts/
├── backlog_cleanup.md             # User prompts (workflows)
├── unified_work_item_analyzer.md
├── sprint_planning.md
└── system/                        # System prompts (AI instructions)
    ├── ai-assignment-analyzer.md
    ├── completeness-analyzer.md
    └── ...
```

**User Prompts (root):**
- Multi-turn workflow orchestration
- Naming: `snake_case.md`
- Define complete agent workflows

**System Prompts (`system/`):**
- AI behavior instructions
- Naming: `kebab-case.md`
- Define analysis criteria and output formats
- Reusable across tools

**Template Variables:** Use `{{variableName}}` for substitution

**Why separated?**
- System prompts are building blocks (reusable)
- User prompts are complete workflows (orchestration)
- Clear distinction between instruction and execution

#### Configuration Files (`mcp_server/src/config/`)

```
config/
├── config.ts          # Configuration loading & merging
├── schemas.ts         # Zod validation schemas
└── tool-configs.ts    # Tool registry
```

**When to modify:**
- New tool parameter → Add to `schemas.ts`
- New tool → Register in `tool-configs.ts`
- New config option → Update `config.ts` + add schema

**User Configuration:**
- `mcp_server/.ado-mcp-config.json` (gitignored)

#### Type Definitions (`mcp_server/src/types/`)

```
types/
├── work-items.ts      # Work item types
├── queries.ts         # Query-related types
└── ...
```

**When to add:**
- New domain types
- Shared interfaces across services
- Complex type definitions

**Naming:** `<domain>.ts` (kebab-case)

#### Utility Functions (`mcp_server/src/utils/`)

```
utils/
├── error-formatter.ts
├── validation-helpers.ts
└── ...
```

**When to add:**
- Shared helper functions
- Cross-cutting concerns
- Reusable utilities

### Complete Decision Tree

```
What are you creating?

Handler (tool implementation)?
├─ Use handler category decision tree
└─ Place in: mcp_server/src/services/handlers/<category>/<action>-<subject>.handler.ts

Service (business logic)?
├─ New domain? → mcp_server/src/services/<domain>-service.ts
├─ Analyzer? → mcp_server/src/services/analyzers/<feature>-analyzer.ts
└─ Extend existing? → Modify existing service

Test?
├─ Unit test? → mcp_server/test/unit/<feature>.test.ts
└─ Integration? → mcp_server/test/integration/<feature>-integration.test.ts

Documentation?
├─ Feature spec? → docs/feature_specs/<FEATURE>.md (+ update toc.yml)
├─ User guide? → docs/guides/<GUIDE>.md (+ update toc.yml)
├─ Quick reference? → mcp_server/resources/<topic>-guide.md
└─ Update existing? → Modify relevant doc in docs/

Prompt?
├─ User prompt? → mcp_server/prompts/<workflow>.md
└─ System prompt? → mcp_server/prompts/system/<feature>.md

Configuration?
├─ Schema? → mcp_server/src/config/schemas.ts
├─ Tool registration? → mcp_server/src/config/tool-configs.ts
└─ Config loading? → mcp_server/src/config/config.ts

Types?
└─ mcp_server/src/types/<domain>.ts

Utils?
└─ mcp_server/src/utils/<utility>.ts
```

### Examples

**Example 1: Adding a new bulk operation handler**
```
File: mcp_server/src/services/handlers/bulk-operations/bulk-tag-items.handler.ts
Why: It's a bulk operation using query handles, non-AI
Category: bulk-operations/
Naming: <action>-<subject>.handler.ts pattern
```

**Example 2: Adding AI-powered analysis**
```
File: mcp_server/src/services/handlers/ai-powered/analyze-sprint-capacity.handler.ts
Why: Requires LLM sampling for intelligent analysis
Category: ai-powered/
Also create: mcp_server/prompts/system/sprint-capacity-analyzer.md
```

**Example 3: Adding a feature spec**
```
File: docs/feature_specs/SPRINT_CAPACITY.md
Also update: docs/feature_specs/toc.yml
Why: Required for all new features
Format: SCREAMING_SNAKE_CASE.md
```

**Example 4: Adding a quick reference**
```
File: mcp_server/resources/sprint-planning-guide.md
Why: Agent-facing quick reference
Naming: kebab-case.md
Focus: Practical usage, not implementation
```

## Documentation Standards

1. **Be concise** - Get to the point quickly
2. **Show examples** - Code speaks louder than words
3. **No redundancy** - One source of truth
4. **Maintainable** - Update existing docs, don't create new ones
5. **Git history** - Implementation details belong in commits

## Before Creating New Docs

1. Can this update an existing doc?
2. Is this essential for users?
3. Will this stay relevant?
4. Does it have clear examples?

If you answered "no" to any, reconsider creating it.

## Code Standards

- Use TypeScript, not PowerShell
- Follow existing patterns
- Write tests for new features
- Keep functions focused and small
- Use meaningful variable names

## Testing Guidelines

### Test Organization

Tests are located in `/mcp_server/src/test/` and follow these patterns:

- **Unit Tests**: Test individual functions in isolation with mocked dependencies
- **Integration Tests**: Test complete workflows with real-ish data
- **Test Naming**: `feature-name.test.ts` (e.g., `query-handle-selection.test.ts`)

### Writing Tests for Selection Features

When adding or modifying item selection functionality:

1. **Test All Selection Types**:
   ```typescript
   // Test "all" selector
   itemSelector: "all"
   
   // Test index-based selector
   itemSelector: [0, 2, 5]
   
   // Test criteria-based selector
   itemSelector: { states: ["Active"], tags: ["critical"] }
   ```

2. **Test Edge Cases**:
   - Empty query results
   - Invalid indices (negative, out of bounds)
   - No items matching criteria
   - Expired query handles
   - Combined criteria (AND logic)

3. **Test Validation**:
   - Invalid selector types should fail gracefully
   - Partial index matches should include warnings
   - Empty selections should return success with warning

### Example Selection Test

```typescript
describe('item selection', () => {
  it('should select items by criteria', async () => {
    const handle = createTestHandle([
      { id: 1, state: 'Active', tags: ['critical'] },
      { id: 2, state: 'Done', tags: [] }
    ]);
    
    const result = await selectItems(handle, {
      itemSelector: { states: ['Active'] }
    });
    
    expect(result.selected_items_count).toBe(1);
    expect(result.preview_items[0].id).toBe(1);
  });
});
```

### Extending Selection Criteria

To add new selection criteria:

1. **Update Type Definitions** (`src/config/schemas.ts`):
   ```typescript
   const criteriaSchema = z.object({
     states: z.array(z.string()).optional(),
     tags: z.array(z.string()).optional(),
     // Add new criteria here:
     priority: z.array(z.string()).optional()
   });
   ```

2. **Implement Selection Logic** (`src/services/query-handle-service.ts`):
   ```typescript
   selectByCriteria(criteria: SelectionCriteria): number[] {
     return this.itemContext.values()
       .filter(item => {
         // Add new criteria check:
         if (criteria.priority && 
             !criteria.priority.includes(item.priority))
           return false;
         // ... other checks
       })
       .map(item => item.id);
   }
   ```

3. **Add Tests** (`src/test/query-handle-selection.test.ts`):
   ```typescript
   it('should select by priority criteria', async () => {
     // Test new criteria
   });
   ```

4. **Update Documentation**:
   - Update `docs/QUERY_HANDLE_MIGRATION.md` with examples
   - Update `mcp_server/resources/query-handle-pattern.md`
   - Update tool descriptions in `src/config/tool-configs.ts`

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test query-handle-selection.test.ts

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Commit Messages

Good:
```
feat: Add bulk comment tool for work items
fix: Handle escaped area paths correctly
docs: Update WIQL best practices
```

Bad:
```
Updated files
Made some changes
Fixed stuff
```

## Questions?

See `.github/copilot-instructions.md` for AI assistant guidelines.
