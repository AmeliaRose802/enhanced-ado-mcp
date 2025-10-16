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

/** Common organization field */
const orgField = () => z.string().optional();

/** Common project field */
const projectField = () => z.string().optional();

/** Common org/project fields as object */
const orgProjectFields = () => ({
  organization: orgField(),
  project: projectField()
});

/** Positive work item ID */
const workItemIdField = () => z.number().int().positive("Work item ID must be a positive integer");

/** Optional string field */
const optionalString = () => z.string().optional();

/** Optional number field */
const optionalNumber = () => z.number().optional();

/** Optional boolean field with default */
const optionalBool = (defaultValue?: boolean) => 
  defaultValue !== undefined 
    ? z.boolean().optional().default(defaultValue)
    : z.boolean().optional();

/** Common query generation fields */
const queryGeneratorFields = () => ({
  description: z.string().min(1, "Query description is required"),
  includeExamples: optionalBool(true),
  testQuery: optionalBool(true),
  maxIterations: z.number().int().positive().optional().default(3),
  areaPath: optionalString(),
  iterationPath: optionalString(),
  returnQueryHandle: optionalBool(),
  maxResults: z.number().int().positive().optional().default(200),
  includeFields: z.array(z.string()).optional(),
  validateSyntax: optionalBool(true),
  ...orgProjectFields()
});

/** Common bulk operation fields */
const bulkOperationFields = (defaultPreview: number = 10) => ({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  dryRun: optionalBool(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(defaultPreview),
  ...orgProjectFields()
});

/** Item selector for query handle operations */
const itemSelectorSchema = z.union([
  z.literal("all"),
  z.array(z.number()),
  z.object({
    states: z.array(z.string()).optional(),
    titleContains: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    daysInactiveMin: optionalNumber(),
    daysInactiveMax: optionalNumber()
  })
]);

// ============================================================================
// Work Item Creation & Modification Schemas
// ============================================================================

export const createNewItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  parentWorkItemId: optionalNumber(),
  description: optionalString(),
  tags: optionalString(),
  workItemType: optionalString(),
  areaPath: optionalString(),
  iterationPath: optionalString(),
  assignedTo: optionalString(),
  priority: optionalNumber(),
  ...orgProjectFields()
});

export const cloneWorkItemSchema = z.object({
  sourceWorkItemId: workItemIdField(),
  title: optionalString(),
  targetAreaPath: optionalString(),
  targetIterationPath: optionalString(),
  targetProject: optionalString(),
  assignTo: optionalString(),
  includeDescription: optionalBool(true),
  includeAcceptanceCriteria: optionalBool(true),
  includeTags: optionalBool(true),
  includeAttachments: optionalBool(false),
  includeChildren: optionalBool(false),
  linkToSource: optionalBool(true),
  comment: optionalString(),
  ...orgProjectFields()
});

// ============================================================================
// GitHub Copilot Integration Schemas
// ============================================================================

export const assignToCopilotSchema = z.object({
  workItemId: workItemIdField(),
  repository: z.string().min(1, "Repository is required"),
  branch: optionalString(),
  gitHubCopilotGuid: optionalString(),
  ...orgProjectFields()
});

export const newCopilotItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  parentWorkItemId: workItemIdField(),
  repository: z.string().min(1, "Repository is required"),
  description: optionalString(),
  tags: optionalString(),
  workItemType: optionalString(),
  branch: optionalString(),
  gitHubCopilotGuid: optionalString(),
  areaPath: optionalString(),
  iterationPath: optionalString(),
  priority: optionalNumber(),
  inheritParentPaths: optionalBool(),
  ...orgProjectFields()
});

// ============================================================================
// Analysis & Intelligence Schemas
// ============================================================================

export const extractSecurityLinksSchema = z.object({
  workItemId: workItemIdField(),
  scanType: z.enum(["BinSkim", "CodeQL", "CredScan", "General", "All"]).optional().default("All"),
  includeWorkItemDetails: optionalBool(false),
  extractFromComments: optionalBool(false),
  dryRun: optionalBool(false),
  ...orgProjectFields()
});

