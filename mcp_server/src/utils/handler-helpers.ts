/**
 * Common handler utilities to reduce boilerplate
 */

import { ZodSchema } from 'zod';
import { ToolExecutionResult } from '../types/index.js';
import { validateAzureCLI } from './azure-cli-validator.js';
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from './response-builder.js';

/**
 * Validate Azure CLI and parse arguments in one step
 * Returns null if validation succeeds, otherwise returns error response
 */
export function validateAndParse<T>(
  schema: ZodSchema<T>,
  args: unknown
): { success: true; data: T } | { success: false; error: ToolExecutionResult } {
  const azValidation = validateAzureCLI();
  if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
    return { success: false, error: buildAzureCliErrorResponse(azValidation) };
  }

  const parsed = schema.safeParse(args || {});
  if (!parsed.success) {
    return { success: false, error: buildValidationErrorResponse(parsed.error) };
  }

  return { success: true, data: parsed.data };
}
