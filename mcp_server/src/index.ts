#!/usr/bin/env node

/**
 * Enhanced ADO MCP Server - Main Entry Point
 * 
 * This is the main server file that sets up the MCP server with modular components.
 * Business logic has been moved to separate modules for better maintainability.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HybridStdioServerTransport } from "./hybridTransport.js";
import { logger } from "./utils/logger.js";
import { tools, getAvailableToolConfigs } from "./config/tool-configs.js";
import { loadPrompts, getPromptContent } from "./services/prompt-service.js";
import { executeTool, setServerInstance } from "./services/tool-service.js";
import { checkSamplingSupport } from "./utils/sampling-client.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadConfiguration, updateConfigFromCLI } from "./config/config.js";

/**
 * MCP Server Setup and Request Handling
 */
const server = new Server({
  name: "enhanced-ado-mcp-server",
  version: "1.2.2"
}, {
  capabilities: {
    tools: {},
    prompts: {},
    sampling: {}
  }
});

// Use fallback request handler with proper error handling
server.fallbackRequestHandler = async (request: any) => {
  logger.debug(`Handling request: ${request.method}`, JSON.stringify(request.params));
  
  if (request.method === "tools/list") {
    // Check sampling support and filter tools accordingly
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
    try {
      const content = await getPromptContent(name, args);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content
            }
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get prompt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  if (request.method === "tools/call") {
    const { name, arguments: args } = request.params || {};
    try {
      const result = await executeTool(name, args);
      logger.debug(`Tool '${name}' completed (success=${result.success}).`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      logger.error(`Tool execution error:`, error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
  
  return {} as any;
};

/**
 * Parse command line arguments
 */
const argv = yargs(hideBin(process.argv))
  .scriptName("enhanced-ado-msp")
  .usage("Usage: $0 <organization> <project> [options]")
  .version("1.2.2")
  .command("$0 <organization> <project> [options]", "Enhanced ADO MCP Server", (yargs) => {
    yargs
      .positional("organization", {
        describe: "Azure DevOps organization name",
        type: "string",
        demandOption: true,
      })
      .positional("project", {
        describe: "Azure DevOps project name",
        type: "string", 
        demandOption: true,
      });
  })
  .option("area-path", {
    alias: "a",
    describe: "Default area path",
    type: "string"
  })
  .option("copilot-guid", {
    alias: "g",
    describe: "GitHub Copilot user GUID (required for Copilot tools)",
    type: "string"
  })
  .option("config", {
    alias: "c",
    describe: "Path to configuration file",
    type: "string"
  })
  .option("verbose", {
    alias: "v",
    describe: "Enable verbose logging",
    type: "boolean",
    default: false
  })
  .help()
  .parseSync();

/**
 * Main server startup function
 */
async function main() {
  try {
    // Always apply CLI configuration (organization and project are required positional args)
    updateConfigFromCLI(argv);

    // Enable verbose logging if requested
    if (argv.verbose) {
      process.env.MCP_DEBUG = '1';
    }

    // Allow opting into hybrid transport to accept both newline and Content-Length framed JSON
    const useHybrid = process.env.MCP_HYBRID === "1";
    
    // Log startup BEFORE connecting to avoid polluting MCP transport
    logger.info(`enhanced-ado-msp MCP server starting (${useHybrid ? "hybrid" : "stdio"})`);
    
    // Inject server instance for sampling capabilities
    setServerInstance(server);
    
    const transport = useHybrid ? new HybridStdioServerTransport() : new StdioServerTransport();
    await server.connect(transport as any);
    
    // Mark MCP as connected - no more stderr logging after this point
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
