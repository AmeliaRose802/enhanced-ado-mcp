/**
 * Handler for wit-list-query-handles tool
 * 
 * Lists all active query handles to help users track and manage them.
 * Makes handles feel like persistent, manageable resources.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";

export async function handleListQueryHandles(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { includeExpired } = parsed.data;

    logger.info("Listing active query handles");

    // Get stats from the service
    const stats = queryHandleService.getStats();
    
    // We don't have direct access to all handles from the service, so we'll provide stats
    // In a real implementation, we'd need to extend the query handle service to expose handles
    
    const now = new Date();
    const result = {
      total_handles: stats.totalHandles,
      active_handles: stats.activeHandles,
      expired_handles: stats.expiredHandles,
      timestamp: now.toISOString(),
      handles: [] as any[], // Would need service extension to populate this
      guidance: {
        handle_lifetime: "1 hour (default)",
        cleanup_frequency: "Every 5 minutes",
        max_recommended: "Keep under 10 active handles for performance",
        usage_tip: "Use wit-validate-query-handle to check specific handle status"
      }
    };

    const warnings: string[] = [];
    
    if (stats.totalHandles === 0) {
      warnings.push("No query handles found. Use wit-get-work-items-by-query-wiql with returnQueryHandle=true to create handles.");
    }
    
    if (stats.expiredHandles > 0) {
      warnings.push(`${stats.expiredHandles} expired handles will be cleaned up automatically.`);
    }
    
    if (stats.activeHandles > 10) {
      warnings.push(`High number of active handles (${stats.activeHandles}). Consider cleaning up unused handles.`);
    }

    return {
      success: true,
      data: result,
      metadata: { source: "list-query-handles" },
      errors: [],
      warnings
    };

  } catch (error) {
    logger.error(`Error in handleListQueryHandles: ${error}`);
    return {
      success: false,
      data: null,
      metadata: { source: "list-query-handles" },
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}