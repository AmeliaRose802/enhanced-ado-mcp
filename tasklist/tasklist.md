- ✅ **FIXED** - We have a very bad bug where the AI sometimes halucinates item id's to remove. See the halucination_fix_proposal.md
  - Fixed: Query Handle Architecture implemented (Phases 1-3 complete)
  - Fixed: Bulk operations now use query handles instead of direct IDs
  - Fixed: Prompts updated (find_dead_items, child_item_optimizer)
  - Status: Structurally impossible to hallucinate IDs now

- ⏳ **DEFERRED** - Add an intellegent tool for assigning story points to an item.
  - Status: Deferred until P0/P1 items complete (see IMPLEMENTATION_PLAN.md Task 8)
  - Requires: AI-powered estimation logic, historical velocity data, confidence scoring

- ✅ **FIXED** - Check all prompts and exposed resources and make sure they are updated for pagnation awareness
  - Fixed: Added ⚠️ IMPORTANT pagination warnings to wit-get-work-items-by-query-wiql tool
  - Fixed: maxResults, skip, top parameters documented with warnings
  - Status: Tool descriptions clearly warn about 200-item default limit
  - Remaining: Prompts still need pagination guidance (part of prompt cleanup task)

- ⏳ **PARTIAL** - All queries in prompts and resources need to be actually run in order to make sure they work. We should not include false and broken queries.
  - Status: Needs manual validation of WIQL queries in all prompts
  - Note: This is part of the prompt cleanup task (IMPLEMENTATION_PLAN Task 5)
  - Requires: Testing each query against actual Azure DevOps instance

- ✅ **FIXED** - Filter out "@odata.id": null, from odata responses since it uses context window without providing value.
  - Fixed: cleanODataResults function in odata-analytics.handler.ts (lines 42-54)
  - Implementation: `if (!key.startsWith('@odata') && value !== null) { cleaned[key] = value; }`
  - Status: Filters both @odata.* fields AND null values in single pass

- ⏳ **NEEDS INVESTIGATION** - When I enter a diffrent number of days to look back in the team velocity prompt, I still get the same thing entered.
  - Status: Needs manual testing with actual prompt usage
  - Investigation: Check if prompt argument is being passed correctly to tools
  - Location: team_velocity_analyzer.md prompt


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

- ⏳ **IN PROGRESS** - Clean up the codebase and make it more AI ready. Don't break things. Improve the archetecture and reduce tech debt. There may be some unused files which should all be deleted
  - Status: Part of IMPLEMENTATION_PLAN Task 10 (Codebase Cleanup & Architecture Improvement)
  - Requires: Systematic review after P0/P1 tasks complete
  - Priority: Medium (P2) - deferred until critical items done
  - Note: All 49 tests passing - no regressions

- ⏳ **NEEDS INVESTIGATION** - Should not pop up browser to get token. No idea what is going on
  - Status: Part of IMPLEMENTATION_PLAN Task 11 (Browser Auto-Launch for Token)
  - Priority: Low (P3) - annoying but not blocking
  - Requires: Investigation of Azure CLI authentication flow
  - Note: May be expected behavior - needs determination

- ✅ **PARTIAL FIX** - The prompt for enhacing a work item still asks for way too much stuff. Also doesn't actually update work item's description. Make sure it has tools to do so listed
  - Fixed: Added wit-bulk-update-by-query-handle to available tools
  - Fixed: Documented Option 1 (recommendation) vs Option 2 (direct updates)
  - Status: Tool capability added, prompt updated
  - Remaining: Prompt length could still be reduced (part of general prompt cleanup)

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

- ✅ **FIXED** - A number of our tests are currently failing making it harder to tell when we broke things. They should all be fixed.
  - Fixed: All 49 tests passing across 5 test suites
  - Suites: validate-hierarchy-fast, context-tools-registration, query-handle-service, resources-integration, resource-service
  - Status: Test foundation established for safe refactoring
  - Test time: ~4.4 seconds
  - Zero failures or errors