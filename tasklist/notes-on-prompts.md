Notes on Prompts

Our beta testers all requested we add a new tool called `wit_get_work_items_by_query_wiql` which allows us to fetch items using wiql. Please implement this feature



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
