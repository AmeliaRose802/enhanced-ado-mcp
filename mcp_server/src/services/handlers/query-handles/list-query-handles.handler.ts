/**
 * Handler for list-handles tool
 * 
 * Lists all active query handles to help users track and manage them.
 * Makes handles feel like persistent, manageable resources.
 */

import type { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { validateAzureCLI } from "../../../utils/azure-cli-validator.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSuccessResponse, buildErrorResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
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

    const { includeExpired, top, skip } = parsed.data;

    logger.info(`Listing query handles (top: ${top}, skip: ${skip}, includeExpired: ${includeExpired})`);

    // Get stats from the service
    const stats = queryHandleService.getStats();
    
    // Get paginated handles with their details
    const result = queryHandleService.getAllHandles(includeExpired, top, skip);
    
    const now = new Date();
    const responseData = {
      total_handles: stats.totalHandles,
      active_handles: stats.activeHandles,
      expired_handles: stats.expiredHandles,
      timestamp: now.toISOString(),
      handles: result.handles,
      pagination: result.pagination,
      guidance: {
        handle_lifetime: "24 hours (default)",
        cleanup_frequency: "Every 5 minutes",
        max_recommended: "Keep under 10 active handles for performance",
        usage_tip: "Use wit-query-handle-info to check specific handle status"
      }
    };

    const warnings: string[] = [];
    
    if (stats.totalHandles === 0) {
      warnings.push("No query handles found. Use query-wiql with returnQueryHandle=true to create handles.");
    }
    
    if (stats.expiredHandles > 0) {
      warnings.push(`${stats.expiredHandles} expired handles will be cleaned up automatically.`);
    }
    
    if (stats.activeHandles > 10) {
      warnings.push(`High number of active handles (${stats.activeHandles}). Consider cleaning up unused handles.`);
    }

    if (result.pagination.hasMore) {
      warnings.push(`Showing ${result.pagination.returned} of ${result.pagination.total} handles. Use skip=${result.pagination.nextSkip} to get the next page.`);
    }

    // Build response with warnings if any
    const response = buildSuccessResponse(
      responseData,
      { 
        source: "list-query-handles",
        pagination: result.pagination
      }
    );
    response.warnings = warnings;
    return response;

  } catch (error) {
    logger.error(`Error in handleListQueryHandles: ${error}`);
    return buildErrorResponse(
      error as Error,
      { source: "list-query-handles" }
    );
  }
}