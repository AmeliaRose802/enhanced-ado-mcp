import type { ToolConfig } from "../../types/index.js";
import {
  bulkEnhanceDescriptionsByQueryHandleSchema,
  bulkAssignStoryPointsByQueryHandleSchema,
  bulkAddAcceptanceCriteriaByQueryHandleSchema
} from "../schemas.js";

/**
 * AI Enhancement Tools
 * AI-powered bulk enhancement tools for descriptions, story points, and acceptance criteria
 */
export const aiEnhancementTools: ToolConfig[] = [
  {
    name: "wit-bulk-enhance-descriptions-by-query-handle",
    description: "Use AI to generate improved descriptions for multiple work items identified by query handle. Processes items in batches, generates enhanced descriptions based on context, and updates work items. Supports multiple enhancement styles (detailed, concise, technical, business). Returns AI-generated descriptions with confidence scores. Set dryRun=false to apply changes.",
    script: "",
    schema: bulkEnhanceDescriptionsByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (returnQueryHandle=true)" },
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
        sampleSize: { type: "number", description: "Max items to process (default 10, max 100)" },
        enhancementStyle: { 
          type: "string", 
          enum: ["detailed", "concise", "technical", "business"],
          description: "Style: detailed (comprehensive), concise (brief), technical (dev-focused), business (stakeholder-focused)" 
        },
        preserveExisting: { type: "boolean", description: "Append to existing description (default true)" },
        dryRun: { type: "boolean", description: "Preview without updating (default true)" },
        returnFormat: {
          type: "string",
          enum: ["summary", "preview", "full"],
          description: "Response format: 'summary' (counts only, ~70% reduction), 'preview' (200 char previews, ~40% reduction), 'full' (complete text). Defaults to 'summary' for dry-run, 'preview' for execute."
        }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-bulk-assign-story-points-by-query-handle",
    description: "Use AI to estimate story points for multiple work items identified by query handle. Analyzes complexity, scope, and risk to assign appropriate story points using fibonacci (1,2,3,5,8,13), linear (1-10), or t-shirt (XS,S,M,L,XL) scales. Returns estimates with confidence scores and reasoning. Set dryRun=false to apply changes.",
    script: "",
    schema: bulkAssignStoryPointsByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (returnQueryHandle=true)" },
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
        sampleSize: { type: "number", description: "Max items to process (default 10, max 100)" },
        pointScale: { 
          type: "string", 
          enum: ["fibonacci", "linear", "t-shirt"],
          description: "Story point scale: fibonacci (1,2,3,5,8,13), linear (1-10), t-shirt (XS,S,M,L,XL)" 
        },
        onlyUnestimated: { type: "boolean", description: "Only estimate items without existing effort (default true)" },
        includeCompleted: { type: "boolean", description: "Include completed/done items for historical analysis (default false)" },
        dryRun: { type: "boolean", description: "Preview without updating (default true)" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-bulk-add-acceptance-criteria-by-query-handle",
    description: "Use AI to generate acceptance criteria for multiple work items identified by query handle. Generates 3-7 testable criteria in gherkin (Given/When/Then), checklist (bullet points), or user-story (As a/I want/So that) format. Returns generated criteria with confidence scores. Set dryRun=false to apply changes.",
    script: "",
    schema: bulkAddAcceptanceCriteriaByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-get-work-items-by-query-wiql (returnQueryHandle=true)" },
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
        sampleSize: { type: "number", description: "Max items to process (default 10, max 100)" },
        criteriaFormat: { 
          type: "string", 
          enum: ["gherkin", "checklist", "user-story"],
          description: "Format: gherkin (Given/When/Then), checklist (bullets), user-story (As a/I want/So that)" 
        },
        minCriteria: { type: "number", description: "Minimum criteria to generate (default 3)" },
        maxCriteria: { type: "number", description: "Maximum criteria to generate (default 7)" },
        preserveExisting: { type: "boolean", description: "Append to existing criteria (default true)" },
        dryRun: { type: "boolean", description: "Preview without updating (default true)" }
      },
      required: ["queryHandle"]
    }
  }
];
