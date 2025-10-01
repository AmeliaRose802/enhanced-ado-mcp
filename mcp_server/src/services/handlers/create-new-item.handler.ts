/**
 * Handler for wit-create-new-item tool
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { createWorkItem } from "../ado-work-item-service.js";
import { logger } from "../../utils/logger.js";

export async function handleCreateNewItem(config: any, args: any): Promise<ToolExecutionResult> {
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

    logger.debug(`Creating work item with REST API: ${parsed.data.Title}`);
    
    const result = await createWorkItem(parsed.data);
    
    return {
      success: true,
      data: {
        work_item: result
      },
      raw: { 
        stdout: JSON.stringify({ work_item: result }, null, 2), 
        stderr: "", 
        exitCode: 0 
      },
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
      raw: { 
        stdout: "", 
        stderr: error instanceof Error ? error.message : String(error), 
        exitCode: 1 
      },
      metadata: { source: "rest-api" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
