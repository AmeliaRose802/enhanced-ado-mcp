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

/** Common bulk operation fields */
const bulkOperationFields = (defaultPreview: number = 10) => ({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  dryRun: optionalBool(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(defaultPreview),
  concurrency: z.number().int().min(1).max(20).optional().default(5).describe("Number of concurrent operations (default: 5, max: 20)"),
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
  specializedAgent: optionalString().describe("Optional specialized Copilot agent name (e.g., 'ComponentGovernanceAgent'). Will be added as tag 'copilot:agent=<name>'"),
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
  specializedAgent: optionalString().describe("Optional specialized Copilot agent name (e.g., 'ComponentGovernanceAgent'). Will be added as tag 'copilot:agent=<name>'"),
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

export const intelligentParentFinderSchema = z.object({
  childQueryHandle: z.string().describe('Query handle containing child work items that need parents'),
  dryRun: optionalBool(false),
  areaPath: optionalString(),
  includeSubAreas: optionalBool(false), // Default to false - enforces same area path requirement
  maxParentCandidates: z.number().int().min(3).max(50).optional().default(20),
  maxRecommendations: z.number().int().min(1).max(5).optional().default(3),
  parentWorkItemTypes: z.array(z.string()).optional(),
  searchScope: z.enum(["area", "project", "iteration"]).optional().default("area"),
  iterationPath: optionalString(),
  requireActiveParents: optionalBool(true),
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.5),
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
  iterationPath: z.string().min(1, "Iteration path is required"),
  teamMembers: z.array(z.object({
    email: z.string().min(1, "Email is required"),
    name: z.string().min(1, "Name is required"),
    capacityHours: optionalNumber(),
    skills: z.array(z.string()).optional(),
    preferredWorkTypes: z.array(z.string()).optional()
  })).min(1, "At least one team member is required"),
  sprintCapacityHours: optionalNumber(),
  historicalSprintsToAnalyze: z.number().int().min(1).max(10).optional().default(3),
  candidateWorkItemIds: z.array(z.number().int()).optional(),
  considerDependencies: optionalBool(true),
  considerSkills: optionalBool(true),
  additionalConstraints: optionalString(),
  includeFullAnalysis: optionalBool(false),
  rawAnalysisOnError: optionalBool(false),
  areaPath: optionalString(),
  areaPathFilter: z.array(z.string()).optional(),
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
  intent: z.string().min(1).optional(),
  listAll: optionalBool(false).describe("List all available tools without AI analysis (default false)"),
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
}).refine(
  (data) => data.listAll || data.intent,
  { message: "Either 'intent' or 'listAll' must be provided" }
);

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
  areaPathFilter: z.array(z.string()).optional(),
  useDefaultAreaPaths: optionalBool(true), // Control whether to use default area paths from config
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

/**
 * OData Query Schema
 * Supports both direct OData execution and AI-powered query generation
 */
export const odataQuerySchema = z.object({
  // Query Definition (provide ONE of these three options)
  description: z.string().min(1).optional(), // Natural language for AI generation
  queryType: z.enum([
    "workItemCount",
    "groupByState",
    "groupByType", 
    "groupByAssignee",
    "velocityMetrics",
    "cycleTimeMetrics",
    "customQuery"
  ]).optional(), // Predefined query type for direct execution
  customODataQuery: optionalString(), // Custom OData query string for direct execution
  
  // AI Generation Options (only used with 'description')
  includeExamples: optionalBool(true),
  maxIterations: z.number().int().positive().min(1).max(5).optional().default(3),
  testQuery: optionalBool(true),
  
  // OData Query Parameters (used with queryType or customODataQuery)
  filters: z.record(z.any()).optional(),
  groupBy: z.array(z.string()).optional(),
  select: z.array(z.string()).optional(),
  orderBy: optionalString(),
  dateRangeField: z.enum(["CreatedDate", "ChangedDate", "CompletedDate", "ClosedDate"]).optional(),
  dateRangeStart: optionalString(),
  dateRangeEnd: optionalString(),
  computeCycleTime: optionalBool(false),
  
  // Result Configuration
  returnQueryHandle: optionalBool(false), // OData defaults to false (aggregations don't support handles)
  maxResults: z.number().int().min(1).max(1000).optional().default(200), // Used when returnQueryHandle=true
  includeFields: z.array(z.string()).optional(), // Used when returnQueryHandle=true
  top: z.number().int().min(1).max(10000).optional().default(1000),
  skip: z.number().int().min(0).optional().default(0),
  includeMetadata: optionalBool(false),
  includeOdataMetadata: optionalBool(false),
  
  // Scope Configuration (auto-filled from config)
  areaPath: optionalString(),
  areaPathFilter: z.array(z.string()).optional(),
  useDefaultAreaPaths: optionalBool(true),
  iterationPath: optionalString(),
  
  ...orgProjectFields()
});

// ============================================================================
// Query Handle Operations Schemas
// ============================================================================

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

// ============================================================================
// Bulk Operations Schemas
// ============================================================================

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

export const forensicUndoByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  changedBy: optionalString().describe("Filter changes by user (display name or email, case-insensitive partial match)"),
  afterTimestamp: optionalString().describe("Only detect changes after this ISO timestamp (e.g., '2025-10-28T10:00:00Z')"),
  beforeTimestamp: optionalString().describe("Only detect changes before this ISO timestamp (e.g., '2025-10-29T18:00:00Z')"),
  maxRevisions: z.number().int().min(1).max(200).optional().default(50).describe("Maximum revisions to analyze per work item"),
  detectTypeChanges: optionalBool(true).describe("Detect work item type changes"),
  detectStateChanges: optionalBool(true).describe("Detect state transitions"),
  detectFieldChanges: optionalBool(true).describe("Detect field value changes"),
  detectLinkChanges: optionalBool(true).describe("Detect parent/child link changes including hierarchy changes (ENABLED by default - essential for catching parent link modifications)"),
  fieldPaths: z.array(z.string()).optional().describe("Specific field paths to check (e.g., ['System.AssignedTo', 'System.Tags']). If not specified, checks all fields."),
  dryRun: optionalBool(true).describe("Preview forensic analysis and revert actions without making changes"),
  maxPreviewItems: z.number().int().min(1).max(500).optional().default(20).describe("Maximum items to preview in dry-run (default 20, max 500)"),
  ...orgProjectFields()
});

