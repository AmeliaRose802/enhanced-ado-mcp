# Contributing Guidelines

## Code Organization

```
enhanced-ado-mcp/
├── docs/                           # Essential documentation only
│   ├── feature_specs/              # Feature specifications
│   ├── guides/                     # User guides
│   ├── ARCHITECTURE.md             # System architecture
│   ├── CONTRIBUTING.md             # This file
│   └── README.md                   # Documentation index
├── mcp_server/                     # Server implementation
│   ├── src/                        # TypeScript source
│   │   ├── config/                 # Configuration & schemas
│   │   ├── services/               # Business logic
│   │   │   ├── handlers/           # Tool implementations
│   │   │   │   ├── core/           # Basic operations
│   │   │   │   ├── query/          # WIQL & OData
│   │   │   │   ├── bulk-operations/ # Bulk updates
│   │   │   │   ├── ai-powered/     # AI enhancements
│   │   │   │   └── ...             # Other categories
│   │   │   └── analyzers/          # AI-powered analysis
│   │   ├── types/                  # TypeScript types
│   │   └── utils/                  # Shared utilities
│   ├── prompts/                    # AI prompt templates
│   ├── resources/                  # Quick reference guides
│   └── test/                       # Unit & integration tests
├── tasklist/                       # Development notes (don't touch unless asked)
└── README.md                       # Main documentation
```

## Documentation Rules

### ❌ DO NOT CREATE:
- `*_SUMMARY.md` files
- `*_COMPLETE.md` files
- `*_REPORT.md` files
- `IMPLEMENTATION_STATUS.md`
- Verbose architecture docs
- Duplicate guides

### ✅ INSTEAD:
- Update existing documentation
- Use clear git commit messages
- Keep docs concise and actionable
- Put details in code comments
- Focus on HOW to use, not implementation history

## File Placement

- **User documentation** → `/docs`
- **Code** → `/mcp_server/src`
- **Tests** → `/mcp_server/src/test`
- **Prompts** → `/mcp_server/prompts`
- **Quick references** → `/mcp_server/resources`
- **Task tracking** → `/tasklist` (rarely modified)

## Documentation Standards

1. **Be concise** - Get to the point quickly
2. **Show examples** - Code speaks louder than words
3. **No redundancy** - One source of truth
4. **Maintainable** - Update existing docs, don't create new ones
5. **Git history** - Implementation details belong in commits

## Before Creating New Docs

1. Can this update an existing doc?
2. Is this essential for users?
3. Will this stay relevant?
4. Does it have clear examples?

If you answered "no" to any, reconsider creating it.

## Code Standards

- Use TypeScript, not PowerShell
- Follow existing patterns
- Write tests for new features
- Keep functions focused and small
- Use meaningful variable names

## Testing Guidelines

### Test Organization

Tests are located in `/mcp_server/src/test/` and follow these patterns:

- **Unit Tests**: Test individual functions in isolation with mocked dependencies
- **Integration Tests**: Test complete workflows with real-ish data
- **Test Naming**: `feature-name.test.ts` (e.g., `query-handle-selection.test.ts`)

### Writing Tests for Selection Features

When adding or modifying item selection functionality:

1. **Test All Selection Types**:
   ```typescript
   // Test "all" selector
   itemSelector: "all"
   
   // Test index-based selector
   itemSelector: [0, 2, 5]
   
   // Test criteria-based selector
   itemSelector: { states: ["Active"], tags: ["critical"] }
   ```

2. **Test Edge Cases**:
   - Empty query results
   - Invalid indices (negative, out of bounds)
   - No items matching criteria
   - Expired query handles
   - Combined criteria (AND logic)

3. **Test Validation**:
   - Invalid selector types should fail gracefully
   - Partial index matches should include warnings
   - Empty selections should return success with warning

### Example Selection Test

```typescript
describe('item selection', () => {
  it('should select items by criteria', async () => {
    const handle = createTestHandle([
      { id: 1, state: 'Active', tags: ['critical'] },
      { id: 2, state: 'Done', tags: [] }
    ]);
    
    const result = await selectItems(handle, {
      itemSelector: { states: ['Active'] }
    });
    
    expect(result.selected_items_count).toBe(1);
    expect(result.preview_items[0].id).toBe(1);
  });
});
```

### Extending Selection Criteria

To add new selection criteria:

1. **Update Type Definitions** (`src/config/schemas.ts`):
   ```typescript
   const criteriaSchema = z.object({
     states: z.array(z.string()).optional(),
     tags: z.array(z.string()).optional(),
     // Add new criteria here:
     priority: z.array(z.string()).optional()
   });
   ```

2. **Implement Selection Logic** (`src/services/query-handle-service.ts`):
   ```typescript
   selectByCriteria(criteria: SelectionCriteria): number[] {
     return this.itemContext.values()
       .filter(item => {
         // Add new criteria check:
         if (criteria.priority && 
             !criteria.priority.includes(item.priority))
           return false;
         // ... other checks
       })
       .map(item => item.id);
   }
   ```

3. **Add Tests** (`src/test/query-handle-selection.test.ts`):
   ```typescript
   it('should select by priority criteria', async () => {
     // Test new criteria
   });
   ```

4. **Update Documentation**:
   - Update `docs/QUERY_HANDLE_MIGRATION.md` with examples
   - Update `mcp_server/resources/query-handle-pattern.md`
   - Update tool descriptions in appropriate `src/config/tool-configs/*.ts` file

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test query-handle-selection.test.ts

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Commit Messages

Good:
```
feat: Add bulk comment tool for work items
fix: Handle escaped area paths correctly
docs: Update WIQL best practices
```

Bad:
```
Updated files
Made some changes
Fixed stuff
```

## Questions?

See `.github/copilot-instructions.md` for AI assistant guidelines.
