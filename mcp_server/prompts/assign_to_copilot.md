---
name: assign_to_copilot
version: 1.0.0
description: >-
  AI-powered workflow to create or assign work items to GitHub Copilot with specialized agent selection.
  Automatically discovers context from current repository, enhances descriptions for AI readiness,
  and assigns to the most appropriate specialized Copilot agent.
---

# Assign to Copilot Workflow

## EXECUTION

**1. Get work item** - Ask: "Enter work item ID or describe new item"
   - Numeric → existing item
   - Text → new item to create

**2. Detect repository** - Check git remote or ask user

**3. Gather context** - Read README, package.json, recent commits. For existing items: fetch with `get-context`

**4. Analyze AI suitability** - Use `analyze-ai-assignment` to check if item is ready for AI

**5. Handle refinement** - If NEEDS_REFINEMENT, explain issues and offer to enhance the item

**6. Discover agents** - Use `list-agents` with repository name

**7. Assign to Copilot** - Use `assign-copilot` with optional `specializedAgent`

## User Interactions

**Step 1 - Get Work Item:**

```
What would you like to assign to GitHub Copilot?
- Enter work item ID (e.g., "12345")
- Describe new item (e.g., "Fix auth bug")
```

**Step 2 - Repository:**
Auto-detect from git or ask: "Which repository?"

**Step 4 - Agent Selection:**

```
Recommended agent: [Name]
Options:
1. Use [recommended]
2. Use [other agent]
3. Default Copilot
```

### Step 2: Detect Repository Context

**Automatic Detection:**
1. Check if user is in a Git repository (use git commands or file system inspection)
2. If in a repo, extract repository name from remote URL
3. If not in a repo or detection fails, ask user

**Ask if needed:**
```
Which repository should this work item be linked to?

Available repositories in your ADO project: [list from get-config]
```

### Step 3: Gather Context for AI Enhancement

**Goal:** Make the work item description AI-ready with maximum context

**Sources to check (in parallel):**
- **Current repository files** - README, package.json, relevant code files
- **Git history** - Recent commits related to the area
- **Work item history** (if existing item) - Comments, linked items, previous changes
- **Related work items** - Parent/child items, related bugs/features

**Context Gathering Tools:**
```bash
# If in a repository, read relevant files
- README.md (project overview)
- package.json / requirements.txt / pom.xml (dependencies)
- Architecture docs (if available)
- Related source files (if user mentions specific files)

# Git context
git log --oneline -n 10 [relevant-path]  # Recent changes
git branch --show-current  # Current branch for linking
```

**For existing work items:**
```json
Tool: get-context
{
  "workItemId": <id>,
  "includeParent": true,
  "includeChildren": true,
  "includeComments": true,
  "includeLinkedPRsAndCommits": true,
  "includeHistory": true,
  "maxHistoryRevisions": 5
}
```

### Step 4: Analyze AI Assignment Suitability

**Tool: `analyze-ai-assignment`**
```json
{
  "workItemId": <id>
}
```

**Returns:**
```json
{
  "success": true,
  "data": {
    "decision": "AI_FIT|NEEDS_REFINEMENT|HUMAN_FIT",
    "confidence": 0.85,
    "reasons": ["Clear technical scope", "Well-defined acceptance criteria"],
    "blockers": [],
    "recommendations": []
  }
}
```

**Decision Handling:**

**AI_FIT** → Proceed to agent selection (Step 6)

**NEEDS_REFINEMENT** → Show user what needs improvement:
```
⚠️ This work item needs refinement before AI assignment.

Issues found:
- [blocker 1]
- [blocker 2]

Recommendations:
- [recommendation 1]
- [recommendation 2]

Would you like me to:
1. Automatically enhance the work item description
2. Manually edit the work item before assignment
3. Skip refinement and assign anyway (not recommended)
4. Cancel assignment

Your choice?
```

If user chooses option 1 (automatic enhancement), use repository context + AI analysis to enhance the description, then re-analyze.

**HUMAN_FIT** → Suggest not assigning to AI:
```
ℹ️ This work item is better suited for human resolution.

Reasons:
- [reason 1]
- [reason 2]

This type of work requires:
- [requirement 1]
- [requirement 2]

Do you still want to assign to Copilot? (yes/no/cancel)
```

If user says yes, continue. If no, exit gracefully.

### Step 5: Enhance Description for AI Readiness

**Combine gathered context into an enhanced description:**

**Structure:**
```markdown
# [Original Title]

## Context
- **Repository**: [repo-name]
- **Project Area**: [area-path from config]
- **Related Components**: [from code analysis]

## Description
[Original description enhanced with context]

## Technical Details
- **Dependencies**: [key dependencies from package files]
- **Recent Changes**: [relevant git history]
- **Related Work**: [parent/child items]

## Acceptance Criteria
[If available, otherwise generate from context]

## Additional Context
[Any other relevant information from repository analysis]
```

### Step 6: Discover Specialized Copilot Agents

