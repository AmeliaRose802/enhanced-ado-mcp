/**
 * Handler for wit-new-copilot-item tool
 * Creates a new work item and immediately assigns it to GitHub Copilot
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { createWorkItemAndAssignToCopilot } from "../ado-work-item-service.js";
import { getRequiredConfig } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

export async function handleNewCopilotItem(config: ToolConfig, args: any): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        errors: [parsed.error.message],
        warnings: [],
        raw: { stdout: '', stderr: parsed.error.message, exitCode: 1 },
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    const input = parsed.data as any;
    
    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();
    
    const createArgs = {
      Title: input.Title,
      ParentWorkItemId: input.ParentWorkItemId,
      WorkItemType: input.WorkItemType || requiredConfig.defaultWorkItemType || 'Product Backlog Item',
      Description: input.Description || '',
      Organization: input.Organization || requiredConfig.organization,
      Project: input.Project || requiredConfig.project,
      Repository: input.Repository, // Required
      Branch: input.Branch || requiredConfig.gitRepository?.defaultBranch || 'main',
      GitHubCopilotGuid: input.GitHubCopilotGuid || requiredConfig.gitHubCopilot?.guid || '',
      AreaPath: input.AreaPath || requiredConfig.defaultAreaPath || '',
      IterationPath: input.IterationPath || requiredConfig.defaultIterationPath || '',
      Priority: input.Priority !== undefined ? input.Priority : (requiredConfig.defaultPriority || 2),
      Tags: input.Tags || '',
      InheritParentPaths: input.InheritParentPaths !== undefined ? input.InheritParentPaths : true
    };

    if (!createArgs.GitHubCopilotGuid) {
      return {
        success: false,
        data: null,
        errors: ['GitHub Copilot GUID not configured and not provided in arguments'],
        warnings: [],
        raw: { stdout: '', stderr: 'GitHub Copilot GUID not configured', exitCode: 1 },
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    logger.debug(`Creating work item '${createArgs.Title}' and assigning to GitHub Copilot`);
    
    const result = await createWorkItemAndAssignToCopilot(createArgs);
    
    return {
      success: true,
      data: result,
      errors: [],
      warnings: [],
      raw: { stdout: JSON.stringify(result), stderr: '', exitCode: 0 },
      metadata: {
        timestamp: new Date().toISOString(),
        tool: 'wit-new-copilot-item'
      }
    };
  } catch (error) {
    logger.error('Failed to create and assign work item to Copilot', error);
    return {
      success: false,
      data: null,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
      metadata: { timestamp: new Date().toISOString() }
    };
  }
}
