/**
 * Error Builder Utility for Consistent Error Handling
 * 
 * Provides a fluent API for constructing structured, actionable error responses
 * with categorization, context, and recovery suggestions.
 */

export enum ErrorCategory {
  /** Validation errors (invalid input, missing required fields) */
  VALIDATION = 'validation',
  /** Authentication errors (not logged in, invalid credentials) */
  AUTHENTICATION = 'authentication',
  /** Authorization errors (insufficient permissions) */
  AUTHORIZATION = 'authorization',
  /** Azure DevOps API errors (work item not found, API failures) */
  API = 'api',
  /** Network errors (timeouts, connection failures) */
  NETWORK = 'network',
  /** Internal server errors (unexpected exceptions) */
  INTERNAL = 'internal',
  /** AI/Sampling errors (LLM unavailable, timeout) */
  AI = 'ai',
  /** Configuration errors (invalid config, missing setup) */
  CONFIGURATION = 'configuration',
  /** Query errors (invalid WIQL, expired handle) */
  QUERY = 'query'
}

interface ErrorContext {
  [key: string]: unknown;
}

interface StructuredError {
  category: ErrorCategory;
  message: string;
  context?: ErrorContext;
  suggestion?: string;
  recoveryAction?: string;
  originalError?: Error;
}

/**
 * ErrorBuilder - Fluent API for constructing structured errors
 * 
 * @example
 * ```typescript
 * return ErrorBuilder.validationError()
 *   .withMessage("Missing required field: 'workItemId'")
 *   .withContext({ field: 'workItemId' })
 *   .withSuggestion("Provide a valid work item ID")
 *   .build();
 * ```
 */
export class ErrorBuilder {
  private error: StructuredError;

  private constructor(category: ErrorCategory) {
    this.error = {
      category,
      message: ''
    };
  }

  // Factory methods for common error types
  static validationError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.VALIDATION);
  }

  static authenticationError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.AUTHENTICATION);
  }

  static authorizationError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.AUTHORIZATION);
  }

  static apiError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.API);
  }

  static networkError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.NETWORK);
  }

  static internalError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.INTERNAL);
  }

  static aiError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.AI);
  }

  static configurationError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.CONFIGURATION);
  }

  static queryError(): ErrorBuilder {
    return new ErrorBuilder(ErrorCategory.QUERY);
  }

  /**
   * Set the error message
   */
  withMessage(message: string): ErrorBuilder {
    this.error.message = message;
    return this;
  }

  /**
   * Add contextual information about the error
   */
  withContext(context: ErrorContext): ErrorBuilder {
    this.error.context = { ...this.error.context, ...context };
    return this;
  }

  /**
   * Add a suggestion for how to resolve the error
   */
  withSuggestion(suggestion: string): ErrorBuilder {
    this.error.suggestion = suggestion;
    return this;
  }

  /**
   * Add a specific recovery action the user can take
   */
  withRecoveryAction(action: string): ErrorBuilder {
    this.error.recoveryAction = action;
    return this;
  }

  /**
   * Include the original error for debugging
   */
  withOriginalError(error: Error): ErrorBuilder {
    this.error.originalError = error;
    this.error.context = {
      ...this.error.context,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    };
    return this;
  }

  /**
   * Build the final error message string
   */
  build(): string {
    const parts: string[] = [];

    // Category prefix
    parts.push(`[${this.error.category.toUpperCase()}]`);

    // Main message
    parts.push(this.error.message);

    // Context (if present)
    if (this.error.context) {
      const contextStr = Object.entries(this.error.context)
        .filter(([key]) => !['errorName', 'errorMessage', 'stack'].includes(key))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      if (contextStr) {
        parts.push(`Context: ${contextStr}`);
      }
    }

    // Suggestion
    if (this.error.suggestion) {
      parts.push(`Suggestion: ${this.error.suggestion}`);
    }

    // Recovery action
    if (this.error.recoveryAction) {
      parts.push(`Action: ${this.error.recoveryAction}`);
    }

    return parts.join(' | ');
  }

  /**
   * Build and return the structured error object (for metadata/logging)
   */
  buildStructured(): StructuredError {
    return { ...this.error };
  }
}

/**
 * Helper function to convert common errors to structured format
 */
export function categorizeError(error: unknown): StructuredError {
  if (error instanceof Error) {
    // Check error message patterns to determine category
    const message = error.message.toLowerCase();

    if (message.includes('not found') || message.includes('404')) {
      return ErrorBuilder.apiError()
        .withMessage(error.message)
        .withOriginalError(error)
        .withSuggestion('Verify the resource exists and you have access to it')
        .buildStructured();
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return ErrorBuilder.authenticationError()
        .withMessage(error.message)
        .withOriginalError(error)
        .withSuggestion('Run `az login` to authenticate with Azure')
        .buildStructured();
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return ErrorBuilder.authorizationError()
        .withMessage(error.message)
        .withOriginalError(error)
        .withSuggestion('Check that you have the required permissions')
        .buildStructured();
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorBuilder.networkError()
        .withMessage(error.message)
        .withOriginalError(error)
        .withSuggestion('Check your network connection and try again')
        .buildStructured();
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorBuilder.validationError()
        .withMessage(error.message)
        .withOriginalError(error)
        .buildStructured();
    }

    // Default to internal error
    return ErrorBuilder.internalError()
      .withMessage(error.message)
      .withOriginalError(error)
      .buildStructured();
  }

  // Non-Error objects
  return ErrorBuilder.internalError()
    .withMessage(String(error))
    .buildStructured();
}

/**
 * Format error for ToolExecutionResult
 */
export function formatErrorForTool(error: unknown, operation?: string): string {
  const structured = categorizeError(error);
  
  // Map category to factory method
  let builder: ErrorBuilder;
  switch (structured.category) {
    case ErrorCategory.VALIDATION:
      builder = ErrorBuilder.validationError();
      break;
    case ErrorCategory.AUTHENTICATION:
      builder = ErrorBuilder.authenticationError();
      break;
    case ErrorCategory.AUTHORIZATION:
      builder = ErrorBuilder.authorizationError();
      break;
    case ErrorCategory.API:
      builder = ErrorBuilder.apiError();
      break;
    case ErrorCategory.NETWORK:
      builder = ErrorBuilder.networkError();
      break;
    case ErrorCategory.AI:
      builder = ErrorBuilder.aiError();
      break;
    case ErrorCategory.CONFIGURATION:
      builder = ErrorBuilder.configurationError();
      break;
    case ErrorCategory.QUERY:
      builder = ErrorBuilder.queryError();
      break;
    default:
      builder = ErrorBuilder.internalError();
  }

  builder.withMessage(structured.message);

  if (operation) {
    builder.withContext({ operation });
  }

  if (structured.suggestion) {
    builder.withSuggestion(structured.suggestion);
  }

  if (structured.recoveryAction) {
    builder.withRecoveryAction(structured.recoveryAction);
  }

  return builder.build();
}

