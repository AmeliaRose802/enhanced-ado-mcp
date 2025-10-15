import type { ToolConfig } from "../../types/index.js";
import {
  workItemIntelligenceSchema,
  aiAssignmentAnalyzerSchema,
  personalWorkloadAnalyzerSchema,
  sprintPlanningAnalyzerSchema,
  generateODataQuerySchema,
  unifiedQueryGeneratorSchema,
  toolDiscoverySchema
} from "../schemas.js";

/**
 * AI Analysis Tools
 * AI-powered analysis tools for intelligence, assignment suitability, and discovery
 */
export const aiAnalysisTools: ToolConfig[] = [
  {
    name: "wit-intelligence-analyzer",
    description: "AI-powered work item analysis for completeness, AI-readiness, enhancement suggestions, and smart categorization using VS Code sampling",
    script: "",
    schema: workItemIntelligenceSchema,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Work item title to analyze" },
        description: { type: "string", description: "Work item description/content to analyze" },
        workItemType: { type: "string", description: "Type of work item (Task, Bug, PBI, etc.)" },
        acceptanceCriteria: { type: "string", description: "Current acceptance criteria if any" },
        analysisType: { type: "string", enum: ["completeness", "ai-readiness", "enhancement", "categorization", "full"], description: "Type of analysis to perform" },
        contextInfo: { type: "string", description: "Additional context about the project, team, or requirements" },
        enhanceDescription: { type: "boolean", description: "Generate an enhanced, AI-ready description" },
        createInADO: { type: "boolean", description: "Automatically create the enhanced item in Azure DevOps" },
        parentWorkItemId: { type: "number", description: "Parent work item ID if creating in ADO" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["title"]
    }
  },
  {
    name: "wit-ai-assignment-analyzer",
    description: "Enhanced AI assignment suitability analysis with detailed reasoning and confidence scoring using VS Code sampling. Automatically retrieves work item details from Azure DevOps. This tool provides analysis only - use wit-assign-to-copilot separately to perform the assignment.",
    script: "",
    schema: aiAssignmentAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Azure DevOps work item ID to analyze for AI assignment suitability" },
        outputFormat: { type: "string", enum: ["detailed", "json"], description: "Output format: 'detailed' (default, comprehensive analysis) or 'json' (structured JSON for programmatic use)" }
      },
      required: ["workItemId"]
    }
  },
  {
    name: "wit-personal-workload-analyzer",
    description: "AI-powered personal workload analysis to assess burnout risk, overspecialization, work-life balance issues, and professional health indicators for an individual over a time period. Automatically fetches completed and active work, calculates metrics, and provides actionable insights. Supports optional custom analysis intent (e.g., 'assess readiness for promotion', 'check for career growth opportunities'). Requires VS Code sampling support.",
    script: "",
    schema: personalWorkloadAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        assignedToEmail: { type: "string", description: "Email address of the person to analyze (e.g., user@domain.com)" },
        analysisPeriodDays: { type: "number", description: "Number of days to analyze backwards from today (default 90, min 7, max 365)" },
        additionalIntent: { type: "string", description: "Optional custom analysis intent (e.g., 'check for career growth opportunities', 'assess readiness for promotion', 'evaluate technical skill development')" },
        organization: { type: "string", description: "Azure DevOps organization name (uses configured default if not provided)" },
        project: { type: "string", description: "Azure DevOps project name (uses configured default if not provided)" },
        areaPath: { type: "string", description: "Area path to filter work items (uses configured default if not provided)" }
      },
      required: ["assignedToEmail"]
    }
  },
  {
    name: "wit-sprint-planning-analyzer",
    description: "🤖 AI-POWERED SPRINT PLANNING: Analyze team capacity, historical velocity, and propose optimal work assignments for a sprint. Considers team member skills, workload balance, dependencies, and historical performance to create a balanced sprint plan with confidence scoring and risk assessment.",
    script: "",
    schema: sprintPlanningAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        iterationPath: { type: "string", description: "Target iteration/sprint path (e.g., 'Project\\Sprint 10')" },
        teamMembers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string", description: "Team member email address" },
              name: { type: "string", description: "Team member display name" },
              capacityHours: { type: "number", description: "Available capacity in hours for this sprint (default 60)" },
              skills: { type: "array", items: { type: "string" }, description: "Team member skills/specializations" },
              preferredWorkTypes: { type: "array", items: { type: "string" }, description: "Preferred work item types" }
            },
            required: ["email", "name"]
          },
          description: "Team members participating in the sprint"
        },
        sprintCapacityHours: { type: "number", description: "Total team capacity in hours (overrides individual capacities)" },
        historicalSprintsToAnalyze: { type: "number", description: "Number of previous sprints to analyze for velocity (default 3, max 10)" },
        candidateWorkItemIds: { type: "array", items: { type: "number" }, description: "Work item IDs to consider for sprint assignment" },
        considerDependencies: { type: "boolean", description: "Consider work item dependencies in planning (default true)" },
        considerSkills: { type: "boolean", description: "Match work items to team member skills (default true)" },
        additionalConstraints: { type: "string", description: "Additional planning constraints (e.g., 'prioritize bugs', 'balance frontend/backend')" },
        organization: { type: "string", description: "Azure DevOps organization (uses config default if not provided)" },
        project: { type: "string", description: "Azure DevOps project (uses config default if not provided)" },
        areaPath: { type: "string", description: "Area path to filter work items (uses config default if not provided)" }
      },
      required: ["iterationPath", "teamMembers"]
    }
  },
  {
    name: "wit-generate-odata-query",
    description: "🤖 AI-POWERED: Generate valid OData Analytics queries from natural language descriptions with iterative validation. Automatically tests and refines queries for metrics, aggregations, and analytics. Can optionally return a query handle for safe bulk operations. organization, project, areaPath, and iterationPath are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: generateODataQuerySchema,
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Natural language description of analytics query (e.g., 'count active bugs by assignee', 'velocity metrics for last sprint')" },
        maxIterations: { type: "number", description: "Maximum attempts to generate valid query (1-5, default 3)" },
        includeExamples: { type: "boolean", description: "Include example patterns in prompt (default true)" },
        testQuery: { type: "boolean", description: "Test query by executing it (default true)" },
        returnQueryHandle: { type: "boolean", description: "Execute query and return handle for bulk operations (prevents ID hallucination, default false)" },
        maxResults: { type: "number", description: "Maximum work items to fetch when returnQueryHandle=true (1-1000, default 200)" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include when returnQueryHandle=true" },
        areaPath: { type: "string", description: "Override default area path from config (automatically scopes queries to configured area)" },
        iterationPath: { type: "string", description: "Override default iteration path from config" }
      },
      required: ["description"]
    }
  },
  {
    name: "wit-generate-query",
    description: "🤖 AI-POWERED UNIFIED QUERY GENERATOR: Intelligently generates either WIQL or OData queries based on your request. Analyzes query characteristics and automatically selects the optimal format (WIQL for hierarchies and lists, OData for analytics and aggregations). Includes iterative validation and can return query handles for safe bulk operations. organization, project, areaPath, and iterationPath are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: unifiedQueryGeneratorSchema,
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Natural language description of query (e.g., 'Find all active bugs' or 'Count work items by state')" },
        maxIterations: { type: "number", description: "Maximum attempts to generate valid query (1-5, default 3)" },
        includeExamples: { type: "boolean", description: "Include example patterns in prompt (default true)" },
        testQuery: { type: "boolean", description: "Test query by executing it (default true)" },
        returnQueryHandle: { type: "boolean", description: "Execute query and return handle for bulk operations (prevents ID hallucination, default true)" },
        maxResults: { type: "number", description: "Maximum work items to fetch when returnQueryHandle=true (1-1000, default 200)" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include when returnQueryHandle=true" },
        areaPath: { type: "string", description: "Override default area path from config (automatically scopes queries to configured area)" },
        iterationPath: { type: "string", description: "Override default iteration path from config" }
      },
      required: ["description"]
    }
  },
  {
    name: "wit-discover-tools",
    description: "🤖 AI-POWERED TOOL DISCOVERY: Find the right tools for your task using natural language. Analyzes your intent and recommends the most appropriate tools from the MCP server with confidence scores, usage examples, and workflow guidance. Perfect when you're not sure which tool to use.",
    script: "",
    schema: toolDiscoverySchema,
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "Natural language description of what you want to accomplish (e.g., 'I want to find all stale bugs and update their priority')" },
        context: { type: "string", description: "Additional context about your project, team, or specific requirements" },
        maxRecommendations: { type: "number", description: "Maximum number of tool recommendations to return (1-10, default 3)" },
        includeExamples: { type: "boolean", description: "Include detailed usage examples for each recommended tool (default false, saves ~100-300 tokens per tool)" },
        filterCategory: { 
          type: "string", 
          enum: ["creation", "analysis", "bulk-operations", "query", "ai-powered", "all"],
          description: "Filter recommendations to specific category: creation (create/new items), analysis (analyze/detect/validate), bulk-operations (bulk updates), query (WIQL/OData), ai-powered (AI tools), all (no filter, default)"
        }
      },
      required: ["intent"]
    }
  }
];
