# GitHub Copilot Instructions

This project uses **Azure DevOps** for work item management and project tracking.

## Enhanced ADO MCP Server

This workspace has the **Enhanced ADO MCP Server** available, which provides AI-powered tools for Azure DevOps work item operations.

**Always check to see if the Enhanced ADO MCP server has a tool relevant to the user's request.**

## Available Tool Categories

1. **Core Work Item Tools**: Create, assign, and manage work items
2. **AI-Powered Analysis Tools**: Intelligent work item analysis, feature decomposition, hierarchy validation
3. **Configuration & Discovery Tools**: View configuration and discover available resources
4. **Prompt Templates**: Work item enhancement, AI suitability analysis, security item analysis

## Best Practices

- Use the discovery tools to find valid area paths, iteration paths, and repositories before creating work items
- Leverage AI-powered tools for analyzing work items and decomposing features
- Use the configuration tools to understand the current setup
- Check the security items analyzer for compliance and security work items

## Example Requests

- "Create a new Product Backlog Item for implementing authentication"
- "Analyze work item 12345 for AI assignment suitability"
- "List available area paths in my project"
- "Extract security findings from work item 67890"
- "Decompose this large feature into smaller work items"
- "Show my current MCP server configuration"

---

## CRITICAL: Documentation Standards

### ❌ DO NOT CREATE:
- Summary files (e.g., `*_SUMMARY.md`, `*_COMPLETE.md`, `*_REPORT.md`)
- Implementation status documents
- Changelog files outside of git commit messages
- Redundant "guide" files that duplicate existing documentation
- Verbose architecture documents that should be code comments

### ✅ INSTEAD:
- Use git commit messages for implementation history
- Keep docs focused and actionable
- Update existing docs rather than creating new ones
- Put implementation details in code comments
- Use concise, to-the-point documentation

### Documentation Organization:
- `/docs` - Only essential user-facing documentation
- `/mcp_server/resources` - Quick reference guides for agents
- `/tasklist` - DO NOT TOUCH unless explicitly asked
- Code should be self-documenting with clear naming

### When Asked to Document:
1. Check if existing docs can be updated
2. Keep it short and practical
3. No verbose summaries or status reports
4. Focus on HOW to use, not implementation history
