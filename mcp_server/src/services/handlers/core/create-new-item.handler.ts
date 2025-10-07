/**
 * Handler for wit-create-new-item tool
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { createWorkItem } from "../../ado-work-item-service.js";
import { 
  buildValidationErrorResponse, 
  buildAzureCliErrorResponse,
  buildSuccessResponse,
  buildCatchErrorResponse
} from "../../../utils/response-builder.js";
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
    
    return buildSuccessResponse(
      { work_item: result },
      { 
        source: "rest-api",
        workItemId: result.id,
        parentLinked: result.parent_linked
      }
    );
  } catch (error) {
    logger.error('Create work item handler error:', error);
    return buildCatchErrorResponse(error, 'rest-api');
  }
}
