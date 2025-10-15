/**
 * Handler for wit-bulk-update tool
 * 
 * Updates multiple work items identified by a query handle using JSON Patch operations.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { buildNotFoundError, buildSuccessResponse, buildErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleBulkUpdateByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { queryHandle, updates, itemSelector, dryRun, maxPreviewItems, organization, project } = validation.data;

    // Retrieve work item IDs from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return buildNotFoundError(
        'query-handle',
        queryHandle,
        {
          source: "bulk-update-by-query-handle",
          hint: 'Query handles expire after 1 hour.'
        }
      );
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
      const previewLimit = maxPreviewItems;
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

      return buildSuccessResponse(
        {
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
        { 
          source: "bulk-update-by-query-handle",
          dryRun: true
        }
      );
    }

    // Execute bulk update operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: Array<{ workItemId: number; success: boolean; error?: string }> = [];
    const operationHistory: Array<{ workItemId: number; changes: Record<string, any> }> = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        const url = `wit/workItems/${workItemId}?api-version=7.1`;
        
        // Get current values before update for undo tracking
        const currentItemResponse = await httpClient.get<any>(`wit/workItems/${workItemId}?api-version=7.1`);
        const currentItem = currentItemResponse.data;
        const previousValues: Record<string, any> = {};
        
        for (const update of updates) {
          if (update.op === 'replace' || update.op === 'add') {
            const fieldName = update.path;
            const currentValue = currentItem?.fields?.[fieldName.replace('/fields/', '')];
            previousValues[fieldName] = {
              from: currentValue,
              to: update.value
            };
          } else if (update.op === 'remove') {
            const fieldName = update.path;
            const currentValue = currentItem?.fields?.[fieldName.replace('/fields/', '')];
            previousValues[fieldName] = {
              from: currentValue,
              to: undefined
            };
          }
        }
        
        await httpClient.patch(url, updates);

        results.push({ workItemId, success: true });
        operationHistory.push({ workItemId, changes: previousValues });
        logger.debug(`Updated work item ${workItemId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to update work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Record operation for undo (only successful items)
    if (operationHistory.length > 0) {
      queryHandleService.recordOperation(queryHandle, 'bulk-update', operationHistory);
    }

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

    const responseData = {
      query_handle: queryHandle,
      total_items_in_handle: totalItems,
      selected_items: selectedCount,
      item_selector: itemSelector,
      successful: successCount,
      failed: failureCount,
      results,
      summary: fullSummary
    };

    if (failureCount > 0) {
      return {
        success: false,
        data: responseData,
        metadata: { source: "bulk-update-by-query-handle" },
        errors: results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`),
        warnings: []
      };
    }

    return buildSuccessResponse(
      responseData,
      { source: "bulk-update-by-query-handle" }
    );
  } catch (error) {
    logger.error('Bulk update by query handle error:', error);
    return buildErrorResponse(
      error as Error,
      { source: "bulk-update-by-query-handle" }
    );
  }
}
