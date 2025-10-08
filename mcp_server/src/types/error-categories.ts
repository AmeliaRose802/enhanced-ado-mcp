/**
 * Error categorization system for better debugging and monitoring
 * 
 * This module provides structured error categories, codes, and metadata
 * to help classify and handle errors consistently across the MCP server.
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  /** Input validation errors (invalid parameters, schema violations) */
  VALIDATION = 'validation',
  
  /** Authentication/authorization errors (login required, invalid token, insufficient permissions) */
  AUTHENTICATION = 'authentication',
  
  /** Network-related errors (timeouts, connection failures, DNS issues) */
  NETWORK = 'network',
  
  /** Business logic errors (invalid state transitions, constraint violations) */
  BUSINESS_LOGIC = 'business-logic',
  
  /** Resource not found errors (work item, project, repository not found) */
  NOT_FOUND = 'not-found',
  
  /** Rate limiting errors (API throttling, quota exceeded) */
  RATE_LIMIT = 'rate-limit',
  
  /** Permission denied errors (access forbidden, insufficient privileges) */
  PERMISSION_DENIED = 'permission-denied',
  
  /** Unknown or uncategorized errors */
  UNKNOWN = 'unknown'
}

/**
 * Error codes for specific error types
 * Format: ERR_<CATEGORY>_<NUMBER>
 */
export const ErrorCode = {
  // Validation errors (001-099)
  VALIDATION_SCHEMA: 'ERR_VALIDATION_001',
  VALIDATION_REQUIRED_FIELD: 'ERR_VALIDATION_002',
  VALIDATION_INVALID_FORMAT: 'ERR_VALIDATION_003',
  VALIDATION_OUT_OF_RANGE: 'ERR_VALIDATION_004',
  VALIDATION_INVALID_TYPE: 'ERR_VALIDATION_005',
  
  // Authentication errors (100-199)
  AUTH_NOT_LOGGED_IN: 'ERR_AUTH_100',
  AUTH_INVALID_TOKEN: 'ERR_AUTH_101',
  AUTH_TOKEN_EXPIRED: 'ERR_AUTH_102',
  AUTH_CLI_NOT_AVAILABLE: 'ERR_AUTH_103',
  AUTH_INSUFFICIENT_PERMISSIONS: 'ERR_AUTH_104',
  
  // Network errors (200-299)
  NETWORK_TIMEOUT: 'ERR_NETWORK_200',
  NETWORK_CONNECTION_FAILED: 'ERR_NETWORK_201',
  NETWORK_DNS_FAILURE: 'ERR_NETWORK_202',
  NETWORK_UNREACHABLE: 'ERR_NETWORK_203',
  
  // Business logic errors (300-399)
  BUSINESS_INVALID_STATE: 'ERR_BUSINESS_300',
  BUSINESS_CONSTRAINT_VIOLATION: 'ERR_BUSINESS_301',
  BUSINESS_OPERATION_FAILED: 'ERR_BUSINESS_302',
  BUSINESS_INVALID_OPERATION: 'ERR_BUSINESS_303',
  
  // Not found errors (400-499)
  NOT_FOUND_WORK_ITEM: 'ERR_NOT_FOUND_400',
  NOT_FOUND_PROJECT: 'ERR_NOT_FOUND_401',
  NOT_FOUND_REPOSITORY: 'ERR_NOT_FOUND_402',
  NOT_FOUND_QUERY_HANDLE: 'ERR_NOT_FOUND_403',
  NOT_FOUND_RESOURCE: 'ERR_NOT_FOUND_404',
  
  // Rate limit errors (500-599)
  RATE_LIMIT_EXCEEDED: 'ERR_RATE_LIMIT_500',
  RATE_LIMIT_QUOTA_EXCEEDED: 'ERR_RATE_LIMIT_501',
  
  // Permission errors (600-699)
  PERMISSION_DENIED: 'ERR_PERMISSION_600',
  PERMISSION_INSUFFICIENT_ACCESS: 'ERR_PERMISSION_601',
  
  // Unknown errors (900-999)
  UNKNOWN_ERROR: 'ERR_UNKNOWN_900',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Error context data
 * Contains debugging information about the operation that failed
 */
export interface ErrorContext {
  /** Operation being performed */
  operation?: string;
  /** Work item ID if applicable */
  workItemId?: number;
  /** Organization name */
  organization?: string;
  /** Project name */
  project?: string;
  /** Query handle if applicable */
  queryHandle?: string;
  /** Tool name */
  tool?: string;
  /** Additional context fields */
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * Metadata for categorized errors
 */
export interface ErrorMetadata {
  /** Error category */
  category: ErrorCategory;
  
  /** Specific error code */
  code?: ErrorCodeType;
  
  /** Original error if available */
  originalError?: string;
  
  /** Additional context for debugging */
  context?: ErrorContext;
  
  /** Timestamp when error occurred */
  timestamp?: string;
  
  /** Whether error is retryable */
  retryable?: boolean;
  
  /** HTTP status code if applicable */
  httpStatus?: number;
}

/**
 * Categorized error structure
 */
export interface CategorizedError {
  /** Error message */
  message: string;
  
  /** Error metadata */
  metadata: ErrorMetadata;
}

/**
 * Helper to create categorized error metadata
 */
export function createErrorMetadata(
  category: ErrorCategory,
  code?: ErrorCodeType,
  context?: ErrorContext
): ErrorMetadata {
  return {
    category,
    code,
    context,
    timestamp: new Date().toISOString(),
    retryable: isRetryableCategory(category),
  };
}

/**
 * Determine if an error category is typically retryable
 */
function isRetryableCategory(category: ErrorCategory): boolean {
  switch (category) {
    case ErrorCategory.NETWORK:
    case ErrorCategory.RATE_LIMIT:
      return true;
    case ErrorCategory.VALIDATION:
    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.NOT_FOUND:
    case ErrorCategory.PERMISSION_DENIED:
    case ErrorCategory.BUSINESS_LOGIC:
      return false;
    case ErrorCategory.UNKNOWN:
    default:
      return false;
  }
}

/**
 * Map common error patterns to categories
 */
export function categorizeError(error: Error | string): ErrorCategory {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();
  
  // Authentication errors
  if (lowerMessage.includes('not logged in') || 
      lowerMessage.includes('authentication') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('az login')) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  // Not found errors
  if (lowerMessage.includes('not found') ||
      lowerMessage.includes('does not exist')) {
    return ErrorCategory.NOT_FOUND;
  }
  
  // Permission errors
  if (lowerMessage.includes('permission denied') ||
      lowerMessage.includes('access denied') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('insufficient')) {
    return ErrorCategory.PERMISSION_DENIED;
  }
  
  // Network errors
  if (lowerMessage.includes('timeout') ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('enotfound')) {
    return ErrorCategory.NETWORK;
  }
  
  // Rate limit errors
  if (lowerMessage.includes('rate limit') ||
      lowerMessage.includes('throttle') ||
      lowerMessage.includes('quota exceeded')) {
    return ErrorCategory.RATE_LIMIT;
  }
  
  // Validation errors
  if (lowerMessage.includes('validation') ||
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('required') ||
      lowerMessage.includes('must be')) {
    return ErrorCategory.VALIDATION;
  }
  
  // Default to unknown
  return ErrorCategory.UNKNOWN;
}
