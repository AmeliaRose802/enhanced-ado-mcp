---
applyTo: "mcp_server/test/**"
---

# Testing Instructions

This directory contains unit and integration tests for the MCP server.

## Test Structure

```
test/
├── setup.ts              # Jest configuration and global setup
├── unit/                 # Unit tests (fast, mocked dependencies)
│   ├── config.test.ts
│   ├── services/
│   └── utils/
└── integration/          # Integration tests (slower, real APIs)
    ├── wiql-query.test.ts
    └── work-item.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- config.test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm run test:coverage

# Run only unit tests
npm test -- unit/

# Run only integration tests
npm test -- integration/
```

## Test File Naming Conventions

- Unit tests: `<module-name>.test.ts`
- Integration tests: `<feature>-integration.test.ts`
- Test utilities: `<helper-name>.test-helper.ts`

## Writing Unit Tests

### Standard Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MyService } from '../../src/services/my-service';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    // Setup before each test
    mockDependency = {
      method: jest.fn()
    } as any;
    
    service = new MyService(mockDependency);
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle valid input correctly', () => {
      // Arrange
      const input = { value: 'test' };
      mockDependency.method.mockResolvedValue('result');

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toBeDefined();
      expect(mockDependency.method).toHaveBeenCalledWith('test');
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const input = { value: null };

      // Act & Assert
      expect(() => service.methodName(input)).toThrow('Invalid input');
    });

    it('should handle async errors gracefully', async () => {
      // Arrange
      mockDependency.method.mockRejectedValue(new Error('API failed'));

      // Act & Assert
      await expect(service.methodName({ value: 'test' }))
        .rejects
        .toThrow('API failed');
    });
  });
});
```

### Mocking External Dependencies

#### Mocking Azure CLI

```typescript
import { exec } from 'child_process';

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const mockExec = exec as jest.MockedFunction<typeof exec>;

beforeEach(() => {
  mockExec.mockImplementation((cmd, callback) => {
    if (cmd.includes('az account get-access-token')) {
      callback(null, {
        stdout: JSON.stringify({ accessToken: 'mock-token' }),
        stderr: ''
      } as any);
    }
  });
});
```

#### Mocking Fetch API

```typescript
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ value: [{ id: 1, title: 'Test' }] })
  } as Response);
});
```

#### Mocking File System

```typescript
import fs from 'fs/promises';

jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

beforeEach(() => {
  mockFs.readFile.mockResolvedValue('mock file content');
});
```

### Test Coverage Goals

- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

### What to Test

✅ **Do Test:**
- Happy path (valid input → expected output)
- Error handling (invalid input → proper error)
- Edge cases (empty arrays, null values, boundaries)
- Business logic validation
- State transitions
- Error message accuracy

❌ **Don't Test:**
- External library internals
- Simple getters/setters
- TypeScript type system
- Configuration constant values

## Writing Integration Tests

### Integration Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ADOWorkItemService } from '../../src/services/ado-work-item-service';

describe('ADO Work Item Integration', () => {
  let service: ADOWorkItemService;
  let testWorkItemId: number;

  beforeAll(async () => {
    // One-time setup
    service = new ADOWorkItemService({
      organization: process.env.ADO_ORGANIZATION!,
      project: process.env.ADO_PROJECT!
    });

    // Create test data
    const workItem = await service.createWorkItem({
      type: 'Task',
      title: '[TEST] Integration Test Item'
    });
    testWorkItemId = workItem.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWorkItemId) {
      await service.deleteWorkItem(testWorkItemId);
    }
  });

  it('should fetch work item by ID', async () => {
    const result = await service.getWorkItem(testWorkItemId);
    
    expect(result).toBeDefined();
    expect(result.id).toBe(testWorkItemId);
    expect(result.fields['System.Title']).toContain('[TEST]');
  });

  it('should update work item successfully', async () => {
    const updated = await service.updateWorkItem(testWorkItemId, {
      description: 'Updated by integration test'
    });

    expect(updated.fields['System.Description']).toContain('integration test');
  });
});
```

### Integration Test Best Practices

- **Use real environment** - Test against actual Azure DevOps (dev/test org)
- **Cleanup test data** - Always remove test items in `afterAll`
- **Mark test items** - Use `[TEST]` prefix in titles
- **Skip if no config** - Check for required env vars
- **Run less frequently** - Slow, can hit rate limits
- **Isolate tests** - Each test should be independent

### Skipping Integration Tests

```typescript
describe.skip('ADO Integration (requires authentication)', () => {
  // Tests skipped by default
});

// Or conditionally skip
const hasConfig = process.env.ADO_ORGANIZATION && process.env.ADO_PROJECT;

(hasConfig ? describe : describe.skip)('ADO Integration', () => {
  // Tests run only if configured
});
```

## Test Utilities and Helpers

### Creating Test Helpers

```typescript
// test/helpers/work-item-factory.ts
export function createMockWorkItem(overrides?: Partial<WorkItem>): WorkItem {
  return {
    id: 12345,
    fields: {
      'System.Title': 'Test Item',
      'System.State': 'Active',
      'System.WorkItemType': 'Task',
      ...overrides?.fields
    },
    ...overrides
  };
}
```

