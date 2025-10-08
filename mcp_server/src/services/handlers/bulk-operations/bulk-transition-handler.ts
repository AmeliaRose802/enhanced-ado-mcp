/**
 * Handler for wit-bulk-transition-state-by-query-handle tool
 * 
 * Safely transition multiple work items to a new state using query handle.
 * Supports common workflow transitions (New→Active, Active→Closed, etc.)
 * with optional state transition validation.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { ADOWorkItem } from "../../../types/ado.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

// Define state progression hierarchy for validation
// Used to determine if a state transition is logical
const STATE_HIERARCHY: Record<string, number> = {
  'New': 1,
  'Proposed': 1,
  'To Do': 1,
  'Active': 2,
  'Committed': 2,
  'In Progress': 2,
  'Doing': 2,
  'Resolved': 3,
  'Done': 4,
  'Completed': 4,
  'Closed': 4,
  'Removed': 5
};

// Common state transition rules
// Maps from current state to valid target states
const VALID_TRANSITIONS: Record<string, string[]> = {
  'New': ['Active', 'Committed', 'In Progress', 'Doing', 'Resolved', 'Closed', 'Removed'],
  'Proposed': ['Active', 'Committed', 'In Progress', 'Doing', 'Resolved', 'Closed', 'Removed'],
  'To Do': ['Active', 'Committed', 'In Progress', 'Doing', 'Done', 'Completed', 'Closed', 'Removed'],
  'Active': ['Resolved', 'Done', 'Completed', 'Closed', 'Removed', 'New', 'To Do'],
  'Committed': ['Active', 'In Progress', 'Doing', 'Resolved', 'Done', 'Completed', 'Closed', 'Removed'],
  'In Progress': ['Resolved', 'Done', 'Completed', 'Closed', 'Removed', 'Active', 'Committed'],
  'Doing': ['Done', 'Completed', 'Closed', 'Removed', 'Active', 'Committed'],
  'Resolved': ['Closed', 'Active', 'In Progress', 'Removed'],
  'Done': ['Closed', 'Removed', 'Active'],
  'Completed': ['Closed', 'Removed', 'Active'],
  'Closed': ['Active', 'Removed'],
  'Removed': []  // Cannot transition from Removed
};

interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate if a state transition is allowed
 */
function validateStateTransition(
  currentState: string,
  targetState: string,
  workItemType: string
): TransitionValidationResult {
  // If current state is Removed, no transitions allowed
  if (currentState === 'Removed') {
    return {
      valid: false,
      reason: `Cannot transition from 'Removed' state. Work item must be restored first.`
    };
  }

  // If target state is same as current, it's redundant but not invalid
  if (currentState === targetState) {
    return {
      valid: true,
      reason: `Work item already in target state '${targetState}'`
    };
  }

  // Check if this is a known valid transition pattern
  const validTargets = VALID_TRANSITIONS[currentState];
  if (validTargets && validTargets.includes(targetState)) {
    return { valid: true };
  }

  // Check if states exist in hierarchy (unknown states allowed through)
  const currentLevel = STATE_HIERARCHY[currentState];
  const targetLevel = STATE_HIERARCHY[targetState];
  
  if (currentLevel === undefined || targetLevel === undefined) {
    // Unknown state - allow transition but with warning
    return {
      valid: true,
      reason: `Unknown state transition (current: '${currentState}', target: '${targetState}'). Proceeding without validation.`
    };
  }

  // If not in valid transitions list but states are known, it's potentially invalid
  return {
    valid: false,
    reason: `Transition from '${currentState}' to '${targetState}' may not be allowed by work item type '${workItemType}'. Common transitions from '${currentState}' are: ${validTargets?.join(', ') || 'none'}.`
  };
}

