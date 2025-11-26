/**
 * Cached HTTP Client
 * 
 * Wraps ADOHttpClient with transparent caching layer.
 * Implements cache-aside pattern for GET requests.
 * 
 * Caching Strategy:
 * - Only GET requests are cached (mutations bypass cache)
 * - Cache keys include full URL and query parameters
 * - Supports conditional caching via options
 * - Automatically invalidates on related mutations
 */

import { ADOHttpClient, HttpResponse, HttpRequestOptions } from './ado-http-client.js';
import { cacheService, CacheDataType, CacheService } from '../services/cache-service.js';
import { logger } from './logger.js';

/**
 * Extended request options with caching control
 */
export interface CachedRequestOptions extends HttpRequestOptions {
  cache?: {
    enabled?: boolean;          // Override global cache setting
    ttl?: number;               // Custom TTL for this request
    dataType?: CacheDataType;   // Data type for automatic TTL selection
    key?: string;               // Custom cache key (overrides auto-generated)
    invalidatePattern?: string; // Pattern to invalidate after mutation
  };
}

/**
 * Cached HTTP Client
 * Wraps ADOHttpClient with transparent caching
 */
export class CachedADOHttpClient {
  private httpClient: ADOHttpClient;

  constructor(httpClient: ADOHttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Perform a cached GET request
   */
  async get<T = unknown>(
    endpoint: string,
    options: Omit<CachedRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    const cacheEnabled = options.cache?.enabled !== false;
    
    if (!cacheEnabled) {
      return this.httpClient.get<T>(endpoint, options);
    }
    
    // Generate cache key
    const cacheKey = options.cache?.key || this.generateCacheKey('GET', endpoint);
    
    // Check cache
    const cached = cacheService.get<HttpResponse<T>>(cacheKey);
    if (cached) {
      logger.debug(`[Cache] HIT: ${cacheKey}`);
      return cached;
    }
    
    logger.debug(`[Cache] MISS: ${cacheKey}`);
    
    // Fetch from API
    const response = await this.httpClient.get<T>(endpoint, options);
    
    // Store in cache
    const ttl = options.cache?.ttl;
    const dataType = options.cache?.dataType;
    cacheService.set(cacheKey, response, ttl, dataType);
    
    return response;
  }

  /**
   * Perform a POST request (bypasses cache, may invalidate)
   */
  async post<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<CachedRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    const response = await this.httpClient.post<T>(endpoint, body, options);
    
    // Invalidate related cache entries
    if (options.cache?.invalidatePattern) {
      cacheService.deletePattern(options.cache.invalidatePattern);
    }
    
    return response;
  }

  /**
   * Perform a PATCH request (bypasses cache, may invalidate)
   */
  async patch<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<CachedRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    const response = await this.httpClient.patch<T>(endpoint, body, options);
    
    // Invalidate related cache entries
    if (options.cache?.invalidatePattern) {
      cacheService.deletePattern(options.cache.invalidatePattern);
    }
    
    return response;
  }

  /**
   * Perform a PUT request (bypasses cache, may invalidate)
   */
  async put<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<CachedRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    const response = await this.httpClient.put<T>(endpoint, body, options);
    
    // Invalidate related cache entries
    if (options.cache?.invalidatePattern) {
      cacheService.deletePattern(options.cache.invalidatePattern);
    }
    
    return response;
  }

  /**
   * Perform a DELETE request (bypasses cache, may invalidate)
   */
  async delete<T = unknown>(
    endpoint: string,
    options: Omit<CachedRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    const response = await this.httpClient.delete<T>(endpoint, options);
    
    // Invalidate related cache entries
    if (options.cache?.invalidatePattern) {
      cacheService.deletePattern(options.cache.invalidatePattern);
    }
    
    return response;
  }

  /**
   * Generate a cache key for a request
   */
  private generateCacheKey(method: string, endpoint: string): string {
    // Normalize endpoint to handle both full URLs and relative paths
    const normalizedEndpoint = endpoint.startsWith('http') 
      ? new URL(endpoint).pathname + new URL(endpoint).search
      : endpoint;
    
    return CacheService.generateKey('http', method, normalizedEndpoint);
  }

  /**
   * Access the underlying HTTP client for non-cached operations
   */
  get raw(): ADOHttpClient {
    return this.httpClient;
  }
}

/**
 * Create a cached HTTP client
 */
export function createCachedADOHttpClient(httpClient: ADOHttpClient): CachedADOHttpClient {
  return new CachedADOHttpClient(httpClient);
}
