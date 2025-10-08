# Test Fixtures and Factories

This directory contains reusable test fixtures and factories for the Enhanced ADO MCP Server test suite.

## Overview

**Fixtures** provide pre-configured test data that can be used directly in tests.
**Factories** provide flexible functions to create customized test data with sensible defaults.

## Directory Structure

```
test/
├── fixtures/          # Pre-configured test data
│   ├── index.ts      # Exports all fixtures
│   ├── work-items.ts # Work item fixtures
│   └── queries.ts    # Query fixtures
└── factories/        # Factory functions
    ├── index.ts      # Exports all factories
    ├── work-item-factory.ts  # Work item builders
    ├── query-factory.ts      # Query builders
    └── response-factory.ts   # Response builders
```

## Quick Start

### Using Fixtures

Import pre-configured test data directly:

```typescript
import { PBI_WORK_ITEM, BUG_WORK_ITEM, TEST_IDENTITY } from '../fixtures';

test('using fixtures', () => {
  expect(PBI_WORK_ITEM.id).toBe(1001);
  expect(BUG_WORK_ITEM.fields['System.WorkItemType']).toBe('Bug');
  expect(TEST_IDENTITY.displayName).toBe('Test User');
});
```

### Using Factories

Create customized test data with defaults:

```typescript
import { createTask, createPBI, createMultipleWorkItems } from '../factories';

test('using factories', () => {
  // Create with defaults
  const task = createTask();
  
  // Create with overrides
  const pbi = createPBI({ 
    id: 5000, 
    storyPoints: 13,
    state: 'Active'
  });
  
  // Create multiple items
  const tasks = createMultipleWorkItems('Task', 5, { state: 'Active' });
});
```

## Available Fixtures

### Work Item Fixtures

Located in `test/fixtures/work-items.ts`:

- `PBI_WORK_ITEM` - Product Backlog Item
- `BUG_WORK_ITEM` - Bug
- `TASK_WORK_ITEM` - Task
- `FEATURE_WORK_ITEM` - Feature
- `EPIC_WORK_ITEM` - Epic
- `UNASSIGNED_WORK_ITEM` - Unassigned work item
- `TEST_IDENTITY` - Standard test user
- `PARENT_RELATION` - Parent relation for hierarchies
- `CHILD_RELATION` - Child relation for hierarchies
- `PBI_CONTEXT`, `BUG_CONTEXT`, `TASK_CONTEXT` - Work item contexts
- `ALL_WORK_ITEMS` - Array of all work items
- `ALL_CONTEXTS` - Map of work item contexts

### Query Fixtures

Located in `test/fixtures/queries.ts`:

- `BASIC_WIQL_QUERY` - Simple WIQL query string
- `COMPLEX_WIQL_QUERY` - Complex WIQL with multiple conditions
- `HIERARCHY_WIQL_QUERY` - WIQL for hierarchy queries
- `BASIC_ODATA_QUERY` - Simple OData query string
- `COMPLEX_ODATA_QUERY` - Complex OData query
- `FLAT_WIQL_RESULT` - Flat query result
- `TREE_WIQL_RESULT` - Tree query result with relations
- `EMPTY_WIQL_RESULT` - Empty query result
- `QUERY_METADATA` - Query metadata for handles
- `BASIC_QUERY_IDS`, `HIERARCHY_QUERY_IDS`, `LARGE_QUERY_IDS` - Work item ID arrays

## Available Factories

### Work Item Factory

Located in `test/factories/work-item-factory.ts`:

#### Creating Work Items

```typescript
import { 
  createWorkItem,
  createTask,
  createPBI,
  createBug,
  createFeature,
  createEpic
} from '../factories';

// Generic work item
const item = createWorkItem({ 
  id: 1000,
  title: 'My Item',
  type: 'Task',
  state: 'Active',
  storyPoints: 5
});

// Specific types with defaults
const task = createTask({ id: 2000 });
const pbi = createPBI({ storyPoints: 13 });
const bug = createBug({ priority: 1 });
```

#### Creating Relationships

```typescript
import { createParentChildRelation, createPBI, createTask } from '../factories';

const parent = createPBI({ id: 1000 });
const child = createTask({ id: 2000 });

const [parentWithChild, childWithParent] = createParentChildRelation(parent, child);
```

#### Creating Multiple Items

```typescript
import { createMultipleWorkItems } from '../factories';

// Create 5 tasks with sequential IDs
const tasks = createMultipleWorkItems('Task', 5, { 
  state: 'Active',
  assignedTo: TEST_IDENTITY
});

// Creates items with IDs 10000, 10001, 10002, 10003, 10004
```

#### Creating Context Maps

```typescript
import { createMultipleWorkItems, createContextMap } from '../factories';

const items = createMultipleWorkItems('Task', 3);
const contextMap = createContextMap(items);

// Use in query handle
const handle = createQueryHandle({
  workItemIds: items.map(i => i.id),
  workItemContext: contextMap
});
```

### Query Factory

Located in `test/factories/query-factory.ts`:

#### Creating Query Handles

```typescript
import { createQueryHandle, cleanupQueryHandles } from '../factories';

// Create with defaults
const handle = createQueryHandle();

// Create with custom IDs
const handle = createQueryHandle({
  workItemIds: [1001, 2001, 3001],
  project: 'MyProject'
});

// Always cleanup after tests
afterEach(() => {
  cleanupQueryHandles();
});
```

#### Creating WIQL Results

```typescript
import { createWiqlResult } from '../factories';

const result = createWiqlResult({
  workItemIds: [101, 102, 103],
  queryType: 'flat'
});

const treeResult = createWiqlResult({
  workItemIds: [1001, 2001, 3001],
  queryType: 'tree',
  includeRelations: true
});
```

#### Creating Query Strings

