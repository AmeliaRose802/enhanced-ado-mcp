/**
 * Azure DevOps HTTP Client
 * Provides typed HTTP methods for calling Azure DevOps REST API
 * Uses Node.js native fetch (available since Node 18)
 */

import { logger } from './logger.js';
import { rateLimiter } from '../services/rate-limiter.js';
import { metricsService } from '../services/metrics-service.js';
import { telemetryService } from '../services/telemetry-service.js';
import type { ADOErrorResponse } from '../types/index.js';

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  _isRetry?: boolean; // Internal flag to prevent infinite retry loops
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * ADO HTTP Client Error
 */
export class ADOHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: ADOErrorResponse
  ) {
    super(message);
    this.name = 'ADOHttpError';
  }
}

/**
 * Azure DevOps HTTP Client
 * Handles authentication, error handling, and common patterns
 */
export class ADOHttpClient {
  private baseUrl: string;
  private organization: string;
  private tokenProvider: () => Promise<string>;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(
    organization: string,
    tokenProvider: () => Promise<string>,
    project?: string
  ) {
    this.organization = organization;
    this.tokenProvider = tokenProvider;
    this.baseUrl = project
      ? `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis`
      : `https://dev.azure.com/${encodeURIComponent(organization)}/_apis`;
  }

  /**
   * Perform a GET request
   */
  async get<T = unknown>(
    endpoint: string,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Perform a POST request
   */
  async post<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * Perform a PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * Perform a PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * Perform a DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Core request method
   */
  private async request<T = unknown>(
    endpoint: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      _isRetry = false
    } = options;

    // Build full URL
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    // Add api-version if not present
    const urlObj = new URL(url);
    if (!urlObj.searchParams.has('api-version')) {
      urlObj.searchParams.set('api-version', '7.1');
    }
    
    logger.debug(`[HTTP] Full URL: ${urlObj.toString()}, Org: "${this.organization}"`);

    // Get fresh token from provider
    const token = await this.tokenProvider();

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-TFS-FedAuthRedirect': 'Suppress',  // Suppress federated auth redirects - returns 401/403 instead of 302 (required for DoD/Gov clouds)
      ...headers
    };

    // Add content-type for requests with body
    if (body && !requestHeaders['Content-Type']) {
      // Work item operations (create/update) use JSON Patch format for both POST and PATCH
      // JSON Patch documents are arrays of operations
      const isJsonPatch = Array.isArray(body) || method === 'PATCH' || endpoint.includes('wit/workitems');
      requestHeaders['Content-Type'] = isJsonPatch
        ? 'application/json-patch+json'
        : 'application/json';
    }

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout)
    };

    // Add body if present
    if (body) {
      requestOptions.body = typeof body === 'string'
        ? body
        : JSON.stringify(body);
    }

    logger.debug(`${method} ${urlObj.toString()}`);

    // Apply rate limiting
    await rateLimiter.throttle('ado-api');

    // Track request metrics
    const startTime = Date.now();
    metricsService.increment('ado_api_request', 1, { method, endpoint: endpoint.split('?')[0] });

    try {
      const response = await fetch(urlObj.toString(), requestOptions);
      
      // Record response time
      const duration = Date.now() - startTime;
      metricsService.recordDuration('ado_api_duration', duration, { method, status: String(response.status) });

      // Record telemetry for API call
      telemetryService.recordAPICall(
        method,
        endpoint.split('?')[0],
        duration,
        response.status,
        !response.ok
      );

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Handle 401 Unauthorized - log for debugging
      if (response.status === 401) {
        logger.warn('Received 401 Unauthorized - authentication may have failed');
      }

      // Read response body
      const responseText = await response.text();
      let responseData: T;

      // Check content-type to determine if response is JSON
      const contentType = response.headers.get('content-type') || '';
      const isJsonResponse = contentType.includes('application/json');

      // If not JSON, it's likely an HTML error page
      if (!isJsonResponse && responseText.length > 0) {
        const preview = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
        throw new ADOHttpError(
          `Received non-JSON response (${contentType}). This usually indicates an authentication or authorization error. Response preview: ${preview}`,
          response.status,
          response.statusText
        );
      }

      try {
        responseData = responseText ? JSON.parse(responseText) : ({} as T);
      } catch (parseError) {
        // Include the actual response text in the error to help diagnose the issue
        const preview = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
        throw new ADOHttpError(
          `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. Response was: ${preview}`,
          response.status,
          response.statusText
        );
      }

      // Check for error status
      if (!response.ok) {
        const errorResponse = responseData as unknown as ADOErrorResponse;
        throw new ADOHttpError(
          errorResponse.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          errorResponse
        );
      }

      // Track successful request
      metricsService.increment('ado_api_success', 1, { method });

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      };
    } catch (error) {
      // Track error
      metricsService.increment('ado_api_error', 1, { 
        method, 
        error_type: error instanceof ADOHttpError ? String(error.status) : 'network'
      });

      if (error instanceof ADOHttpError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new ADOHttpError(
            `Request timed out after ${timeout}ms`,
            408,
            'Request Timeout'
          );
        }

        throw new ADOHttpError(
          `Request failed: ${error.message}`,
          0,
          'Network Error'
        );
      }

      throw new ADOHttpError(
        `Unknown request error: ${String(error)}`,
        0,
        'Unknown Error'
      );
    }
  }
}

/**
 * Helper function to create an HTTP client for a specific org/project
 */
export function createADOHttpClient(
  organization: string,
  tokenProvider: () => Promise<string>,
  project?: string
): ADOHttpClient {
  return new ADOHttpClient(organization, tokenProvider, project);
}
