/**
 * Handler for wit-bulk-enhance-descriptions-by-query-handle tool
 * 
 * Uses AI to generate improved descriptions for multiple work items.
 * Processes items in batches using intelligent sampling.
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

interface EnhancementResult {
  workItemId: number;
  title: string;
  success: boolean;
  enhancedDescription?: string;
  improvementReason?: string;
  confidence?: number;
  error?: string;
  skipped?: string;
}

export async function handleBulkEnhanceDescriptions(config: ToolConfig, args: unknown, server: MCPServer): Promise<ToolExecutionResult> {
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
      enhancementStyle, 
      preserveExisting, 
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
        metadata: { source: "bulk-enhance-descriptions" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;
    
    // Limit to sampleSize
    const itemsToProcess = selectedWorkItemIds.slice(0, sampleSize);
    
    logger.info(`Bulk description enhancement: processing ${itemsToProcess.length} of ${selectedCount} selected work items (dry_run: ${dryRun})`);

    // Fetch work item details
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: EnhancementResult[] = [];

    for (const workItemId of itemsToProcess) {
      try {
        // Fetch work item
        const response = await httpClient.get(`wit/workitems/${workItemId}?api-version=7.1`);
        const workItem = response.data as ADOWorkItem;

        const title = workItem.fields['System.Title'] as string;
        const description = (workItem.fields['System.Description'] as string) || '';
        const workItemType = workItem.fields['System.WorkItemType'] as string;
        const state = workItem.fields['System.State'] as string;
        const tags = (workItem.fields['System.Tags'] as string) || '';

        // Skip completed items
        if (['Done', 'Completed', 'Closed', 'Resolved', 'Removed'].includes(state)) {
          results.push({
            workItemId,
            title,
            success: false,
            skipped: `Item is in ${state} state - not processing completed work`
          });
          continue;
        }

        // Prepare AI prompt
        const userContent = `
Work Item: ${title}
Type: ${workItemType}
Current Description: ${description || '(empty)'}
Tags: ${tags}
Enhancement Style: ${enhancementStyle}
Preserve Existing: ${preserveExisting}

${preserveExisting && description ? 'Build upon and improve the existing description.' : 'Create a new comprehensive description.'}
`;

        // Call AI
        const aiResult = await samplingClient.createMessage({
          systemPromptName: 'description-enhancer',
          userContent,
          maxTokens: enhancementStyle === 'concise' ? 200 : 400,
          temperature: 0.4
        });

        const responseText = samplingClient.extractResponseText(aiResult);
        const jsonData = extractJSON(responseText);

        if (!jsonData || !jsonData.enhancedDescription) {
          results.push({
            workItemId,
            title,
            success: false,
            error: 'AI failed to generate enhanced description'
          });
          continue;
        }

        const enhancedDescription = preserveExisting && description 
          ? `${description}\n\n---\n\n${jsonData.enhancedDescription}`
          : jsonData.enhancedDescription;

        // Update work item (unless dry run)
        if (!dryRun) {
          const updates = [
            {
              op: 'add',
              path: '/fields/System.Description',
              value: enhancedDescription
            }
          ];

          await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
        }

        results.push({
          workItemId,
          title,
          success: true,
          enhancedDescription,
          improvementReason: jsonData.improvementReason,
          confidence: jsonData.confidenceScore
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          workItemId,
          title: 'Unknown',
          success: false,
          error: errorMsg
        });
        logger.error(`Failed to enhance description for work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failureCount = results.filter(r => !r.success && !r.skipped).length;

    return {
      success: failureCount === 0,
      data: {
        query_handle: queryHandle,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        items_processed: itemsToProcess.length,
        item_selector: itemSelector,
        enhancement_style: enhancementStyle,
        preserve_existing: preserveExisting,
        dry_run: dryRun,
        successful: successCount,
        skipped: skippedCount,
        failed: failureCount,
        results: results.map(r => ({
          work_item_id: r.workItemId,
          title: r.title,
          status: r.success ? 'enhanced' : r.skipped ? 'skipped' : 'failed',
          enhanced_description: dryRun ? r.enhancedDescription : undefined,
          improvement_reason: r.improvementReason,
          confidence: r.confidence,
          error: r.error,
          skip_reason: r.skipped
        })),
        summary: dryRun 
          ? `DRY RUN: Generated ${successCount} enhanced descriptions (${skippedCount} skipped, ${failureCount} failed)`
          : `Successfully enhanced ${successCount} descriptions (${skippedCount} skipped, ${failureCount} failed)`
      },
      metadata: {
        source: "bulk-enhance-descriptions",
        totalWorkItems: totalItems,
        selectedWorkItems: selectedCount,
        processedWorkItems: itemsToProcess.length,
        itemSelector,
        enhancementStyle,
        dryRun,
        successful: successCount,
        skipped: skippedCount,
        failed: failureCount
      },
      errors: failureCount > 0 
        ? results.filter(r => r.error).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: skippedCount > 0 
        ? [`${skippedCount} items skipped (completed/closed work items)`]
        : []
    };
  } catch (error) {
    logger.error('Bulk enhance descriptions error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-enhance-descriptions" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
