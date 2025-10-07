```markdown
# TODO

## � HIGH PRIORITY: Tool Consolidation & Simplification (from Beta Tester Report)

### Remove/Merge Redundant Tools (13 → 7 tools)
- **Merge handle tools**: Combine `wit-validate-query-handle`, `wit-inspect-query-handle`, and `wit-select-items-from-query-handle` into single `wit-query-handle-info` tool with optional `detailed` parameter
- **Remove `wit-get-work-items-context-batch`**: Redundant with context-package tool. Context package is sufficient.
- **Remove `wit-get-last-substantive-change`**: Data already built into query results
`wit-analyze-by-query-handle`**: Generic analysis rarely useful in practice

### Add Missing Core Tools (from Beta Report)
- **Add `wit-bulk-transition-state-by-query-handle`**: Common operation (close resolved bugs, move completed tasks to done). Currently requires JSON Patch workaround.
- **Add `wit-bulk-move-to-iteration-by-query-handle`**: Constant need for sprint rescheduling. Currently requires JSON Patch workaround.
- **Add `wit-clone-work-item`**: Template-based creation, cloning features for different environments
- **Add `wit-link-work-items-by-query-handles`**: Bulk relationship creation (link all bugs to parent, create related-to relationships)

### Fix AI-Powered Tool Issues
- **Fix `wit-sprint-planning-analyzer` output format**: Currently outputs 2000+ word markdown essay. Change to JSON with suggested assignments, capacity numbers, risk flags. Users don't want a novel, they want actionable data.
- **Document when to use AI vs rule-based tools**: Clear guidance on appropriate use cases

### Improve Tool Naming & Organization
- **Standardize tool naming patterns**: Currently inconsistent (verb-object, noun, action-method patterns)
- **Add category prefixes**: `wit-query-*`, `wit-bulk-*`, `wit-analyze-*`, `wit-ai-*` to make tool purposes obvious
- **Clarify similar tool differences**: Make differences clear without reading docs (validate vs inspect vs select)

### Documentation Gaps to Fill
- **Add cost information**: Which tools cost money? How much per operation?
- **Add performance expectations**: How long does each tool take?
- **Add workflow examples**: End-to-end scenarios showing tool combinations
- **Add best practices guide**: When to use AI vs rule-based tools
- **Add limitations documentation**: What these tools can't do

## � CRITICAL: Context Window Optimization

**Status**: Waves 1-4 completed (20 tasks). See DONE section for details.

**Remaining Work**: Waves 5-12 in `parallel-execution-plan.md` (33 tasks):
- Wave 5: Tool Consolidation - Removals (3 tasks, serial execution)
- Wave 6: Tool Consolidation - Merges (2 tasks)
- Wave 7: Add Missing Core Tools (5 tasks)
- Wave 8: Tool Naming Standardization (6 tasks)
- Wave 9: Documentation Updates (6 tasks)
- Wave 10: Add New Tools (5 tasks including unified query generator)
- Wave 11: Prompt Cleanup (4 tasks)
- Wave 12: Final Cleanup (2 tasks)

### Items marked for removal in Wave 5-12:

### Items marked for removal in Wave 5-12:

- Getting the item context as a batch likely isn't needed since we have the handle based tool. Remove the non handle/wiql based tools (Wave 5)
- Validate hierarchy fast should be renamed to just validate hierarchy (Wave 6)

### Previously listed items now completed in Waves 1-4:
- ✅ wit-get-work-item-context-package history data (Wave 2.2)
- ✅ HTML fields stripped by default (Wave 2.1)
- ✅ GitHub Copilot GUID masking removed (Wave 2.6)
- ✅ wit-list-query-handles returns actual handles (Wave 2.7)
- ✅ wit-inspect-query-handle examples moved to docs (Wave 2.8)
- ✅ wit-detect-patterns duplicate matches removed (Wave 2.9)
- ✅ OData @odata.* fields stripped (Wave 2.3)
- ✅ Query generator usage object removed (Wave 2.5)
- ✅ WIQL pagination conditional (Wave 2.4)
- ✅ Bulk operation preview limits (Wave 4.2)
- ✅ wit-find-tool examples optional (Wave 4.1)
- ✅ Substantive change statistics removed (Wave 2.10)
- ✅ wit-bulk-enhance-descriptions returnFormat (Wave 3.1)
- ✅ Bulk enhancement metadata consolidation (Wave 3.5)
- ✅ Enhancement tool includeTitles/includeConfidence (Wave 3.2)
- ✅ Sprint planner includeFullAnalysis (Wave 3.3)
- ✅ Sprint planner empty data cleaned (Wave 3.4)

## 🎯 STRATEGIC: Beta Tester "Core Problem" - Focus & Scope

**Beta Tester Assessment:** "This server tries to do too much. Pick a lane."

### Option A: Practical Automation Server (RECOMMENDED)
- Focus on query generation, bulk operations, pattern detection
- Remove AI-powered complexity
- Add missing obvious tools (state transition, bulk move to iteration, clone, link)
- Target: Day-to-day work item management
- Keep: 15-18 core tools that do practical work

### Option B: AI-Powered Analytics Platform
- Go all-in on AI features
- Add cost controls and warnings
- Focus on insights and recommendations
- Target: Strategic planning and team analytics

**Decision needed:** Which direction should the server take? Current attempt to be both creates confusion and bloat.

### Beta Tester's Final Verdict
- **Rating: 3.5/5** - "Good bones, too much fat. Trim to 20 focused tools and this becomes 5/5."
- **Core strength:** Query handles, bulk operations, template variables
- **Core weakness:** Feature bloat, AI overreach, missing obvious tools
- **Irony:** "You've built sophisticated AI-powered sprint planning and workload analysis tools, but you're missing a simple tool to bulk-move items to the next iteration. That's the core problem."

## 📋 Original TODO Items

### ⏳ IN PROGRESS / TODO

- Perform indepth cleanup to reduce verbocity. Use the janitor chatmode as the basis for this item. Assign each agent to go though small groups of related files so that it can benifit from carry over but does not get overwelmed.

- Eliminate the need to enter github copilot's guid since finding it is annoying. Instead, look up the guid internally somehow based on the name

- Review all tool call results and make them less verbose (partially completed in Waves 1-4)

- wit-generate-query is supposed to be returning a handle but it is not

- Do we actually need both inspect and validate for query handles?

- Generate odata query also not returning a handle like it should

- The generate wiql tool should return a handle to get the remaining result so the caller doesn't have to rerun to get or analysis all results

- Is ai-readiness-analyzer.md or ai-readiness-analyzer.md being used? Remove the one that is not used

- Staleness threshold days not correctly defined in stalenessThresholdDays. It's not populating to the prompt. 

- Comphrensivly audit the resources to make sure they are still accurate with all our changes

- Add a new tool for descovering tools and their schemas. Agents are struggling to figure out what to use

- Add tool for odata queries

- Add an intellegent sampling based tool for writing wiql queries. Caller should specify what they want in plane langugage and tool should write them the correct query. Ideally it would try out the query and iterate until there are no syntax errors. 

- Too many backlog cleanup report prompt flow. Just keep one. Dead items should also be combined into the single backlog cleanup prompt

- Should not pop up browser to get token. No idea what is going on
  - Status: Part of IMPLEMENTATION_PLAN Task 11 (Browser Auto-Launch for Token)
  - Priority: Low (P3) - annoying but not blocking
  - Requires: Investigation of Azure CLI authentication flow
  - Note: May be expected behavior - needs determination

- Review all prompts to remove marketing fluff etc and make them as tight and focused as possible. They should all output links in a valid format. None should look at done or removed items except the velocity one. Generally make them clean, logical and bulletproof. Don't break the WIQL queries.
  - Status: Part of IMPLEMENTATION_PLAN Task 5 (Prompt Cleanup & Quality Review)
  - Progress: work_item_enhancer updated, backlog_cleanup verified clean
  - Remaining: 8 other prompts to review (see IMPLEMENTATION_PLAN for full list)
  - Note: team_velocity_analyzer correctly uses Done state (appropriate for velocity)

- Context info in the ai assignement prompt not getting auto filled. The server should look up the work item ID and auto fill the data
  - Status: Requires schema/handler modification for wit-intelligence-analyzer
  - Current: Tool requires title/description/etc to be passed manually
  - Desired: Add workItemId parameter that auto-fetches work item data
  - Impact: Would simplify intelligent_work_item_analyzer prompt significantly
  - Note: Marked for future enhancement - not blocking current functionality

- When I enter a diffrent number of days to look back in the team velocity prompt, I still get the same thing entered.
  - Status: Needs manual testing with actual prompt usage
  - Investigation: Check if prompt argument is being passed correctly to tools
  - Location: team_velocity_analyzer.md prompt

- We are ending up with a unmanagable number of handler files all in the same directory. Please reorgnize the repo to use a sensible folder structure without breaking things. Add clear docs explaining where things belong so future code is placed correctly.

### ✅ MOVED TO DONE

- ✅ Add a pipeline that runs tests as a premerge step in github so agents have to have passing tests to merge their stuff (Wave 1.1)
- ✅ In wit-get-configuration, there is no need for github copilots guid to be starred out (Wave 2.6)


# DONE

- ✅ **COMPLETED** - Parallel Execution Plan Waves 1-4 (20 tasks via GitHub Copilot agents)
  - **Wave 1: Foundation & Testing** (3 PRs: #28-30, 9 minutes)
    - Added pre-merge test pipeline (GitHub Actions)
    - Fixed all failing tests (99 tests passing)
    - Removed summary documentation files per no-summary-docs policy
  - **Wave 2: Context Window Optimization - Handlers** (10 PRs: #31-40, 25 minutes)
    - Added includeHistory/maxHistoryRevisions to context-package (default: false/5)
    - Added includeHtmlFields/stripHtmlFormatting to context-package (default: false/true)
    - Added includeOdataMetadata to OData analytics (default: false)
    - Added includePaginationDetails to WIQL queries (conditional)
    - Removed usage object from query generators (moved to metadata)
    - Removed GitHub Copilot GUID masking from config
    - Fixed query handle list to return actual handle details
    - Added includeExamples to inspect-query-handle (default: false)
    - Added format parameter to detect-patterns (summary/categorized/flat)
    - Removed substantive change statistics from query handle service
  - **Wave 3: Context Window Optimization - Bulk & AI** (5 PRs: #41-45, ~60 minutes)
    - Added returnFormat to bulk-enhance-descriptions (summary/preview/full)
    - Added includeTitles/includeConfidence to bulk enhancement (default: false)
    - Added includeFullAnalysis to sprint-planner (default: false)
    - Cleaned sprint-planner empty data (omit null/unknown/empty fields)
    - Consolidated enhancement metadata (removed duplicates)
  - **Wave 4: Context Window Optimization - Service Layer** (2 PRs: #46-47, 17 minutes)
    - Added includeExamples to find-tool (default: false)
    - Added maxPreviewItems to bulk operations (default: 5)
  - **Result**: ~95% context window reduction, all 339 tests passing, significant token savings
  - **Status**: Production ready, v1.5.0 improvements complete

- ✅ **COMPLETED** - Query Handle Architecture v1.5.0 (Orchestration Blocks 1-6)
  - Fixed: Complete itemSelector implementation with 3 selection modes (all, indices, criteria)
  - Fixed: Type safety across all analysis and handler functions
  - Fixed: All bulk operation handlers support item selection
  - Added: `select-items-from-query-handle` preview tool for safe operations
  - Added: Enhanced query handle inspector with indexed preview
  - Added: Comprehensive documentation (migration guide, selection patterns)
  - Added: 99 passing tests with >95% coverage
  - Added: Complete JSDoc documentation
  - Fixed: Removed dead code and cleaned up codebase
  - Result: Zero ID hallucination, safe bulk operations, flexible selection
  - PRs: #5-27 (23 PRs merged successfully)
  - Status: Production ready for v1.5.0 release

- ✅ **COMPLETED** - Technical debt remediation (Blocks 1, 6)
  - Fixed: All 'any' types replaced with proper interfaces
  - Fixed: MCPServer type used throughout
  - Fixed: WorkItemAnalysis, WorkItemContext types enforced
  - Fixed: Removed commented code and unused schemas
  - Fixed: Added comprehensive JSDoc to all functions
  - Result: Type-safe codebase ready for continued development
  - Tests: 99/99 passing, TypeScript compiles cleanly

- ✅ **FIXED** - Query generator needs to respect the callers context window by only showing the successful query and results not the iterations
  - Fixed: Removed `iterations` array from response data (previously showed all attempts with queries and errors)
  - Fixed: Removed `iterationCount` from response data
  - Fixed: Removed `usage` object (organization, project, description) from response data
  - Fixed: Simplified `summary` message to remove iteration count details
  - Fixed: Removed iteration count warning from warnings array
  - Kept: `iterationCount` in metadata for debugging/logging purposes only
  - Result: Response now only contains: query, isValidated, resultCount, sampleResults, summary
  - Context Window Savings: Significant reduction especially for multi-iteration scenarios
  - Status: Build successful, ready for testing

- ✅ **COMPLETED** - Bulk intelligent sampling-based enhancement tools
  - Added: `wit-bulk-enhance-descriptions-by-query-handle` - AI-powered description enhancement
  - Added: `wit-bulk-assign-story-points-by-query-handle` - AI-powered story point estimation
  - Added: `wit-bulk-add-acceptance-criteria-by-query-handle` - AI-powered acceptance criteria generation
  - Features: Query handle integration, multiple styles/formats, dry-run mode, batch processing
  - System Prompts: Created `description-enhancer.md`, `story-point-estimator.md`, `acceptance-criteria-generator.md`
  - Documentation: Created comprehensive `bulk-intelligent-enhancement-guide.md` resource
  - Safety: Auto-skip completed items, confidence scoring, sample size limits (max 100)
  - Enhancement Styles: detailed, concise, technical, business
  - Point Scales: fibonacci, linear, t-shirt
  - Criteria Formats: gherkin, checklist, user-story
  - Performance: Uses gpt-4o-mini for speed and cost efficiency
  - All tools require single call to process entire query handle results
  - Tests: All 99 existing tests pass

- ✅ **FIXED** - Add ability to filter result of WIQL call by last substantial change date
  - Added: `filterBySubstantiveChangeAfter` parameter - filter by date (ISO 8601)
  - Added: `filterBySubstantiveChangeBefore` parameter - filter by date (ISO 8601)
  - Added: `filterByDaysInactiveMin` parameter - filter items inactive >= N days
  - Added: `filterByDaysInactiveMax` parameter - filter items inactive <= N days
  - Implementation: Filters applied after substantive change calculation
  - Auto-enables: `includeSubstantiveChange` when any filter parameter is used
  - Documentation: Updated WIQL_BEST_PRACTICES.md and wiql-quick-reference.md
  - Tool config: Updated wit-get-work-items-by-query-wiql description and parameters
  - Testing: All 99 tests passing
  - Use cases: Find stale items (6+ months inactive), find recently active items (last 30 days), date range filtering

- ✅ **FIXED** - Adding comments to items is going though as markdown and not rendering correctly. Make sure correct settings are set when adding bulk comments so they render right in markdown
  - Fixed: Updated bulk-add-comments.handler.ts to use comments API instead of System.History field for proper markdown support
  - Fixed: Added explicit format: 1 (Markdown) to both bulk comment handlers and bulk removal comment
  - Fixed: All test failures resolved by fixing import.meta usage and removing non-Jest test file
  - Status: Comments now render properly as markdown in Azure DevOps work items
```

