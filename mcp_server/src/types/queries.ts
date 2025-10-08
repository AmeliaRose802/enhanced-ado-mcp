/**
 * Query and Analytics Type Definitions
 * 
 * Type definitions for WIQL queries, OData analytics, and query-related operations.
 * Consolidates query-related types from handlers into a centralized location.
 */

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
export interface ODataResponse {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: any[];
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
  areaPath?: string;
  iterationPath?: string;
  includeExplanation?: boolean;
}

/**
 * Generate OData Query Arguments
 */
export interface GenerateODataQueryArgs {
  description: string;
  organization: string;
  project: string;
  areaPath?: string;
  iterationPath?: string;
  includeExplanation?: boolean;
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
  includeRelations?: boolean;
  includeComments?: boolean;
  historyDepth?: number;
}

/**
 * Batch Context Arguments
 */
export interface BatchContextArgs {
  workItemIds: number[];
  organization?: string;
  project?: string;
  includeContext?: boolean;
  includeRelations?: boolean;
}

/**
 * Bulk Add Comments Arguments
 */
export interface BulkAddCommentsArgs {
  items: CommentItem[];
  template?: string;
  organization?: string;
  project?: string;
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
  project?: string;
}

/**
 * Validate Hierarchy Arguments
 */
export interface ValidateHierarchyArgs {
  workItemIds?: number[];
  areaPath?: string;
  includeChildAreas?: boolean;
  maxDepth?: number;
  organization?: string;
  project?: string;
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
