# ⭐ Enhanced ADO MSP MCP Server

**Enterprise Azure DevOps work item management via Model Context Protocol** - Leverage existing PowerShell automation scripts as AI-powered tools with comprehensive prompt templates for intelligent work item operations.

[![npm version](https://badge.fury.io/js/enhanced-ado-mcp-server.svg)](https://badge.fury.io/js/enhanced-ado-mcp-server)
[![MCP Server](https://img.shields.io/badge/MCP-Server-blue?style=flat-square)](https://modelcontextprotocol.io/)
[![Azure DevOps](https://img.shields.io/badge/Azure_DevOps-Integration-0078d4?style=flat-square&logo=azuredevops)](https://dev.azure.com/)

## 🚀 Installation & Getting Started

### Prerequisites

1. Install [Node.js](https://nodejs.org/en/download) 18+
2. Install [PowerShell 7+](https://github.com/PowerShell/PowerShell)
3. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and login with `az login`
4. Install an MCP-compatible client:
   - [Claude Desktop](https://claude.ai/download)
   - [Cursor](https://cursor.sh/)
   - [VS Code with MCP extension](https://marketplace.visualstudio.com/items?itemName=anthropic.mcp)
   - [Windsurf](https://codeium.com/windsurf)

### 🛠️ Installation Options

#### Option 1: NPX (Recommended)
```bash
# Install the package
npm install -g enhanced-ado-mcp-server
```

#### Option 2: Direct Install
```bash
# Install globally for system-wide access
npm install -g enhanced-ado-mcp-server
```

### 🔧 MCP Client Configuration

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

1. **Claude Desktop**: Open Claude Desktop and the MCP server will be automatically available
2. **VS Code**: Install the MCP extension and configure the server
3. **Cursor**: Configure in settings and use the MCP tools panel

Try prompts like:
- "Create a new work item for implementing user authentication"
- "Assign work item 12345 to GitHub Copilot for automated completion"
- "Extract security findings and create remediation tasks"
- "Analyze security items in my area path and create remediation plan"

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
