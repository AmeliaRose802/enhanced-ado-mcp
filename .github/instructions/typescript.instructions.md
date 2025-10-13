---
applyTo: "mcp_server/src/**"
description: "TypeScript source code implementation guidelines"
---

# TypeScript Source Code Instructions

This directory contains the main TypeScript source code for the MCP server.

## Code Organization

```
src/
├── index.ts              # Server entry point and initialization
├── hybridTransport.ts    # MCP transport layer (stdio/SSE)
├── types/                # TypeScript type definitions
├── config/               # Configuration and schemas
│   ├── config.ts
│   ├── schemas.ts
│   └── tool-configs/     # Tool registry by category
│       ├── index.ts
│       ├── work-item-creation.ts
│       ├── bulk-operations.ts
│       └── ... (8 category files)
├── services/             # Business logic layer
│   ├── tool-service.ts
│   ├── handlers/         # Tool implementations
│   └── analyzers/        # AI-powered analysis
└── utils/                # Shared utilities
```

## TypeScript Standards

### Type Safety

**Always use strict TypeScript:**
```typescript
// tsconfig.json has strict: true
// This means:
// - No implicit any
// - Strict null checks
// - Strict function types
// - Strict property initialization
```

### Type Definitions

✅ **Prefer interfaces for object shapes:**
```typescript
export interface WorkItem {
  id: number;
  fields: Record<string, any>;
  relations?: WorkItemRelation[];
}
```

✅ **Use type aliases for unions and complex types:**
```typescript
export type ItemSelector = 'all' | number[] | SelectionCriteria;
export type ToolResult = SuccessResult | ErrorResult;
```

✅ **Export types for reusability:**
```typescript
export type ToolExecutionResult = {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
};
```

### Zod Schemas for Runtime Validation

**Define schema and infer type:**
```typescript
import { z } from 'zod';

// Define runtime schema
export const workItemSchema = z.object({
  id: z.number().int().positive(),
  type: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  assignedTo: z.string().email().optional()
});

// Infer TypeScript type
export type WorkItemInput = z.infer<typeof workItemSchema>;

// Use in function
export function createWorkItem(input: WorkItemInput) {
  // TypeScript knows all the types
  // Runtime validation ensures correctness
}
```

### Async/Await Pattern

**Always use async/await for promises:**
```typescript
// ✅ Good
async function fetchWorkItem(id: number): Promise<WorkItem> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch: ${error.message}`);
  }
}

// ❌ Avoid .then() chains
function fetchWorkItem(id: number): Promise<WorkItem> {
  return fetch(url)
    .then(r => r.json())
    .then(data => data)
    .catch(err => { throw new Error(err.message); });
}
```

### Error Handling

**Pattern 1: Try-catch for async operations:**
```typescript
async function doOperation(): Promise<Result> {
  try {
    const result = await externalCall();
    return processResult(result);
  } catch (error) {
    if (error instanceof NetworkError) {
      throw new Error('Network unavailable');
    }
    throw new Error(`Operation failed: ${error.message}`);
  }
}
```

**Pattern 2: Return result type for handlers:**
```typescript
async function handleTool(args: Args): Promise<ToolExecutionResult> {
  try {
    const data = await performOperation(args);
    return {
      success: true,
      data,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: [error.message],
      warnings: []
    };
  }
}
```

### Null and Undefined Handling

**Use optional chaining and nullish coalescing:**
```typescript
// Optional chaining
const title = workItem?.fields?.['System.Title'];

// Nullish coalescing
const state = workItem?.fields?.['System.State'] ?? 'New';

// Optional parameters with defaults
function analyze(item: WorkItem, deep = false) {
  // deep defaults to false if not provided
}

// Discriminated unions for null handling
type MaybeWorkItem = 
  | { found: true; item: WorkItem }
  | { found: false; error: string };
```

## Code Style

### Naming Conventions

```typescript
// Classes: PascalCase
class WorkItemService { }
class QueryHandleService { }

