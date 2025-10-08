/**
 * Select Items From Query Handle Handler Tests
 * 
 * Tests for the select-items-from-query-handle handler that previews
 * which work items would be selected from a query handle.
 */

import { handleSelectItemsFromQueryHandle } from '../services/handlers/query-handles/select-items-from-query-handle.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { selectItemsFromQueryHandleSchema } from '../config/schemas.js';

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

describe('Select Items From Query Handle Handler', () => {
  const mockConfig = {
    name: 'wit-query-handle-select',
    description: 'Test',
    script: '',
    schema: selectItemsFromQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('with "all" selector', () => {
    it('should select all items in query handle', async () => {
      const workItemIds = [12345, 67890, 11111];
      const query = 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"';
      
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.total_items_in_handle).toBe(3);
      expect(result.data.selection_analysis.selected_items_count).toBe(3);
      expect(result.data.selection_analysis.selection_type).toBe('all');
      expect(result.data.selection_summary).toContain('Selected 3 items out of 3');
    });

    it('should return message for all items selected', async () => {
      const workItemIds = [12345, 67890];
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_summary).toContain('Selected 2 items out of 2');
      expect(result.data.selection_analysis.selection_percentage).toBe('100.0%');
    });
  });

  describe('with index array selector', () => {
    it('should select items by specific indices', async () => {
      const workItemIds = [12345, 67890, 11111, 22222, 33333];
      const itemContext = new Map([
        [12345, { id: 12345, title: 'Item 1', state: 'Active', type: 'Task', index: 0 }],
        [67890, { id: 67890, title: 'Item 2', state: 'New', type: 'Bug', index: 1 }],
        [11111, { id: 11111, title: 'Item 3', state: 'Active', type: 'Feature', index: 2 }],
        [22222, { id: 22222, title: 'Item 4', state: 'Closed', type: 'Task', index: 3 }],
        [33333, { id: 33333, title: 'Item 5', state: 'Active', type: 'PBI', index: 4 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        itemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2, 4]
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.total_items_in_handle).toBe(5);
      expect(result.data.selection_analysis.selected_items_count).toBe(3);
      expect(result.data.selection_analysis.selection_type).toBe('index-based');
      expect(result.data.preview_items).toHaveLength(3);
      expect(result.data.preview_items[0].id).toBe(12345);
      expect(result.data.preview_items[1].id).toBe(11111);
      expect(result.data.preview_items[2].id).toBe(33333);
    });

    it('should handle partial index matches', async () => {
      const workItemIds = [12345, 67890];
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 5, 10] // Only index 0 is valid
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(1);
      expect(result.data.selection_analysis.selection_percentage).toBe('50.0%');
    });
  });

  describe('with criteria selector', () => {
    it('should select items by state criteria', async () => {
      const workItemIds = [12345, 67890, 11111, 22222];
      const itemContext = new Map([
        [12345, { id: 12345, title: 'Feature 1', state: 'Active', type: 'Feature', index: 0 }],
        [67890, { id: 67890, title: 'Bug 1', state: 'New', type: 'Bug', index: 1 }],
        [11111, { id: 11111, title: 'Feature 2', state: 'Active', type: 'Feature', index: 2 }],
        [22222, { id: 22222, title: 'Task 1', state: 'Closed', type: 'Task', index: 3 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        itemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Active'] }
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(2);
      expect(result.data.selection_analysis.selection_type).toBe('criteria-based');
      expect(result.data.selection_analysis.criteria_used).toContain('states');
      expect(result.data.preview_items[0].state).toBe('Active');
      expect(result.data.preview_items[1].state).toBe('Active');
    });

    it('should select items by tags criteria', async () => {
      const workItemIds = [12345, 67890, 11111];
      const itemContext = new Map([
        [12345, { id: 12345, title: 'Item 1', state: 'Active', type: 'Task', tags: ['Security', 'Priority1'], index: 0 }],
        [67890, { id: 67890, title: 'Item 2', state: 'New', type: 'Bug', tags: ['Bug'], index: 1 }],
        [11111, { id: 11111, title: 'Item 3', state: 'Active', type: 'Task', tags: ['Security', 'Compliance'], index: 2 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        itemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { tags: ['Security'] }
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(2);
      expect(result.data.preview_items[0].tags).toContain('Security');
      expect(result.data.preview_items[1].tags).toContain('Security');
    });

    it('should select items by daysInactive criteria', async () => {
      const workItemIds = [12345, 67890, 11111, 22222];
      const itemContext = new Map([
        [12345, { id: 12345, title: 'Item 1', state: 'Active', type: 'Task', daysInactive: 30, index: 0 }],
        [67890, { id: 67890, title: 'Item 2', state: 'New', type: 'Bug', daysInactive: 95, index: 1 }],
        [11111, { id: 11111, title: 'Item 3', state: 'Active', type: 'Feature', daysInactive: 120, index: 2 }],
        [22222, { id: 22222, title: 'Item 4', state: 'Closed', type: 'Task', daysInactive: 200, index: 3 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        itemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { daysInactiveMin: 90, daysInactiveMax: 150 }
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(2);
      expect(result.data.preview_items[0].id).toBe(67890);
      expect(result.data.preview_items[1].id).toBe(11111);
    });

    it('should combine multiple criteria with AND logic', async () => {
      const workItemIds = [12345, 67890, 11111, 22222];
      const itemContext = new Map([
        [12345, { id: 12345, title: 'Bug fix', state: 'Active', type: 'Bug', tags: ['Security'], daysInactive: 100, index: 0 }],
        [67890, { id: 67890, title: 'Task', state: 'New', type: 'Task', tags: ['Priority1'], daysInactive: 50, index: 1 }],
        [11111, { id: 11111, title: 'Security review', state: 'Active', type: 'Task', tags: ['Security'], daysInactive: 110, index: 2 }],
        [22222, { id: 22222, title: 'Closed bug', state: 'Closed', type: 'Bug', tags: ['Security'], daysInactive: 200, index: 3 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        itemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: {
          states: ['Active'],
          tags: ['Security'],
          daysInactiveMin: 90
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(2);
      expect(result.data.selection_analysis.criteria_used).toEqual(['states', 'tags', 'daysInactiveMin']);
      expect(result.data.preview_items[0].id).toBe(12345);
      expect(result.data.preview_items[1].id).toBe(11111);
    });
  });

  describe('empty selection results', () => {
    it('should warn when no items match criteria', async () => {
      const workItemIds = [12345, 67890];
      const itemContext = new Map([
        [12345, { id: 12345, title: 'Item 1', state: 'Active', type: 'Task', index: 0 }],
        [67890, { id: 67890, title: 'Item 2', state: 'New', type: 'Bug', index: 1 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        itemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: { states: ['Closed'] }
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(0);
      expect(result.warnings).toContain('No items matched the selection criteria');
      expect(result.data.preview_items).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should return error for invalid query handle', async () => {
      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: 'qh_nonexistent',
        itemSelector: 'all'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should return error for expired query handle', async () => {
      const workItemIds = [12345];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        -1 // Already expired
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should validate schema and return error for invalid arguments', async () => {
      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        // Missing required queryHandle
        itemSelector: 'all'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Validation error');
    });
  });

  describe('preview functionality', () => {
    it('should limit preview to specified count', async () => {
      const workItemIds = Array.from({ length: 100 }, (_, i) => 1000 + i);
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        previewCount: 5
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_analysis.selected_items_count).toBe(100);
      expect(result.data.preview_items).toHaveLength(5);
      expect(result.data.selection_analysis.showing_preview).toBe('5 of 100 selected items');
    });

    it('should default preview to 10 items', async () => {
      const workItemIds = Array.from({ length: 50 }, (_, i) => 1000 + i);
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.data.preview_items).toHaveLength(10);
    });

    it('should cap preview at 50 items', async () => {
      const workItemIds = Array.from({ length: 100 }, (_, i) => 1000 + i);
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        previewCount: 100
      });

      expect(result.success).toBe(true);
      expect(result.data.preview_items).toHaveLength(50);
    });

    it('should include item details in preview', async () => {
      const workItemIds = [12345];
      const workItemContext = new Map([
        [12345, {
          id: 12345,
          title: 'Test Item',
          state: 'Active',
          type: 'Feature',
          tags: ['Tag1', 'Tag2'],
          daysInactive: 30,
          assignedTo: 'test@example.com'
        }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        {},
        60000,
        workItemContext
      );

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all'
      });

      expect(result.success).toBe(true);
      const preview = result.data.preview_items[0];
      expect(preview.id).toBe(12345);
      expect(preview.title).toBe('Test Item');
      expect(preview.state).toBe('Active');
      expect(preview.type).toBe('Feature');
      expect(preview.tags).toEqual(['Tag1', 'Tag2']);
      expect(preview.days_inactive).toBe(30);
      expect(preview.assigned_to).toBe('test@example.com');
      expect(preview.index).toBe(0);
    });
  });

  describe('metadata', () => {
    it('should include relevant metadata in response', async () => {
      const workItemIds = [12345, 67890, 11111];
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');

      const result = await handleSelectItemsFromQueryHandle(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2]
      });

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('select-items-from-query-handle');
      expect(result.metadata.queryHandle).toBe(handle);
      expect(result.metadata.selectedCount).toBe(2);
      expect(result.metadata.totalItems).toBe(3);
      expect(result.metadata.selectionType).toBe('index-based');
    });
  });
});
