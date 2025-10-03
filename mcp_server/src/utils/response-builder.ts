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
 */
export function buildValidationErrorResponse(validationError: any, source: string = 'validation'): ToolExecutionResult {
  return buildErrorResponse(`Validation error: ${validationError.message}`, { source });
}

/**
 * Build Azure CLI error response
 */
export function buildAzureCliErrorResponse(error: { isAvailable: boolean, isLoggedIn: boolean, error?: string }): ToolExecutionResult {
  return buildErrorResponse(error.error || 'Azure CLI validation failed', { source: 'azure-cli-validation' });
}
