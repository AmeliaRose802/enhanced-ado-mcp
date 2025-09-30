# How to Restart the MCP Server

After making changes to the MCP server code, you need to:

1. **Build the server**: Run `npm run build` in the `mcp_server` directory
2. **Restart the MCP server in VS Code**:
   - Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
   - Type "MCP: Restart Server"
   - Select your server ("enhanced-ado-msp")
   
   OR
   
   - Reload VS Code window (Ctrl+Shift+P -> "Developer: Reload Window")

## Project Structure

The `prompts/` and `ado_scripts/` folders are now located inside `mcp_server/`:

```
mcp_server/
  ├── ado_scripts/     ← PowerShell scripts for ADO operations
  ├── prompts/         ← Prompt templates for AI tools
  ├── src/             ← TypeScript source code
  └── dist/            ← Compiled JavaScript
```

This ensures they're always packaged correctly with npm.

## Local Development Configuration

The `.vscode/mcp.json` uses the **local build**:

```json
"command": "node",
"args": [
  "mcp_server/dist/index.js",
  ...
]
```

This ensures you're always using the latest local changes.

## Publishing to npm

When you're ready to publish a new version:

1. Update version in `mcp_server/package.json`
2. Run `npm run build` from the `mcp_server` directory
3. Run `npm publish`
4. Users can then install with `npx enhanced-ado-mcp-server`

The prompts and scripts are automatically included in the package!
