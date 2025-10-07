import { z } from "zod";
import { loadConfiguration } from './config.js';

/**
 * Zod schemas for tool inputs based on PowerShell parameters
 * All schemas include parameter descriptions, defaults from configuration, and validation rules.
 */

const cfg = () => loadConfiguration();

/**
 * Schema for creating a new Azure DevOps work item
 * 
 * @example
 * ```typescript
 * {
 *   title: "Implement login feature",
 *   workItemType: "Task",
 *   parentWorkItemId: 12345,
 *   description: "Add OAuth authentication...",
 *   tags: "auth,security"
 * }
 * ```
 * 
 * @remarks
 * Most fields (organization, project, workItemType, areaPath, etc.) are auto-filled from configuration.
 * Only override them when you need to deviate from defaults.
 */
export const createNewItemSchema = z.object({
  title: z.string().describe("Title of the work item (mandatory)"),
  workItemType: z.string().optional().describe("Azure DevOps work item type, e.g. 'Task', 'Product Backlog Item', 'Bug'").default(() => cfg().azureDevOps.defaultWorkItemType),
  parentWorkItemId: z.number().int().optional().describe("Optional parent work item ID"),
  description: z.string().optional().describe("Markdown description / repro steps"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  areaPath: z.string().optional().describe("Area path override").default(() => cfg().azureDevOps.areaPath || ''),
  iterationPath: z.string().optional().describe("Iteration path override").default(() => cfg().azureDevOps.iterationPath || ''),
  assignedTo: z.string().optional().describe("User email or @me for current user").default(() => cfg().azureDevOps.defaultAssignedTo),
  priority: z.number().int().optional().describe("Priority (default 2)").default(() => cfg().azureDevOps.defaultPriority),
  tags: z.string().optional().describe("Semicolon or comma separated tags"),
  inheritParentPaths: z.boolean().optional().describe("Inherit Area/Iteration from parent if not supplied").default(() => cfg().azureDevOps.inheritParentPaths)
});

/**
 * Schema for assigning an existing work item to GitHub Copilot
 * 
 * @example
 * ```typescript
 * {
 *   workItemId: 12345,
 *   repository: "my-repo",
 *   branch: "feature/auth"
 * }
 * ```
 * 
 * @remarks
 * Creates a hyperlink from the work item to a Git branch, making it assignable to GitHub Copilot.
 * Requires gitHubCopilotGuid to be configured or provided.
 */
export const assignToCopilotSchema = z.object({
  workItemId: z.number().int().describe("Existing work item ID to assign"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  repository: z.string().describe("Git repository name (required)"),
  branch: z.string().optional().default(() => cfg().gitRepository.defaultBranch),
  gitHubCopilotGuid: z.string().optional().default(() => cfg().gitHubCopilot.defaultGuid || '').refine(val => val.length > 0, {
    message: "GitHub Copilot GUID is required. Please provide it as a parameter or set gitHubCopilot.defaultGuid in your configuration."
  })
});

/**
 * Schema for creating a new work item and immediately assigning it to GitHub Copilot
 * 
 * @example
 * ```typescript
 * {
 *   title: "Implement API endpoint",
 *   parentWorkItemId: 12345,
 *   repository: "backend-api",
 *   description: "Create /users endpoint..."
 * }
 * ```
 * 
 * @remarks
 * Combines work item creation and Copilot assignment in one atomic operation.
 * Inherits configuration defaults for most fields.
 */
export const newCopilotItemSchema = z.object({
  title: z.string(),
  parentWorkItemId: z.number().int().describe("Parent work item ID under which to create the new item"),
  workItemType: z.string().optional().default(() => cfg().azureDevOps.defaultWorkItemType),
  description: z.string().optional(),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  repository: z.string().describe("Git repository name (required)"),
  branch: z.string().optional().default(() => cfg().gitRepository.defaultBranch),
  gitHubCopilotGuid: z.string().optional().default(() => cfg().gitHubCopilot.defaultGuid || '').refine(val => val.length > 0, {
    message: "GitHub Copilot GUID is required. Please provide it as a parameter or set gitHubCopilot.defaultGuid in your configuration."
  }),
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ''),
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ''),
  priority: z.number().int().optional().default(() => cfg().azureDevOps.defaultPriority),
  tags: z.string().optional(),
  inheritParentPaths: z.boolean().optional().default(() => cfg().azureDevOps.inheritParentPaths)
});

