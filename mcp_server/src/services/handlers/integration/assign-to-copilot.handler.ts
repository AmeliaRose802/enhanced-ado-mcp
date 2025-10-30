/**
 * Handler for wit-assign-copilot tool
 * Assigns an existing work item to GitHub Copilot and adds branch link
 */

import type { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { assignWorkItemToCopilot } from "../../ado-work-item-service.js";
import { getRequiredConfig } from "@/config/config.js";
import { logger } from "@/utils/logger.js";
import { assignToCopilotSchema } from "@/config/schemas.js";
import { buildValidationErrorResponse, buildErrorResponse, buildSuccessResponse, buildBusinessLogicError } from "@/utils/response-builder.js";
import { z } from "zod";

type AssignToCopilotInput = z.infer<typeof assignToCopilotSchema>;

export async function handleAssignToCopilot(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, 'assign-to-copilot');
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
      return buildBusinessLogicError(
        'GitHub Copilot GUID not configured and not provided in arguments',
        { source: 'assign-to-copilot' }
      );
    }

    logger.debug(`Assigning work item ${assignArgs.workItemId} to GitHub Copilot`);
    
    const result = await assignWorkItemToCopilot(assignArgs);
    
    const response = buildSuccessResponse(
      result,
      { tool: 'wit-assign-copilot' }
    );
    response.warnings = result.warnings || [];
    return response;
  } catch (error) {
    logger.error('Failed to assign work item to Copilot', error);
    return buildErrorResponse(
      error as Error,
      { source: 'assign-to-copilot' }
    );
  }
}
