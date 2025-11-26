import type { ToolConfig } from "../../types/index.js";
import {
  linkWorkItemsByQueryHandlesSchema,
  bulkUndoByQueryHandleSchema,
  forensicUndoByQueryHandleSchema,
  unifiedBulkOperationsSchema,
  exportWorkItemsSchema
} from "../schemas.js";

/**
 * Bulk Operations Tools
 * Tools for bulk updates, assignments, and state transitions using query handles
 * 
 * NOTE: Most bulk operations are now consolidated into wit-unified-bulk-operations-by-query-handle
 * to reduce tool confusion. Individual tools remain for specialized use cases like linking and undo.
 */
export const bulkOperationsTools: ToolConfig[] = [
  {
    name: "execute-bulk-operations",
    description: "🎯 UNIFIED BULK OPERATIONS: Perform multiple operations (comment, update, assign, remove, transition-state, move-iteration, change-type, add-tag, remove-tag, enhance-descriptions, assign-story-points, add-acceptance-criteria) on work items identified by a query handle. Consolidates all bulk operations into a single tool that accepts an array of actions to execute sequentially. Supports dry-run mode, error handling strategies, item selection, and AI-powered enhancements. Reduces tool confusion by providing one entry point for all bulk modifications.",
    script: "",
    schema: unifiedBulkOperationsSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        actions: {
          type: "array",
          description: "Array of actions to perform sequentially on selected work items",
          items: {
            oneOf: [
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "comment" },
                  comment: { type: "string", description: "Comment text (supports Markdown)" }
                },
                required: ["type", "comment"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "update" },
                  updates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        op: { type: "string", enum: ["add", "replace", "remove"] },
                        path: { type: "string" },
                        value: {}
                      },
                      required: ["op", "path"]
                    }
                  }
                },
                required: ["type", "updates"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "assign" },
                  assignTo: { type: "string" },
                  comment: { type: "string" }
                },
                required: ["type", "assignTo"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "remove" },
                  removeReason: { type: "string" }
                },
                required: ["type"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "transition-state" },
                  targetState: { type: "string" },
                  reason: { type: "string" },
                  comment: { type: "string" },
                  validateTransitions: { type: "boolean" },
                  skipInvalidTransitions: { type: "boolean" }
                },
                required: ["type", "targetState"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "move-iteration" },
                  targetIterationPath: { type: "string" },
                  comment: { type: "string" },
                  updateChildItems: { type: "boolean" }
                },
                required: ["type", "targetIterationPath"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "change-type" },
                  targetType: { type: "string" },
                  validateTypeChanges: { type: "boolean" },
                  skipInvalidChanges: { type: "boolean" },
                  preserveFields: { type: "boolean" },
                  comment: { type: "string" }
                },
                required: ["type", "targetType"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "add-tag" },
                  tags: { type: "string", description: "Semicolon-separated tags to add" }
                },
                required: ["type", "tags"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "remove-tag" },
                  tags: { type: "string", description: "Semicolon-separated tags to remove" }
                },
                required: ["type", "tags"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "enhance-descriptions" },
                  enhancementStyle: { type: "string", enum: ["concise", "detailed", "technical", "business"], description: "Enhancement style (default: detailed)" },
                  preserveOriginal: { type: "boolean", description: "Append to existing description instead of replacing" },
                  minConfidenceScore: { type: "number", description: "Minimum confidence to apply enhancement (default: 0.6)" }
                },
                required: ["type"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "assign-story-points" },
                  estimationScale: { type: "string", enum: ["fibonacci", "powers-of-2", "linear", "t-shirt"], description: "Estimation scale (default: fibonacci)" },
                  includeReasoning: { type: "boolean", description: "Add estimation reasoning as comment" },
                  overwriteExisting: { type: "boolean", description: "Overwrite existing story points" }
                },
                required: ["type"]
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", const: "add-acceptance-criteria" },
                  criteriaFormat: { type: "string", enum: ["gherkin", "checklist", "user-story"], description: "Criteria format (default: gherkin)" },
                  minCriteria: { type: "number", description: "Minimum criteria to generate (default: 3)" },
                  maxCriteria: { type: "number", description: "Maximum criteria to generate (default: 7)" },
                  appendToExisting: { type: "boolean", description: "Append to existing acceptance criteria" }
                },
                required: ["type"]
              }
            ]
          }
        },
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
          description: "Item selection: 'all', indices, or criteria (default: all)"
        },
        dryRun: { type: "boolean", description: "Preview operations without making changes (default true)" },
        maxPreviewItems: { type: "number", description: "Maximum items to preview in dry-run (default 10)" },
        stopOnError: { type: "boolean", description: "Stop executing actions if one fails (default true)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "actions"]
    }
  },
  {
    name: "link-workitems",
    description: "🔐 HANDLE-BASED LINKING: Create relationships between work items identified by two query handles. Supports multiple link types (Related, Parent, Child, Predecessor, Successor) and strategies (one-to-one, one-to-many, many-to-one, many-to-many). Essential for bulk relationship creation without ID hallucination risk.",
    script: "",
    schema: linkWorkItemsByQueryHandlesSchema,
    inputSchema: {
      type: "object",
      properties: {
        sourceQueryHandle: { type: "string", description: "Source query handle from query-wiql" },
        targetQueryHandle: { type: "string", description: "Target query handle from query-wiql" },
        linkType: { 
          type: "string", 
          enum: ["Related", "Parent", "Child", "Predecessor", "Successor", "Affects", "Affected By"],
          description: "Type of relationship to create" 
        },
        sourceItemSelector: {
          oneOf: [
            { type: "string", enum: ["all"] },
            { type: "array", items: { type: "number" } },
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
          description: "Select specific source items (default: all)"
        },
        targetItemSelector: {
          oneOf: [
            { type: "string", enum: ["all"] },
            { type: "array", items: { type: "number" } },
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
          description: "Select specific target items (default: all)"
        },
        linkStrategy: {
          type: "string",
          enum: ["one-to-one", "one-to-many", "many-to-one", "many-to-many"],
          description: "Link strategy (default: one-to-one)"
        },
        comment: { type: "string", description: "Optional comment to add to all linked work items" },
        skipExistingLinks: { type: "boolean", description: "Skip links that already exist (default true)" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default true)" },
        maxPreviewItems: { type: "number", description: "Maximum link operations to preview (default 10)" }
      },
      required: ["sourceQueryHandle", "targetQueryHandle", "linkType"]
    }
  },
  {
    name: "undo-bulk",
    description: "🔄 UNDO OPERATIONS: Undo bulk operations performed on a query handle. Can undo just the last operation (default) or all operations (undoAll: true). Reverts comments, field updates, assignments, state transitions, and iteration moves. Supports dry-run mode to preview undo actions. NOTE: Comments cannot be deleted via ADO API, so a reversal comment is added instead.",
    script: "",
    schema: bulkUndoByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        undoAll: { type: "boolean", description: "Undo all operations performed on this query handle (default: false, only undoes last operation)" },
        dryRun: { type: "boolean", description: "Preview undo operation without making changes (default true)" },
        maxPreviewItems: { type: "number", description: "Maximum items to preview in dry-run (default 10)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "undo-forensic",
    description: "🔍 FORENSIC UNDO: Analyze work item revision history to detect and revert changes made by a specific user within a time window. Unlike regular undo, this tool works on ANY work items (not just those changed via MCP) by directly examining ADO revision history. Detects type changes, state changes, field updates, and optionally link operations. Automatically detects if changes have already been manually reverted and only reverts items that still have unwanted changes. Essential for recovering from bulk mistakes across multiple work items.",
    script: "",
    schema: forensicUndoByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query containing work items to analyze" },
        changedBy: { type: "string", description: "Filter changes by user (display name or email, case-insensitive partial match)" },
        afterTimestamp: { type: "string", description: "Only detect changes after this ISO timestamp (e.g., '2025-10-28T10:00:00Z')" },
        beforeTimestamp: { type: "string", description: "Only detect changes before this ISO timestamp (e.g., '2025-10-29T18:00:00Z')" },
        maxRevisions: { type: "number", description: "Maximum revisions to analyze per work item (default 50, max 200)" },
        detectTypeChanges: { type: "boolean", description: "Detect work item type changes (default true)" },
        detectStateChanges: { type: "boolean", description: "Detect state transitions (default true)" },
        detectFieldChanges: { type: "boolean", description: "Detect field value changes (default true)" },
        detectLinkChanges: { type: "boolean", description: "Detect parent/child link changes - requires additional API calls (default false)" },
        fieldPaths: { type: "array", items: { type: "string" }, description: "Specific field paths to check (e.g., ['System.AssignedTo', 'System.Tags']). If not specified, checks all fields." },
        dryRun: { type: "boolean", description: "Preview forensic analysis and revert actions without making changes (default true)" },
        maxPreviewItems: { type: "number", description: "Maximum items to preview in dry-run (default 20, max 500)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "export-work-items",
    description: "📊 EXPORT WORK ITEMS: Export work items to CSV, Excel (XLSX), or TSV format with field selection, relationships, comments, and history. Perfect for reporting, backup, and analysis in external tools like Excel or Google Sheets. Supports custom field selection, multiple Excel sheets, formatted headers, hyperlinks to Azure DevOps, and streaming for large exports.",
    script: "",
    schema: exportWorkItemsSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from query-wiql with returnQueryHandle=true" },
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
          description: "Item selection: 'all', indices, or criteria (default: all)"
        },
        format: { 
          type: "string", 
          enum: ["csv", "xlsx", "tsv"],
          description: "Export format: csv (comma-separated), xlsx (Excel), or tsv (tab-separated)" 
        },
        outputPath: { type: "string", description: "Output file path. If not provided, generates in workspace directory with timestamp." },
        fields: { 
          type: "array", 
          items: { type: "string" },
          description: "Specific fields to export (e.g., ['System.Id', 'System.Title']). If not provided, exports standard fields." 
        },
        includeAllFields: { type: "boolean", description: "Include all available fields (default: false)" },
        includeRelationships: { type: "boolean", description: "Include relationships in export (parent, children, related)" },
        relationshipDepth: { type: "number", description: "Depth of child relationships to include (1 = immediate children, default: 1, max: 3)" },
        includeComments: { type: "boolean", description: "Include work item comments/discussion" },
        includeHistory: { type: "boolean", description: "Include work item revision history" },
        includeAttachmentLinks: { type: "boolean", description: "Include attachment URLs" },
        maxHistoryRevisions: { type: "number", description: "Maximum history revisions per work item (default: 10, max: 50)" },
        excelOptions: {
          type: "object",
          description: "Excel-specific formatting options (only applies when format=xlsx)",
          properties: {
            multipleSheets: { type: "boolean", description: "Create multiple sheets (work items, relationships, comments, default: true)" },
            formatHeaders: { type: "boolean", description: "Apply header formatting (bold, colored background, default: true)" },
            freezePanes: { type: "boolean", description: "Freeze header row (default: true)" },
            autoColumnWidth: { type: "boolean", description: "Auto-size columns to content (default: true)" },
            includeHyperlinks: { type: "boolean", description: "Add hyperlinks to Azure DevOps work items (default: true)" },
            sheetNames: {
              type: "object",
              properties: {
                workItems: { type: "string", description: "Name for work items sheet (default: 'Work Items')" },
                relationships: { type: "string", description: "Name for relationships sheet (default: 'Relationships')" },
                comments: { type: "string", description: "Name for comments sheet (default: 'Comments')" },
                history: { type: "string", description: "Name for history sheet (default: 'History')" }
              }
            }
          }
        },
        maxItems: { type: "number", description: "Maximum items to export (default: all selected items, max: 10000)" },
        streamLargeExports: { type: "boolean", description: "Stream large exports to reduce memory usage (default: true)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "format"]
    }
  }
];
