# Enhanced ADO MCP Server Architecture

## Overview

This document describes the architectural design of the Enhanced ADO MCP Server, explaining the key components, data flow, and design decisions.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Client                            │
│                   (VS Code, Claude, etc.)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol (stdio/SSE)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Server (Node.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Hybrid Transport Layer                      │   │
│  │   (stdio for VS Code, SSE for web clients)          │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │              Tool Service                             │   │
│  │        (Tool routing & orchestration)                 │   │
│  └─┬──────────────────────────────────────────────────┬─┘   │
│    │                                                    │     │
│    ├─► Config Service                                  │     │
│    ├─► Prompt Service                                  │     │
│    ├─► Sampling Service (AI Features)                  │     │
│    ├─► ADO Work Item Service                           │     │
│    └─► ADO Discovery Service                           │     │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌───────────┐
   │  Azure  │  │ VS Code  │  │ Local FS  │
   │ DevOps  │  │   LLM    │  │ (Prompts) │
   │   API   │  │ Sampling │  │           │
   └─────────┘  └──────────┘  └───────────┘
```

## Core Components

### 1. Transport Layer (`hybridTransport.ts`)

**Purpose:** Handle communication between MCP clients and the server

**Responsibilities:**
- Accept stdio connections (VS Code)
- Accept SSE connections (web clients)
- Route messages to appropriate handlers
- Manage connection lifecycle

**Design Decisions:**
- Hybrid approach supports multiple client types
- Stdio for VS Code provides best integration
- SSE enables web-based clients

### 2. Tool Service (`tool-service.ts`)

**Purpose:** Central orchestrator for all tool executions

**Responsibilities:**
- Route tool calls to appropriate handlers
- Manage server instance for sampling features
- Validate tool names and configurations
- Coordinate between services

**Key Methods:**
- `executeTool(name, args)` - Main entry point
- `setServerInstance(server)` - Enable sampling
- `getToolConfig(name)` - Configuration lookup

### 3. Configuration System (`config/`)

**Components:**
- `config.ts` - Configuration loading and validation
- `schemas.ts` - Zod schemas for input validation
- `tool-configs.ts` - Tool registry and metadata

**Configuration Sources (Priority Order):**
1. CLI arguments (highest priority)
2. Environment variables
3. Schema defaults (lowest priority)

**Design Pattern:** Singleton with lazy loading

### 4. Services Layer

#### ADO Work Item Service (`ado-work-item-service.ts`)

**Purpose:** Azure DevOps REST API operations

**Key Operations:**
- Create work items with parent relationships
- Assign work items to GitHub Copilot
- Query via WIQL
- Extract security links
- Manage work item lifecycle

**Authentication:** Azure CLI token-based

#### ADO Discovery Service (`ado-discovery-service.ts`)

**Purpose:** Discover ADO resources (areas, iterations, repos)

**Use Cases:**
- Validate area paths before creation
- List available repositories
- Discover team iterations

#### Sampling Service (`sampling-service.ts`)

**Purpose:** LLM-powered analysis using VS Code sampling

**Capabilities:**
- Work item intelligence analysis
- AI assignment suitability
- Feature decomposition
- Hierarchy validation

**Requirements:**
- VS Code with GitHub Copilot
- Language model access granted

#### Prompt Service (`prompt-service.ts`)

**Purpose:** Load and render prompt templates

**Features:**
- Template loading from filesystem
- Variable substitution (`{{var}}`)
- System vs. user prompt distinction
- Metadata parsing

### 5. Handlers Layer (`services/handlers/`)

**Purpose:** Thin wrappers for tool implementations

**Pattern:** One handler per MCP tool, organized by category

**Handler Categories:**
- `core/` - Basic operations (create-new-item, get-configuration, batch-context)
- `context/` - Context retrieval (get-work-item-context-package)
- `query/` - Query operations (wiql-query, odata-analytics, generate-wiql-query, generate-odata-query)
- `query-handles/` - Query handle management (inspect, validate, select, list)
- `bulk-operations/` - Bulk updates (bulk-comment, bulk-update, bulk-assign, bulk-remove)
- `integration/` - External integrations (assign-to-copilot, new-copilot-item)
- `analysis/` - Pattern detection and validation (detect-patterns, validate-hierarchy, get-last-substantive-change, extract-security-links)
- `ai-powered/` - AI-enhanced operations (analyze-by-query-handle, bulk-enhance-descriptions, bulk-assign-story-points, bulk-add-acceptance-criteria)

**Responsibilities:**
- Parse and validate input
- Apply configuration defaults
- Call service methods
- Format response as `ToolExecutionResult`
- Handle errors gracefully

**Example Flow:**
```typescript
1. Handler receives raw args
2. Validate against schema
3. Merge with config defaults
4. Call service method
5. Format response
6. Return ToolExecutionResult
```

### 6. Analyzers (`services/analyzers/`)

**Purpose:** Complex AI-powered analysis implementations

**Components:**
- `work-item-intelligence.ts` - Completeness and quality analysis
- `ai-assignment.ts` - AI assignment suitability scoring
- `hierarchy-validator.ts` - Parent-child hierarchy validation
- `personal-workload.ts` - Burnout and workload risk analysis
- `sprint-planner.ts` - AI-assisted sprint planning and capacity balancing
- `tool-discovery.ts` - Natural language tool discovery

**Pattern:** Use SamplingService for LLM calls

## Data Flow

### Standard Tool Execution Flow

```
1. Client sends tool call request
   ↓
2. Transport layer receives message
   ↓
3. Tool Service routes to appropriate handler
   ↓
4. Handler validates input & applies config
   ↓
5. Service performs business logic
   ↓
6. External API calls (Azure DevOps)
   ↓
7. Response formatted as ToolExecutionResult
   ↓
8. Transport layer sends response to client
```

### AI-Powered Analysis Flow

```
1. Client requests AI analysis
   ↓
2. Handler routes to Sampling Service
   ↓
3. Load system prompt template
   ↓
4. Substitute variables
   ↓
5. Request sampling from VS Code
   ↓
6. VS Code LLM processes prompt
   ↓
7. Parse LLM response
   ↓
8. Format structured result
   ↓
9. Return to client
```

## Design Patterns

### 1. Service Layer Pattern

**Why:** Separate business logic from request handling

**Benefits:**
- Testable business logic
- Reusable across handlers
- Clear separation of concerns

### 2. Registry Pattern (Tool Configs)

**Why:** Centralize tool metadata

**Benefits:**
- Single source of truth
- Easy to add new tools
- Consistent schema validation

### 3. Template Pattern (Prompts)

**Why:** Separate prompt engineering from code

**Benefits:**
- Iterate on prompts without code changes
- Version control for prompts
- Easier to maintain and update

### 4. Facade Pattern (Services)

**Why:** Hide complexity of Azure DevOps API

**Benefits:**
- Consistent interface
- Error handling in one place
- Easy to mock for testing

## Authentication & Security

### Azure DevOps Authentication

**Method:** Azure CLI token-based

**Flow:**
```
1. Server requests token: az account get-access-token
2. Token used as Bearer token in API calls
3. Token cached for session duration
4. Refresh on expiration
```

**Benefits:**
- No PAT management required
- Uses existing Azure login
- Automatic token refresh
- Secure (no secrets in config)

### VS Code Sampling Security

**Method:** User permission-based

**Flow:**
```
1. First sampling request triggers permission prompt
2. User grants/denies access
3. Permission persisted by VS Code
4. Future requests use granted permission
```

## Error Handling Strategy

### Levels of Error Handling

1. **Input Validation** (Zod schemas)
   - Catch invalid inputs early
   - Provide clear error messages
   - Return structured errors

2. **Service Layer** (try-catch)
   - Wrap external API calls
   - Log errors with context
   - Convert to user-friendly messages

3. **Handler Layer** (response formatting)
   - Always return ToolExecutionResult
   - Include errors array
   - Include warnings array
   - Metadata for debugging

### Error Response Format

```typescript
{
  success: false,
  data: null,
  errors: ["Human-readable error message"],
  warnings: ["Warning message"],
  raw: {
    stdout: "",
    stderr: "Raw error output",
    exitCode: 1
  },
  metadata: {
    timestamp: "2025-10-01T12:00:00Z",
    tool: "wit-create-new-item"
  }
}
```

## Performance Considerations

### Caching

- **Config**: Loaded once, cached for session
- **Prompts**: Loaded on first use, cached
- **Tokens**: Cached until expiration

### Optimization Strategies

1. **Parallel Requests**: Batch work item queries
2. **Lazy Loading**: Load configs/prompts on demand
3. **Connection Pooling**: Reuse HTTP connections
4. **Minimal Data**: Request only needed fields from ADO

## Testing Strategy

### Unit Tests
- Individual functions and methods
- Mock external dependencies
- Fast execution (<1ms per test)

### Integration Tests
- Real API calls (development environment)
- End-to-end tool execution
- Verify external integrations

### Test Organization
```
test/
├── unit/
│   ├── config.test.ts
│   ├── prompt-service.test.ts
│   └── ...
└── integration/
    ├── wiql-query-integration.test.ts
    ├── work-item-creation-integration.test.ts
    └── ...
```

## Query Handle Service & Item Selection (v1.5.0)

### Overview

The Query Handle Service provides an anti-hallucination architecture for safe bulk operations. Instead of manually extracting and passing work item IDs, clients work with opaque query handles that maintain validated item context.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Query Handle Lifecycle                 │
└──────────────────────────────────────────────────────────┘

1. Query Phase
   ┌─────────────────┐
   │  WIQL Query     │
   │  + Handle Flag  │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Query Handle    │  "qh_abc123"
   │ Created         │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Item Context    │  Map<id, {state, tags, title, ...}>
   │ Stored          │
   └─────────────────┘

2. Inspection Phase (Optional)
   ┌─────────────────┐
   │ Inspect Handle  │
   │ Preview Items   │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Display Items   │  Index, ID, Title, State, Tags
   │ With Metadata   │
   └─────────────────┘

3. Selection Phase (NEW!)
   ┌─────────────────┐
   │ Select Items    │
   │ + Selector      │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Preview Match   │  "Would select 5 of 10 items"
   │ Display Items   │
   └─────────────────┘

4. Execution Phase
   ┌─────────────────┐
   │ Bulk Operation  │
   │ + Selector      │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Select Items    │  Apply selector criteria
   │ From Context    │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Execute Action  │  Update, comment, assign, etc.
   │ On Selected     │
   └─────────────────┘
```

### Query Handle Storage

**Data Structure:**
```typescript
interface QueryHandleData {
  workItemIds: number[];              // Ordered list of IDs
  wiqlQuery: string;                  // Original query
  createdAt: Date;                    // For expiration
  itemContext: Map<number, ItemContext>;  // Rich metadata
}

interface ItemContext {
  id: number;
  title: string;
  state: string;
  type: string;
  tags: string[];
  index: number;                      // Position in result
  changedDate?: Date;
  daysInactive?: number;              // For staleness
}
```

**Storage Characteristics:**
- In-memory storage with 5-minute expiration
- Atomic operations (store, retrieve, delete)
- Thread-safe access patterns
- Automatic cleanup of expired handles

### Item Selection Mechanisms

#### 1. Select All
```typescript
itemSelector: "all"
```
**Implementation:**
- Returns all work item IDs from handle
- No filtering or validation needed
- O(1) complexity

**Use Cases:**
- WIQL already filtered to target items
- Small result sets (<50 items)
- Non-destructive operations

#### 2. Index-Based Selection
```typescript
itemSelector: [0, 2, 5]  // Zero-based indices
```
**Implementation:**
```typescript
selectByIndices(indices: number[]): number[] {
  const validIndices = indices.filter(i => 
    i >= 0 && i < this.workItemIds.length
  );
  return validIndices.map(i => this.workItemIds[i]);
}
```
**Validation:**
- Bounds checking (0 <= index < length)
- Duplicate removal
- Invalid indices logged as warnings

**Use Cases:**
- User specifies "items 1, 3, and 5"
- After inspection, select specific positions
- Testing with specific items

#### 3. Criteria-Based Selection
```typescript
itemSelector: {
  states: ["Active", "In Progress"],
  tags: ["critical"],
  titleContains: "auth",
  daysInactiveMin: 7,
  daysInactiveMax: 30
}
```
**Implementation:**
```typescript
selectByCriteria(criteria: SelectionCriteria): number[] {
  return this.itemContext.values()
    .filter(item => {
      // AND logic for all criteria
      if (criteria.states && !criteria.states.includes(item.state)) 
        return false;
      if (criteria.tags && !criteria.tags.some(t => item.tags.includes(t)))
        return false;
      if (criteria.titleContains && !item.title.includes(criteria.titleContains))
        return false;
      if (criteria.daysInactiveMin && item.daysInactive < criteria.daysInactiveMin)
        return false;
      if (criteria.daysInactiveMax && item.daysInactive > criteria.daysInactiveMax)
        return false;
      return true;
    })
    .map(item => item.id);
}
```

**Complexity:** O(n * c) where n = items, c = criteria checks

**Use Cases:**
- "All critical Active bugs"
- "Items inactive for 7-30 days"
- Complex filtering without WIQL

### Selection Workflow Sequence Diagram

```
┌──────┐         ┌────────┐         ┌─────────────┐         ┌─────────┐
│Client│         │ Handler│         │Query Handle │         │   ADO   │
│      │         │        │         │   Service   │         │   API   │
└───┬──┘         └───┬────┘         └──────┬──────┘         └────┬────┘
    │                │                      │                     │
    │ 1. WIQL Query  │                      │                     │
    ├───────────────>│                      │                     │
    │ + returnHandle │ 2. Execute Query     │                     │
    │                ├─────────────────────────────────────────>  │
    │                │                      │  3. Work Items      │
    │                │<─────────────────────────────────────────  │
    │                │ 4. Store Handle      │                     │
    │                ├─────────────────────>│                     │
    │                │ + Item Context       │                     │
    │  queryHandle   │                      │                     │
    │<───────────────┤                      │                     │
    │                │                      │                     │
    │ 5. Inspect     │                      │                     │
    ├───────────────>│ 6. Get Context       │                     │
    │                ├─────────────────────>│                     │
    │  Item List     │<─────────────────────┤                     │
    │<───────────────┤                      │                     │
    │                │                      │                     │
    │ 7. Select Items│                      │                     │
    ├───────────────>│ 8. Apply Selector    │                     │
    │ + itemSelector ├─────────────────────>│                     │
    │                │ 9. Filtered IDs      │                     │
    │  Preview       │<─────────────────────┤                     │
    │<───────────────┤                      │                     │
    │                │                      │                     │
    │ 10. Bulk Op    │                      │                     │
    ├───────────────>│ 11. Apply Selector   │                     │
    │ + itemSelector ├─────────────────────>│                     │
    │                │ 12. Selected IDs     │                     │
    │                │<─────────────────────┤                     │
    │                │ 13. Execute Updates  │                     │
    │                ├─────────────────────────────────────────>  │
    │  Result        │                      │                     │
    │<───────────────┤                      │                     │
    │                │                      │                     │
```

### Benefits of Handle-Based Architecture

1. **Anti-Hallucination**: IDs never exposed to LLM, eliminating fabricated ID risks
2. **Validation**: All operations work only on queried items
3. **Context Preservation**: Rich metadata available throughout workflow
4. **Safe Defaults**: Explicit itemSelector required prevents accidental operations
5. **Auditability**: Full chain of query → selection → operation tracked

### Performance Considerations

**Selection Performance:**
- Select All: O(1) - direct return of stored IDs
- Index-Based: O(k) where k = number of indices
- Criteria-Based: O(n) where n = items in handle

**Memory Usage:**
- ~1KB per work item in context
- 5-minute expiration prevents unbounded growth
- Typical usage: 10-100 items per handle = 10-100KB

**Optimization Strategies:**
1. Use "all" selector when possible (fastest)
2. Prefer index-based for small selections
3. Use criteria-based for complex filtering
4. Clean up expired handles automatically

### Error Handling

**Invalid Selector:**
```typescript
{
  success: false,
  errors: ["Invalid itemSelector: must be 'all', array of indices, or criteria object"]
}
```

**Expired Handle:**
```typescript
{
  success: false,
  errors: ["Query handle 'qh_abc123' not found or expired"]
}
```

**No Matching Items:**
```typescript
{
  success: true,
  warnings: ["No items matched selection criteria"],
  data: { selected_items_count: 0 }
}
```

## Extensibility

### Adding a New Tool

1. Define Zod schema in `config/schemas.ts`
2. Add tool config to `config/tool-configs.ts`
3. Create handler in `services/handlers/`
4. Add service method if needed
5. Wire up in `tool-service.ts`
6. Add tests
7. Update documentation

### Adding a New AI Feature

1. Create system prompt in `prompts/system/`
2. Create analyzer in `services/analyzers/`
3. Add method to `SamplingService`
4. Follow "Adding a New Tool" steps
5. Document sampling requirements

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` - MCP protocol
- `zod` - Schema validation
- `node:child_process` - Execute Azure CLI
- `node:fs` - File system operations

### Development
- `typescript` - Type safety
- `tsx` - Development runtime
- `@types/node` - Node.js types

### External APIs
- Azure DevOps REST API v7.1
- Azure CLI (az)
- VS Code Language Model API (sampling)

## Future Architecture Considerations

### Planned Enhancements

1. **Connection Pooling**: Optimize API calls
2. **Request Queuing**: Handle rate limits
3. **Webhook Support**: Real-time updates
4. **Plugin System**: Extensible tool architecture
5. **Multi-tenant**: Support multiple orgs/projects

### Migration Path

- Phase out PowerShell completely ✅ (In Progress)
- Standardize on REST API ✅ (Completed)
- Add comprehensive testing 🔄 (In Progress)
- Improve error messages 📋 (Planned)
- Add telemetry 📋 (Planned)

---

**Last Updated:** 2025-10-07  
**Version:** 1.5.0
