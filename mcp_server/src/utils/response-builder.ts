/**
 * Standard response builder for tool execution results
 */

import type { ToolExecutionResult } from '../types/index.js';

export function buildSuccessResponse(data: any, metadata: Record<string, any> = {}): ToolExecutionResult {
  return {
    success: true,
    data,
    metadata: { ...metadata, samplingAvailable: true },
    errors: [],
    warnings: []
  };
}

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

export function buildSamplingUnavailableResponse(): ToolExecutionResult {
  return buildErrorResponse(
    'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.',
    { source: 'sampling-check-failed', samplingAvailable: false }
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
  
  return buildErrorResponse(errorMessage, { source, validationErrorCount: validationError.issues?.length });
}

/**
 * Build Azure CLI error response
 */
export function buildAzureCliErrorResponse(error: { isAvailable: boolean, isLoggedIn: boolean, error?: string }): ToolExecutionResult {
  return buildErrorResponse(error.error || 'Azure CLI validation failed', { source: 'azure-cli-validation' });
}
