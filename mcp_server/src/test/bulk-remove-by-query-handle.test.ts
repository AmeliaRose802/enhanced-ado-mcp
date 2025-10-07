/**
 * Tests for bulk-remove-by-query-handle handler
 * Focuses on enhanced dry-run preview and item selection features
 */

import { handleBulkRemoveByQueryHandle } from '../services/handlers/bulk-operations/bulk-remove-by-query-handle.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { bulkRemoveByQueryHandleSchema } from '../config/schemas.js';

// Mock configuration
jest.mock('../config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project',
      areaPath: '',
      iterationPath: '',
      defaultWorkItemType: 'Task',
      defaultPriority: 2,
      defaultAssignedTo: '',
      inheritParentPaths: false
    }
  })),
  updateConfigFromCLI: jest.fn()
}));

// Mock Azure CLI validation
jest.mock('../services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

// Mock ADO HTTP Client
jest.mock('../utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    patch: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({})
  })),
  createADOHttpClient: jest.fn()
}));

const mockConfig = {
  name: 'wit-bulk-remove-by-query-handle',
  description: 'Test config',
  script: '',
  schema: bulkRemoveByQueryHandleSchema,
  inputSchema: {}
};

describe('Bulk Remove By Query Handle Handler', () => {
  beforeEach(() => {
    // Clear any existing handles before each test
    (queryHandleService as any).handles = new Map();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Enhanced Dry-Run Preview', () => {
    it('should include structured selection details in dry-run preview', async () => {
      // Arrange: Create a query handle with item context
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Bug Fix', state: 'New', type: 'Bug' }],
        [103, { id: 103, title: 'Feature Work', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act: Call handler with dry-run
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        removeReason: 'Test removal',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.dry_run).toBe(true);
      expect(result.data.selected_items_count).toBe(3);
      expect(result.data.total_items_in_handle).toBe(3);
      expect(result.data.preview_items).toHaveLength(3);
      
      // Check that preview items have all required fields
      const firstItem = result.data.preview_items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('state');
      expect(firstItem).toHaveProperty('type');
      
      // Verify structured summary includes selection info
      expect(result.data.summary).toContain('DRY RUN');
      expect(result.data.summary).toContain('3 items');
    });

    it('should show selection criteria in dry-run for criteria-based selection', async () => {
      // Arrange: Create a query handle with mixed states
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Task 3', state: 'Active', type: 'Task' }],
        [104, { id: 104, title: 'Task 4', state: 'Closed', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act: Call handler with criteria-based selection
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'] },
        removeReason: 'Removing active items',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(2); // Only Active items
      expect(result.data.total_items_in_handle).toBe(4);
      
      // Verify summary shows selection criteria
      expect(result.data.summary).toContain('selectionCriteria');
      expect(result.data.summary).toContain('Active');
    });

    it('should show "All items" in criteria for itemSelector="all"', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'New', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.summary).toContain('All items');
    });

    it('should limit preview items to 5 even with larger selection', async () => {
      // Arrange: Create handle with 10 items
      const workItemIds = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(10);
      expect(result.data.preview_items).toHaveLength(5); // Limited to 5
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid query handle', async () => {
      // Act
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: 'invalid-handle',
        itemSelector: 'all',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should return error for expired query handle', async () => {
      // Arrange: Create handle with very short TTL
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        undefined,
        1 // 1ms TTL
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });
  });

  describe('Index-based Selection', () => {
    it('should support index-based selection in dry-run', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act: Select specific indices
      const result = await handleBulkRemoveByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2, 4], // Select items at indices 0, 2, 4
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(3);
      expect(result.data.work_item_ids).toEqual([101, 103, 105]);
    });
  });
});
