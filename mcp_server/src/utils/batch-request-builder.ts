/**
 * Azure DevOps Batch Request Builder
 * 
 * Constructs batch API requests for multiple work item operations.
 * Supports GET, POST, PATCH, and DELETE operations with automatic
 * URI formatting and header management.
 */

import type { ADOFieldOperation } from '../types/index.js';
import { logger } from './logger.js';

/**
 * Individual batch request
 */
export interface BatchRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  uri: string;
  headers?: Record<string, string>;
  body?: unknown;
  metadata?: {
    workItemId?: number;
    operationType?: string;
    index?: number;
  };
}

/**
 * Batch response from Azure DevOps
 */
export interface BatchResponse {
  code: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Complete batch result
 */
export interface BatchResult {
  count: number;
  value: BatchResponse[];
}

/**
 * Batch Request Builder
 * 
 * Fluent API for building batch requests with validation and limits.
 */
export class BatchRequestBuilder {
  private requests: BatchRequest[] = [];
  private readonly maxBatchSize: number;
  private readonly organization: string;
  private readonly project: string;

  constructor(organization: string, project: string, maxBatchSize = 200) {
    this.organization = organization;
    this.project = project;
    this.maxBatchSize = maxBatchSize;
  }

  /**
   * Add a GET request to fetch a work item
   */
  addGetRequest(workItemId: number, fields?: string[]): this {
    if (!this.canAddMore()) {
      throw new Error(`Cannot add more requests. Batch size limit: ${this.maxBatchSize}`);
    }

    const fieldsParam = fields ? `?fields=${encodeURIComponent(fields.join(','))}` : '';
    const uri = `/_apis/wit/workitems/${workItemId}${fieldsParam}&api-version=7.1`;

    this.requests.push({
      method: 'GET',
      uri,
      headers: {
        'Accept': 'application/json'
      },
      metadata: {
        workItemId,
        operationType: 'get',
        index: this.requests.length
      }
    });

    return this;
  }

  /**
   * Add multiple GET requests in batch
   */
  addGetRequests(workItemIds: number[], fields?: string[]): this {
    for (const workItemId of workItemIds) {
      if (!this.canAddMore()) {
        logger.warn(`Batch size limit reached. Added ${this.requests.length}/${workItemIds.length} GET requests`);
        break;
      }
      this.addGetRequest(workItemId, fields);
    }
    return this;
  }

  /**
   * Add a PATCH request to update a work item
   */
  addPatchRequest(workItemId: number, operations: ADOFieldOperation[]): this {
    if (!this.canAddMore()) {
      throw new Error(`Cannot add more requests. Batch size limit: ${this.maxBatchSize}`);
    }

    const uri = `/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`;

    this.requests.push({
      method: 'PATCH',
      uri,
      headers: {
        'Content-Type': 'application/json-patch+json'
      },
      body: operations,
      metadata: {
        workItemId,
        operationType: 'update',
        index: this.requests.length
      }
    });

    return this;
  }

  /**
   * Add multiple PATCH requests in batch
   */
  addPatchRequests(updates: Array<{ workItemId: number; operations: ADOFieldOperation[] }>): this {
    for (const update of updates) {
      if (!this.canAddMore()) {
        logger.warn(`Batch size limit reached. Added ${this.requests.length}/${updates.length} PATCH requests`);
        break;
      }
      this.addPatchRequest(update.workItemId, update.operations);
    }
    return this;
  }

  /**
   * Add a POST request to create a work item
   */
  addPostRequest(workItemType: string, operations: ADOFieldOperation[]): this {
    if (!this.canAddMore()) {
      throw new Error(`Cannot add more requests. Batch size limit: ${this.maxBatchSize}`);
    }

    const encodedWorkItemType = encodeURIComponent(workItemType);
    const uri = `/_apis/wit/workitems/$${encodedWorkItemType}?api-version=7.1-preview.3`;

    this.requests.push({
      method: 'POST',
      uri,
      headers: {
        'Content-Type': 'application/json-patch+json'
      },
      body: operations,
      metadata: {
        operationType: 'create',
        index: this.requests.length
      }
    });

    return this;
  }

  /**
   * Add a comment request to a work item
   */
  addCommentRequest(workItemId: number, comment: string): this {
    if (!this.canAddMore()) {
      throw new Error(`Cannot add more requests. Batch size limit: ${this.maxBatchSize}`);
    }

    const uri = `/_apis/wit/workitems/${workItemId}/comments?api-version=7.1-preview.3`;

    this.requests.push({
      method: 'POST',
      uri,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        text: comment,
        format: 1  // 1 = Markdown/HTML, 0 = PlainText
      },
      metadata: {
        workItemId,
        operationType: 'comment',
        index: this.requests.length
      }
    });

    return this;
  }

  /**
   * Add multiple comment requests in batch
   */
  addCommentRequests(comments: Array<{ workItemId: number; comment: string }>): this {
    for (const item of comments) {
      if (!this.canAddMore()) {
        logger.warn(`Batch size limit reached. Added ${this.requests.length}/${comments.length} comment requests`);
        break;
      }
      this.addCommentRequest(item.workItemId, item.comment);
    }
    return this;
  }

  /**
   * Add a DELETE request to remove a work item
   */
  addDeleteRequest(workItemId: number, hardDelete = false): this {
    if (!this.canAddMore()) {
      throw new Error(`Cannot add more requests. Batch size limit: ${this.maxBatchSize}`);
    }

    const destroyParam = hardDelete ? '?destroy=true' : '';
    const uri = `/_apis/wit/workitems/${workItemId}${destroyParam}&api-version=7.1`;

    this.requests.push({
      method: 'DELETE',
      uri,
      metadata: {
        workItemId,
        operationType: 'delete',
        index: this.requests.length
      }
    });

    return this;
  }

  /**
   * Build the batch request payload
   */
  build(): { requests: BatchRequest[] } {
    if (this.requests.length === 0) {
      throw new Error('Cannot build batch request with no operations');
    }

    if (this.requests.length > this.maxBatchSize) {
      throw new Error(`Batch size ${this.requests.length} exceeds maximum ${this.maxBatchSize}`);
    }

    logger.debug(`Built batch request with ${this.requests.length} operations`, {
      operations: this.requests.map(r => r.metadata?.operationType).filter(Boolean)
    });

    return {
      requests: [...this.requests]
    };
  }

  /**
   * Check if more requests can be added
   */
  canAddMore(): boolean {
    return this.requests.length < this.maxBatchSize;
  }

  /**
   * Get current request count
   */
  getCount(): number {
    return this.requests.length;
  }

  /**
   * Get remaining capacity
   */
  getRemainingCapacity(): number {
    return this.maxBatchSize - this.requests.length;
  }

  /**
   * Clear all requests
   */
  clear(): this {
    this.requests = [];
    return this;
  }

  /**
   * Get operation type breakdown
   */
  getOperationStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const request of this.requests) {
      const opType = request.metadata?.operationType || 'unknown';
      stats[opType] = (stats[opType] || 0) + 1;
    }
    return stats;
  }
}

/**
 * Helper function to split items into batch-sized chunks
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Helper function to validate batch response
 */
export function validateBatchResponse(response: unknown): response is BatchResult {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const result = response as Record<string, unknown>;
  
  if (typeof result.count !== 'number') {
    return false;
  }

  if (!Array.isArray(result.value)) {
    return false;
  }

  // Validate each response item
  for (const item of result.value) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const resp = item as Record<string, unknown>;
    if (typeof resp.code !== 'number') {
      return false;
    }
  }

  return true;
}
