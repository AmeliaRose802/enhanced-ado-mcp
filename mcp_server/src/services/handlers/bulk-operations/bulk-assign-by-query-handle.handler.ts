/**
 * Handler for wit-bulk-assign-by-query-handle tool
 * 
 * Assigns multiple work items to a user, identified by a query handle.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleBulkAssignByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, assignTo, itemSelector, dryRun, organization, project } = parsed.data;

    // Retrieve work item IDs from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-assign-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    logger.info(`Bulk assign operation: ${selectedCount} of ${totalItems} work items to '${assignTo}' (dry_run: ${dryRun})`);

    if (dryRun) {
      // Show preview of selected items
      const previewItems = selectedWorkItemIds.slice(0, 5).map((id: number) => {
        const context = queryData.itemContext.find(item => item.id === id);
        return {
          work_item_id: id,
          index: context?.index,
          title: context?.title || "No title available",
          state: context?.state || "Unknown",
          current_assignee: queryData.workItemContext?.get(id)?.assignedTo || "Unassigned"
        };
      });

      return {
        success: true,
        data: {
          dry_run: true,
          query_handle: queryHandle,
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          item_selector: itemSelector,
          work_item_ids: selectedWorkItemIds,
          assign_to: assignTo,
          preview_items: previewItems,
          summary: `DRY RUN: Would assign ${selectedCount} of ${totalItems} work item(s) to '${assignTo}'`
        },
        metadata: { 
          source: "bulk-assign-by-query-handle",
          dryRun: true,
          selectedCount,
          totalItems,
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

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        assign_to: assignTo,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        item_selector: itemSelector,
        successful: successCount,
        failed: failureCount,
        results,
        summary: `Successfully assigned ${successCount} of ${selectedCount} selected work items to '${assignTo}'${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
      },
      metadata: {
        source: "bulk-assign-by-query-handle",
        totalWorkItems: totalItems,
        selectedWorkItems: selectedCount,
        itemSelector,
        successful: successCount,
        failed: failureCount
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
