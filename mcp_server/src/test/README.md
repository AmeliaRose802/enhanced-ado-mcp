# Test Directory

This directory contains tests for the Enhanced ADO MCP Server.

## Test Organization

### Jest Unit/Integration Tests (`.test.ts` files)

These are Jest-based tests that run as part of `npm test`. They use mocks and don't require a running server or real Azure DevOps credentials.

**Examples:**
- `query-handle-selection.test.ts` - Query handle selection logic
- `bulk-preview-limits.test.ts` - Bulk operation preview functionality
- `sprint-planner-optional-fields.test.ts` - Sprint planner output optimization
- `handle-based-analysis.test.ts` - Handle-based analysis tools

**Run with:**
```bash
npm test                  # All Jest tests
npm test -- <filename>    # Specific test file
npm run test:coverage     # With coverage report
```

### Manual Integration Scripts (executable `.ts` files with `#!/usr/bin/env node`)

These are standalone scripts that spawn an actual MCP server process and test end-to-end functionality. They're useful for manual testing and validation but are not part of the automated test suite.

**Currently maintained:**
- `smoke-test.ts` - Basic server functionality (version check, basic operations)
- `stress-test.ts` - Stress testing and edge case validation

**Run with:**
```bash
npm run test:smoke   # Run smoke tests
```

### Test Configuration

- `setup.ts` - Jest global setup and test utilities
- `jest.config.js` (in parent dir) - Jest configuration

## Adding New Tests

### For New Features

Create a new `.test.ts` file following this pattern:

```typescript
/**
 * Tests for <feature name>
 */

import { MyFeature } from '../services/my-feature.js';

// Mock dependencies
jest.mock('../config/config.js', () => ({
  // Mock configuration
}));

describe('My Feature', () => {
  let feature: MyFeature;

  beforeEach(() => {
    feature = new MyFeature();
  });

  describe('specific functionality', () => {
    it('should handle valid input', () => {
      const result = feature.doSomething('valid');
      expect(result).toBeDefined();
    });

    it('should reject invalid input', () => {
      expect(() => feature.doSomething('')).toThrow();
    });
  });
});
```

### Naming Conventions

- **Unit tests**: `<feature-name>.test.ts`
- **Integration tests**: `<feature-name>-integration.test.ts`
- **Format tests**: `<feature-name>-format.test.ts`
- **Minimization tests**: `<feature-name>-minimization.test.ts`

## Test Categories

Tests are organized by feature area:

- **Query Handling**: query-handle-*.test.ts
- **Bulk Operations**: bulk-*.test.ts
- **Selection**: selection-*.test.ts, select-*.test.ts
- **Analysis**: analyze-*.test.ts, *-analyzer.test.ts
- **Integration**: *-integration.test.ts
- **Configuration**: configuration-*.test.ts
- **Resources**: resources-*.test.ts

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 70%
- **Functions**: > 75%
- **Lines**: > 80%

Run `npm run test:coverage` to see current coverage.

## Test Utilities

Global test utilities are available via `testUtils` (defined in `setup.ts`):

```typescript
// Wait for async operations
await testUtils.sleep(1000);

// Generate mock data
const workItem = testUtils.generateMockWorkItem({ title: 'Custom' });

// Mock Azure CLI
const response = testUtils.mockAzCliSuccess({ token: 'abc123' });
```

## Troubleshooting

### Tests Hanging

If tests don't exit cleanly, run with:
```bash
npm test -- --detectOpenHandles
```

### Tests Failing on CI

Some tests are intentionally excluded in `jest.config.js` because they require Azure DevOps credentials or network access:
- `work-item-rest-api.test.ts`
- `wiql-query.test.ts`
- `configuration-discovery.test.ts`
- And others (see `testPathIgnorePatterns` in jest.config.js)

These can be run locally when authenticated with Azure CLI.
