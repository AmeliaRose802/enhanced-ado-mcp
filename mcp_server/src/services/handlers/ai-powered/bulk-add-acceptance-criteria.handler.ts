/**
 * Handler for wit-ai-bulk-acceptance-criteria tool
 * 
 * Uses AI to generate acceptance criteria for multiple work items.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import type { ADOWorkItem } from "../../../types/ado.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { extractJSON } from "../../../utils/ai-helpers.js";

interface CriteriaResult {
  workItemId: number;
  title: string;
  success: boolean;
  acceptanceCriteria?: string[];
  criteriaFormat?: string;
  confidence?: number;
  insufficientInfo?: boolean;
  error?: string;
  skipped?: string;
}

/**
 * Handler for wit-ai-bulk-acceptance-criteria tool
 * 
 * Uses AI to generate acceptance criteria for multiple work items identified by a query handle.
 * The AI generates testable, specific criteria in the requested format (Gherkin, checklist, or user story).
 * 
 * This handler processes work items in batches, generating acceptance criteria that are:
 * - Specific and testable
 * - Cover happy paths, edge cases, and error conditions
 * - Include performance/security considerations when relevant
 * - Avoid vague terms like "works well"
 * 
 * @param config - Tool configuration containing the Zod schema for validation
 * @param args - Arguments object expected to contain:
 *   - queryHandle: string - The query handle ID from a previous WIQL query
 *   - itemSelector: ItemSelector - How to select items: 'all', indices array, or criteria object
 *   - sampleSize?: number - Max items to process (default: 10, max: 100)
 *   - criteriaFormat?: string - Format for criteria: 'gherkin' | 'checklist' | 'user-story' (default: 'gherkin')
 *   - minCriteria?: number - Minimum criteria to generate per item (default: 3)
 *   - maxCriteria?: number - Maximum criteria to generate per item (default: 7)
 *   - preserveExisting?: boolean - Append to existing criteria vs replace (default: true)
 *   - dryRun?: boolean - Preview mode without updating Azure DevOps (default: true)
 *   - organization?: string - Azure DevOps organization (defaults to config value)
 *   - project?: string - Azure DevOps project (defaults to config value)
 * @param server - MCP server instance for AI sampling capabilities
 * @returns Promise<ToolExecutionResult> with the following structure:
 *   - success: boolean - True if all items processed without errors
 *   - data: Object containing:
 *       * query_handle: string - The input query handle
 *       * total_items_in_handle: number - Total items in query handle
 *       * selected_items: number - Items matching itemSelector
 *       * items_processed: number - Items actually processed (limited by sampleSize)
 *       * item_selector: ItemSelector - The selection pattern used
 *       * criteria_format: string - Format used for criteria
 *       * dry_run: boolean - Whether changes were applied
 *       * successful: number - Count of successfully processed items
 *       * skipped: number - Count of skipped items (completed/closed)
 *       * failed: number - Count of failed items
 *       * low_confidence: number - Count of items with insufficient info
 *       * results: Array of per-item results
 *       * summary: string - Human-readable summary
 *   - metadata: Processing statistics and context
 *   - errors: Array of error messages for failed items
 *   - warnings: Array of warnings (skipped items, low confidence)
 * @throws {Error} Returns error result (does not throw) if:
 *   - Azure CLI is not available or not logged in
 *   - AI sampling is not supported by the server
 *   - Query handle is invalid, not found, or expired
 *   - Work item fetching or updating fails
 * @example
 * ```typescript
 * // Generate Gherkin acceptance criteria for all items (dry run)
 * const result = await handleBulkAddAcceptanceCriteria(config, {
 *   queryHandle: 'qh_abc123',
 *   itemSelector: 'all',
 *   criteriaFormat: 'gherkin',
 *   dryRun: true
 * }, server);
 * ```
 * @example
 * ```typescript
 * // Add checklist criteria to stale active items
 * const result = await handleBulkAddAcceptanceCriteria(config, {
 *   queryHandle: 'qh_abc123',
 *   itemSelector: { states: ['Active'], daysInactiveMin: 7 },
 *   criteriaFormat: 'checklist',
 *   preserveExisting: false,
 *   dryRun: false
 * }, server);
 * ```
 * @since 1.4.0
 */
