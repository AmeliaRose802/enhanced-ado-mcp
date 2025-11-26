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
  title: z.string().min(1, "Title is required").optional(),
  template: optionalString(),
  variables: z.record(z.string(), z.string()).optional(),
  parentWorkItemId: optionalNumber(),
  description: optionalString(),
  tags: optionalString(),
  workItemType: optionalString(),
  areaPath: optionalString(),
  iterationPath: optionalString(),
  assignedTo: optionalString(),
  priority: optionalNumber(),
  ...orgProjectFields()
}).refine(
  (data) => {
    // Title is required unless template is provided
    if (!data.title && !data.template) {
      return false;
    }
    return true;
  },
  {
    message: "Either 'title' or 'template' parameter is required"
  }
).refine(
  (data) => {
    // Root-level work item types that don't require parents
    const rootTypes = ['Epic', 'Key Result'];
    const workItemType = data.workItemType?.trim();
    
    // If a work item type is specified and it's not a root type, parent is required
    if (workItemType && !rootTypes.includes(workItemType) && !data.parentWorkItemId) {
      return false;
    }
    
    return true;
  },
  {
    message: "A parent work item is required for all work item types except Epic and Key Result. Use the 'analyze-bulk' tool with analysisType=['parent-recommendation'] to find suitable parents, or provide a parentWorkItemId."
  }
);

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
  repository: optionalString(),
  outputFormat: z.enum(["detailed", "json"]).optional().default("detailed"),
  ...orgProjectFields()
});

export const personalWorkloadAnalyzerSchema = z.object({
  assignedToEmail: z.union([
    z.string().email("Must provide a valid email address"),
    z.array(z.string().email("Must provide valid email addresses")).min(1, "At least one email address is required").max(20, "Maximum 20 email addresses allowed")
  ]),
  analysisPeriodDays: z.number().int().min(7).max(365).optional().default(90),
  additionalIntent: optionalString(),
  areaPath: optionalString(),
  continueOnError: optionalBool(true),
  maxConcurrency: z.number().int().min(1).max(10).optional().default(5),
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
    "hierarchy",
    "work-item-intelligence",
    "assignment-suitability",
    "parent-recommendation"
  ])).min(1, "At least one analysis type required"),
  // Pagination options
  maxItemsToAnalyze: z.number().int().min(1).max(1000).optional().describe("Maximum number of items to analyze from query handle (default: all items, max: 1000)"),
  skip: z.number().int().min(0).optional().default(0).describe("Number of items to skip for pagination (default: 0)"),
  // Hierarchy validation options (only used when analysisType includes "hierarchy")
  validateTypes: optionalBool(true).describe("Validate parent-child type relationships (only for hierarchy analysis)"),
  validateStates: optionalBool(true).describe("Validate state progression consistency (only for hierarchy analysis)"),
  returnQueryHandles: optionalBool(true).describe("Create query handles for violation categories (only for hierarchy analysis)"),
  includeViolationDetails: optionalBool(false).describe("Include full violation details in response (only for hierarchy analysis)"),
  // Work item intelligence options (only used when analysisType includes "work-item-intelligence")
  intelligenceAnalysisType: z.enum(["completeness", "ai-readiness", "enhancement", "categorization", "full"]).optional().default("full").describe("Type of work item analysis (only for work-item-intelligence)"),
  contextInfo: optionalString().describe("Additional context for work item analysis (only for work-item-intelligence)"),
  enhanceDescription: optionalBool(false).describe("Generate enhanced descriptions (only for work-item-intelligence)"),
  // Assignment suitability options (only used when analysisType includes "assignment-suitability")
  outputFormat: z.enum(["detailed", "json"]).optional().default("detailed").describe("Output format for assignment analysis (only for assignment-suitability)"),
  repository: optionalString().describe("Repository name to discover specialized agents for recommendation (only for assignment-suitability)"),
  // Parent recommendation options (only used when analysisType includes "parent-recommendation")
  dryRun: optionalBool(false).describe("Preview parent recommendations without creating query handle (only for parent-recommendation)"),
  areaPath: optionalString().describe("Area path to search for parent candidates (only for parent-recommendation)"),
  includeSubAreas: optionalBool(false).describe("Include sub-areas in parent search (only for parent-recommendation)"),
  maxParentCandidates: z.number().int().min(3).max(50).optional().default(20).describe("Maximum parent candidates per child (only for parent-recommendation)"),
  maxRecommendations: z.number().int().min(1).max(5).optional().default(3).describe("Maximum parent recommendations per child (only for parent-recommendation)"),
  parentWorkItemTypes: z.array(z.string()).optional().describe("Specific parent types to search for (only for parent-recommendation)"),
  searchScope: z.enum(["area", "project", "iteration"]).optional().default("area").describe("Parent search scope (only for parent-recommendation)"),
  iterationPath: optionalString().describe("Iteration path filter when searchScope='iteration' (only for parent-recommendation)"),
  requireActiveParents: optionalBool(true).describe("Only consider active/new/committed parents (only for parent-recommendation)"),
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.5).describe("Minimum confidence for parent recommendations (only for parent-recommendation)"),
  ...orgProjectFields()
});