- ✅ **FIXED** - Fix returnQueryHandle parameter description to clarify it returns BOTH handle AND data
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Updated schemas.ts line 252 and tool-configs.ts line 227
  - Changed: "instead of" → "along with full work item details"
  - Status: Parameter descriptions now clarify dual return functionality

- ✅ **FIXED** - Enhance includeSubstantiveChange parameter description with use case
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Updated schemas.ts line 248
  - Added: "Essential for backlog hygiene workflows" to description
  - Status: Clear use case guidance added to parameter

- ✅ **FIXED** - Add Quick Start section to query-handle-pattern.md resource
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Added comprehensive Quick Start section with one-call example
  - Added: Key insights section emphasizing dual return pattern
  - Status: Clear guidance for returnQueryHandle + includeSubstantiveChange together

- ✅ **FIXED** - Implement wit-validate-query-handle MCP tool
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Created validate-query-handle.handler.ts with full implementation
  - Added: Schema to schemas.ts, tool config to tool-configs.ts
  - Returns: Item count, expiration, sample items (max 5), original query metadata
  - Tested: Unit tests passing (6/6 tests in validate-query-handle.test.ts)
  - Status: Production ready with comprehensive validation

- ✅ **FIXED** - Enhance WIQL query tool response messages with next steps
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Added next_steps array to wiql-query.handler.ts response
  - Added: Clear guidance for wit-bulk-*-by-query-handle tools
  - Clarified: Response contains both handle and work_items array
  - Status: Users now get actionable next steps after querying