/**
 * Schema for extracting security instruction links from Azure DevOps work items
 * 
 * @example
 * ```typescript
 * {
 *   workItemId: 12345,
 *   scanType: "CodeQL",
 *   extractFromComments: true
 * }
 * ```
 * 
 * @remarks
 * Useful for analyzing security scan results and extracting remediation guidance URLs.
 * Supports multiple security scanners (BinSkim, CodeQL, CredScan).
 */
export const extractSecurityLinksSchema = z.object({
  workItemId: z.number().int().describe("Azure DevOps work item ID to extract instruction links from"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  scanType: z.enum(["BinSkim", "CodeQL", "CredScan", "General", "All"]).optional().default("All").describe("Type of security scanner to filter links for"),
  includeWorkItemDetails: z.boolean().optional().default(false).describe("Include detailed work item information in the response"),
  extractFromComments: z.boolean().optional().default(false).describe("Also extract links from work item comments"),
  dryRun: z.boolean().optional().default(false).describe("Run in dry-run mode without making actual API calls")
});

/**
 * Schema for AI-powered work item intelligence analysis
 * 
 * @example
 * ```typescript
 * {
 *   title: "Add user authentication",
 *   description: "Users need to log in...",
 *   analysisType: "full",
 *   enhanceDescription: true
 * }
 * ```
 * 
 * @remarks
 * Provides AI-powered analysis including completeness scoring, AI readiness, categorization,
 * and enhancement suggestions. Requires VS Code sampling support.
 */
export const workItemIntelligenceSchema = z.object({
  title: z.string().describe("Work item title to analyze"),
  description: z.string().optional().describe("Work item description/content to analyze"),
  workItemType: z.string().optional().describe("Type of work item (Task, Bug, PBI, etc.)"),
  acceptanceCriteria: z.string().optional().describe("Current acceptance criteria if any"),
  analysisType: z.enum(["completeness", "ai-readiness", "enhancement", "categorization", "full"]).optional().default("full").describe("Type of analysis to perform"),
  contextInfo: z.string().optional().describe("Additional context about the project, team, or requirements"),
  enhanceDescription: z.boolean().optional().default(false).describe("Generate an enhanced, AI-ready description"),
  createInADO: z.boolean().optional().default(false).describe("Automatically create the enhanced item in Azure DevOps"),
  parentWorkItemId: z.number().int().optional().describe("Parent work item ID if creating in ADO"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for AI-powered assignment suitability analysis
 * 
 * @example
 * ```typescript
 * {
 *   workItemId: 12345,
 *   outputFormat: "json"
 * }
 * ```
 * 
 * @remarks
 * Analyzes whether a work item is suitable for GitHub Copilot assignment.
 * Automatically fetches work item details from Azure DevOps.
 * Provides confidence scores, risk assessment, and recommendations.
 * Requires VS Code sampling support.
 */
export const aiAssignmentAnalyzerSchema = z.object({
  workItemId: z.number().int().describe("Azure DevOps work item ID to analyze for AI assignment suitability"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  outputFormat: z.enum(["detailed", "json"]).optional().default("detailed").describe("Output format: 'detailed' (default, comprehensive analysis) or 'json' (structured JSON for programmatic use)")
});

// Configuration and discovery tool schemas
export const getConfigurationSchema = z.object({
  includeSensitive: z.boolean().optional().default(false).describe("Include potentially sensitive configuration values"),
  section: z.enum(["all", "azureDevOps", "gitRepository", "gitHubCopilot"]).optional().default("all").describe("Specific configuration section to retrieve")
});

/**
 * Schema for querying Azure DevOps work items using WIQL (Work Item Query Language)
 * 
 * @example
 * ```typescript
 * {
 *   wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
 *   maxResults: 100,
 *   includeSubstantiveChange: true
 * }
 * ```
 * 
 * @remarks
 * Supports complex WIQL queries with filtering, sorting, and field selection.
 * Can optionally compute metrics like daysInactive and substantive change dates.
 */
export const wiqlQuerySchema = z.object({
  wiqlQuery: z.string().describe("WIQL (Work Item Query Language) query string to execute. Example: SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  includeFields: z.array(z.string()).optional().describe("Additional fields to include in work item details (default includes Id, Title, Type, State, AreaPath, IterationPath, AssignedTo)"),
  maxResults: z.number().int().optional().default(200).describe("Maximum number of work items to return per page (default 200)"),
  skip: z.number().int().optional().default(0).describe("Number of work items to skip for pagination (default 0). Use with top for pagination."),
  top: z.number().int().optional().describe("Maximum number of work items to return (alias for maxResults). When specified, overrides maxResults."),
  includeSubstantiveChange: z.boolean().optional().default(false).describe("Include computed fields lastSubstantiveChangeDate and daysInactive for each work item - automatically filters out automated changes like iteration path updates. Essential for backlog hygiene workflows. Minimal overhead: only 2 fields per item."),
  substantiveChangeHistoryCount: z.number().int().optional().default(50).describe("Number of revisions to analyze when computing substantive change (default 50)"),
  filterBySubstantiveChangeAfter: z.string().optional().describe("Filter results to only include work items with lastSubstantiveChangeDate after this date (ISO 8601 format, e.g., '2024-01-01T00:00:00Z'). Automatically enables includeSubstantiveChange. Use for finding recently active items."),
  filterBySubstantiveChangeBefore: z.string().optional().describe("Filter results to only include work items with lastSubstantiveChangeDate before this date (ISO 8601 format, e.g., '2024-01-01T00:00:00Z'). Automatically enables includeSubstantiveChange. Use for finding stale items."),
  filterByDaysInactiveMin: z.number().int().optional().describe("Filter results to only include work items with daysInactive >= this value. Automatically enables includeSubstantiveChange. Use for finding stale items."),
  filterByDaysInactiveMax: z.number().int().optional().describe("Filter results to only include work items with daysInactive <= this value. Automatically enables includeSubstantiveChange. Use for finding recently active items."),
  computeMetrics: z.boolean().optional().default(false).describe("Include computed metrics: daysInactive (from changed date), daysSinceCreated, hasDescription (>50 chars), isStale (inactive >180 days)"),
  staleThresholdDays: z.number().int().optional().default(180).describe("Number of days to consider a work item stale (default 180)"),
  filterByMissingDescription: z.boolean().optional().default(false).describe("Filter results to only include work items with missing or empty description (after stripping HTML, less than 10 characters). Useful for finding incomplete work items that need documentation."),
  filterByMissingAcceptanceCriteria: z.boolean().optional().default(false).describe("Filter results to only include work items with missing or empty acceptance criteria (after stripping HTML, less than 10 characters). Useful for finding PBIs/Features that need completion criteria defined."),
  returnQueryHandle: z.boolean().optional().default(true).describe("🔐 ANTI-HALLUCINATION: Return a query handle along with full work item details. Handle enables safe bulk operations without ID hallucination risk. Set to false only if you need IDs for immediate display to user. Handle expires after 1 hour. RECOMMENDED: Always keep true for analysis workflows."),
  fetchFullPackages: z.boolean().optional().default(false).describe("Fetch full context packages for each work item including description, comments, history, relations, children, and parent. ⚠️ WARNING: Increases API calls significantly (1 call per work item + 1 for comments/relations). Use sparingly for deep analysis of small result sets (<50 items). Automatically includes extended fields, relations, comments, and history."),
  includePaginationDetails: z.boolean().optional().default(false).describe("Force include pagination details in response even for complete result sets. By default, pagination is only included when totalCount > top (multi-page results). Set to true to always include pagination metadata.")
});

/**
 * Schema for querying Azure DevOps Analytics using OData
 * 
 * @example
 * ```typescript
 * {
 *   queryType: "workItemCount",
 *   filters: { State: "Active", WorkItemType: "Bug" }
 * }
 * ```
 * 
 * @remarks
 * Provides efficient analytics queries using OData for aggregations, metrics, and trend analysis.
 * Supports grouping, filtering, and computed fields like cycle time.
 */
export const odataAnalyticsQuerySchema = z.object({
  queryType: z.enum([
    "workItemCount",
    "groupByState",
    "groupByType",
    "groupByAssignee",
    "velocityMetrics",
    "cycleTimeMetrics",
    "customQuery"
  ]).describe("Type of analytics query to execute"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Filter conditions (e.g., { State: 'Active', WorkItemType: 'Bug' })"),
  groupBy: z.array(z.string()).optional().describe("Fields to group by for aggregation (e.g., ['State', 'AssignedTo'])"),
  select: z.array(z.string()).optional().describe("Specific fields to return in results"),
  orderBy: z.string().optional().describe("Field to order results by (e.g., 'Count desc')"),
  customODataQuery: z.string().optional().describe("Custom OData query string for advanced scenarios (used when queryType is 'customQuery')"),
  dateRangeField: z.enum(["CreatedDate", "ChangedDate", "CompletedDate", "ClosedDate"]).optional().describe("Date field to filter by"),
  dateRangeStart: z.string().optional().describe("Start date for date range filter (ISO 8601 format: YYYY-MM-DD)"),
  dateRangeEnd: z.string().optional().describe("End date for date range filter (ISO 8601 format: YYYY-MM-DD)"),
  areaPath: z.string().optional().describe("Filter by Area Path"),
  iterationPath: z.string().optional().describe("Filter by Iteration Path"),
  top: z.number().int().optional().default(100).describe("Maximum number of results to return (default 100)"),
  computeCycleTime: z.boolean().optional().default(false).describe("Compute cycle time (CompletedDate - CreatedDate) for completed items"),
  includeMetadata: z.boolean().optional().default(false).describe("Include query and URL metadata in response"),
  includeOdataMetadata: z.boolean().optional().default(false).describe("Include OData metadata fields (@odata.context, @odata.count, @odata.nextLink) in response (default: false)")
});

// Full context package retrieval (single work item)
export const workItemContextPackageSchema = z.object({
  workItemId: z.number().int().describe("Primary work item ID to retrieve full context for"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  includeHistory: z.boolean().optional().default(false).describe("Include recent change history (disabled by default to save ~40KB per work item)"),
  maxHistoryRevisions: z.number().int().optional().default(5).describe("Maximum number of recent history revisions to include when history is enabled (sorted by revision number descending)"),
  includeComments: z.boolean().optional().default(true).describe("Include work item comments/discussion"),
  includeRelations: z.boolean().optional().default(true).describe("Include related links (parent, children, related, attachments, commits, PRs)"),
  includeChildren: z.boolean().optional().default(true).describe("Include all child hierarchy (one level) if item is a Feature/Epic"),
  includeParent: z.boolean().optional().default(true).describe("Include parent work item details if present"),
  includeLinkedPRsAndCommits: z.boolean().optional().default(true).describe("Include linked Git PRs and commits if present in relations"),
  includeExtendedFields: z.boolean().optional().default(false).describe("Include extended field set beyond defaults (all system fields + common custom)"),
  includeHtml: z.boolean().optional().default(false).describe("Return original HTML field values alongside Markdown/plain text"),
  includeHtmlFields: z.boolean().optional().default(false).describe("Whether to include original HTML-formatted fields (System.Description, Microsoft.VSTS.TCM.ReproSteps, Microsoft.VSTS.Common.AcceptanceCriteria). When false, HTML is stripped. Saves ~10-30% context window usage."),
  stripHtmlFormatting: z.boolean().optional().default(true).describe("Whether to convert HTML fields to plain text by removing tags and decoding entities. When true, converts HTML to readable plain text preserving line breaks."),
  maxChildDepth: z.number().int().optional().default(1).describe("Depth of child hierarchy to traverse (1 = immediate children)"),
  maxRelatedItems: z.number().int().optional().default(50).describe("Maximum number of related items to expand"),
  includeAttachments: z.boolean().optional().default(false).describe("Include attachment metadata (names, urls, sizes)"),
  includeTags: z.boolean().optional().default(true).describe("Include tags list")
});

// Batch context package retrieval for multiple work items (returns graph)
export const workItemsBatchContextSchema = z.object({
  workItemIds: z.array(z.number().int()).min(1).max(50).describe("List of work item IDs to retrieve with relationship context (max 50)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  includeRelations: z.boolean().optional().default(true).describe("Include relationship edges between provided items (parent-child, related, blocks)"),
  includeFields: z.array(z.string()).optional().describe("Additional fields to include per work item"),
  includeExtendedFields: z.boolean().optional().default(false).describe("Include extended field set beyond defaults"),
  includeTags: z.boolean().optional().default(true).describe("Include tags list"),
  includeStateCounts: z.boolean().optional().default(true).describe("Return aggregate counts by state and type"),
  includeStoryPointAggregation: z.boolean().optional().default(true).describe("Aggregate story points / effort fields if present"),
  includeRiskScoring: z.boolean().optional().default(false).describe("Include basic heuristic risk / staleness scoring"),
  includeAIAssignmentHeuristic: z.boolean().optional().default(false).describe("Include lightweight AI suitability heuristic (not full analyzer)"),
  includeParentOutsideSet: z.boolean().optional().default(true).describe("If an item has a parent not in set, include minimal parent reference"),
  includeChildrenOutsideSet: z.boolean().optional().default(false).describe("Include minimal references to children not in requested set"),
  maxOutsideReferences: z.number().int().optional().default(50).describe("Cap number of outside references added"),
  returnFormat: z.enum(["graph", "array"]).optional().default("graph").describe("Return as graph (nodes/edges) or simple array")
});

export const getLastSubstantiveChangeSchema = z.object({
  workItemId: z.number().int().describe("Work item ID to analyze"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.organization),
  historyCount: z.number().int().optional().default(50).describe("Number of revisions to analyze (default 50)"),
  automatedPatterns: z.array(z.string()).optional().describe("Custom automation account patterns to filter (e.g., ['Bot Name', 'System Account'])")
});

export const detectPatternsSchema = z.object({
  workItemIds: z.array(z.number().int()).optional().describe("Specific work item IDs to analyze (if not provided, uses areaPath)"),
  areaPath: z.string().optional().describe("Area path to search for work items (if workItemIds not provided)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  patterns: z.array(z.enum(['duplicates', 'placeholder_titles', 'orphaned_children', 'unassigned_committed', 'stale_automation', 'no_description'])).optional().default(['duplicates', 'placeholder_titles', 'unassigned_committed', 'no_description']).describe("Patterns to detect"),
  maxResults: z.number().int().optional().default(200).describe("Maximum number of results when using areaPath"),
  includeSubAreas: z.boolean().optional().default(true).describe("Include sub-area paths when using areaPath"),
  format: z.enum(['summary', 'categorized', 'flat']).optional().default('categorized').describe("Response format: 'summary' (counts only, ~50-70% context reduction), 'categorized' (grouped by severity, default), 'flat' (single array with pattern field)")
});

export const validateHierarchyFastSchema = z.object({
  workItemIds: z.array(z.number().int()).optional().describe("Specific work item IDs to validate (if not provided, uses areaPath)"),
  areaPath: z.string().optional().describe("Area path to validate all work items within (if workItemIds not provided)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  maxResults: z.number().int().optional().default(500).describe("Maximum number of work items to analyze when using areaPath"),
  includeSubAreas: z.boolean().optional().default(true).describe("Include child area paths in analysis"),
  validateTypes: z.boolean().optional().default(true).describe("Validate parent-child type relationships (e.g., Epic children must be Features)"),
  validateStates: z.boolean().optional().default(true).describe("Validate state consistency between parents and children")
});

/**
 * Bulk operation schemas using query handles
 * These tools eliminate ID hallucination risk by using query handles
 */

/**
 * Reusable item selector schema for bulk operations
 * Allows selecting items by:
 * - "all" - operate on all items in the query handle
 * - number[] - operate on specific indices (e.g., [0, 5, 12])
 * - criteria object - operate on items matching server-side criteria
 */
const itemSelectorSchema = z.union([
  z.literal("all"),
  z.array(z.number()).max(100),
  z.object({
    states: z.array(z.string()).optional(),
    titleContains: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    daysInactiveMin: z.number().optional(),
    daysInactiveMax: z.number().optional()
  })
]).default("all").describe("Item selection: 'all' for all items, array of indices [0,1,2] for specific items by position, or criteria object for server-side filtering");

export const bulkCommentByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true"),
  comment: z.string().describe("Comment text to add to all work items (supports Markdown)"),
  itemSelector: itemSelectorSchema,
  dryRun: z.boolean().optional().default(true).describe("Preview operation without making changes (default: true for safety)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const bulkUpdateByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true"),
  updates: z.array(z.object({
    op: z.enum(['add', 'replace', 'remove']).describe("JSON Patch operation"),
    path: z.string().describe("Field path (e.g., '/fields/System.State', '/fields/System.AssignedTo')"),
    value: z.union([z.string(), z.number(), z.boolean()]).optional().describe("Value to set (not needed for 'remove' operation)")
  })).min(1).describe("Array of JSON Patch operations to apply to selected work items"),
  itemSelector: itemSelectorSchema,
  dryRun: z.boolean().optional().default(true).describe("Preview operation without making changes (default: true for safety)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const bulkAssignByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true"),
  assignTo: z.string().describe("User email or display name to assign work items to"),
  itemSelector: itemSelectorSchema,
  dryRun: z.boolean().optional().default(true).describe("Preview operation without making changes (default: true for safety)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const bulkRemoveByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true"),
  removeReason: z.string().optional().describe("Reason for removing work items (added as comment before removal)"),
  itemSelector: itemSelectorSchema,
  dryRun: z.boolean().optional().default(true).describe("Preview operation without making changes (default: true for safety)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const validateQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle to validate (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)"),
  includeSampleItems: z.boolean().optional().default(false).describe("Fetch and include sample items (first 5) with titles and states"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const analyzeByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle from wit-get-work-items-by-query-wiql (forces safe analysis without ID hallucination)"),
  analysisType: z.array(z.enum(['effort', 'velocity', 'assignments', 'risks', 'completion', 'priorities'])).min(1).describe("Types of analysis to perform: effort (Story Points), velocity (completion trends), assignments (team distribution), risks (blockers/stale items), completion (state distribution), priorities (priority breakdown)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const listQueryHandlesSchema = z.object({
  includeExpired: z.boolean().optional().default(false).describe("Include expired handles in the list (default false)")
});

export const inspectQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle to inspect (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)"),
  includePreview: z.boolean().optional().default(true).describe("Include preview of first 10 work items with their context data"),
  includeStats: z.boolean().optional().default(true).describe("Include staleness statistics and analysis metadata"),
  includeExamples: z.boolean().optional().default(false).describe("Include selection examples showing how to use itemSelector (default false, saves ~300 tokens)")
});

export const selectItemsFromQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle to preview item selection for"),
  itemSelector: z.union([
    z.literal("all"),                    // Operate on all items
    z.array(z.number()).max(100),        // Operate on specific indices [0, 5, 12]
    z.object({                           // Operate by server-side criteria
      states: z.array(z.string()).optional(),
      titleContains: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().optional(),
      daysInactiveMax: z.number().optional()
    })
  ]).describe("Item selection: 'all' for all items, array of indices [0,1,2] for specific items by position, or criteria object for server-side filtering"),
  previewCount: z.number().int().optional().default(10).describe("Number of selected items to preview (default 10, max 50)")
});

/**
 * Schema for bulk intelligent description enhancement
 * Uses AI to generate improved descriptions for work items identified by query handle
 */
export const bulkEnhanceDescriptionsByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle identifying work items to enhance (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)"),
  itemSelector: itemSelectorSchema,
  sampleSize: z.number().int().min(1).max(100).optional().default(10).describe("Max items to process in one call (default 10, max 100 for performance)"),
  enhancementStyle: z.enum(['detailed', 'concise', 'technical', 'business']).optional().default('detailed').describe("Style of enhanced description: detailed (comprehensive), concise (brief), technical (dev-focused), business (stakeholder-focused)"),
  preserveExisting: z.boolean().optional().default(true).describe("Append to existing description rather than replace (default true)"),
  dryRun: z.boolean().optional().default(true).describe("Preview AI-generated descriptions without updating work items (default true for safety)"),
  returnFormat: z.enum(['summary', 'preview', 'full']).optional().describe("Response format: 'summary' (counts only, ~70% reduction), 'preview' (200 char previews, ~40% reduction), 'full' (complete text). Defaults to 'summary' for dry-run, 'preview' for execute."),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for bulk intelligent story point assignment
 * Uses AI to estimate story points based on work item context
 */
export const bulkAssignStoryPointsByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle identifying work items to estimate (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)"),
  itemSelector: itemSelectorSchema,
  sampleSize: z.number().int().min(1).max(100).optional().default(10).describe("Max items to process in one call (default 10, max 100)"),
  pointScale: z.enum(['fibonacci', 'linear', 't-shirt']).optional().default('fibonacci').describe("Story point scale: fibonacci (1,2,3,5,8,13), linear (1-10), t-shirt (XS,S,M,L,XL)"),
  onlyUnestimated: z.boolean().optional().default(true).describe("Only assign points to items without existing effort estimates (default true)"),
  includeCompleted: z.boolean().optional().default(false).describe("Include completed/done items for historical analysis (default false)"),
  dryRun: z.boolean().optional().default(true).describe("Preview AI-estimated story points without updating work items (default true for safety)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for bulk intelligent acceptance criteria generation
 * Uses AI to generate acceptance criteria based on work item context
 */
export const bulkAddAcceptanceCriteriaByQueryHandleSchema = z.object({
  queryHandle: z.string().describe("Query handle identifying work items to enhance (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)"),
  itemSelector: itemSelectorSchema,
  sampleSize: z.number().int().min(1).max(100).optional().default(10).describe("Max items to process in one call (default 10, max 100)"),
  criteriaFormat: z.enum(['gherkin', 'checklist', 'user-story']).optional().default('gherkin').describe("Format: gherkin (Given/When/Then), checklist (bullet points), user-story (As a/I want/So that)"),
  minCriteria: z.number().int().min(1).max(10).optional().default(3).describe("Minimum number of acceptance criteria to generate (default 3)"),
  maxCriteria: z.number().int().min(1).max(15).optional().default(7).describe("Maximum number of acceptance criteria to generate (default 7)"),
  preserveExisting: z.boolean().optional().default(true).describe("Append to existing acceptance criteria rather than replace (default true)"),
  dryRun: z.boolean().optional().default(true).describe("Preview AI-generated acceptance criteria without updating work items (default true for safety)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for AI-powered WIQL query generation from natural language
 * Generates valid WIQL queries with iterative validation
 * 
 * @example
 * ```typescript
 * {
 *   description: "Find all active bugs assigned to me that were created in the last 7 days",
 *   testQuery: true,
 *   maxIterations: 3
 * }
 * ```
 */
export const generateWiqlQuerySchema = z.object({
  description: z.string().describe("Natural language description of the desired query"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || '').describe("Default area path to use in queries (optional context)"),
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || '').describe("Default iteration path to use in queries (optional context)"),
  maxIterations: z.number().int().min(1).max(5).optional().default(3).describe("Maximum iterations to try generating a valid query (default 3)"),
  includeExamples: z.boolean().optional().default(true).describe("Include example queries in the prompt for better results (default true)"),
  testQuery: z.boolean().optional().default(true).describe("Test the generated query by executing it (default true)")
});

/**
 * Schema for AI-powered OData Analytics query generation from natural language
 * Generates valid OData queries with iterative validation
 * 
 * @example
 * ```typescript
 * {
 *   description: "Count all active bugs assigned to John in the last 30 days",
 *   testQuery: true,
 *   maxIterations: 3
 * }
 * ```
 */
export const generateODataQuerySchema = z.object({
  description: z.string().describe("Natural language description of the desired OData Analytics query"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || '').describe("Default area path to use in queries (optional context)"),
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || '').describe("Default iteration path to use in queries (optional context)"),
  maxIterations: z.number().int().min(1).max(5).optional().default(3).describe("Maximum iterations to try generating a valid query (default 3)"),
  includeExamples: z.boolean().optional().default(true).describe("Include example queries in the prompt for better results (default true)"),
  testQuery: z.boolean().optional().default(true).describe("Test the generated query by executing it (default true)")
});

/**
 * Schema for AI-powered tool discovery
 * Matches natural language intent to appropriate MCP server tools
 * 
 * @example
 * ```typescript
 * {
 *   intent: "I want to find all stale work items and add a comment to them",
 *   context: "My team area path is ProjectName\\TeamArea",
 *   maxRecommendations: 3
 * }
 * ```
 */
export const toolDiscoverySchema = z.object({
  intent: z.string().describe("Natural language description of what you want to accomplish"),
  context: z.string().optional().describe("Additional context about your project, team, or requirements"),
  maxRecommendations: z.number().int().min(1).max(10).optional().default(3).describe("Maximum number of tool recommendations to return (default 3)"),
  includeExamples: z.boolean().optional().default(true).describe("Include example usage for each recommended tool (default true)"),
  filterCategory: z.enum(['creation', 'analysis', 'bulk-operations', 'query', 'ai-powered', 'all']).optional().default('all').describe("Filter recommendations to a specific category (default 'all')")
});

/**
 * Schema for personal workload analysis
 * Analyzes an individual's work over a time period for burnout risk, overspecialization, and other health indicators
 * 
 * @example
 * ```typescript
 * {
 *   assignedToEmail: "user@domain.com",
 *   analysisPeriodDays: 90,
 *   additionalIntent: "check for career growth opportunities"
 * }
 * ```
 * 
 * @remarks
 * Automatically fetches completed and active work, analyzes patterns, and provides AI-powered insights.
 * Can include custom analysis intent for targeted recommendations (e.g., promotion readiness, skill development).
 * Requires VS Code sampling support for AI-powered insights.
 */
export const personalWorkloadAnalyzerSchema = z.object({
  assignedToEmail: z.string().email().describe("Email address of the person to analyze (e.g., user@domain.com)"),
  analysisPeriodDays: z.number().int().min(7).max(365).optional().default(90).describe("Number of days to analyze backwards from today (default 90)"),
  additionalIntent: z.string().optional().describe("Optional custom analysis intent (e.g., 'check for career growth opportunities', 'assess readiness for promotion', 'evaluate technical skill development')"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || '').describe("Area path to filter work items (uses configured default if not provided)")
});

/**
 * Schema for sprint planning analysis
 * AI-powered sprint planning that analyzes team capacity, historical velocity, and proposes optimal work assignments
 * 
 * @example
 * ```typescript
 * {
 *   iterationPath: "Project\\Sprint 10",
 *   teamMembers: [
 *     { email: "alice@company.com", name: "Alice", capacityHours: 60, skills: ["frontend", "react"] },
 *     { email: "bob@company.com", name: "Bob", capacityHours: 50, skills: ["backend", "api"] }
 *   ],
 *   candidateWorkItemIds: [12345, 12346, 12347],
 *   historicalSprintsToAnalyze: 3
 * }
 * ```
 * 
 * @remarks
 * Analyzes historical velocity, team member capacity, skills, and workload to propose balanced sprint assignments.
 * Considers dependencies, skills matching, and workload distribution for optimal sprint planning.
 * Requires VS Code sampling support for AI-powered planning.
 */
export const sprintPlanningAnalyzerSchema = z.object({
  iterationPath: z.string().describe("Target iteration/sprint path (e.g., 'Project\\Sprint 10')"),
  teamMembers: z.array(z.object({
    email: z.string().email().describe("Team member email address"),
    name: z.string().describe("Team member display name"),
    capacityHours: z.number().optional().describe("Available capacity in hours for this sprint (default 60)"),
    skills: z.array(z.string()).optional().describe("Team member skills/specializations"),
    preferredWorkTypes: z.array(z.string()).optional().describe("Preferred work item types (e.g., ['Task', 'Bug'])")
  })).min(1).describe("Team members participating in the sprint"),
  sprintCapacityHours: z.number().optional().describe("Total team capacity in hours (overrides individual capacities if provided)"),
  historicalSprintsToAnalyze: z.number().int().min(1).max(10).optional().default(3).describe("Number of previous sprints to analyze for velocity calculation (default 3)"),
  candidateWorkItemIds: z.array(z.number().int()).optional().describe("Work item IDs to consider for sprint assignment (if not provided, will query backlog)"),
  considerDependencies: z.boolean().optional().default(true).describe("Consider work item dependencies in planning (default true)"),
  considerSkills: z.boolean().optional().default(true).describe("Match work items to team member skills (default true)"),
  additionalConstraints: z.string().optional().describe("Additional planning constraints or preferences (e.g., 'prioritize bugs', 'balance frontend/backend work')"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || '').describe("Area path to filter work items (uses configured default if not provided)")
});


