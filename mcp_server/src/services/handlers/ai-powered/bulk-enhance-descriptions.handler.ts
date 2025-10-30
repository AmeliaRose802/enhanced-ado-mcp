/**
 * Handler for wit-ai-bulk-enhance-descriptions tool
 * 
 * Uses AI to generate improved descriptions for multiple work items.
 * Processes items in batches using intelligent sampling.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import type { MCPServer, MCPServerLike } from "@/types/mcp.js";
import type { ADOWorkItem } from '@/types/index.js';
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { smartConvertToHtml } from "@/utils/markdown-converter.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "@/utils/ado-http-client.js";
import { loadConfiguration } from "@/config/config.js";
import { SamplingClient } from "@/utils/sampling-client.js";
import { extractJSON, getStringOrDefault, getNumberOrDefault } from '@/utils/ai-helpers.js';
import { getTokenProvider } from '@/utils/token-provider.js';

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

/**
 * Handler for wit-ai-bulk-enhance-descriptions tool
 * 
 * Uses AI to generate improved descriptions for multiple work items.
 * The AI analyzes existing content (title, tags, current description) and generates
 * enhanced descriptions that are clear, comprehensive, and follow best practices.
 * 
 * Enhancement styles:
 * - 'concise': Brief, focused descriptions (150-200 words)
 * - 'detailed': Comprehensive descriptions with context (300-400 words)
 * - 'technical': Technical audience with implementation details
 * - 'business': Business stakeholder audience with value focus
 * 
 * @param config - Tool configuration containing the Zod schema for validation
 * @param args - Arguments object expected to contain:
 *   - queryHandle: string - The query handle ID from a previous WIQL query
 *   - itemSelector: ItemSelector - How to select items: 'all', indices array, or criteria object
 *   - sampleSize?: number - Max items to process (default: 10, max: 100)
 *   - enhancementStyle?: string - Style for descriptions: 'concise' | 'detailed' | 'technical' | 'business' (default: 'detailed')
 *   - preserveExisting?: boolean - Append to existing description vs replace (default: true)
 *   - dryRun?: boolean - Preview mode without updating Azure DevOps (default: true)
 *   - returnFormat?: string - Response format: 'summary' | 'preview' | 'full' (default: 'summary' for dry-run, 'preview' for execute)
 *   - includeTitles?: boolean - Include work item titles in response (default: false, saves ~10-50 tokens per item)
 *   - includeConfidence?: boolean - Include AI confidence scores (default: false, only shows scores < 0.85 when true)
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
 *       * enhancement_style: string - Style used for descriptions
 *       * preserve_existing: boolean - Whether existing content was preserved
 *       * dry_run: boolean - Whether changes were applied
 *       * successful: number - Count of successfully enhanced items
 *       * skipped: number - Count of skipped items (completed/closed)
 *       * failed: number - Count of failed items
 *       * results: Array of per-item enhancement results with:
 *           - work_item_id: number
 *           - enhanced_description: string (if dry_run)
 *           - improvement_reason: string - Why enhancement was needed
 *           - confidence: number (0-1) - AI confidence in enhancement
 *       * summary: string - Human-readable summary
 *   - metadata: Processing statistics and context
 *   - errors: Array of error messages for failed items
 *   - warnings: Array of warnings (skipped items)
 * @throws {Error} Returns error result (does not throw) if:
 *   - Azure CLI is not available or not logged in
 *   - AI sampling is not supported by the server
 *   - Query handle is invalid, not found, or expired
 *   - Work item fetching or updating fails
 * @example
 * ```typescript
 * // Generate concise descriptions for items missing descriptions (dry run)
 * const result = await handleBulkEnhanceDescriptions(config, {
 *   queryHandle: 'qh_abc123',
 *   itemSelector: 'all',
 *   enhancementStyle: 'concise',
 *   preserveExisting: false,
 *   dryRun: true
 * }, server);
 * ```
 * @example
 * ```typescript
 * // Add detailed technical context to active bugs
 * const result = await handleBulkEnhanceDescriptions(config, {
 *   queryHandle: 'qh_abc123',
 *   itemSelector: { states: ['Active'], tags: ['bug'] },
 *   enhancementStyle: 'technical',
 *   preserveExisting: true,
 *   dryRun: false
 * }, server);
 * ```
 * @since 1.4.0
 */
