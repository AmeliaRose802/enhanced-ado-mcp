/**
 * Handler for list-templates tool
 */

import { ToolExecutionResult, asToolData } from "@/types/index.js";
import { templateService } from "../../template-service.js";

export async function handleListTemplates(): Promise<ToolExecutionResult> {
  try {
    const templates = await templateService.listTemplates();
    
    if (templates.length === 0) {
      return {
        success: true,
        data: asToolData({
          templates: [],
          message: "No templates found. Create templates in .ado/templates/ directory."
        }),
        metadata: { source: "template-service", count: 0 },
        errors: [],
        warnings: []
      };
    }

    // Return template metadata
    const templateList = templates.map(t => ({
      name: t.name,
      type: t.type,
      title: t.title,
      description: t.metadata?.description || t.description?.substring(0, 100) || "No description",
      category: t.metadata?.category,
      tags: t.tags,
      priority: t.priority,
      variables: t.variables ? Object.keys(t.variables) : []
    }));

    return {
      success: true,
      data: asToolData({
        templates: templateList,
        count: templates.length
      }),
      metadata: { source: "template-service", count: templates.length },
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
