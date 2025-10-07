# Parallel Execution Plan - AI-Optimized v2

## Execution Strategy

This plan maximizes parallelization by grouping work based on **file conflict potential**, not logical relatedness. Each wave can execute fully in parallel. Testing infrastructure is frontloaded to enable validation throughout.

**v2 Improvements**: Merged waves with zero file overlap, identified and resolved same-file conflicts, reduced from 16 waves to 12 waves (25% faster execution).

## Wave 1: Foundation & Testing Infrastructure (3 tasks)

**Conflict Domain**: CI/CD, test infrastructure, documentation structure  
**Can run in parallel**: No overlapping files

### 1.1: Add Pre-Merge Test Pipeline
- Add GitHub Actions workflow for automated testing
- Configure as required check for PR merges
- **Files**: `.github/workflows/test.yml` (new)
- **Spec**: Pre-merge testing pipeline that runs `npm test` in mcp_server directory, blocks merge on failure

### 1.2: Fix All Failing Tests
- Update test files to pass current test suite
- Ensure 100% test pass rate before proceeding
- **Files**: `mcp_server/src/test/**/*.test.ts`
- **Spec**: All existing tests must pass with zero failures/errors

### 1.3: Remove Summary Documentation
- Delete `AUDIT_SUMMARY.md`, `PARALLEL_EXECUTION_SUMMARY.md`, `SCRIPTS-SUMMARY.md`
- Clean up root directory per no-summary-docs policy
- **Files**: Root `.md` files (deletions only)
- **Spec**: Remove all summary files except user-facing docs in `/docs`

---

## Wave 2: Context Window Optimization - All Handlers (9 tasks)

**Conflict Domain**: Handler files, response formatters, query handle services  
**Can run in parallel**: Mostly independent, except 2.1 depends on 2.2 completion
**⚠️ Execution Order**: Run 2.2 FIRST, then 2.1 (same file conflict), all others parallel

### 2.1: Strip HTML Fields from Context Package
- Add `includeHtmlFields` (default: false) and `stripHtmlFormatting` (default: true) parameters
- Convert HTML fields to plain text by default
- **Files**: `mcp_server/src/services/work-items/handlers/get-work-item-context-package.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: HTML-to-text conversion for ReproSteps, AcceptanceCriteria fields
- **⚠️ Run FIRST**: Conflicts with 2.2 (same file)

### 2.2: Strip History from Context Package
- Add `includeHistory` (default: false) and `maxHistoryRevisions` (default: 5) parameters
- Strip history array by default to save ~40KB per item
- **Files**: `mcp_server/src/services/work-items/handlers/get-work-item-context-package.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Optional history inclusion with configurable depth limit
- **⚠️ Run SECOND**: Conflicts with 2.1 (same file)

### 2.3: Clean OData Response Metadata
- Add `includeOdataMetadata` parameter (default: false)
- Strip `@odata.*` fields unless explicitly requested
- **Files**: `mcp_server/src/services/analytics/handlers/odata-analytics.handler.ts`
- **Spec**: Opt-in for @odata metadata inclusion

### 2.4: Optimize WIQL Pagination Responses
- Only include pagination object when `totalCount > top` or `includePaginationDetails: true`
- Remove verbose pagination for single-item results
- **Files**: `mcp_server/src/services/queries/handlers/wiql-query.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Conditional pagination details based on result size

### 2.5: Optimize Query Generator Responses
- Remove `usage` object from data response (keep in metadata only)
- **Files**: `mcp_server/src/services/queries/handlers/generate-wiql-query.handler.ts`, `mcp_server/src/services/queries/handlers/generate-odata-query.handler.ts`
- **Spec**: Streamlined response without redundant usage info

### 2.6: Remove GitHub Copilot GUID Masking
- Remove `defaultGuid: "***"` from get-config response or show actual value
- **Files**: `mcp_server/src/services/config/handlers/get-config.handler.ts`
- **Spec**: Expose actual GUID or remove field entirely

### 2.7: Fix Query Handle List Response
- Return actual handle details in `handles` array instead of empty array
- **Files**: `mcp_server/src/services/query-handles/handlers/list-query-handles.handler.ts`
- **Spec**: Populate handles array with id, created_at, expires_at, item_count

### 2.8: Move Inspection Examples to Docs
- Add `includeExamples` parameter (default: false) to wit-inspect-query-handle
- Remove `selection_examples` from default response (~300 tokens saved)
- **Files**: `mcp_server/src/services/query-handles/handlers/inspect-query-handle.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Optional examples inclusion via parameter

