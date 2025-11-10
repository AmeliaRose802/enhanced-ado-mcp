# Enhanced ADO MCP Server - Agent Instructions

This is an **Azure DevOps Model Context Protocol (MCP) Server** that enables AI agents to interact with Azure DevOps work items, queries, and projects.

## 🔗 Task Tracking with Beads

**IMPORTANT:** This project uses **[bd (beads)](https://github.com/steveyegge/beads)** for ALL task tracking and issue management.

### Quick Start with Beads

```bash
# If not initialized, run once
bd init --quiet

# Check for ready work
bd ready --json

# Create issues
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Found issue" -p 1 --deps discovered-from:<parent-id> --json

# Update issues
bd update <id> --status in_progress --json
bd update <id> --priority 1 --json

# Complete work
bd close <id> --reason "Done" --json

# End of session - sync immediately
bd sync
```

**DO NOT:**
- Create markdown TODO lists
- Use `/tasklist` directory (deprecated)
- Create external tracking systems

For complete beads documentation, see the "TASK TRACKING WITH BEADS" section in `.github/copilot-instructions.md`.

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

## Development Features

### Hot Reload for Prompts

The MCP server automatically watches the `prompts/` directory for changes and notifies all connected VS Code windows to reload prompts when files are modified.

**How it works:**
1. File watcher monitors `prompts/` directory (recursive)
2. When a `.md` file changes, the prompt cache is cleared
3. Server sends `notifications/prompts/list_changed` to all connected clients
4. VS Code automatically reloads prompts without requiring server restart

**Benefits:**
- Edit prompts and see changes immediately in all VS Code windows
- No need to restart the MCP server or reload VS Code
- Supports development across multiple workspaces

**Implementation:**
- `mcp_server/src/utils/prompt-loader.ts` - File watcher and cache management
- `mcp_server/src/index.ts` - Notification setup and lifecycle management

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

**Configuration:**
- **CLI arguments** - Organization (required), area path (required)
- **Automatic project extraction** - Project name extracted from area path (first segment)
- **Built-in defaults** - Work item type, priority, assignee, branch
- **Auto-discovery** - GitHub Copilot GUID discovered automatically
- **No config file needed** - All configuration via CLI arguments and auto-discovery

**Usage Examples:**
```bash
# Single area path - project extracted automatically
enhanced-ado-mcp myorg --area-path "MyProject\\Team\\Area"

# Multiple area paths (multi-area support)
enhanced-ado-mcp myorg --area-path "ProjectA\\Team1" --area-path "ProjectA\\Team2"

# Short flag alias
enhanced-ado-mcp myorg -a "MyProject\\Team"
```

## Important Files & Directories

### Core Implementation
- `mcp_server/src/index.ts` - Server entry point
- `mcp_server/src/hybridTransport.ts` - Transport layer (stdio/SSE)
- `mcp_server/src/services/tool-service.ts` - Tool routing orchestrator
- `mcp_server/src/services/handlers/` - Individual tool implementations

### Configuration & Schemas
- `mcp_server/src/config/config.ts` - Configuration loading
- `mcp_server/src/config/schemas.ts` - Zod validation schemas
- `mcp_server/src/config/tool-configs/` - Tool registry (split by category)

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

2. **Register Tool** (add to appropriate file in `config/tool-configs/`):
   ```typescript
   // In work-item-creation.ts, bulk-operations.ts, etc.
   export const categoryTools: ToolConfig[] = [
     {
       name: 'my-tool-name',
       schema: myToolSchema,
       description: 'What this tool does',
       // ... config
     }
   ];
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
- **Markdown TODO lists** (use `bd` for task tracking)

### Acceptable Documentation Updates
- Updating existing `/docs` files with user-facing info
- Adding `/mcp_server/resources` quick reference guides
- Code comments for complex logic
- Feature specs for new/modified features
- **bd issues** for task tracking and work discovery

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


