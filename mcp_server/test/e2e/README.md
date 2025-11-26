# End-to-End Workflow Tests

This directory contains E2E tests that validate complete user workflows across multiple tools and services.

## Overview

E2E tests simulate real-world usage scenarios by:
- Executing full workflows from start to finish
- Testing integration between multiple tools
- Validating state changes and data persistence
- Ensuring error handling works across the stack

## Test Structure

### Test File: `workflow-tests.test.ts`

Contains 4 main workflow test suites:

1. **Work Item Lifecycle** - Create → Assign to Copilot → Update → Complete
2. **Query and Bulk Update** - Query → Handle → Bulk Operations → Undo
3. **Sprint Planning** - Discover iteration → Query backlog → Analyze → Assign
4. **Backlog Cleanup** - Query stale items → Analyze → Bulk update/close

## Running Tests

### Run all E2E tests:
```bash
npm test -- test/e2e/
```

### Run specific workflow:
```bash
npm test -- workflow-tests.test.ts -t "Work Item Lifecycle"
```

### Run with coverage:
```bash
npm test -- test/e2e/ --coverage
```

## Test Strategy

### Mocking Approach

E2E tests use **comprehensive mocks** instead of hitting real Azure DevOps APIs:

- **ADO HTTP Client**: Mocked to simulate API responses
- **Work Item Storage**: In-memory Map simulates database
- **Token Provider**: Returns mock tokens
- **Configuration**: Uses test configuration

**Why mock instead of real API:**
- ✅ Tests run in CI/CD without credentials
- ✅ Fast execution (no network calls)
- ✅ Predictable results (no external dependencies)
- ✅ Safe (no pollution of real organizations)
- ✅ Idempotent (can run repeatedly)

### Test Data Management

Each test:
1. **Seeds** initial data in `beforeEach`
2. **Executes** workflow steps
3. **Verifies** results at each step
4. **Cleans up** in `afterEach`

The mock work item storage is cleared between tests to ensure isolation.

## Workflow Test Details

### 1. Work Item Lifecycle

**Validates:**
- Work item creation with all fields
- Assignment to GitHub Copilot
- Specialized agent tagging
- State transitions
- Field updates
- Revision tracking

**Key Assertions:**
- Work item ID is assigned
- Assignment to Copilot succeeds
- Tags are properly set
- State changes are persisted
- Revision numbers increment

### 2. Query and Bulk Update

**Validates:**
- WIQL query execution
- Query handle creation
- Bulk tag additions
- Bulk field updates
- Bulk comments
- Undo functionality
- Item selection (all, indices, criteria)

**Key Assertions:**
- Query returns correct items
- Handle is valid for operations
- All items are updated correctly
- Undo reverts changes
- Selection filters work

### 3. Sprint Planning

**Validates:**
- Backlog querying
- Effort analysis (story points)
- Workload analysis (assignments)
- AI-powered estimation
- Sprint assignment
- Iteration path updates

**Key Assertions:**
- Backlog items are retrieved
- Story points coverage is calculated
- Estimation works for unestimated items
- Items move to sprint iteration
- State transitions to Committed

### 4. Backlog Cleanup

**Validates:**
- Stale item detection
- Missing description detection
- Duplicate detection
- Risk analysis
- Bulk cleanup operations
- AI description enhancement
- Story point estimation

**Key Assertions:**
- Filters identify correct items
- Cleanup adds proper comments
- Items move to Removed state
- AI enhancements work
- Patterns (duplicates, missing_description) work

## Error Handling Tests

Separate test suite validates:
- Invalid query handles
- Partial failures in bulk operations
- Missing required parameters
- Expired handles
- Network errors (simulated)
- Validation failures

## Mock Implementation Details

### Work Item Storage

```typescript
const mockWorkItems = new Map<number, any>();
let nextWorkItemId = 10000;
```

Simulates Azure DevOps work item database with:
- Auto-incrementing IDs
- Revision tracking
- Field updates
- Relation support

### HTTP Client Mock

Handles:
- `GET /wit/workitems/{id}` - Retrieve work item
- `POST /wit/$WorkItemType` - Create work item
- `PATCH /wit/workitems/{id}` - Update work item
- `POST /wit/wiql` - Execute WIQL query
- `GET /git/repositories/{repo}` - Get repository info

