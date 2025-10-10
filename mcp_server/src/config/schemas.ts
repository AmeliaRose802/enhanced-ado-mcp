/**
 * Zod Schema Definitions for MCP Tool Parameters
 * 
 * This file contains all Zod schemas for validating tool inputs.
 * Each schema corresponds to a tool defined in tool-configs.ts and provides
 * runtime validation with TypeScript type inference.
 */

import { z } from "zod";

// ============================================================================
// Shared Schema Components
// ============================================================================

/**
 * Item selector for query handle operations
 * Can be:
 * - "all" to select all items
 * - Array of work item IDs
 * - Object with filter criteria
 */
const itemSelectorSchema = z.union([
  z.literal("all"),
  z.array(z.number()),
  z.object({
    states: z.array(z.string()).optional(),
    titleContains: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    daysInactiveMin: z.number().optional(),
    daysInactiveMax: z.number().optional()
  })
]);

// ============================================================================
// Work Item Creation & Modification Schemas
// ============================================================================

/**
 * Schema for wit-create-new-item tool
 * Creates a new Azure DevOps work item with optional parent relationship
 */
export const createNewItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  parentWorkItemId: z.number().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  workItemType: z.string().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.number().optional(),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-clone-work-item tool
 * Clone/duplicate an existing work item with optional modifications
 */
export const cloneWorkItemSchema = z.object({
  sourceWorkItemId: z.number().int().positive("Source work item ID must be a positive integer"),
  title: z.string().optional(),
  targetAreaPath: z.string().optional(),
  targetIterationPath: z.string().optional(),
  targetProject: z.string().optional(),
  assignTo: z.string().optional(),
  includeDescription: z.boolean().optional().default(true),
  includeAcceptanceCriteria: z.boolean().optional().default(true),
  includeTags: z.boolean().optional().default(true),
  includeAttachments: z.boolean().optional().default(false),
  includeChildren: z.boolean().optional().default(false),
  linkToSource: z.boolean().optional().default(true),
  comment: z.string().optional(),
  organization: z.string().optional(),
  project: z.string().optional()
});

// ============================================================================
// GitHub Copilot Integration Schemas
// ============================================================================

/**
 * Schema for wit-assign-to-copilot tool
 * Assign an existing work item to GitHub Copilot
 */
export const assignToCopilotSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  repository: z.string().min(1, "Repository is required"),
  branch: z.string().optional(),
  gitHubCopilotGuid: z.string().optional(),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-new-copilot-item tool
 * Create a new work item and immediately assign to GitHub Copilot
 */
export const newCopilotItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  parentWorkItemId: z.number().int().positive("Parent work item ID must be a positive integer"),
  repository: z.string().min(1, "Repository is required"),
  description: z.string().optional(),
  tags: z.string().optional(),
  workItemType: z.string().optional(),
  branch: z.string().optional(),
  gitHubCopilotGuid: z.string().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  priority: z.number().optional(),
  inheritParentPaths: z.boolean().optional(),
  organization: z.string().optional(),
  project: z.string().optional()
});

// ============================================================================
// Analysis & Intelligence Schemas
// ============================================================================

/**
 * Schema for wit-extract-security-links tool
 * Extract instruction links from security scan work items
 */
export const extractSecurityLinksSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  scanType: z.enum(["BinSkim", "CodeQL", "CredScan", "General", "All"]).optional().default("All"),
  includeWorkItemDetails: z.boolean().optional().default(false),
  extractFromComments: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-intelligence-analyzer tool
 * AI-powered work item analysis for completeness and enhancement
 */
export const workItemIntelligenceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  workItemType: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  analysisType: z.enum(["completeness", "ai-readiness", "enhancement", "categorization", "full"]).optional().default("full"),
  contextInfo: z.string().optional(),
  enhanceDescription: z.boolean().optional().default(false),
  createInADO: z.boolean().optional().default(false),
  parentWorkItemId: z.number().optional(),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-ai-assignment-analyzer tool
 * Enhanced AI assignment suitability analysis
 */
export const aiAssignmentAnalyzerSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  outputFormat: z.enum(["detailed", "json"]).optional().default("detailed"),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-personal-workload-analyzer tool
 * AI-powered personal workload analysis for burnout risk assessment
 */
export const personalWorkloadAnalyzerSchema = z.object({
  assignedToEmail: z.string().email("Must provide a valid email address"),
  analysisPeriodDays: z.number().int().min(7).max(365).optional().default(90),
  additionalIntent: z.string().optional(),
  organization: z.string().optional(),
  project: z.string().optional(),
  areaPath: z.string().optional()
});

/**
 * Schema for wit-sprint-planning-analyzer tool
 * AI-powered sprint planning analysis
 */