export async function handleBulkEnhanceDescriptions(config: ToolConfig, args: unknown, server: MCPServer | MCPServerLike): Promise<ToolExecutionResult> {
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
      maxPreviewItems,
      returnFormat: userReturnFormat,
      includeTitles,
      includeConfidence,
      organization, 
      project 
    } = parsed.data;

    // Apply default format based on dryRun mode if not specified
    const returnFormat = userReturnFormat || (dryRun ? 'summary' : 'preview');

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
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

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

        const responseText = samplingClient.extractResponseText(aiResult as { content: { text: string } });
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
              value: smartConvertToHtml(String(enhancedDescription))
            }
          ];

          await httpClient.patch(`wit/workitems/${workItemId}?api-version=7.1`, updates);
        }

        results.push({
          workItemId,
          title,
          success: true,
          enhancedDescription: getStringOrDefault(enhancedDescription, ''),
          improvementReason: jsonData.improvementReason ? getStringOrDefault(jsonData.improvementReason, '') : undefined,
          confidence: jsonData.confidenceScore ? getNumberOrDefault(jsonData.confidenceScore, 0) : undefined
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

    // Apply preview limit for dry-run mode
    const previewLimit = dryRun ? (maxPreviewItems || 5) : results.length;
    const displayResults = results.slice(0, previewLimit);
    const previewMessage = dryRun && results.length > previewLimit 
      ? `Showing ${previewLimit} of ${results.length} items...` 
      : undefined;

    // Format results based on returnFormat
    let formattedResults;
    if (returnFormat === 'summary') {
      // Summary: Only counts, no item details (most efficient)
      formattedResults = undefined;
    } else if (returnFormat === 'preview') {
      // Preview: Include 200 char preview of enhanced description
      formattedResults = displayResults.map(r => ({
        work_item_id: r.workItemId,
        status: r.success ? 'enhanced' : r.skipped ? 'skipped' : 'failed',
        preview: r.enhancedDescription ? r.enhancedDescription.substring(0, 200) + (r.enhancedDescription.length > 200 ? '...' : '') : undefined,
        error: r.error,
        skip_reason: r.skipped
      }));
    } else {
      // Full: Complete details (respects includeTitles and includeConfidence params)
      formattedResults = displayResults.map(r => {
        const result: Record<string, unknown> = {
          work_item_id: r.workItemId,
          status: r.success ? 'enhanced' : r.skipped ? 'skipped' : 'failed'
        };
        
        // Only include title if requested (default: false to save tokens)
        if (includeTitles) {
          result.title = r.title;
        }
        
        // Include enhanced description
        if (r.enhancedDescription) {
          result.enhanced_description = r.enhancedDescription;
        }
        
        // Include improvement reason
        if (r.improvementReason) {
          result.improvement_reason = r.improvementReason;
        }
        
        // Only include confidence when requested AND score < 0.85 (uncertainty threshold)
        if (includeConfidence && r.confidence !== undefined && r.confidence < 0.85) {
          result.confidence = r.confidence;
        }
        
        // Include error/skip messages
        if (r.error) {
          result.error = r.error;
        }
        if (r.skipped) {
          result.skip_reason = r.skipped;
        }
        
        return result;
      });
    }

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        total_items_in_handle: totalItems,
        selected_items: selectedCount,
        items_processed: itemsToProcess.length,
        item_selector: itemSelector,
        enhancement_style: enhancementStyle,
        preserve_existing: preserveExisting,
        dry_run: dryRun,
        return_format: returnFormat,
        successful: successCount,
        skipped: skippedCount,
        failed: failureCount,
        results: formattedResults,
        preview_message: previewMessage,
        summary: dryRun 
          ? `DRY RUN: Generated ${successCount} enhanced descriptions (${skippedCount} skipped, ${failureCount} failed)`
          : `Successfully enhanced ${successCount} descriptions (${skippedCount} skipped, ${failureCount} failed)`
      }),
      metadata: {
        source: "bulk-enhance-descriptions",
        itemSelector,
        enhancementStyle,
        dryRun
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