export const aiQueryAnalysisSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  intent: z.string().min(1, "Natural language analysis intent is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  maxItemsToAnalyze: z.number().int().min(1).max(100).optional().default(50).describe("Maximum number of items to analyze from query handle (default: 50, max: 100)"),
  skip: z.number().int().min(0).optional().default(0).describe("Number of items to skip for pagination (default: 0)"),
  includeContextPackages: optionalBool(true).describe("Retrieve full context packages for deeper analysis (default: true)"),
  contextDepth: z.enum(["basic", "standard", "deep"]).optional().default("standard").describe("Level of context detail: basic (no history/relations), standard (default), deep (full history/relations)"),
  outputFormat: z.enum(["concise", "detailed", "json"]).optional().default("concise").describe("Output format: concise (brief summary), detailed (comprehensive), json (structured data)"),
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.0).describe("Minimum confidence score for recommendations (0-1, default 0.0 - no filtering)"),
  temperature: z.number().min(0).max(2).optional().default(0.3).describe("AI temperature for analysis (0-2, default 0.3 for factual analysis)"),
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

export const getTeamMembersSchema = z.object({
  areaPath: optionalString().describe("Area path to filter team members (uses config default if not provided)"),
  dateRangeStart: optionalString().describe("Start date for activity filter (ISO format YYYY-MM-DD, default: 90 days ago)"),
  dateRangeEnd: optionalString().describe("End date for activity filter (ISO format YYYY-MM-DD, default: today)"),
  activeOnly: optionalBool(true).describe("Only include members with assigned work items in date range (default: true)"),
  ...orgProjectFields()
});

export const similarityDetectionSchema = z.object({
  workItemId: optionalNumber().describe("Single work item ID to find similar items for"),
  queryHandle: optionalString().describe("Query handle containing work items to analyze for similarity"),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.6).describe("Minimum similarity score (0-1, default 0.6). 0.9+ = duplicates, 0.6-0.9 = related"),
  maxResults: z.number().int().min(1).max(100).optional().default(20).describe("Maximum similar items to return per source item (default 20, max 100)"),
  includeEmbeddings: optionalBool(false).describe("Include embedding vectors in response (default false - large payload)"),
  skipCache: optionalBool(false).describe("Skip embedding cache and regenerate (default false - uses cache for efficiency)"),
  analysisType: z.enum(['duplicates', 'related', 'cluster', 'all']).optional().default('all').describe("Type of analysis: duplicates (>90% similar), related (60-90%), cluster (group by topic), all (default)"),
  ...orgProjectFields()
}).refine(
  (data) => data.workItemId || data.queryHandle,
  {
    message: "Either workItemId or queryHandle must be provided"
  }
);

export const getPullRequestDiffSchema = z.object({
  repository: z.string().min(1, "Repository name or ID is required"),
  pullRequestId: z.number().int().positive("Pull request ID must be a positive integer"),
  iterationId: z.number().int().positive("Iteration ID must be a positive integer").optional().describe("Specific iteration to fetch. If not provided, fetches latest iteration"),
  includeContentMetadata: optionalBool(false).describe("Include additional file metadata"),
  includeDiffs: optionalBool(true).describe("Include actual file diffs for each changed file (default: true). Set to false for just file list."),
  diffFormat: z.enum(['unified', 'sideBySide']).optional().default('unified').describe("Diff format: 'unified' for standard unified diff, 'sideBySide' for side-by-side comparison (default: unified)"),
  contextLines: z.number().int().min(0).max(20).optional().default(3).describe("Number of context lines around changes in unified diff (default: 3, max: 20)"),
  maxDiffLines: z.number().int().min(100).max(10000).optional().default(1000).describe("Maximum total diff lines to include per file (default: 1000, max: 10000). Files exceeding this show truncation warning."),
  pathFilter: z.array(z.string()).optional().describe("Only include diffs for files matching these path patterns (glob-style, e.g., ['src/**/*.ts', 'tests/**'])"),
  top: z.number().int().min(1).max(1000).optional().default(100).describe("Maximum number of changed files to return (default: 100, max: 1000)"),
  skip: z.number().int().min(0).optional().default(0).describe("Number of changed files to skip for pagination"),
  ...orgProjectFields()
});

