import type { ToolConfig } from "../../types/index.js";
import {
  personalWorkloadAnalyzerSchema,
  sprintPlanningAnalyzerSchema,
  toolDiscoverySchema,
  aiQueryAnalysisSchema
} from "../schemas.js";

/**
 * AI Analysis Tools
 * AI-powered analysis tools for intelligence, assignment suitability, and discovery
 */
export const aiAnalysisTools: ToolConfig[] = [
  {
    name: "analyze-workload",
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
    name: "plan-sprint",
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
        areaPath: { type: "string", description: "Area path to filter work items (uses config default if not provided)" },
        areaPathFilter: { type: "array", items: { type: "string" }, description: "Explicitly specify area paths to filter by (e.g., ['ProjectA\\\\TeamAlpha', 'ProjectA\\\\TeamBeta']). Takes precedence over single areaPath and config defaults. Use when planning sprints across multiple configured area paths." }
      },
      required: ["iterationPath", "teamMembers"]
    }
  },
  {
    name: "discover-tools",
    description: "🤖 AI-POWERED TOOL DISCOVERY: Find the right tools for your task using natural language OR list all available tools. When listAll=true, returns a concise inventory of all tools. When listAll=false (default), analyzes your intent and recommends the most appropriate tools with confidence scores and workflow guidance. Perfect when you're not sure which tool to use.",
    script: "",
    schema: toolDiscoverySchema,
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "Natural language description of what you want to accomplish (e.g., 'I want to find all stale bugs and update their priority'). Required unless listAll=true." },
        listAll: { type: "boolean", description: "List all available tools without AI analysis (default false). When true, returns concise tool inventory instead of recommendations." },
        context: { type: "string", description: "Additional context about your project, team, or specific requirements (only used when listAll=false)" },
        maxRecommendations: { type: "number", description: "Maximum number of tool recommendations to return (1-10, default 3, only used when listAll=false)" },
        includeExamples: { type: "boolean", description: "Include detailed usage examples for each recommended tool (default false, saves ~100-300 tokens per tool, only used when listAll=false)" },
        filterCategory: { 
          type: "string", 
          enum: ["creation", "analysis", "bulk-operations", "query", "ai-powered", "all"],
          description: "Filter tools by category: creation (create/new items), analysis (analyze/detect/validate), bulk-operations (bulk updates), query (WIQL/OData), ai-powered (AI tools), all (no filter, default)"
        }
      },
      required: []
    }
  },
  {
    name: "analyze-query-handle",
    description: "🤖 AI-POWERED INTELLIGENT ANALYSIS: Perform custom AI-powered analysis on work items in a query handle using natural language intent. Accepts any analysis request (e.g., 'find work items ready for deployment', 'identify items needing more detail', 'assess technical debt risk'). Retrieves full context packages and provides intelligent, concise analysis based on your intent. Perfect for complex analysis requiring intelligence, not simple deterministic checks. Requires VS Code sampling support.",
    script: "",
    schema: aiQueryAnalysisSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle containing work items to analyze (prevents ID hallucination)" },
        intent: { type: "string", description: "Natural language description of the analysis you want (e.g., 'find items that are blockers for the release', 'identify work items with insufficient technical detail', 'assess readiness for AI assignment')" },
        itemSelector: { 
          description: "Item selection: 'all', array of IDs, or selection criteria object" 
        },
        maxItemsToAnalyze: { type: "number", description: "Maximum items to analyze (1-100, default 50)" },
        includeContextPackages: { type: "boolean", description: "Retrieve full context packages for deeper analysis (default true)" },
        contextDepth: { type: "string", enum: ["basic", "standard", "deep"], description: "Context detail level: basic (fields only), standard (default, with relations/comments), deep (full history)" },
        outputFormat: { type: "string", enum: ["concise", "detailed", "json"], description: "Output format: concise (brief), detailed (comprehensive), json (structured)" },
        confidenceThreshold: { type: "number", description: "Minimum confidence for recommendations (0-1, default 0.0)" },
        temperature: { type: "number", description: "AI temperature (0-2, default 0.3 for factual)" },
        organization: { type: "string", description: "Azure DevOps organization (uses config default if not provided)" },
        project: { type: "string", description: "Azure DevOps project (uses config default if not provided)" }
      },
      required: ["queryHandle", "intent"]
    }
  }
];
