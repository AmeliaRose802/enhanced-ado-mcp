import { ToolExecutionResult, asToolData } from "../types/index.js";
import type { MCPServer, MCPServerLike } from "../types/mcp.js";
import { toolConfigs, isAIPoweredTool } from "../config/tool-configs/index.js";
import { logger } from "../utils/logger.js";
import { checkSamplingSupport } from "../utils/sampling-client.js";
import { SamplingService } from "./sampling-service.js";
import { metricsService } from "./metrics-service.js";
// Core handlers
import { handleGetConfiguration } from "./handlers/core/get-configuration.handler.js";
import { handleCreateNewItem } from "./handlers/core/create-new-item.handler.js";
import { handleCloneWorkItem } from './handlers/core/clone-work-item.handler.js';
import { handleGetPrompts } from './handlers/core/get-prompts.handler.js';
import { handleListSubagents } from './handlers/core/list-subagents.handler.js';

// Query handlers
import { handleWiqlQuery } from "./handlers/query/wiql-query.handler.js";

// Query handle handlers
import { handleListQueryHandles } from './handlers/query-handles/list-query-handles.handler.js';
import { handleQueryHandleInfo } from './handlers/query-handles/query-handle-info-handler.js';

// Bulk operation handlers
import { handleBulkLinkByQueryHandles } from './handlers/bulk-operations/bulk-link-handler.js';
import { handleUnifiedBulkOperations } from './handlers/bulk-operations/unified-bulk-operations.handler.js';

// AI-powered handlers
import { handleAnalyzeByQueryHandle } from './handlers/ai-powered/analyze-by-query-handle.handler.js';
import { handleAIQueryAnalysis, initializeAIQueryAnalyzer } from './handlers/ai-powered/ai-query-analysis.handler.js';
// NOTE: AI enhancement handlers (enhance-descriptions, assign-story-points, add-acceptance-criteria)
// are now consolidated into unified-bulk-operations.handler.ts

// Analysis handlers
import { handleExtractSecurityLinks } from './handlers/analysis/extract-security-links.handler.js';
import { handleIntelligentParentFinder } from './handlers/analysis/intelligent-parent-finder.handler.js';

// Integration handlers
import { handleAssignToCopilot } from './handlers/integration/assign-to-copilot.handler.js';


  // Context handlers
import { handleGetWorkItemContextPackage } from './handlers/context/get-work-item-context-package.handler.js';
import { handleGetContextPackagesByQueryHandle } from './handlers/context/get-context-packages-by-query-handle.handler.js';// Global server instance for sampling service
let serverInstance: MCPServer | MCPServerLike | null = null;

/**
 * Set the server instance for sampling capabilities
 * Accepts MCPServer or MCPServerLike mock for testing
 */
export function setServerInstance(server: MCPServer | MCPServerLike | null): void {
  serverInstance = server;
  
  // Initialize AI query analyzer if server is available
  if (server) {
    initializeAIQueryAnalyzer(server);
  }
}

/**
 * Execute a tool by name with the given arguments
 */
export async function executeTool(name: string, args: unknown): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  metricsService.increment('tool.execution.started', 1, { tool: name });
  
  try {
    const result = await executeToolInternal(name, args);
    
    // Record successful execution metrics
    const duration = Date.now() - startTime;
    metricsService.recordDuration('tool.execution.duration', duration, { tool: name, success: String(result.success) });
    metricsService.increment(result.success ? 'tool.execution.success' : 'tool.execution.error', 1, { tool: name });
    
    return result;
  } catch (error) {
    // Record error metrics
    const duration = Date.now() - startTime;
    metricsService.recordDuration('tool.execution.duration', duration, { tool: name, success: 'false' });
    metricsService.increment('tool.execution.error', 1, { tool: name, error: 'exception' });
    throw error;
  }
}

/**
 * Internal tool execution logic (without metrics tracking)
 */
