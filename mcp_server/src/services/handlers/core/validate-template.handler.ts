/**
 * Handler for validate-template tool
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import { templateService } from "../../template-service.js";
import { validateAndParse } from "@/utils/handler-helpers.js";

export async function handleValidateTemplate(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { templateName } = validation.data as { templateName: string };
    const result = await templateService.validateTemplate(templateName);
    
    return {
      success: result.valid,
      data: asToolData({
        template: templateName,
        valid: result.valid,
        errors: result.errors
      }),
      metadata: { source: "template-service", templateName },
      errors: result.valid ? [] : result.errors,
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      metadata: { source: "template-service" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
