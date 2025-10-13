import type { ToolConfig } from "../../types/index.js";
import {
  wiqlQuerySchema,
  odataAnalyticsQuerySchema,
  getLastSubstantiveChangeSchema,
  validateHierarchyFastSchema
} from "../schemas.js";

/**
 * Query Tools
 * Tools for WIQL and OData queries
 */
export const queryTools: ToolConfig[] = [
  {
    name: "wit-get-work-items-by-query-wiql",
    description: "🔐 ANTI-HALLUCINATION TOOL: Execute WIQL query and get both work item details AND a query handle for safe operations. ⚠️ CRITICAL: Do not reference work item IDs directly in subsequent operations - use the returned query_handle with bulk operation tools to prevent ID hallucination. Default returns handle + details for analysis workflows. Use handleOnly=true with returnQueryHandle=true to return ONLY the query handle without fetching work item data (efficient for bulk operations where you don't need to preview items). Limit: 200 items (use pagination for more). Can filter results by last substantive change date to find stale or recently active items.",
    script: "",
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
        filterByPatterns: { type: "array", items: { type: "string", enum: ["duplicates", "placeholder_titles", "unassigned_committed", "stale_automation", "missing_description", "missing_acceptance_criteria"] }, description: "Filter results by common work item patterns. 'duplicates': similar titles (case-insensitive comparison). 'placeholder_titles': contains TBD/TODO/FIXME/XXX/test/temp/foo/bar/baz markers. 'unassigned_committed': Active/Committed/In Progress state but no assignee. 'stale_automation': Automation-created items ([S360]/[automated]/[bot]/[scan]) inactive 180+ days. 'missing_description': description field empty or <10 chars. 'missing_acceptance_criteria': acceptance criteria field empty or <10 chars. Can specify multiple patterns to filter by all." },
        returnQueryHandle: { type: "boolean", description: "🔐 DEFAULT TRUE: Return query handle for safe operations. ⚠️ Only set to false if you need raw IDs for immediate user display. For analysis, bulk operations, or any workflow that might reference IDs later, keep this true to prevent hallucination. Handle expires after 1 hour." },
        handleOnly: { type: "boolean", description: "⚡ EFFICIENCY MODE: When true (with returnQueryHandle=true), returns ONLY the query handle and count without fetching full work item data. Use this for bulk operations where you don't need to preview/analyze items first - saves API calls and response payload. To retrieve items later, use wit-query-handle-get-items with the handle. Default: false." },
        fetchFullPackages: { type: "boolean", description: "Fetch full context packages for each work item including description, comments, history, relations, children, and parent. ⚠️ WARNING: Increases API calls significantly (1 call per work item + relations/comments). Use for deep analysis of small result sets (<50 items). Automatically includes extended fields, relations, comments, and history." },
        includePaginationDetails: { type: "boolean", description: "Force include pagination details in response even for complete result sets. By default, pagination is only included when totalCount > top (multi-page results). Set to true to always include pagination metadata." }
      },
      required: ["wiqlQuery"]
    }
  },
  {
    name: "wit-query-analytics-odata",
    description: "Query Azure DevOps Analytics using OData for efficient aggregations, metrics, and trend analysis. Supports work item counts, grouping by state/type/assignee, velocity metrics, and cycle time analysis. Use this for analytics and reporting instead of WIQL when you need aggregated data. Supports pagination for large result sets.",
    script: "",
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
    script: "",
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
    name: "wit-validate-hierarchy",
    description: "Fast, rule-based validation of work item hierarchy. Checks parent-child type relationships (Epic->Feature, Feature->PBI, PBI->Task/Bug) and state consistency (parent state must align with children states). Returns focused results without AI analysis. Note: Large area paths (>500 items) may take 1-2 minutes to process - consider using smaller maxResults or more specific area paths for faster results.",
    script: "",
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
