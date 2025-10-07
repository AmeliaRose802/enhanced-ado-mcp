# Handler Organization Guide

This directory contains all MCP tool handlers organized by functional category. This organization improves maintainability, makes it easier to find relevant code, and establishes clear patterns for future development.

## Directory Structure

```
handlers/
├── core/               # Core CRUD operations and basic queries
├── query/              # WIQL and OData query operations
├── query-handles/      # Query handle lifecycle management
├── bulk-operations/    # Bulk operations using query handles
├── ai-powered/         # AI-enhanced work item operations
├── analysis/           # Pattern detection and validation
├── integration/        # External service integrations
└── context/            # Context package operations
```

---

## Category Descriptions

### 📦 `core/`
**Purpose:** Core work item CRUD operations and basic queries

**When to add here:**
- Basic operations on individual work items
- Configuration and discovery operations
- Fundamental building blocks used by other categories

**Current handlers:**
- `create-new-item.handler.ts` - Create work items with optional parent relationship
- `get-configuration.handler.ts` - Retrieve server configuration
- `get-work-items-context-batch.handler.ts` - Batch retrieve work items with context

**Import pattern:**
```typescript
import { someService } from "../../service-name.js";      // Services (up 2 levels)
import { someUtil } from "../../../utils/util-name.js";   // Utils (up 3 levels)
import { someType } from "../../../types/type-name.js";   // Types (up 3 levels)
```

---

### 🔍 `query/`
**Purpose:** WIQL and OData query operations

**When to add here:**
- Tools that execute WIQL queries
- OData Analytics queries for metrics and aggregations
- AI-powered query generation
- Query result processing (but not handle management)

**Current handlers:**
- `wiql-query.handler.ts` - Execute WIQL queries with optional query handle storage
- `odata-analytics.handler.ts` - Query Azure DevOps Analytics with OData
- `generate-wiql-query.handler.ts` - AI-powered natural language to WIQL conversion

**Key characteristics:**
- Executes queries but doesn't manage handle lifecycle
- May optionally create query handles as output
- Focused on query execution and result transformation

---

### 🔖 `query-handles/`
**Purpose:** Query handle lifecycle management

**When to add here:**
- Tools for inspecting query handles
- Validating query handle contents
- Listing active handles
- Handle metadata operations

**Current handlers:**
- `list-query-handles.handler.ts` - List all active query handles with statistics
- `inspect-query-handle.handler.ts` - Detailed inspection of query handle contents
- `validate-query-handle.handler.ts` - Validate handle exists and show metadata

