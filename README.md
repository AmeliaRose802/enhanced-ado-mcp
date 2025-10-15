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

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=for-the-badge&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-msp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Area%20path%20(e.g.%20Project%5C%5CTeam)%22%7D%5D)

[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install-24bfa5?style=for-the-badge&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=enhanced-ado-msp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22enhanced-ado-mcp-server%22%2C%22%24%7Binput%3Aado_org%7D%22%2C%22%24%7Binput%3Aado_project%7D%22%2C%22--area-path%22%2C%22%24%7Binput%3Aarea_path%7D%22%5D%7D&inputs=%5B%7B%22id%22%3A%22ado_org%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20organization%20name%22%7D%2C%7B%22id%22%3A%22ado_project%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Azure%20DevOps%20project%20name%22%7D%2C%7B%22id%22%3A%22area_path%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Area%20path%20(e.g.%20Project%5C%5CTeam)%22%7D%5D)

You'll be prompted for:
- Organization name (e.g., `mycompany`)
- Project name (e.g., `MyProject`)  
- Area path (e.g., `MyProject\\MyTeam`)

**Manual Configuration:**

Add to VS Code `settings.json`:
```json
{
  "github.copilot.chat.mcp.servers": {
    "enhanced-ado-msp": {
      "command": "npx",
      "args": ["-y", "enhanced-ado-mcp-server", "YOUR_ORG", "YOUR_PROJECT", "--area-path", "YOUR_PROJECT\\YOUR_TEAM"]
    }
  }
}
```

---

### Claude Desktop / Cursor

**Configuration File:**
- **macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Add this:**
```json
{
  "mcpServers": {
    "enhanced-ado-msp": {
      "command": "npx",
      "args": ["-y", "enhanced-ado-mcp-server", "YOUR_ORG", "YOUR_PROJECT", "--area-path", "YOUR_PROJECT\\YOUR_TEAM"]
    }
  }
}
```

---

## Why Choose Enhanced ADO MCP Server?

While the [basic ADO MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/ado) provides core Azure DevOps functionality, this enhanced version offers significant advantages for production workflows:

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
- **Natural Language → WIQL** - `wit-generate-wiql-query` converts plain English to valid WIQL
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

- **35 MCP Tools** for Azure DevOps work item management
- **AI-Powered Analysis** (completeness, AI-readiness, assignment suitability)
- **Natural Language Queries** (English → WIQL generation)
- **Safe Bulk Operations** (query handle pattern prevents ID hallucination)
- **GitHub Copilot Integration** (auto-assign work items to coding agents)

### Key Tools

**Work Items:**
- Create, update, assign work items
- Auto-assign to GitHub Copilot with branch links
- Extract security scan instructions

**Queries:**
- `wit-generate-wiql-query` - Natural language → WIQL
- `wit-get-work-items-by-query-wiql` - Execute WIQL queries
- Query handle pattern for safe bulk operations

**Bulk Operations:**
- `wit-bulk-update-by-query-handle` - Safe batch updates
- `wit-bulk-assign-by-query-handle` - Batch assignments  
- `wit-bulk-remove-by-query-handle` - Batch removal (with dry-run)
- Preview selection before executing

**Analysis (requires VS Code + GitHub Copilot):**
- `wit-intelligence-analyzer` - Completeness & AI-readiness
- `wit-ai-assignment-analyzer` - Assignment suitability analysis
- `wit-validate-hierarchy-fast` - Rule-based hierarchy validation

See [docs/feature_specs/](docs/feature_specs/) for complete documentation.

---

## Quick Examples

### Query with natural language
```javascript
callTool("wit-generate-wiql-query", {
  description: "All active bugs created in the last 7 days",
  testQuery: true
});
```

### Safe bulk operations
```javascript
// 1. Query with handle
const handle = await callTool("wit-get-work-items-by-query-wiql", {
  wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = ''Active''",
  returnQueryHandle: true
});

// 2. Preview selection
await callTool("wit-select-items-from-query-handle", {
  queryHandle: handle.queryHandle,
  itemSelector: { states: ["Active"], tags: ["critical"] }
});

// 3. Execute
await callTool("wit-bulk-update-by-query-handle", {
  queryHandle: handle.queryHandle,
  itemSelector: { states: ["Active"], tags: ["critical"] },
  fields: { "System.Tags": "needs-review" }
});
```

---

## AI Features (VS Code Only)

AI-powered tools require VS Code with GitHub Copilot and language model access.

**Setup:**
1. Open Command Palette (`F1`)
2. Run **"MCP: List Servers"**  
3. Select **"enhanced-ado-msp"**
4. Click **"Configure Model Access"**
5. **Check ALL free models** (marked `0x` tokens)

Server automatically selects fastest free model. No configuration needed.

---

## Troubleshooting

### Common Errors

**Analytics Permission Error (TF400813)**  
**Fix:** Ask admin for "View analytics" permission, or use WIQL tools instead of OData.

**Missing Work Item Type ($undefined)**  
**Fix:** Always specify `workItemType` when creating items.

**Area Path Required (404)**  
**Fix:** Use `wit-list-area-paths` to find valid paths.

### Debug Mode
```bash
export MCP_DEBUG=1  # macOS/Linux
$env:MCP_DEBUG=1    # PowerShell
```

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
