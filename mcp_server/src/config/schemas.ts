import { z } from "zod";
import { loadConfiguration } from './config.js';

/**
 * Zod schemas for tool inputs based on PowerShell parameters
 */

const cfg = () => loadConfiguration();

export const createNewItemSchema = z.object({
  Title: z.string().describe("Title of the work item (mandatory)"),
  WorkItemType: z.string().optional().describe("Azure DevOps work item type, e.g. 'Task', 'Product Backlog Item', 'Bug'").default(() => cfg().azureDevOps.defaultWorkItemType),
  ParentWorkItemId: z.number().int().optional().describe("Optional parent work item ID"),
  Description: z.string().optional().describe("Markdown description / repro steps"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  AreaPath: z.string().optional().describe("Area path override").default(() => cfg().azureDevOps.areaPath || ''),
  IterationPath: z.string().optional().describe("Iteration path override").default(() => cfg().azureDevOps.iterationPath || ''),
  AssignedTo: z.string().optional().describe("User email or @me for current user").default(() => cfg().azureDevOps.defaultAssignedTo),
  Priority: z.number().int().optional().describe("Priority (default 2)").default(() => cfg().azureDevOps.defaultPriority),
  Tags: z.string().optional().describe("Semicolon or comma separated tags"),
  InheritParentPaths: z.boolean().optional().describe("Inherit Area/Iteration from parent if not supplied").default(() => cfg().azureDevOps.inheritParentPaths)
});

export const assignToCopilotSchema = z.object({
  WorkItemId: z.number().int().describe("Existing work item ID to assign"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  Repository: z.string().describe("Git repository name (required)"),
  Branch: z.string().optional().default(() => cfg().gitRepository.defaultBranch),
  GitHubCopilotGuid: z.string().optional().default(() => cfg().gitHubCopilot.defaultGuid || '').refine(val => val.length > 0, {
    message: "GitHub Copilot GUID is required. Please provide it as a parameter or set gitHubCopilot.defaultGuid in your configuration."
  })
});

export const newCopilotItemSchema = z.object({
  Title: z.string(),
  ParentWorkItemId: z.number().int().describe("Parent work item ID under which to create the new item"),
  WorkItemType: z.string().optional().default(() => cfg().azureDevOps.defaultWorkItemType),
  Description: z.string().optional(),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  Repository: z.string().describe("Git repository name (required)"),
  Branch: z.string().optional().default(() => cfg().gitRepository.defaultBranch),
  GitHubCopilotGuid: z.string().optional().default(() => cfg().gitHubCopilot.defaultGuid || '').refine(val => val.length > 0, {
    message: "GitHub Copilot GUID is required. Please provide it as a parameter or set gitHubCopilot.defaultGuid in your configuration."
  }),
  AreaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ''),
  IterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ''),
  Priority: z.number().int().optional().default(() => cfg().azureDevOps.defaultPriority),
  Tags: z.string().optional(),
  InheritParentPaths: z.boolean().optional().default(() => cfg().azureDevOps.inheritParentPaths)
});

