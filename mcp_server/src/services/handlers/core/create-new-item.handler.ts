/**
 * Handler for wit-create-item tool
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { createWorkItem } from "../../ado-work-item-service.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";

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
    
    // Get configured area paths (handle backward compatibility)
    const configuredPaths = requiredConfig.defaultAreaPaths || [];
    
    // Validate area path when multiple configured
    if (parsed.data.areaPath) {
      if (configuredPaths.length > 1 && !configuredPaths.includes(parsed.data.areaPath)) {
        return {
          success: false,
          data: null,
          metadata: { source: "rest-api" },
          errors: [
            `Area path '${parsed.data.areaPath}' not in configured paths: ${configuredPaths.join(', ')}. ` +
            `Please use one of the configured area paths.`
          ],
          warnings: []
        };
      }
    }
    
    // Determine area path: explicit > default (warn if multiple configured)
    let areaPath = parsed.data.areaPath;
    if (!areaPath) {
      if (configuredPaths.length > 1) {
        return {
          success: false,
          data: null,
          metadata: { source: "rest-api" },
          errors: [
            `Multiple area paths configured: ${configuredPaths.join(', ')}. ` +
            `Please specify explicit 'areaPath' parameter when creating work items.`
          ],
          warnings: []
        };
      }
      areaPath = requiredConfig.defaultAreaPath;
    }
    
    // Merge parsed data with config defaults
    const workItemData = {
      ...parsed.data,
      areaPath,
      workItemType: parsed.data.workItemType || requiredConfig.defaultWorkItemType,
      organization: parsed.data.organization || requiredConfig.organization,
      project: parsed.data.project || requiredConfig.project,
      priority: parsed.data.priority !== undefined ? parsed.data.priority : requiredConfig.defaultPriority
    };

    logger.debug(`Creating work item with REST API: ${workItemData.title} (type: ${workItemData.workItemType})`);
    
    const result = await createWorkItem(workItemData);
    
    const warnings: string[] = [];
    if (configuredPaths.length > 1 && !parsed.data.areaPath) {
      warnings.push(`Used first configured area path: ${areaPath}. Consider specifying explicit areaPath for clarity.`);
    }
    
    // Create query handle for the newly created work item
    const queryHandle = queryHandleService.storeQuery(
      [result.id],
      `SELECT [System.Id] FROM WorkItems WHERE [System.Id] = ${result.id}`,
      {
        project: workItemData.project,
        queryType: 'single-item'
      },
      undefined, // Use default TTL
      new Map([[result.id, {
        title: result.title,
        state: result.state,
        type: result.type
      }]])
    );
    
    logger.debug(`Created query handle ${queryHandle} for new work item ${result.id}`);
    
    return {
      success: true,
      data: asToolData({
        work_item: result,
        query_handle: queryHandle
      }),
      metadata: { 
        source: "rest-api",
        workItemId: result.id,
        parentLinked: result.parent_linked,
        queryHandle
      },
      errors: [],
      warnings
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
