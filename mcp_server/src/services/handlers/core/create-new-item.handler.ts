/**
 * Handler for wit-create-item tool
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { createWorkItem } from "../../ado-work-item-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";

export async function handleCreateNewItem(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    logger.debug(`Creating work item with REST API: ${parsed.data.title}`);
    
    const result = await createWorkItem(parsed.data);
    
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
