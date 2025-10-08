/**
 * Handler for wit-bulk-remove tool
 *
 * Moves multiple work items to "Removed" state (does NOT permanently delete).
 * Sets work item state to "Removed" for items identified by a query handle.
 * Optionally adds a comment with removal reason before state change.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import {
  buildValidationErrorResponse,
  buildAzureCliErrorResponse,
} from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleBulkRemoveByQueryHandle(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const {
      queryHandle,
      removeReason,
      itemSelector,
      dryRun,
      maxPreviewItems,
      organization,
      project,
    } = parsed.data;

    // Retrieve work item IDs from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);

    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-remove-by-query-handle" },
        errors: [
          `Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`,
        ],
        warnings: [],
      };
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    logger.info(`Selected ${selectedCount} of ${totalItems} items for removal`);
    if (itemSelector !== "all") {
      logger.info(`Selection criteria: ${JSON.stringify(itemSelector)}`);
    }
    logger.info(
      `Bulk remove operation: ${selectedCount} of ${totalItems} work items selected (dry_run: ${dryRun})`
    );

    if (dryRun) {
      // Show preview of selected items for destructive operation
      const previewLimit = maxPreviewItems || 5;
      const dryRunInfo = {
        totalInHandle: totalItems,
        selectedForRemoval: selectedCount,
        selectionCriteria: itemSelector === "all" ? "All items" : JSON.stringify(itemSelector),
        itemsToRemove: selectedWorkItemIds.slice(0, previewLimit).map((id: number) => {
          const context = queryData.itemContext.find((item) => item.id === id);
          return {
            id: id,
            title: context?.title || "No title available",
            state: context?.state || "Unknown",
            type: context?.type || "Unknown",
          };
        }),
      };

      const previewMessage =
        selectedCount > previewLimit
          ? `Showing ${previewLimit} of ${selectedCount} items...`
          : undefined;

      return {
        success: true,
        data: asToolData({
          dry_run: true,
          query_handle: queryHandle,
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          item_selector: itemSelector,
          work_item_ids: selectedWorkItemIds,
          remove_reason: removeReason,
          preview_items: dryRunInfo.itemsToRemove,
          preview_message: previewMessage,
          summary: `DRY RUN - Would remove ${selectedCount} items:\n${JSON.stringify(dryRunInfo, null, 2)}`,
        }),
        metadata: {
          source: "bulk-remove-by-query-handle",
          dryRun: true,
          itemSelector,
        },
        errors: [],
        warnings: [
          '⚠️ State Change: Work items will be moved to "Removed" state (not permanently deleted)',
        ],
      };
    }

    // Execute bulk remove operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: Array<{
      workItemId: number;
      success: boolean;
      error?: string;
      commentAdded?: boolean;
    }> = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        // Add comment with reason if provided
        let commentAdded = false;
        if (removeReason) {
          try {
            const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
            await httpClient.post(commentUrl, {
              text: `🗑️ **Removal Reason:** ${removeReason}`,
              format: 1, // 1 = Markdown, 0 = PlainText
            });
            commentAdded = true;
            logger.debug(`Added removal reason comment to work item ${workItemId}`);
          } catch (commentError) {
            logger.warn(
              `Failed to add comment to work item ${workItemId}, proceeding with deletion:`,
              commentError
            );
          }
        }

        // Update the work item state to "Removed" instead of deleting
        const updateUrl = `wit/workItems/${workItemId}?api-version=7.1`;
        await httpClient.patch(updateUrl, [
          {
            op: "add",
            path: "/fields/System.State",
            value: "Removed",
          },
        ]);

        results.push({ workItemId, success: true, commentAdded });
        logger.debug(`Set work item ${workItemId} to Removed state`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to remove work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const commentsAdded = results.filter((r) => r.commentAdded).length;

    const summary =
      itemSelector === "all"
        ? `Removed all ${selectedCount} work items`
        : `Removed ${selectedCount} selected items (from ${totalItems} total)`;

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        item_selector: itemSelector,
        successful: successCount,
        failed: failureCount,
        comments_added: removeReason ? commentsAdded : undefined,
        results,
        summary: `Successfully moved ${successCount} of ${selectedCount} selected work items to "Removed" state${failureCount > 0 ? ` (${failureCount} failed)` : ""}${removeReason && commentsAdded > 0 ? ` with reason comments on ${commentsAdded} items` : ""}`,
      }),
      metadata: {
        source: "bulk-remove-by-query-handle",
        itemSelector,
      },
      errors:
        failureCount > 0
          ? results.filter((r) => !r.success).map((r) => `Work item ${r.workItemId}: ${r.error}`)
          : [],
      warnings: [
        '✅ State Change Complete: Work items have been moved to "Removed" state (not permanently deleted)',
      ],
    };
  } catch (error) {
    logger.error("Bulk remove by query handle error:", error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-remove-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}
