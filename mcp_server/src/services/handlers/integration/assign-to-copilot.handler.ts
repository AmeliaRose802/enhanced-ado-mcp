/**
 * Handler for wit-assign-copilot tool
 * Assigns an existing work item to GitHub Copilot and adds branch link
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { assignWorkItemToCopilot } from "../../ado-work-item-service.js";
import { getRequiredConfig } from "../../../config/config.js";
import { logger } from "../../../utils/logger.js";
import { assignToCopilotSchema } from "../../../config/schemas.js";
import { z } from "zod";

type AssignToCopilotInput = z.infer<typeof assignToCopilotSchema>;

export async function handleAssignToCopilot(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        errors: [parsed.error.message],
        warnings: [],
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    const input = parsed.data as AssignToCopilotInput;
    
    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();
    
    const assignArgs = {
      workItemId: input.workItemId,
      organization: input.organization || requiredConfig.organization,
      project: input.project || requiredConfig.project,
      repository: input.repository, // Required
      branch: input.branch || requiredConfig.gitRepository?.defaultBranch || 'main',
      gitHubCopilotGuid: input.gitHubCopilotGuid || requiredConfig.gitHubCopilot?.guid || ''
    };

    if (!assignArgs.gitHubCopilotGuid) {
      return {
        success: false,
        data: null,
        errors: ['GitHub Copilot GUID not configured and not provided in arguments'],
        warnings: [],
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    logger.debug(`Assigning work item ${assignArgs.workItemId} to GitHub Copilot`);
    
    const result = await assignWorkItemToCopilot(assignArgs);
    
    return {
      success: true,
      data: result,
      errors: [],
      warnings: result.warnings || [],
      metadata: {
        timestamp: new Date().toISOString(),
        tool: 'wit-assign-copilot'
      }
    };
  } catch (error) {
    logger.error('Failed to assign work item to Copilot', error);
    return {
      success: false,
      data: null,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      metadata: { timestamp: new Date().toISOString() }
    };
  }
}
