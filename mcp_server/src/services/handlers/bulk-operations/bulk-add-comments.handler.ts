/**
 * Handler for wit-bulk-add-comments tool
 * Allows adding comments to multiple work items efficiently
 */

import type { ToolConfig, ToolExecutionResult, BulkAddCommentsArgs, CommentItem } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { logger } from "../../../utils/logger.js";
import { createADOHttpClient } from '../../../utils/ado-http-client.js';
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";


interface CommentResult {
  workItemId: number;
  success: boolean;
  error?: string;
}

/**
 * Apply template variables to a comment
 */
function applyTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Add comment to a work item using the comments API for proper markdown support
 */
async function addComment(
  organization: string,
  project: string,
  workItemId: number,
  comment: string
): Promise<void> {
  const httpClient = createADOHttpClient(organization, project);
  
  const url = `wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
  
  await httpClient.post(url, {
    text: comment,
    format: 1  // 1 = Markdown, 0 = PlainText
  });
}

export async function handleBulkAddComments(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    // ⚠️ DEPRECATION WARNING: Manual ID input increases hallucination risk
    logger.warn('⚠️ DEPRECATION: wit-bulk-add-comments accepts manual IDs which increases hallucination risk. Consider using wit-bulk-comment-by-query-handle with a query handle from wit-get-work-items-by-query-wiql instead.');
    
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    // Parse and validate arguments using the schema
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const {
      items,
      template,
      templateVariables,
      organization,
      project
    } = parsed.data as BulkAddCommentsArgs;

    logger.debug(`Bulk add comments: ${items.length} items`);

    const results: CommentResult[] = [];

    // Process each item
    for (const item of items) {
      try {
        let commentText = item.comment;

        // Apply template if provided
        if (template && templateVariables) {
          commentText = applyTemplate(template, {
            ...templateVariables,
            workItemId: String(item.workItemId)
          });
        }

        await addComment(organization, project, item.workItemId, commentText);

        results.push({
          workItemId: item.workItemId,
          success: true
        });
      } catch (error) {
        results.push({
          workItemId: item.workItemId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      success: successCount > 0,
      data: {
        summary: {
          total: items.length,
          succeeded: successCount,
          failed: failureCount
        },
        results: results,
        message: `Bulk comment addition complete. ${successCount} succeeded, ${failureCount} failed.`
      },
      metadata: { 
        source: "bulk-add-comments"
      },
      errors: results.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`),
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-add-comments" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
