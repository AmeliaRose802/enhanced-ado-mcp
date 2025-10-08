/**
 * Handler for wit-bulk-move-to-iteration-by-query-handle tool
 * 
 * Moves multiple work items to a different iteration/sprint using query handle pattern.
 * This eliminates ID hallucination risk and provides a simpler interface than JSON Patch.
 * Commonly used for sprint rescheduling and backlog grooming.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";
import type { ADOWorkItem } from '../../../types/index.js';

export async function handleBulkMoveToIteration(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
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
      targetIterationPath, 
      comment, 
      itemSelector, 
      updateChildItems,
      dryRun, 
      maxPreviewItems, 
      organization, 
      project 
    } = parsed.data;

    // Retrieve work item IDs from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-move-to-iteration" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    logger.info(`Bulk move to iteration operation: ${selectedCount} of ${totalItems} work items to '${targetIterationPath}' (dry_run: ${dryRun})`);
    if (itemSelector !== 'all') {
      logger.info(`Selection criteria: ${JSON.stringify(itemSelector)}`);
    }

    // Setup HTTP client
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    // Validate iteration path exists
    try {
      await validateIterationPath(httpClient, proj, targetIterationPath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-move-to-iteration" },
        errors: [`Invalid iteration path: ${errorMsg}`],
        warnings: [`Ensure the iteration path exists in project '${proj}' and follows the format: 'ProjectName\\IterationName' or 'ProjectName\\Parent\\Child'`]
      };
    }

    if (dryRun) {
      // Show preview of selected items
      const previewLimit = maxPreviewItems || 5;
      const previewItems = selectedWorkItemIds.slice(0, previewLimit).map((id: number) => {
        const context = queryData.itemContext.find(item => item.id === id);
        return {
          work_item_id: id,
          index: context?.index,
          title: context?.title || "No title available",
          type: context?.type || "Unknown",
          state: context?.state || "Unknown",
          current_iteration: queryData.workItemContext?.get(id)?.iterationPath || "Not set"
        };
      });

      const previewMessage = selectedCount > previewLimit 
        ? `Showing ${previewLimit} of ${selectedCount} items...` 
        : undefined;

      const warnings: string[] = [];
      if (updateChildItems) {
        warnings.push('Child items will also be updated to the same iteration path');
      }

      return {
        success: true,
        data: asToolData({
          dry_run: true,
          query_handle: queryHandle,
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          item_selector: itemSelector,
          work_item_ids: selectedWorkItemIds,
          target_iteration_path: targetIterationPath,
          update_child_items: updateChildItems || false,
          comment: comment || null,
          preview_items: previewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would move ${selectedCount} of ${totalItems} work item(s) to iteration '${targetIterationPath}'`
        }),
        metadata: { 
          source: "bulk-move-to-iteration",
          dryRun: true,
          itemSelector
        },
        errors: [],
        warnings
      };
    }

    // Execute bulk move operation
    const results: Array<{ 
      workItemId: number; 
      success: boolean; 
      previousIteration?: string;
      error?: string;
      childrenUpdated?: number;
    }> = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        // Fetch current work item to get current iteration
        const currentItem = await fetchWorkItem(httpClient, workItemId);
        const previousIteration = currentItem?.fields?.['System.IterationPath'] as string || 'Not set';

        // Build JSON Patch for iteration move
        const patches = [
          {
            op: 'add',
            path: '/fields/System.IterationPath',
            value: targetIterationPath
          }
        ];

        // Add comment if provided
        if (comment) {
          patches.push({
            op: 'add',
            path: '/fields/System.History',
            value: comment
          });
        }

        // Update the work item
        const url = `wit/workItems/${workItemId}?api-version=7.1`;
        await httpClient.patch(url, patches);

        let childrenUpdated = 0;

        // Update children if requested
        if (updateChildItems) {
          try {
            const childIds = await getChildWorkItemIds(httpClient, workItemId);
            for (const childId of childIds) {
              try {
                await httpClient.patch(`wit/workItems/${childId}?api-version=7.1`, patches);
                childrenUpdated++;
              } catch (childError) {
                logger.warn(`Failed to update child ${childId} of parent ${workItemId}:`, childError);
              }
            }
          } catch (childError) {
            logger.warn(`Failed to fetch children for ${workItemId}:`, childError);
          }
        }

        results.push({ 
          workItemId, 
          success: true, 
          previousIteration,
          childrenUpdated: childrenUpdated > 0 ? childrenUpdated : undefined
        });
        logger.debug(`Moved work item ${workItemId} from '${previousIteration}' to '${targetIterationPath}'${childrenUpdated > 0 ? ` (${childrenUpdated} children also updated)` : ''}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to move work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalChildrenUpdated = results.reduce((sum, r) => sum + (r.childrenUpdated || 0), 0);

    // Build move summary with item details
    const movedItems = results
      .filter(r => r.success)
      .map(r => {
        const context = queryData.itemContext.find(item => item.id === r.workItemId);
        return {
          id: r.workItemId,
          title: context?.title || "Unknown",
          type: context?.type || "Unknown",
          previousIteration: r.previousIteration,
          newIteration: targetIterationPath,
          childrenUpdated: r.childrenUpdated
        };
      });

    const moveSummary = {
      targetIteration: targetIterationPath,
      totalInHandle: totalItems,
      selectedForMove: selectedCount,
      selectionCriteria: itemSelector === 'all' ? 'All items' : JSON.stringify(itemSelector),
      movedItems: movedItems.slice(0, 10), // Limit to first 10 for logging
      childrenUpdated: totalChildrenUpdated
    };

    logger.info(`Move details: ${JSON.stringify(moveSummary, null, 2)}`);

    // Create success message with context
    const successMsg = itemSelector === 'all'
      ? `Moved all ${successCount} work items to iteration '${targetIterationPath}'`
      : `Moved ${successCount} selected items to iteration '${targetIterationPath}' (from ${totalItems} total, criteria: ${JSON.stringify(itemSelector)})`;

    const warnings: string[] = [];
    if (totalChildrenUpdated > 0) {
      warnings.push(`Updated ${totalChildrenUpdated} child work items to the same iteration`);
    }

    // Handle partial failures with context
    if (failureCount > 0) {
      const failureContext = itemSelector === 'all'
        ? `${failureCount} of ${selectedCount} moves failed`
        : `${failureCount} of ${selectedCount} selected items failed (selection: ${JSON.stringify(itemSelector)})`;
      
      logger.warn(failureContext);
    }

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        target_iteration_path: targetIterationPath,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        item_selector: itemSelector,
        successful: successCount,
        failed: failureCount,
        children_updated: totalChildrenUpdated,
        results: results.map(r => ({
          id: r.workItemId,
          success: r.success,
          previous_iteration: r.previousIteration,
          new_iteration: r.success ? targetIterationPath : undefined,
          children_updated: r.childrenUpdated,
          error: r.error
        })),
        moved_items: movedItems,
        summary: successMsg + (failureCount > 0 ? ` (${failureCount} failed)` : '')
      }),
      metadata: {
        source: "bulk-move-to-iteration",
        itemSelector,
        updateChildItems: updateChildItems || false
      },
      errors: failureCount > 0 
        ? results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings
    };
  } catch (error) {
    logger.error('Bulk move to iteration error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-move-to-iteration" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Validate that an iteration path exists in the project
 * Uses work/teamsettings/iterations API to verify the iteration exists
 */
