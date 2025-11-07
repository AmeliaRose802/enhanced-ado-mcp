import type { ToolConfig } from "../../types/index.js";
import {
  wiqlQuerySchema,
  odataQuerySchema
} from "../schemas.js";

/**
 * Query Tools
 * Tools for WIQL and OData queries
 */
export const queryTools: ToolConfig[] = [
  {
    name: "query-wiql",
    description: "🔐 UNIFIED WIQL TOOL: Execute WIQL queries (direct or AI-generated from natural language) and get both work item details AND a query handle for safe bulk operations. Supports AI-powered query generation with automatic validation, filtering by patterns, staleness analysis, and full context packages. ⚠️ CRITICAL: Do not reference work item IDs directly in subsequent operations - use the returned query_handle with bulk operation tools to prevent ID hallucination. Default returns handle + details for analysis workflows. Use handleOnly=true to return ONLY the query handle without fetching data (efficient for bulk operations). Limit: 200 items per page (use pagination for more). Can filter results by last substantive change date to find stale or recently active items.",
    script: "",
    schema: wiqlQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        // Query Definition (provide ONE)
        description: { type: "string", description: "🤖 AI-POWERED: Natural language description of what you want to find (e.g., 'all active bugs created in the last week', 'unassigned items in committed state'). When provided, the tool will generate and validate a WIQL query automatically." },
        wiqlQuery: { type: "string", description: "Direct WIQL query string. Examples: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'' or 'SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'ProjectName\\AreaName' ORDER BY [System.ChangedDate] DESC'. Use this when you know the exact WIQL syntax you need." },
        
        // AI Generation Options (only used with 'description')
        includeExamples: { type: "boolean", description: "🤖 Include example patterns in AI prompt when generating queries (default true). Only relevant when using 'description' parameter." },
        maxIterations: { type: "number", description: "🤖 Maximum attempts to generate valid query when using AI generation (1-5, default 3). Only relevant when using 'description' parameter." },
        testQuery: { type: "boolean", description: "🤖 Test generated query by executing it to validate syntax (default true). Only relevant when using 'description' parameter." },
        
        // Scope Configuration (auto-filled from config)
        organization: { type: "string", description: "Azure DevOps organization name (uses configured default if not provided)" },
        project: { type: "string", description: "Azure DevOps project name (uses configured default if not provided)" },
        areaPath: { type: "string", description: "Override default area path from config (automatically scopes queries to configured area)" },
        areaPathFilter: { type: "array", items: { type: "string" }, description: "Explicitly specify area paths to filter by (e.g., ['ProjectA\\\\TeamAlpha', 'ProjectA\\\\TeamBeta']). Takes precedence over default area paths and areaPath parameter. Use this when working with multiple specific area paths." },
        useDefaultAreaPaths: { type: "boolean", description: "Control whether to automatically filter by default area paths from configuration (default: true). Set to false to query across the entire project without area path filtering. Ignored if areaPathFilter is explicitly provided. Use this when you need to query across all areas or when default filtering is causing issues." },
        iterationPath: { type: "string", description: "Override default iteration path from config" },
        
        // Result Configuration
        returnQueryHandle: { type: "boolean", description: "🔐 DEFAULT TRUE: Return query handle for safe operations. ⚠️ Only set to false if you need raw IDs for immediate user display. For analysis, bulk operations, or any workflow that might reference IDs later, keep this true to prevent hallucination. Handle expires after 1 hour." },
        handleOnly: { type: "boolean", description: "⚡ EFFICIENCY MODE: When true (with returnQueryHandle=true), returns ONLY the query handle and count without fetching full work item data. Use this for bulk operations where you don't need to preview/analyze items first - saves API calls and response payload. To retrieve items later, use wit-query-handle-get-items with the handle. Default: false." },
        maxResults: { type: "number", description: "Maximum number of results to return per page (default 200, max 10000). ⚠️ Results are truncated at this limit - use pagination for more." },
        skip: { type: "number", description: "Number of work items to skip for pagination (default 0). Example: skip=200, maxResults=200 gets items 201-400." },
        top: { type: "number", description: "Maximum number of work items to return (alias for maxResults, max 10000). When specified, overrides maxResults." },
        
        // Data Enrichment
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include (e.g., 'System.Description', 'Microsoft.VSTS.Common.Priority')" },
        includeSubstantiveChange: { type: "boolean", description: "Include computed fields lastSubstantiveChangeDate and daysInactive for each work item - automatically filters out automated changes. Essential for backlog hygiene workflows." },
        fetchFullPackages: { type: "boolean", description: "Fetch full context packages for each work item including description, comments, history, relations, children, and parent. ⚠️ WARNING: Increases API calls significantly (1 call per work item + relations/comments). Use for deep analysis of small result sets (<50 items). Automatically includes extended fields, relations, comments, and history." },
        
        // Filtering (applied post-query)
        filterByPatterns: { type: "array", items: { type: "string", enum: ["duplicates", "placeholder_titles", "unassigned_committed", "stale_automation", "missing_description", "missing_acceptance_criteria"] }, description: "Filter results by common work item patterns. 'duplicates': similar titles (case-insensitive comparison). 'placeholder_titles': contains TBD/TODO/FIXME/XXX/test/temp/foo/bar/baz markers. 'unassigned_committed': Active/Committed/In Progress state but no assignee. 'stale_automation': Automation-created items ([S360]/[automated]/[bot]/[scan]) inactive 180+ days. 'missing_description': description field empty or <10 chars. 'missing_acceptance_criteria': acceptance criteria field empty or <10 chars. Can specify multiple patterns to filter by all." },
        filterByDaysInactiveMin: { type: "number", description: "Filter results to only include work items with daysInactive >= this value. Auto-enables includeSubstantiveChange. Use for finding stale items (e.g., 180 for items inactive 6+ months)." },
        filterByDaysInactiveMax: { type: "number", description: "Filter results to only include work items with daysInactive <= this value. Auto-enables includeSubstantiveChange. Use for finding recently active items (e.g., 30 for items active in last month)." },
        filterBySubstantiveChangeAfter: { type: "string", description: "Filter results to only include work items with lastSubstantiveChangeDate after this date (ISO 8601 format, e.g., '2024-01-01T00:00:00Z'). Auto-enables includeSubstantiveChange. Use for finding recently active items." },
        filterBySubstantiveChangeBefore: { type: "string", description: "Filter results to only include work items with lastSubstantiveChangeDate before this date (ISO 8601 format). Auto-enables includeSubstantiveChange. Use for finding stale items." },
        
        // Advanced Options
        includePaginationDetails: { type: "boolean", description: "Force include pagination details in response even for complete result sets. By default, pagination is only included when totalCount > maxResults (multi-page results). Set to true to always include pagination metadata." }
      },
      required: []
    }
  },
  {
    name: "query-odata",
    description: "🔐 UNIFIED ODATA TOOL: Execute OData Analytics queries (direct or AI-generated from natural language) for metrics, aggregations, and trend analysis. Supports both predefined query types (counts, grouping by state/type/assignee, velocity metrics) and custom queries. AI-powered query generation validates and tests queries automatically. For aggregation queries, returns statistical summaries. For work item list queries, can return query handles for safe bulk operations. Requires 'View analytics' permission in Azure DevOps.",
    script: "",
    schema: odataQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        // Query Definition (provide ONE)
        description: { type: "string", description: "🤖 AI-POWERED: Natural language description of analytics query (e.g., 'count active bugs by assignee', 'velocity metrics for last sprint'). When provided, the tool will generate and validate an OData query automatically." },
        queryType: { type: "string", enum: ["workItemCount", "groupByState", "groupByType", "groupByAssignee", "velocityMetrics", "cycleTimeMetrics", "customQuery"], description: "Predefined query type for direct execution. workItemCount: count of items. groupByState/Type/Assignee: grouped aggregations. velocityMetrics: completed work over time. cycleTimeMetrics: time from creation to completion." },
        customODataQuery: { type: "string", description: "Custom OData query string for advanced scenarios. Use OData v4.0 syntax with $filter, $apply, $select, $orderby, etc." },
        
        // AI Generation Options (only used with 'description')
        includeExamples: { type: "boolean", description: "🤖 Include example patterns in AI prompt when generating queries (default true). Only relevant when using 'description' parameter." },
        maxIterations: { type: "number", description: "🤖 Maximum attempts to generate valid query when using AI generation (1-5, default 3). Only relevant when using 'description' parameter." },
        testQuery: { type: "boolean", description: "🤖 Test generated query by executing it to validate syntax (default true). Only relevant when using 'description' parameter." },
        
        // OData Query Parameters (used with queryType or customODataQuery)
        filters: { type: "object", description: "Filter conditions (e.g., { State: 'Active', WorkItemType: 'Bug' })" },
        groupBy: { type: "array", items: { type: "string" }, description: "Fields to group by for aggregation" },
        select: { type: "array", items: { type: "string" }, description: "Specific fields to return" },
        orderBy: { type: "string", description: "Field to order results by (e.g., 'Count desc')" },
        dateRangeField: { type: "string", enum: ["CreatedDate", "ChangedDate", "CompletedDate", "ClosedDate"], description: "Date field to filter by" },
        dateRangeStart: { type: "string", description: "Start date (ISO 8601: YYYY-MM-DD)" },
        dateRangeEnd: { type: "string", description: "End date (ISO 8601: YYYY-MM-DD)" },
        computeCycleTime: { type: "boolean", description: "Compute cycle time for completed items (used with cycleTimeMetrics)" },
        
        // Result Configuration
        returnQueryHandle: { type: "boolean", description: "🔐 Return query handle for safe bulk operations (default false). Only works for non-aggregation queries that return work item lists. Aggregation queries always return statistical summaries." },
        maxResults: { type: "number", description: "Maximum results when returnQueryHandle=true (default 200, max 1000)" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include when returnQueryHandle=true" },
        top: { type: "number", description: "Maximum number of results for analytics queries (default 1000, max 10000)" },
        skip: { type: "number", description: "Number of results to skip for pagination (default 0)" },
        includeMetadata: { type: "boolean", description: "Include query and URL metadata in response (default false)" },
        includeOdataMetadata: { type: "boolean", description: "Include OData metadata fields (@odata.*) in response (default false)" },
        
        // Scope Configuration (auto-filled from config)
        organization: { type: "string", description: "Azure DevOps organization name (uses configured default if not provided)" },
        project: { type: "string", description: "Azure DevOps project name (uses configured default if not provided)" },
        areaPath: { type: "string", description: "Filter by Area Path" },
        areaPathFilter: { type: "array", items: { type: "string" }, description: "Explicitly specify area paths to filter by (e.g., ['ProjectA\\\\TeamAlpha', 'ProjectA\\\\TeamBeta']). Takes precedence over default area paths." },
        useDefaultAreaPaths: { type: "boolean", description: "Control whether to automatically filter by default area paths from configuration (default: true). Set to false to query across the entire project without area path filtering." },
        iterationPath: { type: "string", description: "Filter by Iteration Path" }
      },
      required: []
    }
  }
];