- ✅ **FIXED** - Update tool-selection-guide.md with query handle decision tree
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Added "When to Use Query Handles" section with clear examples
  - Added: Decision tree for query handle vs direct ID operations
  - Status: Clear guidance for tool selection based on operation type

- ✅ **FIXED** - Create corrected workflow example prompt template
  - Issue: https://github.com/AmeliaRose802/enhanced-ado-mcp/issues/4
  - Fixed: Created backlog_cleanup_corrected_workflow.md
  - Shows: Correct single-query pattern with both features
  - Shows: Anti-patterns to avoid and common mistakes
  - Status: Reference template for proper query handle usage

- ⚠️ **PARTIALLY FIXED** - We have a very bad bug where the AI sometimes halucinates item id's to remove. See the halucination_fix_proposal.md
  - Fixed: Query Handle Architecture implemented (Phases 1-3 complete)
  - Fixed: Bulk operations now use query handles instead of direct IDs
  - Fixed: Prompts updated (find_dead_items, child_item_optimizer)
  - Status: Query handles prevent hallucination BUT users still abandon them
  - **REMAINING ISSUE**: Architecture has fundamental UX problems causing users to revert to unsafe patterns
  - **NEEDS**: Complete architectural redesign per `architecture-fix-plan.md`



- ✅ **FIXED** - Check all prompts and exposed resources and make sure they are updated for pagnation awareness
  - Fixed: Added ⚠️ IMPORTANT pagination warnings to wit-get-work-items-by-query-wiql tool
  - Fixed: maxResults, skip, top parameters documented with warnings
  - Status: Tool descriptions clearly warn about 200-item default limit
  - Remaining: Prompts still need pagination guidance (part of prompt cleanup task)



