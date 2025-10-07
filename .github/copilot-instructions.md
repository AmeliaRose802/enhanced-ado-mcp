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

### ✅ EXCEPTION: USER EXPLICITLY REQUESTS DOCUMENTATION
- **If user specifically asks** for a summary, report, or analysis document, you may create it
- **Still prefer** updating existing documentation when possible
- **Ask for clarification** if the request is ambiguous

### ⚠️ IF USER ASKS FOR DOCUMENTATION WITHOUT BEING SPECIFIC:
1. **ASK** what specific documentation they need and where it should go
2. **SUGGEST** updating existing docs instead of creating new ones
3. **OFFER** to put details in git commit messages
4. **ONLY CREATE** new docs if they explicitly confirm that's what they want

### ✅ ONLY ACCEPTABLE DOCUMENTATION:
- Updating existing `/docs` files with essential user info
- Adding `/mcp_server/resources` quick reference guides for agents
- Code comments for implementation details
- Git commit messages for change history

### Documentation Organization:
- `/docs` - Only essential user-facing documentation (update existing only)
- `/mcp_server/resources` - Quick reference guides for agents (functional, not summaries)
- `/tasklist` - DO NOT TOUCH unless explicitly asked
- Code should be self-documenting with clear naming

### When Asked to Document Implementation/Analysis:
1. **SAY NO** to creating summary files
2. Explain the policy against summary documentation
3. Offer to update existing functional documentation instead
4. Keep any updates focused on HOW to use, not WHAT was implemented
