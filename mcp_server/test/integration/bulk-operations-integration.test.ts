// @ts-nocheck
/**
 * Bulk Operations Integration Tests
 * 
 * End-to-end integration tests that validate complete workflows from 
 * query → bulk operations using newly added tools.
 */

import { queryHandleService } from '../../src/services/query-handle-service';
import { handleBulkTransitionState } from '../../src/services/handlers/bulk-operations/bulk-transition-handler';
import { handleBulkMoveToIteration } from '../../src/services/handlers/bulk-operations/bulk-move-iteration-handler';
import { handleBulkLinkByQueryHandles } from '../../src/services/handlers/bulk-operations/bulk-link-handler';
import { handleGetContextPackagesByQueryHandle } from '../../src/services/handlers/context/get-context-packages-by-query-handle.handler';
import { 
  bulkTransitionStateByQueryHandleSchema,
  bulkMoveToIterationByQueryHandleSchema,
  linkWorkItemsByQueryHandlesSchema,
  getContextPackagesByQueryHandleSchema
} from '../../src/config/schemas';

// Mock configuration
jest.mock('../../src/config/config', () => ({
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
jest.mock('../../src/services/ado-discovery-service', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true,
    version: '2.50.0'
  }))
}));

// Mock ADO HTTP Client
jest.mock('../../src/utils/ado-http-client', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation((url: string) => {
      // Mock work items fetch
      if (url.includes('wit/workitems?ids=')) {
        const idsMatch = url.match(/ids=([\d,]+)/);
        if (idsMatch) {
          const ids = idsMatch[1].split(',').map(Number);
          return Promise.resolve({
            data: {
              count: ids.length,
              value: ids.map(id => ({
                id,
                fields: {
                  'System.Id': id,
                  'System.Title': `Test Item ${id}`,
                  'System.WorkItemType': 'Task',
                  'System.State': 'Active',
                  'System.IterationPath': 'TestProject\\Backlog'
                },
                relations: []
              }))
            }
          });
        }
      }
      // Mock iteration fetch
      return Promise.resolve({
        data: {
          value: [{
            id: 'iteration-id',
            name: 'Sprint 11',
            path: 'TestProject\\Sprint 11'
          }]
        }
      });
    }),
    patch: jest.fn().mockResolvedValue({
      data: {
        id: 123,
        fields: {
          'System.State': 'Done',
          'System.IterationPath': 'TestProject\\Sprint 11'
        },
        relations: []
      }
    }),
    post: jest.fn().mockResolvedValue({
      data: {
        id: 1,
        workItemId: 123,
        text: 'Test comment'
      }
    })
  }))
}));

// Mock context package handler
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

