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

<a href="vscode:mcp/install?%7B%22name%22%3A%22enhanced-ado-msp%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D">
  <img src="https://img.shields.io/badge/VS_Code-Install_enhanced--ado--msp-0098FF?style=flat-square&logo=visualstudiocode&logoColor=ffffff" alt="Install in VS Code">
</a>

<a href="vscode-insiders:mcp/install?%7B%22name%22%3A%22enhanced-ado-msp%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D">
  <img src="https://img.shields.io/badge/VS_Code_Insiders-Install_enhanced--ado--msp-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=ffffff" alt="Install in VS Code Insiders">
</a>


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

## Tools Exposed

### Core Work Item Tools

1. `wit-create-new-item` - Create a new Azure DevOps work item with optional parent relationship. Will correctly inherit area and iteration path from parent.
2. `wit-assign-to-copilot` - Assign an existing work item to GitHub Copilot and add branch link
3. `wit-new-copilot-item` - Create a new work item under a parent and immediately assign to GitHub Copilot
4. `wit-extract-security-links` - Extract instruction links from the body of security scan work items

### AI-Powered Analysis Tools (with VS Code Sampling)

5. `wit-intelligence-analyzer` - AI-powered work item analysis for completeness and AI-readiness
6. `wit-ai-assignment-analyzer` - Enhanced AI assignment suitability analysis with detailed reasoning
7. `wit-feature-decomposer` - Intelligently decompose large features into smaller, assignable work items
8. `wit-hierarchy-validator` - Analyze work item parent-child relationships and provide suggestions

### Configuration & Discovery Tools

9. `wit-show-config` - Display the effective merged configuration (redacted)
10. `wit-get-configuration` - Get current MCP server configuration
11. `wit-discover-area-paths` - Discover available area paths from Azure DevOps project
12. `wit-discover-iteration-paths` - Discover available iteration paths
13. `wit-discover-repositories` - Discover available Git repositories
14. `wit-discover-work-item-types` - Discover available work item types and their properties

The scripts are executed unchanged. The server just validates inputs and streams back their JSON output.

## Prompts Available

1. `work_item_enhancer` - Improve a work item description so it has enough clarity, scope, and acceptance criteria for automated handling by an AI coding agent
2. `ai_suitability_analyzer` - Decide whether a software work item is a good fit for automated completion by an AI coding agent or should be assigned to a human
3. `security_items_analyzer` - Analyze security and compliance items within an area path, categorize them, identify AI-suitable items, and create actionable remediation plans

Prompts are loaded from the `prompts/` directory and support template variable substitution using `{{variable_name}}` syntax.

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

Show the effective merged configuration (with redaction):
* Call tool `wit-show-config`.

Verbose debug logging: set `MCP_DEBUG=1` or enable `toolBehavior.verboseLogging`.
