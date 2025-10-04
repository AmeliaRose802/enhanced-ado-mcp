/**
 * Handler for wit-bulk-update-by-query-handle tool
 * 
 * Updates multiple work items identified by a query handle using JSON Patch operations.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../utils/response-builder.js";
import { logger } from "../../utils/logger.js";
import { queryHandleService } from "../query-handle-service.js";
import { ADOHttpClient } from "../../utils/ado-http-client.js";
import { loadConfiguration } from "../../config/config.js";

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

    const { queryHandle, updates, dryRun, organization, project } = parsed.data;

    // Retrieve work item IDs from query handle
    const workItemIds = queryHandleService.getWorkItemIds(queryHandle);
    
    if (!workItemIds) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-update-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    logger.info(`Bulk update operation: ${workItemIds.length} work items (dry_run: ${dryRun})`);

    if (dryRun) {
      return {
        success: true,
        data: {
          dry_run: true,
          query_handle: queryHandle,
          work_item_ids: workItemIds,
          updates_preview: updates,
          summary: `DRY RUN: Would apply ${updates.length} update(s) to ${workItemIds.length} work item(s)`
        },
        metadata: { 
          source: "bulk-update-by-query-handle",
          dryRun: true,
          count: workItemIds.length
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

    for (const workItemId of workItemIds) {
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

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        total_work_items: workItemIds.length,
        successful: successCount,
        failed: failureCount,
        results,
        summary: `Successfully updated ${successCount} of ${workItemIds.length} work item(s)${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
      },
      metadata: {
        source: "bulk-update-by-query-handle",
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
