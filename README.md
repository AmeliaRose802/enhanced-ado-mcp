# ⭐ Enhanced ADO MCP Server

**Enterprise Azure DevOps work item management via Model Context Protocol** - Leverage existing PowerShell automation scripts as AI-powered tools with comprehensive prompt templates for intelligent work item operations.

[![npm version](https://badge.fury.io/js/enhanced-ado-mcp-server.svg)](https://badge.fury.io/js/enhanced-ado-mcp-server)



## 🚀 Installation & Getting Started

For the best experience, use **Visual Studio Code** with **GitHub Copilot**. See alternative client configurations below for Claude Desktop, Cursor, and other MCP clients.

### Prerequisites

1. Install [Node.js](https://nodejs.org/en/download) 18+
1. Install [PowerShell 7+](https://github.com/PowerShell/PowerShell)
1. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and login with `az login`
1. **Install the [Azure DevOps MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/ado)** - This is a required dependency for core Azure DevOps operations
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
10. `wit-get-work-items-by-query-wiql` - Query Azure DevOps work items using WIQL (Work Item Query Language) with support for complex filtering, sorting, field selection, and computed metrics (daysInactive, daysSinceCreated, hasDescription, isStale)
11. `wit-get-work-items-context-batch` - Batch retrieve work items with enriched context (up to 50 items)
12. `wit-get-work-item-context-package` - Retrieve comprehensive context for a single work item including linked items and relationships
13. `wit-get-last-substantive-change` - Analyze single work item for true activity (filters automated iteration/area path changes)
14. `wit-get-last-substantive-change-bulk` - Bulk analysis (up to 100 items) for true activity levels, identifying genuinely stale vs recently touched items

### Bulk Operations & Backlog Hygiene Tools

15. `wit-bulk-state-transition` - Efficiently transition multiple work items (1-50) to a new state in one call with validation and dry-run mode
16. `wit-bulk-add-comments` - Add comments to multiple work items (1-50) efficiently with template variable substitution support
17. `wit-find-stale-items` - Purpose-built backlog hygiene tool to find stale/abandoned work items with staleness signals and risk categorization

The scripts are executed unchanged. The server just validates inputs and streams back their JSON output.

## Prompts Available

1. `intelligent_work_item_analyzer` - AI-powered comprehensive work item analysis (completeness, AI-readiness, categorization)
2. `ai_assignment_analyzer` - Enhanced AI assignment suitability analysis with confidence scoring and detailed reasoning
3. `work_item_enhancer` - Improve work item descriptions for clarity, scope, and acceptance criteria
4. `feature_decomposer` - Intelligently decompose large features into smaller work items with AI suitability analysis
5. `hierarchy_validator` - Analyze and validate work item parent-child relationships
6. `parallel_fit_planner` - Analyze child work items for parallel execution and AI/human assignment strategy
7. `find_dead_items` - Identify stale/abandoned work items using substantive change analysis (filters iteration path churn)
8. `backlog_cleanup` - Comprehensive backlog hygiene and removal candidate identification
9. `security_items_analyzer` - Analyze security and compliance items, categorize, and create remediation plans
10. ~~`ai_suitability_analyzer`~~ - **DEPRECATED:** Use `ai_assignment_analyzer` instead for enhanced capabilities

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

## Bulk Operations Examples

The Enhanced ADO MCP Server provides powerful bulk operation tools for efficient backlog management and hygiene.

### Bulk State Transition

Transition multiple work items to a new state in one call with validation and dry-run support.

**Example: Remove multiple stale items**
```json
{
  "WorkItemIds": [12345, 12346, 12347],
  "NewState": "Removed",
  "Comment": "Automated backlog hygiene: Item inactive for >180 days with no substantive changes.",
  "Reason": "Abandoned",
  "DryRun": true
}
```

**Dry-Run Response:**
```json
{
  "dryRun": true,
  "summary": {
    "total": 3,
    "valid": 2,
    "invalid": 1,
    "wouldUpdate": 2
  },
  "validations": [
    {
      "workItemId": 12345,
      "valid": true,
      "currentState": "Active",
      "workItemType": "Task",
      "title": "Old task"
    },
    {
      "workItemId": 12346,
      "valid": false,
      "error": "Already in state 'Removed'"
    }
  ]
}
```

### Bulk Add Comments

Add comments to multiple work items with template support.

**Example: Notify about backlog review**
```json
{
  "Items": [
    {
      "WorkItemId": 12345,
      "Comment": "This item was reviewed during backlog hygiene on 2025-10-01. Last activity: 250 days ago."
    },
    {
      "WorkItemId": 12346,
      "Comment": "This item was reviewed during backlog hygiene on 2025-10-01. Last activity: 180 days ago."
    }
  ]
}
```

**Using Templates:**
```json
{
  "Items": [
    {"WorkItemId": 12345, "Comment": "placeholder"},
    {"WorkItemId": 12346, "Comment": "placeholder"}
  ],
  "Template": "Backlog hygiene review: {{analysisDate}}. Days inactive: {{daysInactive}}. Status: {{status}}",
  "TemplateVariables": {
    "analysisDate": "2025-10-01",
    "status": "Under review"
  }
}
```

### Find Stale Items

Purpose-built tool for backlog hygiene with staleness signals.

**Example: Find stale items in area path**
```json
{
  "AreaPath": "MyProject\\MyTeam",
  "MinInactiveDays": 180,
  "IncludeSubAreas": true,
  "IncludeSubstantiveChange": true,
  "IncludeSignals": true
}
```

**Response with Signals:**
```json
{
  "summary": {
    "total": 150,
    "stale": 25,
    "healthy": 125,
    "byRiskLevel": {
      "high": 8,
      "medium": 12,
      "low": 5
    }
  },
  "staleItems": [
    {
      "id": 12345,
      "title": "Old task",
      "state": "To Do",
      "daysInactive": 250,
      "signals": {
        "reasons": [
          "Inactive for 250 days",
          "Created 1000+ days ago",
          "In passive state (To Do)",
          "Unassigned",
          "No description"
        ],
        "riskLevel": "high"
      }
    }
  ],
  "categorized": {
    "high": [...],
    "medium": [...],
    "low": [...]
  }
}
```

### Computed Metrics in WIQL

Add computed metrics to WIQL queries for efficient analysis.

**Example: Query with computed metrics**
```json
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'MyProject\\MyTeam' AND [System.State] <> 'Done'",
  "ComputeMetrics": true,
  "StaleThresholdDays": 180,
  "IncludeFields": ["System.Description"]
}
```

**Response with Metrics:**
```json
{
  "work_items": [
    {
      "id": 12345,
      "title": "Some task",
      "computedMetrics": {
        "daysSinceCreated": 500,
        "daysSinceChanged": 200,
        "hasDescription": false,
        "isStale": true
      }
    }
  ]
}
```

## Available Prompts

The Enhanced ADO MCP Server includes powerful prompt templates for AI-powered work item enhancement and analysis. These prompts can be accessed via the MCP Prompts API.

### User-Facing Prompts

#### 1. `work_item_enhancer`

**Purpose:** Enhance work item descriptions to make them clear, complete, and AI-ready

**Arguments:**
- `Title` (required) - Work item title
- `Description` (optional) - Current description
- `WorkItemType` (optional) - Type (Task, Bug, PBI, etc.)
- `AcceptanceCriteria` (optional) - Current acceptance criteria
- `ContextInfo` (optional) - Additional project/team context

**Use Cases:**
- Improve vague or incomplete work items
- Add missing acceptance criteria
- Make work items suitable for AI automation
- Standardize work item format across team

**Example Request:**
```json
{
  "Title": "Fix login button",
  "Description": "Button doesn't work",
  "WorkItemType": "Bug"
}
```

**Example Output:**
```markdown
## Enhanced Work Item

### Title
Fix login button click handler not responding on mobile devices

### Description
The login button on the authentication page is not responding to click events on mobile Safari (iOS 15+). Users tap the button but nothing happens, preventing login.

**Current Behavior:**
- Button appears on screen
- No visual feedback on tap
- No API call triggered
- Works correctly on desktop browsers

**Expected Behavior:**
- Button should respond to touch events
- Show visual feedback (pressed state)
- Trigger authentication API call
- Navigate to dashboard on success

### Acceptance Criteria
- [ ] Login button responds to touch events on iOS Safari
- [ ] Button shows pressed state when tapped
- [ ] Authentication API is called on button tap
- [ ] User is redirected to dashboard after successful login
- [ ] Error message shown if authentication fails
- [ ] Tested on iOS 15+ and Android devices

### Technical Notes
- Check touch event handlers vs click handlers
- Verify CSS for mobile tap states
- Test on physical devices, not just simulators
```

---

#### 2. `ai_suitability_analyzer`

**Purpose:** Analyze whether a work item is suitable for automated AI completion

**Arguments:**
- `Title` (required) - Work item title
- `Description` (optional) - Work item description
- `WorkItemType` (optional) - Type of work item
- `Complexity` (optional) - Estimated complexity
- `TechnicalContext` (optional) - Tech stack/frameworks involved

**Use Cases:**
- Decide if work item should be assigned to AI agent
- Identify blockers for AI automation
- Triage work items for human vs AI assignment
- Quality gate before AI assignment

**Example Request:**
```json
{
  "Title": "Update copyright year in footer",
  "Description": "Change copyright year from 2024 to 2025 in footer component",
  "WorkItemType": "Task",
  "TechnicalContext": "React TypeScript"
}
```

**Example Output:**
```json
{
  "suitable_for_ai": true,
  "confidence": 95,
  "reasoning": "This is a simple, well-defined change with clear scope. The task involves a straightforward text update in a specific component with no complex logic or dependencies.",
  "strengths": [
    "Clear, specific objective",
    "Well-defined scope",
    "Low risk change",
    "Easy to verify",
    "No external dependencies"
  ],
  "concerns": [],
  "recommendation": "Highly suitable for AI automation. This is an ideal task for an AI agent.",
  "estimated_effort": "5-10 minutes"
}
```

---

#### 3. `security_items_analyzer`

**Purpose:** Analyze security and compliance work items in a given area path

**Arguments:**
- `AreaPath` (required) - Area path to analyze
- `ScanType` (optional) - Type of security scan (BinSkim, CodeQL, CredScan, All)
- `IncludeResolved` (optional) - Include resolved items
- `MaxItems` (optional) - Maximum items to analyze

**Use Cases:**
- Triage security scan results
- Categorize security findings
- Identify AI-suitable remediation tasks
- Create remediation plans
- Track security debt

**Example Request:**
```json
{
  "AreaPath": "MyProject\\Security",
  "ScanType": "CodeQL",
  "IncludeResolved": false
}
```

**Example Output:**
```json
{
  "summary": {
    "total_items": 45,
    "critical": 3,
    "high": 12,
    "medium": 20,
    "low": 10,
    "ai_suitable": 28
  },
  "categories": {
    "injection_vulnerabilities": 8,
    "authentication_issues": 5,
    "data_exposure": 7,
    "configuration_errors": 15,
    "dependency_updates": 10
  },
  "ai_suitable_items": [
    {
      "id": 12345,
      "title": "Update lodash to fix prototype pollution",
      "category": "dependency_updates",
      "severity": "high",
      "reasoning": "Standard dependency update with clear instructions"
    }
  ],
  "requires_human_review": [
    {
      "id": 12346,
      "title": "Implement OAuth 2.0 authentication",
      "category": "authentication_issues",
      "severity": "critical",
      "reasoning": "Complex security architecture change requiring design decisions"
    }
  ],
  "remediation_plan": {
    "phase_1": "Update dependencies (AI suitable)",
    "phase_2": "Fix configuration errors (AI suitable)",
    "phase_3": "Address authentication issues (Human required)"
  }
}
```

### System Prompts (Internal Use)

These prompts are used internally by AI-powered tools and are not directly exposed to users:

- `ai-assignment-analyzer.md` - Detailed AI suitability analysis
- `completeness-analyzer.md` - Work item completeness scoring
- `ai-readiness-analyzer.md` - AI-readiness evaluation
- `enhancement-analyzer.md` - Enhancement suggestions
- `categorization-analyzer.md` - Smart categorization
- `full-analyzer.md` - Complete work item analysis
- `feature-decomposer.md` - Feature breakdown logic
- `hierarchy-validator.md` - Hierarchy validation rules

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
