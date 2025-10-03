/**
 * Handler for wit-bulk-add-comments tool
 * Allows adding comments to multiple work items efficiently
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { logger } from "../../utils/logger.js";
import { createADOHttpClient } from '../../utils/ado-http-client.js';

interface CommentItem {
  workItemId: number;
  comment: string;
}

interface BulkAddCommentsArgs {
  items: CommentItem[];
  template?: string;
  templateVariables?: Record<string, string>;
  organization: string;
  project: string;
}

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
 * Add comment to a work item
 */
async function addComment(
  organization: string,
  project: string,
  workItemId: number,
  comment: string
): Promise<void> {
  const httpClient = createADOHttpClient(organization, project);
  
  const operations = [
    {
      op: 'add',
      path: '/fields/System.History',
      value: comment
    }
  ];

  await httpClient.patch(`wit/workitems/${workItemId}`, operations);
}

export async function handleBulkAddComments(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      throw new Error(azValidation.error || "Azure CLI validation failed");
    }

    // Parse and validate arguments using the schema
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      throw new Error(`Validation error: ${parsed.error.message}`);
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
        source: "bulk-add-comments",
        successCount,
        failureCount
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
