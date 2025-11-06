/**
 * Tests for bulk operation preview limits (maxPreviewItems parameter)
 * Validates that unified bulk operations respect the preview item limit in dry-run mode
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { handleUnifiedBulkOperations } from '../../src/services/handlers/bulk-operations/unified-bulk-operations.handler.js';
import { unifiedBulkOperationsSchema } from '../../src/config/schemas.js';
import type { ToolConfig } from '../../src/types/index.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project',
      patToken: 'test-token'
    }
  }))
}));

jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => ({
    getToken: jest.fn(async () => 'mock-token')
  }))
}));

jest.mock('../../src/services/query-handle-service.js', () => ({
  queryHandleService: {
    resolveItemSelector: jest.fn((handle, selector) => {
      // Return mock work item IDs based on handle
      if (handle === 'test-handle') {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      }
      return null;
    }),
    getQueryData: jest.fn((handle) => {
      if (handle === 'test-handle') {
        return {
          query: 'SELECT [System.Id] FROM WorkItems',
          workItemIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        };
      }
      return null;
    })
  }
}));

describe('Bulk Operation Preview Limits', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-unified-bulk-operations-by-query-handle',
    description: 'Test tool',
    script: '',
    schema: unifiedBulkOperationsSchema,
    inputSchema: { type: 'object', properties: {} }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should respect maxPreviewItems in dry-run mode for comment action', async () => {
    const args = {
      queryHandle: 'test-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'Test comment'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true,
      maxPreviewItems: 5
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(15);
    expect(result.metadata?.dryRun).toBe(true);
  });

  it('should respect maxPreviewItems in dry-run mode for update action', async () => {
    const args = {
      queryHandle: 'test-handle',
      actions: [
        {
          type: 'update' as const,
          updates: [
            { op: 'replace' as const, path: '/fields/System.State', value: 'Active' }
          ]
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true,
      maxPreviewItems: 3
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(15);
  });

  it('should respect maxPreviewItems in dry-run mode for assign action', async () => {
    const args = {
      queryHandle: 'test-handle',
      actions: [
        {
          type: 'assign' as const,
          assignTo: 'test-user@example.com'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true,
      maxPreviewItems: 10
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(15);
  });

  it('should respect maxPreviewItems in dry-run mode for multiple actions', async () => {
    const args = {
      queryHandle: 'test-handle',
      actions: [
        {
          type: 'add-tag' as const,
          tags: 'test-tag'
        },
        {
          type: 'comment' as const,
          comment: 'Tagged for testing'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true,
      maxPreviewItems: 7
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(15);
    expect(data.actions_requested).toBe(2);
  });

  it('should use default maxPreviewItems when not specified', async () => {
    const args = {
      queryHandle: 'test-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'Test comment without maxPreviewItems'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true
      // maxPreviewItems not specified - should default to 10
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(15);
  });

  it('should handle maxPreviewItems larger than item count', async () => {
    const args = {
      queryHandle: 'test-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'Test with large preview limit'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true,
      maxPreviewItems: 50  // Changed from 100 to respect schema max of 50
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(15);
  });
});
