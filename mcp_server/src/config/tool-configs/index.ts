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
import { templateTools } from "./templates.js";
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
  ...templateTools,
  ...visualizationTools,
  ...changelogTools,
  // ...timeTrackingTools, // Disabled - needs refactoring
  ...chartTools
];

/**
 * AI-powered tools that require VS Code sampling support
 */
export const AI_POWERED_TOOLS = [
  'analyze-workload',
  'query-wiql', // Unified: supports AI generation when 'description' parameter is used
  'query-odata', // Unified: supports AI generation when 'description' parameter is used
  'discover-tools',
  'analyze-query-handle'
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
  templateTools,
  visualizationTools,
  changelogTools,
  // timeTrackingTools, // Disabled - needs refactoring
  chartTools
};