export const workItemIntelligenceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: optionalString(),
  workItemType: optionalString(),
  acceptanceCriteria: optionalString(),
  analysisType: z.enum(["completeness", "ai-readiness", "enhancement", "categorization", "full"]).optional().default("full"),
  contextInfo: optionalString(),
  enhanceDescription: optionalBool(false),
  createInADO: optionalBool(false),
  parentWorkItemId: optionalNumber(),
  ...orgProjectFields()
});

export const aiAssignmentAnalyzerSchema = z.object({
  workItemId: workItemIdField(),
  outputFormat: z.enum(["detailed", "json"]).optional().default("detailed"),
  ...orgProjectFields()
});

export const personalWorkloadAnalyzerSchema = z.object({
  assignedToEmail: z.string().email("Must provide a valid email address"),
  analysisPeriodDays: z.number().int().min(7).max(365).optional().default(90),
  additionalIntent: optionalString(),
  areaPath: optionalString(),
  ...orgProjectFields()
});

export const sprintPlanningAnalyzerSchema = z.object({
  iterationPath: optionalString(),
  teamCapacityHours: optionalNumber(),
  analysisFocus: z.enum(["capacity", "risks", "dependencies", "full"]).optional().default("full"),
  ...orgProjectFields()
});

export const validateHierarchyFastSchema = z.object({
  workItemIds: z.array(z.number()).optional(),
  areaPath: optionalString(),
  maxResults: z.number().int().min(1).max(2000).optional().default(500),
  includeSubAreas: optionalBool(true),
  validateTypes: optionalBool(true),
  validateStates: optionalBool(true),
  ...orgProjectFields()
});

// ============================================================================
// Configuration & Discovery Schemas
// ============================================================================

export const getConfigurationSchema = z.object({
  includeSensitive: optionalBool(false),
  section: z.enum(["all", "azureDevOps", "gitRepository", "gitHubCopilot"]).optional().default("all")
});

export const toolDiscoverySchema = z.object({
  intent: z.string().min(1, "Intent is required"),
  includeExamples: optionalBool(false).describe("Include example usage in response (saves tokens when false, default false)"),
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
  context: optionalString(),
  contextInfo: optionalString()
});

// ============================================================================
// Query & Search Schemas
// ============================================================================

/**
 * Unified WIQL Query Schema
 * Supports both direct WIQL execution and AI-powered query generation
 * Consolidates functionality into wit-wiql-query tool
 */
export const wiqlQuerySchema = z.object({
  // Query Definition (provide ONE of these)
  description: z.string().min(1).optional(), // Natural language for AI generation
  wiqlQuery: z.string().min(1).optional(), // Direct WIQL query
  
  // AI Generation Options (only used with 'description')
  includeExamples: optionalBool(true),
  maxIterations: z.number().int().positive().min(1).max(5).optional().default(3),
  testQuery: optionalBool(true),
  
  // Scope Configuration (auto-filled from config)
  areaPath: optionalString(),
  iterationPath: optionalString(),
  
  // Result Configuration
  returnQueryHandle: optionalBool(true),
  handleOnly: optionalBool(false),
  maxResults: z.number().int().min(1).max(10000).optional().default(200),
  skip: z.number().int().min(0).optional().default(0),
  top: z.number().int().positive().optional(), // Alias for maxResults
  
  // Data Enrichment
  includeFields: z.array(z.string()).optional(),
  includeSubstantiveChange: optionalBool(false),
  substantiveChangeHistoryCount: z.number().int().min(1).max(200).optional().default(50),
  fetchFullPackages: optionalBool(false),
  
  // Filtering (applied post-query)
  filterByPatterns: z.array(z.enum([
    "duplicates",
    "placeholder_titles",
    "unassigned_committed",
    "stale_automation",
    "missing_description",
    "missing_acceptance_criteria"
  ])).optional(),
  filterByDaysInactiveMin: optionalNumber(),
  filterByDaysInactiveMax: optionalNumber(),
  filterBySubstantiveChangeAfter: optionalString(),
  filterBySubstantiveChangeBefore: optionalString(),
  
  // Advanced Options
  staleThresholdDays: optionalNumber(),
  includePaginationDetails: optionalBool(false),
  
  ...orgProjectFields()
}).refine(
  (data) => data.description || data.wiqlQuery,
  { message: "Either 'description' (for AI generation) or 'wiqlQuery' (for direct execution) must be provided" }
);

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
  filters: z.record(z.any()).optional(),
  groupBy: z.array(z.string()).optional(),
  select: z.array(z.string()).optional(),
  orderBy: optionalString(),
  customODataQuery: optionalString(),
  dateRangeField: z.enum(["CreatedDate", "ChangedDate", "CompletedDate", "ClosedDate"]).optional(),
  dateRangeStart: optionalString(),
  dateRangeEnd: optionalString(),
  top: z.number().int().min(1).max(10000).optional().default(1000),
  skip: z.number().int().min(0).optional().default(0),
  includeMetadata: optionalBool(false),
  includeOdataMetadata: optionalBool(false),
  areaPath: optionalString(),
  iterationPath: optionalString(),
  computeCycleTime: optionalBool(false),
  ...orgProjectFields()
});

