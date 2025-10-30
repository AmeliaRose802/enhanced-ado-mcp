# GitHub Copilot Instructions for Enhanced ADO MCP Server

This project is an **Azure DevOps Model Context Protocol (MCP) Server** that enables AI-powered work item management.

## Project Overview

**Repository:** enhanced-ado-mcp  
**Language:** TypeScript (Node.js)  
**Purpose:** MCP server for Azure DevOps integration with AI agents

## Custom Instructions

This repository uses directory-specific custom instructions to provide context-aware guidance:

- **`AGENTS.md`** (root) - General project structure, build commands, and development workflow
- **`.github/instructions/prompts.instructions.md`** - Guidelines for working with AI prompt templates
- **`.github/instructions/services.instructions.md`** - Service layer, handlers, and configuration patterns
- **`.github/instructions/tests.instructions.md`** - Testing standards and patterns
- **`.github/instructions/documentation.instructions.md`** - Documentation requirements and style guide

These instructions are automatically applied when working in their respective directories.

## Enhanced ADO MCP Server

This workspace has the **Enhanced ADO MCP Server** available, which provides AI-powered tools for Azure DevOps work item operations.

**Always check to see if the Enhanced ADO MCP server has a tool relevant to the user's request.**

## Available Tool Categories

1. **Core Work Item Tools** - Create, assign, and manage work items
2. **AI-Powered Analysis Tools** - Intelligent work item analysis, feature decomposition, hierarchy validation
3. **Bulk Operations** - Safe bulk updates using query handle pattern
4. **Query Tools** - WIQL and OData query generation and execution
5. **Configuration & Discovery Tools** - View configuration and discover available resources
6. **Prompt Templates** - Work item enhancement, AI suitability analysis, security item analysis

## Best Practices

- Use the discovery tools to find valid area paths, iteration paths, and repositories before creating work items
- Leverage AI-powered tools for analyzing work items and decomposing features
- Use the query handle pattern for safe bulk operations (prevents ID hallucination)
- Use the configuration tools to understand the current setup
- Check the security items analyzer for compliance and security work items

## Example Requests

- "Create a new Product Backlog Item for implementing authentication"
- "Analyze work item 12345 for AI assignment suitability"
- "List available area paths in my project"
- "Extract security findings from work item 67890"
- "Decompose this large feature into smaller work items"
- "Show my current MCP server configuration"
- "Generate a WIQL query to find all active bugs assigned to me"
- "Bulk update all items in this sprint to add a tag"

---

## 🔗 TASK TRACKING WITH BEADS

### Overview