export const getPullRequestCommentsSchema = z.object({
  description: optionalString().describe("Natural language description of what PRs and comments to find (AI-powered). Example: 'Show active threads from PRs targeting main in the last week'"),
  repository: optionalString().describe("Repository name or ID (required for specific PR, optional for search mode)"),
  pullRequestId: z.number().int().positive("Pull request ID must be a positive integer").optional().describe("Specific PR ID to fetch comments from (optional - omit to search for PRs)"),
  status: z.enum(['active', 'abandoned', 'completed', 'notSet', 'all']).optional().describe("PR status filter for search mode (default: active)"),
  creatorId: optionalString().describe("Filter PRs by creator GUID (search mode only)"),
  reviewerId: optionalString().describe("Filter PRs by reviewer GUID (search mode only)"),
  sourceRefName: optionalString().describe("Filter PRs by source branch (e.g., 'refs/heads/feature/my-branch')"),
  targetRefName: optionalString().describe("Filter PRs by target branch (e.g., 'refs/heads/main')"),
  minTime: optionalString().describe("Filter PRs created after this date (ISO format YYYY-MM-DDTHH:mm:ssZ)"),
  maxTime: optionalString().describe("Filter PRs created before this date (ISO format YYYY-MM-DDTHH:mm:ssZ)"),
  threadStatusFilter: z.array(z.enum(['unknown', 'active', 'fixed', 'wontFix', 'closed', 'byDesign', 'pending'])).optional().describe("Filter threads by status (e.g., ['active', 'pending'] for unresolved threads)"),
  includeSystemComments: optionalBool(false).describe("Include system-generated comments (default: false)"),
  includeDeleted: optionalBool(false).describe("Include deleted threads (default: false)"),
  maxPRsToFetch: z.number().int().min(1).max(100).optional().default(10).describe("Maximum PRs to fetch in search mode (default: 10, max: 100)"),
  top: z.number().int().min(1).max(100).optional().default(50).describe("Maximum PRs per page for search (default: 50)"),
  skip: z.number().int().min(0).optional().default(0).describe("Number of PRs to skip for pagination"),
  ...orgProjectFields()
});

// ============================================================================
// Template Management Schemas
// ============================================================================

export const listTemplatesSchema = z.object({});

export const getTemplateSchema = z.object({
  templateName: z.string().min(1, "Template name is required")
});

export const validateTemplateSchema = z.object({
  templateName: z.string().min(1, "Template name is required")
});

// ============================================================================
// Custom Field Manager Schemas
// ============================================================================

export const discoverCustomFieldsSchema = z.object({
  includeSystemFields: optionalBool(false),
  includeMicrosoftFields: optionalBool(true),
  includePicklistValues: optionalBool(true),
  ...orgProjectFields()
});

export const validateCustomFieldsSchema = z.object({
  severityFilter: z.enum(["error", "warning", "info", "all"]).optional().default("all"),
  focusOnCustomFields: optionalBool(true),
  ...orgProjectFields()
});

export const exportFieldSchemaSchema = z.object({
  format: z.enum(["json", "yaml"]).optional().default("json"),
  outputPath: optionalString(),
  includeSystemFields: optionalBool(false),
  includeMicrosoftFields: optionalBool(true),
  includeUsageMetadata: optionalBool(true),
  prettyPrint: optionalBool(true),
  ...orgProjectFields()
});

// ============================================================================
// Export Schemas
// ============================================================================