### Using Test Helpers

```typescript
import { createMockWorkItem } from '../helpers/work-item-factory';

it('should analyze work item', () => {
  const workItem = createMockWorkItem({
    fields: {
      'System.State': 'In Progress'
    }
  });

  const result = analyzer.analyze(workItem);
  expect(result.state).toBe('In Progress');
});
```

## Testing Async Code

### Promises

```typescript
it('should resolve with result', async () => {
  const promise = service.fetchData();
  await expect(promise).resolves.toBe('data');
});

it('should reject with error', async () => {
  const promise = service.fetchInvalidData();
  await expect(promise).rejects.toThrow('Not found');
});
```

### Callbacks

```typescript
it('should call callback with result', (done) => {
  service.fetchData((error, result) => {
    expect(error).toBeNull();
    expect(result).toBe('data');
    done();
  });
});
```

### Timeouts

```typescript
it('should timeout long operations', async () => {
  const promise = service.slowOperation();
  await expect(promise).rejects.toThrow('Timeout');
}, 10000); // 10 second timeout
```

## Testing Error Handling

### Testing Expected Errors

```typescript
it('should throw error for invalid ID', () => {
  expect(() => service.getWorkItem(-1)).toThrow('Invalid ID');
  expect(() => service.getWorkItem(-1)).toThrow(/Invalid/);
});

it('should return error in result', async () => {
  const result = await handler.execute({ invalidParam: true });
  
  expect(result.success).toBe(false);
  expect(result.errors).toContain('Invalid parameter');
  expect(result.data).toBeNull();
});
```

### Testing Error Recovery

```typescript
it('should retry on transient failure', async () => {
  mockFetch
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({ ok: true, json: async () => 'success' } as Response);

  const result = await service.fetchWithRetry();
  
  expect(result).toBe('success');
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
```

## Snapshot Testing

### When to Use Snapshots

- Complex JSON output that should remain stable
- Formatted text output
- Error message structures

### Creating Snapshots

```typescript
it('should match snapshot', () => {
  const result = formatter.format(data);
  expect(result).toMatchSnapshot();
});
```

### Updating Snapshots

```bash
# Update all snapshots
npm test -- -u

# Update specific snapshot
npm test -- config.test.ts -u
```

## Performance Testing

### Timing Assertions

```typescript
it('should complete within time limit', async () => {
  const start = Date.now();
  await service.performOperation();
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(1000); // 1 second max
});
```

### Memory Leak Detection

```typescript
it('should not leak memory', () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  for (let i = 0; i < 1000; i++) {
    service.createCache();
    service.clearCache();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const increase = finalMemory - initialMemory;
  
  expect(increase).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
});
```

## Testing Patterns for MCP Tools

### Testing Tool Handlers

```typescript
describe('handleMyTool', () => {
  let mockServices: Services;
  let mockConfig: ServerConfig;

  beforeEach(() => {
    mockServices = {
      workItemService: {
        getWorkItem: jest.fn()
      }
    } as any;

    mockConfig = {
      organization: 'test-org',
      project: 'test-project',
      defaults: {
        myTool: { defaultValue: 'default' }
      }
    } as any;
  });

  it('should return success result', async () => {
    mockServices.workItemService.getWorkItem.mockResolvedValue({
      id: 123,
      title: 'Test'
    });

    const result = await handleMyTool(
      { workItemId: 123 },
      mockServices,
      mockConfig
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });

  it('should apply configuration defaults', async () => {
    mockServices.workItemService.getWorkItem.mockResolvedValue({});

    await handleMyTool({}, mockServices, mockConfig);

    expect(mockServices.workItemService.getWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({ defaultValue: 'default' })
    );
  });

  it('should handle service errors', async () => {
    mockServices.workItemService.getWorkItem.mockRejectedValue(
      new Error('Service failed')
    );

    const result = await handleMyTool(
      { workItemId: 123 },
      mockServices,
      mockConfig
    );

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Service failed');
  });
});
```

## Debugging Tests

### Running Single Test

```bash
npm test -- --testNamePattern="should handle valid input"
```

### Debugging in VS Code

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/mcp_server/node_modules/.bin/jest",
  "args": [
    "${relativeFile}",
    "--config=${workspaceFolder}/mcp_server/jest.config.js"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Output

```bash
npm test -- --verbose
```

## Documentation Requirements

### When Adding/Modifying Tests

**REQUIRED:**
1. Update feature spec in `docs/feature_specs/` if testing new behavior
2. Add comments explaining complex test setup
3. Document any special test environment requirements

**Test Comments:**
```typescript
/**
 * Tests the work item creation flow with parent linking.
 * 
 * This test verifies:
 * 1. Child is created with correct type
 * 2. Parent link is established
 * 3. Parent's child count is updated
 * 
 * Requires: Mock ADO API responses for both work items
 */
it('should create child with parent link', async () => {
  // Test implementation
});
```

### Test Environment Setup

Document in feature spec or README:
- Required environment variables
- Test data requirements
- External dependencies
- Cleanup procedures

---

**Last Updated:** 2025-10-07