async function executeToolInternal(name: string, args: unknown): Promise<ToolExecutionResult> {
  const config = toolConfigs.find(t => t.name === name);
  
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
  if (name === 'get-config') {
    return await handleGetConfiguration(args);
  }

  // Get prompts (useful for testing and specialized agent workflows)
  // Only available when MCP_ENABLE_DEBUG_TOOLS=1
  if (name === 'get-prompts') {
    const { loadConfiguration } = await import('../config/config.js');
    const config = loadConfiguration();
    
    if (!config.enableDebugTools) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'get-prompts',
          timestamp: new Date().toISOString()
        },
        errors: [
          'get-prompts tool is only available in debug mode.',
          'Set environment variable MCP_ENABLE_DEBUG_TOOLS=1 to enable debug tools.',
          'This tool is disabled in production for security reasons.'
        ],
        warnings: []
      };
    }
    
    return await handleGetPrompts(args as Parameters<typeof handleGetPrompts>[0]);
  }

  // List available subagents in a repository
  if (name === 'list-agents') {
    return await handleListSubagents(args);
  }



  // Personal workload analysis (uses sampling if available)
  if (name === 'analyze-workload') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzePersonalWorkload(args as Parameters<typeof samplingService.analyzePersonalWorkload>[0]);
  }

  // Sprint planning analysis (uses sampling if available)
  if (name === 'plan-sprint') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeSprintPlanning(args as Parameters<typeof samplingService.analyzeSprintPlanning>[0]);
  }

  // AI-powered tool discovery (uses sampling if available)
  if (name === 'discover-tools') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.discoverTools(args as Parameters<typeof samplingService.discoverTools>[0]);
  }

  // Create work item using REST API (TypeScript implementation)
  if (name === 'create-workitem') {
    return await handleCreateNewItem(config, args);
  }

  // Clone work item
  if (name === 'clone-workitem') {
    return await handleCloneWorkItem(config, args);
  }

  // Unified WIQL query tool (supports both direct query and AI generation)
  if (name === 'query-wiql') {
    return await handleWiqlQuery(config, args, serverInstance ?? undefined);
  }

  // OData query tool (supports both AI generation and direct execution)
  if (name === 'query-odata') {
    const { handleODataQuery } = await import('./handlers/query/odata-query.handler.js');
    return await handleODataQuery(config, args, serverInstance ?? undefined);
  }

  // Full context package (single work item)
  if (name === 'get-context') {
    return await handleGetWorkItemContextPackage(args as Parameters<typeof handleGetWorkItemContextPackage>[0]);
  }

  // Assign work item to GitHub Copilot with branch link
  if (name === 'assign-copilot') {
    return await handleAssignToCopilot(config, args);
  }

  // Extract security instruction links from work item
  if (name === 'extract-security-links') {
    return await handleExtractSecurityLinks(config, args);
  }



  // Bulk operations using query handles (eliminates ID hallucination)
  if (name === 'execute-bulk-operations') {
    return await handleUnifiedBulkOperations(config, args, serverInstance || undefined);
  }

  // Link work items using query handles
  if (name === 'link-workitems') {
    return await handleBulkLinkByQueryHandles(config, args);
  }

  // Undo last bulk operation on query handle
  if (name === 'undo-bulk') {
    const { handleBulkUndoByQueryHandle } = await import('./handlers/bulk-operations/bulk-undo-by-query-handle.handler.js');
    return await handleBulkUndoByQueryHandle(config, args);
  }

  if (name === 'undo-forensic') {
    const { handleForensicUndoByQueryHandle } = await import('./handlers/bulk-operations/forensic-undo-by-query-handle.handler.js');
    return await handleForensicUndoByQueryHandle(config, args);
  }

  if (name === 'analyze-bulk') {
    return await handleAnalyzeByQueryHandle(config, args, serverInstance ?? undefined);
  }

  if (name === 'analyze-query-handle') {
    return await handleAIQueryAnalysis(config, args);
  }

  if (name === 'list-handles') {
    return await handleListQueryHandles(config, args);
  }

  if (name === 'inspect-handle') {
    return await handleQueryHandleInfo(config, args);
  }

  // Context packages by query handle
  if (name === 'get-context-bulk') {
    return await handleGetContextPackagesByQueryHandle(config, args);
  }

  // NOTE: AI enhancement tools (enhance-descriptions, assign-story-points, add-acceptance-criteria)
  // are now consolidated into execute-bulk-operations as actions

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