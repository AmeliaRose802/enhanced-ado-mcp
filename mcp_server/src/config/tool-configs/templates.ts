import type { ToolConfig } from "../../types/index.js";
import {
  listTemplatesSchema,
  getTemplateSchema,
  validateTemplateSchema
} from "../schemas.js";

/**
 * Template Management Tools
 * Tools for managing work item templates
 */
export const templateTools: ToolConfig[] = [
  {
    name: "list-templates",
    description: "List all available work item templates from .ado/templates/ directory. Templates provide pre-defined structures for common work item patterns (bugs, features, tech debt, user stories).",
    script: "",
    schema: listTemplatesSchema,
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get-template",
    description: "Get detailed information about a specific work item template including all fields, variables, and acceptance criteria.",
    script: "",
    schema: getTemplateSchema,
    inputSchema: {
      type: "object",
      properties: {
        templateName: { 
          type: "string", 
          description: "Name of the template to retrieve" 
        }
      },
      required: ["templateName"]
    }
  },
  {
    name: "validate-template",
    description: "Validate a work item template to ensure it has all required fields and correct structure.",
    script: "",
    schema: validateTemplateSchema,
    inputSchema: {
      type: "object",
      properties: {
        templateName: { 
          type: "string", 
          description: "Name of the template to validate" 
        }
      },
      required: ["templateName"]
    }
  }
];
