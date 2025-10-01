/**
 * Handler for wit-assign-to-copilot tool
 * Assigns an existing work item to GitHub Copilot and adds branch link
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { assignWorkItemToCopilot } from "../ado-work-item-service.js";
import { getRequiredConfig } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

export async function handleAssignToCopilot(config: ToolConfig, args: any): Promise<ToolExecutionResult> {
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
    
    const assignArgs = {
      WorkItemId: input.WorkItemId,
      Organization: input.Organization || requiredConfig.organization,
      Project: input.Project || requiredConfig.project,
      Repository: input.Repository, // Required
      Branch: input.Branch || requiredConfig.gitRepository?.defaultBranch || 'main',
      GitHubCopilotGuid: input.GitHubCopilotGuid || requiredConfig.gitHubCopilot?.guid || ''
    };

    if (!assignArgs.GitHubCopilotGuid) {
      return {
        success: false,
        data: null,
        errors: ['GitHub Copilot GUID not configured and not provided in arguments'],
        warnings: [],
        raw: { stdout: '', stderr: 'GitHub Copilot GUID not configured', exitCode: 1 },
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    logger.debug(`Assigning work item ${assignArgs.WorkItemId} to GitHub Copilot`);
    
    const result = await assignWorkItemToCopilot(assignArgs);
    
    return {
      success: true,
      data: result,
      errors: [],
      warnings: result.warnings || [],
      raw: { stdout: JSON.stringify(result), stderr: '', exitCode: 0 },
      metadata: {
        timestamp: new Date().toISOString(),
        tool: 'wit-assign-to-copilot'
      }
    };
  } catch (error) {
    logger.error('Failed to assign work item to Copilot', error);
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
