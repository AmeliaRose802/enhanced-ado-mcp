#!/usr/bin/env node

/**
 * Enhanced ADO MCP Server - Main Entry Point
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HybridStdioServerTransport } from "./hybridTransport.js";
import { logger } from "./utils/logger.js";
import { getAvailableToolConfigs } from "./config/tool-configs/index.js";
import { loadPrompts, getPromptContent } from "./services/prompt-service.js";
import { executeTool, setServerInstance } from "./services/tool-service.js";
import { checkSamplingSupport } from "./utils/sampling-client.js";
import { listResources, getResourceContent } from "./services/resource-service.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { updateConfigFromCLI, ensureGitHubCopilotGuid, type CLIArguments } from "./config/config.js";

const server = new Server({
  name: "enhanced-ado-mcp-server",
  version: "1.8.0"
}, {
  capabilities: {
    tools: {},
    prompts: {},
    resources: {},
    sampling: {}
  }
});

// Request handler with proper error handling
server.fallbackRequestHandler = async (request: any) => {
  logger.debug(`Handling request: ${request.method}`, JSON.stringify(request.params));
  
  if (request.method === "tools/list") {
    const hasSampling = checkSamplingSupport(server);
    const availableToolConfigs = getAvailableToolConfigs(hasSampling);
    const availableTools = availableToolConfigs.map(tc => ({
      name: tc.name,
      description: tc.description,
      inputSchema: tc.inputSchema
    }));
    
    if (!hasSampling) {
      logger.info('Sampling not supported - AI-powered tools disabled');
    }
    
    return { tools: availableTools };
  }
  
  if (request.method === "prompts/list") {
    const prompts = await loadPrompts();
    return { prompts };
  }
  
  if (request.method === "prompts/get") {
    const { name, arguments: args } = request.params || {};
    const content = await getPromptContent(name, args);
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: content }
      }]
    };
  }
  
  if (request.method === "resources/list") {
    const resources = listResources();
    return { resources };
  }
  
  if (request.method === "resources/read") {
    const { uri } = request.params || {};
    const content = await getResourceContent(uri);
    return {
      contents: [{
        uri: content.uri,
        name: content.name,
        mimeType: content.mimeType,
        text: content.text
      }]
    };
  }
  
  if (request.method === "tools/call") {
    const { name, arguments: args } = request.params || {};
    const result = await executeTool(name, args);
    logger.debug(`Tool '${name}' completed (success=${result.success}).`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      ...(result.success === false && { isError: true })
    };
  }
  
  return {} as any;
};

/**
 * Parse command line arguments
 */
const argv = yargs(hideBin(process.argv))
  .scriptName("enhanced-ado-msp")
  .usage("Usage: $0 <organization> --area-path <path> [options]\\n\\nProject name is automatically extracted from the area path. Multiple --area-path flags can be specified for multi-area support.")
  .version("1.2.2")
  .command("$0 <organization> [options]", "Enhanced ADO MCP Server", (yargs) => {
    yargs
      .positional("organization", {
        describe: "Azure DevOps organization name",
        type: "string",
        demandOption: true,
      });
  })
  .option("area-path", {
    alias: "a",
    describe: "Default area path (e.g., 'MyProject\\\\TeamName\\\\Area'). Required. Can be specified multiple times for multi-area support. Project will be extracted automatically.",
    type: "string",
    array: true,
    demandOption: true
  })
  .option("verbose", {
    alias: "v",
    describe: "Enable verbose logging",
    type: "boolean",
    default: false
  })
  .example([
    ['$0 myorg --area-path "MyProject\\\\Team\\\\Area"', 'Start with area path (project extracted automatically)'],
    ['$0 myorg --area-path "ProjectA\\\\Team1" --area-path "ProjectA\\\\Team2"', 'Multi-area support (same project)'],
    ['$0 myorg -a "MyProject\\\\Team"', 'Using short flag alias']
  ])
  .help()
  .parseSync();

/**
 * Main server startup function
 */
async function main() {
  try {
    // Normalize area-path from yargs (can be string, array, or undefined)
    const areaPathArg = argv['area-path'];
    const normalizedArgs = {
      ...argv,
      areaPath: undefined, // Clear single value
      areaPaths: Array.isArray(areaPathArg) 
        ? areaPathArg 
        : (areaPathArg ? [areaPathArg] : undefined)
    };
    
    updateConfigFromCLI(normalizedArgs as any as CLIArguments);

    if (argv.verbose) {
      process.env.MCP_DEBUG = '1';
    }

    // Automatically look up GitHub Copilot GUID if not provided
    await ensureGitHubCopilotGuid();

    const useHybrid = process.env.MCP_HYBRID === "1";
    
    logger.info(`enhanced-ado-msp MCP server starting (${useHybrid ? "hybrid" : "stdio"})`);
    
    // Set server instance with type assertion to handle SDK generic complexity
    setServerInstance(server as any);
    
    const transport = useHybrid ? new HybridStdioServerTransport() : new StdioServerTransport();
    await server.connect(transport as any);
    
    logger.markMCPConnected();
    
  } catch (error) {
    logger.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

main().catch(err => {
  logger.error("Fatal server error", err);
  process.exit(1);
});
