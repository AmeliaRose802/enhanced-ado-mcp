# Enhanced ADO MCP Server - Agent Instructions

This is an **Azure DevOps Model Context Protocol (MCP) Server** that enables AI agents to interact with Azure DevOps work items, queries, and projects.

## Project Overview

**Language:** TypeScript (Node.js)
**Architecture:** MCP Server with hybrid transport (stdio + SSE)
**Primary Purpose:** Enable AI-powered Azure DevOps work item management

## Build & Test Commands

```bash
# Install dependencies
cd mcp_server && npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Key Technologies

- **MCP SDK**: `@modelcontextprotocol/sdk` - Model Context Protocol implementation
- **Validation**: `zod` - Runtime type checking and validation
- **Testing**: `jest` - Unit and integration testing
- **Build**: `typescript` + `tsx` - TypeScript compilation and execution

## Code Quality Standards

### TypeScript Conventions
- Use strict TypeScript (`strict: true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Export types/interfaces for reusability
- Use descriptive type names (e.g., `ToolExecutionResult`, `WorkItemContext`)

### Error Handling
- Always return `ToolExecutionResult` from handlers
- Include structured errors in the `errors` array
- Add warnings for non-critical issues
- Include metadata for debugging

### Testing Requirements
- Write unit tests for all new functions
- Test error paths and edge cases
- Mock external dependencies (Azure DevOps API, Azure CLI)
- Aim for >80% code coverage

## Authentication & Configuration

**Azure DevOps Authentication:**
- Uses Azure CLI token-based authentication
- No PAT tokens required
- User must be logged in: `az login`
- Tokens cached automatically

**Configuration Files:**
- `mcp_server/.ado-mcp-config.json` - Server configuration
- Environment variables override config values
- CLI arguments have highest priority

## Important Files & Directories

### Core Implementation
- `mcp_server/src/index.ts` - Server entry point
- `mcp_server/src/hybridTransport.ts` - Transport layer (stdio/SSE)
- `mcp_server/src/services/tool-service.ts` - Tool routing orchestrator
- `mcp_server/src/services/handlers/` - Individual tool implementations

### Configuration & Schemas
- `mcp_server/src/config/config.ts` - Configuration loading
- `mcp_server/src/config/schemas.ts` - Zod validation schemas
- `mcp_server/src/config/tool-configs.ts` - Tool registry

### AI Features
- `mcp_server/src/services/sampling-service.ts` - LLM integration
- `mcp_server/src/services/analyzers/` - AI-powered analysis tools
- `mcp_server/prompts/` - Prompt templates for AI features

### Azure DevOps Integration
- `mcp_server/src/services/ado-work-item-service.ts` - Work item operations
- `mcp_server/src/services/ado-discovery-service.ts` - Resource discovery
- `mcp_server/src/services/query-handle-service.ts` - Safe bulk operations

## Feature Development Workflow

### Adding a New Tool

1. **Define Schema** (`config/schemas.ts`):
   ```typescript
   export const myToolSchema = z.object({
     workItemId: z.number(),
     // ... other params
   });
   ```

2. **Register Tool** (`config/tool-configs.ts`):
   ```typescript
   export const TOOL_CONFIGS: ToolConfigs = {
     'my-tool-name': {
       schema: myToolSchema,
       description: 'What this tool does',
       // ... config
     }
   };
   ```

3. **Create Handler** (`services/handlers/my-tool-handler.ts`):
   ```typescript
   export async function handleMyTool(
     args: z.infer<typeof myToolSchema>,
     services: Services
   ): Promise<ToolExecutionResult> {
     try {
       // Implementation
       return {
         success: true,
         data: result,
         errors: [],
         warnings: []
       };
     } catch (error) {
       return formatError(error);
     }
   }
   ```

4. **Wire Up** (`services/tool-service.ts`):
   ```typescript
   case 'my-tool-name':
     return handleMyTool(validated, services);
   ```

5. **Write Tests** (`test/unit/my-tool.test.ts`)

6. **Create Feature Spec** (`docs/feature_specs/my-tool.md`)

### Adding AI-Powered Features

1. **Create System Prompt** (`prompts/system/my-feature.md`)
2. **Create Analyzer** (`services/analyzers/my-feature-analyzer.ts`)
3. **Add to Sampling Service** if needed
4. **Follow standard tool creation workflow**
5. **Document sampling requirements**

## Documentation Requirements

### When Adding a New Feature
**REQUIRED:** Create a feature spec at `docs/feature_specs/<feature-name>.md` with:
- Feature overview and purpose
- User-facing behavior
- Input parameters and validation
- Output format and examples
- Error handling scenarios
- Integration points
- Testing considerations

**Update:** `docs/feature_specs/toc.yml` with new entry

### When Modifying an Existing Feature
**REQUIRED:** Update the corresponding feature spec in `docs/feature_specs/`