export const sprintPlanningAnalyzerSchema = z.object({
  iterationPath: z.string().optional(),
  teamCapacityHours: z.number().optional(),
  analysisFocus: z.enum(["capacity", "risks", "dependencies", "full"]).optional().default("full"),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-validate-hierarchy tool
 * Fast hierarchy validation with type and state checks
 */
export const validateHierarchyFastSchema = z.object({
  workItemIds: z.array(z.number()).optional(),
  areaPath: z.string().optional(),
  maxResults: z.number().int().min(1).max(2000).optional().default(500),
  includeSubAreas: z.boolean().optional().default(true),
  validateTypes: z.boolean().optional().default(true),
  validateStates: z.boolean().optional().default(true),
  organization: z.string().optional(),
  project: z.string().optional()
});

// ============================================================================
// Configuration & Discovery Schemas
// ============================================================================

/**
 * Schema for wit-get-configuration tool
 * Get current MCP server configuration
 */
export const getConfigurationSchema = z.object({
  includeSensitive: z.boolean().optional().default(false),
  section: z.enum(["all", "azureDevOps", "gitRepository", "gitHubCopilot"]).optional().default("all")
});

/**
 * Schema for wit-tool-discovery tool
 * AI-powered tool discovery and recommendation
 */
export const toolDiscoverySchema = z.object({
  intent: z.string().min(1, "Intent is required"),
  includeExamples: z.boolean().optional().default(false).describe("Include example usage in response (saves tokens when false, default false)"),
  maxRecommendations: z.number().int().min(1).max(10).optional().default(3),
  filterCategory: z.enum([
    "all",
    "work-items",
    "bulk-operations",
    "queries",
    "analysis",
    "ai-powered",
    "configuration"
  ]).optional().default("all"),
  context: z.string().optional(),
  contextInfo: z.string().optional()
});

// ============================================================================
// Query & Search Schemas
// ============================================================================

/**
 * Schema for wit-get-work-items-by-query-wiql tool
 * Execute WIQL query and get query handle for safe operations
 */
export const wiqlQuerySchema = z.object({
  wiqlQuery: z.string().min(1, "WIQL query is required"),
  organization: z.string().optional(),
  project: z.string().optional(),
  includeFields: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(1000).optional().default(200),
  skip: z.number().int().min(0).optional().default(0),
  top: z.number().int().min(1).max(1000).optional(),
  includeSubstantiveChange: z.boolean().optional().default(false),
  filterBySubstantiveChangeAfter: z.string().optional(),
  filterBySubstantiveChangeBefore: z.string().optional(),
  filterByDaysInactiveMin: z.number().optional(),
  filterByDaysInactiveMax: z.number().optional(),
  filterByPatterns: z.array(z.enum([
    "duplicates",
    "placeholder_titles",
    "unassigned_committed",
    "stale_automation",
    "missing_description",
    "missing_acceptance_criteria"
  ])).optional(),
  returnQueryHandle: z.boolean().optional().default(true),
  handleOnly: z.boolean().optional().default(false),
  fetchFullPackages: z.boolean().optional().default(false),
  includePaginationDetails: z.boolean().optional().default(false)
});

/**
 * Schema for wit-query-analytics-odata tool
 * Query Azure DevOps Analytics using OData
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
  ]),
  organization: z.string().optional(),
  project: z.string().optional(),
  filters: z.record(z.any()).optional(),
  groupBy: z.array(z.string()).optional(),
  select: z.array(z.string()).optional(),
  orderBy: z.string().optional(),
  customODataQuery: z.string().optional(),
  dateRangeField: z.enum(["CreatedDate", "ChangedDate", "CompletedDate", "ClosedDate"]).optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
  top: z.number().int().min(1).max(10000).optional().default(1000),
  skip: z.number().int().min(0).optional().default(0),
  includeMetadata: z.boolean().optional().default(false),
  includeOdataMetadata: z.boolean().optional().default(false),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  computeCycleTime: z.boolean().optional().default(false)
});

/**
 * Schema for wit-generate-wiql-query tool
 * Generate WIQL query from natural language description
 */
export const generateWiqlQuerySchema = z.object({
  description: z.string().min(1, "Query description is required"),
  includeExamples: z.boolean().optional().default(true),
  testQuery: z.boolean().optional().default(true),
  maxIterations: z.number().int().positive().optional().default(3),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  returnQueryHandle: z.boolean().optional().default(false),
  maxResults: z.number().int().positive().optional().default(200),
  includeFields: z.array(z.string()).optional(),
  validateSyntax: z.boolean().optional().default(true),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-generate-odata-query tool
 * Generate OData query from natural language description
 */
export const generateODataQuerySchema = z.object({
  description: z.string().min(1, "Query description is required"),
  includeExamples: z.boolean().optional().default(true),
  testQuery: z.boolean().optional().default(true),
  maxIterations: z.number().int().positive().optional().default(3),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  returnQueryHandle: z.boolean().optional().default(true),
  maxResults: z.number().int().positive().optional().default(200),
  includeFields: z.array(z.string()).optional(),
  validateSyntax: z.boolean().optional().default(true),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-unified-query-generator tool
 * Unified query generator supporting both WIQL and OData
 */
export const unifiedQueryGeneratorSchema = z.object({
  description: z.string().min(1, "Query description is required"),
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
  includeExamples: z.boolean().optional().default(true),
  testQuery: z.boolean().optional().default(true),
  returnQueryHandle: z.boolean().optional().default(true),
  maxResults: z.number().int().min(1).max(1000).optional().default(200),
  includeFields: z.array(z.string()).optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  organization: z.string().optional(),
  project: z.string().optional()
});

// ============================================================================
// Query Handle Operations Schemas
// ============================================================================

/**
 * Schema for wit-query-handle-inspect tool
 * Detailed inspection of a query handle
 */
export const inspectQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  includeStalenessData: z.boolean().optional().default(true),
  includeWorkItemContext: z.boolean().optional().default(true),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-query-handle-select tool
 * Select items from query handle
 */
export const selectItemsFromQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  previewCount: z.number().int().min(1).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-query-handle-info tool
 * Unified query handle info (validate + inspect + select)
 */
export const queryHandleInfoSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  detailed: z.boolean().optional().default(false),
  includePreview: z.boolean().optional().default(true),
  includeStats: z.boolean().optional().default(true),
  includeExamples: z.boolean().optional().default(false),
  itemSelector: itemSelectorSchema.optional(),
  previewCount: z.number().int().min(1).max(50).optional().default(10),
  includeSampleItems: z.boolean().optional().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-query-handle-validate tool
 * Validate a query handle
 */
export const validateQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  includeSampleItems: z.boolean().optional().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-query-handle-list tool
 * List all active query handles
 */
export const listQueryHandlesSchema = z.object({
  top: z.number().int().min(1).max(200).optional().default(50),
  skip: z.number().int().min(0).optional().default(0),
  includeExpired: z.boolean().optional().default(false)
});

// ============================================================================
// Context Retrieval Schemas
// ============================================================================

/**
 * Schema for wit-get-work-item-context-package tool
 * Retrieve comprehensive context package for a single work item
 */
export const workItemContextPackageSchema = z.object({
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  includeHistory: z.boolean().optional().default(false).describe("Include work item revision history. Adds ~40KB per item with full history. disabled by default to save context window."),
  maxHistoryRevisions: z.number().int().min(1).max(100).optional().default(5).describe("Maximum number of history revisions to include when includeHistory is true. Revisions are sorted by date descending (newest first)."),
  includeComments: z.boolean().optional().default(true),
  includeRelations: z.boolean().optional().default(true),
  includeChildren: z.boolean().optional().default(true),
  includeParent: z.boolean().optional().default(true),
  includeLinkedPRsAndCommits: z.boolean().optional().default(false),
  includeExtendedFields: z.boolean().optional().default(false),
  includeHtml: z.boolean().optional().default(false),
  maxChildDepth: z.number().int().min(1).max(5).optional().default(1),
  maxRelatedItems: z.number().int().min(1).max(100).optional().default(20),
  includeAttachments: z.boolean().optional().default(false),
  includeTags: z.boolean().optional().default(true),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-get-work-items-context-batch tool
 * Retrieve multiple work items with relationship graph
 */
export const workItemsBatchContextSchema = z.object({
  workItemIds: z.array(z.number()).min(1, "At least one work item ID required").max(50, "Maximum 50 work items allowed"),
  includeRelations: z.boolean().optional().default(true),
  includeFields: z.array(z.string()).optional(),
  includeExtendedFields: z.boolean().optional().default(false),
  includeTags: z.boolean().optional().default(true),
  includeStateCounts: z.boolean().optional().default(false),
  includeStoryPointAggregation: z.boolean().optional().default(false),
  includeRiskScoring: z.boolean().optional().default(false),
  includeAIAssignmentHeuristic: z.boolean().optional().default(false),
  includeParentOutsideSet: z.boolean().optional().default(false),
  includeChildrenOutsideSet: z.boolean().optional().default(false),
  maxOutsideReferences: z.number().int().min(1).max(50).optional().default(10),
  returnFormat: z.enum(["graph", "array"]).optional().default("array"),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-get-context-packages-by-query-handle tool
 * Get context packages for work items identified by query handle
 */
export const getContextPackagesByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  includeHistory: z.boolean().optional().default(false),
  maxHistoryRevisions: z.number().int().min(1).max(100).optional().default(5),
  includeComments: z.boolean().optional().default(true),
  includeRelations: z.boolean().optional().default(true),
  includeChildren: z.boolean().optional().default(true),
  includeParent: z.boolean().optional().default(true),
  includeExtendedFields: z.boolean().optional().default(false),
  maxPreviewItems: z.number().int().min(1).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-get-last-substantive-change tool
 * Get last substantive change date for work items
 */
export const getLastSubstantiveChangeSchema = z.object({
  workItemIds: z.array(z.number()).min(1, "At least one work item ID required"),
  organization: z.string().optional(),
  project: z.string().optional()
});

// ============================================================================
// Bulk Operations Schemas
// ============================================================================

/**
 * Schema for wit-bulk-comment-by-query-handle tool
 * Add comments to multiple work items via query handle
 */
export const bulkCommentByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  comment: z.string().min(1, "Comment text is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-update-by-query-handle tool
 * Update multiple work items via query handle
 */
export const bulkUpdateByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  updates: z.array(z.object({
    op: z.enum(["add", "replace", "remove"]),
    path: z.string(),
    value: z.any().optional()
  })).min(1, "At least one update operation required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-assign-by-query-handle tool
 * Assign multiple work items via query handle
 */
export const bulkAssignByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  assignTo: z.string().min(1, "Assignee is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  comment: z.string().optional(),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(5),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-remove-by-query-handle tool
 * Remove/delete multiple work items via query handle
 */
export const bulkRemoveByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  permanentDelete: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(5),
  requireConfirmation: z.boolean().optional().default(true),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-transition-state-by-query-handle tool
 * Transition multiple work items to new state via query handle
 */
export const bulkTransitionStateByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  targetState: z.string().min(1, "Target state is required"),
  reason: z.string().optional(),
  comment: z.string().optional(),
  itemSelector: itemSelectorSchema.optional().default("all"),
  validateTransitions: z.boolean().optional().default(true),
  skipInvalidTransitions: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-move-to-iteration-by-query-handle tool
 * Move multiple work items to different iteration via query handle
 */
export const bulkMoveToIterationByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  targetIterationPath: z.string().min(1, "Target iteration path is required"),
  comment: z.string().optional(),
  itemSelector: itemSelectorSchema.optional().default("all"),
  updateChildItems: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-link-work-items-by-query-handles tool
 * Create relationships between work items via query handles
 */
export const linkWorkItemsByQueryHandlesSchema = z.object({
  sourceQueryHandle: z.string().min(1, "Source query handle is required"),
  targetQueryHandle: z.string().min(1, "Target query handle is required"),
  linkType: z.enum(["Related", "Parent", "Child", "Predecessor", "Successor", "Affects", "Affected By"]),
  sourceItemSelector: itemSelectorSchema.optional().default("all"),
  targetItemSelector: itemSelectorSchema.optional().default("all"),
  linkStrategy: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]).optional().default("one-to-one"),
  comment: z.string().optional(),
  skipExistingLinks: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  organization: z.string().optional(),
  project: z.string().optional()
});

// ============================================================================
// AI-Powered Bulk Operations Schemas
// ============================================================================

/**
 * Schema for wit-bulk-enhance-descriptions-by-query-handle tool
 * AI-powered bulk description enhancement
 */
export const bulkEnhanceDescriptionsByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  enhancementStyle: z.enum(["concise", "detailed", "technical", "business"]).optional().default("detailed"),
  preserveOriginal: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(20).optional().default(5),
  returnFormat: z.enum(["summary", "full", "preview"]).optional(),
  includeTitles: z.boolean().optional().default(false),
  includeConfidence: z.boolean().optional().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-assign-story-points-by-query-handle tool
 * AI-powered bulk story points assignment
 */
export const bulkAssignStoryPointsByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  fibonacciOnly: z.boolean().optional().default(true),
  includeReasoning: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(20).optional().default(5),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-bulk-add-acceptance-criteria-by-query-handle tool
 * AI-powered bulk acceptance criteria generation
 */
export const bulkAddAcceptanceCriteriaByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  criteriaStyle: z.enum(["gherkin", "checklist", "narrative"]).optional().default("gherkin"),
  minCriteria: z.number().int().min(1).max(10).optional().default(3),
  maxCriteria: z.number().int().min(1).max(20).optional().default(8),
  dryRun: z.boolean().optional().default(true),
  maxPreviewItems: z.number().int().min(1).max(20).optional().default(5),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-analyze-items tool
 * Analyze work items using query handle
 */
export const analyzeByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  analysisType: z.array(z.enum([
    "effort",
    "velocity",
    "assignments",
    "risks",
    "completion",
    "priorities"
  ])).min(1, "At least one analysis type required"),
  organization: z.string().optional(),
  project: z.string().optional()
});

/**
 * Schema for wit-get-prompts tool
 * Retrieve pre-filled prompt templates by name or all prompts
 */
export const getPromptsSchema = z.object({
  promptName: z.string().optional(),
  includeContent: z.boolean().optional().default(true),
  args: z.record(z.unknown()).optional()
});