**Key characteristics:**
- Read-only operations on existing handles
- Does NOT execute bulk operations (that's `bulk-operations/`)
- Provides visibility into handle contents for user decision-making

---

### ⚡ `bulk-operations/`
**Purpose:** Bulk operations that modify multiple work items using query handles

**When to add here:**
- Tools that perform operations on ALL items in a query handle
- State transitions, updates, assignments, removals
- Operations that modify work items in bulk
- Non-AI bulk operations (AI operations go in `ai-powered/`)

**Current handlers:**
- `bulk-comment-by-query-handle.handler.ts` - Add comments to all items
- `bulk-remove-by-query-handle.handler.ts` - Remove multiple items with safety checks
- `bulk-update-by-query-handle.handler.ts` - Update fields on multiple items
- `bulk-assign-by-query-handle.handler.ts` - Assign multiple items to user

**Key characteristics:**
- All operations use query handles (prevents ID hallucination)
- Support dry-run mode for safety
- Return detailed success/failure results
- Non-AI enhancements (simpler operations)

---

### 🤖 `ai-powered/`
**Purpose:** AI-enhanced work item operations using language models

**When to add here:**
- Tools that use AI sampling for intelligent enhancements
- Bulk operations that leverage LLMs for content generation
- Analysis tools that require AI reasoning
- Any handler that requires `serverInstance` for sampling

**Current handlers:**
- `bulk-add-acceptance-criteria.handler.ts` - AI-generated acceptance criteria
- `bulk-assign-story-points.handler.ts` - AI-powered story point estimation
- `bulk-enhance-descriptions.handler.ts` - AI-enhanced work item descriptions
- `analyze-by-query-handle.handler.ts` - AI-powered work item analysis

**Key characteristics:**
- Requires VS Code language model access (sampling)
- Uses gpt-4o-mini or other fast models for cost/speed balance
- Graceful degradation when sampling unavailable
- Returns confidence scores and reasoning where applicable

---

### 🔬 `analysis/`
**Purpose:** Pattern detection, validation, and analysis tools

**When to add here:**
- Pattern detection across work items
- Hierarchy validation
- Substantive change analysis
- Security-specific extractors
- Non-AI analysis tools (AI analysis goes in `ai-powered/`)

**Current handlers:**
- `detect-patterns.handler.ts` - Find duplicates, placeholders, orphans
- `get-last-substantive-change.handler.ts` - True activity analysis
- `validate-hierarchy.handler.ts` - Fast rule-based hierarchy validation
- `extract-security-links.handler.ts` - Extract security remediation links

**Key characteristics:**
- Rule-based or algorithmic analysis (no AI)
- Focus on data quality and structural validation
- Efficient, deterministic results
- Used for backlog hygiene and quality gates

---

### 🔗 `integration/`
**Purpose:** External service integrations

**When to add here:**
- GitHub Copilot assignment and management
- Integration with other external systems
- Branch linking and external references
- Cross-platform coordination

**Current handlers:**
- `assign-to-copilot.handler.ts` - Assign work item to GitHub Copilot
- `new-copilot-item.handler.ts` - Create and immediately assign to Copilot

**Key characteristics:**
- Bridges Enhanced ADO MCP with external systems
- May require additional configuration (e.g., Copilot GUID)
- Focused on cross-system workflows

---

### 📄 `context/`
**Purpose:** Rich context package operations

**When to add here:**
- Tools that bundle comprehensive work item context
- Context packages with relationships, history, comments
- Full work item graph retrieval
- Tools that provide "everything about this item"

**Current handlers:**
- `get-work-item-context-package.handler.ts` - Comprehensive context for single item

**Key characteristics:**
- Returns rich, detailed context (not just basic fields)
- Includes relationships, history, comments, PRs/commits
- Optimized for AI agents that need full context
- May be expensive - use selectively

---

## Import Path Conventions

All handlers are now in subdirectories, so import paths need to go up additional levels:

```typescript
// Services (2 levels up from handler to services/)
import { someService } from "../../service-name.js";

// Utils, Config, Types (3 levels up from handler subdirectory)
import { someUtil } from "../../../utils/util-name.js";
import { config } from "../../../config/config.js";
import type { SomeType } from "../../../types/type-name.js";

// Other handlers (relative path through subdirectories)
import { otherHandler } from "../other-category/other.handler.js";
```

---

## Decision Tree for New Handlers

Use this flowchart to determine where a new handler belongs:

```
Is it external integration (GitHub, etc.)?
├─ YES → integration/
└─ NO ↓

Does it require AI/LLM sampling?
├─ YES → ai-powered/
└─ NO ↓

Does it provide rich context packages?
├─ YES → context/
└─ NO ↓

Does it execute queries (WIQL/OData)?
├─ YES → query/
└─ NO ↓

Does it manage query handle lifecycle?
├─ YES → query-handles/
└─ NO ↓

Does it perform bulk operations via handles?
├─ YES → bulk-operations/
└─ NO ↓

Does it analyze/validate work items?
├─ YES → analysis/
└─ NO ↓

Default → core/
```

---

## Handler Naming Conventions

Follow these patterns for consistency:

**Pattern:** `<action>-<subject>.handler.ts`

**Examples:**
- ✅ `create-new-item.handler.ts`
- ✅ `bulk-assign-by-query-handle.handler.ts`
- ✅ `get-work-item-context-package.handler.ts`
- ❌ `handler-create-item.ts` (wrong order)
- ❌ `create.handler.ts` (missing subject)
- ❌ `createNewItem.handler.ts` (use kebab-case, not camelCase)

---

## Testing Conventions

Test files should import handlers from their new locations:

```typescript
// OLD (pre-reorganization)
import { handleValidateQueryHandle } from '../services/handlers/validate-query-handle.handler.js';

// NEW (post-reorganization)
import { handleValidateQueryHandle } from '../services/handlers/query-handles/validate-query-handle.handler.js';
```

**Key testing principles:**
- Update imports after moving handlers
- All 99 tests must pass after reorganization
- Test files remain in `src/test/` (not organized by category)
- Mock external dependencies appropriately

---

## Registration in tool-service.ts

When registering handlers in `tool-service.ts`, group imports by category:

```typescript
// Core handlers
import { handleGetConfiguration } from "./handlers/core/get-configuration.handler.js";
import { handleCreateNewItem } from "./handlers/core/create-new-item.handler.js";

// Query handlers
import { handleWiqlQuery } from "./handlers/query/wiql-query.handler.js";
import { handleODataAnalytics } from "./handlers/query/odata-analytics.handler.js";

// Query handle handlers
import { handleValidateQueryHandle } from './handlers/query-handles/validate-query-handle.handler.js';
import { handleListQueryHandles } from './handlers/query-handles/list-query-handles.handler.js';

// ... and so on
```

This makes it easy to see which categories are being used and maintains logical grouping.

---

## Migration Checklist

When moving an existing handler to a new category:

- [ ] Move file to appropriate category directory
- [ ] Update all internal imports (add additional `../` for depth)
- [ ] Update import in `tool-service.ts`
- [ ] Update import in test files (if any)
- [ ] Run `npm run build` to check for compile errors
- [ ] Run `npm test` to ensure all tests pass
- [ ] Commit with clear message: `refactor: move <handler> to <category>/`

---

## Future Considerations

As the server grows, consider:

1. **Barrel Exports:** Add `index.ts` files in each category directory to simplify imports
   ```typescript
   // handlers/core/index.ts
   export { handleCreateNewItem } from './create-new-item.handler.js';
   export { handleGetConfiguration } from './get-configuration.handler.js';
   
   // Then in tool-service.ts:
   import { handleCreateNewItem, handleGetConfiguration } from './handlers/core/index.js';
   ```

2. **Subcategories:** If a category grows beyond 8-10 files, consider subcategories
   - Example: `bulk-operations/comments/` and `bulk-operations/assignments/`

3. **Shared Utilities:** Create category-specific utility files
   - Example: `bulk-operations/_shared/dry-run-validator.ts`

4. **Documentation:** Update this README whenever adding new categories or patterns

---

## Questions?

- **General patterns:** See this README
- **Type definitions:** See `src/types/work-items.ts`
- **Architecture:** See `docs/ARCHITECTURE.md`
- **Contributing:** See `docs/CONTRIBUTING.md`

**Last Updated:** October 6, 2025  
**Status:** Production-ready organization structure
