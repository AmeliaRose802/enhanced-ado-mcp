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

/**
 * Schema for AI-powered hierarchy validation and parenting suggestions
 * 
 * @example
 * ```typescript
 * {
 *   areaPath: "Project\\Team\\Component",
 *   analysisDepth: "deep",
 *   maxItemsToAnalyze: 50
 * }
 * ```
 * 
 * @remarks
 * Analyzes work item parent-child relationships, identifies misparented or orphaned items,
 * and provides intelligent parenting suggestions. Requires VS Code sampling support.
 */
export const hierarchyValidatorSchema = z.object({
  workItemIds: z.array(z.number().int()).optional().describe("Specific work item IDs to validate (if not provided, will analyze area path)"),
  areaPath: z.string().optional().describe("Area path to analyze all work items within (used if workItemIds not provided)"),
  includeChildAreas: z.boolean().optional().default(true).describe("Include child area paths in analysis"),
  maxItemsToAnalyze: z.number().int().optional().default(50).describe("Maximum number of work items to analyze"),
  analysisDepth: z.enum(["shallow", "deep"]).optional().default("shallow").describe("Analysis depth: shallow (basic) or deep (comprehensive with content analysis)"),
  suggestAlternatives: z.boolean().optional().default(true).describe("Generate alternative parent suggestions"),
  includeConfidenceScores: z.boolean().optional().default(true).describe("Include confidence scores for recommendations"),
  filterByWorkItemType: z.array(z.string()).optional().describe("Filter analysis to specific work item types (e.g., ['Task', 'Bug'])"),
  excludeStates: z.array(z.string()).optional().default(["Done", "Closed", "Removed"]).describe("Exclude work items in these states from analysis"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
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
  maxResults: z.number().int().optional().default(200).describe("Maximum number of work items to return (default 200)"),
  includeSubstantiveChange: z.boolean().optional().default(false).describe("Include computed fields lastSubstantiveChangeDate and daysInactive for each work item - automatically filters out automated changes like iteration path updates. Minimal overhead: only 2 fields per item."),
  substantiveChangeHistoryCount: z.number().int().optional().default(50).describe("Number of revisions to analyze when computing substantive change (default 50)"),
  computeMetrics: z.boolean().optional().default(false).describe("Include computed metrics: daysInactive (from changed date), daysSinceCreated, hasDescription (>50 chars), isStale (inactive >180 days)"),
  staleThresholdDays: z.number().int().optional().default(180).describe("Number of days to consider a work item stale (default 180)")
});

// Full context package retrieval (single work item)
export const workItemContextPackageSchema = z.object({
  workItemId: z.number().int().describe("Primary work item ID to retrieve full context for"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  includeHistory: z.boolean().optional().default(true).describe("Include recent change history (last 10 changes)"),
  historyCount: z.number().int().optional().default(10).describe("Number of recent history entries to include"),
  includeComments: z.boolean().optional().default(true).describe("Include work item comments/discussion"),
  includeRelations: z.boolean().optional().default(true).describe("Include related links (parent, children, related, attachments, commits, PRs)"),
  includeChildren: z.boolean().optional().default(true).describe("Include all child hierarchy (one level) if item is a Feature/Epic"),
  includeParent: z.boolean().optional().default(true).describe("Include parent work item details if present"),
  includeLinkedPRsAndCommits: z.boolean().optional().default(true).describe("Include linked Git PRs and commits if present in relations"),
  includeExtendedFields: z.boolean().optional().default(false).describe("Include extended field set beyond defaults (all system fields + common custom)"),
  includeHtml: z.boolean().optional().default(false).describe("Return original HTML field values alongside Markdown/plain text"),
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
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  historyCount: z.number().int().optional().default(50).describe("Number of revisions to analyze (default 50)"),
  automatedPatterns: z.array(z.string()).optional().describe("Custom automation account patterns to filter (e.g., ['Bot Name', 'System Account'])")
});

export const bulkAddCommentsSchema = z.object({
  items: z.array(z.object({
    workItemId: z.number().int().describe("Work item ID to add comment to"),
    comment: z.string().describe("Comment text to add (supports Markdown)")
  })).min(1).max(50).describe("Array of work items and their comments (1-50 items)"),
  template: z.string().optional().describe("Comment template with {{variable}} placeholders"),
  templateVariables: z.record(z.string()).optional().describe("Variables to substitute in template"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const detectPatternsSchema = z.object({
  workItemIds: z.array(z.number().int()).optional().describe("Specific work item IDs to analyze (if not provided, uses areaPath)"),
  areaPath: z.string().optional().describe("Area path to search for work items (if workItemIds not provided)"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  patterns: z.array(z.enum(['duplicates', 'placeholder_titles', 'orphaned_children', 'unassigned_committed', 'stale_automation', 'no_description'])).optional().default(['duplicates', 'placeholder_titles', 'unassigned_committed', 'no_description']).describe("Patterns to detect"),
  maxResults: z.number().int().optional().default(200).describe("Maximum number of results when using areaPath"),
  includeSubAreas: z.boolean().optional().default(true).describe("Include sub-area paths when using areaPath")
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