export async function handleBulkAddAcceptanceCriteria(config: ToolConfig, args: unknown, server: MCPServer | MCPServerLike): Promise<ToolExecutionResult> {
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
      criteriaFormat, 
      minCriteria, 
      maxCriteria, 
      preserveExisting, 
      dryRun, 
      maxPreviewItems,
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
        metadata: { source: "bulk-add-acceptance-criteria" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;
    
    // Limit to sampleSize
    const itemsToProcess = selectedWorkItemIds.slice(0, sampleSize);
    
    logger.info(`Bulk acceptance criteria generation: processing ${itemsToProcess.length} of ${selectedCount} selected work items (dry_run: ${dryRun})`);

    // Fetch work item details
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: CriteriaResult[] = [];

    for (const workItemId of itemsToProcess) {
      try {
        // Fetch work item
        const response = await httpClient.get(`wit/workitems/${workItemId}?api-version=7.1`);
        const workItem = response.data as ADOWorkItem;

        const title = workItem.fields['System.Title'] as string;
        const description = (workItem.fields['System.Description'] as string) || '';
        const workItemType = workItem.fields['System.WorkItemType'] as string;
        const state = workItem.fields['System.State'] as string;
        const currentCriteria = (workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] as string) || '';

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
Description: ${description || '(empty)'}
Current Acceptance Criteria: ${currentCriteria || '(none)'}
Criteria Format: ${criteriaFormat}
Min Criteria: ${minCriteria}
Max Criteria: ${maxCriteria}
Preserve Existing: ${preserveExisting}

Generate ${minCriteria}-${maxCriteria} acceptance criteria in ${criteriaFormat} format.
${preserveExisting && currentCriteria ? 'Add to existing criteria without duplicating.' : 'Create new acceptance criteria.'}
`;

        // Call AI
        const aiResult = await samplingClient.createMessage({
          systemPromptName: 'acceptance-criteria-generator',
          userContent,
          maxTokens: 500,
          temperature: 0.4
        });

        const responseText = samplingClient.extractResponseText(aiResult);
        const jsonData = extractJSON(responseText);

        if (!jsonData || !jsonData.acceptanceCriteria || jsonData.acceptanceCriteria.length === 0) {
          results.push({
            workItemId,
            title,
            success: false,
            error: 'AI failed to generate acceptance criteria'
          });
          continue;
        }

        // Format criteria based on format
        let formattedCriteria: string;
        if (criteriaFormat === 'gherkin') {
          formattedCriteria = jsonData.acceptanceCriteria.join('\n\n');
        } else if (criteriaFormat === 'checklist') {
          formattedCriteria = jsonData.acceptanceCriteria.map((c: string) => `- [ ] ${c}`).join('\n');
        } else { // user-story
          formattedCriteria = jsonData.acceptanceCriteria.join('\n\n');
        }

        const finalCriteria = preserveExisting && currentCriteria 
          ? `${currentCriteria}\n\n---\n\n${formattedCriteria}`
          : formattedCriteria;

        // Update work item (unless dry run)
        if (!dryRun) {
          const updates = [
            {
              op: 'add',
              path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
              value: finalCriteria
            }
          ];

          await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
        }

        results.push({
          workItemId,
          title,
          success: true,
          acceptanceCriteria: jsonData.acceptanceCriteria,
          criteriaFormat: jsonData.criteriaFormat,
          confidence: jsonData.confidence,
          insufficientInfo: jsonData.insufficientInfo
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          workItemId,
          title: 'Unknown',
          success: false,
          error: errorMsg
        });
        logger.error(`Failed to add acceptance criteria for work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failureCount = results.filter(r => !r.success && !r.skipped).length;
    const lowConfidence = results.filter(r => r.insufficientInfo).length;

    // Apply preview limit for dry-run mode
    const previewLimit = dryRun ? (maxPreviewItems || 5) : results.length;
    const displayResults = results.slice(0, previewLimit);
    const previewMessage = dryRun && results.length > previewLimit 
      ? `Showing ${previewLimit} of ${results.length} items...` 
      : undefined;

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        items_processed: itemsToProcess.length,
        item_selector: itemSelector,
        criteria_format: criteriaFormat,
        min_criteria: minCriteria,
        max_criteria: maxCriteria,
        preserve_existing: preserveExisting,
        dry_run: dryRun,
        successful: successCount,
        skipped: skippedCount,
        failed: failureCount,
        low_confidence: lowConfidence,
        results: displayResults.map(r => ({
          work_item_id: r.workItemId,
          title: r.title,
          status: r.success ? 'criteria_added' : r.skipped ? 'skipped' : 'failed',
          acceptance_criteria: dryRun ? r.acceptanceCriteria : undefined,
          criteria_count: r.acceptanceCriteria?.length,
          format: r.criteriaFormat,
          confidence: r.confidence,
          insufficient_info: r.insufficientInfo,
          error: r.error,
          skip_reason: r.skipped
        })),
        preview_message: previewMessage,
        summary: dryRun 
          ? `DRY RUN: Generated acceptance criteria for ${successCount} items (${skippedCount} skipped, ${failureCount} failed, ${lowConfidence} low confidence)`
          : `Successfully added acceptance criteria to ${successCount} items (${skippedCount} skipped, ${failureCount} failed, ${lowConfidence} low confidence)`
      }),
      metadata: {
        source: "bulk-add-acceptance-criteria",
        itemSelector,
        criteriaFormat,
        dryRun
      },
      errors: failureCount > 0 
        ? results.filter(r => r.error).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings: [
        ...(skippedCount > 0 ? [`${skippedCount} items skipped`] : []),
        ...(lowConfidence > 0 ? [`${lowConfidence} items had insufficient information for high-quality criteria`] : [])
      ]
    };
  } catch (error) {
    logger.error('Bulk add acceptance criteria error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-add-acceptance-criteria" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
