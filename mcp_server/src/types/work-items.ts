/**
 * Work Item Type Definitions
 * 
 * Comprehensive type definitions for work item structures, context data,
 * and analysis results used throughout the Enhanced ADO MCP Server.
 * 
 * These types eliminate the use of 'any' and provide strong type safety
 * for work item operations, query handles, and AI-powered analysis.
 */

import type { ADOWorkItem, ADOWorkItemFields, ADORelation, ADOIdentity } from './ado.js';

/**
 * Work Item - Standard Azure DevOps work item structure
 * Re-export from ADO types for convenience
 */
export type WorkItem = ADOWorkItem;
export type WorkItemFields = ADOWorkItemFields;
export type WorkItemRelation = ADORelation;

/**
 * Work Item Context - Lightweight context data stored in query handles
 * Contains essential fields needed for analysis without full work item details
 */
export interface WorkItemContext {
  title: string;
  state: string;
  type: string;
  assignedTo?: string;
  daysInactive?: number;
  lastSubstantiveChangeDate?: string;
  lastSubstantiveChangeBy?: string;
  tags?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  storyPoints?: number;
  description?: string;
  acceptanceCriteria?: string;
  createdDate?: string;
  changedDate?: string;
  [key: string]: unknown; // Allow additional computed fields
}

/**
 * Work Item Context Package - Comprehensive work item data with relations and history
 * Returned by the wit-get-work-item-context-package tool
 */
export interface WorkItemContextPackage {
  id: number;
  title?: string;
  type?: string;
  state?: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  createdDate?: string;
  createdBy?: string;
  changedDate?: string;
  changedBy?: string;
  priority?: number;
  storyPoints?: number;
  remainingWork?: number;
  acceptanceCriteria?: string;
  description?: string | { html?: string; text?: string };
  tags?: string[];
  url?: string;
  parent?: {
    id: number;
    title?: string;
    type?: string;
    state?: string;
  } | null;
  children?: Array<{
    id: number;
    title?: string;
    type?: string;
    state?: string;
  }>;
  related?: Array<{
    type: string;
    id: number;
    title?: string;
    state?: string;
  }>;
  pullRequests?: Array<{
    name: string;
    url: string;
  }>;
  commits?: Array<{
    name: string;
    url: string;
  }>;
  attachments?: Array<{
    name: string;
    url: string;
  }>;
  comments?: Array<{
    id: number;
    text: string;
    createdBy?: string;
    createdDate?: string;
  }>;
  history?: Array<{
    rev: number;
    changedDate: string;
    changedBy?: string;
    fields: Record<string, string | number | boolean | undefined>;
  }>;
  _raw?: {
    fields: Record<string, string | number | boolean | undefined>;
  };
}

/**
 * Work Item with Context - Full work item + computed context
 */
export interface WorkItemWithContext extends WorkItem {
  context?: WorkItemContext;
  computedMetrics?: ComputedMetrics;
}

/**
 * Computed Metrics - Calculated fields for work items
 */
export interface ComputedMetrics {
  daysSinceCreated?: number;
  daysSinceChanged?: number;
  daysInactive?: number;
  hasDescription: boolean;
  hasAcceptanceCriteria?: boolean;
  isStale: boolean;
  isBlocked?: boolean;
  isUnassigned: boolean;
  hasStoryPoints?: boolean;
}

/**
 * Substantive Change Result - Analysis of true work item activity
 */
export interface SubstantiveChangeResult {
  workItemId: number;
  lastSubstantiveChangeDate: string | null;
  lastSubstantiveChangeBy: string | null;
  daysInactive: number | null;
  totalRevisions: number;
  substantiveRevisions: number;
  lastRevisionDate: string;
  isStale: boolean;
  staleDays: number;
}

/**
 * Query Handle Data - Stored work item references and context
 */
export interface QueryHandleData {
  handle: string;
  created: Date;
  expires: Date;
  workItemIds: number[];
  workItemContext: Map<number, WorkItemContext>;
  metadata: {
    organization: string;
    project: string;
    wiqlQuery: string;
    totalResults: number;
    includeSubstantiveChange?: boolean;
  };
}

/**
 * Bulk Operation Result - Standardized result for bulk operations
 */
export interface BulkOperationResult {
  success: boolean;
  totalItems: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    workItemId: number;
    success: boolean;
    error?: string;
    data?: unknown;
  }>;
  summary?: string;
}

/**
 * Work Item Analysis - Comprehensive AI-powered analysis results
 */
export interface WorkItemAnalysis {
  effort?: EffortAnalysis;
  velocity?: VelocityAnalysis;
  assignments?: AssignmentAnalysis;
  risks?: RiskAnalysis;
  completion?: CompletionAnalysis;
  priorities?: PriorityAnalysis;
  workload?: WorkloadAnalysis;
}

/**
 * Effort Analysis - Story point and complexity analysis
 */
export interface EffortAnalysis {
  total_story_points: number;
  average_story_points: number;
  unestimated_count: number;
  unestimated_percentage: number;
  by_type: Record<string, {
    count: number;
    total_points: number;
    average_points: number;
  }>;
  distribution: {
    small: number;      // 1-3 points
    medium: number;     // 5-8 points
    large: number;      // 13+ points
  };
}