This project uses **[bd (beads)](https://github.com/steveyegge/beads)** for ALL task tracking and issue management. Beads is a git-backed issue tracker designed specifically for AI-supervised coding workflows.

### ✅ REQUIRED: Use bd for All Task Tracking

**NEVER create:**
- Markdown TODO lists
- Task files in `/tasklist`
- External issue trackers
- Duplicate tracking systems

**ALWAYS use:**
- `bd` commands for creating, updating, and tracking work
- `bd ready` to find unblocked work
- `bd create` with `discovered-from` links when discovering new work

### Installation & Setup

If bd is not already initialized:

```bash
# Non-interactive setup (for agents)
bd init --quiet

# Verify installation
bd info --json
```

### Core Workflow for AI Agents

1. **Check for ready work**:
   ```bash
   bd ready --json
   ```

2. **Claim a task**:
   ```bash
   bd update <id> --status in_progress --json
   ```

3. **While working, discover new issues?**:
   ```bash
   # Create and link in one command
   bd create "Found bug in auth" -t bug -p 1 --deps discovered-from:<current-id> --json
   ```

4. **Update progress**:
   ```bash
   bd update <id> --priority 1 --json
   bd update <id> --status in_progress --json
   ```

5. **Complete work**:
   ```bash
   bd close <id> --reason "Implemented and tested" --json
   ```

6. **End of session - sync immediately**:
   ```bash
   bd sync
   ```

### Issue Types & Priorities

**Types:**
- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance work

**Priorities:**
- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Dependency Types

- `blocks` - Hard blocker (affects ready work detection)
- `related` - Soft relationship
- `parent-child` - Hierarchical relationship
- `discovered-from` - Track issues discovered during work

### Common Commands

```bash
# Find ready work
bd ready --json

# Create issue
bd create "Issue title" -t bug -p 1 -d "Description" --json

# Create with dependencies
bd create "Fix auth bug" -p 1 --deps discovered-from:bd-42 --json

# Add labels
bd label add bd-42 security backend --json

# Show issue details
bd show bd-42 --json

# View dependency tree
bd dep tree bd-42

# List issues
bd list --status open --priority 1 --json
bd list --label backend,security --json

# Statistics
bd stats --json

# Force immediate sync
bd sync
```

### Auto-Sync Behavior

Beads automatically syncs with git:
- **Exports** to `.beads/issues.jsonl` after changes (30s debounce for batching)
- **Imports** from JSONL after `git pull`
- **Manual sync** with `bd sync` forces immediate flush/commit/push

**IMPORTANT:** Always run `bd sync` at the end of your session to ensure changes are committed.

### Integration with Feature Development

When adding a new feature:
1. **Create a bd issue** for the feature: `bd create "Add feature X" -t feature -p 1 --json`
2. **Create feature spec**: `docs/feature_specs/<feature-name>.md`
3. **Link discovered work**: Use `--deps discovered-from:<feature-id>` for related tasks
4. **Update feature spec** when modifying existing features
5. **Close issue** when complete: `bd close <id> --reason "Feature implemented and documented" --json`

---

## � FEATURE SPECIFICATION REQUIREMENTS

### When Adding a New Feature

**REQUIRED:** Create a feature specification at `docs/feature_specs/<feature-name>.md`

The feature spec MUST include:
- **Overview** - What the feature does and why it exists
- **Input Parameters** - All parameters with types, defaults, and examples
- **Output Format** - Success and error response structures
- **Examples** - Working examples with actual input/output
- **Error Handling** - Common errors and resolutions
- **Implementation Details** - Key components and integration points
- **Testing** - Test coverage and manual testing steps

**Also REQUIRED:** Update `docs/feature_specs/toc.yml` with new entry

### When Modifying an Existing Feature

**REQUIRED:** Update the corresponding feature spec in `docs/feature_specs/`

Changes to document:
- Updated input/output formats
- New parameters or configuration options
- Changed behavior
- New error conditions
- Version increment in changelog

### Feature Spec Naming Convention

- Use kebab-case: `feature-name.md`
- Be descriptive: `query-handle-pattern.md` not `qh.md`
- Match tool name if applicable: `create-work-item.md` for `create-work-item` tool

---

## �🚫 CRITICAL: NO SUMMARY DOCS POLICY

### ❌ ABSOLUTELY FORBIDDEN TO CREATE UNLESS USER SPECIFICALLY ASKS:
- **ANY** summary files (e.g., `*_SUMMARY.md`, `*_COMPLETE.md`, `*_REPORT.md`, `*_ANALYSIS.md`)
- Implementation status documents or "completion reports"
- Changelog files outside of git commit messages
- Redundant "guide" files that duplicate existing documentation
- Verbose architecture documents that should be code comments
- **Analysis reports** or comprehensive documentation of work done
- "Beta test response" documents or improvement plans as files
- **Markdown TODO lists** (use `bd` for task tracking)

### ✅ EXCEPTION: USER EXPLICITLY REQUESTS DOCUMENTATION
- **If user specifically asks** for a summary, report, or analysis document, you may create it
- **Still prefer** updating existing documentation when possible
- **Ask for clarification** if the request is ambiguous

### ⚠️ IF USER ASKS FOR DOCUMENTATION WITHOUT BEING SPECIFIC:
1. **ASK** what specific documentation they need and where it should go
2. **SUGGEST** updating existing docs instead of creating new ones
3. **OFFER** to put details in git commit messages or bd issues
4. **ONLY CREATE** new docs if they explicitly confirm that's what they want

### ✅ ONLY ACCEPTABLE DOCUMENTATION:
- Updating existing `/docs` files with essential user info
- Adding `/mcp_server/resources` quick reference guides for agents
- Code comments for implementation details
- Git commit messages for change history
- **bd issues** for task tracking and work discovery

### Documentation Organization:
- `/docs` - Only essential user-facing documentation (update existing only)
- `/mcp_server/resources` - Quick reference guides for agents (functional, not summaries)
- `/tasklist` - **DEPRECATED: DO NOT USE** (use `bd` instead)
- `.beads/` - Beads issue tracker database (auto-managed by bd)
- Code should be self-documenting with clear naming

### When Asked to Document Implementation/Analysis:
1. **SAY NO** to creating summary files
2. Explain the policy against summary documentation
3. Offer to:
   - Update existing functional documentation
   - Create bd issues for tracking work
   - Add code comments for implementation details
   - Write comprehensive git commit messages
4. Keep any updates focused on HOW to use, not WHAT was implemented
