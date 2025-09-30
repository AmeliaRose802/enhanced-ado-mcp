# Project TODOs

- Perform a general cleanup to make the project more clean and AI friendly. Split up large files, clean up unused code, use common methods instead of reinventing the wheel

- Update the readme to include instructions with info on configuring access to sampling. You will need to check the latest VSCode docs as this is a very new feature

- Only offer sampling features when that is actually supported. When sampling is not enabled, do not offer these features.  

- Make the AI responses for sampling features smaller and more focused so they don't eat our context

- ✅ The tool wit-ai-assignment-analyzer should not attempt to assign the item. This is unsafe. The caller should be given the option to do this sepratly 
    - **COMPLETED**: Removed AutoAssignToAI parameter and automatic assignment logic. Tool now provides analysis only. Users must use wit-assign-to-copilot separately for assignment.

- All tools should have documentation of schema

