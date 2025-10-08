/**
 * Zod Schema Definitions for MCP Tools
 * 
 * All tool parameter schemas with validation rules, defaults, and JSDoc documentation.
 * Schemas are used for runtime validation and type inference.
 */

import { z } from "zod";
import { loadConfiguration } from "./config.js";

/**
 * Helper to get current configuration for default values
 */
const cfg = () => loadConfiguration();

// ============================================================================
// Core Work Item Creation & Management Schemas
// ============================================================================

/**
 * Schema for wit-create-new-item tool
 * Creates a new Azure DevOps work item with optional parent relationship
 */
export const createNewItemSchema = z.object({
  /** Title of the work item (required) */
  title: z.string().min(1, "Title cannot be empty. Provide a descriptive title for the work item."),
  
  /** Optional parent work item ID to establish hierarchy */
  parentWorkItemId: z.number().int().positive().optional(),
  
  /** Markdown description or repro steps */
  description: z.string().optional(),
  
  /** Semicolon or comma separated tags */
  tags: z.string().optional(),
  
  /** Work item type (defaults to config value) */
  workItemType: z.string().optional().default(() => cfg().azureDevOps.defaultWorkItemType),
  
  /** Area path (defaults to config value) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Iteration path (defaults to config value) */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Assigned to user (defaults to config value) */
  assignedTo: z.string().optional().default(() => cfg().azureDevOps.defaultAssignedTo),
  
  /** Priority (defaults to config value) */
  priority: z.number().int().min(1).max(10).optional().default(() => cfg().azureDevOps.defaultPriority),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  
  /** Inherit area/iteration paths from parent (defaults to config value) */
  inheritParentPaths: z.boolean().optional().default(() => cfg().azureDevOps.inheritParentPaths)
});

/**
 * Schema for wit-assign-to-copilot tool
 * Assigns an existing work item to GitHub Copilot with branch link
 */
