# Enhanced ADO MCP Server

AI-powered Azure DevOps work item management via Model Context Protocol.

[![npm version](https://badge.fury.io/js/enhanced-ado-mcp-server.svg)](https://www.npmjs.com/package/enhanced-ado-mcp-server)
[![Tests](https://img.shields.io/badge/Tests-606%20Passing-brightgreen)](mcp_server/test)

---

## Quick Install

### Prerequisites

**1. Install Azure CLI** (required for authentication)

- **Windows:** [aka.ms/installazurecliwindows](https://aka.ms/installazurecliwindows)
- **macOS:** `brew install azure-cli`
- **Linux:** [docs.microsoft.com/cli/azure/install-azure-cli-linux](https://docs.microsoft.com/cli/azure/install-azure-cli-linux)

After install: `az login`

**2. Install npx** (comes with Node.js 18+)

- Download: [nodejs.org/download](https://nodejs.org/en/download/)
- Verify: `npx --version`

---

### VS Code (Recommended)

**One-Click Install:**

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=for-the-badge&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Area%20path%20(e.g.%20MyProject%5C%5CTeam%5C%5CArea)%20-%20project%20extracted%20automatically%22%7D%5D)

[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install-24bfa5?style=for-the-badge&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Area%20path%20(e.g.%20MyProject%5C%5CTeam%5C%5CArea)%20-%20project%20extracted%20automatically%22%7D%5D)

**VS Code will prompt you for:**

1. **Organization name** (e.g., `mycompany`)
2. **Area path** (e.g., `MyProject\Team\Area`)

The project name is **automatically extracted** from your area path (the first part before `\`).

> 💡 **Example:** If you enter `MyProject\Engineering\Backend` as the area path, the project will be set to `MyProject`

**Manual Configuration:**

Add to VS Code `settings.json`:

**Step 1:** Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)  
**Step 2:** Type "Preferences: Open User Settings (JSON)"  
**Step 3:** Add this configuration:

```json
```

**Real Example:**

```json
```

**Step 4:** Replace placeholders:

- `YOUR_ORG` → Your organization name (e.g., `contoso`)
- `YOUR_PROJECT\\YOUR_TEAM` → Your area path (e.g., `MyProject\Engineering\Backend`)

**Step 5:** Reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")

**Note:** OData Analytics queries use Azure CLI authentication automatically for maximum compatibility. Other operations use the server's configured authentication method (defaults to interactive OAuth). You can override this with the `--authentication` flag if needed.

**Real Example:**
```json
{
  "github.copilot.chat.mcp.servers": {
    "enhanced-ado-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "enhanced-ado-mcp-server",
        "contoso",
        "--area-path",
        "ContosoApp\\Engineering\\Backend"
      ]
    }
  }
}
```

**Multi-Team Setup:**

```json
{
  "github.copilot.chat.mcp.servers": {
    "enhanced-ado-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "enhanced-ado-mcp-server",
        "contoso",
        "--area-path", "ContosoApp\\Engineering\\Frontend",
        "--area-path", "ContosoApp\\Engineering\\Backend",
        "--area-path", "ContosoApp\\DevOps"
      ]
    }
  }
}
```

**Note:** The project name is automatically extracted from the area path (first segment before `\\`).

---

### Claude Desktop / Cursor

**Configuration File:**

- **macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Add this:**

```json
{
  "mcpServers": {
    "enhanced-ado-mcp": {
      "command": "npx",
      "args": ["-y", "enhanced-ado-mcp-server", "YOUR_ORG", "--area-path", "YOUR_PROJECT\\YOUR_TEAM"]
    }
  }
}
```

**Multi-area support (optional):**

```json
{
  "mcpServers": {
    "enhanced-ado-mcp": {
      "command": "npx",
      "args": [
        "-y", 
        "enhanced-ado-mcp-server", 
        "YOUR_ORG", 
        "--area-path", "YOUR_PROJECT\\TEAM_A",
        "--area-path", "YOUR_PROJECT\\TEAM_B"
      ]
    }
  }
}
```

---

## Why Choose Enhanced ADO MCP Server?

While the [basic ADO MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/ado) provides core Azure DevOps functionality, this enhanced version offers significant advantages for production workflows:

```

### 🛡️ Anti-Hallucination Architecture
**Query Handle Pattern** - AI agents can't hallucinate work item IDs. Instead of exposing raw IDs that agents might invent, our query handle system ensures agents only operate on validated work items from actual queries.

```javascript
// ❌ Basic server: Agent can hallucinate IDs
updateWorkItems([12345, 99999, 54321]);  // ID 99999 might be an item on someone else's board that you don't want to modify by mistake

// ✅ Enhanced server: Query handle prevents hallucination
const handle = queryWIQL("SELECT [System.Id] FROM WorkItems...", { returnQueryHandle: true });
bulkUpdateByQueryHandle(handle, { itemSelector: "all" });  // Only real items
```

Agents seem to be less likely to hallucinate the alphanumeric query handles. Additionally, even if they do, the hallucinated handle is incredibly unlikely to be a valid active handle so the server will reject the update.

### 🎯 Better Multi-Step Operation UX

**Reliable workflows** - Complex operations broken into validated steps with preview capabilities. See exactly what will happen before executing destructive operations.

Agents struggle with flows that require multiple steps. Creating and parenting a simple work item with the basic ado mcp server requires 6 separate tool calls which is slow and unreliable (I've never seen it get all the configuration right) whereas this server combines common flows into agent friendly single step tool calls.

### 🔍 Intelligent Query Tools

- **Natural Language → WIQL** - `query-wiql` converts plain English to valid WIQL
- **OData Analytics** - Advanced metrics and aggregations for team velocity, trends, burndown
- **WIQL + OData** - Both query languages supported with validation and auto-correction

### Better context window usage

With the normal ado mcp server, you eventually find the item you are looking for by pulling in hundreds of items, but it will quickly max out the context window making the process slow and unreliable.

Want aggregate stats on velocity? The agent will need to manually count points which it will get wrong and hallucinate. By allowing for server side aggregation and filtering, the enhanced-ado mcp server allows you to work with more data without breaking the context window.

Relibly generating queries requires thosands of tokens of context, which will degrade the performance of your main agent. Using dedicated sub-agents with sampling allows for natural language to wiql/odata query conversion with mininal context window impact.

### 🤖 AI-Powered Analysis

**Smart insights** (VS Code + GitHub Copilot):

- Work item completeness scoring
- AI assignment suitability analysis
- Automatic decomposition recommendations
- Hierarchy validation with actionable fixes

### ⚡ Safe Bulk Operations

- **Preview before execute** - See which items will be affected
- **Item selectors** - Filter by state, tags, staleness within query results
- **Dry-run mode** - Test destructive operations safely
- **Validation** - All operations validated before execution

### 📊 Production-Ready Features

- **606 passing tests** with comprehensive coverage
- **Pagination** - Handles large result sets efficiently
- **Error categorization** - Clear, actionable error messages
- **Auto-discovery** - Finds GitHub Copilot GUID automatically
- **Structured logging** - Debug mode for troubleshooting

**Use the basic server for:** Simple work item CRUD operations  
**Use the enhanced server for:** Production workflows, bulk operations, AI-powered analysis, and complex multi-step processes

---

## What It Does

- **21 MCP Tools** for Azure DevOps work item management
- **AI-Powered Analysis** (workload health, query handle analysis, tool discovery)
- **Natural Language Queries** (English → WIQL/OData generation)
- **Safe Bulk Operations** (query handle pattern prevents ID hallucination)
- **GitHub Copilot Integration** (auto-assign work items to coding agents)

### Key Tools

**Work Item Creation (3 tools):**

- `create-workitem` - Create new work items with parent relationships
- `assign-copilot` - Assign work items to GitHub Copilot

**Work Item Context (2 tools):**

- `get-context` - Comprehensive work item details
- `extract-security-links` - Extract security scan instructions

**Query Tools (2 tools):**

- `query-wiql` - Execute WIQL or generate from natural language
- `query-odata` - Execute OData analytics or generate from natural language

**Query Handle Management (4 tools):**

- `analyze-bulk` - Analyze work items via query handle
- `list-handles` - List all active query handles
- `inspect-handle` - Get comprehensive handle information
- `get-context-bulk` - Batch context retrieval

**Bulk Operations (4 tools):**

- `execute-bulk-operations` - Unified bulk operations (update fields, tags, comments, links, state transitions, AI enhancements)
- `link-workitems` - Create relationships between items
- `undo-bulk` - Undo previous operations
- `undo-forensic` - Undo changes by user/timestamp

**AI Analysis (3 tools - requires VS Code + GitHub Copilot):**

- `analyze-workload` - Burnout risk & workload health
- `analyze-query-handle` - AI-powered analysis of query handle results
- `discover-tools` - Find the right tool for your task

**Configuration & Discovery (4 tools):**

- `get-config` - View current server configuration
- `get-prompts` - Access prompt templates
- `list-agents` - List available specialized agents
- `get-team-members` - Discover team roster (filters GitHub Copilot automatically)

See [docs/feature_specs/](docs/feature_specs/) for complete documentation.

---

## Quick Examples

### Query with natural language

```javascript
// AI-powered query generation
callTool("query-wiql", {
  description: "All active bugs created in the last 7 days",
  testQuery: true
});

// Or direct WIQL execution
callTool("query-wiql", {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug' AND [System.State] = 'Active' AND [System.CreatedDate] >= @Today - 7",
  returnQueryHandle: true
});
```

### Safe bulk operations

```javascript
// 1. Query with handle
const result = await callTool("query-wiql", {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  returnQueryHandle: true
});

// 2. Unified bulk operations (preview + execute)
await callTool("execute-bulk-operations", {
  queryHandle: result.query_handle,
  actions: [
    { type: "add-tag", tags: "needs-review" },
    { type: "comment", comment: "Flagged for review" }
  ],
  itemSelector: { states: ["Active"], tags: ["critical"] },
  dryRun: true  // Preview first
});

// 3. Execute for real
await callTool("execute-bulk-operations", {
  queryHandle: result.query_handle,
  actions: [
    { type: "add-tag", tags: "needs-review" },
    { type: "comment", comment: "Flagged for review" }
  ],
  itemSelector: { states: ["Active"], tags: ["critical"] },
  dryRun: false
});
```

---

## AI Features (VS Code Only)

AI-powered tools require VS Code with GitHub Copilot and language model access.

**Setup:**

1. Open Command Palette (`F1`)
2. Run **"MCP: List Servers"**  
3. Select **"enhanced-ado-mcp"**
4. Click **"Configure Model Access"**
5. **Check ALL free models** (marked `0x` tokens)

Server automatically selects fastest free model. No configuration needed.

---

## Troubleshooting

### Common Errors

**OData 401 Authorization Error (TF400813)**  
**Root Cause:** This error typically means you lack "View analytics" permission in Azure DevOps, OR you're not logged into Azure CLI.  

**Fix:**

1. **First, ensure Azure CLI is logged in:** Run `az login` in your terminal
2. **Verify you have Analytics permissions:**
   - Go to: `https://dev.azure.com/{YOUR_ORG}/{YOUR_PROJECT}/_settings/security`
   - Search for your email address in the Members list
   - Check for "View analytics" permission
3. **If permission is missing:** Contact your Azure DevOps administrator to request "View analytics" at the project level

**Technical Details:**  
OData Analytics queries automatically use Azure CLI authentication (as of v1.10.1) because the Analytics API requires Azure CLI tokens. OAuth tokens from interactive authentication don't work with this API. This happens transparently - you don't need any special configuration.

**Alternative:** If you can't get Analytics permissions, use WIQL queries (`query-wiql`) instead of OData queries.

**📖 Detailed Guide:** See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for comprehensive diagnosis, resolution steps, and migration patterns.

---

### Permission Requirements by Tool

| Tool | Required Permission | Notes |
|------|---------------------|-------|
| `query-wiql` | View work items | Standard access, all team members |
| `query-odata` | **View analytics** | Must be explicitly granted by admin |
| Create/Update tools | Edit work items | Standard access |
| AI Analysis | View work items + GitHub Copilot | VS Code only |

**Key Difference:** "View analytics" is a SEPARATE permission from "View work items". Having work item access does NOT automatically grant Analytics API access.

---

**Missing Work Item Type ($undefined)**  
**Fix:** Always specify `workItemType` when creating items.

**Area Path Required (404)**  
**Fix:** Use `wit-list-area-paths` to find valid paths.

### Debug Mode

```bash
export MCP_DEBUG=1  # macOS/Linux
$env:MCP_DEBUG=1    # PowerShell
```

### Debug Tools

The `get-prompts` tool is **disabled by default** in production for security reasons. To enable debug tools (e.g., for testing prompt templates):

```bash
export MCP_ENABLE_DEBUG_TOOLS=1  # macOS/Linux
$env:MCP_ENABLE_DEBUG_TOOLS='1'  # PowerShell
```

**Note:** Debug tools expose internal prompt templates and should only be enabled in development/testing environments.

---

## Development

```bash
cd mcp_server
npm install
npm run build
npm test
```

**Pre-commit hooks** enforce Prettier + ESLint automatically.

---

## Documentation

- [Feature Specs](docs/feature_specs/) - Detailed tool documentation
- [API Reference](mcp_server/docs/api/) - OpenAPI specs
- [Resources](mcp_server/resources/) - Quick reference guides
- [Contributing](docs/CONTRIBUTING.md) - Development guidelines

---

## License

MIT
