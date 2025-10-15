/**
 * Handler for wit-bulk-undo-by-query-handle tool
 * 
 * Undoes the last bulk operation performed on a query handle by reverting
 * the changes made to work items. Supports undoing:
 * - Comments (deletion not supported by ADO API, adds reversal comment)
 * - Field updates (reverts to previous values)
 * - Assignments (reverts to previous assignee)
 * - State transitions (reverts to previous state)
 * - Iteration moves (reverts to previous iteration)
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

interface UndoResult {
  workItemId: number;
  success: boolean;
  operationType: string;
  actionsPerformed: string[];
  error?: string;
}

export async function handleBulkUndoByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { queryHandle, dryRun, maxPreviewItems, organization, project } = validation.data;

    // First verify the query handle exists in the registry
    const handleData = queryHandleService.getQueryData(queryHandle);
    
    if (!handleData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-undo-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    // Get the operation history for this query handle
    const operationHistory = queryHandleService.getOperationHistory(queryHandle);
    
    if (!operationHistory || operationHistory.length === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-undo-by-query-handle" },
        errors: [`No operation history found for query handle '${queryHandle}'. No bulk operations have been performed on this handle yet.`],
        warnings: []
      };
    }

    // Get the last operation
    const lastOperation = operationHistory[operationHistory.length - 1];
    logger.info(`Undoing last operation: ${lastOperation.operation} (${lastOperation.itemsAffected.length} items affected)`);

    if (dryRun) {
      // Show preview of what will be undone
      const previewLimit = Math.min(maxPreviewItems, lastOperation.itemsAffected.length);
      const previewItems = lastOperation.itemsAffected.slice(0, previewLimit).map((item: { workItemId: number; changes: Record<string, any> }) => ({
        work_item_id: item.workItemId,
        operation_type: lastOperation.operation,
        changes_to_revert: item.changes,
        undo_actions: describeUndoActions(lastOperation.operation, item.changes)
      }));

      const warnings: string[] = [];
      if (lastOperation.operation === 'bulk-comment') {
        warnings.push("Azure DevOps API does not support deleting comments. Undo will add a reversal comment instead.");
      }

      const previewMessage = lastOperation.itemsAffected.length > previewLimit 
        ? `Showing ${previewLimit} of ${lastOperation.itemsAffected.length} items...` 
        : undefined;

      return {
        success: true,
        data: asToolData({
          dry_run: true,
          query_handle: queryHandle,
          operation_to_undo: lastOperation.operation,
          operation_timestamp: lastOperation.timestamp,
          items_to_revert: lastOperation.itemsAffected.length,
          preview_items: previewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would undo ${lastOperation.operation} on ${lastOperation.itemsAffected.length} work item(s)`
        }),
        metadata: { 
          source: "bulk-undo-by-query-handle",
          dryRun: true
        },
        errors: [],
        warnings
      };
    }

    // Execute undo operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: UndoResult[] = [];

    for (const item of lastOperation.itemsAffected) {
      try {
        const undoActions = await performUndo(
          item.workItemId,
          lastOperation.operation,
          item.changes,
          httpClient
        );

        results.push({
          workItemId: item.workItemId,
          success: true,
          operationType: lastOperation.operation,
          actionsPerformed: undoActions
        });
        
        logger.debug(`Undid operation on work item ${item.workItemId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          workItemId: item.workItemId,
          success: false,
          operationType: lastOperation.operation,
          actionsPerformed: [],
          error: errorMsg
        });
        logger.error(`Failed to undo operation on work item ${item.workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Remove the operation from history if all items succeeded
    if (failureCount === 0) {
      queryHandleService.removeLastOperation(queryHandle);
      logger.info(`Successfully undid operation and removed from history for handle ${queryHandle}`);
    }

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        operation_undone: lastOperation.operation,
        operation_timestamp: lastOperation.timestamp,
        items_affected: lastOperation.itemsAffected.length,
        successful: successCount,
        failed: failureCount,
        results,
        summary: `Successfully undid ${lastOperation.operation} on ${successCount} of ${lastOperation.itemsAffected.length} work items${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
      }),
      metadata: {
        source: "bulk-undo-by-query-handle",
        operationType: lastOperation.operation
      },
      errors: failureCount > 0 
        ? results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: lastOperation.operation === 'bulk-comment' 
        ? ["Comments cannot be deleted via ADO API. Added reversal comments instead."]
        : []
    };
  } catch (error) {
    logger.error('Bulk undo by query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-undo-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Describe what undo actions will be performed
 */
