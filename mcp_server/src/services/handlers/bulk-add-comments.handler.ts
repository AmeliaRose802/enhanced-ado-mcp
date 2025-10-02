/**
 * Handler for wit-bulk-add-comments tool
 * Allows adding comments to multiple work items efficiently
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { logger } from "../../utils/logger.js";
import { execSync } from 'child_process';
import { AZURE_DEVOPS_RESOURCE_ID } from '../../config/config.js';

interface CommentItem {
  WorkItemId: number;
  Comment: string;
}

interface BulkAddCommentsArgs {
  Items: CommentItem[];
  Template?: string;
  TemplateVariables?: Record<string, string>;
  Organization: string;
  Project: string;
}

interface CommentResult {
  workItemId: number;
  success: boolean;
  error?: string;
}

/**
 * Get Azure DevOps PAT token from Azure CLI
 */
function getAzureDevOpsToken(): string {
  try {
    const result = execSync(
      `az account get-access-token --resource ${AZURE_DEVOPS_RESOURCE_ID} --query accessToken -o tsv`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (error) {
    logger.error('Failed to get Azure DevOps token from Azure CLI', error);
    throw new Error('Failed to authenticate with Azure DevOps. Please ensure you are logged in with: az login');
  }
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
  comment: string,
  token: string
): Promise<void> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  
  const operations = [
    {
      op: 'add',
      path: '/fields/System.History',
      value: comment
    }
  ];

  const payload = JSON.stringify(operations);
  const curlCommand = `curl -s -X PATCH -H "Authorization: Bearer ${token}" -H "Content-Type: application/json-patch+json" -d '${payload.replace(/'/g, "'\\''")}' "${url}"`;
  
  execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

export async function handleBulkAddComments(config: any, args: any): Promise<ToolExecutionResult> {
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
      Items,
      Template,
      TemplateVariables,
      Organization,
      Project
    } = parsed.data as BulkAddCommentsArgs;

    logger.debug(`Bulk add comments: ${Items.length} items`);

    const token = getAzureDevOpsToken();
    const results: CommentResult[] = [];

    // Process each item
    for (const item of Items) {
      try {
        let commentText = item.Comment;

        // Apply template if provided
        if (Template && TemplateVariables) {
          commentText = applyTemplate(Template, {
            ...TemplateVariables,
            workItemId: String(item.WorkItemId)
          });
        }

        await addComment(Organization, Project, item.WorkItemId, commentText, token);

        results.push({
          workItemId: item.WorkItemId,
          success: true
        });
      } catch (error) {
        results.push({
          workItemId: item.WorkItemId,
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
          total: Items.length,
          succeeded: successCount,
          failed: failureCount
        },
        results: results,
        message: `Bulk comment addition complete. ${successCount} succeeded, ${failureCount} failed.`
      },
      raw: {
        stdout: JSON.stringify({ results }, null, 2),
        stderr: failureCount > 0 ? `${failureCount} items failed to add comment` : "",
        exitCode: failureCount > 0 ? 1 : 0
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
      raw: {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1
      },
      metadata: { source: "bulk-add-comments" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
