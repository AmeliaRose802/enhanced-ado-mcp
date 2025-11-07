import type { ToolConfig } from "../../types/index.js";
import {
  createNewItemSchema,
  assignToCopilotSchema,
  newCopilotItemSchema,
  cloneWorkItemSchema
} from "../schemas.js";

/**
 * Work Item Creation Tools
 * Tools for creating and assigning work items
 */
export const workItemCreationTools: ToolConfig[] = [
  {
    name: "create-workitem",
    description: "Create a new Azure DevOps work item with optional parent relationship. Returns a query handle for the created item to enable immediate bulk operations. organization, project, workItemType, priority, assignedTo, areaPath, iterationPath, and inheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: createNewItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the work item (mandatory)" },
        parentWorkItemId: { type: "number", description: "Optional parent work item ID" },
        description: { type: "string", description: "Markdown description / repro steps" },
        tags: { type: "string", description: "Semicolon or comma separated tags" },
        workItemType: { type: "string", description: "Override default work item type from config" },
        areaPath: { type: "string", description: "Override default area path from config" },
        iterationPath: { type: "string", description: "Override default iteration path from config" },
        assignedTo: { type: "string", description: "Override default assignee from config" },
        priority: { type: "number", description: "Override default priority from config" }
      },
      required: ["title"]
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
  },
  {
    name: "create-workitem-copilot",
    description: "Create a new Azure DevOps work item under a parent and immediately assign to GitHub Copilot. Optionally specify a specialized Copilot agent using the specializedAgent parameter. Returns a query handle for the created item to enable immediate bulk operations. organization, project, workItemType, branch, gitHubCopilotGuid, areaPath, iterationPath, priority, and inheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: newCopilotItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the work item" },
        parentWorkItemId: { type: "number", description: "Parent work item ID under which to create the new item" },
        repository: { type: "string", description: "Git repository name (required)" },
        description: { type: "string", description: "Markdown description" },
        tags: { type: "string", description: "Semicolon or comma separated tags" },
        workItemType: { type: "string", description: "Override default work item type from config" },
        branch: { type: "string", description: "Override default branch from config" },
        gitHubCopilotGuid: { type: "string", description: "Override default GitHub Copilot GUID from config" },
        specializedAgent: { type: "string", description: "Optional specialized Copilot agent name (e.g., 'ComponentGovernanceAgent'). Will be added as tag 'copilot:agent=<name>'" },
        areaPath: { type: "string", description: "Override default area path from config" },
        iterationPath: { type: "string", description: "Override default iteration path from config" },
        priority: { type: "number", description: "Override default priority from config" }
      },
      required: ["title", "parentWorkItemId", "repository"]
    }
  },
  {
    name: "clone-workitem",
    description: "Clone/duplicate an existing work item with optional modifications. Creates a copy with customizable title, area, iteration, assignments, and can optionally include children. Returns a query handle for the cloned item to enable immediate bulk operations. Useful for template-based creation and environment cloning. Supports linking back to source.",
    script: "",
    schema: cloneWorkItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        sourceWorkItemId: { type: "number", description: "Work item ID to clone/duplicate" },
        title: { type: "string", description: "Override title for cloned work item (default: '[Clone] {original title}')" },
        targetAreaPath: { type: "string", description: "Area path for cloned work item (defaults to source area)" },
        targetIterationPath: { type: "string", description: "Iteration path for cloned work item (defaults to source iteration)" },
        targetProject: { type: "string", description: "Target project for cross-project cloning (defaults to source project)" },
        assignTo: { type: "string", description: "Assign cloned work item to specific user (defaults to unassigned)" },
        includeDescription: { type: "boolean", description: "Include description from source (default true)" },
        includeAcceptanceCriteria: { type: "boolean", description: "Include acceptance criteria (default true)" },
        includeTags: { type: "boolean", description: "Include tags from source (default true)" },
        includeAttachments: { type: "boolean", description: "Clone attachments (default false, can be slow)" },
        includeChildren: { type: "boolean", description: "Also clone child work items (default false)" },
        linkToSource: { type: "boolean", description: "Create 'Related' link back to source (default true)" },
        comment: { type: "string", description: "Add comment explaining the cloning" }
      },
      required: ["sourceWorkItemId"]
    }
  }
];
