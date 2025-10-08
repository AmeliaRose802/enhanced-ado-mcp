/**
 * Handler for wit-create-copilot-item tool
 * Creates a new work item and immediately assigns it to GitHub Copilot
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { createWorkItemAndAssignToCopilot } from "../../ado-work-item-service.js";
import { getRequiredConfig } from "../../../config/config.js";
import { logger } from "../../../utils/logger.js";
import { newCopilotItemSchema } from "../../../config/schemas.js";
import { z } from "zod";

type NewCopilotItemInput = z.infer<typeof newCopilotItemSchema>;

export async function handleNewCopilotItem(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        errors: [parsed.error.message],
        warnings: [],
        metadata: { timestamp: new Date().toISOString() },
      };
    }

    const input = parsed.data as NewCopilotItemInput;

    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();

    const createArgs = {
      title: input.title,
      parentWorkItemId: input.parentWorkItemId,
      workItemType:
        input.workItemType || requiredConfig.defaultWorkItemType || "Product Backlog Item",
      description: input.description || "",
      organization: input.organization || requiredConfig.organization,
      project: input.project || requiredConfig.project,
      repository: input.repository, // Required
      branch: input.branch || requiredConfig.gitRepository?.defaultBranch || "main",
      gitHubCopilotGuid: input.gitHubCopilotGuid || requiredConfig.gitHubCopilot?.guid || "",
      areaPath: input.areaPath || requiredConfig.defaultAreaPath || "",
      iterationPath: input.iterationPath || requiredConfig.defaultIterationPath || "",
      priority: input.priority !== undefined ? input.priority : requiredConfig.defaultPriority || 2,
      tags: input.tags || "",
      inheritParentPaths: input.inheritParentPaths !== undefined ? input.inheritParentPaths : true,
    };

    if (!createArgs.gitHubCopilotGuid) {
      return {
        success: false,
        data: null,
        errors: ["GitHub Copilot GUID not configured and not provided in arguments"],
        warnings: [],
        metadata: { timestamp: new Date().toISOString() },
      };
    }

    logger.debug(`Creating work item '${createArgs.title}' and assigning to GitHub Copilot`);

    const result = await createWorkItemAndAssignToCopilot(createArgs);

    return {
      success: true,
      data: result,
      errors: [],
      warnings: [],
      metadata: {
        timestamp: new Date().toISOString(),
        tool: "wit-create-copilot-item",
      },
    };
  } catch (error) {
    logger.error("Failed to create and assign work item to Copilot", error);
    return {
      success: false,
      data: null,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      metadata: { timestamp: new Date().toISOString() },
    };
  }
}