export const generateODataQuerySchema = z.object({
  ...queryGeneratorFields(),
  returnQueryHandle: optionalBool(true)
});

export const unifiedQueryGeneratorSchema = z.object({
  ...queryGeneratorFields()
});

// ============================================================================
// Query Handle Operations Schemas
// ============================================================================

export const selectItemsFromQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  previewCount: z.number().int().min(1).optional().default(10),
  ...orgProjectFields()
});

export const queryHandleInfoSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  detailed: optionalBool(false),
  includePreview: optionalBool(true),
  includeStats: optionalBool(true),
  includeExamples: optionalBool(false),
  itemSelector: itemSelectorSchema.optional(),
  previewCount: z.number().int().min(1).max(50).optional().default(10),
  includeSampleItems: optionalBool(false),
  ...orgProjectFields()
});

export const listQueryHandlesSchema = z.object({
  top: z.number().int().min(1).max(200).optional().default(50),
  skip: z.number().int().min(0).optional().default(0),
  includeExpired: optionalBool(false)
});

// ============================================================================
// Context Retrieval Schemas
// ============================================================================

export const workItemContextPackageSchema = z.object({
  workItemId: workItemIdField(),
  includeHistory: optionalBool(false).describe("Include work item revision history with diff-based changes (only modified fields). Optimized for context window efficiency."),
  maxHistoryRevisions: z.number().int().min(1).max(100).optional().default(3).describe("Maximum number of history revisions to include when includeHistory is true. Default reduced to 3 for context window efficiency."),
  includeComments: optionalBool(true),
  includeRelations: optionalBool(true),
  includeChildren: optionalBool(true),
  includeParent: optionalBool(true),
  includeLinkedPRsAndCommits: optionalBool(false),
  includeExtendedFields: optionalBool(false),
  includeHtml: optionalBool(false),
  includeHtmlFields: optionalBool(false),
  stripHtmlFormatting: optionalBool(true),
  maxChildDepth: z.number().int().min(1).max(5).optional().default(1),
  maxRelatedItems: z.number().int().min(1).max(100).optional().default(20),
  includeAttachments: optionalBool(false),
  includeTags: optionalBool(true),
  includeSystemFields: optionalBool(false).describe("Include ADO system fields (WEF_*, watermarks, etc.). Excluded by default to reduce context window usage."),
  ...orgProjectFields()
});

export const getContextPackagesByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  includeHistory: optionalBool(false),
  maxHistoryRevisions: z.number().int().min(1).max(100).optional().default(3),
  includeComments: optionalBool(true),
  includeRelations: optionalBool(true),
  includeChildren: optionalBool(true),
  includeParent: optionalBool(true),
  includeExtendedFields: optionalBool(false),
  includeSystemFields: optionalBool(false),
  maxPreviewItems: z.number().int().min(1).optional().default(10),
  ...orgProjectFields()
});

