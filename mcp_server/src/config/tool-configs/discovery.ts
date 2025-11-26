import type { ToolConfig } from "../../types/index.js";
import {
  getConfigurationSchema,
  getPromptsSchema,
  listSubagentsSchema,
  getTeamMembersSchema,
  discoverCustomFieldsSchema,
  validateCustomFieldsSchema,
  exportFieldSchemaSchema
} from "../schemas.js";

/**
 * Discovery & Configuration Tools
 * Tools for configuration, prompts, and server metadata
 */
export const discoveryTools: ToolConfig[] = [
  {
    name: "get-config",
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
    name: "get-team-members",
    description: "Discover team members by analyzing work item assignments. Returns a clean array of email addresses, automatically filtering out GitHub Copilot and null values. Useful for batch analysis, sprint planning, and understanding team composition.",
    script: "",
    schema: getTeamMembersSchema,
    inputSchema: {
      type: "object",
      properties: {
        areaPath: { type: "string", description: "Area path to filter team members (uses config default if not provided)" },
        dateRangeStart: { type: "string", description: "Start date for activity filter (ISO format YYYY-MM-DD, default: 90 days ago)" },
        dateRangeEnd: { type: "string", description: "End date for activity filter (ISO format YYYY-MM-DD, default: today)" },
        activeOnly: { type: "boolean", description: "Only include members with assigned work items in date range (default: true)" },
        organization: { type: "string", description: "Azure DevOps organization (optional, uses config default)" },
        project: { type: "string", description: "Azure DevOps project (optional, uses config default)" }
      },
      required: []
    }
  },
  {
    name: "get-prompts",
    description: "[DEBUG ONLY] Retrieve pre-filled prompt templates by name or list all available prompts. This tool is disabled in production and only available when MCP_ENABLE_DEBUG_TOOLS=1 environment variable is set. Useful for testing prompt templates or for agents that need direct access to prompt content for specialized use cases.",
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
    name: "list-agents",
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
    name: "discover-custom-fields",
    description: "Discover all custom fields in an Azure DevOps project, including field metadata (name, type, description), usage across work item types, picklist values, and field categories. Useful for field audits, documentation, and understanding project configuration.",
    script: "",
    schema: discoverCustomFieldsSchema,
    inputSchema: {
      type: "object",
      properties: {
        includeSystemFields: { type: "boolean", description: "Include system fields (System.*) in results (default: false)" },
        includeMicrosoftFields: { type: "boolean", description: "Include Microsoft VSTS fields (Microsoft.*) in results (default: true)" },
        includePicklistValues: { type: "boolean", description: "Include allowed values for picklist fields (default: true)" },
        organization: { type: "string", description: "Azure DevOps organization (optional, uses config default)" },
        project: { type: "string", description: "Azure DevOps project (optional, uses config default)" }
      },
      required: []
    }
  },
  {
    name: "validate-custom-fields",
    description: "Validate custom fields and identify issues: inconsistent naming (casing, typos), unused fields, deprecated fields still in use, similar/duplicate field names. Returns actionable recommendations for field standardization and cleanup.",
    script: "",
    schema: validateCustomFieldsSchema,
    inputSchema: {
      type: "object",
      properties: {
        severityFilter: { type: "string", enum: ["error", "warning", "info", "all"], description: "Filter issues by severity (default: all)" },
        focusOnCustomFields: { type: "boolean", description: "Only validate custom fields (exclude system/Microsoft fields) (default: true)" },
        organization: { type: "string", description: "Azure DevOps organization (optional, uses config default)" },
        project: { type: "string", description: "Azure DevOps project (optional, uses config default)" }
      },
      required: []
    }
  },
  {
    name: "export-field-schema",
    description: "Export field definitions as structured JSON or YAML schema for documentation, migration, or template generation. Includes field metadata, types, picklist values, and usage across work item types.",
    script: "",
    schema: exportFieldSchemaSchema,
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["json", "yaml"], description: "Export format (default: json)" },
        outputPath: { type: "string", description: "File path to save exported schema (optional, returns in response if not provided)" },
        includeSystemFields: { type: "boolean", description: "Include system fields in export (default: false)" },
        includeMicrosoftFields: { type: "boolean", description: "Include Microsoft VSTS fields in export (default: true)" },
        includeUsageMetadata: { type: "boolean", description: "Include work item type usage metadata (default: true)" },
        prettyPrint: { type: "boolean", description: "Format output with indentation (default: true)" },
        organization: { type: "string", description: "Azure DevOps organization (optional, uses config default)" },
        project: { type: "string", description: "Azure DevOps project (optional, uses config default)" }
      },
      required: []
    }
  }
];