// Interfaces: PascalCase with descriptive names
interface ToolExecutionResult { }
interface WorkItemContext { }

// Functions/methods: camelCase
function createWorkItem() { }
async function fetchData() { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;

// Private members: camelCase with underscore prefix (optional)
class Service {
  private _cache: Map<string, any>;
  private config: Config;
}

// Type parameters: Single uppercase letter or PascalCase
function identity<T>(value: T): T { }
function map<TInput, TOutput>(input: TInput): TOutput { }
```

### Function Structure

```typescript
/**
 * JSDoc comment describing what the function does.
 * 
 * @param workItemId - The ID of the work item to fetch
 * @param includeRelations - Whether to include related items
 * @returns Promise resolving to the work item
 * @throws {Error} If work item not found or API call fails
 */
async function getWorkItem(
  workItemId: number,
  includeRelations = false
): Promise<WorkItem> {
  // 1. Validate input
  if (workItemId <= 0) {
    throw new Error('Invalid work item ID');
  }

  // 2. Perform operation
  const url = buildUrl(workItemId, includeRelations);
  const response = await fetch(url);

  // 3. Handle response
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // 4. Return result
  return response.json();
}
```

### Import Organization

```typescript
// 1. External dependencies
import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// 2. Internal types
import type { WorkItem, ToolExecutionResult } from '../types';

// 3. Internal modules
import { config } from './config/config';
import { WorkItemService } from './services/ado-work-item-service';

// 4. Relative imports
import { formatError } from './utils/error-formatter';
```

### Comments

**When to comment:**
```typescript
// ✅ Complex business logic
// Calculate days since last update, excluding weekends
const daysSinceUpdate = calculateBusinessDays(lastUpdate, now);

// ✅ Non-obvious decisions
// Using Set to dedupe while preserving order from first occurrence
const uniqueIds = [...new Set(ids)];

// ✅ Workarounds or known issues
// TODO: Replace with proper streaming when API supports it
const allData = await fetchAll();

// ❌ Don't comment obvious code
// Increment counter
counter++; // BAD - obvious from code
```

**JSDoc for public APIs:**
```typescript
/**
 * Creates a work item with optional parent link.
 * 
 * @example
 * ```typescript
 * const item = await createWorkItem({
 *   type: 'Task',
 *   title: 'Implement feature',
 *   parentId: 12345
 * });
 * ```
 * 
 * @param params - Work item creation parameters
 * @returns Promise resolving to created work item with ID
 * @throws {ValidationError} If required fields missing
 * @throws {ApiError} If Azure DevOps API call fails
 */
export async function createWorkItem(
  params: CreateWorkItemParams
): Promise<WorkItem> {
  // Implementation
}
```

## Common Patterns

### Service Pattern

```typescript
export class MyService {
  private cache = new Map<string, any>();

  constructor(
    private config: ServiceConfig,
    private httpClient: HttpClient
  ) {}

  async performOperation(params: Params): Promise<Result> {
    // Check cache
    const cached = this.cache.get(this.getCacheKey(params));
    if (cached) return cached;

    // Perform operation
    const result = await this.doWork(params);

    // Update cache
    this.cache.set(this.getCacheKey(params), result);

    return result;
  }

  private getCacheKey(params: Params): string {
    return JSON.stringify(params);
  }

  private async doWork(params: Params): Promise<Result> {
    // Implementation
  }
}
```

### Handler Pattern

```typescript
export async function handleMyTool(
  args: z.infer<typeof myToolSchema>,
  services: Services,
  config: ServerConfig
): Promise<ToolExecutionResult> {
  const warnings: string[] = [];

  try {
    // Apply defaults
    const params = { ...config.defaults.myTool, ...args };

    // Validate
    if (params.field1 && params.field2) {
      warnings.push('Both fields provided, using field1');
    }

    // Execute
    const result = await services.myService.execute(params);

    // Return success
    return {
      success: true,
      data: result,
      errors: [],
      warnings
    };
  } catch (error) {
    // Return error
    return {
      success: false,
      data: null,
      errors: [formatErrorMessage(error)],
      warnings
    };
  }
}
```

### Builder Pattern for Complex Objects

```typescript
class WorkItemBuilder {
  private item: Partial<WorkItem> = {};

  withTitle(title: string): this {
    this.item.title = title;
    return this;
  }

  withType(type: string): this {
    this.item.type = type;
    return this;
  }

  withParent(parentId: number): this {
    this.item.parentId = parentId;
    return this;
  }

  build(): WorkItem {
    if (!this.item.title || !this.item.type) {
      throw new Error('Title and type are required');
    }
    return this.item as WorkItem;
  }
}

// Usage
const item = new WorkItemBuilder()
  .withTitle('My Task')
  .withType('Task')
  .withParent(12345)
  .build();
```

## Performance Considerations

### Avoid N+1 Queries

```typescript
// ❌ Bad - N+1 query problem
async function getWorkItemsWithDetails(ids: number[]) {
  const items = [];
  for (const id of ids) {
    const item = await fetchWorkItem(id); // N API calls
    items.push(item);
  }
  return items;
}

// ✅ Good - Single batch query
async function getWorkItemsWithDetails(ids: number[]) {
  return await fetchWorkItemsBatch(ids); // 1 API call
}
```

### Caching Strategy

```typescript
class CachedService {
  private cache = new Map<string, CachedValue>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async get(key: string): Promise<any> {
    const cached = this.cache.get(key);
    
    // Check if cached and not expired
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.value;
    }

    // Fetch fresh data
    const value = await this.fetchFresh(key);
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    return value;
  }
}
```

### Lazy Loading

```typescript
class LazyService {
  private _expensiveResource?: ExpensiveResource;

