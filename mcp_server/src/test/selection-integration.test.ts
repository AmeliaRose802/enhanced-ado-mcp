/**
 * Selection Integration Tests
 * 
 * End-to-end integration tests that validate complete workflows from 
 * query → selection → bulk operation.
 */

import { queryHandleService } from '../services/query-handle-service.js';
import { handleInspectQueryHandle } from '../services/handlers/query-handles/inspect-query-handle.handler.js';
import { handleSelectItemsFromQueryHandle } from '../services/handlers/query-handles/select-items-from-query-handle.handler.js';
import { handleBulkCommentByQueryHandle } from '../services/handlers/bulk-operations/bulk-comment-by-query-handle.handler.js';
import { handleBulkAssignByQueryHandle } from '../services/handlers/bulk-operations/bulk-assign-by-query-handle.handler.js';
import { handleBulkUpdateByQueryHandle } from '../services/handlers/bulk-operations/bulk-update-by-query-handle.handler.js';
import { 
  inspectQueryHandleSchema,
  selectItemsFromQueryHandleSchema,
  bulkCommentByQueryHandleSchema,
  bulkAssignByQueryHandleSchema,
  bulkUpdateByQueryHandleSchema
} from '../config/schemas.js';

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
    isLoggedIn: true,
    version: '2.50.0'
  }))
}));

// Mock ADO HTTP Client
jest.mock('../utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    addComment: jest.fn().mockResolvedValue({ success: true }),
    updateWorkItem: jest.fn().mockResolvedValue({ success: true })
  }))
}));