**Tool: `list-agents`**
```json
{
  "repository": "<repo-name>"
}
```

**Returns:**
```json
{
  "success": true,
  "data": {
    "repository": "my-repo",
    "agents": [
      {
        "name": "ComponentGovernanceAgent",
        "description": "Handles component governance violations, CG alerts, and dependency security issues",
        "path": ".azuredevops/policies/ComponentGovernanceAgent.yaml"
      },
      {
        "name": "SecurityScanAgent",
        "description": "Resolves security scan findings from CodeQL, BinSkim, and CredScan",
        "path": ".azuredevops/policies/SecurityScanAgent.yaml"
      }
    ]
  }
}
```

**Agent Selection Logic:**

1. **Analyze work item content** (title, description, tags, type)
2. **Match with agent descriptions** using keyword matching:
   - Security keywords → SecurityScanAgent
   - Component/dependency keywords → ComponentGovernanceAgent
   - Testing keywords → TestAutomationAgent
   - Documentation keywords → DocGeneratorAgent
   - Generic tasks → No specialized agent (use default Copilot)

3. **Ask user to confirm** (interactive):
```
Based on the work item content, I recommend assigning to: **[Agent Name]**

Agent description: [description]

Options:
1. Use recommended agent
2. Choose a different agent: [list other agents]
3. Use default GitHub Copilot (no specialized agent)

Your choice?
```

### Step 7: Assign to Copilot

**For EXISTING work items:**

```json
Tool: assign-copilot
{
  "workItemId": <id>,
  "repository": "<repo-name>",
  "specializedAgent": "[agent-name or omit for default]"
}
```

### Step 8: Confirm Success

**Display success message:**
```
✅ Work item assigned to GitHub Copilot!

**Work Item:** [#ID](https://dev.azure.com/org/project/_workitems/edit/ID) - [Title]
**Repository:** [repo-name]
**Branch:** [branch-url]
**Assigned To:** GitHub Copilot (via [Agent Name] or default)

GitHub Copilot will analyze this work item and begin working on a solution.
You can track progress by monitoring:
- Work item comments (Copilot will post updates)
- Linked pull requests (Copilot will create PRs)
- Branch commits (Copilot will push to the linked branch)

Next steps:
- Review Copilot's analysis when posted
- Approve or provide feedback on proposed changes
- Merge the PR when ready
```

## Efficiency Guidelines

**⚡ Execute operations in parallel whenever possible:**
- Read multiple repository files simultaneously (README, package.json, etc.)
- Fetch work item context AND list subagents in parallel
- Run git commands concurrently when gathering context

**🤖 Consider sub-agents for heavy operations:**
- For large repositories (>1000 files), delegate code analysis to sub-agent
- For complex work item relationships, use sub-agent to analyze hierarchy
- Sub-agents are useful when gathering extensive context to avoid token bloat

**💬 Keep interactions concise:**
- Limit choices to 3-4 options when asking user
- Use bullet points for readability
- Show only essential context in confirmations
- Avoid overwhelming users with technical details unless requested

## MCP Tools Reference

### Configuration Discovery
```json
Tool: get-config
{
  "section": "all"
}
```
Returns available repositories, area paths, default assignees, GitHub Copilot GUID.

### List Specialized Agents
```json
Tool: list-agents
{
  "repository": "<repo-name>"
}
```
Returns all specialized Copilot agents configured for the repository.

### Get Work Item Context
```json
Tool: get-context
{
  "workItemId": <id>,
  "includeParent": true,
  "includeChildren": true,
  "includeComments": true,
  "includeLinkedPRsAndCommits": true,
  "includeHistory": true
}
```
Returns comprehensive work item details for context enhancement.

### Analyze AI Assignment Suitability
```json
Tool: analyze-ai-assignment
{
  "workItemId": <id>
}
```
Returns decision (AI_FIT/NEEDS_REFINEMENT/HUMAN_FIT), confidence score, reasons, blockers, and recommendations.

### Assign Existing Work Item to Copilot
```json
Tool: assign-copilot
{
  "workItemId": <number>,
  "repository": "string (required)",
  "specializedAgent": "string (optional)"
}
```
Assigns existing work item to GitHub Copilot with branch link.

## Error Handling

### Repository Not Found
If repository cannot be detected or found in ADO:
```
❌ Repository not found or not configured in Azure DevOps.

Available repositories: [list from config]

Please specify which repository to use, or configure the repository in ADO first.
```

### No Specialized Agents Available
If no specialized agents are configured:
```
ℹ️ No specialized Copilot agents found for this repository.

The work item will be assigned to the default GitHub Copilot agent.

Continue? (yes/no)
```

### Work Item Needs Refinement
If AI suitability analysis returns NEEDS_REFINEMENT:
```
⚠️ This work item needs refinement before AI assignment.

Issues found:
- [blocker 1]
- [blocker 2]

Recommendations:
- [recommendation 1]
- [recommendation 2]

Would you like me to:
1. Automatically enhance the work item description
2. Manually edit the work item before assignment
3. Skip refinement and assign anyway (not recommended)
4. Cancel assignment

Your choice?
```

