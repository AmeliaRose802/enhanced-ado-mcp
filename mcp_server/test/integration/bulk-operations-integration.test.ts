/**
 * Bulk Operations Integration Tests
 * Tests the unified bulk operations handler with real API interactions
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
      if (handle === 'integration-test-handle') {
        return [1001, 1002, 1003];
      }
      return null;
    }),
    getQueryData: jest.fn((handle) => {
      if (handle === 'integration-test-handle') {
        return {
          query: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "New"',
          workItemIds: [1001, 1002, 1003]
        };
      }
      return null;
    })
  }
}));

// Mock ADO HTTP client
jest.mock('../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn(async (url: string) => {
      // Mock get work item response
      if (url.includes('wit/workitems/')) {
        const workItemId = parseInt(url.match(/workitems\/(\d+)/)?.[1] || '0');
        return {
          data: {
            id: workItemId,
            fields: {
              'System.Id': workItemId,
              'System.Title': `Test Work Item ${workItemId}`,
              'System.WorkItemType': 'Task',
              'System.State': 'New',
              'System.Tags': ''
            }
          }
        };
      }
      throw new Error(`Unexpected GET URL: ${url}`);
    }),
    patch: jest.fn(async () => ({ data: { success: true } })),
    post: jest.fn(async () => ({ data: { success: true } }))
  }))
}));

describe('Bulk Operations Integration', () => {
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

  it('should execute comment action in dry-run mode', async () => {
    const args = {
      queryHandle: 'integration-test-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'Integration test comment'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(3);
    expect(data.dry_run).toBe(true);
  });

  it('should execute update action in dry-run mode', async () => {
    const args = {
      queryHandle: 'integration-test-handle',
      actions: [
        {
          type: 'update' as const,
          updates: [
            { op: 'replace' as const, path: '/fields/System.State', value: 'Active' }
          ]
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(3);
  });

  it('should execute multiple actions in sequence (dry-run)', async () => {
    const args = {
      queryHandle: 'integration-test-handle',
      actions: [
        {
          type: 'add-tag' as const,
          tags: 'integration-test'
        },
        {
          type: 'update' as const,
          updates: [
            { op: 'replace' as const, path: '/fields/System.State', value: 'Active' }
          ]
        },
        {
          type: 'comment' as const,
          comment: 'Bulk update complete'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.items_selected).toBe(3);
    expect(data.actions_requested).toBe(3);
    expect(data.actions_completed).toBe(3);
  });

  it('should handle invalid query handle gracefully', async () => {
    const args = {
      queryHandle: 'invalid-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'Should fail'
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Query handle');
  });

  it('should support item selector with indices', async () => {
    const args = {
      queryHandle: 'integration-test-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'Selective comment'
        }
      ],
      itemSelector: [0, 2] as number[],
      dryRun: true
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    // Note: resolveItemSelector mock returns all items regardless of selector
    // In production, it would respect the indices
  });

  it('should handle stopOnError parameter', async () => {
    const args = {
      queryHandle: 'integration-test-handle',
      actions: [
        {
          type: 'comment' as const,
          comment: 'First action'
        },
        {
          type: 'update' as const,
          updates: [
            { op: 'replace' as const, path: '/fields/System.State', value: 'Active' }
          ]
        }
      ],
      itemSelector: 'all' as const,
      dryRun: true,
      stopOnError: true
    };

    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.actions_requested).toBe(2);
  });

  it('should validate required action parameters', async () => {
    const args = {
      queryHandle: 'integration-test-handle',
      actions: [
        {
          type: 'comment' as const
          // Missing required 'comment' field
        } as any
      ],
      itemSelector: 'all' as const,
      dryRun: true
    };

    // This should fail validation at the schema level
    const result = await handleUnifiedBulkOperations(mockConfig, args);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
