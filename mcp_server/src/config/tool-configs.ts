import type { ToolConfig, Tool } from "../types/index.js";
import {
  createNewItemSchema,
  assignToCopilotSchema,
  newCopilotItemSchema,
  extractSecurityLinksSchema,
  workItemIntelligenceSchema,
  aiAssignmentAnalyzerSchema,
  getConfigurationSchema,
  wiqlQuerySchema,
  odataAnalyticsQuerySchema,
  workItemContextPackageSchema,
  workItemsBatchContextSchema,
  getLastSubstantiveChangeSchema,
  bulkAddCommentsSchema,
  detectPatternsSchema,
  validateHierarchyFastSchema
} from "./schemas.js";
import { z } from 'zod';

/**
 * Tool configuration registry to eliminate repetitive switch/case & schema duplication
 */
export const toolConfigs: ToolConfig[] = [
  {
    name: "wit-create-new-item",
    description: "Create a new Azure DevOps work item with optional parent relationship. organization, project, workItemType, priority, assignedTo, areaPath, iterationPath, and inheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: createNewItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the work item (mandatory)" },
        parentWorkItemId: { type: "number", description: "Optional parent work item ID" },
        description: { type: "string", description: "Markdown description / repro steps" },
        tags: { type: "string", description: "Semicolon or comma separated tags" },
        // Optional overrides (auto-filled from config if not provided)
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
    name: "wit-get-work-item-context-package",
    description: "Retrieve a comprehensive context package for a single work item including core fields, description, acceptance criteria, parent, children, related links, comments, recent history, and optionally PRs/commits and attachments in one call.",
    script: "", // Handled internally
    schema: workItemContextPackageSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Primary work item ID to retrieve full context for" },
        includeHistory: { type: "boolean", description: "Include recent change history (last 10 changes)" },
        historyCount: { type: "number", description: "Number of recent history entries to include" },
        includeComments: { type: "boolean", description: "Include work item comments/discussion" },
        includeRelations: { type: "boolean", description: "Include related links (parent, children, related, attachments, commits, PRs)" },
        includeChildren: { type: "boolean", description: "Include all child hierarchy (one level) if item is a Feature/Epic" },
        includeParent: { type: "boolean", description: "Include parent work item details if present" },
        includeLinkedPRsAndCommits: { type: "boolean", description: "Include linked Git PRs and commits if present in relations" },
        includeExtendedFields: { type: "boolean", description: "Include extended field set beyond defaults" },
        includeHtml: { type: "boolean", description: "Return original HTML field values alongside Markdown/plain text" },
        maxChildDepth: { type: "number", description: "Depth of child hierarchy to traverse (1 = immediate children)" },
        maxRelatedItems: { type: "number", description: "Maximum number of related items to expand" },
        includeAttachments: { type: "boolean", description: "Include attachment metadata (names, urls, sizes)" },
        includeTags: { type: "boolean", description: "Include tags list" }
      },
      required: ["workItemId"]
    }
  },
  {
    name: "wit-get-work-items-context-batch",
    description: "Retrieve multiple work items (10-50) with relationship graph, aggregate metrics, and optional heuristic scoring in one call.",
    script: "", // Handled internally
    schema: workItemsBatchContextSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemIds: { type: "array", items: { type: "number" }, description: "List of work item IDs (max 50)" },
        includeRelations: { type: "boolean", description: "Include relationship edges between provided items" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include per work item" },
        includeExtendedFields: { type: "boolean", description: "Include extended field set beyond defaults" },
        includeTags: { type: "boolean", description: "Include tags list" },
        includeStateCounts: { type: "boolean", description: "Return aggregate counts by state and type" },
        includeStoryPointAggregation: { type: "boolean", description: "Aggregate story points / effort fields if present" },
        includeRiskScoring: { type: "boolean", description: "Include basic heuristic risk / staleness scoring" },
        includeAIAssignmentHeuristic: { type: "boolean", description: "Include lightweight AI suitability heuristic" },
        includeParentOutsideSet: { type: "boolean", description: "Include minimal parent references outside requested set" },
        includeChildrenOutsideSet: { type: "boolean", description: "Include minimal child references outside requested set" },
        maxOutsideReferences: { type: "number", description: "Cap number of outside references added" },
        returnFormat: { type: "string", enum: ["graph", "array"], description: "Return as graph (nodes/edges) or simple array" }
      },
      required: ["workItemIds"]
    }
  },
  {
    name: "wit-assign-to-copilot",
    description: "Assign an existing Azure DevOps work item to GitHub Copilot and add branch link. organization, project, branch, and gitHubCopilotGuid are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: assignToCopilotSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Existing work item ID to assign" },
        repository: { type: "string", description: "Git repository name (required)" },
        // Optional overrides (auto-filled from config if not provided)
        branch: { type: "string", description: "Override default branch from config" },
        gitHubCopilotGuid: { type: "string", description: "Override default GitHub Copilot GUID from config" }
      },
      required: ["workItemId", "repository"]
    }
  },
  {
    name: "wit-new-copilot-item",
    description: "Create a new Azure DevOps work item under a parent and immediately assign to GitHub Copilot. organization, project, workItemType, branch, gitHubCopilotGuid, areaPath, iterationPath, priority, and inheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: newCopilotItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the work item" },
        parentWorkItemId: { type: "number", description: "Parent work item ID under which to create the new item" },
        repository: { type: "string", description: "Git repository name (required)" },
        description: { type: "string", description: "Markdown description" },
        tags: { type: "string", description: "Semicolon or comma separated tags" },
        // Optional overrides (auto-filled from config if not provided)
        workItemType: { type: "string", description: "Override default work item type from config" },
        branch: { type: "string", description: "Override default branch from config" },
        gitHubCopilotGuid: { type: "string", description: "Override default GitHub Copilot GUID from config" },
        areaPath: { type: "string", description: "Override default area path from config" },
        iterationPath: { type: "string", description: "Override default iteration path from config" },
        priority: { type: "number", description: "Override default priority from config" }
      },
      required: ["title", "parentWorkItemId", "repository"]
    }
  },
  {
    name: "wit-extract-security-links",
    description: "Extract instruction links from security scan work items. organization and project are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: extractSecurityLinksSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Azure DevOps work item ID to extract instruction links from" },
        scanType: { type: "string", enum: ["BinSkim", "CodeQL", "CredScan", "General", "All"], description: "Type of security scanner to filter links for" },
        includeWorkItemDetails: { type: "boolean", description: "Include detailed work item information in the response" },
        extractFromComments: { type: "boolean", description: "Also extract links from work item comments" },
        dryRun: { type: "boolean", description: "Run in dry-run mode without making actual API calls" }
      },
      required: ["workItemId"]
    }
  },
  {
    name: "wit-intelligence-analyzer",
    description: "AI-powered work item analysis for completeness, AI-readiness, enhancement suggestions, and smart categorization using VS Code sampling",
    script: "", // Handled internally with sampling
    schema: workItemIntelligenceSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Work item title to analyze" },
        description: { type: "string", description: "Work item description/content to analyze" },
        workItemType: { type: "string", description: "Type of work item (Task, Bug, PBI, etc.)" },
        acceptanceCriteria: { type: "string", description: "Current acceptance criteria if any" },
        analysisType: { type: "string", enum: ["completeness", "ai-readiness", "enhancement", "categorization", "full"], description: "Type of analysis to perform" },
        contextInfo: { type: "string", description: "Additional context about the project, team, or requirements" },
        enhanceDescription: { type: "boolean", description: "Generate an enhanced, AI-ready description" },
        createInADO: { type: "boolean", description: "Automatically create the enhanced item in Azure DevOps" },
        parentWorkItemId: { type: "number", description: "Parent work item ID if creating in ADO" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["title"]
    }
  },
  {
    name: "wit-ai-assignment-analyzer",
    description: "Enhanced AI assignment suitability analysis with detailed reasoning and confidence scoring using VS Code sampling. Automatically retrieves work item details from Azure DevOps. This tool provides analysis only - use wit-assign-to-copilot separately to perform the assignment.",
    script: "", // Handled internally with sampling
    schema: aiAssignmentAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Azure DevOps work item ID to analyze for AI assignment suitability" },
        outputFormat: { type: "string", enum: ["detailed", "json"], description: "Output format: 'detailed' (default, comprehensive analysis) or 'json' (structured JSON for programmatic use)" }
      },
      required: ["workItemId"]
    }
  },
  // Configuration and Discovery Tools
  {
    name: "wit-get-configuration",
    description: "Get current MCP server configuration including area paths, repositories, GitHub Copilot settings, and other defaults that agents can use for work item creation",
    script: "", // Handled internally
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
    name: "wit-get-work-items-by-query-wiql",
    description: "Query Azure DevOps work items using WIQL (Work Item Query Language). Supports complex queries with filtering, sorting, and field selection. Returns work item details including Id, Title, Type, State, and any requested additional fields.",
    script: "", // Handled internally
    schema: wiqlQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        wiqlQuery: { type: "string", description: "WIQL query string. Examples: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'' or 'SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'ProjectName\\AreaName' ORDER BY [System.ChangedDate] DESC'" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include (e.g., 'System.Description', 'Microsoft.VSTS.Common.Priority')" },
        maxResults: { type: "number", description: "Maximum number of results to return (default 200)" }
      },
      required: ["wiqlQuery"]
    }
  },
  {
    name: "wit-query-analytics-odata",
    description: "Query Azure DevOps Analytics using OData for efficient aggregations, metrics, and trend analysis. Supports work item counts, grouping by state/type/assignee, velocity metrics, and cycle time analysis. Use this for analytics and reporting instead of WIQL when you need aggregated data.",
    script: "", // Handled internally
    schema: odataAnalyticsQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        queryType: { type: "string", enum: ["workItemCount", "groupByState", "groupByType", "groupByAssignee", "velocityMetrics", "cycleTimeMetrics", "customQuery"], description: "Type of analytics query to execute" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" },
        filters: { type: "object", description: "Filter conditions (e.g., { State: 'Active', WorkItemType: 'Bug' })" },
        groupBy: { type: "array", items: { type: "string" }, description: "Fields to group by for aggregation" },
        select: { type: "array", items: { type: "string" }, description: "Specific fields to return" },
        orderBy: { type: "string", description: "Field to order results by (e.g., 'Count desc')" },
        customODataQuery: { type: "string", description: "Custom OData query string for advanced scenarios" },
        dateRangeField: { type: "string", enum: ["CreatedDate", "ChangedDate", "CompletedDate", "ClosedDate"], description: "Date field to filter by" },
        dateRangeStart: { type: "string", description: "Start date (ISO 8601: YYYY-MM-DD)" },
        dateRangeEnd: { type: "string", description: "End date (ISO 8601: YYYY-MM-DD)" },
        areaPath: { type: "string", description: "Filter by Area Path" },
        iterationPath: { type: "string", description: "Filter by Iteration Path" },
        top: { type: "number", description: "Maximum number of results (default 100)" },
        computeCycleTime: { type: "boolean", description: "Compute cycle time for completed items" },
        includeMetadata: { type: "boolean", description: "Include OData metadata in response" }
      },
      required: ["queryType"]
    }
  },
  {
    name: "wit-get-last-substantive-change",
    description: "Efficiently determine the last substantive (meaningful) change to a work item by analyzing revision history server-side and filtering out automated changes like iteration path bulk updates. Returns minimal data to avoid context window bloat.",
    script: "", // Handled internally
    schema: getLastSubstantiveChangeSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Work item ID to analyze" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" },
        historyCount: { type: "number", description: "Number of revisions to analyze (default 50)" },
        automatedPatterns: { type: "array", items: { type: "string" }, description: "Custom automation account patterns to filter (e.g., ['Bot Name', 'System Account'])" }
      },
      required: ["workItemId"]
    }
  },
  {
    name: "wit-bulk-add-comments",
    description: "Add comments to multiple work items (1-50) efficiently in a single call. Supports templates with variable substitution for consistent messaging. Ideal for bulk notifications or status updates.",
    script: "", // Handled internally
    schema: bulkAddCommentsSchema,
    inputSchema: {
      type: "object",
      properties: {
        items: { 
          type: "array", 
          items: { 
            type: "object",
            properties: {
              workItemId: { type: "number", description: "Work item ID to add comment to" },
              comment: { type: "string", description: "Comment text to add (supports Markdown)" }
            },
            required: ["workItemId", "comment"]
          }, 
          description: "Array of work items and their comments (1-50 items)" 
        },
        template: { type: "string", description: "Comment template with {{variable}} placeholders" },
        templateVariables: { type: "object", description: "Variables to substitute in template" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["items"]
    }
  },
  {
    name: "wit-detect-patterns",
    description: "Identify common work item issues: duplicates, placeholder titles, orphaned children, unassigned committed items, and stale automation. Returns categorized matches by severity.",
    script: "", // Handled internally
    schema: detectPatternsSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemIds: { type: "array", items: { type: "number" }, description: "Specific work item IDs to analyze (if not provided, uses areaPath)" },
        areaPath: { type: "string", description: "Area path to search for work items (if workItemIds not provided)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" },
        patterns: { 
          type: "array", 
          items: { 
            type: "string",
            enum: ["duplicates", "placeholder_titles", "orphaned_children", "unassigned_committed", "stale_automation", "no_description"]
          }, 
          description: "Patterns to detect" 
        },
        maxResults: { type: "number", description: "Maximum number of results when using areaPath" },
        includeSubAreas: { type: "boolean", description: "Include sub-area paths when using areaPath" }
      },
      required: []
    }
  },
  {
    name: "wit-validate-hierarchy-fast",
    description: "Fast, rule-based validation of work item hierarchy. Checks parent-child type relationships (Epic->Feature, Feature->PBI, PBI->Task/Bug) and state consistency (parent state must align with children states). Returns focused results without AI analysis.",
    script: "", // Handled internally
    schema: validateHierarchyFastSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemIds: { type: "array", items: { type: "number" }, description: "Specific work item IDs to validate (if not provided, uses areaPath)" },
        areaPath: { type: "string", description: "Area path to validate all work items within (if workItemIds not provided)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" },
        maxResults: { type: "number", description: "Maximum number of work items to analyze when using areaPath (default 500)" },
        includeSubAreas: { type: "boolean", description: "Include child area paths in analysis (default true)" },
        validateTypes: { type: "boolean", description: "Validate parent-child type relationships (default true)" },
        validateStates: { type: "boolean", description: "Validate state consistency between parents and children (default true)" }
      },
      required: []
    }
  }
];

/**
 * AI-powered tools that require VS Code sampling support
 */
export const AI_POWERED_TOOLS = [
  'wit-intelligence-analyzer',
  'wit-ai-assignment-analyzer'
];

/**
 * Check if a tool requires sampling support
 */
export function isAIPoweredTool(toolName: string): boolean {
  return AI_POWERED_TOOLS.includes(toolName);
}

/**
 * Filter tool configs based on sampling availability
 * @param hasSampling Whether sampling is supported
 * @returns Filtered tool configurations
 */
export function getAvailableToolConfigs(hasSampling: boolean): ToolConfig[] {
  if (hasSampling) {
    return toolConfigs; // All tools available
  }
  
  // Filter out AI-powered tools when sampling not available
  return toolConfigs.filter(tool => !isAIPoweredTool(tool.name));
}

/**
 * Export as Tool[] for MCP listing
 */
export const tools: Tool[] = toolConfigs.map(tc => ({
  name: tc.name,
  description: tc.description,
  inputSchema: tc.inputSchema
}));