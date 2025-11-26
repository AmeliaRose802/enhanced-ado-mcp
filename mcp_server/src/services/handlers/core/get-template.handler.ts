/**
 * Handler for get-template tool
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import { templateService } from "../../template-service.js";
import { validateAndParse } from "@/utils/handler-helpers.js";

export async function handleGetTemplate(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const { templateName } = validation.data as { templateName: string };
    const template = await templateService.getTemplate(templateName);
    
    if (!template) {
      return {
        success: false,
        data: null,
        metadata: { source: "template-service" },
        errors: [`Template '${templateName}' not found`],
        warnings: []
      };
    }

    return {
      success: true,
      data: asToolData(template),
      metadata: { source: "template-service", templateName },
      errors: [],
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
