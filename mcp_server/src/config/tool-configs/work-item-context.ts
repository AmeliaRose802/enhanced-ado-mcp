import type { ToolConfig } from "../../types/index.js";
import {
  workItemContextPackageSchema,
  workItemsBatchContextSchema,
  extractSecurityLinksSchema
} from "../schemas.js";

/**
 * Work Item Context Tools
 * Tools for retrieving comprehensive work item context and metadata
 */
export const workItemContextTools: ToolConfig[] = [
  {
    name: "wit-get-work-item-context-package",
    description: "Retrieve a comprehensive context package for a single work item including core fields, description, acceptance criteria, parent, children, related links, comments, recent history, and optionally PRs/commits and attachments in one call.",
    script: "",
    schema: workItemContextPackageSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Primary work item ID to retrieve full context for" },
        includeHistory: { type: "boolean", description: "Include recent change history (disabled by default to save ~40KB per work item)" },
        maxHistoryRevisions: { type: "number", description: "Maximum number of recent history revisions to include when history is enabled (sorted by revision number descending)" },
        includeComments: { type: "boolean", description: "Include work item comments/discussion" },
        includeRelations: { type: "boolean", description: "Include related links (parent, children, related, attachments, commits, PRs)" },
        includeChildren: { type: "boolean", description: "Include all child hierarchy (one level) if item is a Feature/Epic" },
        includeParent: { type: "boolean", description: "Include parent work item details if present" },
        includeLinkedPRsAndCommits: { type: "boolean", description: "Include linked Git PRs and commits if present in relations" },
        includeExtendedFields: { type: "boolean", description: "Include extended field set beyond defaults" },
        includeHtml: { type: "boolean", description: "Return original HTML field values alongside Markdown/plain text" },
        maxChildDepth: { type: "number", description: "Depth of child hierarchy to traverse (1 = immediate children)" },
        maxRelatedItems: { type: "number", description: "Maximum number of related items to expand" },
        includeAttachments: { type: "boolean", description: "Include attachment metadata (names, urls, sizes)" },
        includeTags: { type: "boolean", description: "Include tags list" }
      },
      required: ["workItemId"]
    }
  },
  {
    name: "wit-get-work-items-context-batch",
    description: "Retrieve multiple work items (10-50) with relationship graph, aggregate metrics, and optional heuristic scoring in one call.",
    script: "",
    schema: workItemsBatchContextSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemIds: { type: "array", items: { type: "number" }, description: "List of work item IDs (max 50)" },
        includeRelations: { type: "boolean", description: "Include relationship edges between provided items" },
        includeFields: { type: "array", items: { type: "string" }, description: "Additional fields to include per work item" },
        includeExtendedFields: { type: "boolean", description: "Include extended field set beyond defaults" },
        includeTags: { type: "boolean", description: "Include tags list" },
        includeStateCounts: { type: "boolean", description: "Return aggregate counts by state and type" },
        includeStoryPointAggregation: { type: "boolean", description: "Aggregate story points / effort fields if present" },
        includeRiskScoring: { type: "boolean", description: "Include basic heuristic risk / staleness scoring" },
        includeAIAssignmentHeuristic: { type: "boolean", description: "Include lightweight AI suitability heuristic" },
        includeParentOutsideSet: { type: "boolean", description: "Include minimal parent references outside requested set" },
        includeChildrenOutsideSet: { type: "boolean", description: "Include minimal child references outside requested set" },
        maxOutsideReferences: { type: "number", description: "Cap number of outside references added" },
        returnFormat: { type: "string", enum: ["graph", "array"], description: "Return as graph (nodes/edges) or simple array" }
      },
      required: ["workItemIds"]
    }
  },
  {
    name: "wit-extract-security-links",
    description: "Extract instruction links from security scan work items. organization and project are automatically filled from configuration - only provide them to override defaults.",
    script: "",
    schema: extractSecurityLinksSchema,
    inputSchema: {
      type: "object",
      properties: {
        workItemId: { type: "number", description: "Azure DevOps work item ID to extract instruction links from" },
        scanType: { type: "string", enum: ["BinSkim", "CodeQL", "CredScan", "General", "All"], description: "Type of security scanner to filter links for" },
        includeWorkItemDetails: { type: "boolean", description: "Include detailed work item information in the response" },
        extractFromComments: { type: "boolean", description: "Also extract links from work item comments" },
        dryRun: { type: "boolean", description: "Run in dry-run mode without making actual API calls" }
      },
      required: ["workItemId"]
    }
  }
];