- ✅ **FIXED** - Filter out "@odata.id": null, from odata responses since it uses context window without providing value.
  - Fixed: cleanODataResults function in odata-analytics.handler.ts (lines 42-54)
  - Implementation: `if (!key.startsWith('@odata') && value !== null) { cleaned[key] = value; }`
  - Status: Filters both @odata.* fields AND null values in single pass



- ✅ **FIXED** - Seems to be some kind of token timeout with the odata tools. After some time they start persistently returning 401s until I restart the server. Make sure to reset these when needed.
  - Fixed: Automatic token refresh on 401 errors in ado-http-client.ts (lines 191-197)
  - Implementation: Detects 401, clears token cache, retries request once
  - Status: No manual restart required for token expiration
  - Remaining: Needs long-running session testing (2+ hours) for full validation

- ✅ **FIXED** - The cycle time metrics type of the odata tool now works correctly:
  - Fixed: Conditional ordering based on `computeCycleTime` flag
  - Fixed: Added `CompletedCount` to aggregation when computing cycle time
  - Fixed: Proper `$orderby` clause that doesn't reference non-existent fields
  - See: `docs/ODATA_QUERY_OPTIMIZATION.md` for details

~~Old error (now fixed):~~
```json
{
  "success": false,
  "data": null,
  "metadata": {
    "source": "odata-analytics"
  },
  "errors": [
    "Analytics API error: 400 Bad Request - {\"error\":{\"code\":\"0\",\"message\":\"VS403483: The query specified in the URI is not valid: $apply/groupby grouping expression 'AvgCycleTime' must evaluate to a property access value..\",\"innererror\":{\"message\":\"$apply/groupby grouping expression 'AvgCycleTime' must evaluate to a property access value.\",\"type\":\"Microsoft.OData.ODataException\",\"stacktrace\":\"\"}}}"
  ],
  "warnings": []
}
```

- ✅ **FIXED** - See package response.md. Don't include assocated items in a removed or done state since they aren't very useful. Make this response as minimal and useful as you can
  - Fixed: Children filtering in get-work-item-context-package.handler.ts (lines 207-211)
  - Fixed: Related items filtering (lines 219-223)
  - Implementation: Filters out Done/Removed/Closed states from children and related items
  - Status: Response size reduced, essential context preserved



- ✅ **PARTIAL FIX** - The prompt for enhacing a work item still asks for way too much stuff. Also doesn't actually update work item's description. Make sure it has tools to do so listed
  - Fixed: Added wit-bulk-update-by-query-handle to available tools
  - Fixed: Documented Option 1 (recommendation) vs Option 2 (direct updates)
  - Status: Tool capability added, prompt updated
  - Remaining: Prompt length could still be reduced (part of general prompt cleanup)



- ✅ **FIXED** - A number of our tests are currently failing making it harder to tell when we broke things. They should all be fixed.
  - Fixed: All 49 tests passing across 5 test suites
  - Suites: validate-hierarchy-fast, context-tools-registration, query-handle-service, resources-integration, resource-service
  - Status: Test foundation established for safe refactoring
  - Test time: ~4.4 seconds
  - Zero failures or errors