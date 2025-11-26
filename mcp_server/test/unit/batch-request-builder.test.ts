/**
 * Tests for Batch Request Builder
 */

import { BatchRequestBuilder, splitIntoBatches, validateBatchResponse } from '../../src/utils/batch-request-builder.js';
import type { BatchResult } from '../../src/utils/batch-request-builder.js';

describe('BatchRequestBuilder', () => {
  const organization = 'test-org';
  const project = 'test-project';

  describe('constructor', () => {
    it('should create builder with default batch size', () => {
      const builder = new BatchRequestBuilder(organization, project);
      expect(builder.getCount()).toBe(0);
      expect(builder.canAddMore()).toBe(true);
      expect(builder.getRemainingCapacity()).toBe(200);
    });

    it('should create builder with custom batch size', () => {
      const builder = new BatchRequestBuilder(organization, project, 50);
      expect(builder.getRemainingCapacity()).toBe(50);
    });
  });

  describe('addGetRequest', () => {
    it('should add GET request without fields', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addGetRequest(12345);
      
      const result = builder.build();
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        method: 'GET',
        uri: expect.stringContaining('/wit/workitems/12345'),
        headers: { Accept: 'application/json' },
        metadata: { workItemId: 12345, operationType: 'get' }
      });
    });

    it('should add GET request with fields', () => {
      const builder = new BatchRequestBuilder(organization, project);
      const fields = ['System.Title', 'System.State'];
      builder.addGetRequest(12345, fields);
      
      const result = builder.build();
      expect(result.requests[0].uri).toContain('fields=');
      expect(result.requests[0].uri).toContain(encodeURIComponent(fields.join(',')));
    });

    it('should throw when exceeding batch size', () => {
      const builder = new BatchRequestBuilder(organization, project, 2);
      builder.addGetRequest(1);
      builder.addGetRequest(2);
      
      expect(() => builder.addGetRequest(3)).toThrow('Cannot add more requests');
    });
  });

  describe('addGetRequests', () => {
    it('should add multiple GET requests', () => {
      const builder = new BatchRequestBuilder(organization, project);
      const ids = [1, 2, 3, 4, 5];
      builder.addGetRequests(ids);
      
      expect(builder.getCount()).toBe(5);
      const result = builder.build();
      expect(result.requests).toHaveLength(5);
    });

    it('should stop adding when batch size reached', () => {
      const builder = new BatchRequestBuilder(organization, project, 3);
      const ids = [1, 2, 3, 4, 5];
      builder.addGetRequests(ids);
      
      expect(builder.getCount()).toBe(3);
    });
  });

  describe('addPatchRequest', () => {
    it('should add PATCH request', () => {
      const builder = new BatchRequestBuilder(organization, project);
      const operations = [
        { op: 'replace' as const, path: '/fields/System.State', value: 'Active' }
      ];
      builder.addPatchRequest(12345, operations);
      
      const result = builder.build();
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        method: 'PATCH',
        uri: expect.stringContaining('/wit/workitems/12345'),
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: operations,
        metadata: { workItemId: 12345, operationType: 'update' }
      });
    });
  });

  describe('addPostRequest', () => {
    it('should add POST request for work item creation', () => {
      const builder = new BatchRequestBuilder(organization, project);
      const operations = [
        { op: 'add' as const, path: '/fields/System.Title', value: 'Test Item' }
      ];
      builder.addPostRequest('Task', operations);
      
      const result = builder.build();
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        method: 'POST',
        uri: expect.stringContaining('$Task'),
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: operations,
        metadata: { operationType: 'create' }
      });
    });

    it('should URL encode work item type', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addPostRequest('Product Backlog Item', []);
      
      const result = builder.build();
      expect(result.requests[0].uri).toContain('Product%20Backlog%20Item');
    });
  });

  describe('addCommentRequest', () => {
    it('should add comment request', () => {
      const builder = new BatchRequestBuilder(organization, project);
      const comment = 'Test comment';
      builder.addCommentRequest(12345, comment);
      
      const result = builder.build();
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        method: 'POST',
        uri: expect.stringContaining('/comments'),
        headers: { 'Content-Type': 'application/json' },
        body: { text: comment, format: 1 },
        metadata: { workItemId: 12345, operationType: 'comment' }
      });
    });
  });

  describe('addDeleteRequest', () => {
    it('should add DELETE request', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addDeleteRequest(12345);
      
      const result = builder.build();
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        method: 'DELETE',
        uri: expect.stringContaining('/wit/workitems/12345'),
        metadata: { workItemId: 12345, operationType: 'delete' }
      });
    });

    it('should add hard delete parameter', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addDeleteRequest(12345, true);
      
      const result = builder.build();
      expect(result.requests[0].uri).toContain('destroy=true');
    });
  });

  describe('build', () => {
    it('should throw when building empty batch', () => {
      const builder = new BatchRequestBuilder(organization, project);
      expect(() => builder.build()).toThrow('Cannot build batch request with no operations');
    });

    it('should return immutable copy of requests', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addGetRequest(1);
      
      const result1 = builder.build();
      builder.addGetRequest(2);
      const result2 = builder.build();
      
      expect(result1.requests).toHaveLength(1);
      expect(result2.requests).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all requests', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addGetRequest(1);
      builder.addGetRequest(2);
      
      expect(builder.getCount()).toBe(2);
      builder.clear();
      expect(builder.getCount()).toBe(0);
    });
  });

  describe('getOperationStats', () => {
    it('should return operation breakdown', () => {
      const builder = new BatchRequestBuilder(organization, project);
      builder.addGetRequest(1);
      builder.addGetRequest(2);
      builder.addPatchRequest(3, []);
      builder.addCommentRequest(4, 'test');
      
      const stats = builder.getOperationStats();
      expect(stats).toEqual({
        get: 2,
        update: 1,
        comment: 1
      });
    });
  });
});

describe('splitIntoBatches', () => {
  it('should split array into batches', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const batches = splitIntoBatches(items, 3);
    
    expect(batches).toHaveLength(3);
    expect(batches[0]).toEqual([1, 2, 3]);
    expect(batches[1]).toEqual([4, 5, 6]);
    expect(batches[2]).toEqual([7]);
  });

  it('should handle empty array', () => {
    const batches = splitIntoBatches([], 5);
    expect(batches).toEqual([]);
  });

  it('should handle array smaller than batch size', () => {
    const items = [1, 2, 3];
    const batches = splitIntoBatches(items, 10);
    
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([1, 2, 3]);
  });
});

describe('validateBatchResponse', () => {
  it('should validate valid batch response', () => {
    const response: BatchResult = {
      count: 2,
      value: [
        { code: 200, headers: {}, body: {} },
        { code: 200, headers: {}, body: {} }
      ]
    };
    
    expect(validateBatchResponse(response)).toBe(true);
  });

  it('should reject invalid response - missing count', () => {
    const response = {
      value: [{ code: 200, headers: {}, body: {} }]
    };
    
    expect(validateBatchResponse(response)).toBe(false);
  });

  it('should reject invalid response - missing value array', () => {
    const response = {
      count: 1
    };
    
    expect(validateBatchResponse(response)).toBe(false);
  });

  it('should reject invalid response - missing code in item', () => {
    const response = {
      count: 1,
      value: [{ headers: {}, body: {} }]
    };
    
    expect(validateBatchResponse(response)).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateBatchResponse(null)).toBe(false);
    expect(validateBatchResponse(undefined)).toBe(false);
  });
});
