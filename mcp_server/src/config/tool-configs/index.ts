import type { ToolConfig, Tool } from "../../types/index.js";
import { workItemCreationTools } from "./work-item-creation.js";
import { workItemContextTools } from "./work-item-context.js";
import { queryTools } from "./query-tools.js";
import { bulkOperationsTools } from "./bulk-operations.js";
import { aiEnhancementTools } from "./ai-enhancement.js";
import { aiAnalysisTools } from "./ai-analysis.js";
import { queryHandleTools } from "./query-handle.js";
import { discoveryTools } from "./discovery.js";

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
  ...discoveryTools
];

/**
 * AI-powered tools that require VS Code sampling support
 */
export const AI_POWERED_TOOLS = [
  'wit-intelligence-analyzer',
  'wit-ai-assignment-analyzer',
  'wit-personal-workload-analyzer',
  'wit-sprint-planning-analyzer',
  'wit-bulk-enhance-descriptions-by-query-handle',
  'wit-bulk-assign-story-points-by-query-handle',
  'wit-bulk-add-acceptance-criteria-by-query-handle',
  'wit-generate-wiql-query',
  'wit-generate-odata-query',
  'wit-generate-query',
  'wit-discover-tools'
];

/**
 * Check if a tool requires sampling support
 */
export function isAIPoweredTool(toolName: string): boolean {
  return AI_POWERED_TOOLS.includes(toolName);
}

/**
 * Filter tool configs based on sampling availability
 * @param hasSampling Whether sampling is supported
 * @returns Filtered tool configurations
 */
export function getAvailableToolConfigs(hasSampling: boolean): ToolConfig[] {
  if (hasSampling) {
    return toolConfigs; // All tools available
  }
  
  // Filter out AI-powered tools when sampling not available
  return toolConfigs.filter(tool => !isAIPoweredTool(tool.name));
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
  discoveryTools
};