### 2.9: Optimize Pattern Detection Responses
- Add `format` parameter: "summary" (counts only), "categorized" (default), "flat"
- Remove duplicate match arrays
- **Files**: `mcp_server/src/services/analysis/handlers/detect-patterns.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Configurable response format with no duplication

### 2.10: Remove Substantive Change Statistics
- Strip min/max/avg/median staleness statistics from query handle inspection
- Only return basic staleness info (last change date, days inactive)
- **Files**: `mcp_server/src/services/query-handles/query-handle-service.ts`
- **Spec**: Minimal staleness metadata in standard inspection

---

## Wave 3: Context Window Optimization - Bulk & AI Operations (5 tasks)

**Conflict Domain**: Bulk operation handlers, AI analysis handlers  
**Can run in parallel**: Mostly independent
**⚠️ Execution Order**: Run 3.4 LAST (touches all bulk handlers including 3.1's file)

### 3.1: Optimize Bulk Enhancement Responses
- Add `returnFormat` parameter: "summary", "preview" (200 chars), "full"
- Default to "summary" for dry-run, "preview" for operations
- **Files**: `mcp_server/src/services/bulk-operations/handlers/bulk-enhance-descriptions.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Configurable verbosity for enhancement results

### 3.2: Optimize Bulk Enhancement Details
- Add `includeTitles` (default: false) and `includeConfidence` (default: false) parameters
- Only include confidence scores < 0.85 (uncertainty threshold)
- **Files**: `mcp_server/src/services/bulk-operations/handlers/bulk-enhance-descriptions.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Minimal result details unless requested

### 3.3: Optimize Sprint Planner Responses
- Add `includeFullAnalysis` parameter (default: false)
- Remove `fullAnalysisText` field from default response (~6KB saved)
- On parse failure, return first 500 chars only with `rawAnalysisOnError` parameter for full text
- **Files**: `mcp_server/src/services/analysis/handlers/sprint-planning-analyzer.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Structured data only by default, optional full analysis text

### 3.4: Clean Sprint Planner Empty Data
- Remove fields with no data (zero/unknown/empty) instead of returning placeholders
- Omit `balanceMetrics`, `alternativePlans`, `confidenceLevel` when unavailable
- **Files**: `mcp_server/src/services/analysis/handlers/sprint-planning-analyzer.handler.ts`
- **Spec**: Omit null/empty/unknown fields from response

### 3.5: Consolidate Enhancement Metadata
- Remove duplicate success/failed/skipped counts from metadata
- Remove redundant `processedWorkItems` field
- **Files**: `mcp_server/src/services/bulk-operations/handlers/bulk-*.handler.ts` (all bulk handlers)
- **Spec**: Single location for operation counts
- **⚠️ Run LAST**: Touches multiple bulk handlers including bulk-enhance-descriptions

---

## Wave 4: Context Window Optimization - Service Layer (2 tasks)

**Conflict Domain**: Tool discovery & bulk operation services  
**Can run in parallel**: Different service files

