import type { ToolConfig } from "../../types/index.js";
import {
  bulkCommentByQueryHandleSchema,
  bulkUpdateByQueryHandleSchema,
  bulkAssignByQueryHandleSchema,
  bulkRemoveByQueryHandleSchema,
  bulkTransitionStateByQueryHandleSchema,
  bulkMoveToIterationByQueryHandleSchema,
  linkWorkItemsByQueryHandlesSchema
} from "../schemas.js";

/**
 * Bulk Operations Tools
 * Tools for bulk updates, assignments, and state transitions using query handles
 */
export const bulkOperationsTools: ToolConfig[] = [
  {
    name: "wit-bulk-comment-by-query-handle",
    description: "Add a comment to multiple work items identified by a query handle. Uses query handle from wit-wiql-query to eliminate ID hallucination risk. Supports template variables and dry-run mode. TEMPLATE VARIABLES: Use {daysInactive}, {lastSubstantiveChangeDate}, {title}, {state}, {type}, {assignedTo}, {id} in comment text for per-item substitution when query handle includes staleness data.",
    script: "",
    schema: bulkCommentByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        comment: { type: "string", description: "Comment text to add to all work items (supports Markdown and template variables like {daysInactive}, {lastSubstantiveChangeDate}, {title}, {state}, {type}, {assignedTo}, {id})" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false) - shows template substitution examples" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "comment"]
    }
  },
  {
    name: "wit-bulk-update-by-query-handle",
    description: "Update multiple work items identified by a query handle. Uses JSON Patch operations to update fields. Supports dry-run mode.",
    script: "",
    schema: bulkUpdateByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "replace", "remove"], description: "JSON Patch operation" },
              path: { type: "string", description: "Field path (e.g., '/fields/System.State', '/fields/System.AssignedTo')" },
              value: { description: "Value to set (not needed for 'remove' operation)" }
            },
            required: ["op", "path"]
          },
          description: "Array of JSON Patch operations to apply"
        },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "updates"]
    }
  },
  {
    name: "wit-bulk-assign-by-query-handle",
    description: "Assign multiple work items to a user, identified by query handle. Supports dry-run mode.",
    script: "",
    schema: bulkAssignByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        assignTo: { type: "string", description: "User email or display name to assign work items to" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle", "assignTo"]
    }
  },
  {
    name: "wit-bulk-remove-by-query-handle",
    description: "Move multiple work items to 'Removed' state (does NOT permanently delete). Sets work item state to 'Removed' for items identified by a query handle. Optionally add a comment with removal reason. Supports dry-run mode.",
    script: "",
    schema: bulkRemoveByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        removeReason: { type: "string", description: "Optional reason for removing work items (added as comment before state change)" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default false)" },
        organization: { type: "string", description: "Azure DevOps organization name" },
        project: { type: "string", description: "Azure DevOps project name" }
      },
      required: ["queryHandle"]
    }
  },
  {
    name: "wit-bulk-transition-state-by-query-handle",
    description: "Safely transition multiple work items to a new state using query handle. Common operations: close bugs, move tasks to done, resolve items. Validates state transitions before applying and supports dry-run mode for safety.",
    script: "",
    schema: bulkTransitionStateByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        targetState: { type: "string", description: "Target state to transition to (e.g., 'Resolved', 'Closed', 'Done')" },
        reason: { type: "string", description: "Reason for state transition (e.g., 'Fixed', 'Completed'). Required for some transitions." },
        comment: { type: "string", description: "Optional comment to add when transitioning state" },
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
        validateTransitions: { type: "boolean", description: "Validate state transitions are allowed (default true)" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default true)" },
        maxPreviewItems: { type: "number", description: "Maximum items to preview in dry-run (default 5)" }
      },
      required: ["queryHandle", "targetState"]
    }
  },
  {
    name: "wit-bulk-move-to-iteration-by-query-handle",
    description: "Safely move multiple work items to a different iteration/sprint using query handle. Simpler than using bulk-update with JSON Patch for iteration changes. Common for sprint rescheduling and backlog grooming. Supports dry-run mode for safety.",
    script: "",
    schema: bulkMoveToIterationByQueryHandleSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: { type: "string", description: "Query handle from wit-wiql-query with returnQueryHandle=true" },
        targetIterationPath: { type: "string", description: "Target iteration/sprint path (e.g., 'Project\\\\Sprint 11')" },
        comment: { type: "string", description: "Optional comment to add when moving to new iteration" },
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
        updateChildItems: { type: "boolean", description: "Also update child work items to same iteration (default false)" },
        dryRun: { type: "boolean", description: "Preview operation without making changes (default true)" },
        maxPreviewItems: { type: "number", description: "Maximum items to preview in dry-run (default 5)" }
      },
      required: ["queryHandle", "targetIterationPath"]
    }
  },
  {
    name: "wit-link-work-items-by-query-handles",
    description: "🔐 HANDLE-BASED LINKING: Create relationships between work items identified by two query handles. Supports multiple link types (Related, Parent, Child, Predecessor, Successor) and strategies (one-to-one, one-to-many, many-to-one, many-to-many). Essential for bulk relationship creation without ID hallucination risk.",
    script: "",
    schema: linkWorkItemsByQueryHandlesSchema,
    inputSchema: {
      type: "object",
      properties: {
        sourceQueryHandle: { type: "string", description: "Source query handle from wit-wiql-query" },
        targetQueryHandle: { type: "string", description: "Target query handle from wit-wiql-query" },
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
  }
];
