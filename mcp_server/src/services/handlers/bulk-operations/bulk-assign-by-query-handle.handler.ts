/**
 * Handler for wit-bulk-assign tool
 * 
 * Assigns multiple work items to a user, identified by a query handle.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { buildNotFoundError, buildSuccessResponse, buildErrorResponse } from "../../../utils/response-builder.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleBulkAssignByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { queryHandle, assignTo, itemSelector, dryRun, maxPreviewItems, organization, project } = validation.data;

    // Retrieve work item IDs from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return buildNotFoundError(
        'query-handle',
        queryHandle,
        {
          source: 'bulk-assign-by-query-handle',
          hint: 'Query handles expire after 1 hour.'
        }
      );
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    logger.info(`Bulk assign operation: ${selectedCount} of ${totalItems} work items to '${assignTo}' (dry_run: ${dryRun})`);
    if (itemSelector !== 'all') {
      logger.info(`Selection criteria: ${JSON.stringify(itemSelector)}`);
    }

    if (dryRun) {
      // Show preview of selected items
      const previewLimit = maxPreviewItems;
      const previewItems = selectedWorkItemIds.slice(0, previewLimit).map((id: number) => {
        const context = queryData.itemContext.find(item => item.id === id);
        return {
          work_item_id: id,
          index: context?.index,
          title: context?.title || "No title available",
          state: context?.state || "Unknown",
          current_assignee: queryData.workItemContext?.get(id)?.assignedTo || "Unassigned"
        };
      });

      const previewMessage = selectedCount > previewLimit 
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
          assign_to: assignTo,
          preview_items: previewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would assign ${selectedCount} of ${totalItems} work item(s) to '${assignTo}'`
        }),
        metadata: { 
          source: "bulk-assign-by-query-handle",
          dryRun: true,
          itemSelector
        },
        errors: [],
        warnings: []
      };
    }

    // Execute bulk assign operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: Array<{ workItemId: number; success: boolean; error?: string }> = [];

    // Build JSON Patch for assignment
    const assignPatch = [
      {
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: assignTo
      }
    ];

    for (const workItemId of selectedWorkItemIds) {
      try {
        const url = `wit/workItems/${workItemId}?api-version=7.1`;
        
        await httpClient.patch(url, assignPatch);

        results.push({ workItemId, success: true });
        logger.debug(`Assigned work item ${workItemId} to ${assignTo}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to assign work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Build assignment summary with item details
    const assignedItems = results
      .filter(r => r.success)
      .map(r => {
        const context = queryData.itemContext.find(item => item.id === r.workItemId);
        return {
          id: r.workItemId,
          title: context?.title || "Unknown",
          type: context?.type || "Unknown",
          previousState: context?.state || "Unknown"
        };
      });

    const assignmentSummary = {
      assignedTo: assignTo,
      totalInHandle: totalItems,
      selectedForAssignment: selectedCount,
      selectionCriteria: itemSelector === 'all' ? 'All items' : JSON.stringify(itemSelector),
      assignedItems: assignedItems.slice(0, 10) // Limit to first 10 for logging
    };

    logger.info(`Assignment details: ${JSON.stringify(assignmentSummary, null, 2)}`);

    // Create success message with context
    const successMsg = itemSelector === 'all'
      ? `Assigned all ${successCount} work items to '${assignTo}'`
      : `Assigned ${successCount} selected items to '${assignTo}' (from ${totalItems} total, criteria: ${JSON.stringify(itemSelector)})`;

    // Handle partial failures with context
    if (failureCount > 0) {
      const failureContext = itemSelector === 'all'
        ? `${failureCount} of ${selectedCount} assignments failed`
        : `${failureCount} of ${selectedCount} selected items failed (selection: ${JSON.stringify(itemSelector)})`;
      
      logger.warn(failureContext);
    }

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        assign_to: assignTo,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        item_selector: itemSelector,
        successful: successCount,
        failed: failureCount,
        results,
        assigned_items: assignedItems,
        summary: successMsg + (failureCount > 0 ? ` (${failureCount} failed)` : '')
      }),
      metadata: {
        source: "bulk-assign-by-query-handle",
        itemSelector
      },
      errors: failureCount > 0 
        ? results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: []
    };
  } catch (error) {
    logger.error('Bulk assign by query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-assign-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
