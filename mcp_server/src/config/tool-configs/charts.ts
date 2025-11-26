import type { ToolConfig } from "../../types/index.js";
import { z } from "zod";

/**
 * Chart Generation Tools
 * Tools for generating burndown, burnup, velocity, and cumulative flow diagrams
 */

const generateBurndownChartSchema = z.object({
  iterationPath: z.string().optional(),
  queryHandle: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['ascii', 'svg', 'data']).default('ascii'),
  workUnit: z.enum(['story-points', 'hours', 'count']).default('story-points'),
  showIdealLine: z.boolean().default(true),
  showTrendLine: z.boolean().default(true),
  includeWeekends: z.boolean().default(false),
  title: z.string().optional(),
  width: z.number().min(400).max(2000).default(800),
  height: z.number().min(300).max(1500).default(400),
  organization: z.string().optional(),
  project: z.string().optional()
});

const generateBurnupChartSchema = z.object({
  iterationPath: z.string().optional(),
  queryHandle: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['ascii', 'svg', 'data']).default('ascii'),
  workUnit: z.enum(['story-points', 'hours', 'count']).default('story-points'),
  showScopeLine: z.boolean().default(true),
  showCompletedLine: z.boolean().default(true),
  showIdealLine: z.boolean().default(true),
  includeWeekends: z.boolean().default(false),
  title: z.string().optional(),
  width: z.number().min(400).max(2000).default(800),
  height: z.number().min(300).max(1500).default(400),
  organization: z.string().optional(),
  project: z.string().optional()
});

export const chartTools: ToolConfig[] = [
  {
    name: "generate-burndown-chart",
    description: "📉 BURNDOWN CHART: Generate burndown charts showing remaining work over time. Tracks sprint progress with ideal vs actual burn rates, trend line projections, and scope change detection. Supports ASCII art (terminal display), SVG (high-quality graphics), or data-only export. Perfect for sprint retrospectives and daily standups. Calculates daily snapshots from work item history, excludes weekends from ideal line, and projects completion dates based on velocity trends.",
    script: "",
    schema: generateBurndownChartSchema,
    inputSchema: {
      type: "object",
      properties: {
        iterationPath: {
          type: "string",
          description: "Azure DevOps iteration path (e.g., 'Project\\Sprint 10'). All work items in this iteration will be included in the chart."
        },
        queryHandle: {
          type: "string",
          description: "Query handle from query-wiql (alternative to iterationPath). Use this to chart a specific set of work items."
        },
        startDate: {
          type: "string",
          description: "Sprint start date (YYYY-MM-DD). If not provided, uses earliest work item created date."
        },
        endDate: {
          type: "string",
          description: "Sprint end date (YYYY-MM-DD). If not provided, uses today's date."
        },
        format: {
          type: "string",
          enum: ["ascii", "svg", "data"],
          default: "ascii",
          description: "Chart format: 'ascii' (terminal-friendly text chart), 'svg' (scalable vector graphics), or 'data' (JSON for custom rendering)"
        },
        workUnit: {
          type: "string",
          enum: ["story-points", "hours", "count"],
          default: "story-points",
          description: "Work unit to measure: 'story-points' (Microsoft.VSTS.Scheduling.StoryPoints), 'hours' (Microsoft.VSTS.Scheduling.RemainingWork), or 'count' (number of items)"
        },
        showIdealLine: {
          type: "boolean",
          default: true,
          description: "Show ideal burndown line (linear decline from start to end, excluding weekends)"
        },
        showTrendLine: {
          type: "boolean",
          default: true,
          description: "Show trend line with projection (based on actual velocity, projects 5 days ahead)"
        },
        includeWeekends: {
          type: "boolean",
          default: false,
          description: "Include weekends in ideal line calculation. When false, ideal line burns down only on weekdays."
        },
        title: {
          type: "string",
          description: "Custom chart title (default: 'Sprint Burndown (story-points)')"
        },
        width: {
          type: "number",
          minimum: 400,
          maximum: 2000,
          default: 800,
          description: "Chart width in pixels (SVG format only)"
        },
        height: {
          type: "number",
          minimum: 300,
          maximum: 1500,
          default: 400,
          description: "Chart height in pixels (SVG format only)"
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
        { required: ["iterationPath"] },
        { required: ["queryHandle"] },
        { required: ["startDate", "endDate"] }
      ]
    }
  },
  {
    name: "generate-burnup-chart",
    description: "📈 BURNUP CHART: Generate burnup charts showing completed work and scope over time. Visualizes sprint progress with separate lines for completed work, total scope, and ideal completion rate. Detects scope creep (items added mid-sprint) and tracks velocity trends. Supports ASCII art (terminal display), SVG (high-quality graphics), or data-only export. Ideal for understanding scope changes and completion rates. Great for stakeholder reporting.",
    script: "",
    schema: generateBurnupChartSchema,
    inputSchema: {
      type: "object",
      properties: {
        iterationPath: {
          type: "string",
          description: "Azure DevOps iteration path (e.g., 'Project\\Sprint 10')"
        },
        queryHandle: {
          type: "string",
          description: "Query handle from query-wiql (alternative to iterationPath)"
        },
        startDate: {
          type: "string",
          description: "Sprint start date (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "Sprint end date (YYYY-MM-DD)"
        },
        format: {
          type: "string",
          enum: ["ascii", "svg", "data"],
          default: "ascii",
          description: "Chart format: 'ascii', 'svg', or 'data'"
        },
        workUnit: {
          type: "string",
          enum: ["story-points", "hours", "count"],
          default: "story-points",
          description: "Work unit to measure: 'story-points', 'hours', or 'count'"
        },
        showScopeLine: {
          type: "boolean",
          default: true,
          description: "Show total scope line (shows scope changes if items are added/removed)"
        },
        showCompletedLine: {
          type: "boolean",
          default: true,
          description: "Show completed work line (cumulative completed work over time)"
        },
        showIdealLine: {
          type: "boolean",
          default: true,
          description: "Show ideal completion line (based on final scope, excludes weekends)"
        },
        includeWeekends: {
          type: "boolean",
          default: false,
          description: "Include weekends in ideal line calculation"
        },
        title: {
          type: "string",
          description: "Custom chart title"
        },
        width: {
          type: "number",
          minimum: 400,
          maximum: 2000,
          default: 800,
          description: "Chart width in pixels (SVG only)"
        },
        height: {
          type: "number",
          minimum: 300,
          maximum: 1500,
          default: 400,
          description: "Chart height in pixels (SVG only)"
        },
        organization: {
          type: "string",
          description: "Azure DevOps organization"
        },
        project: {
          type: "string",
          description: "Azure DevOps project"
        }
      },
      oneOf: [
        { required: ["iterationPath"] },
        { required: ["queryHandle"] },
        { required: ["startDate", "endDate"] }
      ]
    }
  }
];
