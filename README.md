# ⭐ Enhanced ADO MCP Server

**Enterprise Azure DevOps work item management via Model Context Protocol** - Leverage existing PowerShell automation scripts as AI-powered tools with comprehensive prompt templates for intelligent work item operations.

[![npm version](https://badge.fury.io/js/enhanced-ado-mcp-server.svg)](https://badge.fury.io/js/enhanced-ado-mcp-server)



## 🚀 Installation & Getting Started

For the best experience, use **Visual Studio Code** with **GitHub Copilot**. See alternative client configurations below for Claude Desktop, Cursor, and other MCP clients.

### Prerequisites

1. Install [Node.js](https://nodejs.org/en/download) 18+
1. Install [PowerShell 7+](https://github.com/PowerShell/PowerShell)
1. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and login with `az login`
1. Open VS Code in your project folder

## ✨ One-Click Install for VS Code

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_enhanced--ado--msp-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-msp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Area%20path%20(e.g.%20Project%5C%5CTeam)%22%7D%2C%7B%22id%22%3A%22copilot_guid%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22GitHub%20Copilot%20GUID%22%7D%5D)

[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_enhanced--ado--msp-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-msp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Area%20path%20(e.g.%20Project%5C%5CTeam)%22%7D%2C%7B%22id%22%3A%22copilot_guid%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22GitHub%20Copilot%20GUID%22%7D%5D)


### 🔧 Alternative MCP Client Configurations

#### Claude Desktop Configuration

Add to your Claude Desktop configuration file:

**macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "enhanced-ado-msp": {
      "command": "npx",
      "args": [
        "-y",
        "enhanced-ado-mcp-server",
        "YOUR_ORG",
        "YOUR_PROJECT",
        "--area-path",
        "YOUR_PROJECT\\YOUR_TEAM",
        "--copilot-guid",
        "YOUR_COPILOT_GUID"
      ],
      "env": {
        "PWSH_PATH": "pwsh"
      }
    }
  }
}
```

#### Alternative: Using Global Installation

```json
{
  "mcpServers": {
    "enhanced-ado-msp": {
      "command": "enhanced-ado-msp",
      "args": [
        "YOUR_ORG",
        "YOUR_PROJECT",
        "--area-path",
        "YOUR_PROJECT\\YOUR_TEAM",
        "--copilot-guid",
        "YOUR_COPILOT_GUID"
      ]
    }
  }
}
```

## 🎯 Configuring Language Model Access (Sampling)

This MCP server includes **AI-powered analysis tools** that leverage VS Code's language model sampling capability to provide intelligent work item analysis. These features require proper configuration to access language models.

### Prerequisites for Sampling Features

1. **VS Code Insiders** or **VS Code Stable** (version 1.87+)
2. **GitHub Copilot** extension installed and active
3. **Language Model Access** enabled for the MCP server

### Enabling Language Model Access

When you first use an AI-powered tool (tools 5-8 below), VS Code will prompt you to grant language model access:

1. VS Code will show a permission dialog asking: **"Allow [enhanced-ado-msp] to access language models?"**
2. Click **"Allow"** to grant access
3. The permission is remembered for future requests

### Checking Language Model Access Status

You can verify if your MCP server has language model access:

```typescript
// In VS Code, the extension context provides:
context.languageModelAccessInformation.canSendRequest(chat)
```

If you encounter sampling errors, ensure:
- GitHub Copilot is active and authenticated
- You've granted language model access when prompted
- Your GitHub Copilot subscription is active

### Manual Configuration (Advanced)

Language model access is managed by VS Code and persists across sessions. To reset permissions:

1. Open VS Code Settings
2. Search for "Language Model"
3. Review and manage extension permissions under **Chat > Language Model Access**

**Note:** Claude Desktop and other non-VS Code MCP clients do not support sampling features. AI-powered tools (5-8) will gracefully degrade and return an error message indicating sampling is unavailable.

## Tools Exposed

### Core Work Item Tools

1. `wit-create-new-item` - Create a new Azure DevOps work item with optional parent relationship. Will correctly inherit area and iteration path from parent.
2. `wit-assign-to-copilot` - Assign an existing work item to GitHub Copilot and add branch link
3. `wit-new-copilot-item` - Create a new work item under a parent and immediately assign to GitHub Copilot
4. `wit-extract-security-links` - Extract instruction links from the body of security scan work items

### AI-Powered Analysis Tools (Requires VS Code Language Model Access)

> **⚠️ Note:** These tools require VS Code with GitHub Copilot and language model access granted. They are not available in Claude Desktop or other MCP clients.

5. `wit-intelligence-analyzer` - AI-powered work item analysis for completeness and AI-readiness
6. `wit-ai-assignment-analyzer` - Enhanced AI assignment suitability analysis with detailed reasoning (analysis only - use `wit-assign-to-copilot` separately to perform assignment)
7. `wit-feature-decomposer` - Intelligently decompose large features into smaller, assignable work items
8. `wit-hierarchy-validator` - Analyze work item parent-child relationships and provide suggestions

### Configuration & Discovery Tools

9. `wit-get-configuration` - Get current MCP server configuration including area paths, repositories, GitHub Copilot settings, and other defaults
10. `wit-get-work-items-by-query-wiql` - Query Azure DevOps work items using WIQL (Work Item Query Language) with support for complex filtering, sorting, and field selection
  - Example use cases: fetch parent/child graphs, list stale items (`ORDER BY [System.ChangedDate] ASC`), pull dependency links, scope by AreaPath, or gather related items before AI analysis.

The scripts are executed unchanged. The server just validates inputs and streams back their JSON output.

## Prompts Available

1. `work_item_enhancer` - Improve a work item description so it has enough clarity, scope, and acceptance criteria for automated handling by an AI coding agent
2. `ai_suitability_analyzer` - Decide whether a software work item is a good fit for automated completion by an AI coding agent or should be assigned to a human
3. `security_items_analyzer` - Analyze security and compliance items within an area path, categorize them, identify AI-suitable items, and create actionable remediation plans

Prompts are loaded from the `prompts/` directory and support template variable substitution using `{{variable_name}}` syntax.

## WIQL Query Examples

The `wit-get-work-items-by-query-wiql` tool allows you to query Azure DevOps work items using WIQL (Work Item Query Language). Here are some common use cases:

### Basic Query - Find Active Work Items
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC"
}
```

### Query by Area Path
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.State] <> 'Closed'",
  "MaxResults": 50
}
```

### Query with Additional Fields
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active'",
  "IncludeFields": [
    "System.Description",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Common.Severity",
    "System.Tags"
  ]
}
```

