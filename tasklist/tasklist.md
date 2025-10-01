# Project TODOs

- Split up tool service so each tool is in it;s own repo


- Perform a general cleanup to make the project more clean and AI friendly. Split up large files, clean up unused code, use common methods instead of reinventing the wheel

- Update the readme to include instructions with info on configuring access to sampling. You will need to check the latest VSCode docs as this is a very new feature

- Only offer sampling features when that is actually supported. When sampling is not enabled, do not offer these features.  

- Make the AI responses for sampling features smaller and more focused so they don't eat our context

- ✅ The tool wit-ai-assignment-analyzer should not attempt to assign the item. This is unsafe. The caller should be given the option to do this sepratly 
    - **COMPLETED**: Removed AutoAssignToAI parameter and automatic assignment logic. Tool now provides analysis only. Users must use wit-assign-to-copilot separately for assignment.

- ✅ Hierarchy validator wasn't fetching children when analyzing specific work items
    - **COMPLETED**: Enhanced hierarchy validator to automatically fetch child work items when `WorkItemIds` is provided, especially for deep analysis or single-item validation. Now properly analyzes parent-child relationships by including descendants in the analysis.

- All tools should have documentation of schema

- Idea: Would it be feasable to add tools for finding a list of repos/area paths that the current user comonly uses?

- ✅ We have both system and normal prompts for most things. Please reduce the redundency by making
    - **COMPLETED**: System prompts (in `prompts/system/`) are concise JSON-focused prompts used for actual AI sampling calls. Normal prompts (in `prompts/`) provide rich documentation with YAML frontmatter for the MCP prompt listing feature. This separation is intentional: system prompts optimize token usage for AI calls, while normal prompts provide comprehensive documentation for users. The architecture correctly uses `loadSystemPrompt()` for sampling and `getPromptContent()` for user-facing prompt display. 