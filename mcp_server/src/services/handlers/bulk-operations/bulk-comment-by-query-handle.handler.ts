/**
 * Handler for wit-bulk-comment-by-query-handle tool
 * 
 * Adds comments to multiple work items identified by a query handle.
 * This eliminates ID hallucination risk by using the stored query results.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { 
  buildValidationErrorResponse, 
  buildAzureCliErrorResponse,
  buildSuccessResponse,
  buildSuccessResponseWithWarnings,
  buildPartialSuccessResponse,
  buildErrorResponse,
  buildCatchErrorResponse
} from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleBulkCommentByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, comment, itemSelector, dryRun, maxPreviewItems, organization, project } = parsed.data;

    // Retrieve work item IDs and context from query handle using itemSelector
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!selectedWorkItemIds || !queryData) {
      return buildErrorResponse(
        `Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`,
        { source: "bulk-comment-by-query-handle" }
      );
    }

    // Show selection information
    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    // Function to substitute template variables in comments
    const substituteTemplate = (template: string, workItemId: number, context?: any): string => {
      if (!context || !queryData.workItemContext) {
        return template;
      }

      const workItemContext = queryData.workItemContext.get(workItemId);
      if (!workItemContext) {
        return template;
      }

      let result = template;
      
      // Substitute staleness data if available
      if (workItemContext.daysInactive !== undefined) {
        result = result.replace(/\{daysInactive\}/g, workItemContext.daysInactive.toString());
      }
      
      if (workItemContext.lastSubstantiveChangeDate) {
        result = result.replace(/\{lastSubstantiveChangeDate\}/g, workItemContext.lastSubstantiveChangeDate);
      }

      // Substitute other context data
      if (workItemContext.title) {
        result = result.replace(/\{title\}/g, workItemContext.title);
      }
      
      if (workItemContext.state) {
        result = result.replace(/\{state\}/g, workItemContext.state);
      }
      
      if (workItemContext.type) {
        result = result.replace(/\{type\}/g, workItemContext.type);
      }
      
      if (workItemContext.assignedTo) {
        result = result.replace(/\{assignedTo\}/g, workItemContext.assignedTo);
      }

      // Add work item ID itself
      result = result.replace(/\{id\}/g, workItemId.toString());

      return result;
    };

    logger.info(`Bulk comment operation: ${selectedCount} of ${totalItems} work items selected (dry_run: ${dryRun})`);

    if (dryRun) {
      // Show preview with template substitution for first few items
      const previewLimit = maxPreviewItems || 5;
      const previewItems = selectedWorkItemIds.slice(0, previewLimit).map((id: number) => {
        const context = queryData.workItemContext?.get(id);
        const substitutedComment = substituteTemplate(comment, id, context);
        return {
          work_item_id: id,
          title: context?.title || "No title available",
          substituted_comment: substitutedComment.substring(0, 200) + (substitutedComment.length > 200 ? '...' : ''),
          template_variables_found: {
            daysInactive: context?.daysInactive !== undefined,
            lastSubstantiveChangeDate: !!context?.lastSubstantiveChangeDate,
            title: !!context?.title,
            state: !!context?.state,
            assignedTo: !!context?.assignedTo
          }
        };
      });

      const hasTemplateVariables = comment.includes('{') && comment.includes('}');
      const warnings: string[] = [];
      
      if (hasTemplateVariables && !queryData.workItemContext) {
        warnings.push("Comment contains template variables (e.g., {daysInactive}) but query handle has no context data. Variables will not be substituted.");
      }

      const previewMessage = selectedCount > previewLimit 
        ? `Showing ${previewLimit} of ${selectedCount} items...` 
        : undefined;

      return buildSuccessResponseWithWarnings(
        {
          dry_run: true,
          query_handle: queryHandle,
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          item_selector: itemSelector,
          comment_template: comment,
          has_template_variables: hasTemplateVariables,
          context_data_available: !!queryData.workItemContext,
          preview_items: previewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would add ${hasTemplateVariables ? 'templated' : 'static'} comment to ${selectedCount} of ${totalItems} work item(s)`
        },
        warnings,
        { 
          source: "bulk-comment-by-query-handle",
          dryRun: true,
          itemSelector,
          hasTemplateVariables,
          contextDataAvailable: !!queryData.workItemContext
        }
      );
    }

    // Execute bulk comment operation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const results: Array<{ workItemId: number; success: boolean; error?: string }> = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        const url = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
        
        // Substitute template variables if context is available
        const context = queryData.workItemContext?.get(workItemId);
        const finalComment = substituteTemplate(comment, workItemId, context);
        
        await httpClient.post(url, {
          text: finalComment,
          format: 1  // 1 = Markdown, 0 = PlainText
        });

        results.push({ workItemId, success: true });
        logger.debug(`Added comment to work item ${workItemId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ workItemId, success: false, error: errorMsg });
        logger.error(`Failed to add comment to work item ${workItemId}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    const data = {
      query_handle: queryHandle,
      total_items_in_handle: totalItems,
      selected_items: selectedCount,
      item_selector: itemSelector,
      successful: successCount,
      failed: failureCount,
      results,
      summary: `Successfully added comment to ${successCount} of ${selectedCount} selected work items${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
    };

    const metadata = {
      source: "bulk-comment-by-query-handle",
      itemSelector
    };

    if (failureCount > 0) {
      const errors = results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`);
      return buildPartialSuccessResponse(data, errors, [], metadata);
    }

    return buildSuccessResponse(data, metadata);
  } catch (error) {
    logger.error('Bulk comment by query handle error:', error);
    return buildCatchErrorResponse(error, 'bulk-comment-by-query-handle');
  }
}