export const assignToCopilotSchema = z.object({
  /** Existing work item ID to assign */
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  
  /** Git repository name (required) */
  repository: z.string().min(1, "Repository name is required"),
  
  /** Git branch name (defaults to config value) */
  branch: z.string().optional().default(() => cfg().gitRepository.defaultBranch),
  
  /** GitHub Copilot GUID (defaults to config value) */
  gitHubCopilotGuid: z.string().optional().default(() => cfg().gitHubCopilot.defaultGuid),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-new-copilot-item tool
 * Creates a new work item under a parent and immediately assigns to GitHub Copilot
 */
export const newCopilotItemSchema = z.object({
  /** Title of the work item (required) */
  title: z.string().min(1, "Title cannot be empty"),
  
  /** Parent work item ID under which to create the new item */
  parentWorkItemId: z.number().int().positive("Parent work item ID must be a positive integer"),
  
  /** Git repository name (required) */
  repository: z.string().min(1, "Repository name is required"),
  
  /** Markdown description */
  description: z.string().optional(),
  
  /** Semicolon or comma separated tags */
  tags: z.string().optional(),
  
  /** Work item type (defaults to config value) */
  workItemType: z.string().optional().default(() => cfg().azureDevOps.defaultWorkItemType),
  
  /** Area path (defaults to config value) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Iteration path (defaults to config value) */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Priority (defaults to config value) */
  priority: z.number().int().min(1).max(10).optional().default(() => cfg().azureDevOps.defaultPriority),
  
  /** Git branch name (defaults to config value) */
  branch: z.string().optional().default(() => cfg().gitRepository.defaultBranch),
  
  /** GitHub Copilot GUID (defaults to config value) */
  gitHubCopilotGuid: z.string().optional().default(() => cfg().gitHubCopilot.defaultGuid),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  
  /** Inherit area/iteration paths from parent (defaults to config value) */
  inheritParentPaths: z.boolean().optional().default(() => cfg().azureDevOps.inheritParentPaths)
});

/**
 * Schema for wit-clone-work-item tool
 * Clone/duplicate an existing work item with optional modifications
 */
export const cloneWorkItemSchema = z.object({
  /** Work item ID to clone/duplicate */
  sourceWorkItemId: z.number().int().positive("Source work item ID must be a positive integer"),
  
  /** Override title for cloned work item (default: '[Clone] {original title}') */
  title: z.string().optional(),
  
  /** Area path for cloned work item (defaults to source area) */
  targetAreaPath: z.string().optional(),
  
  /** Iteration path for cloned work item (defaults to source iteration) */
  targetIterationPath: z.string().optional(),
  
  /** Target project for cross-project cloning (defaults to source project) */
  targetProject: z.string().optional(),
  
  /** Assign cloned work item to specific user (defaults to unassigned) */
  assignTo: z.string().optional(),
  
  /** Include description from source (default true) */
  includeDescription: z.boolean().optional().default(true),
  
  /** Include acceptance criteria (default true) */
  includeAcceptanceCriteria: z.boolean().optional().default(true),
  
  /** Include tags from source (default true) */
  includeTags: z.boolean().optional().default(true),
  
  /** Clone attachments (default false, can be slow) */
  includeAttachments: z.boolean().optional().default(false),
  
  /** Also clone child work items (default false) */
  includeChildren: z.boolean().optional().default(false),
  
  /** Create 'Related' link back to source (default true) */
  linkToSource: z.boolean().optional().default(true),
  
  /** Add comment explaining the cloning */
  comment: z.string().optional(),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

// ============================================================================
// Context Package Schemas
// ============================================================================

/**
 * Schema for wit-get-work-item-context-package tool
 * Retrieves comprehensive context for a single work item
 */
export const workItemContextPackageSchema = z.object({
  /** Primary work item ID to retrieve full context for */
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  
  /** Include recent change history (disabled by default to save ~40KB per work item) */
  includeHistory: z.boolean().optional().default(false),
  
  /** Maximum number of recent history revisions to include when history is enabled */
  maxHistoryRevisions: z.number().int().positive().optional().default(10),
  
  /** Include work item comments/discussion */
  includeComments: z.boolean().optional().default(true),
  
  /** Include related links (parent, children, related, attachments, commits, PRs) */
  includeRelations: z.boolean().optional().default(true),
  
  /** Include all child hierarchy (one level) if item is a Feature/Epic */
  includeChildren: z.boolean().optional().default(true),
  
  /** Include parent work item details if present */
  includeParent: z.boolean().optional().default(true),
  
  /** Include linked Git PRs and commits if present in relations */
  includeLinkedPRsAndCommits: z.boolean().optional().default(false),
  
  /** Include extended field set beyond defaults */
  includeExtendedFields: z.boolean().optional().default(false),
  
  /** Return original HTML field values alongside Markdown/plain text */
  includeHtml: z.boolean().optional().default(false),
  
  /** Depth of child hierarchy to traverse (1 = immediate children) */
  maxChildDepth: z.number().int().positive().optional().default(1),
  
  /** Maximum number of related items to expand */
  maxRelatedItems: z.number().int().positive().optional().default(10),
  
  /** Include attachment metadata (names, urls, sizes) */
  includeAttachments: z.boolean().optional().default(true),
  
  /** Include tags list */
  includeTags: z.boolean().optional().default(true),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-get-work-items-context-batch tool
 * Retrieve multiple work items with relationship graph and metrics
 */
export const workItemsBatchContextSchema = z.object({
  /** List of work item IDs (max 50) */
  workItemIds: z.array(z.number().int().positive("Each work item ID must be a positive integer"))
    .min(1, "At least one work item ID is required")
    .max(50, "Maximum 50 work items allowed per batch"),
  
  /** Include relationship edges between provided items */
  includeRelations: z.boolean().optional().default(true),
  
  /** Additional fields to include per work item */
  includeFields: z.array(z.string()).optional(),
  
  /** Include extended field set beyond defaults */
  includeExtendedFields: z.boolean().optional().default(false),
  
  /** Include tags list */
  includeTags: z.boolean().optional().default(true),
  
  /** Return aggregate counts by state and type */
  includeStateCounts: z.boolean().optional().default(true),
  
  /** Aggregate story points / effort fields if present */
  includeStoryPointAggregation: z.boolean().optional().default(true),
  
  /** Include basic heuristic risk / staleness scoring */
  includeRiskScoring: z.boolean().optional().default(false),
  
  /** Include lightweight AI suitability heuristic */
  includeAIAssignmentHeuristic: z.boolean().optional().default(false),
  
  /** Include minimal parent references outside requested set */
  includeParentOutsideSet: z.boolean().optional().default(false),
  
  /** Include minimal child references outside requested set */
  includeChildrenOutsideSet: z.boolean().optional().default(false),
  
  /** Cap number of outside references added */
  maxOutsideReferences: z.number().int().positive().optional().default(20),
  
  /** Return as graph (nodes/edges) or simple array */
  returnFormat: z.enum(["graph", "array"]).optional().default("array"),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-get-context-packages-by-query-handle tool
 * Retrieve context packages for work items selected from a query handle
 */
export const getContextPackagesByQueryHandleSchema = z.object({
  /** Query handle to retrieve work items from */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Include work item comments/discussion */
  includeComments: z.boolean().optional().default(true),
  
  /** Include related links */
  includeRelations: z.boolean().optional().default(true),
  
  /** Include all child hierarchy */
  includeChildren: z.boolean().optional().default(true),
  
  /** Include parent work item details */
  includeParent: z.boolean().optional().default(true),
  
  /** Include linked Git PRs and commits */
  includeLinkedPRsAndCommits: z.boolean().optional().default(false),
  
  /** Include extended field set */
  includeExtendedFields: z.boolean().optional().default(false),
  
  /** Return original HTML field values */
  includeHtml: z.boolean().optional().default(false),
  
  /** Maximum number of packages to fetch */
  maxPackages: z.number().int().positive().optional().default(50),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

// ============================================================================
// Analysis & Intelligence Schemas
// ============================================================================

/**
 * Schema for wit-extract-security-links tool
 * Extract and categorize security findings from work item descriptions
 */
export const extractSecurityLinksSchema = z.object({
  /** Work item ID to analyze */
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  
  /** Include resolved/closed items */
  includeResolved: z.boolean().optional().default(false),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-intelligence-analyzer tool
 * Comprehensive work item analysis with AI-powered insights
 */
export const workItemIntelligenceSchema = z.object({
  /** Work item ID to analyze */
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  
  /** Include detailed analysis */
  detailed: z.boolean().optional().default(false),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-ai-assignment-analyzer tool
 * Analyze work items for AI assignment suitability
 */
export const aiAssignmentAnalyzerSchema = z.object({
  /** Work item ID to analyze */
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  
  /** Include context from related items */
  includeContext: z.boolean().optional().default(false),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-personal-workload-analyzer tool
 * Analyze personal workload and capacity
 */
export const personalWorkloadAnalyzerSchema = z.object({
  /** User email or display name to analyze (defaults to current user) */
  assignedTo: z.string().optional().default("@me"),
  
  /** Area path to scope analysis */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Include completed items in analysis */
  includeCompleted: z.boolean().optional().default(false),
  
  /** Maximum work items to analyze */
  maxResults: z.number().int().positive().optional().default(100),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-sprint-planning-analyzer tool
 * Analyze and optimize sprint planning
 */
export const sprintPlanningAnalyzerSchema = z.object({
  /** Iteration path to analyze */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Area path to scope analysis */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Include capacity planning */
  includeCapacity: z.boolean().optional().default(true),
  
  /** Include velocity analysis */
  includeVelocity: z.boolean().optional().default(true),
  
  /** Number of past sprints to analyze for velocity */
  lookbackSprints: z.number().int().min(1).max(10).optional().default(3),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-backlog-cleanup-analyzer tool
 * Analyze backlog for stale, incomplete, or problematic work items
 */
export const backlogCleanupAnalyzerSchema = z.object({
  /** Area path to analyze (uses configured default if not provided) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Days without substantive change to consider stale (default 180) - RENAMED FROM stalenessThresholdDays */
  backlogStaleness: z.object({
    /** Number of days of inactivity to consider item stale */
    thresholdDays: z.number().int().min(1).max(730).default(180),
    
    /** Consider items with no substantive changes (updates to core fields) */
    excludeMinorUpdates: z.boolean().default(true)
  }).optional().default({
    thresholdDays: 180,
    excludeMinorUpdates: true
  }),
  
  /** Include child area paths (default true) */
  includeSubAreas: z.boolean().optional().default(true),
  
  /** Check for missing descriptions, acceptance criteria, story points (default true) */
  includeQualityChecks: z.boolean().optional().default(true),
  
  /** Check for unassigned items, missing iterations, priorities (default true) */
  includeMetadataChecks: z.boolean().optional().default(true),
  
  /** Maximum work items to analyze (default 500, max 2000) */
  maxResults: z.number().int().min(1).max(2000).optional().default(500),
  
  /** Return query handle for bulk remediation (default true) */
  returnQueryHandle: z.boolean().optional().default(true),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-detect-patterns tool
 * Detect patterns and anomalies in work items
 */
export const detectPatternsSchema = z.object({
  /** Area path to analyze */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Include pattern detection */
  includePatterns: z.boolean().optional().default(true),
  
  /** Include anomaly detection */
  includeAnomalies: z.boolean().optional().default(true),
  
  /** Maximum work items to analyze */
  maxResults: z.number().int().positive().optional().default(200),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-validate-hierarchy tool
 * Fast validation of work item hierarchy for structural issues
 */
export const validateHierarchyFastSchema = z.object({
  /** Root work item ID to start validation from */
  rootWorkItemId: z.number().int().positive("Root work item ID must be a positive integer"),
  
  /** Maximum depth to traverse */
  maxDepth: z.number().int().min(1).max(10).optional().default(5),
  
  /** Check for circular references */
  checkCircularRefs: z.boolean().optional().default(true),
  
  /** Check for orphaned items */
  checkOrphans: z.boolean().optional().default(true),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-get-last-substantive-change tool
 * Get the last substantive change timestamp for a work item
 */
export const getLastSubstantiveChangeSchema = z.object({
  /** Work item ID to check */
  workItemId: z.number().int().positive("Work item ID must be a positive integer"),
  
  /** Fields to consider substantive (defaults to core fields) */
  substantiveFields: z.array(z.string()).optional(),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

// ============================================================================
// Query & Discovery Schemas
// ============================================================================

/**
 * Schema for wit-get-configuration tool
 * Get current MCP server configuration
 */
export const getConfigurationSchema = z.object({
  /** Include potentially sensitive configuration values */
  includeSensitive: z.boolean().optional().default(false),
  
  /** Specific configuration section to retrieve */
  section: z.enum(["all", "azureDevOps", "gitRepository", "gitHubCopilot"]).optional().default("all")
});

/**
 * Schema for wit-get-work-items-by-query-wiql tool
 * Execute WIQL query to retrieve work items
 */
export const wiqlQuerySchema = z.object({
  /** WIQL query string */
  wiqlQuery: z.string().min(1, "WIQL query cannot be empty"),
  
  /** Return query handle for bulk operations (default true) */
  returnQueryHandle: z.boolean().optional().default(true),
  
  /** Include substantive change timestamp for each work item */
  includeSubstantiveChange: z.boolean().optional().default(false),
  
  /** Maximum number of results to return */
  top: z.number().int().positive().optional().default(200),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-query-analytics-odata tool
 * Execute OData Analytics query for metrics and aggregations
 */
export const odataAnalyticsQuerySchema = z.object({
  /** OData query string */
  odataQuery: z.string().min(1, "OData query cannot be empty"),
  
  /** Return query handle if applicable */
  returnQueryHandle: z.boolean().optional().default(false),
  
  /** Maximum number of results */
  top: z.number().int().positive().optional().default(200),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-generate-wiql-query tool
 * Generate WIQL query from natural language description
 */
export const generateWiqlQuerySchema = z.object({
  /** Natural language description of the desired query */
  description: z.string().min(1, "Query description cannot be empty"),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  
  /** Area path for query context (defaults to config value) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Iteration path for query context (defaults to config value) */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Maximum iterations for query refinement */
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
  
  /** Include usage examples in response */
  includeExamples: z.boolean().optional().default(true),
  
  /** Test query execution and return results */
  testQuery: z.boolean().optional().default(true),
  
  /** Return query handle for bulk operations */
  returnQueryHandle: z.boolean().optional().default(false),
  
  /** Maximum results to return when testing */
  maxResults: z.number().int().positive().optional().default(200),
  
  /** Additional fields to include in results */
  includeFields: z.array(z.string()).optional()
});

/**
 * Schema for wit-generate-odata-query tool
 * Generate OData Analytics query from natural language description
 */
export const generateODataQuerySchema = z.object({
  /** Natural language description of the desired query */
  description: z.string().min(1, "Query description cannot be empty"),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  
  /** Area path for query context (defaults to config value) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Iteration path for query context (defaults to config value) */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Maximum iterations for query refinement */
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
  
  /** Include usage examples in response */
  includeExamples: z.boolean().optional().default(true),
  
  /** Test query execution and return results */
  testQuery: z.boolean().optional().default(true),
  
  /** Maximum results to return when testing */
  maxResults: z.number().int().positive().optional().default(200),
  
  /** Additional fields to include in results */
  includeFields: z.array(z.string()).optional()
});

/**
 * Schema for wit-generate-query tool (Unified Query Generator)
 * Intelligently chooses between WIQL and OData based on query characteristics
 */
export const unifiedQueryGeneratorSchema = z.object({
  /** Natural language description of the desired query */
  description: z.string().min(1, "Query description cannot be empty"),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  
  /** Area path for query context (defaults to config value) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Iteration path for query context (defaults to config value) */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Maximum iterations for query refinement */
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
  
  /** Include usage examples in response */
  includeExamples: z.boolean().optional().default(true),
  
  /** Test query execution and return results */
  testQuery: z.boolean().optional().default(true),
  
  /** Return query handle for bulk operations */
  returnQueryHandle: z.boolean().optional().default(true),
  
  /** Maximum results to return when testing */
  maxResults: z.number().int().positive().optional().default(200),
  
  /** Additional fields to include in results */
  includeFields: z.array(z.string()).optional()
});

/**
 * Schema for wit-discover-tools tool
 * AI-powered tool discovery to find the right tools for a task
 */
export const toolDiscoverySchema = z.object({
  /** Natural language description of what you want to accomplish */
  intent: z.string().min(1, "Intent description cannot be empty"),
  
  /** Additional context about your project, team, or requirements */
  context: z.string().optional(),
  
  /** Maximum number of tool recommendations to return (1-10) */
  maxRecommendations: z.number().int().min(1).max(10).optional().default(3),
  
  /** Include detailed usage examples for each recommended tool (default false, saves ~100-300 tokens per tool) */
  includeExamples: z.boolean().optional().default(false),
  
  /** Filter recommendations to specific category */
  filterCategory: z.enum([
    "creation",         // create/new items
    "analysis",         // analyze/detect/validate
    "bulk-operations",  // bulk updates
    "query",           // WIQL/OData
    "ai-powered",      // AI tools
    "all"              // no filter
  ]).optional().default("all")
});

// ============================================================================
// Query Handle Schemas
// ============================================================================

/**
 * Schema for wit-validate-query-handle tool
 * Validate a query handle and check if it's still valid
 */
export const validateQueryHandleSchema = z.object({
  /** Query handle to validate */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-inspect-query-handle tool
 * Detailed inspection of a query handle including staleness data
 */
export const inspectQueryHandleSchema = z.object({
  /** Query handle to inspect */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Include detailed analysis */
  detailed: z.boolean().optional().default(false),
  
  /** Include work item preview */
  includePreview: z.boolean().optional().default(true),
  
  /** Include statistics */
  includeStats: z.boolean().optional().default(true),
  
  /** Include examples for template substitution */
  includeExamples: z.boolean().optional().default(false),
  
  /** Number of preview items to show */
  previewCount: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-select-items-from-query-handle tool
 * Select specific items from a query handle using criteria
 */
export const selectItemsFromQueryHandleSchema = z.object({
  /** Query handle to select items from */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Return work item details */
  includeDetails: z.boolean().optional().default(false),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-query-handle-info tool
 * Unified query handle info combining validate, inspect, and select
 */
export const queryHandleInfoSchema = z.object({
  /** Query handle to get info for */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Include detailed analysis */
  detailed: z.boolean().optional().default(false),
  
  /** Include work item preview */
  includePreview: z.boolean().optional().default(true),
  
  /** Include statistics */
  includeStats: z.boolean().optional().default(true),
  
  /** Include examples for template substitution */
  includeExamples: z.boolean().optional().default(false),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional(),
  
  /** Number of preview items to show */
  previewCount: z.number().int().positive().optional().default(10),
  
  /** Include sample items in response */
  includeSampleItems: z.boolean().optional().default(false),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-list-query-handles tool
 * List all available query handles with optional filtering
 */
export const listQueryHandlesSchema = z.object({
  /** Filter by query type */
  queryType: z.enum(["wiql", "odata", "all"]).optional().default("all"),
  
  /** Include expired handles */
  includeExpired: z.boolean().optional().default(false),
  
  /** Maximum number of handles to return */
  top: z.number().int().positive().optional().default(50).refine((val: number) => val <= 200, {
    message: "Maximum 200 handles can be returned"
  }),
  
  /** Number of handles to skip for pagination */
  skip: z.number().int().min(0).optional().default(0),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-analyze-by-query-handle tool
 * Analyze work items selected by query handle
 */
export const analyzeByQueryHandleSchema = z.object({
  /** Query handle to analyze */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Types of analysis to perform */
  analysisType: z.array(z.enum([
    "effort",       // Story points and effort estimation
    "velocity",     // Team velocity trends
    "assignments",  // Assignment distribution
    "risks",        // Risk factors and blockers
    "completion",   // Completion patterns
    "priorities"    // Priority distribution
  ])).optional().default(["effort", "assignments", "risks"]),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Include detailed breakdown */
  includeDetailedBreakdown: z.boolean().optional().default(true),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

// ============================================================================
// Bulk Operation Schemas
// ============================================================================

/**
 * Schema for wit-bulk-comment-by-query-handle tool
 * Add comments to multiple work items using query handle
 */
export const bulkCommentByQueryHandleSchema = z.object({
  /** Query handle identifying work items to comment on */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Comment text (supports template variables from query handle context) */
  commentTemplate: z.string().min(1, "Comment template cannot be empty"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-update-by-query-handle tool
 * Update multiple work items using query handle and JSON Patch operations
 */
export const bulkUpdateByQueryHandleSchema = z.object({
  /** Query handle identifying work items to update */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** JSON Patch operations to apply */
  operations: z.array(z.object({
    op: z.enum(["add", "replace", "remove", "test"]),
    path: z.string(),
    value: z.any().optional()
  })).min(1, "At least one operation is required"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-assign-by-query-handle tool
 * Assign multiple work items using query handle
 */
export const bulkAssignByQueryHandleSchema = z.object({
  /** Query handle identifying work items to assign */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** User to assign work items to */
  assignTo: z.string().min(1, "AssignTo user is required"),
  
  /** Optional comment to add when assigning */
  comment: z.string().optional(),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-remove-by-query-handle tool
 * Remove/delete multiple work items using query handle
 */
export const bulkRemoveByQueryHandleSchema = z.object({
  /** Query handle identifying work items to remove */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Require confirmation before deletion */
  requireConfirmation: z.boolean().optional().default(true),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-transition-state-by-query-handle tool
 * Transition multiple work items to a new state using query handle
 */
export const bulkTransitionStateByQueryHandleSchema = z.object({
  /** Query handle identifying work items to transition */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Target state to transition to */
  targetState: z.string().min(1, "Target state is required"),
  
  /** Optional state transition reason */
  reason: z.string().optional(),
  
  /** Optional comment to add during transition */
  comment: z.string().optional(),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Validate state transitions against workflow rules */
  validateTransitions: z.boolean().optional().default(true),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-move-to-iteration-by-query-handle tool
 * Move multiple work items to a different iteration using query handle
 */
export const bulkMoveToIterationByQueryHandleSchema = z.object({
  /** Query handle identifying work items to move */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Target iteration path to move items to */
  targetIterationPath: z.string().min(1, "Target iteration path is required"),
  
  /** Optional comment to add when moving */
  comment: z.string().optional(),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Also update child items to same iteration */
  updateChildItems: z.boolean().optional().default(false),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-link-work-items-by-query-handles tool
 * Create relationships between work items identified by two query handles
 */
export const linkWorkItemsByQueryHandlesSchema = z.object({
  /** Query handle for source work items */
  sourceQueryHandle: z.string().min(1, "Source query handle is required"),
  
  /** Query handle for target work items */
  targetQueryHandle: z.string().min(1, "Target query handle is required"),
  
  /** Type of link to create */
  linkType: z.enum([
    "Parent",
    "Child", 
    "Related",
    "Predecessor",
    "Successor",
    "Affects",
    "Affected By"
  ]),
  
  /** Link strategy */
  linkStrategy: z.enum([
    "one-to-one",      // First source → first target, second → second, etc.
    "one-to-many",     // Each source → all targets
    "many-to-one",     // All sources → each target
    "cartesian"        // Every source → every target (use with caution)
  ]).optional().default("one-to-one"),
  
  /** Item selector for source items */
  sourceItemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Item selector for target items */
  targetItemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Skip if link already exists */
  skipExisting: z.boolean().optional().default(true),
  
  /** Validate link type compatibility with work item types */
  validateLinkTypes: z.boolean().optional().default(true),
  
  /** Optional comment to add when creating links */
  comment: z.string().optional(),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of preview items to show */
  maxPreviewItems: z.number().int().positive().optional().default(10),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

// ============================================================================
// AI-Powered Bulk Operation Schemas
// ============================================================================

/**
 * Schema for wit-bulk-enhance-descriptions-by-query-handle tool
 * AI-powered bulk enhancement of work item descriptions
 */
export const bulkEnhanceDescriptionsByQueryHandleSchema = z.object({
  /** Query handle identifying work items to enhance */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Enhancement instructions for AI */
  enhancementGuidelines: z.string().optional().default("Improve clarity, add technical context, format with markdown"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Only enhance items with poor/missing descriptions */
  onlyPoorDescriptions: z.boolean().optional().default(true),
  
  /** Minimum description quality threshold (0-1) */
  qualityThreshold: z.number().min(0).max(1).optional().default(0.3),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of items to process */
  maxItems: z.number().int().positive().optional().default(20),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-assign-story-points-by-query-handle tool
 * AI-powered bulk story point estimation
 */
export const bulkAssignStoryPointsByQueryHandleSchema = z.object({
  /** Query handle identifying work items to estimate */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Story point scale to use */
  scale: z.enum(["fibonacci", "linear", "tshirt"]).optional().default("fibonacci"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Only assign to items without existing story points */
  onlyUnestimated: z.boolean().optional().default(true),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of items to process */
  maxItems: z.number().int().positive().optional().default(20),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});

/**
 * Schema for wit-bulk-add-acceptance-criteria-by-query-handle tool
 * AI-powered bulk generation of acceptance criteria
 */
export const bulkAddAcceptanceCriteriaByQueryHandleSchema = z.object({
  /** Query handle identifying work items to add criteria to */
  queryHandle: z.string().min(1, "Query handle is required"),
  
  /** Format for acceptance criteria */
  criteriaFormat: z.enum(["gherkin", "checklist", "user-story"], {
    errorMap: () => ({ 
      message: "criteriaFormat must be one of: gherkin (Given/When/Then), checklist (bullet points), user-story (As a/I want/So that)" 
    })
  }).optional().default("gherkin"),
  
  /** Item selection criteria */
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number().int().positive()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().int().min(0).optional()
    })
  ]).optional().default("all"),
  
  /** Only add to items without existing acceptance criteria */
  onlyMissingCriteria: z.boolean().optional().default(true),
  
  /** Dry run mode (preview without making changes) */
  dryRun: z.boolean().optional().default(true),
  
  /** Maximum number of items to process */
  maxItems: z.number().int().positive().optional().default(20),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project)
});
