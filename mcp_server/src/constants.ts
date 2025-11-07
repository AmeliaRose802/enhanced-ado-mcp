/**
 * Application Constants
 * Centralized constants to eliminate magic strings and improve maintainability
 */

/**
 * Tool Names - All registered MCP tool names
 * Use these constants instead of hardcoded strings
 */
export const TOOL_NAMES = {
  // Core Work Item Operations
  CREATE_NEW_ITEM: 'wit-create-new-item',
  CLONE_WORK_ITEM: 'wit-clone-work-item',
  GET_WORK_ITEM_CONTEXT_PACKAGE: 'wit-get-work-item-context-package',
  GET_CONTEXT_PACKAGES_BY_QUERY_HANDLE: 'wit-get-context-packages-by-query-handle',
  
  // Query Operations
  WIQL_QUERY: 'wit-wiql-query', // Unified: supports both direct WIQL and AI generation
  ODATA_QUERY: 'wit-odata-query', // Unified: supports both direct OData and AI generation
  
  // Query Handle Operations
  LIST_QUERY_HANDLES: 'wit-list-query-handles',
  SELECT_ITEMS_FROM_QUERY_HANDLE: 'wit-select-items-from-query-handle',
  QUERY_HANDLE_INFO: 'wit-query-handle-info',
  
  // Bulk Operations (unified tool consolidates most operations)
  UNIFIED_BULK_OPERATIONS: 'wit-unified-bulk-operations-by-query-handle',
  LINK_WORK_ITEMS_BY_QUERY_HANDLES: 'wit-link-work-items-by-query-handles',
  BULK_UNDO: 'wit-bulk-undo-by-query-handle',
  FORENSIC_UNDO: 'wit-forensic-undo-by-query-handle',
  
  // AI-Powered Operations
  BULK_ENHANCE_DESCRIPTIONS: 'wit-bulk-enhance-descriptions',
  BULK_ADD_ACCEPTANCE_CRITERIA: 'wit-bulk-add-acceptance-criteria',
  BULK_ASSIGN_STORY_POINTS: 'wit-bulk-assign-story-points',
  ANALYZE_BY_QUERY_HANDLE: 'wit-analyze-by-query-handle',
  
  // Analysis Tools
  EXTRACT_SECURITY_LINKS: 'wit-extract-security-links',
  
  // Discovery Tools
  GET_CONFIGURATION: 'wit-get-configuration',
  GET_PROMPTS: 'wit-get-prompts',
  
  // Integration Tools
  ASSIGN_TO_COPILOT: 'wit-assign-to-copilot',
  NEW_COPILOT_ITEM: 'wit-new-copilot-item',
} as const;

/**
 * Error Sources - Common error source identifiers
 */
export const ERROR_SOURCES = {
  VALIDATION: 'validation',
  AZURE_CLI: 'azure-cli-validation',
  WORK_ITEM_NOT_FOUND: 'work-item-not-found',
  WORK_ITEM_COMPLETED: 'work-item-completed',
  AI_ASSIGNMENT_FAILED: 'ai-assignment-failed',
  AI_ASSIGNMENT_ANALYSIS: 'ai-assignment-analysis',
  SAMPLING_CHECK_FAILED: 'sampling-check-failed',
  QUERY_HANDLE_NOT_FOUND: 'query-handle-not-found',
  QUERY_HANDLE_EXPIRED: 'query-handle-expired',
  BULK_OPERATION_FAILED: 'bulk-operation-failed',
  ADO_API_ERROR: 'ado-api-error',
} as const;

/**
 * Work Item States - Common work item states
 */
export const WORK_ITEM_STATES = {
  NEW: 'New',
  ACTIVE: 'Active',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REMOVED: 'Removed',
  DONE: 'Done',
  COMPLETED: 'Completed',
} as const;

/**
 * Completed states - States that indicate a work item is done
 */
export const COMPLETED_STATES = [
  WORK_ITEM_STATES.DONE,
  WORK_ITEM_STATES.COMPLETED,
  WORK_ITEM_STATES.CLOSED,
  WORK_ITEM_STATES.RESOLVED,
  WORK_ITEM_STATES.REMOVED,
] as const;

