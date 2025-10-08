/**
 * Zod Schema Definitions for MCP Tools
 * 
 * All tool parameter schemas with validation rules, defaults, and JSDoc documentation.
 * Schemas are used for runtime validation and type inference.
 */

import { z } from "zod";
import { loadConfiguration } from "./config.js";

/**
 * Helper to get current configuration for default values
 */
const cfg = () => loadConfiguration();

// ============================================================================
// Core Work Item Creation & Management Schemas
// ============================================================================

/**
 * Schema for wit-create-new-item tool
 * Creates a new Azure DevOps work item with optional parent relationship
 */
export const createNewItemSchema = z.object({
  /** Title of the work item (required) */
  title: z.string().min(1, "Title cannot be empty. Provide a descriptive title for the work item."),
  
  /** Optional parent work item ID to establish hierarchy */
  parentWorkItemId: z.number().int().positive().optional(),
  
  /** Markdown description or repro steps */
  description: z.string().optional(),
  
  /** Semicolon or comma separated tags */
  tags: z.string().optional(),
  
  /** Work item type (defaults to config value) */
  workItemType: z.string().optional().default(() => cfg().azureDevOps.defaultWorkItemType),
  
  /** Area path (defaults to config value) */
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ""),
  
  /** Iteration path (defaults to config value) */
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ""),
  
  /** Assigned to user (defaults to config value) */
  assignedTo: z.string().optional().default(() => cfg().azureDevOps.defaultAssignedTo),
  
  /** Priority (defaults to config value) */
  priority: z.number().int().min(1).max(10).optional().default(() => cfg().azureDevOps.defaultPriority),
  
  /** Organization name (defaults to config value) */
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  
  /** Project name (defaults to config value) */
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  
  /** Inherit area/iteration paths from parent (defaults to config value) */
  inheritParentPaths: z.boolean().optional().default(() => cfg().azureDevOps.inheritParentPaths)
});