export async function handleBulkTransitionState(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
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
      targetState, 
      reason, 
      comment, 
      itemSelector, 
      validateTransitions,
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
        metadata: { source: "bulk-transition-state-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    logger.info(`Bulk state transition: ${selectedCount} of ${totalItems} items to '${targetState}' (dry_run: ${dryRun}, validate: ${validateTransitions})`);
    if (itemSelector !== 'all') {
      logger.info(`Selection criteria: ${JSON.stringify(itemSelector)}`);
    }

    // Fetch work item details for validation if needed
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    // For validation or dry run, fetch current work item details
    let workItems: ADOWorkItem[] = [];
    if (validateTransitions || dryRun) {
      try {
        const url = `wit/workitems?ids=${selectedWorkItemIds.join(',')}&$expand=None&api-version=7.1`;
        const response = await httpClient.get<{ count: number; value: ADOWorkItem[] }>(url);
        workItems = response.data.value;
      } catch (error) {
        logger.error(`Failed to fetch work items for validation:`, error);
        return {
          success: false,
          data: null,
          metadata: { source: "bulk-transition-state-by-query-handle" },
          errors: [`Failed to fetch work items: ${error instanceof Error ? error.message : String(error)}`],
          warnings: []
        };
      }
    }

    // Validate transitions if requested
    const validationResults: Array<{
      id: number;
      currentState: string;
      type: string;
      title: string;
      validation: TransitionValidationResult;
    }> = [];

    if (validateTransitions && workItems.length > 0) {
      for (const item of workItems) {
        const currentState = item.fields['System.State'];
        const workItemType = item.fields['System.WorkItemType'];
        const title = item.fields['System.Title'];
        
        const validation = validateStateTransition(currentState, targetState, workItemType);
        validationResults.push({
          id: item.id,
          currentState,
          type: workItemType,
          title,
          validation
        });
      }

      // Check if any transitions are invalid
      const invalidTransitions = validationResults.filter(r => !r.validation.valid);
      if (invalidTransitions.length > 0) {
        const errorMessages = invalidTransitions.map(r => 
          `Work item ${r.id} (${r.type}): ${r.validation.reason}`
        );
        
        return {
          success: false,
          data: {
            query_handle: queryHandle,
            target_state: targetState,
            total_items_in_handle: totalItems,
            selected_items: selectedCount,
            item_selector: itemSelector,
            validation_results: validationResults,
            invalid_transitions: invalidTransitions.map(r => ({
              id: r.id,
              title: r.title,
              current_state: r.currentState,
              type: r.type,
              reason: r.validation.reason
            }))
          },
          metadata: { 
            source: "bulk-transition-state-by-query-handle",
            validationFailed: true
          },
          errors: errorMessages,
          warnings: ['State transition validation failed. Set validateTransitions=false to skip validation and force transitions.']
        };
      }
    }

    if (dryRun) {
      // Show preview of selected items with state changes
      const previewLimit = maxPreviewItems || 5;
      const previewItems = selectedWorkItemIds.slice(0, previewLimit).map((id: number) => {
        const workItem = workItems.find(item => item.id === id);
        const context = queryData.itemContext.find(item => item.id === id);
        const currentState = workItem?.fields['System.State'] || context?.state || 'Unknown';
        const validation = validationResults.find(r => r.id === id)?.validation;
        
        return {
          work_item_id: id,
          index: context?.index,
          title: workItem?.fields['System.Title'] || context?.title || "No title available",
          type: workItem?.fields['System.WorkItemType'] || context?.type || "Unknown",
          current_state: currentState,
          target_state: targetState,
          transition_valid: validation?.valid ?? true,
          validation_note: validation?.reason
        };
      });

      const previewMessage = selectedCount > previewLimit 
        ? `Showing ${previewLimit} of ${selectedCount} items...` 
        : undefined;

      // Count warnings from validation
      const warnings = validationResults
        .filter(r => r.validation.reason)
        .map(r => `Work item ${r.id}: ${r.validation.reason}`);

      return {
        success: true,
        data: {
          dry_run: true,
          query_handle: queryHandle,
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          item_selector: itemSelector,
          target_state: targetState,
          reason: reason,
          comment: comment,
          validate_transitions: validateTransitions,
          work_item_ids: selectedWorkItemIds,
          preview_items: previewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would transition ${selectedCount} of ${totalItems} work item(s) to state '${targetState}'${reason ? ` with reason '${reason}'` : ''}${comment ? ' (with comment)' : ''}`
        },
        metadata: { 
          source: "bulk-transition-state-by-query-handle",
          dryRun: true,
          itemSelector
        },
        errors: [],
        warnings: warnings.length > 0 ? warnings.slice(0, 5) : []
      };
    }

    // Execute bulk state transition
    const results: Array<{ 
      workItemId: number; 
      success: boolean; 
      previousState?: string;
      error?: string; 
      commentAdded?: boolean;
      skipped?: boolean;
      skipReason?: string;
    }> = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        const workItem = workItems.find(item => item.id === workItemId);
        const currentState = workItem?.fields['System.State'] || 'Unknown';

        // Skip if already in target state
        if (currentState === targetState) {
          results.push({ 
            workItemId, 
            success: true, 
            previousState: currentState,
            skipped: true,
            skipReason: 'Already in target state'
          });
          logger.debug(`Work item ${workItemId} already in state '${targetState}', skipping`);
          continue;
        }

        // Add comment if provided
        let commentAdded = false;
        if (comment) {
          try {
            const commentUrl = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
            await httpClient.post(commentUrl, {
              text: comment,
              format: 1  // 1 = Markdown, 0 = PlainText
            });
            commentAdded = true;
            logger.debug(`Added comment to work item ${workItemId}`);
          } catch (commentError) {
            logger.warn(`Failed to add comment to work item ${workItemId}, proceeding with state transition:`, commentError);
          }
        }

        // Build state transition patch
        const statePatch: Array<{ op: string; path: string; value: string }> = [
          {
            op: "add",
            path: "/fields/System.State",
            value: targetState
          }
        ];

        // Add reason if provided and state transition supports it
        if (reason) {
          statePatch.push({
            op: "add",
            path: "/fields/System.Reason",
            value: reason
          });
        }

        // Update the work item state
        const updateUrl = `wit/workItems/${workItemId}?api-version=7.1`;
        await httpClient.patch(updateUrl, statePatch);

        results.push({ 
          workItemId, 
          success: true, 
          previousState: currentState,
          commentAdded 
        });
        logger.debug(`Transitioned work item ${workItemId} from '${currentState}' to '${targetState}'`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const workItem = workItems.find(item => item.id === workItemId);
        results.push({ 
          workItemId, 
          success: false, 
          previousState: workItem?.fields['System.State'],
          error: errorMsg 
        });
        logger.error(`Failed to transition work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const commentsAdded = results.filter(r => r.commentAdded).length;

    // Build detailed result items
    const transitionedItems = results
      .filter(r => r.success && !r.skipped)
      .map(r => {
        const context = queryData.itemContext.find(item => item.id === r.workItemId);
        const workItem = workItems.find(item => item.id === r.workItemId);
        return {
          id: r.workItemId,
          title: workItem?.fields['System.Title'] || context?.title || "Unknown",
          type: workItem?.fields['System.WorkItemType'] || context?.type || "Unknown",
          previous_state: r.previousState || "Unknown",
          new_state: targetState,
          comment_added: r.commentAdded || false
        };
      });

    const summary = itemSelector === 'all'
      ? `Transitioned ${successCount - skippedCount} of ${selectedCount} work items to '${targetState}'`
      : `Transitioned ${successCount - skippedCount} selected items to '${targetState}' (from ${totalItems} total)`;

    const warnings: string[] = [];
    if (skippedCount > 0) {
      warnings.push(`${skippedCount} item(s) already in target state '${targetState}' (skipped)`);
    }

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        target_state: targetState,
        reason: reason,
        comment: comment ? 'Comment added' : undefined,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        item_selector: itemSelector,
        successful: successCount,
        failed: failureCount,
        skipped: skippedCount,
        comments_added: comment ? commentsAdded : undefined,
        transitioned_items: transitionedItems,
        results: results.map(r => ({
          id: r.workItemId,
          success: r.success,
          previous_state: r.previousState,
          skipped: r.skipped,
          skip_reason: r.skipReason,
          error: r.error
        })),
        summary: `${summary}${failureCount > 0 ? ` (${failureCount} failed)` : ''}${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${comment && commentsAdded > 0 ? `, comments added to ${commentsAdded} items` : ''}`
      },
      metadata: {
        source: "bulk-transition-state-by-query-handle",
        itemSelector,
        validateTransitions
      },
      errors: failureCount > 0 
        ? results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings
    };
  } catch (error) {
    logger.error('Bulk state transition by query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-transition-state-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
