/**
 * Batch API Integration for Work Item Repository
 * 
 * Extends the work item repository with batch API support for high-performance
 * bulk operations. Transparently falls back to sequential requests if batch API
 * is unavailable or disabled.
 */

import { logger } from '../utils/logger.js';
import { metricsService } from '../services/metrics-service.js';
import { loadConfiguration } from '../config/config.js';
import { BatchClient, createBatchClient } from '../services/batch-client.js';
import { BatchRequestBuilder, splitIntoBatches } from '../utils/batch-request-builder.js';
import type { ADOHttpClient } from '../utils/ado-http-client.js';
import type { ADOWorkItem, ADOFieldOperation, ADOApiResponse } from '../types/index.js';

/**
 * Batch-enabled update operation
 */
export interface BatchUpdateOperation {
  workItemId: number;
  operations: ADOFieldOperation[];
}

/**
 * Batch-enabled comment operation
 */
export interface BatchCommentOperation {
  workItemId: number;
  comment: string;
}

/**
 * Result of batch-enabled operation
 */
export interface BatchEnabledResult<T> {
  succeeded: Array<{ item: T; data: unknown }>;
  failed: Array<{ item: T; error: string }>;
  totalRequests: number;
  usedBatchAPI: boolean;
  usedFallback: boolean;
}

/**
 * Batch-enabled work item operations
 */
export class BatchEnabledWorkItemOperations {
  private httpClient: ADOHttpClient;
  private organization: string;
  private project: string;
  private batchClient: BatchClient | null = null;
  private batchAPIEnabled: boolean;
  private maxBatchSize: number;
  private fallbackOnError: boolean;

  constructor(
    httpClient: ADOHttpClient,
    organization: string,
    project: string
  ) {
    this.httpClient = httpClient;
    this.organization = organization;
    this.project = project;

    // Load batch API configuration
    const config = loadConfiguration();
    this.batchAPIEnabled = config.batchAPI?.enabled ?? false;
    this.maxBatchSize = config.batchAPI?.maxBatchSize ?? 200;
    this.fallbackOnError = config.batchAPI?.fallbackOnError ?? true;

    // Initialize batch client if enabled
    if (this.batchAPIEnabled) {
      this.batchClient = createBatchClient(
        httpClient,
        organization,
        project,
        {
          timeout: config.batchAPI?.timeout ?? 30000,
          maxRetries: 2
        }
      );
    }
  }

