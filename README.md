# ⭐ Enhanced ADO MSP MCP Server

**Enterprise Azure DevOps work item management via Model Context Protocol** - Leverage existing PowerShell automation scripts as AI-powered tools with comprehensive prompt templates for intelligent work item operations.

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-Install_Enhanced_ADO_MCP_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-msp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%5D%7D)

[![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Enhanced_ADO_MCP_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-msp&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%5D%7D)

## 🚀 Installation & Getting Started

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders)
2. Install [Node.js](https://nodejs.org/en/download) 18+
3. Install [PowerShell 7+](https://github.com/PowerShell/PowerShell)
4. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and login with `az login`

### ✨ One-Click Install

**Recommended:** Click the install buttons above for instant setup in VS Code.

### 🛠️ Manual Installation

#### Option 1: NPX (Recommended)
```bash
# Run on-demand (always latest version)
npx -y enhanced-ado-mcp-server your-org your-project
```

#### Option 2: Global Install
```bash
# Install globally
npm install -g enhanced-ado-mcp-server

# Run with required organization and project
enhanced-ado-msp your-org your-project --area-path "YourProject\\YourTeam"
```

#### Option 3: VS Code MCP Configuration

Create `.vscode/mcp.json` in your project:

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
      "description": "Azure DevOps project name (e.g. 'MyProject')"
    },
    {
      "id": "ado_area_path",
      "type": "promptString",
      "description": "Default area path (e.g. 'MyProject\\MyTeam')"
    },
    {
      "id": "ado_copilot_guid",
      "type": "promptString",
      "description": "GitHub Copilot user GUID (required for Copilot tools)"
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
        "${input:ado_area_path}",
        "--copilot-guid",
        "${input:ado_copilot_guid}"
      ]
    }
  }
}
```

#### Option 4: Development/Local Testing

For development or testing with your local build:

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
      "description": "Azure DevOps project name (e.g. 'MyProject')"
    },
    {
      "id": "ado_area_path",
      "type": "promptString",
      "description": "Default area path (e.g. 'MyProject\\MyTeam')"
    },
    {
      "id": "ado_copilot_guid",
      "type": "promptString",
      "description": "GitHub Copilot user GUID (required for Copilot tools)"
    }
  ],
  "servers": {
    "enhanced-ado-msp": {
      "type": "stdio",
      "command": "node",
      "args": [
  "${workspaceFolder}/mcp_server/dist/index.js", 
        "${input:ado_org}", 
        "${input:ado_project}",
        "--area-path",
        "${input:ado_area_path}",
        "--copilot-guid",
        "${input:ado_copilot_guid}"
      ],
      "env": {
        "PWSH_PATH": "pwsh"
      }
    }
  }
}
```

### 🎯 Start Using

1. Open GitHub Copilot in VS Code and switch to **Agent Mode**
2. The Enhanced ADO MCP Server appears in the tools list
3. Try prompts like:
   - "Create a new work item for implementing user authentication"
   - "Assign work item 12345 to GitHub Copilot for automated completion"
   - "Extract security findings and create remediation tasks"

## Tools Exposed

1. `enhanced-ado-msp-create-new-item` → `ado_scripts/New-WorkItemWithParent-MCP.ps1`
2. `enhanced-ado-msp-assign-to-copilot` → `ado_scripts/Assign-ItemToCopilot-MCP.ps1`
3. `enhanced-ado-msp-new-copilot-item` → `ado_scripts/New-WorkItemAndAssignToCopilot-MCP.ps1`
4. `enhanced-ado-msp-extract-security-links` → `ado_scripts/Extract-SecurityInstructionLinks-MCP.ps1`

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
