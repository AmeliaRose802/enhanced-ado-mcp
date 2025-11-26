/**
 * Retry Utility
 * 
 * Provides retry logic with exponential backoff for handling transient failures
 */

import { logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  
  /** Function to determine if error is retryable (default: all errors retryable) */
  isRetryable?: (error: Error) => boolean;
  
  /** Operation name for logging */
  operationName?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'operationName'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry logic and exponential backoff
 * 
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to operation result
 * @throws Last error if all retries are exhausted
 * 
 * @example
 * const result = await withRetry(
 *   async () => await someApiCall(),
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     isRetryable: (error) => error.message.includes('timeout'),
 *     operationName: 'API call'
 *   }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
  } = { ...DEFAULT_OPTIONS, ...options };
  
  const { isRetryable = () => true, operationName = 'operation' } = options;
  
  let lastError: Error | undefined;
  let delayMs = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry if not first attempt
      if (attempt > 1) {
        logger.info(`${operationName} succeeded on attempt ${attempt}/${maxAttempts}`);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      const shouldRetry = attempt < maxAttempts && isRetryable(lastError);
      
      if (!shouldRetry) {
        logger.debug(`${operationName} failed on attempt ${attempt}/${maxAttempts}, not retrying`);
        throw lastError;
      }
      
      // Log retry attempt
      logger.debug(
        `${operationName} failed on attempt ${attempt}/${maxAttempts}: ${lastError.message}. ` +
        `Retrying in ${delayMs}ms...`
      );
      
      // Wait before next attempt
      await sleep(delayMs);
      
      // Calculate next delay with exponential backoff
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }
  
  // All retries exhausted
  throw lastError;
}

/**
 * Determine if an error is a transient network error that should be retried
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network timeouts and connection issues
  if (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('network') ||
    message.includes('socket hang up')
  ) {
    return true;
  }
  
  // Rate limiting (429) - worth retrying after backoff
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }
  
  // Service unavailable (503)
  if (message.includes('503') || message.includes('service unavailable')) {
    return true;
  }
  
  // Gateway errors (502, 504)
  if (message.includes('502') || message.includes('504') || message.includes('gateway')) {
    return true;
  }
  
  return false;
}

/**
 * Determine if an authentication error is retryable
 * Most auth errors are NOT retryable (user needs to take action)
 */
export function isRetryableAuthError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Token refresh failures might be transient
  if (message.includes('token refresh') || message.includes('refresh token')) {
    return true;
  }
  
  // Network issues during auth should be retried
  if (isTransientError(error)) {
    return true;
  }
  
  // Most other auth errors are NOT retryable:
  // - Not logged in (user needs to run az login)
  // - Token expired (user needs to re-authenticate)
  // - Invalid credentials (user needs to fix credentials)
  // - Permission denied (user needs different permissions)
  
  return false;
}
