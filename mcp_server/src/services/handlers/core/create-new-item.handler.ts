/**
 * Handler for wit-create-item tool
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { createWorkItem } from "../../ado-work-item-service.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger } from "../../../utils/logger.js";

export async function handleCreateNewItem(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }
    const parsed = validation;

    // Import and apply configuration defaults for work item type and other fields
    const { getRequiredConfig } = await import('../../../config/config.js');
    const requiredConfig = getRequiredConfig();
    
    // Merge parsed data with config defaults
    const workItemData = {
      ...parsed.data,
      workItemType: parsed.data.workItemType || requiredConfig.defaultWorkItemType,
      organization: parsed.data.organization || requiredConfig.organization,
      project: parsed.data.project || requiredConfig.project,
      priority: parsed.data.priority !== undefined ? parsed.data.priority : requiredConfig.defaultPriority
    };

    logger.debug(`Creating work item with REST API: ${workItemData.title} (type: ${workItemData.workItemType})`);
    
    const result = await createWorkItem(workItemData);
    
    return {
      success: true,
      data: asToolData({
        work_item: result
      }),
      metadata: { 
        source: "rest-api",
        workItemId: result.id,
        parentLinked: result.parent_linked
      },
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      metadata: { source: "rest-api" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
