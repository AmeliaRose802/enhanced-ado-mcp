/**
 * Tests for bulk-assign-by-query-handle handler
 * Validates itemSelector parameter and backward compatibility
 */

import { handleBulkAssignByQueryHandle } from '../services/handlers/bulk-operations/bulk-assign-by-query-handle.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { bulkAssignByQueryHandleSchema } from '../config/schemas.js';
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

describe('Bulk Assign By Query Handle Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-bulk-assign',
    description: 'Test tool',
    script: '',
    schema: bulkAssignByQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Assignment applies to selected items only', () => {
    it('should assign only selected items to user', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'New', type: 'Task', assignedTo: '' }],
        [102, { id: 102, title: 'Task 2', state: 'Active', type: 'Task', assignedTo: '' }],
        [103, { id: 103, title: 'Task 3', state: 'New', type: 'Task', assignedTo: '' }],
        [104, { id: 104, title: 'Task 4', state: 'Done', type: 'Task', assignedTo: 'old@example.com' }],
        [105, { id: 105, title: 'Task 5', state: 'Active', type: 'Task', assignedTo: '' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Select only New and Active items
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['New', 'Active'] },
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(4); // 2 New + 2 Active
      expect((result.data as any).total_items_in_handle).toBe(5);
      expect((result.data as any).summary).toContain('4 of 5');
    });

    it('should assign all items when itemSelector is "all"', async () => {
      // Arrange
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
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
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'team@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
      expect((result.data as any).total_items_in_handle).toBe(3);
    });

    it('should assign only items at specified indices', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Select indices 0, 2, 4
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2, 4],
        assignTo: 'dev@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
      expect((result.data as any).work_item_ids).toEqual([101, 103, 105]);
    });
  });

  describe('Clear messaging about assignment scope', () => {
    it('should include "selected" in summary when using criteria selector', async () => {
      // Arrange
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Task 3', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'] },
        assignTo: 'user@example.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).summary).toContain('2 of 3');
      expect((result.data as any).selected_items_count).toBe(2);
    });

    it('should show preview of items to be assigned', async () => {
      // Arrange
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Bug Fix', state: 'Active', type: 'Bug', assignedTo: 'old@example.com' }],
        [102, { id: 102, title: 'Feature', state: 'New', type: 'Feature', assignedTo: '' }],
        [103, { id: 103, title: 'Task', state: 'Active', type: 'Task', assignedTo: '' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'new@example.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toBeDefined();
      expect((result.data as any).preview_items).toHaveLength(3);
      expect((result.data as any).preview_items[0]).toHaveProperty('work_item_id');
      expect((result.data as any).preview_items[0]).toHaveProperty('title');
      expect((result.data as any).preview_items[0]).toHaveProperty('current_assignee');
    });
  });

  describe('Empty selection handling', () => {
    it('should handle empty selection gracefully', async () => {
      // Arrange
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'Active', type: 'Task' }],
        [103, { id: 103, title: 'Task 3', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Select items with non-existent state
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['NonExistent'] },
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(0);
      expect((result.data as any).summary).toContain('0 of 3');
    });

    it('should handle invalid indices gracefully', async () => {
      // Arrange
      const workItemIds = [101, 102];
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

      // Act - Select indices that are out of bounds
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [5, 10],
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should return error for invalid query handle', async () => {
      // Act
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: 'invalid-handle',
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should limit preview to 5 items', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104, 105, 106, 107, 108];
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
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(8);
      expect((result.data as any).preview_items).toHaveLength(5); // Limited to 5
    });
  });

  describe('Backward Compatibility', () => {
    it('should work when itemSelector is not provided (defaults to "all")', async () => {
      // Arrange
      const workItemIds = [101, 102, 103];
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

      // Act - Old API call without itemSelector
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert - Should default to selecting all items
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
    });

    it('should maintain existing error handling', async () => {
      // Act
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: 'invalid',
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Dry Run Mode', () => {
    it('should indicate dry run in response', async () => {
      // Arrange
      const workItemIds = [101, 102];
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
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).dry_run).toBe(true);
      expect((result.data as any).summary).toContain('DRY RUN');
    });
  });

  describe('Multiple criteria selection', () => {
    it('should support multiple selection criteria', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Bug fix', state: 'Active', type: 'Bug', tags: ['urgent'] }],
        [102, { id: 102, title: 'Feature', state: 'New', type: 'Feature', tags: ['urgent'] }],
        [103, { id: 103, title: 'Task', state: 'Active', type: 'Task', tags: ['normal'] }],
        [104, { id: 104, title: 'Another bug', state: 'Active', type: 'Bug', tags: ['urgent'] }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Select Active items with urgent tag
      const result = await handleBulkAssignByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'], tags: ['urgent'] },
        assignTo: 'urgent-team@company.com',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(2); // 101 and 104
    });
  });
});
