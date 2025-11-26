import type { ToolConfig } from "../../types/index.js";
import { generateChangelogSchema } from "../schemas.js";

/**
 * Changelog Generation Tools
 * Tools for generating changelogs from work items
 */
export const changelogTools: ToolConfig[] = [
  {
    name: "generate-changelog",
    description: "📝 AUTOMATED CHANGELOG: Generate professional changelogs from closed/resolved work items with customizable formats and grouping. Supports Keep a Changelog, Semantic Versioning, and Conventional Commits formats. Filter by date range, iteration, tags, or types. Group by type, assignee, priority, or tag. Output as Markdown or JSON. Perfect for release notes and version documentation.",
    script: "",
    schema: generateChangelogSchema,
    inputSchema: {
      type: "object",
      properties: {
        // Time Range (provide ONE)
        dateRangeStart: { type: "string", description: "Start date for changelog (ISO 8601: YYYY-MM-DD)" },
        dateRangeEnd: { type: "string", description: "End date for changelog (ISO 8601: YYYY-MM-DD)" },
        iterationPath: { type: "string", description: "Iteration path to generate changelog for (e.g., 'ProjectName\\Sprint 10')" },
        
        // Version Information
        version: { type: "string", description: "Version tag for the changelog (e.g., '1.2.0', 'v2.0.0')" },
        
        // Filtering
        states: { type: "array", items: { type: "string" }, description: "Work item states to include (default: ['Closed', 'Resolved'])" },
        includeTypes: { type: "array", items: { type: "string" }, description: "Specific work item types to include (e.g., ['Bug', 'Task', 'Product Backlog Item'])" },
        excludeTypes: { type: "array", items: { type: "string" }, description: "Work item types to exclude" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by specific tags (e.g., ['release', 'hotfix'])" },
        areaPathFilter: { type: "array", items: { type: "string" }, description: "Filter by specific area paths" },
        
        // Grouping & Formatting
        groupBy: { type: "string", enum: ["type", "assignee", "priority", "tag", "none"], description: "How to group changelog entries (default: 'type')" },
        format: { type: "string", enum: ["markdown", "keepachangelog", "conventional", "semantic", "json"], description: "Changelog format (default: 'keepachangelog')" },
        includeWorkItemLinks: { type: "boolean", description: "Include links to work items in Azure DevOps (default: true)" },
        includeDescriptions: { type: "boolean", description: "Include work item descriptions in changelog (default: false)" },
        includeAssignees: { type: "boolean", description: "Include assignee names in changelog entries (default: false)" },
        
        // Type Mapping (for categorization)
        typeMapping: { 
          type: "object", 
          additionalProperties: { type: "string" },
          description: "Custom mapping of work item types to changelog categories (e.g., {'Bug': 'Bug Fixes', 'Task': 'Improvements'})" 
        },
        
        // Output
        outputPath: { type: "string", description: "File path to write changelog (e.g., 'CHANGELOG.md'). If not provided, returns as text." },
        append: { type: "boolean", description: "Append to existing changelog file (default: false, overwrites)" },
        
        // Configuration
        organization: { type: "string", description: "Azure DevOps organization name (uses configured default if not provided)" },
        project: { type: "string", description: "Azure DevOps project name (uses configured default if not provided)" }
      },
      required: []
    }
  }
];