// ============================================================================
// Unified Bulk Operations Schema
// ============================================================================

const bulkActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("comment"),
    comment: z.string().min(1, "Comment text is required")
  }),
  z.object({
    type: z.literal("update"),
    updates: z.array(z.object({
      op: z.enum(["add", "replace", "remove"]),
      path: z.string(),
      value: z.any().optional()
    })).min(1, "At least one update operation required")
  }),
  z.object({
    type: z.literal("assign"),
    assignTo: z.string().min(1, "Assignee is required"),
    comment: optionalString()
  }),
  z.object({
    type: z.literal("remove"),
    removeReason: optionalString()
  }),
  z.object({
    type: z.literal("transition-state"),
    targetState: z.string().min(1, "Target state is required"),
    reason: optionalString(),
    comment: optionalString(),
    validateTransitions: optionalBool(true),
    skipInvalidTransitions: optionalBool(true)
  }),
  z.object({
    type: z.literal("move-iteration"),
    targetIterationPath: z.string().min(1, "Target iteration path is required"),
    comment: optionalString(),
    updateChildItems: optionalBool(false)
  }),
  z.object({
    type: z.literal("change-type"),
    targetType: z.string().min(1, "Target work item type is required"),
    validateTypeChanges: optionalBool(true),
    skipInvalidChanges: optionalBool(true),
    preserveFields: optionalBool(true),
    comment: optionalString()
  }),
  z.object({
    type: z.literal("add-tag"),
    tags: z.string().min(1, "At least one tag is required")
  }),
  z.object({
    type: z.literal("remove-tag"),
    tags: z.string().min(1, "At least one tag to remove is required")
  }),
  // AI-Powered Enhancement Actions
  z.object({
    type: z.literal("enhance-descriptions"),
    enhancementStyle: z.enum(["concise", "detailed", "technical", "business"]).optional().default("detailed"),
    preserveOriginal: optionalBool(false).describe("Append to existing description instead of replacing"),
    minConfidenceScore: z.number().min(0).max(1).optional().default(0.6).describe("Minimum confidence to apply enhancement")
  }),
  z.object({
    type: z.literal("assign-story-points"),
    estimationScale: z.enum(["fibonacci", "powers-of-2", "linear", "t-shirt"]).optional().default("fibonacci"),
    includeReasoning: optionalBool(true).describe("Add estimation reasoning as comment"),
    overwriteExisting: optionalBool(false).describe("Overwrite existing story points")
  }),
  z.object({
    type: z.literal("add-acceptance-criteria"),
    criteriaFormat: z.enum(["gherkin", "checklist", "user-story"]).optional().default("gherkin"),
    minCriteria: z.number().int().min(1).max(10).optional().default(3),
    maxCriteria: z.number().int().min(1).max(20).optional().default(7),
    appendToExisting: optionalBool(false).describe("Append to existing acceptance criteria")
  })
]);

export const unifiedBulkOperationsSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  actions: z.array(bulkActionSchema).min(1, "At least one action is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  dryRun: optionalBool(true),
  maxPreviewItems: z.number().int().min(1).max(50).optional().default(10),
  concurrency: z.number().int().min(1).max(20).optional().default(5).describe("Number of concurrent operations (default: 5, max: 20)"),
  stopOnError: optionalBool(true).describe("Stop executing actions if one fails (default: true)"),
  ...orgProjectFields()
});

// ============================================================================
// AI-Powered Analysis Schemas
// ============================================================================

export const analyzeByQueryHandleSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  analysisType: z.array(z.enum([
    "effort",
    "velocity",
    "assignments",
    "risks",
    "completion",
    "priorities",
    "hierarchy"
  ])).min(1, "At least one analysis type required"),
  // Hierarchy validation options (only used when analysisType includes "hierarchy")
  validateTypes: optionalBool(true).describe("Validate parent-child type relationships (only for hierarchy analysis)"),
  validateStates: optionalBool(true).describe("Validate state progression consistency (only for hierarchy analysis)"),
  returnQueryHandles: optionalBool(true).describe("Create query handles for violation categories (only for hierarchy analysis)"),
  includeViolationDetails: optionalBool(false).describe("Include full violation details in response (only for hierarchy analysis)"),
  ...orgProjectFields()
});

export const getPromptsSchema = z.object({
  promptName: optionalString(),
  includeContent: optionalBool(true),
  args: z.record(z.unknown()).optional()
});

export const listSubagentsSchema = z.object({
  repository: z.string().min(1, "Repository name is required"),
  ...orgProjectFields()
});