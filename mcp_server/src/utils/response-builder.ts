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
  const error = 'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.';
  return {
    success: false,
    data: null,
    metadata: { source: 'sampling-check-failed', samplingAvailable: false },
    errors: [error],
    warnings: []
  };
}
