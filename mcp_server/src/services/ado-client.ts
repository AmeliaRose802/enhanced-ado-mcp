/**
 * Azure DevOps Client Service
 * 
 * Provides a clean service boundary for ADO API interactions with:
 * - Automatic retry logic with exponential backoff
 * - Rate limiting to respect ADO API limits
 * - Enhanced request/response logging
 * - Token management integration
 */

import { ADOHttpClient, ADOHttpError, HttpResponse, HttpRequestOptions } from '../utils/ado-http-client.js';
import { logger } from '../utils/logger.js';
import { ErrorCategory } from '../types/error-categories.js';

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private readonly maxTokens: number = 100, // Max requests per window
    private readonly refillRate: number = 100, // Tokens to add per minute
    private readonly windowMs: number = 60000 // 1 minute window
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  
  /**
   * Try to acquire a token for making a request
   * @returns true if token acquired, false if rate limited
   */
  tryAcquire(): boolean {
    this.refill();
    
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    
    return false;
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    if (elapsed >= this.windowMs) {
      const tokensToAdd = Math.floor(elapsed / this.windowMs) * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
  
  /**
   * Get time to wait until next token is available (in ms)
   */
  getWaitTime(): number {
    this.refill();
    
    if (this.tokens > 0) {
      return 0;
    }
    
    const timeUntilRefill = this.windowMs - (Date.now() - this.lastRefill);
    return Math.max(0, timeUntilRefill);
  }
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

/**
 * ADO Client Service configuration
 */
export interface ADOClientConfig {
  organization: string;
  project?: string;
  enableRetry?: boolean;
  enableRateLimit?: boolean;
  enableDebugLogging?: boolean;
  retryConfig?: Partial<RetryConfig>;
  rateLimitConfig?: {
    maxRequests?: number;
    windowMs?: number;
  };
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000, // Start with 1 second
  maxDelayMs: 32000, // Max 32 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504] // Timeout, Rate Limit, Server Errors
};

/**
 * Azure DevOps Client Service
 * 
 * Wraps ADOHttpClient with retry logic, rate limiting, and enhanced logging
 */
export class ADOClientService {
  private httpClient: ADOHttpClient;
  private rateLimiter?: RateLimiter;
  private retryConfig: RetryConfig;
  private enableRetry: boolean;
  private enableRateLimit: boolean;
  private enableDebugLogging: boolean;
  
  constructor(config: ADOClientConfig) {
    this.httpClient = new ADOHttpClient(config.organization, config.project);
    this.enableRetry = config.enableRetry !== false; // Default true
    this.enableRateLimit = config.enableRateLimit !== false; // Default true
    this.enableDebugLogging = config.enableDebugLogging === true; // Default false
    
    // Initialize retry config
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retryConfig
    };
    
    // Initialize rate limiter if enabled
    if (this.enableRateLimit) {
      this.rateLimiter = new RateLimiter(
        config.rateLimitConfig?.maxRequests,
        config.rateLimitConfig?.maxRequests,
        config.rateLimitConfig?.windowMs
      );
    }
  }
  
  /**
   * Perform a GET request with retry and rate limiting
   */
  async get<T = unknown>(
    endpoint: string,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.requestWithRetry<T>('GET', endpoint, undefined, options);
  }
  
  /**
   * Perform a POST request with retry and rate limiting
   */
  async post<T = unknown>(
    endpoint: string,
    body: unknown,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.requestWithRetry<T>('POST', endpoint, body, options);
  }
  
  /**
   * Perform a PATCH request with retry and rate limiting
   */
  async patch<T = unknown>(
    endpoint: string,
    body: unknown,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.requestWithRetry<T>('PATCH', endpoint, body, options);
  }
  
  /**
   * Perform a PUT request with retry and rate limiting
   */
  async put<T = unknown>(
    endpoint: string,
    body: unknown,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.requestWithRetry<T>('PUT', endpoint, body, options);
  }
  
  /**
   * Perform a DELETE request with retry and rate limiting
   */
  async delete<T = unknown>(
    endpoint: string,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.requestWithRetry<T>('DELETE', endpoint, undefined, options);
  }
  
  /**
   * Core request method with retry logic and rate limiting
   */
  private async requestWithRetry<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    let lastError: Error | null = null;
    let attempt = 0;
    
    while (attempt <= this.retryConfig.maxRetries) {
      try {
        // Check rate limit
        if (this.enableRateLimit && this.rateLimiter) {
          if (!this.rateLimiter.tryAcquire()) {
            const waitTime = this.rateLimiter.getWaitTime();
            if (this.enableDebugLogging) {
              logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
            }
            
            // Wait for rate limit window
            await this.delay(waitTime);
            
            // Try to acquire token again
            if (!this.rateLimiter.tryAcquire()) {
              throw new ADOHttpError(
                'Rate limit exceeded',
                429,
                'Too Many Requests'
              );
            }
          }
        }
        
        // Log request in debug mode
        if (this.enableDebugLogging) {
          logger.debug(`[ADO Client] ${method} ${endpoint}`, {
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries + 1,
            hasBody: !!body
          });
        }
        
        // Make the request
        const startTime = Date.now();
        let response: HttpResponse<T>;
        
        switch (method) {
          case 'GET':
            response = await this.httpClient.get<T>(endpoint, options);
            break;
          case 'POST':
            response = await this.httpClient.post<T>(endpoint, body, options);
            break;
          case 'PATCH':
            response = await this.httpClient.patch<T>(endpoint, body, options);
            break;
          case 'PUT':
            response = await this.httpClient.put<T>(endpoint, body, options);
            break;
          case 'DELETE':
            response = await this.httpClient.delete<T>(endpoint, options);
            break;
        }
        
        // Log response in debug mode
        if (this.enableDebugLogging) {
          const duration = Date.now() - startTime;
          logger.debug(`[ADO Client] Response received`, {
            status: response.status,
            duration: `${duration}ms`,
            attempt: attempt + 1
          });
        }
        
        return response;
        
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        const shouldRetry = this.shouldRetry(error, attempt);
        
        if (!shouldRetry || attempt >= this.retryConfig.maxRetries) {
          // Log final failure
          if (this.enableDebugLogging) {
            logger.debug(`[ADO Client] Request failed after ${attempt + 1} attempts`, {
              error: error instanceof Error ? error.message : String(error)
            });
          }
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateBackoffDelay(attempt);
        
        if (this.enableDebugLogging) {
          logger.debug(`[ADO Client] Retrying after ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        await this.delay(delay);
        attempt++;
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Request failed after all retries');
  }
  
  /**
   * Determine if an error is retryable
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    if (!this.enableRetry) {
      return false;
    }
    
    if (attempt >= this.retryConfig.maxRetries) {
      return false;
    }
    
    // Check if it's an ADOHttpError with retryable status
    if (error instanceof ADOHttpError) {
      return this.retryConfig.retryableStatuses.includes(error.status);
    }
    
    // Check if it's a network error (non-HTTP error)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Network errors are retryable
      if (message.includes('network') || 
          message.includes('timeout') || 
          message.includes('econnrefused') ||
          message.includes('enotfound') ||
          message.includes('etimedout')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 200; // Add 0-200ms jitter
    const delay = Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);
    return Math.floor(delay);
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get the underlying HTTP client (for advanced use cases)
   */
  getHttpClient(): ADOHttpClient {
    return this.httpClient;
  }
}

/**
 * Create an ADO client service instance
 */
export function createADOClient(config: ADOClientConfig): ADOClientService {
  return new ADOClientService(config);
}