### Work Item Not Suitable for AI
If AI suitability analysis returns HUMAN_FIT:
```
ℹ️ This work item is better suited for human resolution.

Reasons:
- [reason 1]
- [reason 2]

This type of work requires:
- [Human skill 1]
- [Human skill 2]

Do you still want to assign to Copilot? (yes/no/cancel)
```

### Invalid Work Item ID
If user provides an invalid work item ID:
```
❌ Work item #[ID] not found or not accessible.

Please verify:
- The work item ID is correct
- You have access to the work item
- The work item is in the configured area path

Try again with a different ID or create a new work item instead.
```

## Examples

## Examples

### Example 1: Create New Work Item

```
User: "Fix authentication bug in login service"
AI: What would you like to assign to GitHub Copilot?

Options:
- Enter an existing work item ID (e.g., "12345")
- Describe a new work item to create (e.g., "Fix authentication bug in login service")

[AI detects user wants to create new item]

AI: I'll create a new work item for the authentication bug.

[AI detects current repository from git]
Detected repository: "auth-service"

[AI gathers context - reads README.md, package.json, recent commits]

[AI calls analyze-ai-assignment]

AI: ✅ AI Assignment Analysis: AI_FIT (confidence: 0.92)

This work item is well-suited for AI assignment:
- Clear technical scope
- Well-defined problem statement
- Testable requirements

[AI continues to agent selection]

AI: I found these specialized Copilot agents for your repository:

1. **SecurityScanAgent** - Resolves security scan findings from CodeQL, BinSkim, and CredScan
2. **ComponentGovernanceAgent** - Handles component governance violations

Based on the work item ("authentication bug"), I recommend:
👉 **SecurityScanAgent** (handles security issues including authentication)

Options:
1. Use SecurityScanAgent
2. Use ComponentGovernanceAgent  
3. Use default Copilot (no specialized agent)

User: "1"

[AI calls assign-copilot with specializedAgent: "SecurityScanAgent"]

AI: ✅ Work item created and assigned to GitHub Copilot!

**Work Item:** [#12345](https://dev.azure.com/org/project/_workitems/edit/12345) - Fix authentication bug in login service
**Repository:** auth-service
**Branch:** https://dev.azure.com/org/project/_git/auth-service?version=GB12345-fix-auth-bug
**Assigned To:** GitHub Copilot (via SecurityScanAgent)

GitHub Copilot will analyze this work item and begin working on a solution.
```

### Example 2: Assign Existing Work Item

```
User: "12345"

AI: Found work item #12345: "Update dependencies in package.json"

[AI detects repository from current directory]
Detected repository: "my-app"

[AI calls analyze-ai-assignment]

AI: ⚠️ AI Assignment Analysis: NEEDS_REFINEMENT (confidence: 0.65)

Issues found:
- Description is too vague ("Update dependencies")
- No specific dependencies mentioned
- No acceptance criteria defined

Recommendations:
- Specify which dependencies need updating
- Add version constraints or target versions
- Define testing requirements

Would you like me to:
1. Automatically enhance the work item description
2. Manually edit the work item before assignment
3. Skip refinement and assign anyway (not recommended)
4. Cancel assignment

User: "1"

[AI enhances description with context from package.json and recent commits]

AI: ✅ Work item description enhanced!

Updated description now includes:
- Specific dependencies to update (lodash, axios, react)
- Target versions based on latest security patches
- Acceptance criteria for testing

[AI re-analyzes]

AI: ✅ AI Assignment Analysis: AI_FIT (confidence: 0.88)

[AI calls list-agents for "my-app"]

AI: I found these specialized Copilot agents:

1. **ComponentGovernanceAgent** - Handles dependency and component governance issues
2. **SecurityScanAgent** - Resolves security scan findings

Based on the work item ("Update dependencies"), I recommend:
👉 **ComponentGovernanceAgent** (specializes in dependency management)

Options:
1. Use ComponentGovernanceAgent
2. Use SecurityScanAgent
3. Use default Copilot

User: "1"

[AI calls assign-copilot with specializedAgent: "ComponentGovernanceAgent"]

AI: ✅ Work item assigned to GitHub Copilot!

**Work Item:** [#12345](https://dev.azure.com/org/project/_workitems/edit/12345) - Update dependencies in package.json
**Repository:** my-app
**Branch:** https://dev.azure.com/org/project/_git/my-app?version=GB12345-update-deps
**Assigned To:** GitHub Copilot (via ComponentGovernanceAgent)
```

## Best Practices

### 1. Always Gather Context
Enhance descriptions with repository, git, and work item context.

### 2. Guide Agent Selection
Analyze work item keywords to recommend the right specialized agent.

### 3. Validate Before Assignment
Use analyze-bulk to check AI suitability.

### 4. Preserve User Intent
Show recommendations but let user choose or cancel.

### 5. Provide Clear Next Steps
Tell user where to track progress after assignment.