### Query Parsing

Mock WIQL parser supports basic patterns:
- `State = 'Active'` - State filter
- `WorkItemType = 'Task'` - Type filter
- `IN ('value1', 'value2')` - IN clause
- Combines multiple conditions with AND

## Prerequisites

### Required Packages

All dependencies are in `package.json`:
- `jest` - Test framework
- `@jest/globals` - TypeScript types
- `ts-jest` - TypeScript support

### Test Setup

Global test setup in `test/setup.ts`:
- Sets `NODE_ENV=test`
- Configures test timeout (30s)
- Provides test utilities
- Cleans up services after tests

## Extending Tests

### Adding New Workflows

1. Create new `describe()` block in `workflow-tests.test.ts`
2. Seed test data in `beforeEach()`
3. Write workflow steps with assertions
4. Clean up in `afterEach()`

Example:
```typescript
describe('Workflow 5: New Feature', () => {
  beforeEach(() => {
    // Seed test data
  });

  it('should complete workflow: step1 → step2 → step3', async () => {
    // Step 1
    const step1Result = await handler1(...);
    expect(step1Result.success).toBe(true);

    // Step 2
    const step2Result = await handler2(...);
    expect(step2Result.success).toBe(true);

    // Step 3 and verify
    const step3Result = await handler3(...);
    expect(step3Result.success).toBe(true);
  });
});
```

### Adding Mock Behaviors

Extend the mock HTTP client in the test file:

```typescript
jest.mock('../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn(async (url: string) => {
      // Add new GET endpoint
      if (url.includes('/your/new/endpoint')) {
        return { data: yourMockData };
      }
    }),
    // ... other methods
  }))
}));
```

## Best Practices

1. **Keep tests focused** - Each test should validate one workflow
2. **Use descriptive names** - Test names should explain what's being validated
3. **Assert at each step** - Verify results after each workflow step
4. **Clean up thoroughly** - Clear all state in `afterEach`
5. **Mock minimally** - Only mock external dependencies (ADO API, not internal services)
6. **Test error paths** - Include negative test cases
7. **Document complex flows** - Add comments explaining multi-step workflows

## Known Issues

### TypeScript Compilation Errors

**Current Status:** The project has widespread TypeScript compilation errors related to logger error parameter typing (`error: unknown` not assignable to `Record<string, unknown> | undefined`). These errors exist across the entire codebase and are not specific to the E2E tests.

**Impact:** Tests cannot currently run due to TypeScript compilation failures during Jest's TypeScript transformation.

**Workaround:** These errors need to be resolved at the project level by updating logger error handling to accept `unknown` type or casting errors appropriately.

**Tracking:** This is a known issue across the codebase - see error messages in build output.

## Troubleshooting

### Tests timing out

- Check `jest.setTimeout` is set appropriately (30s default)
- Verify no real API calls are being made
- Look for infinite loops in handlers

### Mock data not found

- Ensure `beforeEach` seeds data correctly
- Check work item IDs match between steps
- Verify `mockWorkItems.clear()` isn't called too early

### Query handle errors

- Clear query handle service in `afterEach`
- Ensure handles are created before use
- Check handle expiration logic

### Import errors

- Verify all imports use `.js` extensions (TypeScript requirement)
- Check `moduleNameMapper` in `jest.config.js`
- Ensure mock paths match actual file paths

## Future Enhancements

Potential improvements:
- [ ] Add performance benchmarks for workflows
- [ ] Test concurrent workflow execution
- [ ] Add workflow cancellation tests
- [ ] Test workflow state persistence
- [ ] Add workflow retry logic tests
- [ ] Test workflow with large datasets (1000+ items)
- [ ] Add workflow composition tests (chaining workflows)
- [ ] Test workflow rollback scenarios

## Related Documentation

- [Test README](../README.md) - Overall testing strategy
- [Test Coverage](../TEST_COVERAGE.md) - Coverage requirements
- [Integration Tests](../integration/) - Lower-level integration tests
- [Unit Tests](../unit/) - Component-level tests
