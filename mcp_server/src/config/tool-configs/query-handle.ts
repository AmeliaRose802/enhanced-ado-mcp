import type { ToolConfig } from "../../types/index.js";
import {
  analyzeByQueryHandleSchema,
  listQueryHandlesSchema,
  selectItemsFromQueryHandleSchema,
  queryHandleInfoSchema,
  getContextPackagesByQueryHandleSchema
} from "../schemas.js";

/**
 * Query Handle Tools
 * Tools for managing and inspecting query handles
 */
export const queryHandleTools: ToolConfig[] = [
  {
    name: "wit-analyze-by-query-handle",
    description: "🔐 HANDLE-BASED ANALYSIS: Analyze work items using a query handle instead of explicit IDs. Prevents ID hallucination in analysis workflows. Provides effort estimates, velocity trends, assignment distribution, risk assessment, completion status, and priority analysis. Forces safe analysis patterns.",
    script: "",
    schema: analyzeByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (ensures analysis is based on real query results, not hallucinated IDs)" },
        analysisType: { 
          type: "array", 
          items: { 
            type: "string", 
            enum: ["effort", "velocity", "assignments", "risks", "completion", "priorities"] 
          },
          description: "Analysis types: effort (Story Points breakdown), velocity (completion trends), assignments (team workload), risks (blockers/stale items), completion (state distribution), priorities (priority breakdown)"
        },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "analysisType"]
    }
  },
  {
    name: "wit-list-query-handles",
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
    name: "wit-select-items-from-query-handle",
    description: "🎯 ITEM SELECTOR: Preview and analyze item selection from a query handle before bulk operations. Shows exactly which items will be selected using index-based ([0,1,2]) or criteria-based selection (states, tags, staleness). Essential for validating selections before destructive operations. Eliminates 'wrong item' errors in bulk workflows.",
    script: "",
    schema: selectItemsFromQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle to preview item selection for" },
        itemSelector: {
          oneOf: [
            { type: "string", enum: ["all"], description: "Select all items" },
            { type: "array", items: { type: "number" }, maxItems: 100, description: "Array of zero-based indices [0,1,2] to select specific items" },
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
          description: "Item selection: 'all' for all items, array of indices for specific items, or criteria object for filtering"
        },
        previewCount: { type: "number", description: "Number of selected items to preview (default 10, max 50)" }
      },
      required: ["queryHandle", "itemSelector"]
    }
  },
  {
    name: "wit-query-handle-info",
    description: "🔍 UNIFIED HANDLE INFO: Get comprehensive information about a query handle in one call. Default mode provides inspection data (work item preview, statistics, selection hints). With detailed=true, adds validation data and optional selection analysis. Replaces separate validate/inspect/select tools for simpler workflows.",
    script: "",
    schema: queryHandleInfoSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle to get information about (from wit-get-work-items-by-query-wiql with returnQueryHandle=true)" },
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
    name: "wit-get-context-packages-by-query-handle",
    description: "🔐 HANDLE-BASED CONTEXT: Retrieve full context packages for multiple work items identified by a query handle. Returns comprehensive work item data including descriptions, comments, history, relations, children, and parent for each item. Essential for deep analysis workflows that need complete context without ID hallucination risk.",
    script: "",
    schema: getContextPackagesByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql with returnQueryHandle=true" },
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
