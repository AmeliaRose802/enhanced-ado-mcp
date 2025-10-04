import type { ToolExecutionResult } from "../types/index.js";
import type { MCPServer } from "../types/mcp.js";
import { toolConfigs, isAIPoweredTool } from "../config/tool-configs.js";
import { logger } from "../utils/logger.js";
import { checkSamplingSupport } from "../utils/sampling-client.js";
import { SamplingService } from "./sampling-service.js";
import { handleGetConfiguration } from "./handlers/get-configuration.handler.js";
import { handleCreateNewItem } from "./handlers/create-new-item.handler.js";
import { handleWiqlQuery } from "./handlers/wiql-query.handler.js";
import { handleODataAnalytics } from "./handlers/odata-analytics.handler.js";
import { handleGetWorkItemContextPackage } from './handlers/get-work-item-context-package.handler.js';
import { handleGetWorkItemsContextBatch } from './handlers/get-work-items-context-batch.handler.js';
import { handleAssignToCopilot } from './handlers/assign-to-copilot.handler.js';
import { handleNewCopilotItem } from './handlers/new-copilot-item.handler.js';
import { handleExtractSecurityLinks } from './handlers/extract-security-links.handler.js';
import { handleBulkAddComments } from './handlers/bulk-add-comments.handler.js';
import { handleDetectPatterns } from './handlers/detect-patterns.handler.js';
import { handleValidateHierarchy } from './handlers/validate-hierarchy.handler.js';
import { handleBulkCommentByQueryHandle } from './handlers/bulk-comment-by-query-handle.handler.js';
import { handleBulkUpdateByQueryHandle } from './handlers/bulk-update-by-query-handle.handler.js';
import { handleBulkAssignByQueryHandle } from './handlers/bulk-assign-by-query-handle.handler.js';
import { handleBulkRemoveByQueryHandle } from './handlers/bulk-remove-by-query-handle.handler.js';

// Global server instance for sampling service
let serverInstance: MCPServer | null = null;

/**
 * Set the server instance for sampling capabilities
 * Accepts MCPServer or any mock for testing (use 'any' for test mocks to avoid complex type gymnastics)
 */
export function setServerInstance(server: MCPServer | null | any): void {
  serverInstance = server;
}

/**
 * Execute a tool by name with the given arguments
 */
export async function executeTool(name: string, args: unknown): Promise<ToolExecutionResult> {
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
    return await samplingService.analyzeWorkItem(args as Parameters<typeof samplingService.analyzeWorkItem>[0]);
  }

  // Enhanced AI assignment analysis (uses sampling if available)
  if (name === 'wit-ai-assignment-analyzer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeAIAssignment(args as Parameters<typeof samplingService.analyzeAIAssignment>[0]);
  }

  // Create work item using REST API (TypeScript implementation)
  if (name === 'wit-create-new-item') {
    return await handleCreateNewItem(config, args);
  }

  // Query work items using WIQL (Work Item Query Language)
  if (name === 'wit-get-work-items-by-query-wiql') {
    return await handleWiqlQuery(config, args);
  }

  // Query Analytics using OData for aggregations and metrics
  if (name === 'wit-query-analytics-odata') {
    return await handleODataAnalytics(config, args);
  }

  // Full context package (single work item)
  if (name === 'wit-get-work-item-context-package') {
    return await handleGetWorkItemContextPackage(args as Parameters<typeof handleGetWorkItemContextPackage>[0]);
  }

  // Batch context package (graph of work items)
  if (name === 'wit-get-work-items-context-batch') {
    return await handleGetWorkItemsContextBatch(args as Parameters<typeof handleGetWorkItemsContextBatch>[0]);
  }

  // Get last substantive change for a work item
  if (name === 'wit-get-last-substantive-change') {
    const { getLastSubstantiveChange } = await import('./handlers/get-last-substantive-change.handler.js');
    const result = await getLastSubstantiveChange(args as Parameters<typeof getLastSubstantiveChange>[0]);
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

  // Bulk operations using query handles (eliminates ID hallucination)
  if (name === 'wit-bulk-comment-by-query-handle') {
    return await handleBulkCommentByQueryHandle(config, args);
  }

  if (name === 'wit-bulk-update-by-query-handle') {
    return await handleBulkUpdateByQueryHandle(config, args);
  }

  if (name === 'wit-bulk-assign-by-query-handle') {
    return await handleBulkAssignByQueryHandle(config, args);
  }

  if (name === 'wit-bulk-remove-by-query-handle') {
    return await handleBulkRemoveByQueryHandle(config, args);
  }

  // All tools should be handled by the cases above
  // PowerShell script execution has been fully deprecated
  logger.error(`Tool '${name}' reached fallback handler. This tool is not properly registered.`);
  throw new Error(`Tool '${name}' is not properly registered. PowerShell script execution has been deprecated - all tools must be handled via TypeScript handlers.`);
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