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
 * WIQL QUERY GENERATION
 * =============================================================================
 */

/**
 * Generate WIQL Query Arguments
 */
export interface GenerateWiqlQueryArgs {
  description: string;
  organization: string;
  project: string;
  maxIterations?: number;
  includeExamples?: boolean;
  testQuery?: boolean;
  areaPath?: string;
  iterationPath?: string;
  serverInstance?: MCPServerInstance; // Server instance for sampling
}

/**
 * Generate OData Query Arguments
 */
export interface GenerateODataQueryArgs {
  description: string;
  organization: string;
  project: string;
  maxIterations?: number;
  includeExamples?: boolean;
  testQuery?: boolean;
  areaPath?: string;
  iterationPath?: string;
  returnQueryHandle?: boolean;
  maxResults?: number;
  includeFields?: string[];
  serverInstance?: MCPServerInstance; // Server instance for sampling
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

/**
 * Batch Context Arguments
 */
export interface BatchContextArgs {
  workItemIds: number[];
  organization?: string;
  project?: string;
  includeRelations?: boolean;
  includeFields?: string[];
  includeExtendedFields?: boolean;
  includeTags?: boolean;
  includeStateCounts?: boolean;
  includeStoryPointAggregation?: boolean;
  includeRiskScoring?: boolean;
  includeAIAssignmentHeuristic?: boolean;
  includeParentOutsideSet?: boolean;
  includeChildrenOutsideSet?: boolean;
  maxOutsideReferences?: number;
  returnFormat?: 'graph' | 'array';
  maxDepth?: number;
}

/**
 * Bulk Add Comments Arguments
 */
export interface BulkAddCommentsArgs {
  items: CommentItem[];
  template?: string;
  templateVariables?: Record<string, string>;
  organization: string;
  project: string;
}

export interface CommentItem {
  workItemId: number;
  comment: string;
  variables?: Record<string, string>;
}

/**
 * =============================================================================
 * ANALYSIS HANDLER ARGUMENTS
 * =============================================================================
 */

/**
 * Detect Patterns Arguments
 */
export interface DetectPatternsArgs {
  workItemIds?: number[];
  areaPath?: string;
  includeChildAreas?: boolean;
  maxItems?: number;
  organization?: string;
  queryType?: string;
}

/**
 * Last Substantive Change Arguments
 */
export interface LastSubstantiveChangeArgs {
  workItemId: number;
  organization?: string;
  project?: string;
  staleDays?: number;
}
