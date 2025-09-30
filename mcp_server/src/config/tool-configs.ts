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
  discoverAreaPathsSchema,
  discoverIterationPathsSchema,
  discoverRepositoriesSchema,
  discoverWorkItemTypesSchema
} from "./schemas.js";
import { z } from 'zod';
import { getRedactedConfig } from './config-manager.js';

/**
 * Tool configuration registry to eliminate repetitive switch/case & schema duplication
 */
export const toolConfigs: ToolConfig[] = [
  {
    name: "wit-show-config",
    description: "Display the effective merged configuration (redacted)",
    script: "", // no script; handled internally
    schema: z.object({}),
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: "wit-create-new-item",
    description: "Create a new Azure DevOps work item with optional parent relationship",
    script: "New-WorkItemWithParent-MCP.ps1",
    schema: createNewItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Title of the work item (mandatory)" },
        WorkItemType: { type: "string", description: "Azure DevOps work item type, e.g. 'Task', 'Product Backlog Item', 'Bug'" },
        ParentWorkItemId: { type: "number", description: "Optional parent work item ID" },
        Description: { type: "string", description: "Markdown description / repro steps" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        AreaPath: { type: "string", description: "Area path override" },
        IterationPath: { type: "string", description: "Iteration path override" },
        AssignedTo: { type: "string", description: "User email or @me for current user" },
        Priority: { type: "number", description: "Priority (default 2)" },
        Tags: { type: "string", description: "Semicolon or comma separated tags" },
        InheritParentPaths: { type: "boolean", description: "Inherit Area/Iteration from parent if not supplied" }
      },
      required: ["Title"]
    }
  },
  {
    name: "wit-assign-to-copilot",
    description: "Assign an existing Azure DevOps work item to GitHub Copilot and add branch link",
    script: "Assign-ItemToCopilot-MCP.ps1",
    schema: assignToCopilotSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemId: { type: "number", description: "Existing work item ID to assign" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        Repository: { type: "string", description: "Git repository name (required)" },
        Branch: { type: "string", description: "Git branch name" },
        GitHubCopilotGuid: { type: "string", description: "GitHub Copilot GUID" }
      },
      required: ["WorkItemId", "Repository"]
    }
  },
  {
    name: "wit-new-copilot-item",
    description: "Create a new Azure DevOps work item under a parent and immediately assign to GitHub Copilot",
    script: "New-WorkItemAndAssignToCopilot-MCP.ps1",
    schema: newCopilotItemSchema,
    inputSchema: {
      type: "object",
      properties: {
        Title: { type: "string", description: "Title of the work item" },
        ParentWorkItemId: { type: "number", description: "Parent work item ID under which to create the new item" },
        WorkItemType: { type: "string", description: "Azure DevOps work item type" },
        Description: { type: "string", description: "Markdown description" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        Repository: { type: "string", description: "Git repository name (required)" },
        Branch: { type: "string", description: "Git branch name" },
        GitHubCopilotGuid: { type: "string", description: "GitHub Copilot GUID" },
        AreaPath: { type: "string", description: "Area path override" },
        IterationPath: { type: "string", description: "Iteration path override" },
        Priority: { type: "number", description: "Priority level" },
        Tags: { type: "string", description: "Semicolon or comma separated tags" },
        InheritParentPaths: { type: "boolean", description: "Inherit Area/Iteration from parent" }
      },
      required: ["Title", "ParentWorkItemId", "Repository"]
    }
  },
  {
    name: "wit-extract-security-links",
    description: "Extract instruction links from security scan work items",
    script: "Extract-SecurityInstructionLinks-MCP.ps1",
    schema: extractSecurityLinksSchema,
    inputSchema: {
      type: "object",
      properties: {
        WorkItemId: { type: "number", description: "Azure DevOps work item ID to extract instruction links from" },
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
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
    description: "Enhanced AI assignment suitability analysis with detailed reasoning and confidence scoring using VS Code sampling",
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
        Project: { type: "string", description: "Azure DevOps project name" },
        AutoAssignToAI: { type: "boolean", description: "Automatically assign to AI if suitable" },
        WorkItemId: { type: "number", description: "Existing work item ID if updating existing item" }
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
        Section: { type: "string", enum: ["all", "azureDevOps", "gitRepository", "gitHubCopilot", "toolBehavior", "security"], description: "Specific configuration section to retrieve" }
      },
      required: []
    }
  },
  {
    name: "wit-discover-area-paths",
    description: "Discover available area paths from Azure DevOps project to help agents choose appropriate paths for work item creation",
    script: "", // Handled internally  
    schema: discoverAreaPathsSchema,
    inputSchema: {
      type: "object",
      properties: {
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        IncludeChildPaths: { type: "boolean", description: "Include all child area paths" },
        MaxDepth: { type: "number", description: "Maximum depth to traverse for area paths" }
      },
      required: []
    }
  },
  {
    name: "wit-discover-iteration-paths", 
    description: "Discover available iteration paths from Azure DevOps project to help agents choose appropriate iterations for work item planning",
    script: "", // Handled internally
    schema: discoverIterationPathsSchema,
    inputSchema: {
      type: "object",
      properties: {
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        IncludeChildPaths: { type: "boolean", description: "Include all child iteration paths" },
        MaxDepth: { type: "number", description: "Maximum depth to traverse for iteration paths" },
        IncludeCompleted: { type: "boolean", description: "Include completed/past iterations" }
      },
      required: []
    }
  },
  {
    name: "wit-discover-repositories",
    description: "Discover available Git repositories in the Azure DevOps project to help agents link work items to correct repositories", 
    script: "", // Handled internally
    schema: discoverRepositoriesSchema,
    inputSchema: {
      type: "object",
      properties: {
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        IncludeBranches: { type: "boolean", description: "Include branch information for each repository" },
        MaxRepositories: { type: "number", description: "Maximum number of repositories to return" }
      },
      required: []
    }
  },
  {
    name: "wit-discover-work-item-types",
    description: "Discover available work item types and their properties from Azure DevOps project to help agents choose appropriate types and understand available fields",
    script: "", // Handled internally
    schema: discoverWorkItemTypesSchema,
    inputSchema: {
      type: "object",
      properties: {
        Organization: { type: "string", description: "Azure DevOps organization name" },
        Project: { type: "string", description: "Azure DevOps project name" },
        IncludeFields: { type: "boolean", description: "Include available fields for each work item type" },
        IncludeStates: { type: "boolean", description: "Include available states for each work item type" }
      },
      required: []
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