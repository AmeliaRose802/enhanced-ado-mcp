/**
 * Handler for wit-bulk-update-by-query-handle tool
 * 
 * Updates multiple work items identified by a query handle using JSON Patch operations.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleBulkUpdateByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, updates, itemSelector, dryRun, maxPreviewItems, organization, project } = parsed.data;

    // Retrieve work item IDs from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-update-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    logger.info(`Bulk update operation: ${selectedCount} of ${totalItems} work items selected (dry_run: ${dryRun})`);
    logger.info(`Selected ${selectedCount} of ${totalItems} items for update`);
    if (itemSelector !== 'all') {
      logger.info(`Selection criteria: ${JSON.stringify(itemSelector)}`);
    }

    // Build selected items context for validation
    const selectedItems = selectedWorkItemIds.map(id => {
      const context = queryData.itemContext.find(item => item.id === id);
      return {
        id,
        title: context?.title || "Unknown",
        state: context?.state || "Unknown",
        type: context?.type || "Unknown"
      };
    });

    // Validate that selected items can accept the field updates (optional but recommended)
    const invalidItems = selectedItems.filter(item => {
      // Example: Basic validation - this can be extended based on specific field requirements
      // For now, just check if item has basic required fields
      return !item.type || item.type === "Unknown";
    });
    
    if (invalidItems.length > 0) {
      logger.warn(`${invalidItems.length} items may not accept all field updates due to missing context`);
    }

    if (dryRun) {
      // Show preview of selected items and updates
      const previewLimit = maxPreviewItems || 5;
      const previewItems = selectedWorkItemIds.slice(0, previewLimit).map((id: number) => {
        const context = queryData.itemContext.find(item => item.id === id);
        return {
          work_item_id: id,
          index: context?.index,
          title: context?.title || "No title available",
          state: context?.state || "Unknown",
          type: context?.type || "Unknown"
        };
      });

      const summary = itemSelector === 'all'
        ? `DRY RUN: Would update ${updates.length} fields on all ${selectedCount} items`
        : `DRY RUN: Would update ${updates.length} fields on ${selectedCount} selected items (from ${totalItems} total)`;

      const previewMessage = selectedCount > previewLimit 
        ? `Showing ${previewLimit} of ${selectedCount} items...` 
        : undefined;

      return {
        success: true,
        data: {
          dry_run: true,
          query_handle: queryHandle,
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          item_selector: itemSelector,
          work_item_ids: selectedWorkItemIds,
          updates_preview: updates,
          preview_items: previewItems,
          preview_message: previewMessage,
          summary
        },
        metadata: { 
          source: "bulk-update-by-query-handle",
          dryRun: true,
          itemSelector
        },
        errors: [],
        warnings: []
      };
    }

    // Execute bulk update operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: Array<{ workItemId: number; success: boolean; error?: string }> = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        const url = `wit/workItems/${workItemId}?api-version=7.1`;
        
        await httpClient.patch(url, updates);

        results.push({ workItemId, success: true });
        logger.debug(`Updated work item ${workItemId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to update work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Enhanced error reporting with selection context
    if (failureCount > 0) {
      const errorMsg = itemSelector === 'all'
        ? `Failed to update ${failureCount} of ${selectedCount} items`
        : `Failed to update ${failureCount} of ${selectedCount} selected items (selection: ${JSON.stringify(itemSelector)})`;
      
      logger.error(errorMsg);
    }

    // Update summary messages with selection context
    const summary = itemSelector === 'all'
      ? `Updated ${updates.length} fields on all ${successCount} of ${selectedCount} items`
      : `Updated ${updates.length} fields on ${successCount} of ${selectedCount} selected items (from ${totalItems} total)`;

    const fullSummary = failureCount > 0 
      ? `${summary} (${failureCount} failed)` 
      : summary;

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        item_selector: itemSelector,
        successful: successCount,
        failed: failureCount,
        results,
        summary: fullSummary
      },
      metadata: {
        source: "bulk-update-by-query-handle",
        itemSelector
      },
      errors: failureCount > 0 
        ? results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: []
    };
  } catch (error) {
    logger.error('Bulk update by query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-update-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
