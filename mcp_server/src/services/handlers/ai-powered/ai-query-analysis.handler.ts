/**
 * Handler for analyze-query-handle tool
 * 
 * Performs AI-powered intelligent analysis on work items from a query handle
 * using natural language intent.
 */

import { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { validateAzureCLI } from "@/utils/azure-cli-validator.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { AIQueryAnalyzer } from "@/services/analyzers/ai-query-analyzer.js";
import type { MCPServer, MCPServerLike } from "@/types/mcp.js";

// Global server instance
let analyzerInstance: AIQueryAnalyzer | null = null;

/**
 * Initialize the AI query analyzer with server instance
 */
export function initializeAIQueryAnalyzer(server: MCPServer | MCPServerLike): void {
  analyzerInstance = new AIQueryAnalyzer(server);
}

/**
 * Handler for analyze-query-handle tool
 * 
 * Performs custom AI-powered analysis on work items identified by a query handle
 * using natural language intent. Retrieves full context and provides intelligent,
 * concise analysis based on the user's specific request.
 * 
 * This tool is designed for complex analysis that requires intelligence rather than
 * simple deterministic checks. It accepts any analysis intent in natural language
 * and leverages AI to understand context and provide actionable insights.
 * 
 * @param config - Tool configuration containing the Zod schema for validation
 * @param args - Arguments object expected to contain:
 *   - queryHandle: string - Query handle ID from a previous WIQL query
 *   - intent: string - Natural language description of desired analysis
 *   - itemSelector?: 'all' | number[] | object - Which items to analyze (default 'all')
 *   - maxItemsToAnalyze?: number - Max items to analyze (default 50, max 100)
 *   - includeContextPackages?: boolean - Retrieve full context (default true)
 *   - contextDepth?: 'basic'|'standard'|'deep' - Context detail level (default 'standard')
 *   - outputFormat?: 'concise'|'detailed'|'json' - Output format (default 'concise')
 *   - confidenceThreshold?: number - Min confidence for recommendations (default 0.0)
 *   - temperature?: number - AI temperature 0-2 (default 0.3)
 *   - organization?: string - Azure DevOps organization (defaults to config)
 *   - project?: string - Azure DevOps project (defaults to config)
 * 
 * @returns Promise<ToolExecutionResult> with analysis results
 * 
 * @throws {Error} Returns error result if:
 *   - Azure CLI not available or not logged in
 *   - Query handle invalid, not found, or expired
 *   - VS Code sampling support not available
 *   - AI analysis fails or times out
 * 
 * @example
 * ```typescript
 * // Find items ready for deployment
 * const result = await handleAIQueryAnalysis(config, {
 *   queryHandle: 'qh_abc123',
 *   intent: 'find work items that are ready for deployment to production'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Assess technical debt risk with detailed output
 * const result = await handleAIQueryAnalysis(config, {
 *   queryHandle: 'qh_abc123',
 *   intent: 'assess technical debt risk and identify highest priority items to address',
 *   outputFormat: 'detailed',
 *   maxItemsToAnalyze: 30
 * });
 * ```
 * 
 * @since 1.6.0
 */
export async function handleAIQueryAnalysis(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    // Validate Azure CLI
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    // Validate arguments
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    // Check if analyzer is initialized
    if (!analyzerInstance) {
      return {
        success: false,
        data: null,
        metadata: { source: "ai-query-analysis" },
        errors: [
          "AI query analyzer not initialized. This tool requires VS Code sampling support."
        ],
        warnings: []
      };
    }

    logger.info(`Performing AI query analysis: ${parsed.data.intent.substring(0, 100)}...`);

    // Perform analysis
    return await analyzerInstance.analyze(parsed.data);

  } catch (error) {
    logger.error(`Error in handleAIQueryAnalysis: ${error}`);
    return {
      success: false,
      data: null,
      metadata: { source: "ai-query-analysis" },
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}
