# Azure DevOps Work Item MCP - VS Code Extension

This VS Code extension provides integration with the Azure DevOps Work Item MCP Server, enabling you to manage Azure DevOps work items directly from VS Code.

## Features

- **Create Work Items**: Create new Azure DevOps work items with various types
- **Assign to Copilot**: Assign existing work items to GitHub Copilot for automated handling
- **Security Analysis**: Analyze security and compliance items
- **Work Item Enhancement**: Improve work item descriptions using AI prompts
- **Configuration Management**: View and manage MCP server configuration

## Commands

All commands are available through the Command Palette (`Ctrl+Shift+P`):

- `ADO MCP: Create Work Item` - Create a new work item
- `ADO MCP: Assign Work Item to Copilot` - Assign an existing work item to Copilot
- `ADO MCP: Create New Copilot Work Item` - Create and immediately assign a work item to Copilot
- `ADO MCP: Extract Security Instruction Links` - Extract security instruction links from work items
- `ADO MCP: Analyze Security Items` - Run security analysis on area path items
- `ADO MCP: Enhance Work Item Description` - Improve work item descriptions using AI
- `ADO MCP: Show MCP Configuration` - Display current MCP server configuration

## Setup

1. **Build the MCP Server**: Ensure your MCP server is built by running the `MCP Server: Build` task
2. **Configure the Extension**: Set the path to your MCP server in VS Code settings:
   ```json
    {
       "ado-mcp.serverPath": "${workspaceFolder}/mcp_server/dist/index.js",
       "ado-mcp.autoStart": true
    }
   ```
3. **Prerequisites**: Ensure you have:
   - PowerShell 7 (`pwsh`) installed
   - Azure CLI installed and logged in (`az login`)
   - Required Azure DevOps permissions

## Configuration

The extension will automatically start the MCP server when activated. You can configure:

- `ado-mcp.serverPath`: Path to the MCP server executable
- `ado-mcp.serverArgs`: Additional arguments for the MCP server
- `ado-mcp.autoStart`: Whether to automatically start the server (default: true)

## Usage

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Type "ADO MCP" to see available commands
3. Select the desired command and follow the prompts
4. The extension will communicate with the MCP server to execute the requested action

## Development

To build the extension:

```bash
npm run compile
```

To package the extension:

```bash
npm install -g vsce
vsce package
```

## Requirements

- VS Code 1.74.0 or higher
- Node.js for running the MCP server
- PowerShell 7 for Azure DevOps script execution
- Azure CLI with proper authentication