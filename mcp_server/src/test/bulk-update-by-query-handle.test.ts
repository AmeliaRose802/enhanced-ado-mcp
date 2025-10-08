/**
 * Tests for bulk-update-by-query-handle handler
 * Validates item selection integration and enhanced logging
 */

import { handleBulkUpdateByQueryHandle } from '../services/handlers/bulk-operations/bulk-update-by-query-handle.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { bulkUpdateByQueryHandleSchema } from '../config/schemas.js';
import type { ToolConfig } from '../types/index.js';

// Mock the dependencies
jest.mock('../services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    patch: jest.fn().mockResolvedValue({})
  }))
}));

jest.mock('../config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  }))
}));

describe('Bulk Update By Query Handle Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-bulk-update-by-query-handle',
    description: 'Test tool',
    script: '',
    schema: bulkUpdateByQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    // Clear all query handles before each test
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Stop the cleanup interval to prevent "Jest did not exit one second after the test run" warning
    queryHandleService.stopCleanup();
  });

  describe('Item Selection with Enhanced Logging', () => {
    it('should log selection information for "all" selector', async () => {
      // Create test query handle
      const workItemIds = [1, 2, 3];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [1, { title: 'Item 1', state: 'New', type: 'Task' }],
          [2, { title: 'Item 2', state: 'Active', type: 'Bug' }],
          [3, { title: 'Item 3', state: 'Done', type: 'Task' }]
        ])
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' }
        ],
        itemSelector: 'all',
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.selected_items_count).toBe(3);
      expect(result.data?.summary).toContain('all 3 items');
    });

    it('should log selection criteria for index-based selector', async () => {
      // Create test query handle
      const workItemIds = [10, 20, 30, 40];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [10, { title: 'Item 10', state: 'New', type: 'Task' }],
          [20, { title: 'Item 20', state: 'Active', type: 'Bug' }],
          [30, { title: 'Item 30', state: 'Done', type: 'Task' }],
          [40, { title: 'Item 40', state: 'New', type: 'Feature' }]
        ])
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' }
        ],
        itemSelector: [0, 2], // Select first and third items
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.selected_items_count).toBe(2);
      expect(result.data?.total_items_in_handle).toBe(4);
      expect(result.data?.summary).toContain('2 selected items (from 4 total)');
    });

    it('should log selection criteria for criteria-based selector', async () => {
      // Create test query handle
      const workItemIds = [100, 200, 300];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [100, { title: 'Bug Fix', state: 'New', type: 'Bug' }],
          [200, { title: 'Feature', state: 'Active', type: 'Feature' }],
          [300, { title: 'Another Bug', state: 'Active', type: 'Bug' }]
        ])
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.AssignedTo', value: 'user@example.com' }
        ],
        itemSelector: { states: ['Active'] },
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.selected_items_count).toBe(2); // Only Active items
      expect(result.data?.total_items_in_handle).toBe(3);
      expect(result.data?.summary).toContain('2 selected items (from 3 total)');
    });
  });

  describe('Item Validation', () => {
    it('should validate selected items have context', async () => {
      // Create query handle with mixed context quality
      const workItemIds = [1, 2, 3];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [1, { title: 'Item 1', state: 'New', type: 'Task' }],
          [2, { title: 'Item 2', state: 'Active', type: 'Bug' }],
          [3, { title: 'Item 3', state: 'Done', type: 'Task' }]
        ])
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Closed' }
        ],
        itemSelector: 'all',
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.preview_items).toHaveLength(3);
      expect(result.data?.preview_items[0]).toHaveProperty('type');
    });
  });

  describe('Enhanced Summary Messages', () => {
    it('should show field count in dry run summary for "all" selector', async () => {
      const workItemIds = [1, 2];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [1, { title: 'Item 1', state: 'New', type: 'Task' }],
          [2, { title: 'Item 2', state: 'Active', type: 'Bug' }]
        ])
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' },
          { op: 'replace', path: '/fields/System.Priority', value: 1 }
        ],
        itemSelector: 'all',
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBe('DRY RUN: Would update 2 fields on all 2 items');
    });

    it('should show selected vs total in dry run summary for filtered selector', async () => {
      const workItemIds = [1, 2, 3, 4, 5];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [1, { title: 'Item 1', state: 'New', type: 'Task' }],
          [2, { title: 'Item 2', state: 'Active', type: 'Bug' }],
          [3, { title: 'Item 3', state: 'Done', type: 'Task' }],
          [4, { title: 'Item 4', state: 'New', type: 'Feature' }],
          [5, { title: 'Item 5', state: 'Active', type: 'Task' }]
        ])
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Closed' }
        ],
        itemSelector: [1, 3], // Select items at indices 1 and 3
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBe('DRY RUN: Would update 1 fields on 2 selected items (from 5 total)');
      expect(result.data?.selected_items_count).toBe(2);
      expect(result.data?.total_items_in_handle).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent query handle', async () => {
      const args = {
        queryHandle: 'invalid-handle',
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' }
        ],
        itemSelector: 'all',
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should validate schema for updates parameter', async () => {
      const workItemIds = [1];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems'
      );

      const args = {
        queryHandle: handle,
        updates: [], // Empty updates array should fail
        itemSelector: 'all',
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Preview Items', () => {
    it('should show preview of first 5 selected items', async () => {
      const workItemIds = [1, 2, 3, 4, 5, 6, 7, 8];
      const itemContext = new Map();
      for (let i = 0; i < 8; i++) {
        itemContext.set(i + 1, {
          title: `Item ${i + 1}`,
          state: i % 2 === 0 ? 'New' : 'Active',
          type: 'Task'
        });
      }

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        itemContext
      );

      const args = {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Done' }
        ],
        itemSelector: 'all',
        dryRun: true
      };

      const result = await handleBulkUpdateByQueryHandle(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data?.preview_items).toHaveLength(5); // Only first 5
      expect(result.data?.selected_items_count).toBe(8); // But all 8 selected
      expect(result.data?.preview_items[0]).toHaveProperty('work_item_id');
      expect(result.data?.preview_items[0]).toHaveProperty('title');
      expect(result.data?.preview_items[0]).toHaveProperty('state');
      expect(result.data?.preview_items[0]).toHaveProperty('type');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work when itemSelector is not provided (defaults to "all")', async () => {
      // Create test query handle
      const workItemIds = [1, 2, 3];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        undefined,
        new Map([
          [1, { title: 'Item 1', state: 'New', type: 'Task' }],
          [2, { title: 'Item 2', state: 'Active', type: 'Bug' }],
          [3, { title: 'Item 3', state: 'Done', type: 'Task' }]
        ])
      );

      // Old API call without itemSelector
      const result = await handleBulkUpdateByQueryHandle(mockConfig, {
        queryHandle: handle,
        updates: [
          { op: 'replace', path: '/fields/System.Priority', value: 1 }
        ],
        dryRun: true
      });

      // Should default to selecting all items
      expect(result.success).toBe(true);
      expect(result.data?.selected_items_count).toBe(3);
    });

    it('should maintain existing error handling', async () => {
      const result = await handleBulkUpdateByQueryHandle(mockConfig, {
        queryHandle: 'invalid',
        updates: [
          { op: 'replace', path: '/fields/System.State', value: 'Active' }
        ],
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
