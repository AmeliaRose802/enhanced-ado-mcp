```markdown
# TODO

- ⏳ **CRITICAL ARCHITECTURE ISSUE** - Query Handle Architecture Fundamental Problem  
  - Issue: Two competing paradigms for bulk operations causing user confusion and ID hallucination
  - Status: NEEDS IMMEDIATE ATTENTION - See `tasklist/architecture-fix-plan.md`
  - Impact: Users abandon query handles → revert to hallucination-prone manual ID operations  
  - Priority: P0 - Blocks reliable bulk operations

- Too many backlog cleanup report prompt flow. Just keep one. Dead items should also be combined into the single backlog cleanup prompt

- Flow for removing by handle still isn't right. User needs to be able to confirm removal of a specific item ID and then server needs to allow agent to remove it while validating that handle, id and title match to make sure the right item was used


- Optionally support getting additional context based on wiql query

- ⏳ **NEEDS INVESTIGATION** - Should not pop up browser to get token. No idea what is going on
  - Status: Part of IMPLEMENTATION_PLAN Task 11 (Browser Auto-Launch for Token)
  - Priority: Low (P3) - annoying but not blocking
  - Requires: Investigation of Azure CLI authentication flow
  - Note: May be expected behavior - needs determination


- ⏳ **IN PROGRESS** - Review all prompts to remove marketing fluff etc and make them as tight and focused as possible. They should all output links in a valid format. None should look at done or removed items except the velocity one. Generally make them clean, logical and bulletproof. Don't break the WIQL queries.
  - Status: Part of IMPLEMENTATION_PLAN Task 5 (Prompt Cleanup & Quality Review)
  - Progress: work_item_enhancer updated, backlog_cleanup verified clean
  - Remaining: 8 other prompts to review (see IMPLEMENTATION_PLAN for full list)
  - Note: team_velocity_analyzer correctly uses Done state (appropriate for velocity)

- ⏳ **NEEDS ARCHITECTURE CHANGE** - Context info in the ai assignement prompt not getting auto filled. The server should look up the work item ID and auto fill the data
  - Status: Requires schema/handler modification for wit-intelligence-analyzer
  - Current: Tool requires title/description/etc to be passed manually
  - Desired: Add workItemId parameter that auto-fetches work item data
  - Impact: Would simplify intelligent_work_item_analyzer prompt significantly
  - Note: Marked for future enhancement - not blocking current functionality

- ⏳ **IN PROGRESS** - Managing tech debt is important to the heathy continual devlopment. Please fix tech debt
  - Status: See IMPLEMENTATION_PLAN Task 10 (Codebase Cleanup & Architecture Improvement)
  - Approach: Systematic tech debt reduction after P0/P1 completion
  - Current: All tests passing (49/49) - stable foundation for refactoring
  - Priority: Medium (P2)

- ⏳ **NEEDS INVESTIGATION** - When I enter a diffrent number of days to look back in the team velocity prompt, I still get the same thing entered.
  - Status: Needs manual testing with actual prompt usage
  - Investigation: Check if prompt argument is being passed correctly to tools
  - Location: team_velocity_analyzer.md prompt

- ⏳ **DEFERRED** - Add an intellegent tool for assigning story points to an item.
  - Status: Deferred until P0/P1 items complete (see IMPLEMENTATION_PLAN.md Task 8)
  - Requires: AI-powered estimation logic, historical velocity data, confidence scoring


We are ending up with a unmanagable number of handler files all in the same directory. Please reorgnize the repo to use a sensible folder structure without breaking things. Add clear docs explaining where things belong so future code is placed correctly.


# DONE

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