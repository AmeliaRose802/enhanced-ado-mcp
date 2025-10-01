import type { ToolExecutionResult } from "../types/index.js";
import { toolConfigs } from "../config/tool-configs.js";
import { executeScript } from "../utils/script-executor.js";
import { logger } from "../utils/logger.js";
import { SamplingService } from "./sampling-service.js";
import { handleGetConfiguration } from "./handlers/get-configuration.handler.js";
import { handleCreateNewItem } from "./handlers/create-new-item.handler.js";
import { handleWiqlQuery } from "./handlers/wiql-query.handler.js";

// Global server instance for sampling service
let serverInstance: any = null;

/**
 * Set the server instance for sampling capabilities
 */
export function setServerInstance(server: any) {
  serverInstance = server;
}

/**
 * Execute a tool by name with the given arguments
 */
export async function executeTool(name: string, args: any): Promise<ToolExecutionResult> {
  let config = toolConfigs.find(t => t.name === name);
  if (!config && name.startsWith('enhanced-ado-msp-')) {
    const legacy = 'wit-' + name.replace('enhanced-ado-msp-', '');
    config = toolConfigs.find(t => t.name === legacy);
  }
  if (!config) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Get configuration information
  if (name === 'wit-get-configuration') {
    return await handleGetConfiguration(args);
  }




  // AI-powered intelligence analysis (uses sampling if available)
  if (name === 'wit-intelligence-analyzer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeWorkItem(args);
  }

  // Enhanced AI assignment analysis (uses sampling if available)
  if (name === 'wit-ai-assignment-analyzer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeAIAssignment(args);
  }

  // Feature decomposition with intelligent breakdown (uses sampling if available)
  if (name === 'wit-feature-decomposer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.decomposeFeature(args);
  }

  // Hierarchy validation with intelligent parenting suggestions (uses sampling if available)
  if (name === 'wit-hierarchy-validator') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.validateHierarchy(args);
  }

  // Create work item using REST API (TypeScript implementation)
  if (name === 'wit-create-new-item') {
    return await handleCreateNewItem(config, args);
  }

  // Query work items using WIQL (Work Item Query Language)
  if (name === 'wit-get-work-items-by-query-wiql') {
    return await handleWiqlQuery(config, args);
  }

  logger.debug(`Executing tool '${name}' with args: ${JSON.stringify(args)}`);
  
  const parsed = config.schema.safeParse(args || {});
  if (!parsed.success) {
    throw new Error(`Validation error: ${parsed.error.message}`);
  }

  const result = await executeScript(name, config.script, parsed.data);
  logger.debug(`Tool '${name}' completed (success=${result.success}).`);
  
  return result;
}

/**
 * Get tool configuration by name
 */
export function getToolConfig(name: string) {
  return toolConfigs.find(t => t.name === name);
}

/**
 * Get all available tools
 */
export function getAllTools() {
  return toolConfigs;
}