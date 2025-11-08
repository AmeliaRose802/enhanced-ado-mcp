import type { ToolConfig } from "../../types/index.js";
import {
  personalWorkloadAnalyzerSchema,
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
    description: "AI-powered workload analysis to assess burnout risk, overspecialization, work-life balance issues, and professional health indicators. Accepts EITHER a single email (for individual analysis) OR an array of emails (for batch team analysis). When analyzing multiple people, processes up to 20 team members concurrently with configurable concurrency (default 5) and returns individual analyses plus team-level metrics (average health score, health distribution, top concerns). Automatically fetches completed and active work, calculates metrics, and provides actionable insights. Supports optional custom analysis intent (e.g., 'assess readiness for promotion', 'check for career growth opportunities'). Requires VS Code sampling support.",
    script: "",
    schema: personalWorkloadAnalyzerSchema,
    inputSchema: {
      type: "object",
      properties: {
        assignedToEmail: { 
          oneOf: [
            { type: "string", description: "Single email address to analyze (e.g., 'user@domain.com')" },
            { type: "array", items: { type: "string" }, description: "Array of email addresses for batch analysis (1-20 people, e.g., ['user1@domain.com', 'user2@domain.com'])" }
          ],
          description: "Email address(es) of person/people to analyze. Provide a single string for individual analysis or an array for batch team analysis."
        },
        analysisPeriodDays: { type: "number", description: "Number of days to analyze backwards from today (default 90, min 7, max 365)" },
        additionalIntent: { type: "string", description: "Optional custom analysis intent (e.g., 'check for career growth opportunities', 'assess readiness for promotion', 'evaluate technical skill development'). Applied to all team members in batch mode." },
        continueOnError: { type: "boolean", description: "[Batch mode only] Continue analyzing remaining people if one fails (default true)" },
        maxConcurrency: { type: "number", description: "[Batch mode only] Maximum concurrent analyses (1-10, default 5). Lower values reduce API load." },
        organization: { type: "string", description: "Azure DevOps organization name (uses configured default if not provided)" },
        project: { type: "string", description: "Azure DevOps project name (uses configured default if not provided)" },
        areaPath: { type: "string", description: "Area path to filter work items (uses configured default if not provided)" }
      },
      required: ["assignedToEmail"]
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
