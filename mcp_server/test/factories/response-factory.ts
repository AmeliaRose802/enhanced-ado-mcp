/**
 * Response Factory
 * 
 * Provides flexible factory functions to create tool execution results and ADO API responses.
 */

import type { ToolExecutionResult, ToolExecutionData, ToolExecutionMetadata } from '../../src/types/index.js';
import type { ADOWorkItemsBatch, ADOWiqlResult } from '../../src/types/ado.js';
import type { ADOWorkItem } from '../../src/types/ado.js';

/**
 * Options for creating tool execution results
 */
export interface ToolExecutionResultOptions {
  success?: boolean;
  data?: ToolExecutionData;
  errors?: string[];
  warnings?: string[];
  metadata?: Partial<ToolExecutionMetadata>;
  raw?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };
}

/**
 * Creates a successful tool execution result
 * 
 * @example
 * ```typescript
 * const result = createSuccessResult({
 *   workItemId: 1001,
 *   title: 'Test Item'
 * });
 * ```
 */
export function createSuccessResult(data: ToolExecutionData = {}): ToolExecutionResult {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString()
    },
    errors: [],
    warnings: []
  };
}

/**
 * Creates a failed tool execution result
 * 
 * @example
 * ```typescript
 * const result = createErrorResult('Item not found', {
 *   workItemId: 9999
 * });
 * ```
 */
export function createErrorResult(
  error: string,
  data: ToolExecutionData = null
): ToolExecutionResult {
  return {
    success: false,
    data,
    metadata: {
      timestamp: new Date().toISOString()
    },
    errors: [error],
    warnings: []
  };
}

/**
 * Creates a tool execution result with custom options
 * 
 * @example
 * ```typescript
 * const result = createToolExecutionResult({
 *   success: true,
 *   data: { count: 5 },
 *   warnings: ['Some items were skipped'],
 *   metadata: { tool: 'bulk-update' }
 * });
 * ```
 */
export function createToolExecutionResult(
  options: ToolExecutionResultOptions = {}
): ToolExecutionResult {
  return {
    success: options.success ?? true,
    data: options.data ?? null,
    metadata: {
      timestamp: new Date().toISOString(),
      ...options.metadata
    },
    errors: options.errors ?? [],
    warnings: options.warnings ?? [],
    raw: options.raw
  };
}

/**
 * Creates an ADO work items batch response
 * 
 * @example
 * ```typescript
 * const batch = createWorkItemsBatch([workItem1, workItem2, workItem3]);
 * ```
 */
export function createWorkItemsBatch(workItems: ADOWorkItem[]): ADOWorkItemsBatch {
  return {
    count: workItems.length,
    value: workItems
  };
}

/**
 * Creates a mock HTTP response for ADO API calls
 * 
 * @example
 * ```typescript
 * const response = createMockHttpResponse(workItem, 200);
 * ```
 */
export function createMockHttpResponse<T>(
  data: T,
  status = 200,
  statusText = 'OK'
): {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
} {
  return {
    data,
    status,
    statusText,
    headers: {
      'content-type': 'application/json'
    }
  };
}

/**
 * Creates a mock error HTTP response
 * 
 * @example
 * ```typescript
 * const error = createMockErrorResponse('Not Found', 404);
 * ```
 */
export function createMockErrorResponse(
  message: string,
  status = 500
): Error & { response?: { status: number; statusText: string; data: { message: string } } } {
  const error: any = new Error(message);
  error.response = {
    status,
    statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
    data: { message }
  };
  return error;
}

/**
 * Creates a bulk operation result
 * 
 * @example
 * ```typescript
 * const result = createBulkOperationResult({
 *   totalItems: 10,
 *   successCount: 8,
 *   failureCount: 2
 * });
 * ```
 */
export function createBulkOperationResult(options: {
  totalItems: number;
  successCount: number;
  failureCount?: number;
  results?: Array<{
    workItemId: number;
    success: boolean;
    error?: string;
    data?: string | number | boolean | null;
  }>;
}): ToolExecutionData {
  const failureCount = options.failureCount ?? (options.totalItems - options.successCount);
  
  return {
    success: failureCount === 0,
    totalItems: options.totalItems,
    successCount: options.successCount,
    failureCount,
    results: options.results ?? [],
    summary: `${options.successCount} of ${options.totalItems} items processed successfully`
  } as ToolExecutionData;
}

/**
 * Creates a query handle response
 * 
 * @example
 * ```typescript
 * const response = createQueryHandleResponse('qh-12345', 5);
 * ```
 */
export function createQueryHandleResponse(
  handle: string,
  itemCount: number
): ToolExecutionData {
  return {
    query_handle: handle,
    item_count: itemCount,
    expires_at: new Date(Date.now() + 60000).toISOString(),
    message: `Query handle created with ${itemCount} items`
  };
}

/**
 * Creates validation errors for schema validation failures
 * 
 * @example
 * ```typescript
 * const errors = createValidationErrors([
 *   { field: 'workItemId', message: 'Required field missing' }
 * ]);
 * ```
 */
export function createValidationErrors(
  errors: Array<{ field: string; message: string }>
): string[] {
  return errors.map(e => `${e.field}: ${e.message}`);
}

/**
 * Creates a mock ADO API response with pagination
 * 
 * @example
 * ```typescript
 * const response = createPaginatedResponse(workItems, 0, 10, 100);
 * ```
 */
export function createPaginatedResponse<T>(
  items: T[],
  skip: number,
  top: number,
  totalCount: number
): {
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
} {
  const hasMore = skip + top < totalCount;
  
  return {
    '@odata.count': totalCount,
    ...(hasMore ? {
      '@odata.nextLink': `https://analytics.dev.azure.com/test-org/_odata/v3.0-preview/WorkItems?$skip=${skip + top}&$top=${top}`
    } : {}),
    value: items.slice(skip, skip + top)
  };
}

/**
 * Creates a mock Azure CLI execution result
 * 
 * @example
 * ```typescript
 * const result = createAzCliResult({ accessToken: 'token-123' });
 * ```
 */
export function createAzCliResult(data: unknown): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return {
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0
  };
}

/**
 * Creates a mock Azure CLI error result
 * 
 * @example
 * ```typescript
 * const error = createAzCliError('Not logged in');
 * ```
 */
export function createAzCliError(message: string): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  return {
    stdout: '',
    stderr: `ERROR: ${message}`,
    exitCode: 1
  };
}

/**
 * Creates a context package response
 * 
 * @example
 * ```typescript
 * const pkg = createContextPackageResponse(1001, {
 *   title: 'Test Item',
 *   type: 'Task'
 * });
 * ```
 */
export function createContextPackageResponse(
  workItemId: number,
  overrides: Record<string, unknown> = {}
): ToolExecutionData {
  return {
    id: workItemId,
    title: 'Test Work Item',
    type: 'Task',
    state: 'New',
    url: `https://dev.azure.com/test-org/test-project/_workitems/edit/${workItemId}`,
    ...overrides
  };
}
