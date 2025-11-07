import type { ToolConfig } from "../../types/index.js";
import {
  getConfigurationSchema,
  getPromptsSchema,
  listSubagentsSchema,
  listTeamMembersSchema
} from "../schemas.js";

/**
 * Discovery & Configuration Tools
 * Tools for configuration, prompts, and server metadata
 */
export const discoveryTools: ToolConfig[] = [
  {
    name: "wit-get-configuration",
    description: "Get current MCP server configuration including area paths, repositories, GitHub Copilot settings, and other defaults that agents can use for work item creation",
    script: "",
    schema: getConfigurationSchema,
    inputSchema: {
      type: "object",
      properties: {
        includeSensitive: { type: "boolean", description: "Include potentially sensitive configuration values" },
        section: { type: "string", enum: ["all", "azureDevOps", "gitRepository", "gitHubCopilot"], description: "Specific configuration section to retrieve" }
      },
      required: []
    }
  },
  {
    name: "wit-get-prompts",
    description: "Retrieve pre-filled prompt templates by name or list all available prompts. Useful for testing prompt templates or for agents that need direct access to prompt content for specialized use cases.",
    script: "",
    schema: getPromptsSchema,
    inputSchema: {
      type: "object",
      properties: {
        promptName: { 
          type: "string", 
          description: "Name of the prompt to retrieve (omit to get all prompts)" 
        },
        includeContent: { 
          type: "boolean", 
          description: "Whether to include the filled prompt content (default: true)" 
        },
        args: { 
          type: "object", 
          description: "Arguments to fill in prompt template variables (merged with config defaults)" 
        }
      },
      required: []
    }
  },
  {
    name: "wit-list-subagents",
    description: "Discover available specialized Copilot agents in an Azure DevOps repository by scanning /.azuredevops/policies directory. Returns agent names and descriptions parsed from YAML metadata.",
    script: "",
    schema: listSubagentsSchema,
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository name or ID to scan for specialized agents"
        },
        organization: {
          type: "string",
          description: "Azure DevOps organization (optional, uses default from config)"
        },
        project: {
          type: "string",
          description: "Azure DevOps project (optional, uses default from config)"
        }
      },
      required: ["repository"]
    }
  },
  {
    name: "wit-list-team-members",
    description: "List team members in the Azure DevOps organization, optionally filtered by manager. Returns user details or a comma-separated email list suitable for WIQL IN queries (e.g., 'WHERE [System.AssignedTo] IN (@TeamMembers)'). Essential for querying work items assigned to an entire team.",
    script: "",
    schema: listTeamMembersSchema,
    inputSchema: {
      type: "object",
      properties: {
        managerEmail: {
          type: "string",
          description: "Filter team members by manager email address (returns direct reports only)"
        },
        includeManager: {
          type: "boolean",
          description: "Include the manager in the results (default: false, only direct reports)"
        },
        outputFormat: {
          type: "string",
          enum: ["detailed", "emails"],
          description: "Output format: 'detailed' (full user info) or 'emails' (comma-separated list for WIQL queries)"
        },
        organization: {
          type: "string",
          description: "Azure DevOps organization (optional, uses default from config)"
        }
      },
      required: []
    }
  }
];