// Helper functions
function createTestQueryHandle(itemCount: number, options?: any) {
  const itemContext = Array.from({ length: itemCount }, (_, i) => ({
    index: i,
    id: i + 1,
    title: `Item ${i + 1}`,
    state: 'Active',
    type: 'Task',
    tags: [],
    ...options
  }));
  
  const workItemIds = itemContext.map(i => i.id);
  const workItemContextMap = new Map(
    itemContext.map(item => [item.id, {
      title: item.title,
      state: item.state,
      type: item.type,
      daysInactive: item.daysInactive,
      tags: Array.isArray(item.tags) ? item.tags.join(';') : item.tags
    }])
  );
  
  return queryHandleService.storeQuery(
    workItemIds,
    'SELECT [System.Id] FROM WorkItems',
    { project: 'TestProject', queryType: 'wiql' },
    60000,
    workItemContextMap
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Selection Integration Tests', () => {
  
  beforeEach(() => {
    // Clear any existing handles before each test
    queryHandleService.clearAll();
  });

  afterAll(() => {
    // Stop the cleanup interval to prevent Jest warnings
    queryHandleService.stopCleanup();
  });

  describe('Scenario 1: Full Workflow - Query to Bulk Comment', () => {
    it('should complete full workflow: query → inspect → select → bulk comment', async () => {
      // 1. Create query with handle
      const workItemIds = [1, 2, 3, 4, 5];
      const workItemContext = new Map([
        [1, { title: 'Bug 1', state: 'Active', type: 'Bug', tags: 'critical', daysInactive: 5 }],
        [2, { title: 'Bug 2', state: 'New', type: 'Bug', tags: 'backend', daysInactive: 2 }],
        [3, { title: 'Task 1', state: 'Active', type: 'Task', tags: 'ui', daysInactive: 10 }],
        [4, { title: 'Bug 3', state: 'Done', type: 'Bug', tags: 'critical', daysInactive: 1 }],
        [5, { title: 'Task 2', state: 'Active', type: 'Task', tags: 'feature', daysInactive: 7 }]
      ]);

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );
      
      // 2. Inspect handle (validate preview functionality)
      const mockInspectConfig = {
        name: 'wit-query-handle-inspect',
        description: 'Test',
        script: '',
        schema: inspectQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const inspectResult = await handleInspectQueryHandle(mockInspectConfig, { 
        queryHandle 
      });
      
      expect(inspectResult.success).toBe(true);
      expect(inspectResult.data.itemPreview).toBeDefined();
      expect(inspectResult.data.work_item_count).toBe(5);
      
      // 3. Preview selection (critical bugs only)
      const mockSelectConfig = {
        name: 'wit-query-handle-select',
        description: 'Test',
        script: '',
        schema: selectItemsFromQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const previewResult = await handleSelectItemsFromQueryHandle(mockSelectConfig, {
        queryHandle,
        itemSelector: { tags: ['critical'] }
      });
      
      expect(previewResult.success).toBe(true);
      expect(previewResult.data.selection_analysis.selected_items_count).toBe(2);
      expect(previewResult.data.preview_items.every((i: any) => 
        i.tags && i.tags.includes('critical')
      )).toBe(true);
      
      // 4. Execute bulk comment with same selector (dry run)
      const mockCommentConfig = {
        name: 'wit-bulk-comment',
        description: 'Test',
        script: '',
        schema: bulkCommentByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const commentResult = await handleBulkCommentByQueryHandle(mockCommentConfig, {
        queryHandle,
        itemSelector: { tags: ['critical'] },
        comment: 'Security review needed',
        template: false,
        dryRun: true
      });
      
      expect(commentResult.success).toBe(true);
      expect(commentResult.data.selected_items_count).toBe(2);
    });
  });

  describe('Scenario 2: Single Item Selection (Index-Based)', () => {
    it('should select and update a single item by index', async () => {
      const queryHandle = createTestQueryHandle(5);
      
      // Select first item (index 0)
      const selected = queryHandleService.getItemsByIndices(queryHandle, [0]);
      expect(selected).toHaveLength(1);
      expect(selected![0]).toBe(1); // ID is 1 (index 0)
      
      // Update that item (dry run)
      const mockUpdateConfig = {
        name: 'wit-bulk-update',
        description: 'Test',
        script: '',
        schema: bulkUpdateByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const updateResult = await handleBulkUpdateByQueryHandle(mockUpdateConfig, {
        queryHandle,
        itemSelector: [0],
        updates: [
          { 
            op: 'replace',
            path: '/fields/System.Priority',
            value: '1'
          }
        ],
        dryRun: true
      });
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.data.selected_items_count).toBe(1);
    });
  });

  describe('Scenario 3: Multiple Item Selection (Index Array)', () => {
    it('should select and assign multiple items by indices', async () => {
      const queryHandle = createTestQueryHandle(10);
      
      // Select indices 0, 2, 4, 6 (every other item, 4 total)
      const indices = [0, 2, 4, 6];
      const selected = queryHandleService.getItemsByIndices(queryHandle, indices);
      expect(selected).toHaveLength(4);
      expect(selected).toEqual([1, 3, 5, 7]); // IDs based on indices
      
      // Assign those items (dry run)
      const mockAssignConfig = {
        name: 'wit-bulk-assign',
        description: 'Test',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const assignResult = await handleBulkAssignByQueryHandle(mockAssignConfig, {
        queryHandle,
        itemSelector: indices,
        assignTo: 'test-user@company.com',
        dryRun: true
      });
      
      expect(assignResult.success).toBe(true);
      expect(assignResult.data.selected_items_count).toBe(4);
    });
  });

  describe('Scenario 4: Criteria-Based Selection (States + Tags)', () => {
    it('should select items matching multiple criteria', async () => {
      const workItemIds = [1, 2, 3, 4, 5];
      const workItemContext = new Map([
        [1, { title: 'Item 1', state: 'Active', type: 'Task', tags: 'critical;ui' }],
        [2, { title: 'Item 2', state: 'Active', type: 'Task', tags: 'backend' }],
        [3, { title: 'Item 3', state: 'New', type: 'Task', tags: 'critical' }],
        [4, { title: 'Item 4', state: 'Active', type: 'Task', tags: 'critical;backend' }],
        [5, { title: 'Item 5', state: 'Done', type: 'Task', tags: 'critical' }]
      ]);

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );
      
      // Select Active + critical (should match indices 0, 3)
      const criteria = {
        states: ['Active'],
        tags: ['critical']
      };
      
      const selected = queryHandleService.getItemsByCriteria(queryHandle, criteria);
      expect(selected).toHaveLength(2);
      expect(selected).toEqual([1, 4]); // Items 1 and 4 match criteria
      
      // Bulk comment those items (dry run)
      const mockCommentConfig = {
        name: 'wit-bulk-comment',
        description: 'Test',
        script: '',
        schema: bulkCommentByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const commentResult = await handleBulkCommentByQueryHandle(mockCommentConfig, {
        queryHandle,
        itemSelector: criteria,
        comment: 'Active critical items need attention',
        dryRun: true
      });
      
      expect(commentResult.success).toBe(true);
      expect(commentResult.data.selected_items_count).toBe(2);
    });
  });

  describe('Scenario 5: Selection by Staleness', () => {
    it('should select stale items for followup', async () => {
      const workItemIds = [1, 2, 3, 4];
      const workItemContext = new Map([
        [1, { title: 'Item 1', state: 'Active', type: 'Task', daysInactive: 2 }],
        [2, { title: 'Item 2', state: 'Active', type: 'Task', daysInactive: 10 }],
        [3, { title: 'Item 3', state: 'Active', type: 'Task', daysInactive: 15 }],
        [4, { title: 'Item 4', state: 'Active', type: 'Task', daysInactive: 5 }]
      ]);

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );
      
      // Select items inactive >= 7 days
      const selected = queryHandleService.getItemsByCriteria(
        queryHandle,
        { daysInactiveMin: 7 }
      );
      
      expect(selected).toHaveLength(2); // Items 2 and 3 (10 and 15 days)
      expect(selected).toEqual([2, 3]);
      
      // Comment on stale items (dry run)
      const mockCommentConfig = {
        name: 'wit-bulk-comment',
        description: 'Test',
        script: '',
        schema: bulkCommentByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkCommentByQueryHandle(mockCommentConfig, {
        queryHandle,
        itemSelector: { daysInactiveMin: 7 },
        comment: 'This item has been inactive for {{daysInactive}} days',
        template: true,
        dryRun: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data.selected_items_count).toBe(2);
    });
  });

  describe('Scenario 6: Error Cases', () => {
    describe('Error Handling', () => {
      
      it('should handle invalid query handle gracefully', () => {
        const result = queryHandleService.getItemsByIndices('invalid-handle', [0]);
        expect(result).toBeNull();
      });
      
      it('should handle expired query handle', async () => {
        const queryHandle = queryHandleService.storeQuery([1, 2], 'test', {}, 0); // 0ms TTL
        await sleep(10); // Wait for expiration
        
        const result = queryHandleService.getItemsByIndices(queryHandle, [0]);
        expect(result).toBeNull();
      });
      
      it('should handle empty selection gracefully', async () => {
        const queryHandle = createTestQueryHandle(5);
        
        const mockCommentConfig = {
          name: 'wit-bulk-comment',
          description: 'Test',
          script: '',
          schema: bulkCommentByQueryHandleSchema,
          inputSchema: { type: 'object' as const }
        };

        const result = await handleBulkCommentByQueryHandle(mockCommentConfig, {
          queryHandle,
          itemSelector: { states: ['NonExistentState'] }, // No matches
          comment: 'Test',
          dryRun: true
        });
        
        // Operation succeeds but affects 0 items
        expect(result.success).toBe(true);
        expect(result.data.selected_items_count).toBe(0);
        expect(result.data.summary).toContain('0 of 5');
      });
      
      it('should validate indices are within bounds', () => {
        const queryHandle = createTestQueryHandle(3); // Only 3 items (indices 0, 1, 2)
        
        const selected = queryHandleService.getItemsByIndices(queryHandle, [0, 1, 5, 10]);
        
        // Should only return valid indices
        expect(selected).toHaveLength(2);
        expect(selected).toEqual([1, 2]); // IDs for indices 0 and 1
      });
    });
  });
});