```typescript
import { createWiqlQuery, createODataQuery } from '../factories';

// Create WIQL query
const wiql = createWiqlQuery({
  workItemType: 'Task',
  state: 'Active',
  areaPath: 'MyProject\\MyArea'
});

// Create OData query
const odata = createODataQuery({
  select: ['WorkItemId', 'Title', 'State'],
  filter: "WorkItemType eq 'Task'",
  orderBy: 'ChangedDate desc',
  top: 10
});
```

### Response Factory

Located in `test/factories/response-factory.ts`:

#### Creating Tool Results

```typescript
import { 
  createSuccessResult,
  createErrorResult,
  createToolExecutionResult
} from '../factories';

// Success result
const success = createSuccessResult({ workItemId: 1001 });

// Error result
const error = createErrorResult('Item not found');

// Custom result
const result = createToolExecutionResult({
  success: true,
  data: { count: 5 },
  warnings: ['Some items skipped'],
  metadata: { tool: 'bulk-update' }
});
```

#### Creating Bulk Operation Results

```typescript
import { createBulkOperationResult } from '../factories';

const result = createBulkOperationResult({
  totalItems: 10,
  successCount: 8,
  failureCount: 2
});
```

#### Creating Mock HTTP Responses

```typescript
import { 
  createMockHttpResponse,
  createMockErrorResponse,
  createAzCliResult
} from '../factories';

// Success response
const response = createMockHttpResponse(workItem, 200);

// Error response
const error = createMockErrorResponse('Not Found', 404);

// Azure CLI result
const cliResult = createAzCliResult({ accessToken: 'token-123' });
```

## Usage Patterns

### Pattern 1: Basic Test Setup

```typescript
import { createTask, createSuccessResult } from '../factories';

test('handler processes work item', async () => {
  const workItem = createTask({ id: 1000 });
  const result = await handler.process(workItem);
  
  expect(result.success).toBe(true);
});
```

### Pattern 2: Testing with Query Handles

```typescript
import { 
  createQueryHandle, 
  createWorkItemContext, 
  cleanupQueryHandles 
} from '../factories';

describe('Query Handle Tests', () => {
  afterEach(() => {
    cleanupQueryHandles();
  });

  test('handler uses query handle', () => {
    const context = new Map([
      [1001, createWorkItemContext({ title: 'Task 1' })],
      [2001, createWorkItemContext({ title: 'Task 2' })]
    ]);
    
    const handle = createQueryHandle({
      workItemIds: [1001, 2001],
      workItemContext: context
    });
    
    // Use handle in test...
  });
});
```

### Pattern 3: Testing Parent-Child Hierarchies

```typescript
import { createPBI, createTask, createParentChildRelation } from '../factories';

test('validates hierarchy', () => {
  const parent = createPBI({ id: 1000 });
  const child1 = createTask({ id: 2000 });
  const child2 = createTask({ id: 3000 });
  
  const [parentWithChildren, childWithParent1] = createParentChildRelation(parent, child1);
  const [updatedParent, childWithParent2] = createParentChildRelation(parentWithChildren, child2);
  
  expect(updatedParent.relations).toHaveLength(2);
});
```

### Pattern 4: Testing Bulk Operations

```typescript
import { createMultipleWorkItems, createBulkOperationResult } from '../factories';

test('bulk update processes items', async () => {
  const items = createMultipleWorkItems('Task', 10);
  const result = await bulkUpdate(items);
  
  const expected = createBulkOperationResult({
    totalItems: 10,
    successCount: 10
  });
  
  expect(result).toMatchObject(expected);
});
```

## Best Practices

### 1. Use Fixtures for Consistent Data

When you need the same data across multiple tests:

```typescript
import { PBI_WORK_ITEM } from '../fixtures';

test('test 1', () => {
  expect(PBI_WORK_ITEM.id).toBe(1001);
});

test('test 2', () => {
  expect(PBI_WORK_ITEM.fields['System.Title']).toBeDefined();
});
```

### 2. Use Factories for Customization

When you need variations of data:

```typescript
import { createTask } from '../factories';

test('active task', () => {
  const task = createTask({ state: 'Active' });
  // ...
});

test('completed task', () => {
  const task = createTask({ state: 'Done' });
  // ...
});
```

### 3. Combine Fixtures and Factories

Use fixtures as base and customize with factories:

```typescript
import { PBI_WORK_ITEM } from '../fixtures';
import { createWorkItem } from '../factories';

test('customized PBI', () => {
  const customPBI = createWorkItem({
    ...PBI_WORK_ITEM,
    storyPoints: 21
  });
});
```

### 4. Always Cleanup Query Handles

```typescript
import { cleanupQueryHandles } from '../factories';

describe('Tests with query handles', () => {
  afterEach(() => {
    cleanupQueryHandles();
  });
});
```

### 5. Use Type-Safe Overrides

Factories provide full TypeScript type checking:

```typescript
import { createWorkItem } from '../factories';

// TypeScript will catch errors
const item = createWorkItem({
  id: 1000,
  storyPoints: 5,  // ✓ Valid
  invalidField: 'test'  // ✗ Type error
});
```

## Testing the Fixtures and Factories

A comprehensive test suite demonstrating all features is available at:
`test/unit/fixtures-and-factories.test.ts`

Run it with:

```bash
npm test -- fixtures-and-factories.test.ts
```

## Contributing

When adding new fixtures or factories:

1. Add comprehensive JSDoc comments
2. Provide usage examples in comments
3. Update this README
4. Add tests demonstrating usage
5. Follow existing naming conventions

## TypeScript Types

All fixtures and factories are fully typed:

- Fixtures export const values with explicit types
- Factories have typed options interfaces
- Return types are properly inferred
- Full IDE autocomplete support
