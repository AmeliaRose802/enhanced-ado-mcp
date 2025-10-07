# Changelog

All notable changes to the Enhanced ADO MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-10-07

### Added - Query Handle Item Selection

This major release introduces intelligent item selection for safe bulk operations, eliminating ID hallucination and providing multiple selection strategies.

#### Core Features

- **Item Selection Mechanism**: Three selection strategies for bulk operations
  - Select all items: `itemSelector: "all"`
  - Index-based selection: `itemSelector: [0, 2, 5]`
  - Criteria-based selection: `itemSelector: { states: ["Active"], tags: ["critical"], daysInactiveMin: 7 }`

- **New Tool: `wit-select-items-from-query-handle`**: Preview and validate item selection before executing bulk operations
  - Shows exactly which items will be selected
  - Supports all three selection strategies
  - Essential safety check for destructive operations

- **Enhanced Query Handle Service**:
  - Store and retrieve item context (state, tags, title, type, staleness)
  - Index-based item lookup
  - Criteria-based filtering with AND logic
  - Support for staleness calculations (daysInactiveMin/Max)

#### Updated Bulk Operations

All bulk operation tools now support the `itemSelector` parameter:

- `wit-bulk-comment-by-query-handle` - Add comments to selected items
- `wit-bulk-update-by-query-handle` - Update fields on selected items
- `wit-bulk-assign-by-query-handle` - Assign selected items
- `wit-bulk-remove-by-query-handle` - Remove selected items (with enhanced safety)

#### Testing & Quality

- **99 comprehensive tests** covering all selection scenarios:
  - Index-based selection tests (valid/invalid indices, empty results)
  - Criteria-based selection tests (states, tags, title contains, staleness)
  - Combined criteria tests (AND logic)
  - Edge cases (empty handles, expired handles, partial matches)
  - Integration tests for all bulk operations with itemSelector

#### Documentation

- **New Migration Guide**: [docs/QUERY_HANDLE_MIGRATION.md](docs/QUERY_HANDLE_MIGRATION.md)
  - Step-by-step migration from old pattern to new handle-based pattern
  - Common pitfalls and solutions
  - FAQ section with practical answers
  - Complete migration checklist

- **Enhanced Resources**:
  - `query-handle-pattern.md` - Complete pattern documentation with examples
  - `tool-selection-guide.md` - Updated with selection strategy guidance
  - Updated all bulk operation documentation

- **Updated Architecture Documentation**:
  - Query handle service architecture
  - Item selection workflow diagrams
  - itemContext storage patterns

### Changed

- **Query Handle Pattern**: Now the recommended approach for all bulk operations
  - Replaces manual ID extraction
  - Eliminates hallucination risks
  - Provides built-in validation

- **Bulk Operations**: All bulk tools now require query handles and itemSelector
  - Old pattern (manual ID lists) deprecated but still functional
  - New pattern provides preview and validation capabilities

### Migration Notes

**Breaking Changes:** None - old pattern still works but is deprecated.

**Recommended Actions:**
1. Update all WIQL queries to use `returnQueryHandle: true`
2. Replace manual ID extraction with handle-based operations
3. Add `itemSelector` parameter to all bulk operation calls
4. Use `wit-select-items-from-query-handle` to preview selections before destructive operations

See [QUERY_HANDLE_MIGRATION.md](docs/QUERY_HANDLE_MIGRATION.md) for detailed migration guide.

### Performance

- Item selection operations are O(n) where n is the number of items in the query result
- Query handles expire after 5 minutes of inactivity
- Index-based selection is fastest (direct lookup)
- Criteria-based selection includes efficient filtering

### Security

- Item selection validates all indices against query result bounds
- Prevents access to items outside the query result
- All destructive operations require explicit itemSelector
- Preview tool encourages validation before execution

---

## [1.4.1] - 2025-10-01

### Added

- MCP Resources feature for quick reference documentation
- Query handle pattern for anti-hallucination architecture
- Enhanced tool discovery and selection guidance

### Changed

- Improved sampling service configuration
- Updated documentation organization

---

## [1.4.0] - 2025-09-15

### Added

- AI-powered WIQL query generation
- Automatic model selection for performance
- Language model access management

### Changed

- Migrated to REST API from PowerShell
- Improved error handling and validation

---

## Earlier Versions

See git history for changes in versions 1.0.0 through 1.3.x.

[1.5.0]: https://github.com/AmeliaRose802/enhanced-ado-mcp/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/AmeliaRose802/enhanced-ado-mcp/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/AmeliaRose802/enhanced-ado-mcp/compare/v1.3.0...v1.4.0
