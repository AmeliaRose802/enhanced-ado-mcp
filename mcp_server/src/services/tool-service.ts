import { ToolExecutionResult, asToolData } from "../types/index.js";
import type { MCPServer, MCPServerLike } from "../types/mcp.js";
import { toolConfigs, isAIPoweredTool } from "../config/tool-configs/index.js";
import { logger, errorToContext } from "../utils/logger.js";
import { checkSamplingSupport } from "../utils/sampling-client.js";
import { SamplingService } from "./sampling-service.js";
import { metricsService } from "./metrics-service.js";
import { telemetryService } from "./telemetry-service.js";
// Core handlers
import { handleGetConfiguration } from "./handlers/core/get-configuration.handler.js";
import { handleCreateNewItem } from "./handlers/core/create-new-item.handler.js";
import { handleGetPrompts } from './handlers/core/get-prompts.handler.js';
import { handleListSubagents } from './handlers/core/list-subagents.handler.js';
import { handleGetTeamMembers } from './handlers/core/get-team-members.handler.js';

// Discovery handlers
import { handleDiscoverCustomFields } from './handlers/discovery/discover-custom-fields.handler.js';
import { handleValidateCustomFields } from './handlers/discovery/validate-custom-fields.handler.js';
import { handleExportFieldSchema } from './handlers/discovery/export-field-schema.handler.js';

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

// Repos handlers
import { handleGetPullRequestDiff } from './handlers/repos/get-pr-diff.handler.js';
import { handleGetPullRequestComments } from './handlers/repos/get-pr-comments.handler.js';

// Visualization handlers
import { handleVisualizeDependencies } from './handlers/visualization/visualize-dependencies.handler.js';

// Chart handlers
import { handleGenerateBurndownChart } from './handlers/charts/generate-burndown-chart.handler.js';
import { handleGenerateBurnupChart } from './handlers/charts/generate-burnup-chart.handler.js';

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
  
  // Initialize AI-powered services if server is available
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
  
  // Track API calls for this tool execution
  const apiCallsBefore = metricsService.getCounter('ado_api_request');
  const cacheHitsBefore = metricsService.getCounter('cache_hit');
  const cacheMissesBefore = metricsService.getCounter('cache_miss');
  
  try {
    const result = await executeToolInternal(name, args);
    
    // Calculate API calls made during this operation
    const apiCallsAfter = metricsService.getCounter('ado_api_request');
    const cacheHitsAfter = metricsService.getCounter('cache_hit');
    const cacheMissesAfter = metricsService.getCounter('cache_miss');
    
    const apiCallsDelta = apiCallsAfter - apiCallsBefore;
    const cacheHitsDelta = cacheHitsAfter - cacheHitsBefore;
    const cacheMissesDelta = cacheMissesAfter - cacheMissesBefore;
    
    // Record metrics
    const duration = Date.now() - startTime;
    metricsService.recordDuration('tool.execution.duration', duration, { tool: name, success: String(result.success) });
    metricsService.increment(result.success ? 'tool.execution.success' : 'tool.execution.error', 1, { tool: name });
    
    // Record telemetry event
    telemetryService.recordToolExecution(
      name,
      duration,
      result.success,
      apiCallsDelta > 0 ? apiCallsDelta : undefined,
      result.success ? undefined : { type: result.errors?.[0] || 'unknown' }
    );
    
    // Add cache info to telemetry metadata if cache was used
    if (cacheHitsDelta > 0 || cacheMissesDelta > 0) {
      telemetryService.recordEvent({
        category: 'tool',
        operation: `${name}_cache_usage`,
        cache_hits: cacheHitsDelta,
        cache_misses: cacheMissesDelta,
        metadata: {
          tool: name,
          cache_hit_rate: (cacheHitsDelta + cacheMissesDelta) > 0 
            ? (cacheHitsDelta / (cacheHitsDelta + cacheMissesDelta)) * 100 
            : 0
        }
      });
    }
    
    return result;
  } catch (error) {
    // Record error metrics and telemetry
    const duration = Date.now() - startTime;
    metricsService.recordDuration('tool.execution.duration', duration, { tool: name, success: 'false' });
    metricsService.increment('tool.execution.error', 1, { tool: name, error: 'exception' });
    
    telemetryService.recordToolExecution(
      name,
      duration,
      false,
      undefined,
      { type: error instanceof Error ? error.name : 'UnknownError' }
    );
    
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

  // Get team members
  if (name === 'get-team-members') {
    return await handleGetTeamMembers(args);
  }

  // Discover custom fields
  if (name === 'discover-custom-fields') {
    return await handleDiscoverCustomFields(args as any);
  }

  // Validate custom fields
  if (name === 'validate-custom-fields') {
    return await handleValidateCustomFields(args as any);
  }

  // Export field schema
  if (name === 'export-field-schema') {
    return await handleExportFieldSchema(args as any);
  }



  // Personal workload analysis (uses sampling if available)
  if (name === 'analyze-workload') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeBatchPersonalWorkload(args as Parameters<typeof samplingService.analyzeBatchPersonalWorkload>[0]);
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

  // Pull request diff
  if (name === 'get-pr-diff') {
    return await handleGetPullRequestDiff(config, args);
  }

  // Pull request comments
  if (name === 'get-pr-comments') {
    return await handleGetPullRequestComments(config, args, serverInstance || undefined);
  }

  // Dependency visualization
  if (name === 'visualize-dependencies') {
    return await handleVisualizeDependencies(args);
  }

  // Generate burndown chart
  if (name === 'generate-burndown-chart') {
    return await handleGenerateBurndownChart(args);
  }

  // Generate burnup chart
  if (name === 'generate-burnup-chart') {
    return await handleGenerateBurnupChart(args);
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