/**
 * Velocity Analysis - Team throughput metrics
 */
export interface VelocityAnalysis {
  total_completed: number;
  total_story_points_completed: number;
  average_cycle_time_days: number;
  weekly_velocity: number;
  monthly_velocity: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  by_person: Record<string, {
    completed_count: number;
    story_points: number;
    average_cycle_time: number;
  }>;
}

/**
 * Assignment Analysis - Work distribution and capacity
 */
export interface AssignmentAnalysis {
  total_assigned: number;
  total_unassigned: number;
  by_person: Record<string, {
    active_count: number;
    total_story_points: number;
    work_types: Record<string, number>;
    weighted_load: number;
  }>;
  capacity_utilization: Record<string, {
    person: string;
    load: number;
    status: 'underutilized' | 'balanced' | 'overloaded';
  }>;
}

/**
 * Risk Analysis - Blockers and issues
 */
export interface RiskAnalysis {
  total_risks: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  blocked_items: Array<{
    id: number;
    title: string;
    blocker_description: string;
  }>;
  stale_items: Array<{
    id: number;
    title: string;
    days_inactive: number;
  }>;
  missing_data: {
    no_assignment: number;
    no_story_points: number;
    no_description: number;
    no_acceptance_criteria: number;
  };
}

/**
 * Completion Analysis - Progress and forecasting
 */
export interface CompletionAnalysis {
  total_items: number;
  completed_count: number;
  in_progress_count: number;
  not_started_count: number;
  completion_percentage: number;
  estimated_completion_date: string | null;
  confidence_level: 'low' | 'medium' | 'high';
  remaining_story_points: number;
  weeks_remaining: number;
}

/**
 * Priority Analysis - Priority distribution
 */
export interface PriorityAnalysis {
  by_priority: Record<string, number>;
  critical_count: number;
  high_priority_count: number;
  unset_priority_count: number;
}

/**
 * Workload Analysis - Current active work
 */
export interface WorkloadAnalysis {
  total_active: number;
  by_state: Record<string, number>;
  by_type: Record<string, number>;
  by_person: Record<string, {
    active_count: number;
    wip_status: 'healthy' | 'at-limit' | 'over-limit';
  }>;
}

/**
 * AI Suitability Analysis - Evaluation for AI assignment
 */
export interface AISuitabilityAnalysis {
  suitable_for_ai: boolean;
  confidence: number; // 0-100
  reasoning: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  estimated_effort?: string;
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Pattern Detection Result - Common work item issues
 */
export interface PatternDetectionResult {
  duplicates: Array<{
    group: number;
    workItems: Array<{ id: number; title: string; similarity: number }>;
  }>;
  placeholder_titles: Array<{
    id: number;
    title: string;
    reason: string;
  }>;
  orphaned_children: Array<{
    id: number;
    title: string;
    type: string;
  }>;
  unassigned_active: Array<{
    id: number;
    title: string;
    days_unassigned: number;
  }>;
  stale_automation: Array<{
    id: number;
    title: string;
    last_automated_change: string;
  }>;
  summary: {
    total_issues: number;
    by_category: Record<string, number>;
  };
}

/**
 * Simple Hierarchy Validation Result - Basic parent-child relationship checks
 * @deprecated Use HierarchyValidationResult from analysis.ts for detailed validation
 */
export interface SimpleHierarchyValidationResult {
  valid: boolean;
  total_items: number;
  issues: Array<{
    workItemId: number;
    title: string;
    issue_type: 'invalid_parent' | 'orphaned' | 'circular' | 'state_mismatch' | 'type_mismatch';
    severity: 'critical' | 'warning' | 'info';
    description: string;
    recommendation?: string;
  }>;
  summary: {
    critical_issues: number;
    warnings: number;
    info: number;
  };
}

/**
 * Type Guards - Runtime type validation
 */

export function isWorkItem(value: unknown): value is WorkItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'fields' in value &&
    typeof (value as WorkItem).id === 'number'
  );
}

export function isWorkItemContext(value: unknown): value is WorkItemContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'state' in value &&
    'type' in value
  );
}

export function isWorkItemArray(value: unknown): value is WorkItem[] {
  return Array.isArray(value) && (value.length === 0 || isWorkItem(value[0]));
}

/**
 * Utility Types
 */

/**
 * Work Item State - Common ADO work item states
 */
export type WorkItemState = 
  | 'New' 
  | 'Active' 
  | 'Resolved' 
  | 'Closed' 
  | 'Removed'
  | 'To Do'
  | 'In Progress'
  | 'Done'
  | string; // Allow custom states

/**
 * Work Item Type - Common ADO work item types
 */
export type WorkItemType =
  | 'Epic'
  | 'Feature'
  | 'Product Backlog Item'
  | 'User Story'
  | 'Task'
  | 'Bug'
  | 'Issue'
  | string; // Allow custom types

/**
 * Assignment Status
 */
export type AssignmentStatus = 'assigned' | 'unassigned';

/**
 * Staleness Level
 */
export type StalenessLevel = 'fresh' | 'aging' | 'stale' | 'very-stale';

/**
 * Risk Severity
 */
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
