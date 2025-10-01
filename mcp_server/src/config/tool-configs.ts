import type { ToolConfig, Tool } from "../types/index.js";
import {
  createNewItemSchema,
  assignToCopilotSchema,
  newCopilotItemSchema,
  extractSecurityLinksSchema,
  workItemIntelligenceSchema,
  aiAssignmentAnalyzerSchema,
  featureDecomposerSchema,
  hierarchyValidatorSchema,
  getConfigurationSchema,
  wiqlQuerySchema
  , workItemContextPackageSchema, workItemsBatchContextSchema
} from "./schemas.js";
import { z } from 'zod';

/**
 * Tool configuration registry to eliminate repetitive switch/case & schema duplication
 */
export const toolConfigs: ToolConfig[] = [
  {
    name: "wit-create-new-item",
    description: "Create a new Azure DevOps work item with optional parent relationship. Organization, Project, WorkItemType, Priority, AssignedTo, AreaPath, IterationPath, and InheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: createNewItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Title of the work item (mandatory)" },
        ParentWorkItemId: { type: "number", description: "Optional parent work item ID" },
        Description: { type: "string", description: "Markdown description / repro steps" },
        Tags: { type: "string", description: "Semicolon or comma separated tags" },
        // Optional overrides (auto-filled from config if not provided)
        WorkItemType: { type: "string", description: "Override default work item type from config" },
        AreaPath: { type: "string", description: "Override default area path from config" },
        IterationPath: { type: "string", description: "Override default iteration path from config" },
        AssignedTo: { type: "string", description: "Override default assignee from config" },
        Priority: { type: "number", description: "Override default priority from config" }
      },
      required: ["Title"]
    }
  },
  {
    name: "wit-get-work-item-context-package",
    description: "Retrieve a comprehensive context package for a single work item including core fields, description, acceptance criteria, parent, children, related links, comments, recent history, and optionally PRs/commits and attachments in one call.",
    script: "", // Handled internally
    schema: workItemContextPackageSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemId: { type: "number", description: "Primary work item ID to retrieve full context for" },
        IncludeHistory: { type: "boolean", description: "Include recent change history (last 10 changes)" },
        HistoryCount: { type: "number", description: "Number of recent history entries to include" },
        IncludeComments: { type: "boolean", description: "Include work item comments/discussion" },
        IncludeRelations: { type: "boolean", description: "Include related links (parent, children, related, attachments, commits, PRs)" },
        IncludeChildren: { type: "boolean", description: "Include all child hierarchy (one level) if item is a Feature/Epic" },
        IncludeParent: { type: "boolean", description: "Include parent work item details if present" },
        IncludeLinkedPRsAndCommits: { type: "boolean", description: "Include linked Git PRs and commits if present in relations" },
        IncludeExtendedFields: { type: "boolean", description: "Include extended field set beyond defaults" },
        IncludeHtml: { type: "boolean", description: "Return original HTML field values alongside Markdown/plain text" },
        MaxChildDepth: { type: "number", description: "Depth of child hierarchy to traverse (1 = immediate children)" },
        MaxRelatedItems: { type: "number", description: "Maximum number of related items to expand" },
        IncludeAttachments: { type: "boolean", description: "Include attachment metadata (names, urls, sizes)" },
        IncludeTags: { type: "boolean", description: "Include tags list" }
      },
      required: ["WorkItemId"]
    }
  },
  {
    name: "wit-get-work-items-context-batch",
    description: "Retrieve multiple work items (10-50) with relationship graph, aggregate metrics, and optional heuristic scoring in one call.",
    script: "", // Handled internally
    schema: workItemsBatchContextSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemIds: { type: "array", items: { type: "number" }, description: "List of work item IDs (max 50)" },
        IncludeRelations: { type: "boolean", description: "Include relationship edges between provided items" },
        IncludeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include per work item" },
        IncludeExtendedFields: { type: "boolean", description: "Include extended field set beyond defaults" },
        IncludeTags: { type: "boolean", description: "Include tags list" },
        IncludeStateCounts: { type: "boolean", description: "Return aggregate counts by state and type" },
        IncludeStoryPointAggregation: { type: "boolean", description: "Aggregate story points / effort fields if present" },
        IncludeRiskScoring: { type: "boolean", description: "Include basic heuristic risk / staleness scoring" },
        IncludeAIAssignmentHeuristic: { type: "boolean", description: "Include lightweight AI suitability heuristic" },
        IncludeParentOutsideSet: { type: "boolean", description: "Include minimal parent references outside requested set" },
        IncludeChildrenOutsideSet: { type: "boolean", description: "Include minimal child references outside requested set" },
        MaxOutsideReferences: { type: "number", description: "Cap number of outside references added" },
        ReturnFormat: { type: "string", enum: ["graph", "array"], description: "Return as graph (nodes/edges) or simple array" }
      },
      required: ["WorkItemIds"]
    }
  },
  {
    name: "wit-assign-to-copilot",
    description: "Assign an existing Azure DevOps work item to GitHub Copilot and add branch link. Organization, Project, Branch, and GitHubCopilotGuid are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: assignToCopilotSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemId: { type: "number", description: "Existing work item ID to assign" },
        Repository: { type: "string", description: "Git repository name (required)" },
        // Optional overrides (auto-filled from config if not provided)
        Branch: { type: "string", description: "Override default branch from config" },
        GitHubCopilotGuid: { type: "string", description: "Override default GitHub Copilot GUID from config" }
      },
      required: ["WorkItemId", "Repository"]
    }
  },
  {
    name: "wit-new-copilot-item",
    description: "Create a new Azure DevOps work item under a parent and immediately assign to GitHub Copilot. Organization, Project, WorkItemType, Branch, GitHubCopilotGuid, AreaPath, IterationPath, Priority, and InheritParentPaths are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: newCopilotItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Title of the work item" },
        ParentWorkItemId: { type: "number", description: "Parent work item ID under which to create the new item" },
        Repository: { type: "string", description: "Git repository name (required)" },
        Description: { type: "string", description: "Markdown description" },
        Tags: { type: "string", description: "Semicolon or comma separated tags" },
        // Optional overrides (auto-filled from config if not provided)
        WorkItemType: { type: "string", description: "Override default work item type from config" },
        Branch: { type: "string", description: "Override default branch from config" },
        GitHubCopilotGuid: { type: "string", description: "Override default GitHub Copilot GUID from config" },
        AreaPath: { type: "string", description: "Override default area path from config" },
        IterationPath: { type: "string", description: "Override default iteration path from config" },
        Priority: { type: "number", description: "Override default priority from config" }
      },
      required: ["Title", "ParentWorkItemId", "Repository"]
    }
  },
  {
    name: "wit-extract-security-links",
    description: "Extract instruction links from security scan work items. Organization and Project are automatically filled from configuration - only provide them to override defaults.",
    script: "", // Handled internally with REST API
    schema: extractSecurityLinksSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemId: { type: "number", description: "Azure DevOps work item ID to extract instruction links from" },
        ScanType: { type: "string", enum: ["BinSkim", "CodeQL", "CredScan", "General", "All"], description: "Type of security scanner to filter links for" },
        IncludeWorkItemDetails: { type: "boolean", description: "Include detailed work item information in the response" },
        ExtractFromComments: { type: "boolean", description: "Also extract links from work item comments" },
        DryRun: { type: "boolean", description: "Run in dry-run mode without making actual API calls" }
      },
      required: ["WorkItemId"]
    }
  },
  {
    name: "wit-intelligence-analyzer",
    description: "AI-powered work item analysis for completeness, AI-readiness, enhancement suggestions, and smart categorization using VS Code sampling",
    script: "", // Handled internally with sampling
    schema: workItemIntelligenceSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Work item title to analyze" },
        Description: { type: "string", description: "Work item description/content to analyze" },
        WorkItemType: { type: "string", description: "Type of work item (Task, Bug, PBI, etc.)" },
        AcceptanceCriteria: { type: "string", description: "Current acceptance criteria if any" },
        AnalysisType: { type: "string", enum: ["completeness", "ai-readiness", "enhancement", "categorization", "full"], description: "Type of analysis to perform" },
        ContextInfo: { type: "string", description: "Additional context about the project, team, or requirements" },
        EnhanceDescription: { type: "boolean", description: "Generate an enhanced, AI-ready description" },
        CreateInADO: { type: "boolean", description: "Automatically create the enhanced item in Azure DevOps" },
        ParentWorkItemId: { type: "number", description: "Parent work item ID if creating in ADO" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["Title"]
    }
  },
  {
    name: "wit-ai-assignment-analyzer",
    description: "Enhanced AI assignment suitability analysis with detailed reasoning and confidence scoring using VS Code sampling. This tool provides analysis only - use wit-assign-to-copilot separately to perform the assignment.",
    script: "", // Handled internally with sampling
    schema: aiAssignmentAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Work item title to analyze for AI assignment suitability" },
        Description: { type: "string", description: "Work item description/content to analyze" },
        WorkItemType: { type: "string", description: "Type of work item (Task, Bug, Feature, etc.)" },
        AcceptanceCriteria: { type: "string", description: "Acceptance criteria if available" },
        Priority: { type: "string", description: "Priority level (Critical, High, Medium, Low)" },
        Labels: { type: "string", description: "Comma-separated labels or tags" },
        EstimatedFiles: { type: "string", description: "Estimated number of files that might be touched" },
        TechnicalContext: { type: "string", description: "Technical context: languages, frameworks, architectural areas" },
        ExternalDependencies: { type: "string", description: "External dependencies or approvals needed" },
        TimeConstraints: { type: "string", description: "Deadline or time constraints" },
        RiskFactors: { type: "string", description: "Known risk factors or sensitive areas" },
        TestingRequirements: { type: "string", description: "Testing requirements and existing coverage" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["Title"]
    }
  },
  {
    name: "wit-feature-decomposer",
    description: "Intelligently decompose large features into smaller, assignable work items with AI suitability analysis using VS Code sampling",
    script: "", // Handled internally with sampling
    schema: featureDecomposerSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Feature title to decompose into smaller work items" },
        Description: { type: "string", description: "Feature description with requirements and context" },
        ParentWorkItemId: { type: "number", description: "Parent work item ID to create child items under" },
        WorkItemType: { type: "string", description: "Type of work items to create (Task, User Story, etc.)" },
        TargetComplexity: { type: "string", enum: ["simple", "medium"], description: "Target complexity for generated work items" },
        MaxItems: { type: "number", description: "Maximum number of work items to generate" },
        TechnicalContext: { type: "string", description: "Technical context: architecture, frameworks, constraints" },
        BusinessContext: { type: "string", description: "Business context: user needs, goals, success criteria" },
        ExistingComponents: { type: "string", description: "Existing components or systems to consider" },
        Dependencies: { type: "string", description: "Known dependencies or integration points" },
        TimeConstraints: { type: "string", description: "Timeline or milestone constraints" },
        QualityRequirements: { type: "string", description: "Quality, performance, or security requirements" },
        GenerateAcceptanceCriteria: { type: "boolean", description: "Generate acceptance criteria for each work item" },
        AnalyzeAISuitability: { type: "boolean", description: "Analyze AI assignment suitability for each item" },
        AutoCreateWorkItems: { type: "boolean", description: "Automatically create work items in Azure DevOps" },
        AutoAssignAISuitable: { type: "boolean", description: "Automatically assign AI-suitable items to GitHub Copilot" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        AreaPath: { type: "string", description: "Area path for created work items" },
        IterationPath: { type: "string", description: "Iteration path for created work items" },
        Tags: { type: "string", description: "Additional tags to apply to created work items" }
      },
      required: ["Title"]
    }
  },
  {
    name: "wit-hierarchy-validator",
    description: "Analyze work item parent-child relationships and provide intelligent parenting suggestions using VS Code sampling",
    script: "", // Handled internally with sampling
    schema: hierarchyValidatorSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemIds: { type: "array", items: { type: "number" }, description: "Specific work item IDs to validate (if not provided, will analyze area path)" },
        AreaPath: { type: "string", description: "Area path to analyze all work items within (used if WorkItemIds not provided)" },
        IncludeChildAreas: { type: "boolean", description: "Include child area paths in analysis" },
        MaxItemsToAnalyze: { type: "number", description: "Maximum number of work items to analyze" },
        AnalysisDepth: { type: "string", enum: ["shallow", "deep"], description: "Analysis depth: shallow (basic) or deep (comprehensive with content analysis)" },
        SuggestAlternatives: { type: "boolean", description: "Generate alternative parent suggestions" },
        IncludeConfidenceScores: { type: "boolean", description: "Include confidence scores for recommendations" },
        FilterByWorkItemType: { type: "array", items: { type: "string" }, description: "Filter analysis to specific work item types" },
        ExcludeStates: { type: "array", items: { type: "string" }, description: "Exclude work items in these states from analysis" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" }
      },
      required: []
    }
  },
  // Configuration and Discovery Tools
  {
    name: "wit-get-configuration",
    description: "Get current MCP server configuration including area paths, repositories, GitHub Copilot settings, and other defaults that agents can use for work item creation",
    script: "", // Handled internally
    schema: getConfigurationSchema,
    inputSchema: {
      type: "object",
      properties: {
        IncludeSensitive: { type: "boolean", description: "Include potentially sensitive configuration values" },
        Section: { type: "string", enum: ["all", "azureDevOps", "gitRepository", "gitHubCopilot"], description: "Specific configuration section to retrieve" }
      },
      required: []
    }
  },
  {
    name: "wit-get-work-items-by-query-wiql",
    description: "Query Azure DevOps work items using WIQL (Work Item Query Language). Supports complex queries with filtering, sorting, and field selection. Returns work item details including Id, Title, Type, State, and any requested additional fields.",
    script: "", // Handled internally
    schema: wiqlQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        WiqlQuery: { type: "string", description: "WIQL query string. Examples: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'' or 'SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'ProjectName\\AreaName' ORDER BY [System.ChangedDate] DESC'" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        IncludeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include (e.g., 'System.Description', 'Microsoft.VSTS.Common.Priority')" },
        MaxResults: { type: "number", description: "Maximum number of results to return (default 200)" }
      },
      required: ["WiqlQuery"]
    }
  }
];

/**
 * Export as Tool[] for MCP listing
 */
export const tools: Tool[] = toolConfigs.map(tc => ({
  name: tc.name,
  description: tc.description,
  inputSchema: tc.inputSchema
}));