function describeUndoActions(operation: string, changes: Record<string, any>): string[] {
  const actions: string[] = [];
  
  switch (operation) {
    case 'bulk-comment':
      actions.push("Add reversal comment (original comment cannot be deleted)");
      break;
    case 'bulk-update':
      for (const [path, value] of Object.entries(changes)) {
        if (value.from !== undefined) {
          actions.push(`Revert ${path} from "${value.to}" to "${value.from}"`);
        } else {
          actions.push(`Remove ${path} (was set to "${value.to}")`);
        }
      }
      break;
    case 'bulk-assign':
      actions.push(`Revert assignment from "${changes.to}" to "${changes.from || 'Unassigned'}"`);
      break;
    case 'bulk-transition':
      actions.push(`Revert state from "${changes.to}" to "${changes.from}"`);
      break;
    case 'bulk-move-iteration':
      actions.push(`Revert iteration from "${changes.to}" to "${changes.from}"`);
      break;
    default:
      actions.push("Undo operation not fully defined");
  }
  
  return actions;
}

/**
 * Perform the actual undo operation
 */
async function performUndo(
  workItemId: number,
  operation: string,
  changes: Record<string, any>,
  httpClient: ADOHttpClient
): Promise<string[]> {
  const actions: string[] = [];
  
  switch (operation) {
    case 'bulk-comment':
      // Cannot delete comments via API, so add a reversal comment
      await httpClient.post(`wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`, {
        text: `🔄 **UNDO:** Previous comment has been reversed.\n\n~~${changes.comment}~~`,
        format: 1
      });
      actions.push("Added reversal comment");
      break;
      
    case 'bulk-update':
      const updatePatches: any[] = [];
      for (const [path, value] of Object.entries(changes)) {
        if (value.from !== undefined) {
          updatePatches.push({
            op: "replace",
            path,
            value: value.from
          });
        } else {
          updatePatches.push({
            op: "remove",
            path
          });
        }
      }
      
      await httpClient.patch(`wit/workItems/${workItemId}?api-version=7.1-preview.3`, updatePatches);
      actions.push(`Reverted ${updatePatches.length} field(s)`);
      break;
      
    case 'bulk-assign':
      const assignPatch = changes.from 
        ? [{ op: "replace", path: "/fields/System.AssignedTo", value: changes.from }]
        : [{ op: "remove", path: "/fields/System.AssignedTo" }];
      
      await httpClient.patch(`wit/workItems/${workItemId}?api-version=7.1-preview.3`, assignPatch);
      actions.push(`Reverted assignment to ${changes.from || 'Unassigned'}`);
      break;
      
    case 'bulk-transition':
      await httpClient.patch(`wit/workItems/${workItemId}?api-version=7.1-preview.3`, [
        { op: "replace", path: "/fields/System.State", value: changes.from }
      ]);
      actions.push(`Reverted state to ${changes.from}`);
      break;
      
    case 'bulk-move-iteration':
      await httpClient.patch(`wit/workItems/${workItemId}?api-version=7.1-preview.3`, [
        { op: "replace", path: "/fields/System.IterationPath", value: changes.from }
      ]);
      actions.push(`Reverted iteration to ${changes.from}`);
      break;
      
    default:
      throw new Error(`Unknown operation type: ${operation}`);
  }
  
  return actions;
}
