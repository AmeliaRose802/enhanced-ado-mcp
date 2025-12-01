import type { ToolConfig } from "../../types/index.js";
import { z } from "zod";

/**
 * Visualization Tools
 * Tools for generating visual dependency graphs and diagrams
 */

const visualizeDependenciesSchema = z.object({
  queryHandle: z.string().optional(),
  workItemIds: z.array(z.number()).optional(),
  format: z.enum(['mermaid']).default('mermaid'),
  relationTypes: z.array(z.enum(['all', 'parent-child', 'blocks', 'related', 'depends-on'])).default(['all']),
  maxDepth: z.number().min(1).max(10).default(3),
  maxNodes: z.number().min(10).max(1000).default(200),
  layoutDirection: z.enum(['LR', 'TB', 'RL', 'BT']).default('TB'),
  traversalDirection: z.enum(['both', 'children-only', 'parents-only']).default('children-only'),
  groupByType: z.boolean().default(false),
  groupByEpic: z.boolean().default(false),
  excludeStates: z.array(z.string()).default(['Done', 'Closed', 'Removed', 'Cut']),
  includeMetadata: z.boolean().default(true),
  colorByState: z.boolean().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

export const visualizationTools: ToolConfig[] = [
  {
    name: "visualize-dependencies",
    description: "📊 DEPENDENCY VISUALIZATION: Generate visual dependency graphs showing work item relationships (parent-child, blocks, related, depends-on). Exports as Mermaid diagrams with built-in VS Code, GitHub, and Azure DevOps support. Helps understand complex work item hierarchies and blockers. Perfect for sprint planning, backlog management, and identifying blockers. Supports filtering by relationship type, depth limiting to keep graphs readable, and color schemes (by type or state).",
    script: "",
    schema: visualizeDependenciesSchema,
    inputSchema: {
      type: "object",
      properties: {
        queryHandle: {
          type: "string",
          description: "Query handle from query-wiql (optional if workItemIds provided). Use this to visualize work items from a saved query."
        },
        workItemIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of work item IDs to visualize (optional if queryHandle provided). Starting point for dependency traversal."
        },
        format: {
          type: "string",
          enum: ["mermaid"],
          default: "mermaid",
          description: "Export format: 'mermaid' for Mermaid diagrams (built-in VS Code support, GitHub/Azure DevOps compatible)"
        },
        relationTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["all", "parent-child", "blocks", "related", "depends-on"]
          },
          default: ["all"],
          description: "Relationship types to include in visualization. 'all' includes everything, or filter to specific types like ['parent-child', 'blocks'] to focus on hierarchy and blockers."
        },
        maxDepth: {
          type: "number",
          minimum: 1,
          maximum: 10,
          default: 3,
          description: "Maximum depth to traverse from starting work items. Prevents huge graphs by limiting how far relationships are followed. 1=immediate relationships only, 3=reasonably sized graphs."
        },
        maxNodes: {
          type: "number",
          minimum: 10,
          maximum: 1000,
          default: 200,
          description: "Maximum number of nodes (work items) to include in graph. Graph truncated at this limit. Start with 200, increase if needed for large hierarchies."
        },
        layoutDirection: {
          type: "string",
          enum: ["LR", "TB", "RL", "BT"],
          default: "TB",
          description: "Layout direction: TB (top-to-bottom, good for workflows and hierarchies), LR (left-to-right), RL (right-to-left), BT (bottom-to-top)"
        },
        traversalDirection: {
          type: "string",
          enum: ["both", "children-only", "parents-only"],
          default: "children-only",
          description: "Traversal direction: 'children-only' shows only the requested item and its descendants (prevents including parents/siblings/ancestors), 'both' includes entire hierarchy tree, 'parents-only' shows only ancestors. Use 'children-only' for focused epic/feature breakdowns."
        },
        groupByType: {
          type: "boolean",
          default: false,
          description: "Group nodes by work item type (Epics, Features, Stories, etc.). Creates visual clusters for better organization."
        },
        groupByEpic: {
          type: "boolean",
          default: false,
          description: "Group nodes by parent Epic. Shows which items belong to which Epic for better organization. Takes precedence over groupByType."
        },
        excludeStates: {
          type: "array",
          items: { type: "string" },
          default: ["Done", "Closed", "Removed", "Cut"],
          description: "Work item states to exclude from visualization (case-insensitive). Perfect for current-work views that hide completed items. Set to empty array [] to include all states."
        },
        includeMetadata: {
          type: "boolean",
          default: true,
          description: "Include work item metadata (type, state) in node labels. When true: 'Epic: Feature X\\nActive', when false: just 'Feature X'"
        },
        colorByState: {
          type: "boolean",
          default: false,
          description: "Color nodes by state (New=blue, Active=gold, Done=green) instead of by type. Useful for visualizing progress."
        },
        organization: {
          type: "string",
          description: "Azure DevOps organization name (uses config default if not provided)"
        },
        project: {
          type: "string",
          description: "Azure DevOps project name (uses config default if not provided)"
        }
      },
      oneOf: [
        { required: ["queryHandle"] },
        { required: ["workItemIds"] }
      ]
    }
  }
];