### Forbidden Documentation
**NEVER create** unless explicitly requested:
- Summary files (`*_SUMMARY.md`, `*_COMPLETE.md`, `*_REPORT.md`)
- Implementation status documents
- Changelogs outside git commits
- Verbose architecture docs (code comments preferred)

### Acceptable Documentation Updates
- Updating existing `/docs` files with user-facing info
- Adding `/mcp_server/resources` quick reference guides
- Code comments for complex logic
- Feature specs for new/modified features

## Common Pitfalls to Avoid

### Query Handle Pattern
❌ **Wrong:** Exposing work item IDs to LLM
```typescript
// BAD - IDs can be hallucinated
assignWorkItems([12345, 12346, 12347]);
```

✅ **Correct:** Use query handles
```typescript
// GOOD - Query handle prevents hallucination
const handle = await executeWiqlQuery(query, { returnHandle: true });
await bulkAssignWorkItems(handle, { itemSelector: "all" });
```

### Error Handling
❌ **Wrong:** Throwing uncaught errors
```typescript
throw new Error("Something failed");
```

✅ **Correct:** Return structured errors
```typescript
return {
  success: false,
  errors: ["Failed to update work item: Item not found"],
  data: null
};
```

### Prompt Templates
❌ **Wrong:** Hardcoded prompts in code
```typescript
const prompt = "You are an AI that analyzes work items...";
```

✅ **Correct:** External prompt files
```typescript
const prompt = await promptService.loadPrompt('ai-assignment-analyzer');
```

## MCP Server Patterns

### Tool Result Format
All tools must return `ToolExecutionResult`:
```typescript
interface ToolExecutionResult {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
  raw?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };
  metadata?: Record<string, any>;
}
```

### Configuration Defaults
Tools automatically merge:
1. User-provided arguments (highest priority)
2. Configuration file values
3. Schema defaults (lowest priority)

### Validation Flow
1. Parse args against Zod schema
2. Validate business rules
3. Execute operation
4. Format response

## Testing Guidelines

### Unit Tests
- Mock external dependencies
- Test happy path and error cases
- Validate schema enforcement
- Check error messages

### Integration Tests
- Use real Azure CLI (development environment)
- Test end-to-end workflows
- Verify external API contracts
- Clean up test data

### Test Structure
```typescript
describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle valid input', async () => {
    // Test implementation
  });

  it('should reject invalid input', async () => {
    // Test validation
  });

  it('should handle API errors gracefully', async () => {
    // Test error handling
  });
});
```

## File Organization

Understanding where files belong is critical for maintainability. This section provides clear guidance on file placement decisions.

### Handler Organization (`mcp_server/src/services/handlers/`)

Handlers are organized by functional category. Use this decision tree:

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

**Handler Categories:**
- `core/` - Basic CRUD operations, configuration, discovery
- `query/` - WIQL and OData query execution
- `query-handles/` - Query handle inspection and validation
- `bulk-operations/` - Non-AI bulk updates using query handles
- `ai-powered/` - AI-enhanced operations requiring LLM sampling
- `analysis/` - Rule-based pattern detection and validation
- `integration/` - External service integrations (GitHub Copilot, etc.)
- `context/` - Rich context package operations

**Naming Convention:** `<action>-<subject>.handler.ts`
- ✅ `create-new-item.handler.ts`
- ✅ `bulk-assign-by-query-handle.handler.ts`
- ❌ `createNewItem.handler.ts` (use kebab-case)

See `mcp_server/src/services/handlers/README.md` for detailed category descriptions.

### Service File Organization (`mcp_server/src/services/`)

**When to create a new service:**
- New external system integration (e.g., `github-service.ts`)
- Distinct business domain (e.g., `ado-discovery-service.ts`)
- Complex shared logic used by multiple handlers

**When to extend existing service:**
- Adding operations to existing domain (e.g., new work item operations → `ado-work-item-service.ts`)
- New query patterns → `query-handle-service.ts`
- New sampling capabilities → `sampling-service.ts`

**Service File Naming:** `<domain>-service.ts`
- ✅ `ado-work-item-service.ts`
- ✅ `query-handle-service.ts`
- ❌ `workItemService.ts` (use kebab-case)

**Analyzers Subdirectory:** `mcp_server/src/services/analyzers/`
- AI-powered analysis classes using LLM sampling
- Pattern: `<feature>-analyzer.ts`
- Example: `ai-assignment-analyzer.ts`

### Test File Organization (`mcp_server/test/`)

```
test/
├── unit/                    # Fast, isolated tests with mocks
├── integration/             # End-to-end workflows with real-ish data
└── setup.ts                 # Jest configuration
```

**Naming Conventions:**
- Unit tests: `<feature-name>.test.ts`
- Integration tests: `<feature>-integration.test.ts`
- Test helpers: `<helper-name>.test-helper.ts` (if needed)

