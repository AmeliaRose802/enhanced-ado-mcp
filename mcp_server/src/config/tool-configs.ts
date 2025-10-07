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
  inspectQueryHandleSchema,
  selectItemsFromQueryHandleSchema,
  workItemContextPackageSchema,
  workItemsBatchContextSchema,
  getLastSubstantiveChangeSchema,
  detectPatternsSchema,
  validateHierarchyFastSchema,
  bulkCommentByQueryHandleSchema,
  bulkUpdateByQueryHandleSchema,
  bulkAssignByQueryHandleSchema,
  bulkRemoveByQueryHandleSchema,
  validateQueryHandleSchema,
  analyzeByQueryHandleSchema,
  listQueryHandlesSchema,
  bulkEnhanceDescriptionsByQueryHandleSchema,
  bulkAssignStoryPointsByQueryHandleSchema,
  bulkAddAcceptanceCriteriaByQueryHandleSchema,
  generateWiqlQuerySchema,
  generateODataQuerySchema,
  toolDiscoverySchema,
  personalWorkloadAnalyzerSchema,
  sprintPlanningAnalyzerSchema
} from "./schemas.js";

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
        includeHistory: { type: "boolean", description: "Include recent change history (disabled by default to save ~40KB per work item)" },
        maxHistoryRevisions: { type: "number", description: "Maximum number of recent history revisions to include when history is enabled (sorted by revision number descending)" },
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
  {
    name: "wit-personal-workload-analyzer",
    description: "AI-powered personal workload analysis to assess burnout risk, overspecialization, work-life balance issues, and professional health indicators for an individual over a time period. Automatically fetches completed and active work, calculates metrics, and provides actionable insights. Supports optional custom analysis intent (e.g., 'assess readiness for promotion', 'check for career growth opportunities'). Requires VS Code sampling support.",
    script: "", // Handled internally with sampling
    schema: personalWorkloadAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        assignedToEmail: { type: "string", description: "Email address of the person to analyze (e.g., user@domain.com)" },
        analysisPeriodDays: { type: "number", description: "Number of days to analyze backwards from today (default 90, min 7, max 365)" },
        additionalIntent: { type: "string", description: "Optional custom analysis intent (e.g., 'check for career growth opportunities', 'assess readiness for promotion', 'evaluate technical skill development')" },
        organization: { type: "string", description: "Azure DevOps organization name (uses configured default if not provided)" },
        project: { type: "string", description: "Azure DevOps project name (uses configured default if not provided)" },
        areaPath: { type: "string", description: "Area path to filter work items (uses configured default if not provided)" }
      },
      required: ["assignedToEmail"]
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
    description: "🔐 ANTI-HALLUCINATION TOOL: Execute WIQL query and get both work item details AND a query handle for safe operations. ⚠️ CRITICAL: Do not reference work item IDs directly in subsequent operations - use the returned query_handle with bulk operation tools to prevent ID hallucination. Default returns handle + details for analysis workflows. Limit: 200 items (use pagination for more). Can filter results by last substantive change date to find stale or recently active items.",
    script: "", // Handled internally
    schema: wiqlQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        wiqlQuery: { type: "string", description: "WIQL query string. Examples: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'' or 'SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'ProjectName\\AreaName' ORDER BY [System.ChangedDate] DESC'" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include (e.g., 'System.Description', 'Microsoft.VSTS.Common.Priority')" },
        maxResults: { type: "number", description: "Maximum number of results to return per page (default 200, max 1000). ⚠️ Results are truncated at this limit - use pagination for more." },
        skip: { type: "number", description: "Number of work items to skip for pagination (default 0). Example: skip=200, top=200 gets items 201-400." },
        top: { type: "number", description: "Maximum number of work items to return (alias for maxResults, max 1000). When specified, overrides maxResults." },
        includeSubstantiveChange: { type: "boolean", description: "Include computed fields lastSubstantiveChangeDate and daysInactive for each work item - automatically filters out automated changes. Essential for backlog hygiene workflows." },
        filterBySubstantiveChangeAfter: { type: "string", description: "Filter results to only include work items with lastSubstantiveChangeDate after this date (ISO 8601 format, e.g., '2024-01-01T00:00:00Z'). Auto-enables includeSubstantiveChange. Use for finding recently active items." },
        filterBySubstantiveChangeBefore: { type: "string", description: "Filter results to only include work items with lastSubstantiveChangeDate before this date (ISO 8601 format). Auto-enables includeSubstantiveChange. Use for finding stale items." },
        filterByDaysInactiveMin: { type: "number", description: "Filter results to only include work items with daysInactive >= this value. Auto-enables includeSubstantiveChange. Use for finding stale items (e.g., 180 for items inactive 6+ months)." },
        filterByDaysInactiveMax: { type: "number", description: "Filter results to only include work items with daysInactive <= this value. Auto-enables includeSubstantiveChange. Use for finding recently active items (e.g., 30 for items active in last month)." },
        filterByMissingDescription: { type: "boolean", description: "Filter to only include work items with missing or empty description. Useful for backlog cleanup - finding items that need documentation." },
        filterByMissingAcceptanceCriteria: { type: "boolean", description: "Filter to only include work items with missing or empty acceptance criteria. Useful for finding PBIs/Features that need completion criteria defined." },
        returnQueryHandle: { type: "boolean", description: "🔐 DEFAULT TRUE: Return query handle for safe operations. ⚠️ Only set to false if you need raw IDs for immediate user display. For analysis, bulk operations, or any workflow that might reference IDs later, keep this true to prevent hallucination. Handle expires after 1 hour." },
        fetchFullPackages: { type: "boolean", description: "Fetch full context packages for each work item including description, comments, history, relations, children, and parent. ⚠️ WARNING: Increases API calls significantly (1 call per work item + relations/comments). Use for deep analysis of small result sets (<50 items). Automatically includes extended fields, relations, comments, and history." },
        includePaginationDetails: { type: "boolean", description: "Force include pagination details in response even for complete result sets. By default, pagination is only included when totalCount > top (multi-page results). Set to true to always include pagination metadata." }
      },
      required: ["wiqlQuery"]
    }
  },
  {
    name: "wit-query-analytics-odata",
    description: "Query Azure DevOps Analytics using OData for efficient aggregations, metrics, and trend analysis. Supports work item counts, grouping by state/type/assignee, velocity metrics, and cycle time analysis. Use this for analytics and reporting instead of WIQL when you need aggregated data. Supports pagination for large result sets.",
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
        top: { type: "number", description: "Maximum number of results (default 100, max 1000)" },
        skip: { type: "number", description: "Number of results to skip for pagination (default 0)" },
        computeCycleTime: { type: "boolean", description: "Compute cycle time for completed items" },
        includeMetadata: { type: "boolean", description: "Include query and URL metadata in response" },
        includeOdataMetadata: { type: "boolean", description: "Include OData metadata fields (@odata.*) in response (default: false)" }
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
  },
  {
    name: "wit-bulk-comment-by-query-handle",
    description: "Add a comment to multiple work items identified by a query handle. Uses query handle from wit-get-work-items-by-query-wiql to eliminate ID hallucination risk. Supports template variables and dry-run mode. TEMPLATE VARIABLES: Use {daysInactive}, {lastSubstantiveChangeDate}, {title}, {state}, {type}, {assignedTo}, {id} in comment text for per-item substitution when query handle includes staleness data.",
    script: "", // Handled internally
    schema: bulkCommentByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true" },
        comment: { type: "string", description: "Comment text to add to all work items (supports Markdown and template variables like {daysInactive}, {lastSubstantiveChangeDate}, {title}, {state}, {type}, {assignedTo}, {id})" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false) - shows template substitution examples" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "comment"]
    }
  },
  {
    name: "wit-bulk-update-by-query-handle",
    description: "Update multiple work items identified by a query handle. Uses JSON Patch operations to update fields. Supports dry-run mode.",
    script: "", // Handled internally
    schema: bulkUpdateByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "replace", "remove"], description: "JSON Patch operation" },
              path: { type: "string", description: "Field path (e.g., '/fields/System.State', '/fields/System.AssignedTo')" },
              value: { description: "Value to set (not needed for 'remove' operation)" }
            },
            required: ["op", "path"]
          },
          description: "Array of JSON Patch operations to apply"
        },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "updates"]
    }
  },
  {
    name: "wit-bulk-assign-by-query-handle",
    description: "Assign multiple work items to a user, identified by query handle. Supports dry-run mode.",
    script: "", // Handled internally
    schema: bulkAssignByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true" },
        assignTo: { type: "string", description: "User email or display name to assign work items to" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "assignTo"]
    }
  },
  {
    name: "wit-bulk-remove-by-query-handle",
    description: "Move multiple work items to 'Removed' state (does NOT permanently delete). Sets work item state to 'Removed' for items identified by a query handle. Optionally add a comment with removal reason. Supports dry-run mode.",
    script: "", // Handled internally
    schema: bulkRemoveByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true" },
        removeReason: { type: "string", description: "Optional reason for removing work items (added as comment before state change)" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-validate-query-handle",
    description: "Validate a query handle and get metadata about stored query results. Returns item count, expiration time, original query, and optionally fetches sample items. Use this to check if a handle is still valid before bulk operations.",
    script: "", // Handled internally
    schema: validateQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle to validate (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)" },
        includeSampleItems: { type: "boolean", description: "Fetch and include sample items (first 5) with titles and states (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-analyze-by-query-handle",
    description: "🔐 HANDLE-BASED ANALYSIS: Analyze work items using a query handle instead of explicit IDs. Prevents ID hallucination in analysis workflows. Provides effort estimates, velocity trends, assignment distribution, risk assessment, completion status, and priority analysis. Forces safe analysis patterns.",
    script: "", // Handled internally
    schema: analyzeByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (ensures analysis is based on real query results, not hallucinated IDs)" },
        analysisType: { 
          type: "array", 
          items: { 
            type: "string", 
            enum: ["effort", "velocity", "assignments", "risks", "completion", "priorities"] 
          },
          description: "Analysis types: effort (Story Points breakdown), velocity (completion trends), assignments (team workload), risks (blockers/stale items), completion (state distribution), priorities (priority breakdown)"
        },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "analysisType"]
    }
  },
  {
    name: "wit-list-query-handles",
    description: "📋 HANDLE REGISTRY: List all active query handles to track and manage them. Shows handle statistics, cleanup status, and provides guidance on handle management. Makes handles feel like persistent resources rather than ephemeral strings. Supports pagination for large numbers of handles.",
    script: "", // Handled internally
    schema: listQueryHandlesSchema,
    inputSchema: {
      type: "object",
      properties: {
        includeExpired: { type: "boolean", description: "Include expired handles in the list (default false). Useful for debugging handle lifecycle issues." },
        top: { type: "number", description: "Maximum number of handles to return (default 50, max 200)" },
        skip: { type: "number", description: "Number of handles to skip for pagination (default 0)" }
      },
      required: []
    }
  },
  {
    name: "wit-inspect-query-handle",
    description: "🔍 HANDLE INSPECTOR: Detailed inspection of a query handle including staleness data, work item context, and analysis metadata. Shows what data is available for template substitution in bulk operations. Essential for verifying handle contains expected staleness analysis before using with bulk tools.",
    script: "", // Handled internally
    schema: inspectQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle to inspect (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)" },
        includePreview: { type: "boolean", description: "Include preview of first 10 work items with their context data (default true)" },
        includeStats: { type: "boolean", description: "Include staleness statistics and analysis metadata (default true)" },
        includeExamples: { type: "boolean", description: "Include selection examples showing how to use itemSelector (default false, saves ~300 tokens)" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-select-items-from-query-handle",
    description: "🎯 ITEM SELECTOR: Preview and analyze item selection from a query handle before bulk operations. Shows exactly which items will be selected using index-based ([0,1,2]) or criteria-based selection (states, tags, staleness). Essential for validating selections before destructive operations. Eliminates 'wrong item' errors in bulk workflows.",
    script: "", // Handled internally
    schema: selectItemsFromQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle to preview item selection for" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items" },
            { type: "array", items: { type: "number" }, maxItems: 100, description: "Array of zero-based indices [0,1,2] to select specific items" },
            {
              type: "object",
              properties: {
                states: { type: "array", items: { type: "string" }, description: "Filter by work item states" },
                titleContains: { type: "array", items: { type: "string" }, description: "Filter by title keywords" },
                tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
                daysInactiveMin: { type: "number", description: "Minimum days inactive" },
                daysInactiveMax: { type: "number", description: "Maximum days inactive" }
              },
              description: "Criteria-based selection object"
            }
          ],
          description: "Item selection: 'all' for all items, array of indices for specific items, or criteria object for filtering"
        },
        previewCount: { type: "number", description: "Number of selected items to preview (default 10, max 50)" }
      },
      required: ["queryHandle", "itemSelector"]
    }
  },
  
  // ============================================================
  // BULK INTELLIGENT ENHANCEMENT TOOLS (AI-Powered)
  // ============================================================
  
  {
    name: "wit-bulk-enhance-descriptions-by-query-handle",
    description: "Use AI to generate improved descriptions for multiple work items identified by query handle. Processes items in batches, generates enhanced descriptions based on context, and updates work items. Supports multiple enhancement styles (detailed, concise, technical, business). Returns AI-generated descriptions with confidence scores. Set dryRun=false to apply changes.",
    script: "",
    schema: bulkEnhanceDescriptionsByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (returnQueryHandle=true)" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items" },
            { type: "array", items: { type: "number" }, description: "Array of indices [0,1,2]" },
            {
              type: "object",
              properties: {
                states: { type: "array", items: { type: "string" } },
                titleContains: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
                daysInactiveMin: { type: "number" },
                daysInactiveMax: { type: "number" }
              }
            }
          ],
          description: "Item selection: 'all', indices, or criteria"
        },
        sampleSize: { type: "number", description: "Max items to process (default 10, max 100)" },
        enhancementStyle: { 
          type: "string", 
          enum: ["detailed", "concise", "technical", "business"],
          description: "Style: detailed (comprehensive), concise (brief), technical (dev-focused), business (stakeholder-focused)" 
        },
        preserveExisting: { type: "boolean", description: "Append to existing description (default true)" },
        dryRun: { type: "boolean", description: "Preview without updating (default true)" },
        returnFormat: {
          type: "string",
          enum: ["summary", "preview", "full"],
          description: "Response format: 'summary' (counts only, ~70% reduction), 'preview' (200 char previews, ~40% reduction), 'full' (complete text). Defaults to 'summary' for dry-run, 'preview' for execute."
        }
      },
      required: ["queryHandle"]
    }
  },
  
  {
    name: "wit-bulk-assign-story-points-by-query-handle",
    description: "Use AI to estimate story points for multiple work items identified by query handle. Analyzes complexity, scope, and risk to assign appropriate story points using fibonacci (1,2,3,5,8,13), linear (1-10), or t-shirt (XS,S,M,L,XL) scales. Returns estimates with confidence scores and reasoning. Set dryRun=false to apply changes.",
    script: "",
    schema: bulkAssignStoryPointsByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (returnQueryHandle=true)" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items" },
            { type: "array", items: { type: "number" }, description: "Array of indices [0,1,2]" },
            {
              type: "object",
              properties: {
                states: { type: "array", items: { type: "string" } },
                titleContains: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
                daysInactiveMin: { type: "number" },
                daysInactiveMax: { type: "number" }
              }
            }
          ],
          description: "Item selection: 'all', indices, or criteria"
        },
        sampleSize: { type: "number", description: "Max items to process (default 10, max 100)" },
        pointScale: { 
          type: "string", 
          enum: ["fibonacci", "linear", "t-shirt"],
          description: "Story point scale: fibonacci (1,2,3,5,8,13), linear (1-10), t-shirt (XS,S,M,L,XL)" 
        },
        onlyUnestimated: { type: "boolean", description: "Only estimate items without existing effort (default true)" },
        includeCompleted: { type: "boolean", description: "Include completed/done items for historical analysis (default false)" },
        dryRun: { type: "boolean", description: "Preview without updating (default true)" }
      },
      required: ["queryHandle"]
    }
  },
  
  {
    name: "wit-bulk-add-acceptance-criteria-by-query-handle",
    description: "Use AI to generate acceptance criteria for multiple work items identified by query handle. Generates 3-7 testable criteria in gherkin (Given/When/Then), checklist (bullet points), or user-story (As a/I want/So that) format. Returns generated criteria with confidence scores. Set dryRun=false to apply changes.",
    script: "",
    schema: bulkAddAcceptanceCriteriaByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (returnQueryHandle=true)" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items" },
            { type: "array", items: { type: "number" }, description: "Array of indices [0,1,2]" },
            {
              type: "object",
              properties: {
                states: { type: "array", items: { type: "string" } },
                titleContains: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
                daysInactiveMin: { type: "number" },
                daysInactiveMax: { type: "number" }
              }
            }
          ],
          description: "Item selection: 'all', indices, or criteria"
        },
        sampleSize: { type: "number", description: "Max items to process (default 10, max 100)" },
        criteriaFormat: { 
          type: "string", 
          enum: ["gherkin", "checklist", "user-story"],
          description: "Format: gherkin (Given/When/Then), checklist (bullets), user-story (As a/I want/So that)" 
        },
        minCriteria: { type: "number", description: "Minimum criteria to generate (default 3)" },
        maxCriteria: { type: "number", description: "Maximum criteria to generate (default 7)" },
        preserveExisting: { type: "boolean", description: "Append to existing criteria (default true)" },
        dryRun: { type: "boolean", description: "Preview without updating (default true)" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-generate-wiql-query",
    description: "🤖 AI-POWERED: Generate valid WIQL queries from natural language descriptions with iterative validation. Automatically tests and refines queries until they work correctly. organization, project, areaPath, and iterationPath are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: generateWiqlQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Natural language description of what you want to find (e.g., 'all active bugs created in the last week')" },
        maxIterations: { type: "number", description: "Maximum attempts to generate valid query (1-5, default 3)" },
        includeExamples: { type: "boolean", description: "Include example patterns in prompt (default true)" },
        testQuery: { type: "boolean", description: "Test query by executing it (default true)" },
        areaPath: { type: "string", description: "Override default area path from config (automatically scopes queries to configured area)" },
        iterationPath: { type: "string", description: "Override default iteration path from config" }
      },
      required: ["description"]
    }
  },
  {
    name: "wit-generate-odata-query",
    description: "🤖 AI-POWERED: Generate valid OData Analytics queries from natural language descriptions with iterative validation. Automatically tests and refines queries for metrics, aggregations, and analytics. Can optionally return a query handle for safe bulk operations. organization, project, areaPath, and iterationPath are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: generateODataQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Natural language description of analytics query (e.g., 'count active bugs by assignee', 'velocity metrics for last sprint')" },
        maxIterations: { type: "number", description: "Maximum attempts to generate valid query (1-5, default 3)" },
        includeExamples: { type: "boolean", description: "Include example patterns in prompt (default true)" },
        testQuery: { type: "boolean", description: "Test query by executing it (default true)" },
        returnQueryHandle: { type: "boolean", description: "Execute query and return handle for bulk operations (prevents ID hallucination, default false)" },
        maxResults: { type: "number", description: "Maximum work items to fetch when returnQueryHandle=true (1-1000, default 200)" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include when returnQueryHandle=true" },
        areaPath: { type: "string", description: "Override default area path from config (automatically scopes queries to configured area)" },
        iterationPath: { type: "string", description: "Override default iteration path from config" }
      },
      required: ["description"]
    }
  },
  {
    name: "wit-discover-tools",
    description: "🤖 AI-POWERED TOOL DISCOVERY: Find the right tools for your task using natural language. Analyzes your intent and recommends the most appropriate tools from the MCP server with confidence scores, usage examples, and workflow guidance. Perfect when you're not sure which tool to use.",
    script: "",
    schema: toolDiscoverySchema,
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "Natural language description of what you want to accomplish (e.g., 'I want to find all stale bugs and update their priority')" },
        context: { type: "string", description: "Additional context about your project, team, or specific requirements" },
        maxRecommendations: { type: "number", description: "Maximum number of tool recommendations to return (1-10, default 3)" },
        includeExamples: { type: "boolean", description: "Include detailed usage examples for each recommended tool (default false, saves ~100-300 tokens per tool)" },
        filterCategory: { 
          type: "string", 
          enum: ["creation", "analysis", "bulk-operations", "query", "ai-powered", "all"],
          description: "Filter recommendations to specific category: creation (create/new items), analysis (analyze/detect/validate), bulk-operations (bulk updates), query (WIQL/OData), ai-powered (AI tools), all (no filter, default)"
        }
      },
      required: ["intent"]
    }
  },
  {
    name: "wit-sprint-planning-analyzer",
    description: "🤖 AI-POWERED SPRINT PLANNING: Analyze team capacity, historical velocity, and propose optimal work assignments for a sprint. Considers team member skills, workload balance, dependencies, and historical performance to create a balanced sprint plan with confidence scoring and risk assessment.",
    script: "",
    schema: sprintPlanningAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        iterationPath: { type: "string", description: "Target iteration/sprint path (e.g., 'Project\\Sprint 10')" },
        teamMembers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string", description: "Team member email address" },
              name: { type: "string", description: "Team member display name" },
              capacityHours: { type: "number", description: "Available capacity in hours for this sprint (default 60)" },
              skills: { type: "array", items: { type: "string" }, description: "Team member skills/specializations" },
              preferredWorkTypes: { type: "array", items: { type: "string" }, description: "Preferred work item types" }
            },
            required: ["email", "name"]
          },
          description: "Team members participating in the sprint"
        },
        sprintCapacityHours: { type: "number", description: "Total team capacity in hours (overrides individual capacities)" },
        historicalSprintsToAnalyze: { type: "number", description: "Number of previous sprints to analyze for velocity (default 3, max 10)" },
        candidateWorkItemIds: { type: "array", items: { type: "number" }, description: "Work item IDs to consider for sprint assignment" },
        considerDependencies: { type: "boolean", description: "Consider work item dependencies in planning (default true)" },
        considerSkills: { type: "boolean", description: "Match work items to team member skills (default true)" },
        additionalConstraints: { type: "string", description: "Additional planning constraints (e.g., 'prioritize bugs', 'balance frontend/backend')" },
        organization: { type: "string", description: "Azure DevOps organization (uses config default if not provided)" },
        project: { type: "string", description: "Azure DevOps project (uses config default if not provided)" },
        areaPath: { type: "string", description: "Area path to filter work items (uses config default if not provided)" }
      },
      required: ["iterationPath", "teamMembers"]
    }
  }
];

/**
 * AI-powered tools that require VS Code sampling support
 */
export const AI_POWERED_TOOLS = [
  'wit-intelligence-analyzer',
  'wit-ai-assignment-analyzer',
  'wit-personal-workload-analyzer',
  'wit-sprint-planning-analyzer',
  'wit-bulk-enhance-descriptions-by-query-handle',
  'wit-bulk-assign-story-points-by-query-handle',
  'wit-bulk-add-acceptance-criteria-by-query-handle',
  'wit-generate-wiql-query',
  'wit-generate-odata-query',
  'wit-discover-tools'
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