export const getLastSubstantiveChangeSchema = z.object({
  workItemIds: z.array(z.number()).min(1, "At least one work item ID required"),
  ...orgProjectFields()
});

// ============================================================================
// Bulk Operations Schemas
// ============================================================================

export const bulkCommentByQueryHandleSchema = z.object({
  comment: z.string().min(1, "Comment text is required"),
  ...bulkOperationFields()
});

export const bulkUpdateByQueryHandleSchema = z.object({
  updates: z.array(z.object({
    op: z.enum(["add", "replace", "remove"]),
    path: z.string(),
    value: z.any().optional()
  })).min(1, "At least one update operation required"),
  ...bulkOperationFields()
});

export const bulkAssignByQueryHandleSchema = z.object({
  assignTo: z.string().min(1, "Assignee is required"),
  comment: optionalString(),
  ...bulkOperationFields(5)
});

export const bulkRemoveByQueryHandleSchema = z.object({
  permanentDelete: optionalBool(false),
  requireConfirmation: optionalBool(true),
  ...bulkOperationFields(5)
});

export const bulkTransitionStateByQueryHandleSchema = z.object({
  targetState: z.string().min(1, "Target state is required"),
  reason: optionalString(),
  comment: optionalString(),
  validateTransitions: optionalBool(true),
  skipInvalidTransitions: optionalBool(true),
  ...bulkOperationFields()
});

export const bulkMoveToIterationByQueryHandleSchema = z.object({
  targetIterationPath: z.string().min(1, "Target iteration path is required"),
  comment: optionalString(),
  updateChildItems: optionalBool(false),
  ...bulkOperationFields()
});

export const linkWorkItemsByQueryHandlesSchema = z.object({
  sourceQueryHandle: z.string().min(1, "Source query handle is required"),
  targetQueryHandle: z.string().min(1, "Target query handle is required"),
  linkType: z.enum(["Related", "Parent", "Child", "Predecessor", "Successor", "Affects", "Affected By"]),
  sourceItemSelector: itemSelectorSchema.optional().default("all"),
  targetItemSelector: itemSelectorSchema.optional().default("all"),
  linkStrategy: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]).optional().default("one-to-one"),
  comment: optionalString(),
  skipExistingLinks: optionalBool(true),
  dryRun: optionalBool(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  ...orgProjectFields()
});

export const bulkUndoByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  undoAll: optionalBool(false).describe("Undo all operations performed on this query handle (default: false, only undoes last operation)"),
  dryRun: optionalBool(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  ...orgProjectFields()
});

// ============================================================================
// AI-Powered Bulk Operations Schemas
// ============================================================================

export const bulkEnhanceDescriptionsByQueryHandleSchema = z.object({
  enhancementStyle: z.enum(["concise", "detailed", "technical", "business"]).optional().default("detailed"),
  preserveOriginal: optionalBool(true),
  returnFormat: z.enum(["summary", "full", "preview"]).optional(),
  includeTitles: optionalBool(false),
  includeConfidence: optionalBool(false),
  ...bulkOperationFields(5)
});

export const bulkAssignStoryPointsByQueryHandleSchema = z.object({
  fibonacciOnly: optionalBool(true),
  includeReasoning: optionalBool(true),
  ...bulkOperationFields(5)
});

export const bulkAddAcceptanceCriteriaByQueryHandleSchema = z.object({
  criteriaStyle: z.enum(["gherkin", "checklist", "narrative"]).optional().default("gherkin"),
  minCriteria: z.number().int().min(1).max(10).optional().default(3),
  maxCriteria: z.number().int().min(1).max(20).optional().default(8),
  ...bulkOperationFields(5)
});

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
  ...orgProjectFields()
});

export const getPromptsSchema = z.object({
  promptName: optionalString(),
  includeContent: optionalBool(true),
  args: z.record(z.unknown()).optional()
});

export const healthCheckSchema = z.object({
  includeMetrics: optionalBool(true),
  includeADOStatus: optionalBool(true),
  includeAzureCLIStatus: optionalBool(true)
});