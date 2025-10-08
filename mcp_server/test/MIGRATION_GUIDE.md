# Migrating Existing Tests to Use Fixtures and Factories

This guide shows how to migrate existing tests to use the new fixtures and factories.

## Before: Hardcoded Test Data

```typescript
// Old approach - hardcoded test data
describe('Work Item Handler', () => {
  it('should process work item', () => {
    const mockWorkItem = {
      id: 12345,
      fields: {
        'System.Id': 12345,
        'System.Title': 'Test Item',
        'System.WorkItemType': 'Task',
        'System.State': 'New',
        'System.AssignedTo': {
          displayName: 'Test User',
          uniqueName: 'test@example.com',
          id: 'test-id'
        },
        'System.CreatedDate': '2024-01-01T00:00:00Z',
        'System.ChangedDate': '2024-01-01T00:00:00Z'
      },
      relations: []
    };

    const result = processWorkItem(mockWorkItem);
    expect(result.success).toBe(true);
  });
});
```

## After: Using Factories

```typescript
// New approach - using factories
import { createTask } from '../factories';

describe('Work Item Handler', () => {
  it('should process work item', () => {
    const mockWorkItem = createTask({
      id: 12345,
      title: 'Test Item'
    });

    const result = processWorkItem(mockWorkItem);
    expect(result.success).toBe(true);
  });
});
```

## Benefits

1. **Less Code**: No need to manually construct complex objects
2. **Consistency**: All tests use the same base structure
3. **Maintainability**: Changes to structure only need to happen in one place
4. **Type Safety**: Full TypeScript support with autocomplete
5. **Flexibility**: Easy to override specific properties

## Migration Examples

### Example 1: Query Handle Creation

**Before:**
```typescript
const sourceIds = [101, 102, 103];
const targetIds = [201, 202, 203];

const sourceContext = new Map(
  sourceIds.map(id => [id, { 
    title: `Source ${id}`, 
    state: 'Active', 
    type: 'Task' 
  }])
);

const sourceHandle = queryHandleService.storeQuery(
  sourceIds,
  'SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = "Task"',
  { project: 'TestProject', queryType: 'wiql' },
  60000,
  sourceContext
);
```

**After:**
```typescript
import { createQueryHandle, createWorkItemContext } from '../factories';

const sourceIds = [101, 102, 103];
const sourceContext = new Map(
  sourceIds.map(id => [id, createWorkItemContext({
    title: `Source ${id}`,
    state: 'Active',
    type: 'Task'
  })])
);

const sourceHandle = createQueryHandle({
  workItemIds: sourceIds,
  workItemContext: sourceContext,
  project: 'TestProject'
});
```

### Example 2: Tool Execution Results

**Before:**
```typescript
const mockResult = {
  success: true,
  data: { workItemId: 123, title: 'Test' },
  metadata: {
    timestamp: new Date().toISOString(),
    tool: 'test-tool'
  },
  errors: [],
  warnings: []
};
```

**After:**
```typescript
import { createSuccessResult } from '../factories';

const mockResult = createSuccessResult({
  workItemId: 123,
  title: 'Test'
});
```

### Example 3: Multiple Related Items

**Before:**
```typescript
const parentItem = {
  id: 1000,
  fields: {
    'System.Id': 1000,
    'System.Title': 'Parent PBI',
    'System.WorkItemType': 'Product Backlog Item',
    'System.State': 'Active',
    // ... many more fields
  },
  relations: [{
    rel: 'System.LinkTypes.Hierarchy-Forward',
    url: 'https://dev.azure.com/test-org/_apis/wit/workItems/2000'
  }]
};

const childItem = {
  id: 2000,
  fields: {
    'System.Id': 2000,
    'System.Title': 'Child Task',
    'System.WorkItemType': 'Task',
    'System.State': 'New',
    // ... many more fields
  },
  relations: [{
    rel: 'System.LinkTypes.Hierarchy-Reverse',
    url: 'https://dev.azure.com/test-org/_apis/wit/workItems/1000'
  }]
};
```

**After:**
```typescript
import { createPBI, createTask, createParentChildRelation } from '../factories';

const parent = createPBI({ id: 1000, title: 'Parent PBI' });
const child = createTask({ id: 2000, title: 'Child Task' });

const [parentWithChild, childWithParent] = createParentChildRelation(parent, child);
```

## Quick Reference: Common Replacements

| Old Pattern | New Pattern |
|-------------|-------------|
| `{ id: 123, fields: {...} }` | `createWorkItem({ id: 123 })` |
| `{ id: 123, fields: { 'System.WorkItemType': 'Task' } }` | `createTask({ id: 123 })` |
| `queryHandleService.storeQuery(...)` | `createQueryHandle({ ... })` |
| `{ success: true, data: {...} }` | `createSuccessResult({ ... })` |
| `{ success: false, errors: [...] }` | `createErrorResult('message')` |
| Manual WIQL query string | `createWiqlQuery({ ... })` |

## Step-by-Step Migration Process

1. **Identify Test Data Patterns**
   - Look for repeated object structures
   - Find manual work item creation
   - Locate query handle setup

2. **Import Appropriate Factories**
   ```typescript
   import { 
     createTask, 
     createQueryHandle,
     createSuccessResult 
   } from '../factories';
   ```

3. **Replace Manual Construction**
   - Start with simple cases
   - Gradually handle more complex scenarios
   - Keep the same test logic

4. **Remove Cleanup Boilerplate**
   ```typescript
   afterEach(() => {
     cleanupQueryHandles(); // One line replaces manual cleanup
   });
   ```

5. **Verify Tests Still Pass**
   ```bash
   npm test -- your-test-file.test.ts
   ```

## Common Pitfalls

### ❌ Don't mix approaches
```typescript
// Bad - mixing manual and factory
const item = createTask();
item.fields['System.Title'] = 'Modified'; // Mutating factory result
```

### ✅ Use factory overrides instead
```typescript
// Good - use factory options
const item = createTask({ title: 'Modified' });
```

### ❌ Don't forget cleanup
```typescript
// Bad - leaked handles
test('uses query handle', () => {
  const handle = createQueryHandle();
  // ... test code
  // No cleanup!
});
```

### ✅ Always cleanup query handles
```typescript
// Good - proper cleanup
afterEach(() => {
  cleanupQueryHandles();
});

test('uses query handle', () => {
  const handle = createQueryHandle();
  // ... test code
});
```

## Gradual Migration

You don't need to migrate all tests at once:

1. **Start with New Tests**: Use factories for all new tests
2. **Migrate on Touch**: When updating a test, migrate it to use factories
3. **Batch Migration**: Set aside time to migrate entire test suites
4. **Prioritize**: Focus on tests that are hardest to maintain

## Questions?

See `test/README.md` for full documentation or `test/unit/fixtures-and-factories.test.ts` for examples.
