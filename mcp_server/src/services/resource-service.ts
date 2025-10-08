/**
 * Resource Service
 * Manages MCP resources for exposing documentation and query examples
 */

import { logger } from "../utils/logger.js";
import path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

/**
 * Get current file path in both ESM and CommonJS environments
 */
function getCurrentFile(): string {
  // In test/Jest environment
  if (process.env.JEST_WORKER_ID !== undefined) {
    return path.join(process.cwd(), 'src', 'services', 'resource-service.ts');
  }
  
  // Check if we're in CommonJS environment
  if (typeof __filename !== 'undefined') {
    return __filename;
  }
  
  // In ESM environment - use eval to prevent transpiler from touching this
  const metaUrl = eval('import.meta.url');
  return fileURLToPath(metaUrl);
}

/**
 * Get the resources directory path
 */
function getResourcesDir(): string {
  const currentFile = getCurrentFile();
  const currentDir = dirname(currentFile);
  
  // In production (dist), resources are at ../resources from dist/services (copied during build)
  // In development (src), resources are at ../../resources from src/services
  if (currentFile.includes('/dist/') || currentFile.includes('\\dist\\')) {
    return path.join(currentDir, '..', 'resources');
  }
  return path.join(currentDir, '..', '..', 'resources');
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceContent {
  uri: string;
  name: string;
  mimeType: string;
  text?: string;
}

/**
 * Resource definitions - tight, focused documentation for agents
 */
const resourceDefinitions: MCPResource[] = [
  {
    uri: "ado://docs/wiql-quick-reference",
    name: "WIQL Quick Reference",
    description: "Common WIQL query patterns and examples for Azure DevOps work items. Essential patterns for querying by parent, type, state, and area path.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/odata-quick-reference",
    name: "OData Quick Reference",
    description: "OData Analytics query examples for metrics and aggregations. Use for counts, velocity, cycle time, and grouping operations.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/hierarchy-patterns",
    name: "Hierarchy Query Patterns",
    description: "Patterns for querying and building work item hierarchies. Includes parent-child relationships, recursive queries, and tree building.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/common-workflows",
    name: "Common Workflow Examples",
    description: "End-to-end workflow examples combining multiple tools. Includes feature decomposition, backlog cleanup, and bulk operations.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/tool-selection-guide",
    name: "Tool Selection Guide",
    description: "Quick decision guide for which tool to use for different tasks. Helps choose between WIQL, OData, context packages, and AI analyzers.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/query-handle-pattern",
    name: "Query Handle Pattern - Anti-Hallucination Architecture",
    description: "Comprehensive guide to using query handles for bulk operations. Eliminates ID hallucination by ensuring work item IDs come from Azure DevOps, not LLM memory.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/bulk-intelligent-enhancement-guide",
    name: "Bulk Intelligent Enhancement Guide",
    description: "AI-powered bulk enhancement tools for work items. Includes bulk description enhancement, story point estimation, and acceptance criteria generation with complete workflow patterns and safety features.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/handle-first-analysis-guide",
    name: "Handle-First Analysis Workflows Guide",
    description: "Query handle patterns for safe analysis workflows. Provides explicit handle-first patterns for common analysis scenarios to prevent ID hallucination with complete workflow examples.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/tool-discovery-guide",
    name: "Tool Discovery Guide",
    description: "AI-powered tool discovery for finding the right tools using natural language. Includes confidence scoring, workflow recommendations, and usage examples for discovering MCP server capabilities.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/wiql-generator-guide",
    name: "WIQL Generator Guide - AI-Powered Query Creation",
    description: "Guide to generating WIQL queries from natural language using AI. Includes examples, patterns, and best practices for query generation.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/personal-workload-analyzer-guide",
    name: "Personal Workload Analyzer Guide",
    description: "Individual workload health analysis for burnout prevention and career development. Includes burnout risk assessment, overspecialization detection, and custom intent analysis.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/sprint-planning-guide",
    name: "Sprint Planning Guide - AI-Powered Sprint Planning",
    description: "AI-powered sprint planning tool for optimal work assignment. Includes velocity analysis, capacity assessment, balanced work distribution, and risk mitigation.",
    mimeType: "text/markdown"
  },
  {
    uri: "ado://docs/tool-limitations",
    name: "Tool Limitations and Constraints Guide",
    description: "Comprehensive guide to tool limitations, constraints, and restrictions. Covers WIQL vs OData limitations, bulk operations, AI tools, ADO API limits, performance constraints, and common workarounds.",
    mimeType: "text/markdown"
  }
];

/**
 * Get all available resources
 */
export function listResources(): MCPResource[] {
  return resourceDefinitions;
}

/**
 * Get content for a specific resource
 */
export async function getResourceContent(uri: string): Promise<MCPResourceContent> {
  const resource = resourceDefinitions.find(r => r.uri === uri);
  
  if (!resource) {
    throw new Error(`Resource not found: ${uri}`);
  }

  // Map URI to content file
  const contentMap: Record<string, string> = {
    "ado://docs/wiql-quick-reference": "wiql-quick-reference.md",
    "ado://docs/odata-quick-reference": "odata-quick-reference.md",
    "ado://docs/hierarchy-patterns": "hierarchy-patterns.md",
    "ado://docs/common-workflows": "common-workflows.md",
    "ado://docs/tool-selection-guide": "tool-selection-guide.md",
    "ado://docs/query-handle-pattern": "query-handle-pattern.md",
    "ado://docs/bulk-intelligent-enhancement-guide": "bulk-intelligent-enhancement-guide.md",
    "ado://docs/handle-first-analysis-guide": "handle-first-analysis-guide.md",
    "ado://docs/tool-discovery-guide": "tool-discovery-guide.md",
    "ado://docs/wiql-generator-guide": "wiql-generator-guide.md",
    "ado://docs/personal-workload-analyzer-guide": "personal-workload-analyzer-guide.md",
    "ado://docs/sprint-planning-guide": "sprint-planning-guide.md",
    "ado://docs/tool-limitations": "tool-limitations.md"
  };

  const filename = contentMap[uri];
  if (!filename) {
    throw new Error(`No content file mapped for resource: ${uri}`);
  }

  const resourcesDir = getResourcesDir();
  const filePath = path.join(resourcesDir, filename);

  try {
    const content = await readFile(filePath, "utf-8");
    logger.debug(`Loaded resource: ${uri} from ${filename}`);
    
    return {
      uri,
      name: resource.name,
      mimeType: resource.mimeType,
      text: content
    };
  } catch (error) {
    logger.error(`Failed to load resource ${uri} from ${filePath}:`, error);
    throw new Error(`Failed to load resource content: ${uri}`);
  }
}

/**
 * Check if a resource exists
 */
export function resourceExists(uri: string): boolean {
  return resourceDefinitions.some(r => r.uri === uri);
}
