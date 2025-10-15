# Test Coverage for Newly Added Tools

This document describes the comprehensive test coverage added for new bulk operations, query generators, and discovery tools.

## Test Files Created

### Unit Tests (`test/unit/`)

#### 1. bulk-transition-state.test.ts
Tests for the `wit-bulk-transition-state-by-query-handle` tool.

**Test Coverage:**
- State transition validation (valid/invalid transitions)
- Item selection (all, by index, by criteria)
- Dry run mode with previews
- Execution mode with actual updates
- Optional parameters (reason, comment)
- Partial failure handling
- Edge cases (expired handles, already in target state)

**Test Cases:** 11 test groups covering multiple scenarios
- ✅ State transition validation
- ✅ Item selection strategies
- ✅ Dry run previews
- ✅ Execution with success/failure tracking
- ✅ Optional reason and comment inclusion
- ✅ Error handling (invalid handles, Azure CLI issues)
- ✅ Edge cases (expired handles, duplicate states)

#### 2. bulk-move-iteration.test.ts
Tests for the `wit-bulk-move-to-iteration-by-query-handle` tool.

**Test Coverage:**
- Iteration path validation
- Item selection (all, indices, criteria)
- Dry run mode with current iteration display
- Execution mode with comment support
- Child items update option
- Partial failure scenarios

**Test Cases:** 12 test groups
- ✅ Iteration path validation
- ✅ Item selection by index, criteria, and "all"
- ✅ Dry run previews with iteration path display
- ✅ Preview limiting (maxPreviewItems)
- ✅ Execution with comment inclusion
- ✅ Child items handling
- ✅ Error handling
- ✅ Edge cases (expired handles, empty context)

#### 3. bulk-link-work-items.test.ts
Tests for the `wit-link-work-items-by-query-handles` tool.

**Test Coverage:**
- All link strategies (one-to-one, one-to-many, many-to-one, many-to-many)
- All link types (Parent, Child, Related, Successor, Predecessor, etc.)
- Item selection for both source and target
- Dry run with preview
- Execution with skip existing option
- Link validation for hierarchical relationships
- Partial failure handling

**Test Cases:** 15 test groups covering extensive scenarios
- ✅ One-to-one link strategy
- ✅ One-to-many link strategy
- ✅ Many-to-one link strategy
- ✅ Many-to-many link strategy
- ✅ Parent/Child link types
- ✅ Related and dependency link types
- ✅ Source and target item selectors
- ✅ Index-based selectors
- ✅ Dry run previews
- ✅ Execution with partial failures
- ✅ Skip existing links
- ✅ Hierarchical link validation
- ✅ Error handling
- ✅ Edge cases (mismatched counts, self-references)

#### 4. context-packages-by-handle.test.ts
Tests for the `wit-get-context-packages-by-query-handle` tool.

**Test Coverage:**
- Basic context package retrieval
- Item selection (all, indices, criteria)
- Preview limiting (maxPreviewItems)
- Optional parameters (history, comments, relations, children, parent, extended fields)
- Selection summaries
- Partial failure handling
- Next steps guidance

**Test Cases:** 13 test groups
- ✅ Retrieve context for all items
- ✅ Retrieve for selected indices
- ✅ Retrieve matching criteria
- ✅ Limit to maxPreviewItems
- ✅ Use default maxPreviewItems (10)
- ✅ Optional parameters (history, comments, relations)
- ✅ Error handling
- ✅ Partial fetch failures
- ✅ Selection summaries (all, index-based, criteria-based)
- ✅ Next steps guidance
- ✅ Edge cases (expired handles, empty results)
- ✅ Configuration parameters

### Integration Tests (`test/integration/`)

#### 5. bulk-operations-integration.test.ts
End-to-end integration tests for complete workflows.

**Test Scenarios:**

1. **Sprint Planning - Move and Transition**
   - Move backlog items to new sprint
   - Transition items from New to Active
   - Validates complete workflow

2. **Feature Decomposition - Create Hierarchy**
   - Link tasks to features using query handles
   - Create parent-child relationships
   - Use one-to-many and many-to-one strategies

3. **Sprint Cleanup - Bulk Transition and Context**
   - Transition completed items based on criteria
   - Retrieve context for remaining active items
   - Selective operations with tag filtering

4. **Dependency Chain - Link Related Items**
   - Create dependency links between tasks
   - Use predecessor/successor relationships
   - Many-to-many linking strategy

5. **Selective Operations with Criteria**
   - Transition critical bugs
   - Move stale items to technical debt
   - Get context for new items
   - Multiple criteria-based selections

6. **Error Recovery and Partial Success**
   - Handle API failures gracefully
   - Track successful and failed operations
   - Validate partial success reporting

**Test Cases:** 6 comprehensive end-to-end scenarios

## Test Execution

### Running Tests

```bash
# Run all unit tests
npm test -- test/unit

# Run specific test file
npm test -- test/unit/bulk-transition-state.test.ts

# Run integration tests
npm test -- test/integration

# Run with coverage
npm run test:coverage
```

### Test Dependencies

All tests mock external dependencies:
- **Azure CLI** - Mocked via `ado-discovery-service`
- **Azure DevOps API** - Mocked via `ADOHttpClient`
- **Configuration** - Mocked via `config.js`
- **Sampling/AI** - Mocked server instance with sampling support

## Coverage Goals

The test suite targets >80% code coverage for:
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

### Key Features Tested

✅ **Query Handle Pattern**
- Handle creation and expiration
- Item selection (all, indices, criteria)
- Safe bulk operations without ID hallucination

✅ **Item Selector Variations**
- `'all'` - All items in query result
- `[0, 2, 4]` - Specific indices
- `{ states: ['Active'], tags: ['critical'] }` - Criteria-based

✅ **Dry Run Mode**
- Preview operations before execution
- Limit preview items (maxPreviewItems)
- Show what will be changed

✅ **Error Handling**
- Invalid query handles
- Azure CLI unavailable
- API failures
- Partial successes
- Schema validation errors

✅ **Edge Cases**
- Expired query handles
- Empty query results
- Items already in target state
- Invalid state transitions
- Self-referencing links
- Mismatched item counts

## Test Patterns

### Standard Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  it('should handle scenario', async () => {
    // Arrange
    const workItemIds = [101, 102];
    const workItemContext = new Map(...);
    const handle = queryHandleService.storeQuery(...);

    // Act
    const result = await handler(config, args);

    // Assert
    expect(result.success).toBe(true);
    expect((result.data as any).property).toBe(expected);
  });
});
```

### Type Assertions

Tests use type assertions to work with `JSONValue` types:

```typescript
// Cast data to access properties
expect((result.data as any).items_succeeded).toBe(2);

// Or use intermediate variables
const formatDecision = result.metadata?.formatDecision as any;
expect(formatDecision?.confidence).toBeGreaterThan(0);
```

## Related Documentation

- [Bulk Operations Feature Spec](../docs/feature_specs/BULK_OPERATIONS.md)
- [Query Handle Pattern](../docs/feature_specs/ENHANCED_QUERY_HANDLE_PATTERN.md)
- [Testing Instructions](../.github/instructions/tests.instructions.md)

## Maintenance

When adding new tools or modifying existing ones:

1. Create/update unit tests in `test/unit/`
2. Add integration scenarios to `test/integration/bulk-operations-integration.test.ts`
3. Follow existing test patterns and naming conventions
4. Mock external dependencies appropriately
5. Test both happy paths and error scenarios
6. Update this documentation

---

**Last Updated:** 2025-10-14
**Test Files:** 5 (4 unit + 1 integration)
**Test Cases:** 57+
**Coverage Target:** >80%
