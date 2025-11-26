import type { ToolConfig } from "../../types/index.js";
import {
  createNewItemSchema,
  assignToCopilotSchema
} from "../schemas.js";

/**
 * Work Item Creation Tools
 * Tools for creating and assigning work items
 */
export const workItemCreationTools: ToolConfig[] = [
  {
    name: "create-workitem",
    description: "Create a new Azure DevOps work item with parent relationship. Supports templates from .ado/templates/ directory for pre-filling fields and structure. IMPORTANT: All work item types except 'Epic' and 'Key Result' REQUIRE a parent. Use 'analyze-bulk' with analysisType=['parent-recommendation'] to find suitable parents if you don't have a parentWorkItemId. Returns a query handle for the created item to enable immediate bulk operations. organization, project, workItemType, priority, assignedTo, areaPath, iterationPath, and inheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: createNewItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the work item (required unless using template)" },
        template: { type: "string", description: "Name of template to use (from .ado/templates/). If provided, template fields will be merged with other parameters." },
        variables: { 
          type: "object", 
          description: "Key-value pairs for template variable substitution (e.g., {title}, {assignee}). Variables replace {variable} placeholders in template content.",
          additionalProperties: { type: "string" }
        },
        parentWorkItemId: { type: "number", description: "Parent work item ID (REQUIRED for all types except Epic and Key Result). Use 'analyze-bulk' with analysisType=['parent-recommendation'] to find suitable parents." },
        description: { type: "string", description: "Markdown description / repro steps" },
        tags: { type: "string", description: "Semicolon or comma separated tags" },
        workItemType: { type: "string", description: "Override default work item type from config or template" },
        areaPath: { type: "string", description: "Override default area path from config" },
        iterationPath: { type: "string", description: "Override default iteration path from config" },
        assignedTo: { type: "string", description: "Override default assignee from config" },
        priority: { type: "number", description: "Override default priority from config or template" }
      },
      required: []
    }
  },
  {
    name: "assign-copilot",
    description: "Assign an existing Azure DevOps work item to GitHub Copilot and add branch link. Optionally specify a specialized Copilot agent using the specializedAgent parameter. organization, project, branch, and gitHubCopilotGuid are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: assignToCopilotSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Existing work item ID to assign" },
        repository: { type: "string", description: "Git repository name (required)" },
        branch: { type: "string", description: "Override default branch from config" },
        gitHubCopilotGuid: { type: "string", description: "Override default GitHub Copilot GUID from config" },
        specializedAgent: { type: "string", description: "Optional specialized Copilot agent name (e.g., 'ComponentGovernanceAgent'). Will be added as tag 'copilot:agent=<name>'" }
      },
      required: ["workItemId", "repository"]
    }
  }
];
