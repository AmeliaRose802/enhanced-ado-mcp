/**
 * Handler for find-similar-work-items tool
 * 
 * Performs AI-powered similarity detection using semantic embeddings to find:
 * - Duplicate work items (>90% similarity)
 * - Related work items (60-90% similarity)
 * - Topic clusters
 * - Suggested links
 */

import { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { validateAzureCLI } from "@/utils/azure-cli-validator.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { SimilarityService } from "@/services/similarity-service.js";
import type { MCPServer, MCPServerLike } from "@/types/mcp.js";

// Global similarity service instance
let similarityServiceInstance: SimilarityService | null = null;

/**
 * Initialize the similarity service with server instance
 */
export function initializeSimilarityService(server: MCPServer | MCPServerLike): void {
  similarityServiceInstance = new SimilarityService(server);
}

/**
 * Handler for find-similar-work-items tool
 * 
 * Uses AI-generated embeddings to find semantically similar work items based on
 * titles, descriptions, and acceptance criteria. Helps identify duplicates,
 * discover related work, cluster by topic, and suggest relationship links.
 * 
 * Features:
 * - Duplicate detection: >90% similarity
 * - Related items: 60-90% similarity
 * - Topic clustering: Groups similar items by theme
 * - Smart link suggestions: Recommends appropriate link types
 * - Persistent caching: Avoids regenerating embeddings
 * - Efficient comparison: Cosine similarity on embedding vectors
 * 
 * @param config - Tool configuration containing the Zod schema for validation
 * @param args - Arguments object expected to contain:
 *   - workItemId?: number - Single work item to find similar items for
 *   - queryHandle?: string - Query handle containing work items to analyze
 *   - similarityThreshold?: number - Min similarity (0-1, default 0.6)
 *   - maxResults?: number - Max similar items per source (default 20, max 100)
 *   - includeEmbeddings?: boolean - Include vectors in response (default false)
 *   - skipCache?: boolean - Regenerate embeddings (default false)
 *   - analysisType?: 'duplicates'|'related'|'cluster'|'all' - Analysis type (default 'all')
 *   - organization?: string - Azure DevOps organization (defaults to config)
 *   - project?: string - Azure DevOps project (defaults to config)
 * 
 * @returns Promise<ToolExecutionResult> with similarity analysis results
 * 
 * @throws {Error} Returns error result if:
 *   - Azure CLI not available or not logged in
 *   - Neither workItemId nor queryHandle provided
 *   - Query handle invalid, not found, or expired
 *   - VS Code sampling support not available
 *   - Embedding generation fails
 * 
 * @example
 * ```typescript
 * // Find duplicates of a specific work item
 * const result = await handleSimilarityDetection(config, {
 *   workItemId: 12345,
 *   analysisType: 'duplicates',
 *   similarityThreshold: 0.9
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Find related items for all items in a query
 * const result = await handleSimilarityDetection(config, {
 *   queryHandle: 'qh_abc123',
 *   analysisType: 'related',
 *   similarityThreshold: 0.7,
 *   maxResults: 10
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Cluster items by topic
 * const result = await handleSimilarityDetection(config, {
 *   queryHandle: 'qh_abc123',
 *   analysisType: 'cluster'
 * });
 * ```
 * 
 * @since 1.7.0
 */
export async function handleSimilarityDetection(
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

    // Check if similarity service is initialized
    if (!similarityServiceInstance) {
      return {
        success: false,
        data: null,
        metadata: { source: "similarity-detection" },
        errors: [
          "Similarity service not initialized. This tool requires VS Code sampling support."
        ],
        warnings: []
      };
    }

    logger.info(`Starting similarity detection with threshold: ${parsed.data.similarityThreshold || 0.6}`);

    // Perform similarity detection
    return await similarityServiceInstance.findSimilar(parsed.data);

  } catch (error) {
    logger.error(`Error in handleSimilarityDetection: ${error}`);
    return {
      success: false,
      data: null,
      metadata: { source: "similarity-detection" },
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}