export const exportWorkItemsSchema = z.object({
  queryHandle: z.string().min(1, "Query handle is required"),
  itemSelector: itemSelectorSchema.optional().default("all"),
  format: z.enum(['csv', 'xlsx', 'tsv']).describe("Export format: csv (comma-separated), xlsx (Excel), or tsv (tab-separated)"),
  outputPath: z.string().optional().describe("Output file path. If not provided, generates in workspace directory with timestamp."),
  
  // Field Selection
  fields: z.array(z.string()).optional().describe("Specific fields to export (e.g., ['System.Id', 'System.Title']). If not provided, exports standard fields."),
  includeAllFields: optionalBool(false).describe("Include all available fields (default: false)"),
  
  // Relationships
  includeRelationships: optionalBool(false).describe("Include relationships in export (parent, children, related)"),
  relationshipDepth: z.number().int().min(1).max(3).optional().default(1).describe("Depth of child relationships to include (1 = immediate children)"),
  
  // Additional Data
  includeComments: optionalBool(false).describe("Include work item comments/discussion"),
  includeHistory: optionalBool(false).describe("Include work item revision history"),
  includeAttachmentLinks: optionalBool(false).describe("Include attachment URLs"),
  maxHistoryRevisions: z.number().int().min(1).max(50).optional().default(10).describe("Maximum history revisions per work item"),
  
  // Excel-specific options
  excelOptions: z.object({
    multipleSheets: optionalBool(true).describe("Create multiple sheets (work items, relationships, comments)"),
    formatHeaders: optionalBool(true).describe("Apply header formatting (bold, colored background)"),
    freezePanes: optionalBool(true).describe("Freeze header row"),
    autoColumnWidth: optionalBool(true).describe("Auto-size columns to content"),
    includeHyperlinks: optionalBool(true).describe("Add hyperlinks to Azure DevOps work items"),
    sheetNames: z.object({
      workItems: z.string().optional().default("Work Items"),
      relationships: z.string().optional().default("Relationships"),
      comments: z.string().optional().default("Comments"),
      history: z.string().optional().default("History")
    }).optional()
  }).optional(),
  
  // Performance & Limits
  maxItems: z.number().int().min(1).max(10000).optional().describe("Maximum items to export (default: all selected items, max: 10000)"),
  streamLargeExports: optionalBool(true).describe("Stream large exports to reduce memory usage (default: true)"),
  
  ...orgProjectFields()
});

// ============================================================================
// Changelog Generation Schemas
// ============================================================================

export const generateChangelogSchema = z.object({
  // Time Range (provide ONE)
  dateRangeStart: z.string().optional().describe("Start date for changelog (ISO 8601: YYYY-MM-DD)"),
  dateRangeEnd: z.string().optional().describe("End date for changelog (ISO 8601: YYYY-MM-DD)"),
  iterationPath: z.string().optional().describe("Iteration path to generate changelog for"),
  
  // Version Information
  version: z.string().optional().describe("Version tag for the changelog (e.g., '1.2.0', 'v2.0.0')"),
  
  // Filtering
  states: z.array(z.string()).optional().default(['Closed', 'Resolved']).describe("Work item states to include (default: ['Closed', 'Resolved'])"),
  includeTypes: z.array(z.string()).optional().describe("Specific work item types to include (e.g., ['Bug', 'Task', 'Product Backlog Item'])"),
  excludeTypes: z.array(z.string()).optional().describe("Work item types to exclude"),
  tags: z.array(z.string()).optional().describe("Filter by specific tags (e.g., ['release', 'hotfix'])"),
  areaPathFilter: z.array(z.string()).optional().describe("Filter by specific area paths"),
  
  // Grouping & Formatting
  groupBy: z.enum(['type', 'assignee', 'priority', 'tag', 'none']).optional().default('type').describe("How to group changelog entries (default: 'type')"),
  format: z.enum(['markdown', 'keepachangelog', 'conventional', 'semantic', 'json']).optional().default('keepachangelog').describe("Changelog format (default: 'keepachangelog')"),
  includeWorkItemLinks: optionalBool(true).describe("Include links to work items in Azure DevOps"),
  includeDescriptions: optionalBool(false).describe("Include work item descriptions in changelog"),
  includeAssignees: optionalBool(false).describe("Include assignee names in changelog entries"),
  
  // Type Mapping (for categorization)
  typeMapping: z.record(z.string(), z.string()).optional().describe("Custom mapping of work item types to changelog categories (e.g., {'Bug': 'Bug Fixes', 'Task': 'Improvements'})"),
  
  // Output
  outputPath: z.string().optional().describe("File path to write changelog (e.g., 'CHANGELOG.md'). If not provided, returns as text."),
  append: optionalBool(false).describe("Append to existing changelog file (default: false, overwrites)"),
  
  // Configuration
  ...orgProjectFields()
});