/**
 * Work Item Types - Standard Azure DevOps work item types
 */
export const WORK_ITEM_TYPES = {
  BUG: 'Bug',
  TASK: 'Task',
  USER_STORY: 'User Story',
  PRODUCT_BACKLOG_ITEM: 'Product Backlog Item',
  FEATURE: 'Feature',
  EPIC: 'Epic',
  ISSUE: 'Issue',
  TEST_CASE: 'Test Case',
  IMPEDIMENT: 'Impediment',
} as const;

/**
 * Link Relation Types - Work item link relationship types
 */
export const LINK_TYPES = {
  PARENT: 'System.LinkTypes.Hierarchy-Reverse',
  CHILD: 'System.LinkTypes.Hierarchy-Forward',
  RELATED: 'System.LinkTypes.Related',
  PREDECESSOR: 'System.LinkTypes.Dependency-Predecessor',
  SUCCESSOR: 'System.LinkTypes.Dependency-Successor',
  TESTED_BY: 'Microsoft.VSTS.Common.TestedBy-Forward',
  TESTS: 'Microsoft.VSTS.Common.TestedBy-Reverse',
} as const;

/**
 * Configuration Keys - Configuration file keys
 */
export const CONFIG_KEYS = {
  ORGANIZATION: 'organization',
  PROJECT: 'project',
  AREA_PATH: 'areaPath',
  ITERATION_PATH: 'iterationPath',
  COPILOT_GUID: 'copilotGuid',
  DEFAULT_WORK_ITEM_TYPE: 'defaultWorkItemType',
} as const;

/**
 * Timeouts - Operation timeout values in milliseconds
 */
export const TIMEOUTS = {
  AI_ANALYSIS: 30000, // 30 seconds
  API_REQUEST: 30000, // 30 seconds
  BULK_OPERATION: 60000, // 60 seconds
  QUERY_EXECUTION: 30000, // 30 seconds
} as const;

/**
 * Limits - Operational limits
 */
export const LIMITS = {
  MAX_BATCH_SIZE: 200,
  MAX_RETRIES: 3,
  QUERY_HANDLE_EXPIRATION_HOURS: 1,
  MAX_CONTEXT_ITEMS: 50,
  MAX_PREVIEW_ITEMS: 10,
} as const;

/**
 * HTTP Status Codes - Common HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Field Names - Common Azure DevOps field names
 */
export const FIELD_NAMES = {
  ID: 'System.Id',
  TITLE: 'System.Title',
  STATE: 'System.State',
  ASSIGNED_TO: 'System.AssignedTo',
  DESCRIPTION: 'System.Description',
  WORK_ITEM_TYPE: 'System.WorkItemType',
  AREA_PATH: 'System.AreaPath',
  ITERATION_PATH: 'System.IterationPath',
  TAGS: 'System.Tags',
  PRIORITY: 'Microsoft.VSTS.Common.Priority',
  SEVERITY: 'Microsoft.VSTS.Common.Severity',
  STORY_POINTS: 'Microsoft.VSTS.Scheduling.StoryPoints',
  ACCEPTANCE_CRITERIA: 'Microsoft.VSTS.Common.AcceptanceCriteria',
  CREATED_DATE: 'System.CreatedDate',
  CHANGED_DATE: 'System.ChangedDate',
  CREATED_BY: 'System.CreatedBy',
  CHANGED_BY: 'System.ChangedBy',
} as const;

/**
 * Type helper to get const values
 */
export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
export type ErrorSource = typeof ERROR_SOURCES[keyof typeof ERROR_SOURCES];
export type WorkItemState = typeof WORK_ITEM_STATES[keyof typeof WORK_ITEM_STATES];
export type WorkItemType = typeof WORK_ITEM_TYPES[keyof typeof WORK_ITEM_TYPES];
export type LinkType = typeof LINK_TYPES[keyof typeof LINK_TYPES];
export type FieldName = typeof FIELD_NAMES[keyof typeof FIELD_NAMES];
