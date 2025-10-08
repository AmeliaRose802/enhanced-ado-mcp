// @ts-nocheck
/**
 * Bulk Transition State Handler Tests
 * 
 * Tests for the wit-bulk-transition-state-by-query-handle tool
 * that safely transitions multiple work items to a new state.
 */

import { handleBulkTransitionState } from '../../src/services/handlers/bulk-operations/bulk-transition-handler';
import { queryHandleService } from '../../src/services/query-handle-service';
import { bulkTransitionStateByQueryHandleSchema } from '../../src/config/schemas';
import type { ToolConfig } from '../../src/types/index';

// Mock dependencies
jest.mock('../../src/services/ado-discovery-service', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

// Create mocks at module level
const mockGet = jest.fn();
const mockPatch = jest.fn();

jest.mock('../../src/utils/ado-http-client', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: mockGet,
    patch: mockPatch
  }))
}));

jest.mock('../../src/config/config', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  }))
}));

describe('Bulk Transition State Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-bulk-transition-state',
    description: 'Test tool',
    script: '',
    schema: bulkTransitionStateByQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
    
    // Configure default mock responses
    mockGet.mockResolvedValue({
      data: {
        count: 1,
        value: [
          {
            id: 101,
            fields: {
              'System.Id': 101,
              'System.State': 'Active',
              'System.WorkItemType': 'Bug',
              'System.Title': 'Test Bug'
            }
          }
        ]
      }
    });
    
    mockPatch.mockResolvedValue({
      data: {
        id: 101,
        fields: {
          'System.State': 'Resolved',
          'System.Reason': 'Fixed'
        }
      }
    });
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('State transition validation', () => {
    it('should validate valid state transitions', async () => {
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }],
        [102, { title: 'Bug 2', state: 'Active', type: 'Bug' }],
        [103, { title: 'Bug 3', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        reason: 'Fixed',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
      expect((result.data as any).dry_run).toBe(true);
    });

    it('should detect invalid state transitions', async () => {
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Removed', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Active',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Removed')])
      );
    });

    it('should allow transitions between common states', async () => {
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'New', type: 'Task' }],
        [102, { title: 'Task 2', state: 'Active', type: 'Task' }],
        [103, { title: 'Task 3', state: 'In Progress', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Done',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).dry_run).toBe(true);
    });
  });

  describe('Item selection', () => {
    it('should transition only selected items by index', async () => {
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

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        itemSelector: [0, 2, 4], // Select 1st, 3rd, and 5th items
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(3);
      expect((result.data as any).total_items_in_handle).toBe(5);
      expect((result.data as any).preview_items).toHaveLength(3);
    });

    it('should transition items matching criteria', async () => {
      const workItemIds = [101, 102, 103, 104];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug', tags: 'critical' }],
        [102, { title: 'Task 1', state: 'Active', type: 'Task', tags: 'normal' }],
        [103, { title: 'Bug 2', state: 'New', type: 'Bug', tags: 'critical' }],
        [104, { title: 'Bug 3', state: 'Active', type: 'Bug', tags: 'normal' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        itemSelector: { states: ['Active'], tags: ['critical'] },
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).selected_items_count).toBe(1); // Only Bug 1 matches
    });

    it('should return error when no items selected', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }],
        [102, { title: 'Bug 2', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        itemSelector: { states: ['Removed'] }, // No items match
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('No items')])
      );
    });
  });

  describe('Dry run mode', () => {
    it('should show preview without making changes', async () => {
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

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Done',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).dry_run).toBe(true);
      expect((result.data as any).preview_items).toBeDefined();
    });

    it('should limit preview items to maxPreviewItems', async () => {
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

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Done',
        itemSelector: 'all',
        dryRun: true,
        maxPreviewItems: 5
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(5);
      expect((result.data as any).selected_items_count).toBe(20);
    });
  });

  describe('Execution mode', () => {
    it('should transition work items successfully', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockPatch = jest.fn().mockResolvedValue({
        data: { id: 101, fields: { 'System.State': 'Resolved' } }
      });
      ADOHttpClient.mockImplementation(() => ({ patch: mockPatch }));

      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }],
        [102, { title: 'Bug 2', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        reason: 'Fixed',
        itemSelector: 'all',
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect((result.data as any).successful).toBe(2);
      expect((result.data as any).failed).toBe(0);
      expect(mockPatch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures gracefully', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockPatch = jest.fn()
        .mockResolvedValueOnce({ data: { id: 101, fields: { 'System.State': 'Resolved' } } })
        .mockRejectedValueOnce(new Error('API Error'));

      ADOHttpClient.mockImplementation(() => ({ patch: mockPatch }));

      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }],
        [102, { title: 'Bug 2', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        itemSelector: 'all',
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect((result.data as any).successful).toBe(1);
      expect((result.data as any).failed).toBe(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('1 item(s) failed')])
      );
    });
  });

  describe('Optional parameters', () => {
    it('should include reason when provided', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockPatch = jest.fn().mockResolvedValue({
        data: { id: 101, fields: { 'System.State': 'Resolved' } }
      });
      ADOHttpClient.mockImplementation(() => ({ patch: mockPatch }));

      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        reason: 'Fixed',
        itemSelector: 'all',
        dryRun: false
      });

      const patchCall = mockPatch.mock.calls[0];
      expect(patchCall[1]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: '/fields/System.Reason',
            value: 'Fixed'
          })
        ])
      );
    });

    it('should include comment when provided', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockPatch = jest.fn().mockResolvedValue({
        data: { id: 101, fields: { 'System.State': 'Resolved' } }
      });
      ADOHttpClient.mockImplementation(() => ({ patch: mockPatch }));

      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        comment: 'Resolved as part of sprint cleanup',
        itemSelector: 'all',
        dryRun: false
      });

      const patchCall = mockPatch.mock.calls[0];
      expect(patchCall[1]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: '/fields/System.History',
            value: expect.stringContaining('Resolved as part of sprint cleanup')
          })
        ])
      );
    });
  });

  describe('Error handling', () => {
    it('should return error for invalid query handle', async () => {
      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: 'qh_invalid',
        targetState: 'Resolved',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('not found or expired')])
      );
    });

    it('should return error when Azure CLI not available', async () => {
      const { validateAzureCLI } = require('../../src/services/ado-discovery-service');
      validateAzureCLI.mockReturnValueOnce({
        isAvailable: false,
        isLoggedIn: false
      });

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: 'qh_test',
        targetState: 'Resolved',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Azure CLI')])
      );
    });

    it('should handle schema validation errors', async () => {
      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: 'qh_test',
        // Missing required targetState
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle expired query handles', async () => {
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }]
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

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('expired')])
      );
    });

    it('should handle items already in target state', async () => {
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { title: 'Bug 1', state: 'Resolved', type: 'Bug' }], // Already resolved
        [102, { title: 'Bug 2', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleBulkTransitionState(mockConfig, {
        queryHandle: handle,
        targetState: 'Resolved',
        itemSelector: 'all',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('already in target state')])
      );
    });
  });
});

