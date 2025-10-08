/**
 * Get Context Packages By Query Handle Handler Tests
 * 
 * Tests for the wit-get-context-packages-by-query-handle tool
 * that retrieves full context packages for multiple work items.
 */

import { handleGetContextPackagesByQueryHandle } from '../../src/services/handlers/context/get-context-packages-by-query-handle.handler';
import { queryHandleService } from '../../src/services/query-handle-service';
import { getContextPackagesByQueryHandleSchema } from '../../src/config/schemas';
import type { ToolConfig } from '../../src/types/index';

// Mock dependencies
jest.mock('../../src/config/config', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  }))
}));

// Mock the get-work-item-context-package handler
jest.mock('../../src/services/handlers/context/get-work-item-context-package.handler', () => ({
  handleGetWorkItemContextPackage: jest.fn(async (config, args) => {
    const { workItemId } = args;
    return {
      success: true,
      data: {
        contextPackage: {
          work_item_id: workItemId,
          title: `Test Item ${workItemId}`,
          type: 'Task',
          state: 'Active',
          description: 'Test description',
          comments: [],
          relations: [],
          fields: {}
        }
      },
      errors: [],
      warnings: [],
      metadata: { source: 'context-package' }
    };
  })
}));

describe('Get Context Packages By Query Handle Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-get-context-packages',
    description: 'Test tool',
    script: '',
    schema: getContextPackagesByQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Basic retrieval', () => {
    it('should retrieve context packages for all items', async () => {
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(3);
      expect(result.data.fetched_packages_count).toBe(3);
      expect(result.data.context_packages).toHaveLength(3);
    });

    it('should retrieve context packages for selected indices', async () => {
      const workItemIds = [101, 102, 103, 104, 105];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2, 4] // Select 1st, 3rd, and 5th items
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(3);
      expect(result.data.context_packages).toHaveLength(3);
    });

    it('should retrieve context packages matching criteria', async () => {
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug', tags: 'critical' }],
        [102, { title: 'Task 1', state: 'Done', type: 'Task', tags: 'normal' }],
        [103, { title: 'Bug 2', state: 'Active', type: 'Bug', tags: 'normal' }],
        [104, { title: 'Bug 3', state: 'Active', type: 'Bug', tags: 'critical' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'], tags: ['critical'] }
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(2); // Bugs 1 and 3
      expect(result.data.context_packages).toHaveLength(2);
    });
  });

  describe('Preview limiting', () => {
    it('should limit to maxPreviewItems', async () => {
      const workItemIds = Array.from({ length: 20 }, (_, i) => 101 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        maxPreviewItems: 5
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(20);
      expect(result.data.fetched_packages_count).toBe(5);
      expect(result.data.context_packages).toHaveLength(5);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('limiting to 5')])
      );
    });

    it('should use default maxPreviewItems of 10', async () => {
      const workItemIds = Array.from({ length: 15 }, (_, i) => 101 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
        // maxPreviewItems not specified, should default to 10
      });

      expect(result.success).toBe(true);
      expect(result.data.fetched_packages_count).toBe(10);
      expect(result.data.context_packages).toHaveLength(10);
    });
  });

  describe('Optional parameters', () => {
    it('should support includeHistory parameter', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        includeHistory: true,
        maxHistoryRevisions: 10
      });

      const callArgs = handleGetWorkItemContextPackage.mock.calls[0][1];
      expect(callArgs.includeHistory).toBe(true);
      expect(callArgs.maxHistoryRevisions).toBe(10);
    });

    it('should support includeComments parameter', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        includeComments: false
      });

      const callArgs = handleGetWorkItemContextPackage.mock.calls[0][1];
      expect(callArgs.includeComments).toBe(false);
    });

    it('should support includeRelations parameter', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        includeRelations: false
      });

      const callArgs = handleGetWorkItemContextPackage.mock.calls[0][1];
      expect(callArgs.includeRelations).toBe(false);
    });

    it('should support includeChildren and includeParent parameters', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        includeChildren: false,
        includeParent: false
      });

      const callArgs = handleGetWorkItemContextPackage.mock.calls[0][1];
      expect(callArgs.includeChildren).toBe(false);
      expect(callArgs.includeParent).toBe(false);
    });

    it('should support includeExtendedFields parameter', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        includeExtendedFields: true
      });

      const callArgs = handleGetWorkItemContextPackage.mock.calls[0][1];
      expect(callArgs.includeExtendedFields).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return error for invalid query handle', async () => {
      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: 'qh_invalid',
        itemSelector: 'all'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('not found or expired')])
      );
    });

    it('should return error when no items selected', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { title: 'Task 2', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Done'] } // No items match
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(0);
      expect(result.data.context_packages).toHaveLength(0);
      expect(result.data.message).toContain('No items matched');
    });

    it('should handle schema validation errors', async () => {
      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        // Missing required queryHandle
        itemSelector: 'all'
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle partial failures when fetching packages', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      handleGetWorkItemContextPackage
        .mockResolvedValueOnce({
          success: true,
          data: { contextPackage: { work_item_id: 101 } },
          errors: [],
          warnings: []
        })
        .mockResolvedValueOnce({
          success: false,
          data: null,
          errors: ['Failed to fetch item 102'],
          warnings: []
        })
        .mockResolvedValueOnce({
          success: true,
          data: { contextPackage: { work_item_id: 103 } },
          errors: [],
          warnings: []
        });

      const workItemIds = [101, 102, 103];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.fetched_packages_count).toBe(2); // Only 2 succeeded
      expect(result.data.failed_packages_count).toBe(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('1 item(s) failed')])
      );
    });
  });

  describe('Selection summary', () => {
    it('should include index-based selection summary', async () => {
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2]
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_summary).toBeDefined();
      expect(result.data.selection_summary.selection_type).toBe('index-based');
    });

    it('should include criteria-based selection summary', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { title: 'Task 2', state: 'Done', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'] }
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_summary).toBeDefined();
      expect(result.data.selection_summary.selection_type).toBe('criteria-based');
      expect(result.data.selection_summary.criteria).toBeDefined();
    });

    it('should include all selection summary', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_summary).toBeDefined();
      expect(result.data.selection_summary.selection_type).toBe('all');
    });
  });

  describe('Next steps guidance', () => {
    it('should include helpful next steps', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.next_steps).toBeDefined();
      expect(Array.isArray(result.data.next_steps)).toBe(true);
      expect(result.data.next_steps.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle expired query handles', async () => {
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        1, // Expire immediately
        workItemContext
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('expired')])
      );
    });

    it('should handle empty query results', async () => {
      const workItemIds: number[] = [];
      const workItemContext = new Map();

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems WHERE 1=0',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(0);
      expect(result.data.context_packages).toHaveLength(0);
    });

    it('should handle maxPreviewItems larger than selection', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        maxPreviewItems: 100 // More than available
      });

      expect(result.success).toBe(true);
      expect(result.data.fetched_packages_count).toBe(2);
      expect(result.data.context_packages).toHaveLength(2);
      expect(result.warnings).toHaveLength(0); // No warning about limiting
    });
  });

  describe('Configuration parameters', () => {
    it('should use organization and project from parameters', async () => {
      const { handleGetWorkItemContextPackage } = require('../../src/services/handlers/context/get-work-item-context-package.handler');
      
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleGetContextPackagesByQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        organization: 'custom-org',
        project: 'custom-project'
      });

      const callArgs = handleGetWorkItemContextPackage.mock.calls[0][1];
      expect(callArgs.organization).toBe('custom-org');
      expect(callArgs.project).toBe('custom-project');
    });
  });
});
