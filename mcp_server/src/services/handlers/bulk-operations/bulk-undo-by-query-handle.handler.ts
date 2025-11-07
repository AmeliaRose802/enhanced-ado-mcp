/**
 * Handler for undo-bulk tool
 * 
 * Undoes the last bulk operation performed on a query handle by reverting
 * the changes made to work items. Supports undoing:
 * - Comments (deletion not supported by ADO API, adds reversal comment)
 * - Field updates (reverts to previous values)
 * - Assignments (reverts to previous assignee)
 * - State transitions (reverts to previous state)
 * - Iteration moves (reverts to previous iteration)
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import { validateAndParse } from "@/utils/handler-helpers.js";
import { logger } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from '@/utils/ado-http-client.js';
import { getTokenProvider } from '@/utils/token-provider.js';
import { loadConfiguration } from "@/config/config.js";

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

    const { queryHandle, undoAll, dryRun, maxPreviewItems, organization, project } = validation.data;

    // First verify the query handle exists in the registry
    const handleData = queryHandleService.getQueryData(queryHandle);
    
    if (!handleData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-undo-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 24 hours.`],
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

    // Determine which operations to undo
    const operationsToUndo = undoAll ? [...operationHistory].reverse() : [operationHistory[operationHistory.length - 1]];
    const operationCount = operationsToUndo.length;
    
    logger.info(`Undoing ${operationCount} operation(s) on query handle ${queryHandle}`);

    if (dryRun) {
      // Show preview of what will be undone
      const allPreviewItems: any[] = [];
      const warnings: string[] = [];
      let totalItemsAffected = 0;
      
      for (const operation of operationsToUndo) {
        totalItemsAffected += operation.itemsAffected.length;
        
        if (operation.operation === 'bulk-comment') {
          warnings.push("Azure DevOps API does not support deleting comments. Undo will add reversal comments instead.");
        }
        
        const previewLimit = Math.min(maxPreviewItems - allPreviewItems.length, operation.itemsAffected.length);
        const previewItems = operation.itemsAffected.slice(0, previewLimit).map((item: { workItemId: number; changes: Record<string, any> }) => ({
          work_item_id: item.workItemId,
          operation_type: operation.operation,
          operation_timestamp: operation.timestamp,
          changes_to_revert: item.changes,
          undo_actions: describeUndoActions(operation.operation, item.changes)
        }));
        
        allPreviewItems.push(...previewItems);
        
        if (allPreviewItems.length >= maxPreviewItems) {
          break;
        }
      }

      const previewMessage = totalItemsAffected > maxPreviewItems 
        ? `Showing ${allPreviewItems.length} of ${totalItemsAffected} total items affected across ${operationCount} operation(s)...` 
        : undefined;

      return {
        success: true,
        data: asToolData({
          dry_run: true,
          query_handle: queryHandle,
          undo_mode: undoAll ? "all" : "last",
          operations_to_undo: operationCount,
          items_to_revert: totalItemsAffected,
          // Backward compatibility: include single operation fields when undoing last
          ...(undoAll ? {} : {
            operation_to_undo: operationsToUndo[0].operation,
            operation_timestamp: operationsToUndo[0].timestamp
          }),
          operations_summary: operationsToUndo.map(op => ({
            operation: op.operation,
            timestamp: op.timestamp,
            items_affected: op.itemsAffected.length
          })),
          preview_items: allPreviewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would undo ${operationCount} operation(s) affecting ${totalItemsAffected} work item(s)`
        }),
        metadata: { 
          source: "bulk-undo-by-query-handle",
          dryRun: true,
          undoAll
        },
        errors: [],
        warnings: [...new Set(warnings)] // deduplicate warnings
      };
    }

    // Execute undo operations (in reverse chronological order)
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    const allResults: UndoResult[] = [];
    let operationsUndone = 0;

    for (const operation of operationsToUndo) {
      logger.info(`Undoing operation: ${operation.operation} (${operation.itemsAffected.length} items)`);
      
      for (const item of operation.itemsAffected) {
        try {
          const undoActions = await performUndo(
            item.workItemId,
            operation.operation,
            item.changes,
            httpClient
          );

          allResults.push({
            workItemId: item.workItemId,
            success: true,
            operationType: operation.operation,
            actionsPerformed: undoActions
          });
          
          logger.debug(`Undid ${operation.operation} on work item ${item.workItemId}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          allResults.push({
            workItemId: item.workItemId,
            success: false,
            operationType: operation.operation,
            actionsPerformed: [],
            error: errorMsg
          });
          logger.error(`Failed to undo ${operation.operation} on work item ${item.workItemId}:`, error);
        }
      }
      
      // Remove operation from history only if all items in that operation succeeded
      const operationResults = allResults.slice(-operation.itemsAffected.length);
      const operationSuccess = operationResults.every(r => r.success);
      
      if (operationSuccess) {
        queryHandleService.removeLastOperation(queryHandle);
        operationsUndone++;
        logger.info(`Successfully undid and removed operation ${operation.operation} from history`);
      } else {
        logger.warn(`Operation ${operation.operation} had failures, keeping in history`);
        // Don't continue undoing if this operation failed
        if (undoAll) {
          logger.info(`Stopping undo process due to failures in operation ${operation.operation}`);
          break;
        }
      }
    }

    const successCount = allResults.filter(r => r.success).length;
    const failureCount = allResults.filter(r => !r.success).length;
    const totalItems = allResults.length;

    const hasCommentOperations = operationsToUndo.some(op => op.operation === 'bulk-comment');

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        undo_mode: undoAll ? "all" : "last",
        operations_attempted: operationsToUndo.length,
        operations_undone: operationsUndone,
        items_affected: totalItems,
        successful: successCount,
        failed: failureCount,
        // Backward compatibility: include single operation fields when undoing last
        ...(undoAll ? {} : {
          operation_undone: operationsToUndo[0].operation,
          operation_timestamp: operationsToUndo[0].timestamp
        }),
        operations_summary: operationsToUndo.map(op => ({
          operation: op.operation,
          timestamp: op.timestamp,
          items_affected: op.itemsAffected.length
        })),
        results: allResults,
        summary: `Successfully undid ${operationsUndone} of ${operationsToUndo.length} operation(s), reverting ${successCount} of ${totalItems} work item change(s)${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
      }),
      metadata: {
        source: "bulk-undo-by-query-handle",
        undoAll,
        operationsUndone
      },
      errors: failureCount > 0 
        ? allResults.filter(r => !r.success).map(r => `Work item ${r.workItemId} (${r.operationType}): ${r.error}`)
        : [],
      warnings: hasCommentOperations
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
    case 'bulk-change-type':
      actions.push(`Revert type from "${changes.to}" to "${changes.from}"`);
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
      
    case 'bulk-change-type':
      await httpClient.patch(`wit/workItems/${workItemId}?api-version=7.1-preview.3`, [
        { op: "replace", path: "/fields/System.WorkItemType", value: changes.from }
      ]);
      actions.push(`Reverted type to ${changes.from}`);
      break;
      
    default:
      throw new Error(`Unknown operation type: ${operation}`);
  }
  
  return actions;
}
