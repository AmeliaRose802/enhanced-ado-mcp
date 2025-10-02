/**
 * Handler for wit-bulk-state-transition tool
 * Allows changing state of multiple work items in a single call
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { logger } from "../../utils/logger.js";
import { execSync } from 'child_process';
import { AZURE_DEVOPS_RESOURCE_ID } from '../../config/config.js';

interface BulkStateTransitionArgs {
  WorkItemIds: number[];
  NewState: string;
  Comment?: string;
  Reason?: string;
  DryRun?: boolean;
  Organization: string;
  Project: string;
}

interface TransitionResult {
  workItemId: number;
  success: boolean;
  previousState?: string;
  newState?: string;
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
 * Get work item details
 */
async function getWorkItem(
  organization: string,
  project: string,
  workItemId: number,
  token: string
): Promise<any> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  
  const curlCommand = `curl -s -H "Authorization: Bearer ${token}" "${url}"`;
  const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return JSON.parse(response);
}

/**
 * Update work item state
 */
async function updateWorkItemState(
  organization: string,
  project: string,
  workItemId: number,
  newState: string,
  reason: string | undefined,
  comment: string | undefined,
  token: string
): Promise<any> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  
  const operations: any[] = [
    {
      op: 'add',
      path: '/fields/System.State',
      value: newState
    }
  ];

  if (reason) {
    operations.push({
      op: 'add',
      path: '/fields/System.Reason',
      value: reason
    });
  }

  if (comment) {
    operations.push({
      op: 'add',
      path: '/fields/System.History',
      value: comment
    });
  }

  const payload = JSON.stringify(operations);
  const curlCommand = `curl -s -X PATCH -H "Authorization: Bearer ${token}" -H "Content-Type: application/json-patch+json" -d '${payload.replace(/'/g, "'\\''")}' "${url}"`;
  
  const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return JSON.parse(response);
}

/**
 * Validate state transition for a work item
 */
async function validateStateTransition(
  organization: string,
  project: string,
  workItemId: number,
  newState: string,
  token: string
): Promise<{ valid: boolean; currentState?: string; error?: string; workItemType?: string; title?: string }> {
  try {
    const workItem = await getWorkItem(organization, project, workItemId, token);
    
    if (!workItem || !workItem.fields) {
      return { 
        valid: false, 
        error: `Work item ${workItemId} not found or inaccessible` 
      };
    }

    const currentState = workItem.fields['System.State'];
    const workItemType = workItem.fields['System.WorkItemType'];
    const title = workItem.fields['System.Title'];

    // Check if already in target state
    if (currentState === newState) {
      return {
        valid: false,
        currentState,
        workItemType,
        title,
        error: `Already in state '${newState}'`
      };
    }

    // Check if in terminal state (cannot transition from terminal states)
    const terminalStates = ['Closed', 'Removed', 'Resolved', 'Done', 'Completed'];
    if (terminalStates.includes(currentState) && !terminalStates.includes(newState)) {
      return {
        valid: false,
        currentState,
        workItemType,
        title,
        error: `Cannot transition from terminal state '${currentState}'`
      };
    }

    return {
      valid: true,
      currentState,
      workItemType,
      title
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function handleBulkStateTransition(config: any, args: any): Promise<ToolExecutionResult> {
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
      WorkItemIds,
      NewState,
      Comment,
      Reason,
      DryRun = false,
      Organization,
      Project
    } = parsed.data as BulkStateTransitionArgs;

    logger.debug(`Bulk state transition: ${WorkItemIds.length} items to '${NewState}' (dry-run: ${DryRun})`);

    const token = getAzureDevOpsToken();
    const results: TransitionResult[] = [];
    const validationResults: any[] = [];

    // Validate all items first
    for (const workItemId of WorkItemIds) {
      const validation = await validateStateTransition(
        Organization,
        Project,
        workItemId,
        NewState,
        token
      );

      validationResults.push({
        workItemId,
        ...validation
      });

      if (!validation.valid) {
        results.push({
          workItemId,
          success: false,
          error: validation.error
        });
      }
    }

    // If dry-run, return validation results only
    if (DryRun) {
      const validCount = validationResults.filter(v => v.valid).length;
      const invalidCount = validationResults.filter(v => !v.valid).length;

      return {
        success: true,
        data: {
          dryRun: true,
          summary: {
            total: WorkItemIds.length,
            valid: validCount,
            invalid: invalidCount,
            wouldUpdate: validCount
          },
          validations: validationResults,
          message: `Dry-run complete. ${validCount} of ${WorkItemIds.length} items can be transitioned to '${NewState}'.`
        },
        raw: {
          stdout: JSON.stringify({ validations: validationResults }, null, 2),
          stderr: "",
          exitCode: 0
        },
        metadata: { 
          source: "bulk-state-transition",
          dryRun: true
        },
        errors: [],
        warnings: invalidCount > 0 ? [`${invalidCount} items cannot be transitioned`] : []
      };
    }

    // Perform actual state transitions for valid items
    for (const validation of validationResults) {
      if (validation.valid) {
        try {
          const updated = await updateWorkItemState(
            Organization,
            Project,
            validation.workItemId,
            NewState,
            Reason,
            Comment,
            token
          );

          results.push({
            workItemId: validation.workItemId,
            success: true,
            previousState: validation.currentState,
            newState: updated.fields['System.State']
          });
        } catch (error) {
          results.push({
            workItemId: validation.workItemId,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      success: successCount > 0,
      data: {
        summary: {
          total: WorkItemIds.length,
          succeeded: successCount,
          failed: failureCount
        },
        results: results,
        message: `Bulk state transition complete. ${successCount} succeeded, ${failureCount} failed.`
      },
      raw: {
        stdout: JSON.stringify({ results }, null, 2),
        stderr: failureCount > 0 ? `${failureCount} items failed to transition` : "",
        exitCode: failureCount > 0 ? 1 : 0
      },
      metadata: { 
        source: "bulk-state-transition",
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
      metadata: { source: "bulk-state-transition" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
