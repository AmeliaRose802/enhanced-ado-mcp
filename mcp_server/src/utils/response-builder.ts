/**
 * Standard response builder for tool execution results
 */

import type { ToolExecutionResult } from '../types/index.js';

/**
 * Build a successful response with data
 * @param data - The response data
 * @param metadata - Additional metadata for debugging
 * @returns ToolExecutionResult with success: true
 */
export function buildSuccessResponse(data: any, metadata: Record<string, any> = {}): ToolExecutionResult {
  return {
    success: true,
    data,
    metadata: { ...metadata, samplingAvailable: true },
    errors: [],
    warnings: []
  };
}

/**
 * Build a successful response with warnings
 * @param data - The response data
 * @param warnings - Array of warning messages
 * @param metadata - Additional metadata for debugging
 * @returns ToolExecutionResult with success: true and warnings
 */
export function buildSuccessResponseWithWarnings(
  data: any, 
  warnings: string[], 
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return {
    success: true,
    data,
    metadata: { ...metadata, samplingAvailable: true },
    errors: [],
    warnings
  };
}

/**
 * Build an error response
 * @param error - Error message or Error object
 * @param metadata - Additional metadata for debugging
 * @returns ToolExecutionResult with success: false
 */
export function buildErrorResponse(error: string | Error, metadata: Record<string, any> = {}): ToolExecutionResult {
  const errorMsg = error instanceof Error ? error.message : error;
  return {
    success: false,
    data: null,
    metadata: { ...metadata, samplingAvailable: true },
    errors: [errorMsg],
    warnings: []
  };
}

/**
 * Build an error response with multiple errors
 * @param errors - Array of error messages or Error objects
 * @param metadata - Additional metadata for debugging
 * @returns ToolExecutionResult with success: false
 */
export function buildMultiErrorResponse(
  errors: (string | Error)[], 
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  const errorMessages = errors.map(e => e instanceof Error ? e.message : e);
  return {
    success: false,
    data: null,
    metadata: { ...metadata, samplingAvailable: true },
    errors: errorMessages,
    warnings: []
  };
}

/**
 * Build a partial success response (some operations succeeded, some failed)
 * @param data - The response data (typically includes success/failure counts)
 * @param errors - Array of error messages for failed operations
 * @param warnings - Array of warning messages
 * @param metadata - Additional metadata for debugging
 * @returns ToolExecutionResult with success: false (due to errors) but with partial data
 */
export function buildPartialSuccessResponse(
  data: any,
  errors: string[],
  warnings: string[] = [],
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  return {
    success: false,
    data,
    metadata: { ...metadata, samplingAvailable: true },
    errors,
    warnings
  };
}

/**
 * Build a response for when sampling is unavailable
 * @returns ToolExecutionResult indicating sampling is not available
 */
export function buildSamplingUnavailableResponse(): ToolExecutionResult {
  return buildErrorResponse(
    'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.',
    { source: 'sampling-check-failed', samplingAvailable: false }
  );
}

/**
 * Build validation error response for tool handlers
 * Formats Zod validation errors with actionable guidance for AI agents
 * @param validationError - Zod validation error or generic error
 * @param source - Source identifier for metadata (default: 'validation')
 * @returns ToolExecutionResult with formatted validation error
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
  
  return buildErrorResponse(errorMessage, { source, validationErrorCount: validationError.issues?.length });
}

/**
 * Build Azure CLI error response
 * @param error - Azure CLI validation error
 * @returns ToolExecutionResult with Azure CLI error details
 */
export function buildAzureCliErrorResponse(error: { isAvailable: boolean, isLoggedIn: boolean, error?: string }): ToolExecutionResult {
  return buildErrorResponse(error.error || 'Azure CLI validation failed', { source: 'azure-cli-validation' });
}

/**
 * Build error response from caught exception in handler catch blocks
 * Standardizes error extraction and formatting
 * @param error - The caught error (unknown type)
 * @param handlerName - Name of the handler for metadata
 * @param metadata - Additional metadata for debugging
 * @returns ToolExecutionResult with formatted error
 */
export function buildCatchErrorResponse(
  error: unknown, 
  handlerName: string,
  metadata: Record<string, any> = {}
): ToolExecutionResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return buildErrorResponse(errorMessage, { source: handlerName, ...metadata });
}