**Where to place tests:**
- All tests go in `test/unit/` or `test/integration/`
- No subdirectories by feature (flat structure)
- Tests import from handler subdirectories as needed

**What to test:**
- Unit tests: Individual functions with mocked dependencies
- Integration tests: Complete tool workflows

See `.github/instructions/tests.instructions.md` for detailed testing patterns.

### Documentation Organization

**Feature Specifications:** `docs/feature_specs/`
- **REQUIRED** for all new features
- Naming: `SCREAMING_SNAKE_CASE.md` (e.g., `AI_POWERED_FEATURES.md`)
- Update `docs/feature_specs/toc.yml` when adding new specs
- Include: overview, inputs, outputs, examples, errors, testing

**User Guides:** `docs/guides/`
- How-to guides for specific workflows
- Naming: `SCREAMING_SNAKE_CASE.md`
- Update `docs/guides/toc.yml` when adding new guides

**Quick References:** `mcp_server/resources/`
- Concise, scannable references for AI agents
- Naming: `kebab-case.md`
- Focus on practical usage, not implementation details
- Examples: `wiql-quick-reference.md`, `query-handle-pattern.md`

**Architecture Docs:** `docs/`
- `ARCHITECTURE.md` - System architecture
- `CONTRIBUTING.md` - Contribution guidelines
- `README.md` - Documentation index

**Prompts:** `mcp_server/prompts/`
- User prompts (multi-turn workflows): root directory with `snake_case.md`
- System prompts (AI instructions): `system/` subdirectory with `kebab-case.md`
- Template variables: `{{variableName}}`

### Configuration File Organization

**Configuration Files:**
- `mcp_server/src/config/config.ts` - Configuration loading logic
- `mcp_server/src/config/schemas.ts` - Zod validation schemas
- `mcp_server/src/config/tool-configs.ts` - Tool registry

**When to modify:**
- New tool parameter → Add to `schemas.ts`
- New tool → Add to `tool-configs.ts`
- New config option → Update `config.ts` and schema

**User Configuration:**
- `mcp_server/.ado-mcp-config.json` - User-specific settings
- Not committed to repo (in `.gitignore`)

### Decision Tree: "Where Does My File Go?"

```
What type of file are you creating?

Handler (tool implementation)?
├─ Use handler decision tree above
└─ Place in: mcp_server/src/services/handlers/<category>/

Service (business logic)?
├─ New domain? → Create: mcp_server/src/services/<domain>-service.ts
└─ Extend existing? → Modify existing service file

Analyzer (AI-powered analysis)?
└─ Place in: mcp_server/src/services/analyzers/<feature>-analyzer.ts

Test file?
├─ Unit test? → Place in: mcp_server/test/unit/<feature>.test.ts
└─ Integration test? → Place in: mcp_server/test/integration/<feature>-integration.test.ts

Documentation?
├─ Feature spec? → docs/feature_specs/<FEATURE_NAME>.md + update toc.yml
├─ User guide? → docs/guides/<GUIDE_NAME>.md + update toc.yml
├─ Quick reference? → mcp_server/resources/<topic>-guide.md
├─ Architecture? → docs/ARCHITECTURE.md (update existing)
└─ Contributing? → docs/CONTRIBUTING.md (update existing)

Prompt template?
├─ User prompt (multi-turn)? → mcp_server/prompts/<workflow_name>.md
└─ System prompt (AI instructions)? → mcp_server/prompts/system/<feature>.md

Configuration?
├─ New schema? → mcp_server/src/config/schemas.ts
├─ New tool? → mcp_server/src/config/tool-configs.ts
└─ Config loading? → mcp_server/src/config/config.ts

Type definitions?
└─ Place in: mcp_server/src/types/<domain>.ts

Utility function?
└─ Place in: mcp_server/src/utils/<utility>.ts
```

### File Placement Reasoning

**Why handlers are categorized:**
- Easier to find related code
- Logical grouping by functionality
- Clearer dependencies and patterns
- Simpler onboarding for contributors

**Why tests are flat:**
- Faster test discovery
- Simpler import paths
- No need to mirror source structure
- Focus on what's tested, not where it lives

**Why documentation is split:**
- `docs/` - User-facing, essential information
- `mcp_server/resources/` - Agent-facing, quick references
- Separation of concerns (users vs. AI agents)

**Why prompts have subdirectories:**
- System prompts define AI behavior (reusable)
- User prompts define workflows (top-level)
- Clear distinction between instruction and orchestration

## Resources for Agents

Quick reference guides in `mcp_server/resources/`:
- `wiql-quick-reference.md` - WIQL query syntax
- `query-handle-pattern.md` - Safe bulk operations
- `common-workflows.md` - Typical usage patterns
- `tool-discovery-guide.md` - Finding the right tool

## Related Projects

This server is designed to work with:
- **GitHub Copilot** - AI pair programmer
- **Claude** - Anthropic's AI assistant
- **Custom MCP Clients** - Any MCP-compatible client