describe('Bulk Operations Integration Tests', () => {
  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Scenario 1: Sprint Planning - Move and Transition', () => {
    it('should move items to new sprint then transition to active', async () => {
      // 1. Create query handle with backlog items
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { title: 'Feature 1', state: 'New', type: 'Feature', iterationPath: 'TestProject\\Backlog' }],
        [102, { title: 'Bug 1', state: 'New', type: 'Bug', iterationPath: 'TestProject\\Backlog' }],
        [103, { title: 'Task 1', state: 'New', type: 'Task', iterationPath: 'TestProject\\Backlog' }],
        [104, { title: 'Task 2', state: 'New', type: 'Task', iterationPath: 'TestProject\\Backlog' }]
      ]);

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = "TestProject\\Backlog"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // 2. Preview move to sprint
      const moveConfig = {
        name: 'wit-bulk-move-to-iteration',
        description: 'Test',
        script: '',
        schema: bulkMoveToIterationByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const movePreview = await handleBulkMoveToIteration(moveConfig, {
        queryHandle,
        targetIterationPath: 'TestProject\\Sprint 11',
        itemSelector: 'all',
        dryRun: true
      });

      expect(movePreview.success).toBe(true);
      expect((movePreview.data as any).selected_items_count).toBe(4);
      expect((movePreview.data as any).dry_run).toBe(true);

      // 3. Execute move to sprint
      const moveResult = await handleBulkMoveToIteration(moveConfig, {
        queryHandle,
        targetIterationPath: 'TestProject\\Sprint 11',
        itemSelector: 'all',
        comment: 'Moved to Sprint 11 for completion',
        dryRun: false
      });

      expect(moveResult.success).toBe(true);
      expect((moveResult.data as any).successful).toBeGreaterThan(0);

      // 4. Transition items to Active
      const transitionConfig = {
        name: 'wit-bulk-transition-state',
        description: 'Test',
        script: '',
        schema: bulkTransitionStateByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const transitionResult = await handleBulkTransitionState(transitionConfig, {
        queryHandle,
        targetState: 'Active',
        reason: 'Sprint Started',
        comment: 'Starting work in Sprint 11',
        itemSelector: 'all',
        dryRun: false
      });

      expect(transitionResult.success).toBe(true);
      expect((transitionResult.data as any).selected_items).toBeGreaterThan(0);
    });
  });

  describe('Scenario 2: Feature Decomposition - Create Hierarchy', () => {
    it('should link tasks to features using query handles', async () => {
      // 1. Create query handles for features and tasks
      const featureIds = [201, 202];
      const taskIds = [301, 302, 303, 304];

      const featureContext = new Map([
        [201, { title: 'Feature A', state: 'Active', type: 'Feature' }],
        [202, { title: 'Feature B', state: 'Active', type: 'Feature' }]
      ]);

      const taskContext = new Map([
        [301, { title: 'Task A1', state: 'New', type: 'Task' }],
        [302, { title: 'Task A2', state: 'New', type: 'Task' }],
        [303, { title: 'Task B1', state: 'New', type: 'Task' }],
        [304, { title: 'Task B2', state: 'New', type: 'Task' }]
      ]);

      const featureHandle = queryHandleService.storeQuery(
        featureIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = "Feature"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        featureContext
      );

      const taskHandle = queryHandleService.storeQuery(
        taskIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = "Task"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        taskContext
      );

      // 2. Link first 2 tasks to first feature (one-to-many)
      const linkConfig = {
        name: 'wit-link-work-items',
        description: 'Test',
        script: '',
        schema: linkWorkItemsByQueryHandlesSchema,
        inputSchema: { type: 'object' as const }
      };

      const linkResult1 = await handleBulkLinkByQueryHandles(linkConfig, {
        sourceQueryHandle: taskHandle,
        targetQueryHandle: featureHandle,
        linkType: 'Parent',
        linkStrategy: 'many-to-one',
        sourceItemSelector: [0, 1], // First 2 tasks
        targetItemSelector: [0], // First feature
        dryRun: false
      });

      expect(linkResult1.success).toBe(true);
      expect((linkResult1.data as any).link_operations_count).toBe(2);

      // 3. Link remaining tasks to second feature
      const linkResult2 = await handleBulkLinkByQueryHandles(linkConfig, {
        sourceQueryHandle: taskHandle,
        targetQueryHandle: featureHandle,
        linkType: 'Parent',
        linkStrategy: 'many-to-one',
        sourceItemSelector: [2, 3], // Last 2 tasks
        targetItemSelector: [1], // Second feature
        dryRun: false
      });

      expect(linkResult2.success).toBe(true);
      expect((linkResult2.data as any).link_operations_count).toBe(2);
    });
  });

  describe('Scenario 3: Sprint Cleanup - Bulk Transition and Context', () => {
    it('should transition completed items and retrieve context', async () => {
      // 1. Create query with sprint items
      const workItemIds = [401, 402, 403, 404, 405];
      const workItemContext = new Map([
        [401, { title: 'Task 1', state: 'Active', type: 'Task', tags: 'frontend' }],
        [402, { title: 'Task 2', state: 'Active', type: 'Task', tags: 'backend' }],
        [403, { title: 'Bug 1', state: 'Active', type: 'Bug', tags: 'critical' }],
        [404, { title: 'Task 3', state: 'Active', type: 'Task', tags: 'frontend' }],
        [405, { title: 'Bug 2', state: 'Active', type: 'Bug', tags: 'normal' }]
      ]);

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // 2. Transition frontend tasks to Done
      const transitionConfig = {
        name: 'wit-bulk-transition-state',
        description: 'Test',
        script: '',
        schema: bulkTransitionStateByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const transitionResult = await handleBulkTransitionState(transitionConfig, {
        queryHandle,
        targetState: 'Done',
        itemSelector: { tags: ['frontend'] },
        comment: 'Completed frontend work',
        dryRun: false
      });

      expect(transitionResult.success).toBe(true);
      expect((transitionResult.data as any).selected_items).toBe(2); // Tasks 1 and 4

      // 3. Get context for remaining active items
      const contextConfig = {
        name: 'wit-get-context-packages',
        description: 'Test',
        script: '',
        schema: getContextPackagesByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const contextResult = await handleGetContextPackagesByQueryHandle(contextConfig, {
        queryHandle,
        itemSelector: 'all', // Get all items in the query handle
        includeComments: true,
        includeRelations: true,
        maxPreviewItems: 10
      });

      expect(contextResult.success).toBe(true);
      // Verify we got a result (mock may not fully populate all fields)
      expect(contextResult.data).toBeDefined();
    });
  });

  describe('Scenario 4: Dependency Chain - Link Related Items', () => {
    it('should create dependency links between tasks', async () => {
      // 1. Create query handles for blockers and blocked items
      const blockerIds = [501, 502];
      const blockedIds = [601, 602, 603];

      const blockerContext = new Map([
        [501, { title: 'Infrastructure Setup', state: 'Done', type: 'Task' }],
        [502, { title: 'API Design', state: 'Done', type: 'Task' }]
      ]);

      const blockedContext = new Map([
        [601, { title: 'Build Frontend', state: 'New', type: 'Task' }],
        [602, { title: 'Implement API', state: 'New', type: 'Task' }],
        [603, { title: 'Integration Tests', state: 'New', type: 'Task' }]
      ]);

      const blockerHandle = queryHandleService.storeQuery(
        blockerIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS "blocker"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        blockerContext
      );

      const blockedHandle = queryHandleService.storeQuery(
        blockedIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS "blocked"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        blockedContext
      );

      // 2. Create predecessor links (blockers are predecessors)
      const linkConfig = {
        name: 'wit-link-work-items',
        description: 'Test',
        script: '',
        schema: linkWorkItemsByQueryHandlesSchema,
        inputSchema: { type: 'object' as const }
      };

      const linkResult = await handleBulkLinkByQueryHandles(linkConfig, {
        sourceQueryHandle: blockerHandle,
        targetQueryHandle: blockedHandle,
        linkType: 'Successor',
        linkStrategy: 'many-to-many', // All blockers block all items
        dryRun: false
      });

      expect(linkResult.success).toBe(true);
      expect((linkResult.data as any).link_operations_count).toBe(6); // 2 blockers × 3 blocked = 6 links
    });
  });

  describe('Scenario 5: Selective Operations with Criteria', () => {
    it('should perform selective operations based on multiple criteria', async () => {
      // 1. Create diverse work item set
      const workItemIds = [701, 702, 703, 704, 705, 706];
      const workItemContext = new Map([
        [701, { title: 'Critical Bug', state: 'New', type: 'Bug', tags: 'critical;security', daysInactive: 1 }],
        [702, { title: 'Normal Bug', state: 'New', type: 'Bug', tags: 'normal', daysInactive: 5 }],
        [703, { title: 'Old Task', state: 'Active', type: 'Task', tags: 'technical-debt', daysInactive: 45 }],
        [704, { title: 'Recent Task', state: 'Active', type: 'Task', tags: 'feature', daysInactive: 2 }],
        [705, { title: 'Stale Bug', state: 'Active', type: 'Bug', tags: 'normal', daysInactive: 60 }],
        [706, { title: 'New Feature', state: 'New', type: 'Task', tags: 'feature', daysInactive: 0 }]
      ]);

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // 2. Transition only critical bugs to resolved
      const transitionConfig = {
        name: 'wit-bulk-transition-state',
        description: 'Test',
        script: '',
        schema: bulkTransitionStateByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const criticalResult = await handleBulkTransitionState(transitionConfig, {
        queryHandle,
        targetState: 'Resolved',
        itemSelector: { tags: ['critical'] },
        reason: 'Security issue fixed',
        dryRun: false
      });

      expect(criticalResult.success).toBe(true);
      expect((criticalResult.data as any).selected_items).toBe(1); // Only critical bug

      // 3. Move stale items to technical debt sprint
      const moveConfig = {
        name: 'wit-bulk-move-to-iteration',
        description: 'Test',
        script: '',
        schema: bulkMoveToIterationByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const staleResult = await handleBulkMoveToIteration(moveConfig, {
        queryHandle,
        targetIterationPath: 'TestProject\\Technical Debt',
        itemSelector: { daysInactiveMin: 30 }, // Items inactive for 30+ days
        comment: 'Moving stale items to tech debt sprint',
        dryRun: false
      });

      expect(staleResult.success).toBe(true);
      expect((staleResult.data as any).selected_items).toBe(2); // Old task and stale bug

      // 4. Get context for remaining new items
      const contextConfig = {
        name: 'wit-get-context-packages',
        description: 'Test',
        script: '',
        schema: getContextPackagesByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const contextResult = await handleGetContextPackagesByQueryHandle(contextConfig, {
        queryHandle,
        itemSelector: { states: ['New'] },
        maxPreviewItems: 5
      });

      expect(contextResult.success).toBe(true);
      // Verify we got a result (mock may not fully populate all fields)
      expect(contextResult.data).toBeDefined();
    });
  });

  describe('Scenario 6: Error Recovery and Partial Success', () => {
    it('should handle partial failures gracefully', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      
      // Mock partial failure
      const mockPatch = jest.fn()
        .mockResolvedValueOnce({ data: { id: 801, fields: { 'System.State': 'Done' } } })
        .mockRejectedValueOnce(new Error('API rate limit exceeded'))
        .mockResolvedValueOnce({ data: { id: 803, fields: { 'System.State': 'Done' } } });

      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ data: { value: [] } }),
        patch: mockPatch
      }));

      const workItemIds = [801, 802, 803];
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );

      const queryHandle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const transitionConfig = {
        name: 'wit-bulk-transition-state',
        description: 'Test',
        script: '',
        schema: bulkTransitionStateByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkTransitionState(transitionConfig, {
        queryHandle,
        targetState: 'Done',
        itemSelector: 'all',
        dryRun: false
      });

      expect(result.success).toBe(false); // Should fail when there are failures
      expect((result.data as any).items_succeeded).toBe(2);
      expect((result.data as any).items_failed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0); // Should have error messages
    });
  });
});

