# Notes on Prompts

# Notes on Prompts

✅ **WIQL Query Tool Implementation Complete** - Our beta testers all requested we add a new tool called `wit_get_work_items_by_query_wiql` which allows us to fetch items using wiql. This feature has been successfully implemented with full REST API support, comprehensive documentation, and testing.

✅ **Tool Service Refactoring Complete** - Extracted tool handlers into separate modules (`handlers/` directory) to eliminate nested if-statements and improve maintainability. Reduced tool-service.ts from 287 lines to 117 lines (-59%).
- Full WIQL query support via REST API
- Configurable field selection with `IncludeFields` parameter
- Result limiting with `MaxResults` parameter (default 200)
- Comprehensive error handling
- Documentation and examples in README
- Test suite for validation

A lot of our beta testers requested we add automatic work item fetching in the various prompts and tools. We should accept a work item ID and then automatically inject in all context needed about that item. That would make it faster and easier for the caller

Our beta testers have requested that we don't require area path etc in our tools if we already have the info. We should auto fill these from our config instead.


- Dead item prompt:

    - Context inserted in prompt is helpful because it doesn't need to call the get config tool
    - Can get large groups of items in bulk using mcp server tools
    - Seems to work very well.
    - Agent requested additional tool: mcp_ado_wit_get_work_items_by_query_wiql


AI assignment prompt
    - Totally borked
    - Requires like 12 arguments the AI should fetch itself

AI Sutability prompt
    - Should not spit out json at me
    - Should prompt it to use the enhanced tool if possible 
    - AI requested tool (similar to previous work item package request): mcp_ado_wit_get_work_item_with_context,
        - wit-triage-analyzer

Feature Decomposer 
    - Still takes 50 million args. Should instead take work item id and fetch info itself.
    - Should suggest AI use the enhanced sampling tool if avable 

Hiyarchy Analyser 
    - Takes 50 zillon args
    - Should be getting path from config
    - Prompt says: "This hierarchy validation leverages VS Code's sampling capabilities for intelligent analysis of work item relationships and organizational patterns." which is incorrect since this is the non sampling prompt version

Intellegent Work Item analyser
    - Takes a million args
    - Unclear if this provides additional value.
    - TODO: Remove

Parell task planner
    - Fix spelling
    - Should take work item as a param
    - Should automatically insert area path instead of making it query for it

Security item planner:
    - Seems to actually insert stuff correctly
