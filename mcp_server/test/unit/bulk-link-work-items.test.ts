/**
 * Bulk Link Work Items Handler Tests
 * 
 * Tests for the wit-link-work-items-by-query-handles tool
 * that creates relationships between work items from two query handles.
 */

import { handleLinkWorkItemsByQueryHandles } from '../../src/services/handlers/bulk-operations/bulk-link-handler';
import { queryHandleService } from '../../src/services/query-handle-service';
import { linkWorkItemsByQueryHandlesSchema } from '../../src/config/schemas';
import type { ToolConfig } from '../../src/types/index';

// Mock dependencies
jest.mock('../../src/services/ado-discovery-service', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../../src/utils/ado-http-client', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({
      data: {
        id: 123,
        relations: []
      }
    }),
    patch: jest.fn().mockResolvedValue({
      data: {
        id: 123,
        relations: [{ rel: 'System.LinkTypes.Hierarchy-Forward', url: 'url' }]
      }
    })
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

describe('Bulk Link Work Items Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-link-work-items',
    description: 'Test tool',
    script: '',
    schema: linkWorkItemsByQueryHandlesSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Link strategies', () => {
    it('should create one-to-one links', async () => {
      const sourceIds = [101, 102, 103];
      const targetIds = [201, 202, 203];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Source ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Target ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(
        sourceIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = "Task"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        sourceContext
      );

      const targetHandle = queryHandleService.storeQuery(
        targetIds,
        'SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = "Feature"',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        targetContext
      );

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_operations_count).toBe(3);
      expect(result.data.preview).toHaveLength(3);
    });

    it('should create one-to-many links', async () => {
      const sourceIds = [101];
      const targetIds = [201, 202, 203];

      const sourceContext = new Map([
        [101, { title: 'Epic 1', state: 'Active', type: 'Epic' }]
      ]);
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(
        sourceIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        sourceContext
      );

      const targetHandle = queryHandleService.storeQuery(
        targetIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        targetContext
      );

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Child',
        linkStrategy: 'one-to-many',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_operations_count).toBe(3); // 1 source to 3 targets
    });

    it('should create many-to-one links', async () => {
      const sourceIds = [101, 102, 103];
      const targetIds = [201];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(
        sourceIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        sourceContext
      );

      const targetHandle = queryHandleService.storeQuery(
        targetIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        targetContext
      );

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'many-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_operations_count).toBe(3); // 3 sources to 1 target
    });

    it('should create many-to-many links', async () => {
      const sourceIds = [101, 102];
      const targetIds = [201, 202];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Bug ${id}`, state: 'Active', type: 'Bug' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );

      const sourceHandle = queryHandleService.storeQuery(
        sourceIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        sourceContext
      );

      const targetHandle = queryHandleService.storeQuery(
        targetIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        targetContext
      );

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Related',
        linkStrategy: 'many-to-many',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_operations_count).toBe(4); // 2x2 = 4 links
    });
  });

  describe('Link types', () => {
    it('should support Parent link type', async () => {
      const sourceIds = [101];
      const targetIds = [201];

      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_type_ref).toBe('System.LinkTypes.Hierarchy-Reverse');
    });

    it('should support Child link type', async () => {
      const sourceIds = [101];
      const targetIds = [201];

      const sourceContext = new Map([
        [101, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Child',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_type_ref).toBe('System.LinkTypes.Hierarchy-Forward');
    });

    it('should support Related link type', async () => {
      const sourceIds = [101];
      const targetIds = [201];

      const sourceContext = new Map([
        [101, { title: 'Bug 1', state: 'Active', type: 'Bug' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Bug 2', state: 'Active', type: 'Bug' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Related',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_type_ref).toBe('System.LinkTypes.Related');
    });

    it('should support dependency link types', async () => {
      const sourceIds = [101];
      const targetIds = [201];

      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Task 2', state: 'Active', type: 'Task' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Successor',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_type_ref).toBe('System.LinkTypes.Dependency-Forward');
    });
  });

  describe('Item selection', () => {
    it('should support source item selector', async () => {
      const sourceIds = [101, 102, 103, 104];
      const targetIds = [201, 202];

      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task', tags: 'frontend' }],
        [102, { title: 'Task 2', state: 'Done', type: 'Task', tags: 'backend' }],
        [103, { title: 'Task 3', state: 'Active', type: 'Task', tags: 'frontend' }],
        [104, { title: 'Task 4', state: 'Active', type: 'Task', tags: 'backend' }]
      ]);
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'many-to-one',
        sourceItemSelector: { states: ['Active'], tags: ['frontend'] },
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.source_items_selected).toBe(2); // Tasks 1 and 3
    });

    it('should support target item selector', async () => {
      const sourceIds = [101, 102];
      const targetIds = [201, 202, 203, 204];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature', tags: 'priority' }],
        [202, { title: 'Feature 2', state: 'Done', type: 'Feature', tags: 'normal' }],
        [203, { title: 'Feature 3', state: 'Active', type: 'Feature', tags: 'priority' }],
        [204, { title: 'Feature 4', state: 'Active', type: 'Feature', tags: 'normal' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-many',
        targetItemSelector: { states: ['Active'], tags: ['priority'] },
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.target_items_selected).toBe(2); // Features 1 and 3
    });

    it('should support index-based selectors', async () => {
      const sourceIds = [101, 102, 103];
      const targetIds = [201, 202, 203];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        sourceItemSelector: [0, 2], // Select 1st and 3rd items
        targetItemSelector: [1, 2], // Select 2nd and 3rd items
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.source_items_selected).toBe(2);
      expect(result.data.target_items_selected).toBe(2);
    });
  });

  describe('Dry run mode', () => {
    it('should show preview without creating links', async () => {
      const sourceIds = [101, 102];
      const targetIds = [201, 202];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.dry_run).toBe(true);
      expect(result.data.preview).toBeDefined();
      expect(result.warnings).toContain('Dry run mode - no links created');
    });

    it('should limit preview to maxPreviewItems', async () => {
      const sourceIds = Array.from({ length: 10 }, (_, i) => 101 + i);
      const targetIds = Array.from({ length: 10 }, (_, i) => 201 + i);

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Related',
        linkStrategy: 'one-to-one',
        dryRun: true,
        maxPreviewItems: 5
      });

      expect(result.success).toBe(true);
      expect(result.data.preview).toHaveLength(5);
      expect(result.data.link_operations_count).toBe(10);
    });
  });

  describe('Execution mode', () => {
    it('should create links successfully', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockPatch = jest.fn().mockResolvedValue({
        data: { id: 101, relations: [] }
      });
      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ data: { id: 101, relations: [] } }),
        patch: mockPatch
      }));

      const sourceIds = [101, 102];
      const targetIds = [201, 202];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect(result.data.links_succeeded).toBe(2);
      expect(result.data.links_failed).toBe(0);
      expect(mockPatch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockPatch = jest.fn()
        .mockResolvedValueOnce({ data: { id: 101, relations: [] } })
        .mockRejectedValueOnce(new Error('Link creation failed'));

      ADOHttpClient.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ data: { id: 101, relations: [] } }),
        patch: mockPatch
      }));

      const sourceIds = [101, 102];
      const targetIds = [201, 202];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect(result.data.links_succeeded).toBe(1);
      expect(result.data.links_failed).toBe(1);
    });

    it('should skip existing links when skipExisting=true', async () => {
      const { ADOHttpClient } = require('../../src/utils/ado-http-client');
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          id: 101,
          relations: [{
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: 'https://dev.azure.com/org/project/_apis/wit/workItems/201'
          }]
        }
      });

      ADOHttpClient.mockImplementation(() => ({
        get: mockGet,
        patch: jest.fn().mockResolvedValue({ data: { id: 101, relations: [] } })
      }));

      const sourceIds = [101];
      const targetIds = [201];

      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        skipExisting: true,
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect(result.data.links_skipped).toBe(1);
    });
  });

  describe('Link validation', () => {
    it('should validate hierarchical link types', async () => {
      const sourceIds = [101];
      const targetIds = [201];

      // Invalid: Task cannot be parent of Feature
      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Child', // Task trying to be parent of Feature (invalid)
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringMatching(/cannot be a parent|validation/i)])
      );
    });

    it('should allow valid hierarchical relationships', async () => {
      const sourceIds = [101];
      const targetIds = [201];

      const sourceContext = new Map([
        [101, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);
      const targetContext = new Map([
        [201, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Child', // Feature as parent of Task (valid)
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return error for invalid source query handle', async () => {
      const targetIds = [201];
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: 'qh_invalid',
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Source query handle')])
      );
    });

    it('should return error for invalid target query handle', async () => {
      const sourceIds = [101];
      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: 'qh_invalid',
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Target query handle')])
      );
    });

    it('should return error when Azure CLI not available', async () => {
      const { validateAzureCLI } = require('../../src/services/ado-discovery-service');
      validateAzureCLI.mockReturnValueOnce({
        isAvailable: false,
        isLoggedIn: false
      });

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: 'qh_test1',
        targetQueryHandle: 'qh_test2',
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Azure CLI')])
      );
    });

    it('should handle invalid link type', async () => {
      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: 'qh_test1',
        targetQueryHandle: 'qh_test2',
        linkType: 'InvalidType' as any,
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error when no source items selected', async () => {
      const sourceIds = [101, 102];
      const targetIds = [201];

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        sourceItemSelector: { states: ['Done'] }, // No items match
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('No source items')])
      );
    });

    it('should return error when no target items selected', async () => {
      const sourceIds = [101];
      const targetIds = [201, 202];

      const sourceContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      const targetContext = new Map(
        targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
      );

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        targetItemSelector: { states: ['Removed'] }, // No items match
        dryRun: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('No target items')])
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle mismatched counts in one-to-one strategy', async () => {
      const sourceIds = [101, 102, 103];
      const targetIds = [201]; // Only 1 target for 3 sources

      const sourceContext = new Map(
        sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
      );
      const targetContext = new Map([
        [201, { title: 'Feature 1', state: 'Active', type: 'Feature' }]
      ]);

      const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
      const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: sourceHandle,
        targetQueryHandle: targetHandle,
        linkType: 'Parent',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.link_operations_count).toBe(1); // Only 1 pair can be created
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringMatching(/mismatch|unpaired/i)])
      );
    });

    it('should handle self-referencing links', async () => {
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(workItemIds, 'query', {}, 60000, workItemContext);

      const result = await handleLinkWorkItemsByQueryHandles(mockConfig, {
        sourceQueryHandle: handle,
        targetQueryHandle: handle, // Same handle for source and target
        linkType: 'Related',
        linkStrategy: 'one-to-one',
        dryRun: true
      });

      // Should either skip self-links or return warning
      expect(result.success).toBe(true);
      if (result.warnings.length > 0) {
        expect(result.warnings).toEqual(
          expect.arrayContaining([expect.stringMatching(/self|circular/i)])
        );
      }
    });
  });
});
