/**
 * Query and Analytics Type Definitions
 * 
 * Type definitions for WIQL queries, OData analytics, and query-related operations.
 * Consolidates query-related types from handlers into a centralized location.
 */

import type { MCPServer } from './mcp.js';

/**
 * MCP Server Instance type for sampling operations
 * Used when handlers need to call sampling APIs
 */
export type MCPServerInstance = MCPServer;

/**
 * =============================================================================
 * ODATA ANALYTICS
 * =============================================================================
 */

/**
 * OData Analytics Query Arguments
 */
export interface ODataAnalyticsArgs {
  queryType: "workItemCount" | "groupByState" | "groupByType" | "groupByAssignee" | "velocityMetrics" | "cycleTimeMetrics" | "customQuery";
  organization: string;
  project: string;
  filters?: Record<string, string | number | boolean>;
  groupBy?: string[];
  select?: string[];
  orderBy?: string;
  customODataQuery?: string;
  dateRangeField?: "CreatedDate" | "ChangedDate" | "CompletedDate" | "ClosedDate";
  dateRangeStart?: string;
  dateRangeEnd?: string;
  areaPath?: string;
  iterationPath?: string;
  top?: number;
  skip?: number;
  computeCycleTime?: boolean;
  includeMetadata?: boolean;
  includeOdataMetadata?: boolean;
}

/**
 * OData Response Structure
 */
export interface ODataResponseValue {
  WorkItemId?: number;
  Title?: string;
  State?: string;
  WorkItemType?: string;
  Count?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ODataResponse {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: ODataResponseValue[];
}

/**
 * =============================================================================
 * HANDLER-SPECIFIC ARGUMENTS
 * =============================================================================
 */

/**
 * Context Package Arguments
 */
export interface ContextPackageArgs {
  workItemId: number;
  organization?: string;
  project?: string;
  includeHistory?: boolean;
  maxHistoryRevisions?: number;
  includeComments?: boolean;
  includeRelations?: boolean;
  includeChildren?: boolean;
  includeParent?: boolean;
  includeLinkedPRsAndCommits?: boolean;
  includeExtendedFields?: boolean;
  includeHtml?: boolean;
  includeHtmlFields?: boolean;
  stripHtmlFormatting?: boolean;
  maxChildDepth?: number;
  maxRelatedItems?: number;
  includeAttachments?: boolean;
  includeTags?: boolean;
  includeSystemFields?: boolean;
}