### 4.1: Optimize Tool Discovery Responses
- Add `includeExamples` parameter (default: false)
- Return concise recommendations without detailed usage examples (~100+ tokens each)
- **Files**: `mcp_server/src/services/tools/handlers/find-tool.handler.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Minimal recommendations by default with optional examples

### 4.2: Add Preview Item Limits
- Add `maxPreviewItems` parameter (default: 5) to all bulk operation dry-run modes
- Limit preview size while showing representative sample
- **Files**: `mcp_server/src/services/bulk-operations/bulk-operation-service.ts`, `mcp_server/src/types/schemas.ts`
- **Spec**: Configurable preview size limit for dry-run operations

---

## Wave 5: Tool Consolidation - Removals (3 tasks)

**Conflict Domain**: Tool configs, handler files (deletions)  
**Can run in parallel**: Independent file deletions

### 5.1: Remove Redundant Context Batch Tool
- Delete `wit-get-work-items-context-batch` tool (redundant with context-package)
- **Files**: Delete handler, remove from `tool-configs.ts`, update docs
- **Spec**: Remove tool entirely, update migration guide

### 8.2: Remove Last Substantive Change Tool
- Delete `wit-get-last-substantive-change` tool (data in query results)
- **Files**: Delete handler, remove from `tool-configs.ts`, update docs
- **Spec**: Remove tool entirely, document data location

### 8.3: Remove Generic Analysis Tool
- Delete `wit-analyze-by-query-handle` tool (rarely useful)
- **Files**: Delete handler, remove from `tool-configs.ts`, update docs
- **Spec**: Remove tool entirely, explain alternative tools

---

## Wave 9: Tool Consolidation - Merges (2 tasks)

**Conflict Domain**: Query handle services, tool registration  
**Can run in parallel**: Different consolidation targets

### 9.1: Merge Query Handle Tools
- Combine `wit-validate-query-handle`, `wit-inspect-query-handle`, `wit-select-items-from-query-handle`
- Create single `wit-query-handle-info` tool with `detailed` parameter
- **Files**: Create new handler, update `tool-configs.ts`, migration docs
- **Spec**: Unified query handle inspection with optional detail levels

### 9.2: Rename Hierarchy Validation Tool
- Rename `wit-validate-hierarchy-fast` to `wit-validate-hierarchy`
- Remove "fast" suffix (no other version exists)
- **Files**: Rename handler file, update `tool-configs.ts`, update all docs/prompts
- **Spec**: Simplified naming without misleading qualifier

---

## Wave 10: Add Missing Core Tools (5 tasks)

**Conflict Domain**: New bulk operation handlers, query generation  
**Can run in parallel**: Independent new tools

### 10.1: Add Unified Query Generator Tool
- Create `wit-generate-query` tool that intelligently selects OData or WIQL based on user intent
- Analyze natural language request to determine if OData (analytics/aggregation) or WIQL (work item retrieval) is appropriate
- **Files**: New handler `generate-query.handler.ts`, schema, tool config, prompt template
- **Spec**: Smart query type selection with intent analysis, returns query string with explanation of why that type was chosen

### 10.2: Add Bulk State Transition Tool
- Create `wit-bulk-transition-state-by-query-handle` tool
- Support common transitions: close resolved bugs, move completed tasks to done
- **Files**: New handler `bulk-transition-state.handler.ts`, schema, tool config
- **Spec**: Query handle-based state transitions with validation

### 10.3: Add Bulk Move to Iteration Tool
- Create `wit-bulk-move-to-iteration-by-query-handle` tool
- Support sprint rescheduling operations
- **Files**: New handler `bulk-move-to-iteration.handler.ts`, schema, tool config
- **Spec**: Query handle-based iteration assignment

### 10.4: Add Clone Work Item Tool
- Create `wit-clone-work-item` tool
- Support template-based creation and environment cloning
- **Files**: New handler `clone-work-item.handler.ts`, schema, tool config
- **Spec**: Single work item cloning with field mapping

### 10.5: Add Link Work Items Tool
- Create `wit-link-work-items-by-query-handles` tool
- Bulk relationship creation (link all bugs to parent, create related-to relationships)
- **Files**: New handler `bulk-link-work-items.handler.ts`, schema, tool config
- **Spec**: Query handle-based relationship creation

---

## Wave 8: Improve Tool Naming & Organization (1 task)

**Conflict Domain**: Tool configs, all documentation  
**Can run alone**: Broad impact across naming

### 12.1: Standardize Tool Naming Patterns
- Add category prefixes: `wit-query-*`, `wit-bulk-*`, `wit-analyze-*`, `wit-ai-*`
- Rename tools to follow consistent verb-object pattern
- Update all tool configs, handlers, docs, prompts
- **Files**: `tool-configs.ts`, all handler files (rename), all docs
- **Spec**: Consistent naming convention with clear categorization

---

## Wave 9: Documentation Enhancements (5 tasks)

**Conflict Domain**: Documentation files  
**Can run in parallel**: Independent doc updates

### 9.1: Add Cost Information Docs
- Document which tools cost money and per-operation costs
- **Files**: New `docs/COST_GUIDE.md`, update tool configs
- **Spec**: Comprehensive cost breakdown for AI-powered tools

### 9.2: Add Performance Expectations Docs
- Document typical execution time for each tool
- **Files**: New `docs/PERFORMANCE_GUIDE.md`, update tool configs
- **Spec**: Expected latency ranges per tool type

### 9.3: Add Workflow Examples Docs
- End-to-end scenarios showing tool combinations
- **Files**: New `docs/WORKFLOW_EXAMPLES.md`
- **Spec**: 5-10 real-world workflows with multi-tool sequences

### 9.4: Add AI vs Rule-Based Best Practices
- Clear guidance on when to use AI vs rule-based tools
- **Files**: New `docs/AI_TOOL_SELECTION.md`
- **Spec**: Decision matrix for tool selection

### 13.5: Add Limitations Documentation
- Document what these tools can't do
- **Files**: New `docs/LIMITATIONS.md`
- **Spec**: Known constraints and unsupported operations

---

## Wave 14: Prompt Cleanup (8 tasks)

**Conflict Domain**: Prompt files  
**Can run in parallel**: Independent prompt files

### 14.1-14.8: Clean Individual Prompts
- Remove marketing fluff, tighten focus, ensure valid link format
- Don't look at Done/Removed except velocity analyzer
- Fix WIQL queries, ensure bulletproof logic
- **Files**: Each task handles 1-2 prompts from `mcp_server/prompts/`
- **Spec**: Minimal, focused prompts with valid output formats

---

## Wave 15: Resource Audit (1 task)

**Conflict Domain**: Resource files  
**Can run alone**: Comprehensive cross-reference check

### 15.1: Audit All Resources for Accuracy
- Verify all `/mcp_server/resources` docs reflect current implementation
- Update outdated references, remove obsolete content
- **Files**: All files in `mcp_server/resources/`
- **Spec**: Accurate, current documentation matching codebase

---

## Wave 16: Resolve Strategic Direction (1 task)

**Conflict Domain**: Project scope, tool inventory  
**Can run alone**: Decision-making task

### 16.1: Strategic Direction Decision
- Choose: Practical Automation Server (15-18 tools) OR AI Analytics Platform
- Document decision and resulting tool retention/removal plan
- **Files**: New `docs/STRATEGIC_DIRECTION.md`
- **Spec**: Clear direction with tool inventory implications

---

## Execution Notes

- **Total Waves**: 12 (down from 16, 25% faster)
- **Total Tasks**: 53 (up from 52 - added unified query generator)
- **Maximum Parallelization**: Wave 2 has 10 parallel tasks (with 2 serialized), Wave 10 has 5 parallel tasks (up from 4)
- **Minimum Conflicts**: Each wave groups by file conflict domain with explicit serial execution warnings
- **Testing**: Wave 1 establishes testing infrastructure for all subsequent work
- **Dependencies**: Each wave can start immediately after previous wave completes
- **Conflict Resolution**: 
  - Wave 2: Tasks 2.1 and 2.2 must run serially (same file)
  - Wave 3: Task 3.5 runs last (touches files modified by 3.1-3.2)
  - Wave 6: Tasks 6.1 and 6.2 must run serially (both modify tool-configs.ts)
- **GitHub Integration**: Generate issue specs from this plan when executing each wave

## Optimization Summary

**Merged Waves**:
- Old Waves 2+3 → New Wave 2 (Context Window Optimization - All Handlers)
- Old Waves 4+5 → New Wave 3 (Context Window Optimization - Bulk & AI Operations)
- Old Waves 6+7 → New Wave 4 (Context Window Optimization - Service Layer)
- Old Waves 10+11 → New Wave 7 (Add Missing Core Tools & AI Improvements)

**Conflict Resolutions**:
- Wave 2: Identified same-file conflict between tasks 2.1 and 2.2, added serial execution order
- Wave 3: Identified cross-handler conflict with task 3.5, moved to end of wave
- Wave 6: Identified tool-configs.ts conflict, marked for serial execution

**Parallelism Improvements**:
- Wave 2: 10 parallel tasks (up from 6+4)
- Wave 3: 5 parallel tasks (up from 3+2)
- Wave 4: 2 parallel tasks (up from 1+1)
- Wave 7: 5 parallel tasks (up from 4+1)
- **Overall execution time reduced by 25%**

## Issue Creation Template

For each task, create GitHub issue with:
- **Title**: Task ID + Description (e.g., "2.1: Strip History from Context Package")
- **Labels**: `wave-N`, `context-optimization` | `tool-consolidation` | `documentation` | etc.
- **Body**: Include spec from this plan + files to modify
- **Branch**: `wave-N/task-N.N-description`
- **PR Template**: Reference issue, include test results, list modified files

## Success Criteria

- All tests pass after each wave
- No merge conflicts within waves (serial execution enforced where needed)
- Context window usage reduced by >50% (waves 2-4)
- Tool count reduced from 13 to target range (waves 5-6)
- 100% documentation accuracy (wave 11)
- Strategic direction decided and documented (wave 12)
