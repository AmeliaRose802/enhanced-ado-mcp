/**
 * Handler for wit-bulk-assign-by-query-handle tool
 * 
 * Assigns multiple work items to a user, identified by a query handle.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../utils/response-builder.js";
import { logger } from "../../utils/logger.js";
import { queryHandleService } from "../query-handle-service.js";
import { ADOHttpClient } from "../../utils/ado-http-client.js";
import { loadConfiguration } from "../../config/config.js";

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

    const { queryHandle, assignTo, dryRun, organization, project } = parsed.data;

    // Retrieve work item IDs from query handle
    const workItemIds = queryHandleService.getWorkItemIds(queryHandle);
    
    if (!workItemIds) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-assign-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    logger.info(`Bulk assign operation: ${workItemIds.length} work items to '${assignTo}' (dry_run: ${dryRun})`);

    if (dryRun) {
      return {
        success: true,
        data: {
          dry_run: true,
          query_handle: queryHandle,
          work_item_ids: workItemIds,
          assign_to: assignTo,
          summary: `DRY RUN: Would assign ${workItemIds.length} work item(s) to '${assignTo}'`
        },
        metadata: { 
          source: "bulk-assign-by-query-handle",
          dryRun: true,
          count: workItemIds.length
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

    for (const workItemId of workItemIds) {
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
        total_work_items: workItemIds.length,
        successful: successCount,
        failed: failureCount,
        results,
        summary: `Successfully assigned ${successCount} of ${workItemIds.length} work item(s) to '${assignTo}'${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
      },
      metadata: {
        source: "bulk-assign-by-query-handle",
        totalWorkItems: workItemIds.length,
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
