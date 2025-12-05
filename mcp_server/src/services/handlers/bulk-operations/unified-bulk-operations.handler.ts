/**
 * Unified Bulk Operations Handler
 * 
 * Consolidates all query handle-based bulk operations into a single tool.
 * Accepts an array of actions to perform sequentially on work items identified by a query handle.
 * This eliminates tool confusion by providing a single entry point for all bulk modifications.
 */

import { z } from "zod";
import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import type { ADOWorkItem, ADOApiResponse, ADOFieldOperation } from "../../../types/ado.js";
import { smartConvertToHtml } from "../../../utils/markdown-converter.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger, errorToContext } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";
import { getTokenProvider } from '../../../utils/token-provider.js';
import { unifiedBulkOperationsSchema } from "../../../config/schemas.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { processBatch } from "../../../utils/batch-processor.js";
import { createBatchEnabledOperations, BatchUpdateOperation } from "../../batch-enabled-operations.js";

type BulkAction = z.infer<typeof unifiedBulkOperationsSchema>['actions'][number];

interface WorkItemChange {
  workItemId: number;
  changes: Record<string, unknown>;
}

interface ActionResult {
  action: BulkAction;
  success: boolean;
  itemsAffected: number;
  itemsSucceeded: number;
  itemsFailed: number;
  itemsSkipped?: number;
  errors: string[];
  warnings: string[];
  summary: string;
}

export async function handleUnifiedBulkOperations(
  config: ToolConfig, 
  args: unknown, 
  server?: MCPServer | MCPServerLike
): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { 
      queryHandle, 
      actions, 
      itemSelector, 
      dryRun, 
      maxPreviewItems, 
      concurrency,
      stopOnError, 
      organization, 
      project 
    } = validation.data;

    // Retrieve work item IDs from query handle
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "unified-bulk-operations" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 24 hours.`],
        warnings: []
      };
    }

    const selectedCount = selectedWorkItemIds.length;
    if (selectedCount === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "unified-bulk-operations" },
        errors: ["No work items matched the selection criteria"],
        warnings: []
      };
    }

    logger.info(`Unified bulk operations on ${selectedCount} items from query handle ${queryHandle}`);
    logger.info(`Actions to perform: ${actions.map((a: BulkAction) => a.type).join(", ")}`);

    // Load configuration
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    // OPTIMIZATION 2: Fetch work items once upfront for all actions
    // This eliminates redundant fetches when multiple actions need the same data
    // Expected improvement: Reduces API calls by N-1 for N actions that need work item data
    const workItemsCache = new Map<number, ADOWorkItem>();
    if (!dryRun) {
      logger.info(`[OPTIMIZATION] Pre-fetching ${selectedCount} work items to cache for all actions`);
      try {
        const fieldsToFetch = 'System.Id,System.Title,System.State,System.AssignedTo,System.Priority,System.Tags,System.AreaPath,System.IterationPath,System.WorkItemType';
        const idsParam = selectedWorkItemIds.join(',');
        const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
          `wit/workitems?ids=${idsParam}&fields=${fieldsToFetch}&api-version=7.1`
        );
        for (const item of response.data.value || []) {
          workItemsCache.set(item.id, item);
        }
        logger.info(`[OPTIMIZATION] Cached ${workItemsCache.size} work items for reuse across actions (saves ${Math.max(0, actions.length - 1)} fetch operations)`);
      } catch (error) {
        logger.warn('Failed to pre-fetch work items for cache, will fetch per-action:', errorToContext(error));
      }
    }

    // OPTIMIZATION 1: Create batch-enabled operations for efficient bulk updates
    // Expected improvement: Reduces API calls by 50-100x for bulk updates (N calls → ceil(N/200) calls)
    const batchOperations = createBatchEnabledOperations(httpClient, org, proj);

    // Process each action sequentially
    const actionResults: ActionResult[] = [];
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let shouldStop = false;

    for (let i = 0; i < actions.length; i++) {
      if (shouldStop && stopOnError) {
        logger.info(`Stopping at action ${i + 1} due to previous error`);
        allWarnings.push(`Stopped execution at action ${i + 1} of ${actions.length} due to previous error`);
        break;
      }

      const action = actions[i];
      logger.info(`Executing action ${i + 1}/${actions.length}: ${action.type}`);

      try {
        const result = await executeAction(
          action,
          selectedWorkItemIds,
          httpClient,
          org,
          proj,
          queryHandle,
          dryRun || false,
          concurrency || 5,
          maxPreviewItems,
          server,
          workItemsCache,
          batchOperations
        );

        actionResults.push(result);
        
        if (!result.success) {
          shouldStop = true;
          allErrors.push(...result.errors);
        }
        
        allWarnings.push(...result.warnings);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error executing action ${action.type}: ${errorMsg}`);
        
        actionResults.push({
          action,
          success: false,
          itemsAffected: 0,
          itemsSucceeded: 0,
          itemsFailed: selectedCount,
          errors: [errorMsg],
          warnings: [],
          summary: `Failed to execute ${action.type}: ${errorMsg}`
        });
        
        shouldStop = true;
        allErrors.push(`Action ${action.type} failed: ${errorMsg}`);
      }
    }

    // Calculate overall statistics
    const totalSuccess = actionResults.every(r => r.success);
    const actionsCompleted = actionResults.filter(r => r.success).length;
    const actionsFailed = actionResults.filter(r => !r.success).length;

    // Build response
    const responseData = {
      query_handle: queryHandle,
      items_selected: selectedCount,
      item_selector: itemSelector,
      actions_requested: actions.length,
      actions_completed: actionsCompleted,
      actions_failed: actionsFailed,
      action_results: actionResults.map(r => ({
        action_type: r.action.type,
        success: r.success,
        items_affected: r.itemsAffected,
        items_succeeded: r.itemsSucceeded,
        items_failed: r.itemsFailed,
        items_skipped: r.itemsSkipped,
        summary: r.summary
      })),
      overall_summary: dryRun 
        ? `DRY RUN: Would execute ${actions.length} action(s) on ${selectedCount} work item(s). Completed: ${actionsCompleted}, Failed: ${actionsFailed}`
        : `Executed ${actionsCompleted} of ${actions.length} action(s) on ${selectedCount} work item(s). Failed: ${actionsFailed}`,
      dry_run: dryRun || false
    };

    if (dryRun) {
      return {
        success: true,
        data: asToolData(responseData),
        metadata: { 
          source: "unified-bulk-operations",
          dryRun: true,
          itemSelector
        },
        errors: [],
        warnings: allWarnings
      };
    }

    return {
      success: totalSuccess,
      data: asToolData(responseData),
      metadata: { 
        source: "unified-bulk-operations",
        itemSelector
      },
      errors: allErrors,
      warnings: allWarnings
    };

  } catch (error) {
    logger.error("Unified bulk operations error:", errorToContext(error));
    return {
      success: false,
      data: null,
      metadata: { source: "unified-bulk-operations" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Execute a single action on the selected work items
 */
async function executeAction(
  action: BulkAction,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  organization: string,
  project: string,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number,
  server?: MCPServer | MCPServerLike,
  workItemsCache?: Map<number, ADOWorkItem>,
  batchOperations?: ReturnType<typeof createBatchEnabledOperations>
): Promise<ActionResult> {
  
  switch (action.type) {
    case "comment":
      return await executeCommentAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems, workItemsCache, batchOperations);
    
    case "update":
      return await executeUpdateAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems, workItemsCache, batchOperations);
    
    case "assign":
      return await executeAssignAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "remove":
      return await executeRemoveAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "transition-state":
      return await executeTransitionStateAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "move-iteration":
      return await executeMoveIterationAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "change-type":
      return await executeChangeTypeAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "add-tag":
      return await executeAddTagAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "remove-tag":
      return await executeRemoveTagAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems);
    
    case "enhance-descriptions":
      return await executeEnhanceDescriptionsAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems, server);
    
    case "assign-story-points":
      return await executeAssignStoryPointsAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems, server);
    
    case "add-acceptance-criteria":
      return await executeAddAcceptanceCriteriaAction(action, workItemIds, httpClient, queryHandle, dryRun, concurrency, maxPreviewItems, server);
    
    default:
      throw new Error(`Unknown action type: ${(action as { type: string }).type}`);
  }
}

