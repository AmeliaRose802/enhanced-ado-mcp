/**
 * Azure DevOps Batch API Client
 * 
 * Executes batch requests using the Azure DevOps Batch API endpoint.
 * Handles response parsing, error mapping, and retry logic.
 */

import type { ADOHttpClient } from '../utils/ado-http-client.js';
import { logger } from '../utils/logger.js';
import { metricsService } from './metrics-service.js';
import type { 
  BatchRequest, 
  BatchResponse, 
  BatchResult 
} from '../utils/batch-request-builder.js';
import { validateBatchResponse } from '../utils/batch-request-builder.js';

/**
 * Result of batch operation with per-item status
 */
export interface BatchOperationResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  results: Array<{
    index: number;
    workItemId?: number;
    operationType?: string;
    success: boolean;
    statusCode: number;
    data?: unknown;
    error?: string;
  }>;
}

/**
 * Batch client options
 */
export interface BatchClientOptions {
  timeout?: number;
  maxRetries?: number;
  retryableStatuses?: number[];
}

/**
 * Azure DevOps Batch API Client
 */
export class BatchClient {
  private readonly httpClient: ADOHttpClient;
  private readonly organization: string;
  private readonly project: string;
  private readonly defaultTimeout: number = 30000; // 30 seconds
  private readonly defaultRetries: number = 2;
  private readonly retryableStatuses: number[] = [429, 500, 502, 503, 504];

  constructor(
    httpClient: ADOHttpClient,
    organization: string,
    project: string,
    options?: BatchClientOptions
  ) {
    this.httpClient = httpClient;
    this.organization = organization;
    this.project = project;
    
    if (options?.timeout) {
      this.defaultTimeout = options.timeout;
    }
    if (options?.maxRetries !== undefined) {
      this.defaultRetries = options.maxRetries;
    }
    if (options?.retryableStatuses) {
      this.retryableStatuses = options.retryableStatuses;
    }
  }

  /**
   * Execute a batch request
   */
  async executeBatch(requests: BatchRequest[]): Promise<BatchResult> {
    if (requests.length === 0) {
      throw new Error('Cannot execute batch with no requests');
    }

    if (requests.length > 200) {
      throw new Error(`Batch size ${requests.length} exceeds maximum 200`);
    }

    const startTime = Date.now();
    logger.info(`Executing batch request with ${requests.length} operations`);

    // Track metrics
    metricsService.increment('batch_api_requests_total', 1);
    metricsService.increment('batch_api_operations_total', requests.length);

    try {
      // Build batch request payload
      const batchPayload = {
        requests: requests.map(req => ({
          method: req.method,
          uri: req.uri,
          headers: req.headers,
          body: req.body
        }))
      };

      // Execute batch request
      const response = await this.httpClient.post<BatchResult>(
        `wit/$batch?api-version=7.1-preview`,
        batchPayload,
        { timeout: this.defaultTimeout }
      );

      // Validate response
      if (!validateBatchResponse(response.data)) {
        throw new Error('Invalid batch response format');
      }

      const duration = Date.now() - startTime;
      metricsService.recordDuration('batch_api_duration_ms', duration);

      logger.info(`Batch request completed`, {
        operations: requests.length,
        duration,
        responses: response.data.count
      });

      return response.data;

    } catch (error) {
      metricsService.increment('batch_api_failures_total', 1);
      
      const duration = Date.now() - startTime;
      logger.error(`Batch request failed after ${duration}ms`, {
        operations: requests.length,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Execute batch with retry logic
   */
  async executeBatchWithRetry(
    requests: BatchRequest[],
    options?: { maxRetries?: number; retryableStatuses?: number[] }
  ): Promise<BatchResult> {
    const maxRetries = options?.maxRetries ?? this.defaultRetries;
    const retryableStatuses = options?.retryableStatuses ?? this.retryableStatuses;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.info(`Retrying batch request (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await this.executeBatch(requests);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, retryableStatuses);
        
        if (!isRetryable || attempt === maxRetries) {
          throw lastError;
        }
        
        logger.warn(`Batch request failed (attempt ${attempt + 1}), will retry`, {
          error: lastError.message
        });
      }
    }

    throw lastError || new Error('Batch request failed after retries');
  }

  /**
   * Parse batch result into operation result
   */
  parseBatchResult(
    batchResult: BatchResult,
    originalRequests: BatchRequest[]
  ): BatchOperationResult {
    const results: BatchOperationResult['results'] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchResult.value.length; i++) {
      const response = batchResult.value[i];
      const originalRequest = originalRequests[i];
      const isSuccess = response.code >= 200 && response.code < 300;

      if (isSuccess) {
        successCount++;
      } else {
        failCount++;
      }

      results.push({
        index: i,
        workItemId: originalRequest.metadata?.workItemId,
        operationType: originalRequest.metadata?.operationType,
        success: isSuccess,
        statusCode: response.code,
        data: isSuccess ? response.body : undefined,
        error: !isSuccess ? this.extractErrorMessage(response.body) : undefined
      });
    }

    return {
      totalRequests: batchResult.count,
      successfulRequests: successCount,
      failedRequests: failCount,
      results
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return retryableStatuses.includes(status);
    }
    return false;
  }

  /**
   * Extract error message from response body
   */
  private extractErrorMessage(body: unknown): string {
    if (!body) {
      return 'Unknown error';
    }

    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object') {
      const errorBody = body as Record<string, unknown>;
      
      if (errorBody.message && typeof errorBody.message === 'string') {
        return errorBody.message;
      }
      
      if (errorBody.error && typeof errorBody.error === 'object') {
        const errorObj = errorBody.error as Record<string, unknown>;
        if (errorObj.message && typeof errorObj.message === 'string') {
          return errorObj.message;
        }
      }
    }

    return JSON.stringify(body);
  }

  /**
   * Check if batch API is supported
   */
  async detectBatchAPISupport(): Promise<boolean> {
    try {
      // Try a minimal batch request
      const testRequest: BatchRequest = {
        method: 'GET',
        uri: '/_apis?api-version=7.1',
        headers: { 'Accept': 'application/json' }
      };

      await this.executeBatch([testRequest]);
      return true;
    } catch (error) {
      logger.warn('Batch API detection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

/**
 * Helper to create a batch client instance
 */
export function createBatchClient(
  httpClient: ADOHttpClient,
  organization: string,
  project: string,
  options?: BatchClientOptions
): BatchClient {
  return new BatchClient(httpClient, organization, project, options);
}