  private async getResource(): Promise<ExpensiveResource> {
    if (!this._expensiveResource) {
      this._expensiveResource = await initializeExpensive();
    }
    return this._expensiveResource;
  }

  async useResource(): Promise<void> {
    const resource = await this.getResource();
    // Use resource
  }
}
```

## Testing Considerations

### Testable Code Design

```typescript
// ✅ Good - Dependencies injected, easy to mock
class Service {
  constructor(
    private httpClient: HttpClient,
    private config: Config
  ) {}

  async fetch(id: number) {
    return this.httpClient.get(`/items/${id}`);
  }
}

// ❌ Bad - Hard-coded dependencies, hard to test
class Service {
  async fetch(id: number) {
    const client = new HttpClient(); // Can't mock
    return client.get(`/items/${id}`);
  }
}
```

### Type Guards for Runtime Checks

```typescript
function isWorkItem(value: unknown): value is WorkItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number'
  );
}

// Usage
const data = await fetchData();
if (isWorkItem(data)) {
  // TypeScript knows data is WorkItem
  console.log(data.id);
}
```

## Feature Development Checklist

When adding new code:

- [ ] TypeScript strict mode compliance (no `any`, proper types)
- [ ] Zod schema for input validation
- [ ] JSDoc comments for public functions
- [ ] Error handling with try-catch
- [ ] Tests written (unit + integration if needed)
- [ ] Feature spec created/updated in `docs/feature_specs/`
- [ ] Proper imports organization
- [ ] No hardcoded values (use config)
- [ ] Logging for debugging
- [ ] Performance considerations (caching, batching)

## Documentation Requirements

### When Adding/Modifying Source Code

**REQUIRED:**
1. Create/update feature spec in `docs/feature_specs/<feature-name>.md`
2. Add JSDoc to public functions/classes
3. Update related documentation if behavior changes
4. Add inline comments for complex logic

### Code Comments

Focus on **why**, not **what**:
```typescript
// ✅ Good - explains why
// Using binary search because the array is sorted by ID
const index = binarySearch(items, targetId);

// ❌ Bad - explains what (obvious from code)
// Search for the item
const index = binarySearch(items, targetId);
```

---

**Last Updated:** 2025-10-07