async function validateIterationPath(
  httpClient: ADOHttpClient, 
  project: string, 
  iterationPath: string
): Promise<void> {
  try {
    // For validation, we can try to fetch work items with this iteration path
    // or use the classification nodes API to verify the iteration exists
    
    // Method 1: Use classification nodes API (most reliable)
    // Parse the iteration path to get the iteration name hierarchy
    const pathParts = iterationPath.split('\\').filter(p => p.trim());
    
    if (pathParts.length === 0) {
      throw new Error('Iteration path cannot be empty');
    }

    // Try to get iteration from classification nodes
    // The first part is typically the project name, rest is the path
    const iterationName = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts[0];
    
    try {
      // Try to fetch the iteration using classification API
      const url = `wit/classificationnodes/Iterations/${encodeURIComponent(iterationName)}?api-version=7.1`;
      await httpClient.get(url);
      
      logger.debug(`Validated iteration path: ${iterationPath}`);
    } catch (error) {
      // If classification API fails, the iteration doesn't exist
      throw new Error(
        `Iteration path '${iterationPath}' does not exist in project '${project}'. ` +
        `Please verify the path using the correct format (e.g., 'ProjectName\\Sprint 11' or 'ProjectName\\2024\\Sprint 11')`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      throw error;
    }
    // Re-throw with more context
    throw new Error(
      `Failed to validate iteration path '${iterationPath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Fetch a work item by ID
 */
async function fetchWorkItem(httpClient: ADOHttpClient, workItemId: number): Promise<ADOWorkItem | null> {
  try {
    const url = `wit/workitems/${workItemId}?api-version=7.1&$expand=none`;
    const response = await httpClient.get<ADOWorkItem>(url);
    return response.data;
  } catch (error) {
    logger.warn(`Failed to fetch work item ${workItemId}:`, error);
    return null;
  }
}

/**
 * Get child work item IDs for a given parent
 */
async function getChildWorkItemIds(httpClient: ADOHttpClient, parentId: number): Promise<number[]> {
  try {
    const url = `wit/workitems/${parentId}?api-version=7.1&$expand=relations`;
    const response = await httpClient.get<ADOWorkItem>(url);
    
    if (!response.data.relations) {
      return [];
    }

    // Filter for child relations
    const childIds: number[] = [];
    for (const relation of response.data.relations) {
      if (relation.rel === 'System.LinkTypes.Hierarchy-Forward') {
        // Extract work item ID from URL
        const match = relation.url.match(/\/workItems\/(\d+)$/);
        if (match) {
          childIds.push(parseInt(match[1], 10));
        }
      }
    }

    return childIds;
  } catch (error) {
    logger.warn(`Failed to fetch children for work item ${parentId}:`, error);
    return [];
  }
}
