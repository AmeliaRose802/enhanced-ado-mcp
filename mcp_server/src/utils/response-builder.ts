/**
 * Standard response builder for tool execution results
 */

import type { ToolExecutionResult, JSONValue } from '../types/index.js';
import { ErrorCategory, ErrorCode, type ErrorMetadata, createErrorMetadata, categorizeError } from '../types/error-categories.js';

export function buildSuccessResponse(data: any, metadata: Record<string, any> = {}): ToolExecutionResult {
  return {
    success: true,
    data,
    metadata: { ...metadata, samplingAvailable: true },
    errors: [],
    warnings: []
  };
}

export function buildErrorResponse(
  error: string | Error, 
  metadata: Record<string, any> = {},
  category?: ErrorCategory,
  code?: typeof ErrorCode[keyof typeof ErrorCode]
): ToolExecutionResult {
  const errorMsg = error instanceof Error ? error.message : error;
  
  // Auto-categorize if category not provided
  const errorCategory = category ?? categorizeError(errorMsg);
  
  // Create error metadata
  const errorMetadata: ErrorMetadata = createErrorMetadata(
    errorCategory,
    code,
    metadata
  );
  
  return {
    success: false,
    data: null,
    metadata: { 
      ...metadata, 
      samplingAvailable: true,
      errorCategory: errorCategory,
      errorCode: code,
      errorMetadata: errorMetadata as unknown as JSONValue
    },
    errors: [errorMsg],
    warnings: []
  };
}

export function buildSamplingUnavailableResponse(): ToolExecutionResult {
  return buildErrorResponse(
    'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.',
    { source: 'sampling-check-failed', samplingAvailable: false },
    ErrorCategory.BUSINESS_LOGIC,
    ErrorCode.BUSINESS_OPERATION_FAILED
  );
}

/**
 * Build validation error response for tool handlers
 * Formats Zod validation errors with actionable guidance for AI agents
 */
export function buildValidationErrorResponse(validationError: any, source: string = 'validation'): ToolExecutionResult {
  // Format Zod errors with detailed field-level information
  let errorMessage = 'Validation error:\n';
  
  if (validationError.issues && Array.isArray(validationError.issues)) {
    // Zod error with multiple issues
    const formattedIssues = validationError.issues.map((issue: any) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      const message = issue.message;
      
      // Add context about what was received vs what was expected
      let details = '';
      if (issue.received !== undefined) {
        details = ` (received: ${JSON.stringify(issue.received)})`;
      }
      
      return `  • ${path}: ${message}${details}`;
    });
    
    errorMessage += formattedIssues.join('\n');
    
    // Add helpful hint at the end
    errorMessage += '\n\n💡 Tip: Check parameter types and constraints. See tool description for valid values.';
  } else {
    // Fallback for non-Zod errors
    errorMessage = `Validation error: ${validationError.message || String(validationError)}`;
  }
  
  return buildErrorResponse(
    errorMessage, 
    { source, validationErrorCount: validationError.issues?.length },
    ErrorCategory.VALIDATION,
    ErrorCode.VALIDATION_SCHEMA
  );
}

/**
 * Build Azure CLI error response
 */
export function buildAzureCliErrorResponse(error: { isAvailable: boolean, isLoggedIn: boolean, error?: string }): ToolExecutionResult {
  const errorMsg = error.error || 'Azure CLI validation failed';
  const category = !error.isAvailable ? ErrorCategory.BUSINESS_LOGIC : ErrorCategory.AUTHENTICATION;
  const code = !error.isAvailable ? ErrorCode.AUTH_CLI_NOT_AVAILABLE : ErrorCode.AUTH_NOT_LOGGED_IN;
  
  return buildErrorResponse(
    errorMsg, 
    { source: 'azure-cli-validation' },
    category,
    code
  );
}

// =============================================================================
// Helper functions for creating categorized errors
// =============================================================================

/**
 * Build authentication error response
 */
export function buildAuthenticationError(
  message: string,
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return buildErrorResponse(
    message,
    metadata,
    ErrorCategory.AUTHENTICATION,
    ErrorCode.AUTH_NOT_LOGGED_IN
  );
}

/**
 * Build network error response
 */
export function buildNetworkError(
  message: string,
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return buildErrorResponse(
    message,
    metadata,
    ErrorCategory.NETWORK,
    ErrorCode.NETWORK_CONNECTION_FAILED
  );
}

/**
 * Build not found error response
 */
export function buildNotFoundError(
  resourceType: string,
  resourceId: string | number,
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  const codeMap: Record<string, typeof ErrorCode[keyof typeof ErrorCode]> = {
    'work-item': ErrorCode.NOT_FOUND_WORK_ITEM,
    'project': ErrorCode.NOT_FOUND_PROJECT,
    'repository': ErrorCode.NOT_FOUND_REPOSITORY,
    'query-handle': ErrorCode.NOT_FOUND_QUERY_HANDLE,
  };
  
  const code = codeMap[resourceType.toLowerCase()] || ErrorCode.NOT_FOUND_RESOURCE;
  
  return buildErrorResponse(
    `${resourceType} '${resourceId}' not found`,
    { ...metadata, resourceType, resourceId },
    ErrorCategory.NOT_FOUND,
    code
  );
}

/**
 * Build business logic error response
 */
export function buildBusinessLogicError(
  message: string,
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return buildErrorResponse(
    message,
    metadata,
    ErrorCategory.BUSINESS_LOGIC,
    ErrorCode.BUSINESS_OPERATION_FAILED
  );
}

/**
 * Build rate limit error response
 */
export function buildRateLimitError(
  message: string = 'Rate limit exceeded. Please try again later.',
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return buildErrorResponse(
    message,
    metadata,
    ErrorCategory.RATE_LIMIT,
    ErrorCode.RATE_LIMIT_EXCEEDED
  );
}

/**
 * Build permission denied error response
 */
export function buildPermissionError(
  message: string,
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return buildErrorResponse(
    message,
    metadata,
    ErrorCategory.PERMISSION_DENIED,
    ErrorCode.PERMISSION_DENIED
  );
}

