/**
 * Tests for bulk-comment-by-query-handle handler
 * Validates itemSelector parameter and backward compatibility
 */

import { handleBulkCommentByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-comment-by-query-handle.handler.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { bulkCommentByQueryHandleSchema } from '../../src/config/schemas.js';
import type { ToolConfig } from '../../src/types/index.js';

// Mock the dependencies
jest.mock('../../src/services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    post: jest.fn().mockResolvedValue({})
  }))
}));

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  }))
}));

describe('Bulk Comment By Query Handle Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-bulk-comment',
    description: 'Test tool',
    script: '',
    schema: bulkCommentByQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('itemSelector: "all" (default behavior)', () => {
    it('should comment on all items when itemSelector is "all"', async () => {
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

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        comment: 'Test comment',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(5);
      expect((result.data as any).total_items_in_handle).toBe(5);
    });

    it('should default to "all" when itemSelector not provided', async () => {
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

      // Act - itemSelector defaults to "all"
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        comment: 'Test comment without selector',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
    });
  });

  describe('itemSelector: [indices] (index array)', () => {
    it('should comment on selected indices only', async () => {
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

      // Act - Select indices 0, 2, 4
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2, 4],
        comment: 'Test comment on selected items',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
      expect((result.data as any).total_items_in_handle).toBe(5);
      expect((result.data as any).preview_items).toHaveLength(3);
    });

    it('should handle single index selection', async () => {
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

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [1],
        comment: 'Single item comment',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(1);
    });
  });

  describe('itemSelector: {criteria} (criteria object)', () => {
    it('should comment on items matching state criteria', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'Active', type: 'Task' }],
        [103, { id: 103, title: 'Task 3', state: 'New', type: 'Task' }],
        [104, { id: 104, title: 'Task 4', state: 'Active', type: 'Task' }],
        [105, { id: 105, title: 'Task 5', state: 'Done', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'] },
        comment: 'Active items need review',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
      expect((result.data as any).total_items_in_handle).toBe(5);
    });

    it('should comment on items matching multiple states', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Task 3', state: 'Active', type: 'Task' }],
        [104, { id: 104, title: 'Task 4', state: 'Done', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active', 'New'] },
        comment: 'Work in progress items',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
    });
  });

  describe('Template variable substitution', () => {
    it('should substitute template variables with selected items context', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { 
          id: 101, 
          title: 'Bug Fix', 
          state: 'Active', 
          type: 'Bug',
          daysInactive: 30,
          assignedTo: 'user@example.com'
        }],
        [102, { 
          id: 102, 
          title: 'Feature Work', 
          state: 'New', 
          type: 'Feature',
          daysInactive: 5,
          assignedTo: 'dev@example.com'
        }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        comment: 'Item {id}: {title} has been inactive for {daysInactive} days',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).has_template_variables).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(2);
      expect((result.data as any).preview_items[0].substituted_comment).toContain('Item 101:');
      expect((result.data as any).preview_items[0].substituted_comment).toContain('30 days');
    });

    it('should warn when template variables are present but no context available', async () => {
      // Arrange
      const workItemIds = [101, 102];
      // No context provided
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        comment: 'Item {id} needs attention',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('template variables');
    });
  });

  describe('Comment is only added to selected items', () => {
    it('should only affect selected items, not all items in handle', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: id % 2 === 0 ? 'Active' : 'New', type: 'Task' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Only select items with state 'Active'
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'] },
        comment: 'Only for active items',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(2); // Only 102 and 104 are Active
      expect((result.data as any).total_items_in_handle).toBe(5);
      expect((result.data as any).summary).toContain('2 of 5');
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
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        comment: 'Test',
        dryRun: true
      });

      // Assert - Should default to selecting all items
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
    });

    it('should maintain existing error handling', async () => {
      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: 'invalid-handle',
        comment: 'Test',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent query handle', async () => {
      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: 'non-existent-handle',
        itemSelector: 'all',
        comment: 'Test comment',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });

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
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['NonExistent'] },
        comment: 'Test comment',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(0);
    });
  });

  describe('Preview Items', () => {
    it('should show preview of first 3 selected items', async () => {
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

      // Act
      const result = await handleBulkCommentByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        comment: 'Test comment',
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(5); // Default is now 5, not 3
      expect((result.data as any).selected_items_count).toBe(5); // But all 5 selected
    });
  });
});

