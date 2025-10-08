/**
 * Azure DevOps HTTP Client
 * Provides typed HTTP methods for calling Azure DevOps REST API
 * Uses Node.js native fetch (available since Node 18)
 */

import { getAzureDevOpsToken, clearTokenCache } from "./ado-token.js";
import { logger } from "./logger.js";
import type { ADOErrorResponse } from "../types/ado.js";

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
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
    this.name = "ADOHttpError";
  }
}

/**
 * Azure DevOps HTTP Client
 * Handles authentication, error handling, and common patterns
 */
export class ADOHttpClient {
  private baseUrl: string;
  private organization: string;
  private token: string;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(organization: string, project?: string) {
    this.organization = organization;
    this.baseUrl = project
      ? `https://dev.azure.com/${organization}/${project}/_apis`
      : `https://dev.azure.com/${organization}/_apis`;
    this.token = getAzureDevOpsToken(); // Token retrieval doesn't need organization param
  }

  /**
   * Perform a GET request
   */
  async get<T = unknown>(
    endpoint: string,
    options: Omit<HttpRequestOptions, "method" | "body"> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  /**
   * Perform a POST request
   */
  async post<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<HttpRequestOptions, "method" | "body"> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  /**
   * Perform a PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<HttpRequestOptions, "method" | "body"> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  /**
   * Perform a PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    body: unknown,
    options: Omit<HttpRequestOptions, "method" | "body"> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  /**
   * Perform a DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    options: Omit<HttpRequestOptions, "method" | "body"> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  /**
   * Core request method
   */
  private async request<T = unknown>(
    endpoint: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const {
      method = "GET",
      headers = {},
      body,
      timeout = this.defaultTimeout,
      _isRetry = false,
    } = options;

    // Build full URL
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    // Add api-version if not present
    const urlObj = new URL(url);
    if (!urlObj.searchParams.has("api-version")) {
      urlObj.searchParams.set("api-version", "7.1");
    }

    // Refresh token if this is not already a retry
    if (!_isRetry) {
      this.token = getAzureDevOpsToken();
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      ...headers,
    };

    // Add content-type for requests with body
    if (body && !requestHeaders["Content-Type"]) {
      // Work item operations (create/update) use JSON Patch format for both POST and PATCH
      // JSON Patch documents are arrays of operations
      const isJsonPatch =
        Array.isArray(body) || method === "PATCH" || endpoint.includes("wit/workitems");
      requestHeaders["Content-Type"] = isJsonPatch
        ? "application/json-patch+json"
        : "application/json";
    }

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout),
    };

    // Add body if present
    if (body) {
      requestOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    logger.debug(`${method} ${urlObj.toString()}`);

    try {
      const response = await fetch(urlObj.toString(), requestOptions);

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Handle 401 Unauthorized - token may have expired
      if (response.status === 401 && !_isRetry) {
        logger.info("Received 401 Unauthorized, refreshing token and retrying...");
        // Clear cached token to force fresh retrieval
        clearTokenCache();
        // Retry the request once with fresh token
        return this.request<T>(endpoint, { ...options, _isRetry: true });
      }

      // Read response body
      const responseText = await response.text();
      let responseData: T;

      try {
        responseData = responseText ? JSON.parse(responseText) : ({} as T);
      } catch (parseError) {
        throw new ADOHttpError(
          `Failed to parse response as JSON: ${parseError}`,
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

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      };
    } catch (error) {
      if (error instanceof ADOHttpError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          throw new ADOHttpError(`Request timed out after ${timeout}ms`, 408, "Request Timeout");
        }

        throw new ADOHttpError(`Request failed: ${error.message}`, 0, "Network Error");
      }

      throw new ADOHttpError(`Unknown request error: ${String(error)}`, 0, "Unknown Error");
    }
  }
}

/**
 * Helper function to create an HTTP client for a specific org/project
 */
export function createADOHttpClient(organization: string, project?: string): ADOHttpClient {
  return new ADOHttpClient(organization, project);
}
