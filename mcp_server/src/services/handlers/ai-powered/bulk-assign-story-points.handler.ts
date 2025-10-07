/**
 * Handler for wit-bulk-assign-story-points-by-query-handle tool
 * 
 * Uses AI to estimate story points for multiple work items based on complexity and scope.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { MCPServer } from "../../../types/mcp.js";
import type { ADOWorkItem } from "../../../types/ado.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { extractJSON } from "../../../utils/ai-helpers.js";

interface EstimationResult {
  workItemId: number;
  title: string;
  success: boolean;
  storyPoints?: number | string;
  confidence?: number;
  complexity?: string;
  estimateReasoning?: string;
  suggestDecomposition?: boolean;
  error?: string;
  skipped?: string;
}

export async function handleBulkAssignStoryPoints(config: ToolConfig, args: unknown, server: MCPServer): Promise<ToolExecutionResult> {
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
      itemSelector, 
      sampleSize, 
      pointScale, 
      onlyUnestimated, 
      includeCompleted, 
      dryRun, 
      organization, 
      project 
    } = parsed.data;

    // Check sampling support
    const samplingClient = new SamplingClient(server);
    if (!samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    // Retrieve work item IDs from query handle
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-assign-story-points" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;
    
    // Limit to sampleSize
    const itemsToProcess = selectedWorkItemIds.slice(0, sampleSize);
    
    logger.info(`Bulk story point assignment: processing ${itemsToProcess.length} of ${selectedCount} selected work items (dry_run: ${dryRun})`);

    // Fetch work item details
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: EstimationResult[] = [];

    for (const workItemId of itemsToProcess) {
      try {
        // Fetch work item
        const response = await httpClient.get(`wit/workitems/${workItemId}?api-version=7.1`);
        const workItem = response.data as ADOWorkItem;

        const title = workItem.fields['System.Title'] as string;
        const description = (workItem.fields['System.Description'] as string) || '';
        const workItemType = workItem.fields['System.WorkItemType'] as string;
        const state = workItem.fields['System.State'] as string;
        const acceptanceCriteria = (workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] as string) || '';
        const currentEffort = workItem.fields['Microsoft.VSTS.Scheduling.Effort'] as number | undefined;

        // Skip completed items (unless includeCompleted is true for historical analysis)
        if (!includeCompleted && ['Done', 'Completed', 'Closed', 'Resolved', 'Removed'].includes(state)) {
          results.push({
            workItemId,
            title,
            success: false,
            skipped: `Item is in ${state} state - not estimating completed work (set includeCompleted=true for historical analysis)`
          });
          continue;
        }

        // Skip already estimated items if onlyUnestimated=true
        if (onlyUnestimated && currentEffort !== undefined && currentEffort !== null) {
          results.push({
            workItemId,
            title,
            success: false,
            skipped: `Item already has effort estimate: ${currentEffort}`
          });
          continue;
        }

        // Prepare AI prompt
        const userContent = `
Work Item: ${title}
Type: ${workItemType}
Description: ${description || '(empty)'}
Acceptance Criteria: ${acceptanceCriteria || '(none)'}
Point Scale: ${pointScale}

Estimate the story points for this work item using the ${pointScale} scale.
`;

        // Call AI
        const aiResult = await samplingClient.createMessage({
          systemPromptName: 'story-point-estimator',
          userContent,
          maxTokens: 300,
          temperature: 0.3
        });

        const responseText = samplingClient.extractResponseText(aiResult);
        const jsonData = extractJSON(responseText);

        if (!jsonData || jsonData.storyPoints === undefined) {
          results.push({
            workItemId,
            title,
            success: false,
            error: 'AI failed to generate story point estimate'
          });
          continue;
        }

        // Update work item (unless dry run)
        if (!dryRun) {
          // For t-shirt sizing, we need to store as string in tags or comments
          // For numeric scales, store in Effort field
          if (pointScale === 't-shirt') {
            // Store t-shirt size in tags
            const currentTags = (workItem.fields['System.Tags'] as string) || '';
            const newTags = currentTags 
              ? `${currentTags};StoryPoints:${jsonData.storyPoints}` 
              : `StoryPoints:${jsonData.storyPoints}`;
            
            const updates = [
              {
                op: 'add',
                path: '/fields/System.Tags',
                value: newTags
              }
            ];
            await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
          } else {
            // Store numeric story points in Effort field
            const updates = [
              {
                op: 'add',
                path: '/fields/Microsoft.VSTS.Scheduling.Effort',
                value: typeof jsonData.storyPoints === 'string' ? parseFloat(jsonData.storyPoints) : jsonData.storyPoints
              }
            ];
            await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
          }
        }

        results.push({
          workItemId,
          title,
          success: true,
          storyPoints: jsonData.storyPoints,
          confidence: jsonData.confidence,
          complexity: jsonData.complexity,
          estimateReasoning: jsonData.estimateReasoning,
          suggestDecomposition: jsonData.suggestDecomposition
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          workItemId,
          title: 'Unknown',
          success: false,
          error: errorMsg
        });
        logger.error(`Failed to estimate story points for work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failureCount = results.filter(r => !r.success && !r.skipped).length;
    const needsDecomposition = results.filter(r => r.suggestDecomposition).length;

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        items_processed: itemsToProcess.length,
        item_selector: itemSelector,
        point_scale: pointScale,
        only_unestimated: onlyUnestimated,
        dry_run: dryRun,
        successful: successCount,
        skipped: skippedCount,
        failed: failureCount,
        needs_decomposition: needsDecomposition,
        results: results.map(r => ({
          work_item_id: r.workItemId,
          title: r.title,
          status: r.success ? 'estimated' : r.skipped ? 'skipped' : 'failed',
          story_points: r.storyPoints,
          confidence: r.confidence,
          complexity: r.complexity,
          reasoning: r.estimateReasoning,
          suggest_decomposition: r.suggestDecomposition,
          error: r.error,
          skip_reason: r.skipped
        })),
        summary: dryRun 
          ? `DRY RUN: Generated ${successCount} story point estimates (${skippedCount} skipped, ${failureCount} failed, ${needsDecomposition} need decomposition)`
          : `Successfully estimated ${successCount} story points (${skippedCount} skipped, ${failureCount} failed, ${needsDecomposition} need decomposition)`
      },
      metadata: {
        source: "bulk-assign-story-points",
        totalWorkItems: totalItems,
        selectedWorkItems: selectedCount,
        processedWorkItems: itemsToProcess.length,
        itemSelector,
        pointScale,
        dryRun,
        successful: successCount,
        skipped: skippedCount,
        failed: failureCount
      },
      errors: failureCount > 0 
        ? results.filter(r => r.error).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: [
        ...(skippedCount > 0 ? [`${skippedCount} items skipped`] : []),
        ...(needsDecomposition > 0 ? [`${needsDecomposition} items recommended for decomposition (too large)`] : [])
      ]
    };
  } catch (error) {
    logger.error('Bulk assign story points error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-assign-story-points" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
