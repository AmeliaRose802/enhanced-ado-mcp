import type { ToolConfig, Tool } from "../../types/index.js";
import { workItemCreationTools } from "./work-item-creation.js";
import { workItemContextTools } from "./work-item-context.js";
import { queryTools } from "./query-tools.js";
import { bulkOperationsTools } from "./bulk-operations.js";
import { aiEnhancementTools } from "./ai-enhancement.js";
import { aiAnalysisTools } from "./ai-analysis.js";
import { queryHandleTools } from "./query-handle.js";
import { discoveryTools } from "./discovery.js";
import { reposTools } from "./repos.js";
import { visualizationTools } from "./visualization.js";
import { changelogTools } from "./changelog.js";
// TODO: Fix time-tracking tools - they don't match ToolConfig interface
// import { timeTrackingTools } from "./time-tracking.js";
import { chartTools } from "./charts.js";

/**
 * Unified tool configuration registry
 * Combines all tool categories into a single array
 */
export const toolConfigs: ToolConfig[] = [
  ...workItemCreationTools,
  ...workItemContextTools,
  ...queryTools,
  ...bulkOperationsTools,
  ...aiEnhancementTools,
  ...aiAnalysisTools,
  ...queryHandleTools,
  ...discoveryTools,
  ...reposTools,
  ...visualizationTools,
  ...changelogTools,
  // ...timeTrackingTools, // Disabled - needs refactoring
  ...chartTools
];

/**
 * AI-powered tools that require VS Code sampling support
 * 
 * Tools that use LLM sampling via VS Code Language Model API
 * These tools gracefully degrade when sampling is not available
 * 
 * Core AI Analysis:
 * - analyze-workload: Personal/batch workload burnout analysis
 * - analyze-query-handle: Custom AI-powered intent-based analysis
 * - discover-tools: Natural language tool discovery
 * 
 * Query Generation (Conditional):
 * - query-wiql: AI generation when 'description' parameter provided
 * - query-odata: AI generation when 'description' parameter provided
 * 
 * Bulk Operations (Conditional):
 * - execute-bulk-operations: AI enhancements when action is:
 *   - 'enhance-descriptions'
 *   - 'assign-story-points'  
 *   - 'add-acceptance-criteria'
 * 
 * Analysis Tools (Optional Sampling):
 * - analyze-bulk: AI-semantic clustering when clusteringMethod='ai-semantic'
 * 
 * Other AI Tools:
 * - get-pr-comments: AI-powered analysis when enrichWithAI=true
 * - find-intelligent-parent: AI-powered parent suggestion
 */
export const AI_POWERED_TOOLS = [
  'analyze-workload',
  'analyze-query-handle',
  'discover-tools',
  // Conditional AI tools (check parameters at runtime):
  'query-wiql',       // When description parameter is provided
  'query-odata',      // When description parameter is provided  
  'execute-bulk-operations', // When action is enhance-descriptions/assign-story-points/add-acceptance-criteria
  'analyze-bulk',     // When clusteringMethod is 'ai-semantic'
  'get-pr-comments',  // When enrichWithAI is true
  'find-intelligent-parent' // Always requires sampling
];

/**
 * Check if a tool requires sampling support
 */
export function isAIPoweredTool(toolName: string): boolean {
  return AI_POWERED_TOOLS.includes(toolName);
}

/**
 * Filter tool configs based on sampling availability and debug mode
 * @param hasSampling Whether sampling is supported
 * @param enableDebugTools Whether debug tools should be enabled (default: false)
 * @returns Filtered tool configurations
 */
export function getAvailableToolConfigs(hasSampling: boolean, enableDebugTools: boolean = false): ToolConfig[] {
  let available = toolConfigs;
  
  // Filter out AI-powered tools when sampling not available
  if (!hasSampling) {
    available = available.filter(tool => !isAIPoweredTool(tool.name));
  }
  
  // Filter out debug-only tools unless explicitly enabled
  if (!enableDebugTools) {
    available = available.filter(tool => tool.name !== 'get-prompts');
  }
  
  return available;
}

/**
 * Export as Tool[] for MCP listing
 */
export const tools: Tool[] = toolConfigs.map(tc => ({
  name: tc.name,
  description: tc.description,
  inputSchema: tc.inputSchema as Tool['inputSchema']
}));

// Re-export individual categories for selective imports if needed
export {
  workItemCreationTools,
  workItemContextTools,
  queryTools,
  bulkOperationsTools,
  aiEnhancementTools,
  aiAnalysisTools,
  queryHandleTools,
  discoveryTools,
  reposTools,
  visualizationTools,
  changelogTools,
  // timeTrackingTools, // Disabled - needs refactoring
  chartTools
};
