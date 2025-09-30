# ⭐ Enhanced ADO MCP Server

**Enterprise Azure DevOps work item management via Model Context Protocol** - Leverage existing PowerShell automation scripts as AI-powered tools with comprehensive prompt templates for intelligent work item operations.

[![npm version](https://badge.fury.io/js/enhanced-ado-mcp-server.svg)](https://badge.fury.io/js/enhanced-ado-mcp-server)
[![MCP Server](https://img.shields.io/badge/MCP-Server-blue?style=flat-square)](https://modelcontextprotocol.io/)
[![Azure DevOps](https://img.shields.io/badge/Azure_DevOps-Integration-0078d4?style=flat-square&logo=azuredevops)](https://dev.azure.com/)

## ✨ One-Click Install for VS Code

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Enhanced_ADO_MCP-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22enhanced-ado-msp%22%2C%22inputs%22%3A%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%20(e.g.%20'contoso')%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Default%20area%20path%20(e.g.%20'MyProject%5C%5CMyTeam')%22%7D%2C%7B%22id%22%3A%22copilot_guid%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22GitHub%20Copilot%20GUID%20(optional%2C%20for%20Copilot%20assignment%20tools)%22%7D%5D%2C%22servers%22%3A%7B%22enhanced-ado-msp%22%3A%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Enhanced_ADO_MCP-00FF00?style=for-the-badge&logo=visualstudiocode&logoColor=ffffff)](vscode-insiders:mcp/install?%7B%22name%22%3A%22enhanced-ado-msp%22%2C%22inputs%22%3A%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%20(e.g.%20'contoso')%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Default%20area%20path%20(e.g.%20'MyProject%5C%5CMyTeam')%22%7D%2C%7B%22id%22%3A%22copilot_guid%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22GitHub%20Copilot%20GUID%20(optional%2C%20for%20Copilot%20assignment%20tools)%22%7D%5D%2C%22servers%22%3A%7B%22enhanced-ado-msp%22%3A%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D%7D%7D)

Click the badge for your VS Code version to automatically install. After installation, select **GitHub Copilot Agent Mode** and refresh the tools list. Learn more about [Agent Mode in VS Code](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode).

## 🚀 Installation & Getting Started

For the best experience, use **Visual Studio Code** with **GitHub Copilot**. See alternative client configurations below for Claude Desktop, Cursor, and other MCP clients.

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders)
2. Install [Node.js](https://nodejs.org/en/download) 18+
3. Install [PowerShell 7+](https://github.com/PowerShell/PowerShell)
4. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and login with `az login`
5. Open VS Code in your project folder

### 🛠️ Installation Options

#### ✨ Option 1: One-Click Install (Recommended for VS Code)

Click one of the badges above to install:
- **[VS Code](vscode:mcp/install?%7B%22name%22%3A%22enhanced-ado-msp%22%2C%22inputs%22%3A%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%20(e.g.%20'contoso')%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Default%20area%20path%20(e.g.%20'MyProject%5C%5CMyTeam')%22%7D%2C%7B%22id%22%3A%22copilot_guid%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22GitHub%20Copilot%20GUID%20(optional%2C%20for%20Copilot%20assignment%20tools)%22%7D%5D%2C%22servers%22%3A%7B%22enhanced-ado-msp%22%3A%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D%7D%7D)** - Install in stable VS Code
- **[VS Code Insiders](vscode-insiders:mcp/install?%7B%22name%22%3A%22enhanced-ado-msp%22%2C%22inputs%22%3A%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%20(e.g.%20'contoso')%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Default%20area%20path%20(e.g.%20'MyProject%5C%5CMyTeam')%22%7D%2C%7B%22id%22%3A%22copilot_guid%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22GitHub%20Copilot%20GUID%20(optional%2C%20for%20Copilot%20assignment%20tools)%22%7D%5D%2C%22servers%22%3A%7B%22enhanced-ado-msp%22%3A%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%2C%22--copilot-guid%22%2C%22%24%7Binput%3Acopilot_guid%7D%22%5D%7D%7D%7D)** - Install in VS Code Insiders

VS Code will prompt you for configuration values and automatically set up the MCP server.

#### � Option 2: Manual VS Code Configuration

Create a `.vscode/mcp.json` file in your project with:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name (e.g. 'contoso')"
    },
    {
      "id": "ado_project",
      "type": "promptString",
      "description": "Azure DevOps project name"
    },
    {
      "id": "area_path",
      "type": "promptString",
      "description": "Default area path (e.g. 'MyProject\\MyTeam')"
    },
    {
      "id": "copilot_guid",
      "type": "promptString",
      "description": "GitHub Copilot GUID (optional, for Copilot assignment tools)"
    }
  ],
  "servers": {
    "enhanced-ado-msp": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "enhanced-ado-mcp-server",
        "${input:ado_org}",
        "${input:ado_project}",
        "--area-path",
        "${input:area_path}",
        "--copilot-guid",
        "${input:copilot_guid}"
      ]
    }
  }
}
```

Save the file, then click **'Start'** in VS Code. In GitHub Copilot Chat, switch to [Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode), click **"Select Tools"**, and choose the available tools.

> 💡 **Pro Tip**: Create a `.github/copilot-instructions.md` file in your project with: "This project uses Azure DevOps. Always check to see if the Enhanced ADO MCP server has a tool relevant to the user's request."

#### 📦 Option 3: Global NPM Installation

```bash
# Install globally for system-wide access
npm install -g enhanced-ado-mcp-server
```

Then update your `.vscode/mcp.json` to use `"command": "enhanced-ado-mcp-server"` instead of `"npx"`.

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

#### Development/Local Testing

For development or testing with your local build:

```json
{
  "mcpServers": {
    "enhanced-ado-msp-dev": {
      "command": "node",
      "args": [
        "/path/to/ADO-Work-Item-MSP/mcp_server/dist/index.js",
        "YOUR_ORG",
        "YOUR_PROJECT",
        "--area-path",
        "YOUR_PROJECT\\YOUR_TEAM",
        "--copilot-guid",
        "YOUR_COPILOT_GUID"
      ],
      "env": {
        "PWSH_PATH": "pwsh",
        "MCP_DEBUG": "1"
      }
    }
  }
}
```

### 🎯 Start Using

1. **VS Code**: Open GitHub Copilot Chat in Agent Mode, select your tools, and start chatting
2. **Claude Desktop**: Open Claude Desktop and the MCP server will be automatically available
3. **Cursor**: Configure in settings and use the MCP tools panel

Try prompts like:
- "Create a new work item for implementing user authentication"
- "Assign work item 12345 to GitHub Copilot for automated completion"
- "Extract security findings and create remediation tasks"
- "Analyze security items in my area path and create remediation plan"
- "List my area paths" (discovery tool)
- "Show me my current configuration" (config tool)

## Tools Exposed

### Core Work Item Tools

1. `wit-create-new-item` - Create a new Azure DevOps work item with optional parent relationship
2. `wit-assign-to-copilot` - Assign an existing work item to GitHub Copilot and add branch link
3. `wit-new-copilot-item` - Create a new work item under a parent and immediately assign to GitHub Copilot
4. `wit-extract-security-links` - Extract instruction links from security scan work items

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

### Automatic Configuration Integration

**✨ Zero-Config Prompt Usage**: Prompts automatically use your configuration defaults, so you don't need to manually provide common parameters every time!

**Auto-filled Parameters:**
- `project` / `project_name` → Uses configured Azure DevOps project
- `area_path` → Uses configured default area path  
- `organization` → Uses configured Azure DevOps organization
- `org_url` → Auto-generates from configured organization (https://dev.azure.com/[org])
- `iteration_path` → Uses configured default iteration path
- `assigned_to` → Uses configured default assignee
- `repository` → Uses configured default git repository
- `branch` → Uses configured default git branch

**Template Variables**: All configuration values are also available as template variables:
- `{{default_organization}}`, `{{default_project}}`, `{{default_area_path}}`, etc.

**Override Behavior**: User-provided arguments always take precedence over configuration defaults.

### Security Items Analyzer Usage

The Security Items Analyzer prompt helps systematically process security and compliance work items.

**✨ Zero-Config Usage**: Just call the prompt with no arguments - it will use your configured area path and project!

```typescript
// No arguments needed - uses config defaults!
const content = await getPromptContent('security_items_analyzer', {});
```

**Optional Parameters:**
- `area_path` - Override the default area path (auto-filled from config)
- `project_name` - Override the default project (auto-filled from config)
- `include_child_areas` - Whether to include child area paths (boolean)
- `max_items` - Maximum number of items to analyze (number, default: 50)

**Example Usage:**
```typescript
const content = await getPromptContent('security_items_analyzer', {
  area_path: 'MyProject\\Security\\Compliance',
  project_name: 'ProductionApp', 
  include_child_areas: true,
  max_items: 25
});
```

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

## Notes
- Input schemas mirror PowerShell parameters; optional empties omitted.
- Raw stdout/stderr + parsed JSON (if available) are returned for transparency.

## Configuration

This server now supports layered configuration (system defaults < user < project < tool invocation). Provide your values to remove lingering hardcoded org/project defaults.

Precedence (highest last applied to lowest):
1. Tool arguments (explicit call overrides)
2. Project config `./mcp-config.json`
3. User config `~/.mcp/ado-work-item/config.json`
4. System defaults (in code)

Example user config (`~/.mcp/ado-work-item/config.json`):
```json
{
  "azureDevOps": {
    "organization": "my-org",
    "project": "MyProject",
    "defaultWorkItemType": "Product Backlog Item",
    "defaultPriority": 2,
    "defaultAssignedTo": "@me",
    "areaPath": "MyProject\\MyTeam\\MyComponent",
    "iterationPath": "MyProject\\Sprint 2024-10",
    "inheritParentPaths": true
  },
  "gitRepository": {
    "defaultBranch": "main"
  },
  "gitHubCopilot": {
    "defaultGuid": "your-copilot-guid-here"
  },
  "toolBehavior": {
    "autoInheritPaths": true,
    "dryRunMode": false,
    "verboseLogging": false,
    "defaultTags": ["auto-created", "mcp"]
  }
}
```

**⚠️ Required Configuration**: For GitHub Copilot-related tools (`assign-to-copilot`, `new-copilot-item`), you **must** provide:
- `Repository` parameter - Git repository name (required for each tool call)
- `gitHubCopilot.defaultGuid` - Your GitHub Copilot user GUID (can be set in config or CLI)

The repository name must be provided as a parameter for each tool call, while the GitHub Copilot GUID can be set in your configuration file or via CLI argument.

Project config (`./mcp-config.json`) can override a subset:
```json
{
  "azureDevOps": { 
    "project": "SpecialProject",
    "areaPath": "SpecialProject\\Experiments" 
  },
  "gitRepository": { "defaultBranch": "develop" }
}
```

Authentication:
* Use `az login` (Azure CLI). The Azure DevOps extension is added automatically if missing.
* Personal Access Tokens are no longer supported/required; we intentionally removed that path.

Show the effective merged configuration (with redaction):
* Call tool `wit-show-config`.

Verbose debug logging: set `MCP_DEBUG=1` or enable `toolBehavior.verboseLogging`.
