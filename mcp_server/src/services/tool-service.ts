import type { ToolExecutionResult } from "../types/index.js";
import { toolConfigs, isAIPoweredTool } from "../config/tool-configs.js";
import { executeScript } from "../utils/script-executor.js";
import { logger } from "../utils/logger.js";
import { checkSamplingSupport } from "../utils/sampling-client.js";
import { SamplingService } from "./sampling-service.js";
import { handleGetConfiguration } from "./handlers/get-configuration.handler.js";
import { handleCreateNewItem } from "./handlers/create-new-item.handler.js";
import { handleWiqlQuery } from "./handlers/wiql-query.handler.js";
import { handleGetWorkItemContextPackage } from './handlers/get-work-item-context-package.handler.js';
import { handleGetWorkItemsContextBatch } from './handlers/get-work-items-context-batch.handler.js';
import { handleAssignToCopilot } from './handlers/assign-to-copilot.handler.js';
import { handleNewCopilotItem } from './handlers/new-copilot-item.handler.js';
import { handleExtractSecurityLinks } from './handlers/extract-security-links.handler.js';
import { handleBulkAddComments } from './handlers/bulk-add-comments.handler.js';
import { handleDetectPatterns } from './handlers/detect-patterns.handler.js';
import { handleValidateHierarchy } from './handlers/validate-hierarchy.handler.js';

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
  
  if (!config) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Check if this is an AI-powered tool and sampling is available
  if (isAIPoweredTool(name)) {
    if (!serverInstance) {
      throw new Error(`Tool '${name}' requires sampling support but no server instance is available. This tool uses AI-powered analysis and requires VS Code language model access.`);
    }
    
    const hasSampling = checkSamplingSupport(serverInstance);
    if (!hasSampling) {
      throw new Error(`Tool '${name}' requires sampling support. This tool uses AI-powered analysis via VS Code's language model API. Please ensure you are using this MCP server within VS Code with language model access enabled, or use alternative non-AI tools for your task.`);
    }
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

  // Create work item using REST API (TypeScript implementation)
  if (name === 'wit-create-new-item') {
    return await handleCreateNewItem(config, args);
  }

  // Query work items using WIQL (Work Item Query Language)
  if (name === 'wit-get-work-items-by-query-wiql') {
    return await handleWiqlQuery(config, args);
  }

  // Full context package (single work item)
  if (name === 'wit-get-work-item-context-package') {
    return await handleGetWorkItemContextPackage(args);
  }

  // Batch context package (graph of work items)
  if (name === 'wit-get-work-items-context-batch') {
    return await handleGetWorkItemsContextBatch(args);
  }

  // Get last substantive change for a work item
  if (name === 'wit-get-last-substantive-change') {
    const { getLastSubstantiveChange } = await import('./handlers/get-last-substantive-change.handler.js');
    const result = await getLastSubstantiveChange(args);
    return { 
      success: true, 
      data: result, 
      metadata: { tool: name },
      errors: [],
      warnings: []
    };
  }

  // Assign work item to GitHub Copilot with branch link
  if (name === 'wit-assign-to-copilot') {
    return await handleAssignToCopilot(config, args);
  }

  // Create work item and immediately assign to GitHub Copilot
  if (name === 'wit-new-copilot-item') {
    return await handleNewCopilotItem(config, args);
  }

  // Extract security instruction links from work item
  if (name === 'wit-extract-security-links') {
    return await handleExtractSecurityLinks(config, args);
  }

  // Bulk add comments to multiple work items
  if (name === 'wit-bulk-add-comments') {
    return await handleBulkAddComments(config, args);
  }

  // Detect common patterns and issues
  if (name === 'wit-detect-patterns') {
    return await handleDetectPatterns(config, args);
  }

  // Fast hierarchy validation (types and states)
  if (name === 'wit-validate-hierarchy-fast') {
    return await handleValidateHierarchy(config, args);
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