  /**
   * Fetch multiple work items using batch API
   */
  async getBatch(workItemIds: number[], fields?: string[]): Promise<ADOWorkItem[]> {
    if (!this.batchAPIEnabled || !this.batchClient) {
      return this.getBatchSequential(workItemIds, fields);
    }

    try {
      // Split into batch-sized chunks
      const chunks = splitIntoBatches(workItemIds, this.maxBatchSize);
      const allWorkItems: ADOWorkItem[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.debug(`Fetching batch ${i + 1}/${chunks.length} (${chunk.length} items) via Batch API`);

        // Build batch request
        const builder = new BatchRequestBuilder(this.organization, this.project, this.maxBatchSize);
        builder.addGetRequests(chunk, fields);

        // Execute batch
        const batchResult = await this.batchClient.executeBatch(builder.build().requests);
        const parsedResult = this.batchClient.parseBatchResult(batchResult, builder.build().requests);

        // Extract work items from successful responses
        for (const result of parsedResult.results) {
          if (result.success && result.data) {
            allWorkItems.push(result.data as ADOWorkItem);
          } else {
            logger.warn(`Failed to fetch work item ${result.workItemId}: ${result.error}`);
          }
        }

        metricsService.increment('batch_api_get_success', 1);
      }

      logger.info(`Batch API: Fetched ${allWorkItems.length} work items in ${chunks.length} request(s) (vs ${workItemIds.length} sequential)`);
      return allWorkItems;

    } catch (error) {
      logger.warn('Batch API fetch failed, falling back to sequential', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      metricsService.increment('batch_api_fallback_total', 1);
      
      if (this.fallbackOnError) {
        return this.getBatchSequential(workItemIds, fields);
      }
      
      throw error;
    }
  }

  /**
   * Update multiple work items using batch API
   */
  async updateBatch(updates: BatchUpdateOperation[]): Promise<BatchEnabledResult<BatchUpdateOperation>> {
    if (!this.batchAPIEnabled || !this.batchClient) {
      return this.updateBatchSequential(updates);
    }

    try {
      // Split into batch-sized chunks
      const chunks = splitIntoBatches(updates, this.maxBatchSize);
      const succeeded: Array<{ item: BatchUpdateOperation; data: unknown }> = [];
      const failed: Array<{ item: BatchUpdateOperation; error: string }> = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.debug(`Updating batch ${i + 1}/${chunks.length} (${chunk.length} items) via Batch API`);

        // Build batch request
        const builder = new BatchRequestBuilder(this.organization, this.project, this.maxBatchSize);
        for (const update of chunk) {
          builder.addPatchRequest(update.workItemId, update.operations);
        }

        // Execute batch
        const batchResult = await this.batchClient.executeBatch(builder.build().requests);
        const parsedResult = this.batchClient.parseBatchResult(batchResult, builder.build().requests);

        // Collect results
        for (let j = 0; j < parsedResult.results.length; j++) {
          const result = parsedResult.results[j];
          const update = chunk[j];

          if (result.success) {
            succeeded.push({ item: update, data: result.data });
          } else {
            failed.push({ item: update, error: result.error || 'Unknown error' });
          }
        }

        metricsService.increment('batch_api_update_success', 1);
      }

      logger.info(`Batch API: Updated ${succeeded.length} work items in ${chunks.length} request(s) (vs ${updates.length} sequential)`);

      return {
        succeeded,
        failed,
        totalRequests: chunks.length,
        usedBatchAPI: true,
        usedFallback: false
      };

    } catch (error) {
      logger.warn('Batch API update failed, falling back to sequential', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      metricsService.increment('batch_api_fallback_total', 1);
      
      if (this.fallbackOnError) {
        return this.updateBatchSequential(updates);
      }
      
      throw error;
    }
  }

  /**
   * Add comments to multiple work items using batch API
   */
  async commentBatch(comments: BatchCommentOperation[]): Promise<BatchEnabledResult<BatchCommentOperation>> {
    if (!this.batchAPIEnabled || !this.batchClient) {
      return this.commentBatchSequential(comments);
    }

    try {
      // Split into batch-sized chunks
      const chunks = splitIntoBatches(comments, this.maxBatchSize);
      const succeeded: Array<{ item: BatchCommentOperation; data: unknown }> = [];
      const failed: Array<{ item: BatchCommentOperation; error: string }> = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.debug(`Adding comments batch ${i + 1}/${chunks.length} (${chunk.length} items) via Batch API`);

        // Build batch request
        const builder = new BatchRequestBuilder(this.organization, this.project, this.maxBatchSize);
        for (const comment of chunk) {
          builder.addCommentRequest(comment.workItemId, comment.comment);
        }

        // Execute batch
        const batchResult = await this.batchClient.executeBatch(builder.build().requests);
        const parsedResult = this.batchClient.parseBatchResult(batchResult, builder.build().requests);

        // Collect results
        for (let j = 0; j < parsedResult.results.length; j++) {
          const result = parsedResult.results[j];
          const comment = chunk[j];

          if (result.success) {
            succeeded.push({ item: comment, data: result.data });
          } else {
            failed.push({ item: comment, error: result.error || 'Unknown error' });
          }
        }

        metricsService.increment('batch_api_comment_success', 1);
      }

      logger.info(`Batch API: Added comments to ${succeeded.length} work items in ${chunks.length} request(s) (vs ${comments.length} sequential)`);

      return {
        succeeded,
        failed,
        totalRequests: chunks.length,
        usedBatchAPI: true,
        usedFallback: false
      };

    } catch (error) {
      logger.warn('Batch API comment failed, falling back to sequential', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      metricsService.increment('batch_api_fallback_total', 1);
      
      if (this.fallbackOnError) {
        return this.commentBatchSequential(comments);
      }
      
      throw error;
    }
  }

  /**
   * Fallback: Fetch work items sequentially
   */
  private async getBatchSequential(workItemIds: number[], fields?: string[]): Promise<ADOWorkItem[]> {
    const BATCH_SIZE = 200; // ADO API limit for GET
    const chunks = splitIntoBatches(workItemIds, BATCH_SIZE);
    const allWorkItems: ADOWorkItem[] = [];

    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const fieldsParam = fields ? `&fields=${encodeURIComponent(fields.join(','))}` : '';
      const response = await this.httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
        `wit/workitems?ids=${ids}${fieldsParam}`
      );
      allWorkItems.push(...(response.data.value || []));
    }

    return allWorkItems;
  }

  /**
   * Fallback: Update work items sequentially
   */
  private async updateBatchSequential(updates: BatchUpdateOperation[]): Promise<BatchEnabledResult<BatchUpdateOperation>> {
    const succeeded: Array<{ item: BatchUpdateOperation; data: unknown }> = [];
    const failed: Array<{ item: BatchUpdateOperation; error: string }> = [];

    for (const update of updates) {
      try {
        const response = await this.httpClient.patch(
          `wit/workItems/${update.workItemId}`,
          update.operations
        );
        succeeded.push({ item: update, data: response.data });
      } catch (error) {
        failed.push({
          item: update,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      succeeded,
      failed,
      totalRequests: updates.length,
      usedBatchAPI: false,
      usedFallback: true
    };
  }

  /**
   * Fallback: Add comments sequentially
   */
  private async commentBatchSequential(comments: BatchCommentOperation[]): Promise<BatchEnabledResult<BatchCommentOperation>> {
    const succeeded: Array<{ item: BatchCommentOperation; data: unknown }> = [];
    const failed: Array<{ item: BatchCommentOperation; error: string }> = [];

    for (const comment of comments) {
      try {
        const response = await this.httpClient.post(
          `wit/workItems/${comment.workItemId}/comments?api-version=7.1-preview.3`,
          {
            text: comment.comment,
            format: 1
          }
        );
        succeeded.push({ item: comment, data: response.data });
      } catch (error) {
        failed.push({
          item: comment,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      succeeded,
      failed,
      totalRequests: comments.length,
      usedBatchAPI: false,
      usedFallback: true
    };
  }

  /**
   * Check if batch API is enabled
   */
  isBatchAPIEnabled(): boolean {
    return this.batchAPIEnabled && this.batchClient !== null;
  }
}

/**
 * Create batch-enabled work item operations instance
 */
export function createBatchEnabledOperations(
  httpClient: ADOHttpClient,
  organization: string,
  project: string
): BatchEnabledWorkItemOperations {
  return new BatchEnabledWorkItemOperations(httpClient, organization, project);
}
