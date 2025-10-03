/**
 * Resource Service
 * Manages MCP resources for exposing documentation and query examples
 */

import { logger } from "../utils/logger.js";
import path from "path";
import { readFile } from "fs/promises";

/**
 * Get the resources directory path
 */
function getResourcesDir(): string {
  // In production (dist), resources are at ../resources from dist/services
  // In development (src), resources are at ../../resources from src/services
  if (__filename.includes('/dist/') || __filename.includes('\\dist\\')) {
    return path.join(__dirname, '..', '..', 'resources');
  }
  return path.join(__dirname, '..', '..', 'resources');
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceContent {
  uri: string;
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
    "ado://docs/tool-selection-guide": "tool-selection-guide.md"
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