### Complex Query - Recently Changed Tasks
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND [System.ChangedDate] >= @Today - 7 ORDER BY [System.ChangedDate] DESC",
  "MaxResults": 100
}
```

### Query by Tags
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS 'technical-debt' AND [System.State] <> 'Removed'"
}
```

**WIQL Reference:** For more information on WIQL syntax, see the [official Azure DevOps WIQL documentation](https://learn.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax).

## Development

Install deps:

```bash
npm install
```

Run in dev (ts-node/tsx):
```bash
npm run dev
```

Build:
```bash
npm run build
```

Start (after build):
```bash
npm start
```

## Integration (Example Client Snippet)

```ts
// Use an MCP client (e.g., Claude Desktop custom server config) pointing to: node dist/index.js
```

## Environment

Requires PowerShell 7 (`pwsh`) and Azure CLI already logged in with required `az boards` & `az repos` permissions.

Optional: set `PWSH_PATH` env var to override pwsh executable.

## Configuration

Authentication:
* Use `az login` (Azure CLI). The Azure DevOps extension is added automatically if missing.
* Personal Access Tokens are no longer supported/required; we intentionally removed that path.

View current configuration:
* Call tool `wit-get-configuration` with optional `Section` parameter to view specific configuration sections.

Verbose debug logging: set `MCP_DEBUG=1` or enable `toolBehavior.verboseLogging`.
