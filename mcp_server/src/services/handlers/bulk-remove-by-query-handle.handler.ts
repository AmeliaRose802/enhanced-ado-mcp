/**
 * Handler for wit-bulk-remove-by-query-handle tool
 * 
 * Removes (deletes) multiple work items identified by a query handle.
 * Optionally adds a comment with removal reason before deletion.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../utils/response-builder.js";
import { logger } from "../../utils/logger.js";
import { queryHandleService } from "../query-handle-service.js";
import { ADOHttpClient } from "../../utils/ado-http-client.js";
import { loadConfiguration } from "../../config/config.js";

export async function handleBulkRemoveByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, removeReason, dryRun, organization, project } = parsed.data;

    // Retrieve work item IDs from query handle
    const workItemIds = queryHandleService.getWorkItemIds(queryHandle);
    
    if (!workItemIds) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-remove-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    logger.info(`Bulk remove operation: ${workItemIds.length} work items (dry_run: ${dryRun})`);

    if (dryRun) {
      return {
        success: true,
        data: {
          dry_run: true,
          query_handle: queryHandle,
          work_item_ids: workItemIds,
          remove_reason: removeReason,
          summary: `DRY RUN: Would remove ${workItemIds.length} work item(s)${removeReason ? ' with reason comment' : ''}`
        },
        metadata: { 
          source: "bulk-remove-by-query-handle",
          dryRun: true,
          count: workItemIds.length
        },
        errors: [],
        warnings: ['⚠️ DESTRUCTIVE OPERATION: Work items will be permanently deleted']
      };
    }

    // Execute bulk remove operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: Array<{ workItemId: number; success: boolean; error?: string; commentAdded?: boolean }> = [];

    for (const workItemId of workItemIds) {
      try {
        // Add comment with reason if provided
        let commentAdded = false;
        if (removeReason) {
          try {
            const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
            await httpClient.post(commentUrl, {
              text: `🗑️ **Removal Reason:** ${removeReason}`
            });
            commentAdded = true;
            logger.debug(`Added removal reason comment to work item ${workItemId}`);
          } catch (commentError) {
            logger.warn(`Failed to add comment to work item ${workItemId}, proceeding with deletion:`, commentError);
          }
        }

        // Delete the work item
        const deleteUrl = `wit/workItems/${workItemId}?api-version=7.1`;
        await httpClient.delete(deleteUrl);

        results.push({ workItemId, success: true, commentAdded });
        logger.debug(`Removed work item ${workItemId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to remove work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const commentsAdded = results.filter(r => r.commentAdded).length;

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        total_work_items: workItemIds.length,
        successful: successCount,
        failed: failureCount,
        comments_added: removeReason ? commentsAdded : undefined,
        results,
        summary: `Successfully removed ${successCount} of ${workItemIds.length} work item(s)${failureCount > 0 ? ` (${failureCount} failed)` : ''}${removeReason && commentsAdded > 0 ? ` with reason comments on ${commentsAdded} items` : ''}`
      },
      metadata: {
        source: "bulk-remove-by-query-handle",
        totalWorkItems: workItemIds.length,
        successful: successCount,
        failed: failureCount
      },
      errors: failureCount > 0 
        ? results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: ['⚠️ DESTRUCTIVE OPERATION COMPLETED: Work items have been permanently deleted']
    };
  } catch (error) {
    logger.error('Bulk remove by query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-remove-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