export const extractSecurityLinksSchema = z.object({
  WorkItemId: z.number().int().describe("Azure DevOps work item ID to extract instruction links from"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  ScanType: z.enum(["BinSkim", "CodeQL", "CredScan", "General", "All"]).optional().default("All").describe("Type of security scanner to filter links for"),
  IncludeWorkItemDetails: z.boolean().optional().default(false).describe("Include detailed work item information in the response"),
  ExtractFromComments: z.boolean().optional().default(false).describe("Also extract links from work item comments"),
  DryRun: z.boolean().optional().default(false).describe("Run in dry-run mode without making actual API calls")
});

export const workItemIntelligenceSchema = z.object({
  Title: z.string().describe("Work item title to analyze"),
  Description: z.string().optional().describe("Work item description/content to analyze"),
  WorkItemType: z.string().optional().describe("Type of work item (Task, Bug, PBI, etc.)"),
  AcceptanceCriteria: z.string().optional().describe("Current acceptance criteria if any"),
  AnalysisType: z.enum(["completeness", "ai-readiness", "enhancement", "categorization", "full"]).optional().default("full").describe("Type of analysis to perform"),
  ContextInfo: z.string().optional().describe("Additional context about the project, team, or requirements"),
  EnhanceDescription: z.boolean().optional().default(false).describe("Generate an enhanced, AI-ready description"),
  CreateInADO: z.boolean().optional().default(false).describe("Automatically create the enhanced item in Azure DevOps"),
  ParentWorkItemId: z.number().int().optional().describe("Parent work item ID if creating in ADO"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const aiAssignmentAnalyzerSchema = z.object({
  Title: z.string().describe("Work item title to analyze for AI assignment suitability"),
  Description: z.string().optional().describe("Work item description/content to analyze"),
  WorkItemType: z.string().optional().describe("Type of work item (Task, Bug, Feature, etc.)"),
  AcceptanceCriteria: z.string().optional().describe("Acceptance criteria if available"),
  Priority: z.string().optional().describe("Priority level (Critical, High, Medium, Low)"),
  Labels: z.string().optional().describe("Comma-separated labels or tags"),
  EstimatedFiles: z.string().optional().describe("Estimated number of files that might be touched"),
  TechnicalContext: z.string().optional().describe("Technical context: languages, frameworks, architectural areas"),
  ExternalDependencies: z.string().optional().describe("External dependencies or approvals needed"),
  TimeConstraints: z.string().optional().describe("Deadline or time constraints"),
  RiskFactors: z.string().optional().describe("Known risk factors or sensitive areas"),
  TestingRequirements: z.string().optional().describe("Testing requirements and existing coverage"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  AutoAssignToAI: z.boolean().optional().default(false).describe("Automatically assign to AI if suitable"),
  WorkItemId: z.number().int().optional().describe("Existing work item ID if updating existing item")
});

export const featureDecomposerSchema = z.object({
  Title: z.string().describe("Feature title to decompose into smaller work items"),
  Description: z.string().optional().describe("Feature description with requirements and context"),
  ParentWorkItemId: z.number().int().optional().describe("Parent work item ID to create child items under"),
  WorkItemType: z.string().optional().default(() => cfg().azureDevOps.defaultWorkItemType).describe("Type of work items to create (Task, User Story, etc.)"),
  TargetComplexity: z.enum(["simple", "medium"]).optional().default("medium").describe("Target complexity for generated work items"),
  MaxItems: z.number().int().optional().default(8).describe("Maximum number of work items to generate"),
  TechnicalContext: z.string().optional().describe("Technical context: architecture, frameworks, constraints"),
  BusinessContext: z.string().optional().describe("Business context: user needs, goals, success criteria"),
  ExistingComponents: z.string().optional().describe("Existing components or systems to consider"),
  Dependencies: z.string().optional().describe("Known dependencies or integration points"),
  TimeConstraints: z.string().optional().describe("Timeline or milestone constraints"),
  QualityRequirements: z.string().optional().describe("Quality, performance, or security requirements"),
  GenerateAcceptanceCriteria: z.boolean().optional().default(true).describe("Generate acceptance criteria for each work item"),
  AnalyzeAISuitability: z.boolean().optional().default(true).describe("Analyze AI assignment suitability for each item"),
  AutoCreateWorkItems: z.boolean().optional().default(false).describe("Automatically create work items in Azure DevOps"),
  AutoAssignAISuitable: z.boolean().optional().default(false).describe("Automatically assign AI-suitable items to GitHub Copilot"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  AreaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || '').describe("Area path for created work items"),
  IterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || '').describe("Iteration path for created work items"),
  Tags: z.string().optional().describe("Additional tags to apply to created work items")
});

export const hierarchyValidatorSchema = z.object({
  WorkItemIds: z.array(z.number().int()).optional().describe("Specific work item IDs to validate (if not provided, will analyze area path)"),
  AreaPath: z.string().optional().describe("Area path to analyze all work items within (used if WorkItemIds not provided)"),
  IncludeChildAreas: z.boolean().optional().default(true).describe("Include child area paths in analysis"),
  MaxItemsToAnalyze: z.number().int().optional().default(50).describe("Maximum number of work items to analyze"),
  AnalysisDepth: z.enum(["shallow", "deep"]).optional().default("shallow").describe("Analysis depth: shallow (basic) or deep (comprehensive with content analysis)"),
  SuggestAlternatives: z.boolean().optional().default(true).describe("Generate alternative parent suggestions"),
  IncludeConfidenceScores: z.boolean().optional().default(true).describe("Include confidence scores for recommendations"),
  FilterByWorkItemType: z.array(z.string()).optional().describe("Filter analysis to specific work item types (e.g., ['Task', 'Bug'])"),
  ExcludeStates: z.array(z.string()).optional().default(["Done", "Closed", "Removed"]).describe("Exclude work items in these states from analysis"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project)
});

// Configuration and discovery tool schemas
export const getConfigurationSchema = z.object({
  IncludeSensitive: z.boolean().optional().default(false).describe("Include potentially sensitive configuration values"),
  Section: z.enum(["all", "azureDevOps", "gitRepository", "gitHubCopilot"]).optional().default("all").describe("Specific configuration section to retrieve")
});

export const wiqlQuerySchema = z.object({
  WiqlQuery: z.string().describe("WIQL (Work Item Query Language) query string to execute. Example: SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  IncludeFields: z.array(z.string()).optional().describe("Additional fields to include in work item details (default includes Id, Title, Type, State, AreaPath, IterationPath, AssignedTo)"),
  MaxResults: z.number().int().optional().default(200).describe("Maximum number of work items to return (default 200)"),
  IncludeSubstantiveChange: z.boolean().optional().default(false).describe("Include computed fields lastSubstantiveChangeDate and daysInactive for each work item - automatically filters out automated changes like iteration path updates. Minimal overhead: only 2 fields per item."),
  SubstantiveChangeHistoryCount: z.number().int().optional().default(50).describe("Number of revisions to analyze when computing substantive change (default 50)"),
  ComputeMetrics: z.boolean().optional().default(false).describe("Include computed metrics: daysInactive (from changed date), daysSinceCreated, hasDescription (>50 chars), isStale (inactive >180 days)"),
  StaleThresholdDays: z.number().int().optional().default(180).describe("Number of days to consider a work item stale (default 180)")
});

// Full context package retrieval (single work item)
export const workItemContextPackageSchema = z.object({
  WorkItemId: z.number().int().describe("Primary work item ID to retrieve full context for"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  IncludeHistory: z.boolean().optional().default(true).describe("Include recent change history (last 10 changes)"),
  HistoryCount: z.number().int().optional().default(10).describe("Number of recent history entries to include"),
  IncludeComments: z.boolean().optional().default(true).describe("Include work item comments/discussion"),
  IncludeRelations: z.boolean().optional().default(true).describe("Include related links (parent, children, related, attachments, commits, PRs)"),
  IncludeChildren: z.boolean().optional().default(true).describe("Include all child hierarchy (one level) if item is a Feature/Epic"),
  IncludeParent: z.boolean().optional().default(true).describe("Include parent work item details if present"),
  IncludeLinkedPRsAndCommits: z.boolean().optional().default(true).describe("Include linked Git PRs and commits if present in relations"),
  IncludeExtendedFields: z.boolean().optional().default(false).describe("Include extended field set beyond defaults (all system fields + common custom)"),
  IncludeHtml: z.boolean().optional().default(false).describe("Return original HTML field values alongside Markdown/plain text"),
  MaxChildDepth: z.number().int().optional().default(1).describe("Depth of child hierarchy to traverse (1 = immediate children)"),
  MaxRelatedItems: z.number().int().optional().default(50).describe("Maximum number of related items to expand"),
  IncludeAttachments: z.boolean().optional().default(false).describe("Include attachment metadata (names, urls, sizes)"),
  IncludeTags: z.boolean().optional().default(true).describe("Include tags list")
});

// Batch context package retrieval for multiple work items (returns graph)
export const workItemsBatchContextSchema = z.object({
  WorkItemIds: z.array(z.number().int()).min(1).max(50).describe("List of work item IDs to retrieve with relationship context (max 50)"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  IncludeRelations: z.boolean().optional().default(true).describe("Include relationship edges between provided items (parent-child, related, blocks)"),
  IncludeFields: z.array(z.string()).optional().describe("Additional fields to include per work item"),
  IncludeExtendedFields: z.boolean().optional().default(false).describe("Include extended field set beyond defaults"),
  IncludeTags: z.boolean().optional().default(true).describe("Include tags list"),
  IncludeStateCounts: z.boolean().optional().default(true).describe("Return aggregate counts by state and type"),
  IncludeStoryPointAggregation: z.boolean().optional().default(true).describe("Aggregate story points / effort fields if present"),
  IncludeRiskScoring: z.boolean().optional().default(false).describe("Include basic heuristic risk / staleness scoring"),
  IncludeAIAssignmentHeuristic: z.boolean().optional().default(false).describe("Include lightweight AI suitability heuristic (not full analyzer)"),
  IncludeParentOutsideSet: z.boolean().optional().default(true).describe("If an item has a parent not in set, include minimal parent reference"),
  IncludeChildrenOutsideSet: z.boolean().optional().default(false).describe("Include minimal references to children not in requested set"),
  MaxOutsideReferences: z.number().int().optional().default(50).describe("Cap number of outside references added"),
  ReturnFormat: z.enum(["graph", "array"]).optional().default("graph").describe("Return as graph (nodes/edges) or simple array")
});

export const getLastSubstantiveChangeSchema = z.object({
  WorkItemId: z.number().int().describe("Work item ID to analyze"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  HistoryCount: z.number().int().optional().default(50).describe("Number of revisions to analyze (default 50)"),
  AutomatedPatterns: z.array(z.string()).optional().describe("Custom automation account patterns to filter (e.g., ['Bot Name', 'System Account'])")
});

export const bulkStateTransitionSchema = z.object({
  WorkItemIds: z.array(z.number().int()).min(1).max(50).describe("Array of work item IDs to transition (1-50 items)"),
  NewState: z.string().describe("Target state to transition items to (e.g., 'Removed', 'Closed', 'Active')"),
  Comment: z.string().optional().describe("Comment to add to work item history when transitioning"),
  Reason: z.string().optional().describe("Reason for state change (e.g., 'Abandoned', 'Obsolete')"),
  DryRun: z.boolean().optional().default(false).describe("If true, validates transitions without making changes"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const bulkAddCommentsSchema = z.object({
  Items: z.array(z.object({
    WorkItemId: z.number().int().describe("Work item ID to add comment to"),
    Comment: z.string().describe("Comment text to add (supports Markdown)")
  })).min(1).max(50).describe("Array of work items and their comments (1-50 items)"),
  Template: z.string().optional().describe("Comment template with {{variable}} placeholders"),
  TemplateVariables: z.record(z.string()).optional().describe("Variables to substitute in template"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project)
});

export const findStaleItemsSchema = z.object({
  AreaPath: z.string().describe("Area path to search for stale items"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  MinInactiveDays: z.number().int().optional().default(180).describe("Minimum days of inactivity to consider an item stale (default 180)"),
  ExcludeStates: z.array(z.string()).optional().default(['Done', 'Completed', 'Closed', 'Resolved', 'Removed']).describe("States to exclude from search"),
  IncludeSubAreas: z.boolean().optional().default(true).describe("Include items from sub-area paths"),
  WorkItemTypes: z.array(z.string()).optional().default([]).describe("Filter by specific work item types (empty = all types)"),
  MaxResults: z.number().int().optional().default(200).describe("Maximum number of results to return"),
  IncludeSubstantiveChange: z.boolean().optional().default(true).describe("Include substantive change analysis for more accurate staleness detection"),
  IncludeSignals: z.boolean().optional().default(true).describe("Include signals explaining why each item is considered stale")
});

export const detectPatternsSchema = z.object({
  WorkItemIds: z.array(z.number().int()).optional().describe("Specific work item IDs to analyze (if not provided, uses AreaPath)"),
  AreaPath: z.string().optional().describe("Area path to search for work items (if WorkItemIds not provided)"),
  Organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  Project: z.string().optional().default(() => cfg().azureDevOps.project),
  Patterns: z.array(z.enum(['duplicates', 'placeholder_titles', 'orphaned_children', 'unassigned_committed', 'stale_automation', 'no_description'])).optional().default(['duplicates', 'placeholder_titles', 'unassigned_committed', 'no_description']).describe("Patterns to detect"),
  MaxResults: z.number().int().optional().default(200).describe("Maximum number of results when using AreaPath"),
  IncludeSubAreas: z.boolean().optional().default(true).describe("Include sub-area paths when using AreaPath")
});