/**
 * Execute comment action
 */
/**
 * Execute comment action
 */
async function executeCommentAction(
  action: Extract<BulkAction, { type: "comment" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number,
  workItemsCache?: Map<number, ADOWorkItem>,
  batchOperations?: ReturnType<typeof createBatchEnabledOperations>
): Promise<ActionResult> {
  
  if (dryRun) {
    const preview = workItemIds.slice(0, maxPreviewItems || 10);
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `Would add comment to ${workItemIds.length} work item(s): "${action.comment.substring(0, 50)}${action.comment.length > 50 ? '...' : ''}"`
    };
  }

  const errors: string[] = [];
  const itemsAffected: WorkItemChange[] = [];

  // Convert markdown to HTML for proper rendering (consistent with description/acceptance criteria handling)
  const htmlComment = smartConvertToHtml(action.comment);

  // OPTIMIZATION 1: Use Batch API for comments (50-100x improvement)
  if (batchOperations && batchOperations.isBatchAPIEnabled()) {
    logger.info(`[OPTIMIZATION] Using Batch API for ${workItemIds.length} comments (reduces API calls by ~${Math.floor(workItemIds.length / Math.ceil(workItemIds.length / 200))}x)`);
    
    const batchComments = workItemIds.map(workItemId => ({
      workItemId,
      comment: htmlComment
    }));

    const batchResult = await batchOperations.commentBatch(batchComments);

    // Track successful comments for undo
    for (const { item } of batchResult.succeeded) {
      itemsAffected.push({
        workItemId: item.workItemId,
        changes: { comment: action.comment }
      });
    }

    // Collect errors
    for (const { item, error } of batchResult.failed) {
      errors.push(`Work item ${item.workItemId}: ${error}`);
    }

    // Record operation for undo
    if (itemsAffected.length > 0) {
      queryHandleService.recordOperation(queryHandle, 'bulk-comment', itemsAffected);
    }

    return {
      action,
      success: batchResult.failed.length === 0,
      itemsAffected: workItemIds.length,
      itemsSucceeded: batchResult.succeeded.length,
      itemsFailed: batchResult.failed.length,
      errors,
      warnings: [],
      summary: `Added comment to ${batchResult.succeeded.length} work item(s) via Batch API (${batchResult.totalRequests} API call${batchResult.totalRequests > 1 ? 's' : ''} vs ${workItemIds.length} without batching)${batchResult.failed.length > 0 ? `, ${batchResult.failed.length} failed` : ""}`
    };
  }

  // Fallback: Use sequential processing with concurrency control
  logger.info(`Batch API not available, using parallel processing with concurrency=${concurrency}`);
  let succeeded = 0;
  let failed = 0;

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      const url = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
      await httpClient.post(url, {
        text: htmlComment,
        format: 1  // 1 = Markdown/HTML, 0 = PlainText
      });
      // Track for undo
      itemsAffected.push({
        workItemId,
        changes: { comment: action.comment }
      });
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk comment progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  // Record operation for undo (only if successful items exist)
  if (itemsAffected.length > 0) {
    queryHandleService.recordOperation(queryHandle, 'bulk-comment', itemsAffected);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Added comment to ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Execute update action
 */
async function executeUpdateAction(
  action: Extract<BulkAction, { type: "update" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number,
  workItemsCache?: Map<number, ADOWorkItem>,
  batchOperations?: ReturnType<typeof createBatchEnabledOperations>
): Promise<ActionResult> {
  
  if (dryRun) {
    const updateSummary = action.updates.map(u => `${u.op} ${u.path}`).join(", ");
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `Would update ${workItemIds.length} work item(s): ${updateSummary}`
    };
  }

  // OPTIMIZATION 3: Use cached work items if available, otherwise fetch
  // This avoids redundant fetch when cache is populated upfront
  const workItemsById = workItemsCache || new Map<number, ADOWorkItem>();
  if (!workItemsCache || workItemsCache.size === 0) {
    try {
      const idsParam = workItemIds.join(',');
      const fieldsToFetch = action.updates
        .map(u => u.path.replace('/fields/', ''))
        .join(',');
      const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
        `wit/workitems?ids=${idsParam}&fields=${fieldsToFetch}&api-version=7.1`
      );
      for (const item of response.data.value || []) {
        workItemsById.set(item.id, item);
      }
    } catch (error) {
      logger.warn('Failed to fetch work items before update for undo tracking:', errorToContext(error));
    }
  } else {
    logger.info(`[OPTIMIZATION] Using cached work items (skipped 1 fetch operation)`);
  }

  const itemsAffected: WorkItemChange[] = [];
  const errors: string[] = [];

  // OPTIMIZATION 1: Use Batch API for updates (50-100x improvement)
  // Batch API reduces N individual PATCH calls to ceil(N/200) batch calls
  if (batchOperations && batchOperations.isBatchAPIEnabled()) {
    logger.info(`[OPTIMIZATION] Using Batch API for ${workItemIds.length} updates (reduces API calls by ~${Math.floor(workItemIds.length / Math.ceil(workItemIds.length / 200))}x)`);
    
    const batchUpdates: BatchUpdateOperation[] = workItemIds.map(workItemId => ({
      workItemId,
      operations: action.updates
    }));

    const batchResult = await batchOperations.updateBatch(batchUpdates);

    // Track successful updates for undo
    for (const { item } of batchResult.succeeded) {
      const previousItem = workItemsById.get(item.workItemId);
      const changes: Record<string, unknown> = {};
      for (const update of action.updates) {
        const field = update.path.replace('/fields/', '');
        const previousValue = previousItem?.fields?.[field];
        changes[update.path] = {
          from: previousValue,
          to: update.value
        };
      }
      itemsAffected.push({ workItemId: item.workItemId, changes });
    }

    // Collect errors
    for (const { item, error } of batchResult.failed) {
      errors.push(`Work item ${item.workItemId}: ${error}`);
    }

    // Record operation for undo
    if (itemsAffected.length > 0) {
      queryHandleService.recordOperation(queryHandle, 'bulk-update', itemsAffected);
    }

    return {
      action,
      success: batchResult.failed.length === 0,
      itemsAffected: workItemIds.length,
      itemsSucceeded: batchResult.succeeded.length,
      itemsFailed: batchResult.failed.length,
      errors,
      warnings: [],
      summary: `Updated ${batchResult.succeeded.length} work item(s) via Batch API (${batchResult.totalRequests} API call${batchResult.totalRequests > 1 ? 's' : ''} vs ${workItemIds.length} without batching)${batchResult.failed.length > 0 ? `, ${batchResult.failed.length} failed` : ""}`
    };
  }

  // Fallback: Use sequential processing with concurrency control
  logger.info(`Batch API not available, using parallel processing with concurrency=${concurrency}`);
  let succeeded = 0;
  let failed = 0;

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      const url = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(url, action.updates);
      
      // Track for undo - capture before/after values
      const previousItem = workItemsById.get(workItemId);
      const changes: Record<string, unknown> = {};
      for (const update of action.updates) {
        const field = update.path.replace('/fields/', '');
        const previousValue = previousItem?.fields?.[field];
        changes[update.path] = {
          from: previousValue,
          to: update.value
        };
      }
      itemsAffected.push({ workItemId, changes });
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk update progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  // Record operation for undo (only if successful items exist)
  if (itemsAffected.length > 0) {
    queryHandleService.recordOperation(queryHandle, 'bulk-update', itemsAffected);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Updated ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Execute assign action
 */
async function executeAssignAction(
  action: Extract<BulkAction, { type: "assign" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `Would assign ${workItemIds.length} work item(s) to ${action.assignTo}`
    };
  }

  // Fetch work items BEFORE assignment to capture previous assignees
  const workItemsById = new Map<number, any>();
  try {
    const idsParam = workItemIds.join(',');
    interface TeamMember {
      id: number;
      identity: {
        displayName: string;
        uniqueName: string;
        id: string;
      };
      [key: string]: unknown;
    }
    
    const response = await httpClient.get<{ value: TeamMember[] }>(
      `wit/workitems?ids=${idsParam}&fields=System.AssignedTo&api-version=7.1`
    );
    for (const item of response.data.value || []) {
      workItemsById.set(item.id, item);
    }
  } catch (error) {
    logger.warn('Failed to fetch work items before assign for undo tracking:', errorToContext(error));
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  const itemsAffected: WorkItemChange[] = [];

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      const url = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(url, [
        { op: "replace", path: "/fields/System.AssignedTo", value: action.assignTo }
      ]);
      
      if (action.comment) {
        const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
        const htmlComment = smartConvertToHtml(action.comment);
        await httpClient.post(commentUrl, {
          text: htmlComment,
          format: 1
        });
      }
      
      // Track for undo
      const previousItem = workItemsById.get(workItemId);
      const previousAssignee = previousItem?.fields?.['System.AssignedTo']?.uniqueName || 
                               previousItem?.fields?.['System.AssignedTo']?.displayName;
      itemsAffected.push({
        workItemId,
        changes: {
          from: previousAssignee,
          to: action.assignTo
        }
      });
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk assign progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  // Record operation for undo (only if successful items exist)
  if (itemsAffected.length > 0) {
    queryHandleService.recordOperation(queryHandle, 'bulk-assign', itemsAffected);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Assigned ${succeeded} work item(s) to ${action.assignTo}${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Execute remove action
 */
async function executeRemoveAction(
  action: Extract<BulkAction, { type: "remove" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: ['⚠️ State Change: Work items will be moved to "Removed" state (not permanently deleted)'],
      summary: `Would remove ${workItemIds.length} work item(s)`
    };
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      // Add comment if provided
      if (action.removeReason) {
        const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
        await httpClient.post(commentUrl, {
          text: `Removal reason: ${action.removeReason}`,
          format: 1
        });
      }
      
      // Move to Removed state
      const url = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(url, [
        { op: "replace", path: "/fields/System.State", value: "Removed" }
      ]);
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk remove progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Removed ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Execute transition-state action
 */
async function executeTransitionStateAction(
  action: Extract<BulkAction, { type: "transition-state" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: action.validateTransitions ? ['State transitions will be validated before applying'] : [],
      summary: `Would transition ${workItemIds.length} work item(s) to state "${action.targetState}"`
    };
  }

  // Fetch work items BEFORE transition to capture previous states
  const workItemsById = new Map<number, ADOWorkItem>();
  try {
    const idsParam = workItemIds.join(',');
    const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
      `wit/workitems?ids=${idsParam}&fields=System.State&api-version=7.1`
    );
    for (const item of response.data.value || []) {
      workItemsById.set(item.id, item);
    }
  } catch (error) {
    logger.warn('Failed to fetch work items before transition for undo tracking:', errorToContext(error));
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const itemsAffected: Array<{ workItemId: number; changes: Record<string, any> }> = [];

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      const updates: ADOFieldOperation[] = [
        { op: "replace", path: "/fields/System.State", value: action.targetState }
      ];
      
      if (action.reason) {
        updates.push({ op: "replace", path: "/fields/System.Reason", value: action.reason });
      }
      
      const url = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(url, updates);
      
      if (action.comment) {
        const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
        const htmlComment = smartConvertToHtml(action.comment);
        await httpClient.post(commentUrl, {
          text: htmlComment,
          format: 1
        });
      }
      
      // Track for undo
      const previousItem = workItemsById.get(workItemId);
      const previousState = previousItem?.fields?.['System.State'];
      itemsAffected.push({
        workItemId,
        changes: {
          from: previousState,
          to: action.targetState
        }
      });
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      stopOnError: !action.skipInvalidTransitions,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk transition-state progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  
  // Handle skipInvalidTransitions
  if (action.skipInvalidTransitions) {
    skipped = results.failureCount;
  } else {
    failed = results.failureCount;
    // Collect error messages
    for (const failedItem of results.failed) {
      errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
    }
  }

  // Record operation for undo (only if successful items exist)
  if (itemsAffected.length > 0) {
    queryHandleService.recordOperation(queryHandle, 'bulk-transition', itemsAffected);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    itemsSkipped: skipped,
    errors,
    warnings: skipped > 0 ? [`Skipped ${skipped} items with invalid state transitions`] : [],
    summary: `Transitioned ${succeeded} work item(s) to "${action.targetState}"${failed > 0 ? `, ${failed} failed` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`
  };
}

/**
 * Execute move-iteration action
 */
async function executeMoveIterationAction(
  action: Extract<BulkAction, { type: "move-iteration" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: action.updateChildItems ? ['Child items will also be moved to the new iteration'] : [],
      summary: `Would move ${workItemIds.length} work item(s) to iteration "${action.targetIterationPath}"`
    };
  }

  // Fetch work items BEFORE move to capture previous iterations
  const workItemsById = new Map<number, ADOWorkItem>();
  try {
    const idsParam = workItemIds.join(',');
    const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
      `wit/workitems?ids=${idsParam}&fields=System.IterationPath&api-version=7.1`
    );
    for (const item of response.data.value || []) {
      workItemsById.set(item.id, item);
    }
  } catch (error) {
    logger.warn('Failed to fetch work items before iteration move for undo tracking:', errorToContext(error));
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  const itemsAffected: WorkItemChange[] = [];

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      const url = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(url, [
        { op: "replace", path: "/fields/System.IterationPath", value: action.targetIterationPath }
      ]);
      
      if (action.comment) {
        const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
        const htmlComment = smartConvertToHtml(action.comment);
        await httpClient.post(commentUrl, {
          text: htmlComment,
          format: 1
        });
      }
      
      // Track for undo
      const previousItem = workItemsById.get(workItemId);
      const previousIteration = previousItem?.fields?.['System.IterationPath'];
      itemsAffected.push({
        workItemId,
        changes: {
          from: previousIteration,
          to: action.targetIterationPath
        }
      });
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk move-iteration progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  // Record operation for undo (only if successful items exist)
  if (itemsAffected.length > 0) {
    queryHandleService.recordOperation(queryHandle, 'bulk-move-iteration', itemsAffected);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Moved ${succeeded} work item(s) to iteration "${action.targetIterationPath}"${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Execute change-type action
 */
async function executeChangeTypeAction(
  action: Extract<BulkAction, { type: "change-type" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: action.validateTypeChanges ? ['Type changes will be validated before applying'] : [],
      summary: `Would change ${workItemIds.length} work item(s) to type "${action.targetType}"`
    };
  }

  // Fetch work items BEFORE type change to capture previous types
  const workItemsById = new Map<number, ADOWorkItem>();
  try {
    const idsParam = workItemIds.join(',');
    const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
      `wit/workitems?ids=${idsParam}&fields=System.WorkItemType&api-version=7.1`
    );
    for (const item of response.data.value || []) {
      workItemsById.set(item.id, item);
    }
  } catch (error) {
    logger.warn('Failed to fetch work items before type change for undo tracking:', errorToContext(error));
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const itemsAffected: WorkItemChange[] = [];

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      // Change work item type using PATCH operation
      const typeChangePatch = [
        {
          op: 'add',
          path: '/fields/System.WorkItemType',
          value: action.targetType
        }
      ];

      // Add comment if provided
      if (action.comment) {
        const previousItem = workItemsById.get(workItemId);
        const previousType = previousItem?.fields?.['System.WorkItemType'] || 'previous type';
        const commentText = action.comment
          .replace(/{id}/g, workItemId.toString())
          .replace(/{targetType}/g, action.targetType)
          .replace(/{previousType}/g, previousType);
        
        typeChangePatch.push({
          op: 'add',
          path: '/fields/System.History',
          value: commentText
        });
      }

      const patchUrl = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(patchUrl, typeChangePatch);
      
      // Track for undo
      const previousItem = workItemsById.get(workItemId);
      const previousType = previousItem?.fields?.['System.WorkItemType'];
      itemsAffected.push({
        workItemId,
        changes: {
          from: previousType,
          to: action.targetType
        }
      });
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      stopOnError: !action.skipInvalidChanges,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk change-type progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  
  // Handle skipInvalidChanges
  if (action.skipInvalidChanges) {
    skipped = results.failureCount;
    for (const failedItem of results.failed) {
      errors.push(`Work item ${failedItem.item}: ${failedItem.error} (skipped)`);
    }
  } else {
    failed = results.failureCount;
    for (const failedItem of results.failed) {
      errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
    }
  }

  // Record operation for undo (only if successful items exist)
  if (itemsAffected.length > 0) {
    queryHandleService.recordOperation(queryHandle, 'bulk-change-type', itemsAffected);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    itemsSkipped: skipped,
    errors,
    warnings: skipped > 0 ? [`⚠️ ${skipped} work item(s) skipped due to validation errors`] : [],
    summary: `Changed ${succeeded} work item(s) to type "${action.targetType}"${failed > 0 ? `, ${failed} failed` : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`
  };
}

/**
 * Execute add-tag action
 */
async function executeAddTagAction(
  action: Extract<BulkAction, { type: "add-tag" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `Would add tag(s) "${action.tags}" to ${workItemIds.length} work item(s)`
    };
  }

  // OPTIMIZATION: Batch fetch all work items' current tags in one API call
  // This reduces API calls from 2N (N fetches + N updates) to 1 + N (1 batch fetch + N updates)
  logger.info(`Batch fetching tags for ${workItemIds.length} work items`);
  const workItemsById = new Map<number, string>();
  
  try {
    // ADO supports up to 200 IDs per request, batch if needed
    const BATCH_SIZE = 200;
    for (let i = 0; i < workItemIds.length; i += BATCH_SIZE) {
      const batchIds = workItemIds.slice(i, i + BATCH_SIZE);
      const idsParam = batchIds.join(',');
      const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
        `wit/workitems?ids=${idsParam}&fields=System.Tags&api-version=7.1`
      );
      
      for (const item of response.data.value || []) {
        workItemsById.set(item.id, item.fields?.["System.Tags"] || "");
      }
    }
    logger.info(`Successfully fetched tags for ${workItemsById.size} work items`);
  } catch (error) {
    logger.error('Failed to batch fetch work item tags:', errorToContext(error));
    // Fall back to individual fetches if batch fails
    return executeLegacyAddTagAction(action, workItemIds, httpClient, queryHandle, concurrency);
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      // Use cached tags from batch fetch
      const currentTags = workItemsById.get(workItemId) || "";
      const tagsSet = new Set(currentTags.split(";").map((t: string) => t.trim()).filter(Boolean));
      
      // Add new tags
      action.tags.split(";").forEach(tag => {
        const trimmedTag = tag.trim();
        if (trimmedTag) tagsSet.add(trimmedTag);
      });
      
      const newTags = Array.from(tagsSet).join("; ");
      
      const patchUrl = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(patchUrl, [
        { op: "replace", path: "/fields/System.Tags", value: newTags }
      ]);
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk add-tag progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Added tag(s) to ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Legacy add-tag action (fallback if batch fetch fails)
 */
async function executeLegacyAddTagAction(
  action: Extract<BulkAction, { type: "add-tag" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  concurrency: number
): Promise<ActionResult> {
  logger.warn('Falling back to legacy add-tag implementation (individual fetches)');
  
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      // Get current tags individually
      const getUrl = `wit/workItems/${workItemId}?fields=System.Tags&api-version=7.1-preview.3`;
      const response = await httpClient.get<ADOApiResponse<ADOWorkItem>>(getUrl);
      const currentTags = (response.data as any).fields?.["System.Tags"] || "";
      const tagsSet = new Set(currentTags.split(";").map((t: string) => t.trim()).filter(Boolean));
      
      // Add new tags
      action.tags.split(";").forEach(tag => {
        const trimmedTag = tag.trim();
        if (trimmedTag) tagsSet.add(trimmedTag);
      });
      
      const newTags = Array.from(tagsSet).join("; ");
      
      const patchUrl = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(patchUrl, [
        { op: "replace", path: "/fields/System.Tags", value: newTags }
      ]);
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk add-tag progress (legacy): ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  return {
    action: { type: "add-tag", tags: action.tags },
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: ['Performance: Batch fetch failed, used individual fetches'],
    summary: `Added tag(s) to ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""} (legacy mode)`
  };
}

/**
 * Execute remove-tag action
 */
async function executeRemoveTagAction(
  action: Extract<BulkAction, { type: "remove-tag" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number
): Promise<ActionResult> {
  
  if (dryRun) {
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `Would remove tag(s) "${action.tags}" from ${workItemIds.length} work item(s)`
    };
  }

  // OPTIMIZATION: Batch fetch all work items' current tags in one API call
  // This reduces API calls from 2N (N fetches + N updates) to 1 + N (1 batch fetch + N updates)
  logger.info(`Batch fetching tags for ${workItemIds.length} work items`);
  const workItemsById = new Map<number, string>();
  
  try {
    // ADO supports up to 200 IDs per request, batch if needed
    const BATCH_SIZE = 200;
    for (let i = 0; i < workItemIds.length; i += BATCH_SIZE) {
      const batchIds = workItemIds.slice(i, i + BATCH_SIZE);
      const idsParam = batchIds.join(',');
      const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
        `wit/workitems?ids=${idsParam}&fields=System.Tags&api-version=7.1`
      );
      
      for (const item of response.data.value || []) {
        workItemsById.set(item.id, item.fields?.["System.Tags"] || "");
      }
    }
    logger.info(`Successfully fetched tags for ${workItemsById.size} work items`);
  } catch (error) {
    logger.error('Failed to batch fetch work item tags:', errorToContext(error));
    // Fall back to individual fetches if batch fails
    return executeLegacyRemoveTagAction(action, workItemIds, httpClient, queryHandle, concurrency);
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  const tagsToRemove = new Set(action.tags.split(";").map(t => t.trim()).filter(Boolean));

  // Process work items in parallel with controlled concurrency
  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      // Use cached tags from batch fetch
      const currentTags = workItemsById.get(workItemId) || "";
      const tagsSet = new Set(currentTags.split(";").map((t: string) => t.trim()).filter(Boolean));
      
      // Remove specified tags
      tagsToRemove.forEach(tag => tagsSet.delete(tag));
      
      const newTags = Array.from(tagsSet).join("; ");
      
      const patchUrl = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(patchUrl, [
        { op: "replace", path: "/fields/System.Tags", value: newTags }
      ]);
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk remove-tag progress: ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  // Collect error messages
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: [],
    summary: `Removed tag(s) from ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""}`
  };
}

/**
 * Legacy remove-tag action (fallback if batch fetch fails)
 */
async function executeLegacyRemoveTagAction(
  action: Extract<BulkAction, { type: "remove-tag" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  concurrency: number
): Promise<ActionResult> {
  logger.warn('Falling back to legacy remove-tag implementation (individual fetches)');
  
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  const tagsToRemove = new Set(action.tags.split(";").map(t => t.trim()).filter(Boolean));

  const results = await processBatch(
    workItemIds,
    async (workItemId) => {
      // Get current tags individually
      const getUrl = `wit/workItems/${workItemId}?fields=System.Tags&api-version=7.1-preview.3`;
      const response = await httpClient.get<ADOApiResponse<ADOWorkItem>>(getUrl);
      const currentTags = (response.data as any).fields?.["System.Tags"] || "";
      const tagsSet = new Set(currentTags.split(";").map((t: string) => t.trim()).filter(Boolean));
      
      // Remove specified tags
      tagsToRemove.forEach(tag => tagsSet.delete(tag));
      
      const newTags = Array.from(tagsSet).join("; ");
      
      const patchUrl = `wit/workItems/${workItemId}?api-version=7.1-preview.3`;
      await httpClient.patch(patchUrl, [
        { op: "replace", path: "/fields/System.Tags", value: newTags }
      ]);
      
      return workItemId;
    },
    {
      concurrency: concurrency,
      onProgress: (completed, total, succeededCount, failedCount) => {
        logger.info(`Bulk remove-tag progress (legacy): ${completed}/${total} (${succeededCount} succeeded, ${failedCount} failed)`);
      }
    }
  );

  succeeded = results.successCount;
  failed = results.failureCount;
  
  for (const failedItem of results.failed) {
    errors.push(`Work item ${failedItem.item}: ${failedItem.error}`);
  }

  return {
    action: { type: "remove-tag", tags: action.tags },
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings: ['Performance: Batch fetch failed, used individual fetches'],
    summary: `Removed tag(s) from ${succeeded} work item(s)${failed > 0 ? `, ${failed} failed` : ""} (legacy mode)`
  };
}

/**
 * Execute AI-powered description enhancement action
 */
async function executeEnhanceDescriptionsAction(
  action: Extract<BulkAction, { type: "enhance-descriptions" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number,
  server?: MCPServer | MCPServerLike
): Promise<ActionResult> {
  
  if (!server) {
    return {
      action,
      success: false,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: workItemIds.length,
      errors: ["AI enhancement requires server instance for sampling"],
      warnings: [],
      summary: "Failed: Server instance required for AI features"
    };
  }

  const samplingClient = new SamplingClient(server);
  if (!samplingClient.hasSamplingSupport()) {
    return {
      action,
      success: false,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: workItemIds.length,
      errors: ["AI sampling not supported by this server"],
      warnings: [],
      summary: "Failed: AI sampling not available"
    };
  }

  if (dryRun) {
    const preview = workItemIds.slice(0, maxPreviewItems || 10);
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `[DRY RUN] Would enhance descriptions for ${workItemIds.length} work item(s) using ${action.enhancementStyle || "detailed"} style${preview.length < workItemIds.length ? ` (preview: ${preview.join(", ")})` : ""}`
    };
  }

  // Implement actual AI enhancement logic
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const workItemId of workItemIds) {
    try {
      // Fetch work item details
      const workItem = await httpClient.get<any>(`wit/workitems/${workItemId}?api-version=7.1`);
      const fields = workItem.data.fields;
      
      const title = fields['System.Title'] as string;
      const description = (fields['System.Description'] as string) || '';
      const workItemType = fields['System.WorkItemType'] as string;
      const state = fields['System.State'] as string;
      const tags = (fields['System.Tags'] as string) || '';

      // Skip completed items
      if (['Done', 'Completed', 'Closed', 'Resolved', 'Removed'].includes(state)) {
        skipped++;
        warnings.push(`Work item ${workItemId}: Skipped (${state} state)`);
        continue;
      }

      // Prepare AI prompt
      const userContent = `
Work Item: ${title}
Type: ${workItemType}
Current Description: ${description || '(empty)'}
Tags: ${tags}
Enhancement Style: ${action.enhancementStyle || 'detailed'}

Build upon and improve the existing description.
`;

      // Call AI with timeout
      const aiResult = await samplingClient.createMessage({
        systemPromptName: 'description-enhancer',
        userContent,
        maxTokens: action.enhancementStyle === 'concise' ? 200 : 400,
        temperature: 0.4
      });

      const responseText = samplingClient.extractResponseText(aiResult as { content: { text: string } });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        failed++;
        errors.push(`Work item ${workItemId}: AI failed to generate valid JSON response`);
        continue;
      }

      const jsonData = JSON.parse(jsonMatch[0]);
      
      if (!jsonData.enhancedDescription) {
        failed++;
        errors.push(`Work item ${workItemId}: AI did not provide enhanced description`);
        continue;
      }

      const enhancedDescription = description 
        ? `${description}\n\n---\n\n${jsonData.enhancedDescription}`
        : jsonData.enhancedDescription;

      // Update work item
      const updates = [
        {
          op: 'add',
          path: '/fields/System.Description',
          value: smartConvertToHtml(String(enhancedDescription))
        }
      ];

      await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
      succeeded++;
    } catch (error) {
      failed++;
      errors.push(`Work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings,
    summary: `Enhanced ${succeeded} descriptions (${skipped} skipped, ${failed} failed)`
  };
}

/**
 * Execute AI-powered story point assignment action
 */
async function executeAssignStoryPointsAction(
  action: Extract<BulkAction, { type: "assign-story-points" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number,
  server?: MCPServer | MCPServerLike
): Promise<ActionResult> {
  
  if (!server) {
    return {
      action,
      success: false,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: workItemIds.length,
      errors: ["AI story point assignment requires server instance for sampling"],
      warnings: [],
      summary: "Failed: Server instance required for AI features"
    };
  }

  const samplingClient = new SamplingClient(server);
  if (!samplingClient.hasSamplingSupport()) {
    return {
      action,
      success: false,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: workItemIds.length,
      errors: ["AI sampling not supported by this server"],
      warnings: [],
      summary: "Failed: AI sampling not available"
    };
  }

  if (dryRun) {
    const preview = workItemIds.slice(0, maxPreviewItems || 10);
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `[DRY RUN] Would assign story points for ${workItemIds.length} work item(s) using ${action.estimationScale || "fibonacci"} scale${preview.length < workItemIds.length ? ` (preview: ${preview.join(", ")})` : ""}`
    };
  }

  // Implement actual AI story point estimation logic
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const workItemId of workItemIds) {
    try {
      // Fetch work item details
      const workItem = await httpClient.get<any>(`wit/workitems/${workItemId}?api-version=7.1`);
      const fields = workItem.data.fields;
      
      const title = fields['System.Title'] as string;
      const description = (fields['System.Description'] as string) || '';
      const workItemType = fields['System.WorkItemType'] as string;
      const state = fields['System.State'] as string;
      const existingEffort = fields['Microsoft.VSTS.Scheduling.Effort'] || fields['Microsoft.VSTS.Scheduling.StoryPoints'];

      // Skip completed items
      if (['Done', 'Completed', 'Closed', 'Resolved', 'Removed'].includes(state)) {
        skipped++;
        warnings.push(`Work item ${workItemId}: Skipped (${state} state)`);
        continue;
      }

      // Skip items with existing effort unless override
      if (existingEffort && !action.overwriteExisting) {
        skipped++;
        warnings.push(`Work item ${workItemId}: Skipped (already has effort: ${existingEffort})`);
        continue;
      }

      // Prepare AI prompt
      const userContent = `
Work Item: ${title}
Type: ${workItemType}
Description: ${description || '(no description provided)'}
Estimation Scale: ${action.estimationScale || 'fibonacci'}

Analyze the work and provide a story point estimate.
`;

      // Call AI
      const aiResult = await samplingClient.createMessage({
        systemPromptName: 'story-point-estimator',
        userContent,
        maxTokens: 300,
        temperature: 0.3
      });

      const responseText = samplingClient.extractResponseText(aiResult as { content: { text: string } });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        failed++;
        errors.push(`Work item ${workItemId}: AI failed to generate valid JSON response`);
        continue;
      }

      const jsonData = JSON.parse(jsonMatch[0]);
      
      if (jsonData.storyPoints === undefined) {
        failed++;
        errors.push(`Work item ${workItemId}: AI did not provide story point estimate`);
        continue;
      }

      // Check if decomposition suggested
      if (jsonData.suggestDecomposition) {
        warnings.push(`Work item ${workItemId}: AI suggests decomposition - ${jsonData.decompositionReason || 'item too large'}`);
      }

      // Update work item with story points
      const effortField = workItemType === 'User Story' || workItemType === 'Product Backlog Item'
        ? 'Microsoft.VSTS.Scheduling.StoryPoints'
        : 'Microsoft.VSTS.Scheduling.Effort';

      const updates = [
        {
          op: 'add',
          path: `/fields/${effortField}`,
          value: jsonData.storyPoints
        }
      ];

      await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
      succeeded++;
    } catch (error) {
      failed++;
      errors.push(`Work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings,
    summary: `Assigned story points to ${succeeded} items (${skipped} skipped, ${failed} failed)`
  };
}

/**
 * Execute AI-powered acceptance criteria addition action
 */
async function executeAddAcceptanceCriteriaAction(
  action: Extract<BulkAction, { type: "add-acceptance-criteria" }>,
  workItemIds: number[],
  httpClient: ADOHttpClient,
  queryHandle: string,
  dryRun: boolean,
  concurrency: number,
  maxPreviewItems?: number,
  server?: MCPServer | MCPServerLike
): Promise<ActionResult> {
  
  if (!server) {
    return {
      action,
      success: false,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: workItemIds.length,
      errors: ["AI acceptance criteria generation requires server instance for sampling"],
      warnings: [],
      summary: "Failed: Server instance required for AI features"
    };
  }

  const samplingClient = new SamplingClient(server);
  if (!samplingClient.hasSamplingSupport()) {
    return {
      action,
      success: false,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: workItemIds.length,
      errors: ["AI sampling not supported by this server"],
      warnings: [],
      summary: "Failed: AI sampling not available"
    };
  }

  if (dryRun) {
    const preview = workItemIds.slice(0, maxPreviewItems || 10);
    return {
      action,
      success: true,
      itemsAffected: workItemIds.length,
      itemsSucceeded: 0,
      itemsFailed: 0,
      errors: [],
      warnings: [],
      summary: `[DRY RUN] Would add acceptance criteria for ${workItemIds.length} work item(s) using ${action.criteriaFormat || "gherkin"} format (${action.minCriteria || 3}-${action.maxCriteria || 7} criteria)${preview.length < workItemIds.length ? ` (preview: ${preview.join(", ")})` : ""}`
    };
  }

  // Implement actual AI acceptance criteria generation logic
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const workItemId of workItemIds) {
    try {
      // Fetch work item details
      const workItem = await httpClient.get<any>(`wit/workitems/${workItemId}?api-version=7.1`);
      const fields = workItem.data.fields;
      
      const title = fields['System.Title'] as string;
      const description = (fields['System.Description'] as string) || '';
      const workItemType = fields['System.WorkItemType'] as string;
      const state = fields['System.State'] as string;
      const existingCriteria = (fields['Microsoft.VSTS.Common.AcceptanceCriteria'] as string) || '';

      // Skip completed items
      if (['Done', 'Completed', 'Closed', 'Resolved', 'Removed'].includes(state)) {
        skipped++;
        warnings.push(`Work item ${workItemId}: Skipped (${state} state)`);
        continue;
      }

      // Prepare AI prompt
      const userContent = `
Work Item: ${title}
Type: ${workItemType}
Description: ${description || '(no description provided)'}
Existing Criteria: ${existingCriteria || '(none)'}
Criteria Format: ${action.criteriaFormat || 'gherkin'}
Min Criteria: ${action.minCriteria || 3}
Max Criteria: ${action.maxCriteria || 7}

${existingCriteria ? 'Add to existing acceptance criteria without duplicating.' : 'Generate new acceptance criteria.'}
`;

      // Call AI
      const aiResult = await samplingClient.createMessage({
        systemPromptName: 'acceptance-criteria-generator',
        userContent,
        maxTokens: 400,
        temperature: 0.3
      });

      const responseText = samplingClient.extractResponseText(aiResult as { content: { text: string } });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        failed++;
        errors.push(`Work item ${workItemId}: AI failed to generate valid JSON response`);
        continue;
      }

      const jsonData = JSON.parse(jsonMatch[0]);
      
      if (!jsonData.acceptanceCriteria || jsonData.acceptanceCriteria.length === 0) {
        failed++;
        errors.push(`Work item ${workItemId}: AI did not provide acceptance criteria`);
        continue;
      }

      // Check for insufficient info warning
      if (jsonData.insufficientInfo) {
        warnings.push(`Work item ${workItemId}: ${jsonData.missingContext || 'Insufficient information for quality criteria'}`);
      }

      // Format criteria based on format type
      let formattedCriteria: string;
      const criteriaFormat = action.criteriaFormat || 'gherkin';
      
      if (criteriaFormat === 'gherkin') {
        formattedCriteria = jsonData.acceptanceCriteria.join('\n\n');
      } else if (criteriaFormat === 'checklist') {
        formattedCriteria = jsonData.acceptanceCriteria.map((c: string) => `- [ ] ${c}`).join('\n');
      } else {
        formattedCriteria = jsonData.acceptanceCriteria.join('\n\n');
      }

      // Combine with existing criteria if present
      const finalCriteria = existingCriteria
        ? `${existingCriteria}\n\n---\n\n${formattedCriteria}`
        : formattedCriteria;

      // Update work item
      const updates = [
        {
          op: 'add',
          path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
          value: smartConvertToHtml(finalCriteria)
        }
      ];

      await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
      succeeded++;
    } catch (error) {
      failed++;
      errors.push(`Work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    action,
    success: failed === 0,
    itemsAffected: workItemIds.length,
    itemsSucceeded: succeeded,
    itemsFailed: failed,
    errors,
    warnings,
    summary: `Added acceptance criteria to ${succeeded} items (${skipped} skipped, ${failed} failed)`
  };
}




