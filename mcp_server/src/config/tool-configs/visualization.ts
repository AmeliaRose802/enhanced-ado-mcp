import type { ToolConfig } from "../../types/index.js";
import { z } from "zod";

/**
 * Visualization Tools
 * Tools for generating visual dependency graphs and diagrams
 */

const visualizeDependenciesSchema = z.object({
  queryHandle: z.string().optional(),
  workItemIds: z.array(z.number()).optional(),
  format: z.enum(['dot', 'mermaid']).default('mermaid'),
  relationTypes: z.array(z.enum(['all', 'parent-child', 'blocks', 'related', 'depends-on'])).default(['all']),
  maxDepth: z.number().min(1).max(10).default(3),
  maxNodes: z.number().min(10).max(500).default(100),
  layoutDirection: z.enum(['LR', 'TB', 'RL', 'BT']).default('LR'),
  groupByType: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  colorByState: z.boolean().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

export const visualizationTools: ToolConfig[] = [
  {
    name: "visualize-dependencies",
    description: "📊 DEPENDENCY VISUALIZATION: Generate visual dependency graphs showing work item relationships (parent-child, blocks, related, depends-on). Exports as Graphviz DOT format or Mermaid diagrams. Helps understand complex work item hierarchies and blockers. Perfect for sprint planning, backlog management, and identifying blockers. Supports filtering by relationship type, depth limiting to keep graphs readable, and both color schemes (by type or state). VS Code has built-in Mermaid support!",
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
          enum: ["dot", "mermaid"],
          default: "mermaid",
          description: "Export format: 'dot' for Graphviz (professional graphs, requires Graphviz installation) or 'mermaid' (built-in VS Code support, GitHub/Azure DevOps compatible)"
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
          maximum: 500,
          default: 100,
          description: "Maximum number of nodes (work items) to include in graph. Graph truncated at this limit. Start with 100, increase if needed."
        },
        layoutDirection: {
          type: "string",
          enum: ["LR", "TB", "RL", "BT"],
          default: "LR",
          description: "Layout direction: LR (left-to-right, good for hierarchies), TB (top-to-bottom, good for workflows), RL (right-to-left), BT (bottom-to-top)"
        },
        groupByType: {
          type: "boolean",
          default: false,
          description: "Group nodes by work item type (Epics, Features, Stories, etc.). DOT format only. Creates visual clusters for better organization."
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
