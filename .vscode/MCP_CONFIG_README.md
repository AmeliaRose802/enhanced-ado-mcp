# VS Code MCP Server Configuration

This workspace is configured to run the enhanced-ado-msp MCP server automatically when VS Code starts.

## Configuration Files

### `.vscode/settings.json`
Contains the MCP server configuration that VS Code extensions (like GitHub Copilot) will use to connect to your server.

### Alternative Configuration Locations

If the workspace settings don't work, you can also configure MCP servers in these locations:

#### User Settings (Global)
Add to your VS Code User Settings JSON:
```json
{
  "mcpServers": {
    "enhanced-ado-msp": {
      "command": "node",
      "args": [
        "${workspaceFolder}/mcp_server/dist/index.js"
      ],
      "env": {
        "PWSH_PATH": "pwsh"
      }
    }
  }
}
```

#### GitHub Copilot Specific Config
Create/edit: `%USERPROFILE%\.config\github-copilot\mcp.json`
```json
{
  "servers": {
    "enhanced-ado-msp": {
      "command": "node",
      "args": [
        "${workspaceFolder}/mcp_server/dist/index.js"
      ],
      "env": {
        "PWSH_PATH": "pwsh"
      }
    }
  }
}
```

## Tools Available
Once configured, these tools will be available in VS Code MCP clients:

1. `enhanced-ado-msp-create-new-item` - Create new Azure DevOps work items
2. `enhanced-ado-msp-assign-to-copilot` - Assign existing work items to GitHub Copilot
3. `enhanced-ado-msp-new-copilot-item` - Create and immediately assign work items to Copilot

## Prerequisites
- PowerShell 7 (`pwsh`) installed and on PATH
- Azure CLI authenticated (`az login`)
- Node.js installed
- MCP server built (`npm run build` in mcp_server folder)

## Testing
1. Build the server: Run the "MCP Server: Build" task
2. Start VS Code with MCP-enabled extension
3. The server should auto-connect and tools should be available