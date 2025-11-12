import type { ToolConfig } from "../../types/index.js";
import {
  analyzeByQueryHandleSchema,
  listQueryHandlesSchema,
  queryHandleInfoSchema,
  getContextPackagesByQueryHandleSchema
} from "../schemas.js";

/**
 * Query Handle Tools
 * Tools for managing and inspecting query handles
 */
export const queryHandleTools: ToolConfig[] = [
  {
    name: "analyze-bulk",
    description: "🔐 HANDLE-BASED ANALYSIS: Unified analysis tool for work items using query handles. Prevents ID hallucination in analysis workflows. Supports: effort (Story Points), velocity (completion trends), assignments (team workload), risks (blockers/stale), completion (state distribution), priorities (priority breakdown), hierarchy (parent-child validation), work-item-intelligence (AI-powered completeness/enhancement analysis), assignment-suitability (Copilot assignment readiness), and parent-recommendation (intelligent parent matching). Forces safe analysis patterns.",
    script: "",
    schema: analyzeByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query (ensures analysis is based on real query results, not hallucinated IDs)" },
        analysisType: { 
          type: "array", 
          items: { 
            type: "string", 
            enum: ["effort", "velocity", "assignments", "risks", "completion", "priorities", "hierarchy", "work-item-intelligence", "assignment-suitability", "parent-recommendation"] 
          },
          description: "Analysis types: effort (Story Points breakdown), velocity (completion trends), assignments (team workload), risks (blockers/stale items), completion (state distribution), priorities (priority breakdown), hierarchy (parent-child type validation and state progression checks), work-item-intelligence (AI-powered work item completeness and enhancement analysis), assignment-suitability (AI-powered Copilot assignment readiness), parent-recommendation (AI-powered intelligent parent finder)"
        },
        validateTypes: { type: "boolean", description: "Validate parent-child type relationships (only for hierarchy analysis, default true)" },
        validateStates: { type: "boolean", description: "Validate state progression consistency (only for hierarchy analysis, default true)" },
        returnQueryHandles: { type: "boolean", description: "Create query handles for violation categories (only for hierarchy analysis, default true)" },
        includeViolationDetails: { type: "boolean", description: "Include full violation details in response (only for hierarchy analysis, default false)" },
        intelligenceAnalysisType: { type: "string", enum: ["completeness", "ai-readiness", "enhancement", "categorization", "full"], description: "Type of work item intelligence analysis (only for work-item-intelligence, default: full)" },
        contextInfo: { type: "string", description: "Additional context for work item analysis (only for work-item-intelligence)" },
        enhanceDescription: { type: "boolean", description: "Generate enhanced descriptions (only for work-item-intelligence, default: false)" },
        outputFormat: { type: "string", enum: ["detailed", "json"], description: "Output format for assignment suitability analysis (only for assignment-suitability, default: detailed)" },
        repository: { type: "string", description: "Repository name to discover specialized agents for recommendation (only for assignment-suitability)" },
        dryRun: { type: "boolean", description: "Preview parent recommendations without creating query handle (only for parent-recommendation, default: false)" },
        areaPath: { type: "string", description: "Area path to search for parent candidates (only for parent-recommendation)" },
        includeSubAreas: { type: "boolean", description: "Include sub-areas in parent search (only for parent-recommendation, default: false - enforces same area path)" },
        maxParentCandidates: { type: "number", description: "Maximum parent candidates to analyze per child (only for parent-recommendation, default: 20, min: 3, max: 50)" },
        maxRecommendations: { type: "number", description: "Maximum parent recommendations per child (only for parent-recommendation, default: 3, min: 1, max: 5)" },
        parentWorkItemTypes: { type: "array", items: { type: "string" }, description: "Specific parent work item types to search for (only for parent-recommendation, e.g., ['Epic', 'Feature'])" },
        searchScope: { type: "string", enum: ["area", "project", "iteration"], description: "Scope of parent search (only for parent-recommendation, default: area)" },
        iterationPath: { type: "string", description: "Iteration path filter when searchScope='iteration' (only for parent-recommendation)" },
        requireActiveParents: { type: "boolean", description: "Only consider parents in Active/New/Committed states (only for parent-recommendation, default: true)" },
        confidenceThreshold: { type: "number", description: "Minimum confidence score for parent recommendations (only for parent-recommendation, 0-1, default: 0.5)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "analysisType"]
    }
  },
  {
    name: "list-handles",
    description: "📋 HANDLE REGISTRY: List all active query handles to track and manage them. Shows handle statistics, cleanup status, and provides guidance on handle management. Makes handles feel like persistent resources rather than ephemeral strings. Supports pagination for large numbers of handles.",
    script: "",
    schema: listQueryHandlesSchema,
    inputSchema: {
      type: "object",
      properties: {
        includeExpired: { type: "boolean", description: "Include expired handles in the list (default false). Useful for debugging handle lifecycle issues." },
        top: { type: "number", description: "Maximum number of handles to return (default 50, max 200)" },
        skip: { type: "number", description: "Number of handles to skip for pagination (default 0)" }
      },
      required: []
    }
  },
  {
    name: "inspect-handle",
    description: "🔍 UNIFIED HANDLE INFO: Get comprehensive information about a query handle in one call. Default mode provides inspection data (work item preview, statistics, selection hints). With detailed=true, adds validation data and optional selection analysis. Replaces separate validate/inspect/select tools for simpler workflows.",
    script: "",
    schema: queryHandleInfoSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle to get information about (from wit-wiql-query with returnQueryHandle=true)" },
        detailed: { type: "boolean", description: "Include detailed validation data and selection analysis (default false for concise output)" },
        includePreview: { type: "boolean", description: "Include preview of first 10 work items with their context data (default true)" },
        includeStats: { type: "boolean", description: "Include staleness statistics and analysis metadata (default true)" },
        includeExamples: { type: "boolean", description: "Include selection examples showing how to use itemSelector (default false, saves ~300 tokens)" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items (for selection analysis when detailed=true)" },
            { type: "array", items: { type: "number" }, maxItems: 100, description: "Array of zero-based indices [0,1,2]" },
            {
              type: "object",
              properties: {
                states: { type: "array", items: { type: "string" }, description: "Filter by work item states" },
                titleContains: { type: "array", items: { type: "string" }, description: "Filter by title keywords" },
                tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
                daysInactiveMin: { type: "number", description: "Minimum days inactive" },
                daysInactiveMax: { type: "number", description: "Maximum days inactive" }
              },
              description: "Criteria-based selection object"
            }
          ],
          description: "Optional: When provided with detailed=true, shows selection analysis"
        },
        previewCount: { type: "number", description: "Number of items to preview in selection analysis (default 10)" },
        includeSampleItems: { type: "boolean", description: "Fetch and include sample items from ADO API when detailed=true (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "get-context-bulk",
    description: "🔐 HANDLE-BASED CONTEXT: Retrieve full context packages for multiple work items identified by a query handle. Returns comprehensive work item data including descriptions, comments, history, relations, children, and parent for each item. Essential for deep analysis workflows that need complete context without ID hallucination risk.",
    script: "",
    schema: getContextPackagesByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items" },
            { type: "array", items: { type: "number" }, description: "Array of indices [0,1,2]" },
            {
              type: "object",
              properties: {
                states: { type: "array", items: { type: "string" } },
                titleContains: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
                daysInactiveMin: { type: "number" },
                daysInactiveMax: { type: "number" }
              }
            }
          ],
          description: "Item selection: 'all', indices, or criteria"
        },
        includeHistory: { type: "boolean", description: "Include recent change history (disabled by default to save context)" },
        maxHistoryRevisions: { type: "number", description: "Maximum revisions when history enabled (default 5)" },
        includeComments: { type: "boolean", description: "Include work item comments (default true)" },
        includeRelations: { type: "boolean", description: "Include related links (default true)" },
        includeChildren: { type: "boolean", description: "Include child hierarchy (default true)" },
        includeParent: { type: "boolean", description: "Include parent details (default true)" },
        includeExtendedFields: { type: "boolean", description: "Include extended field set (default false)" },
        maxPreviewItems: { type: "number", description: "Maximum items to include in response (default 10, max 50)" }
      },
      required: ["queryHandle"]
    }
  }
];
