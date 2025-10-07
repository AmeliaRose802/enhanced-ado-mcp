/**
 * Tests for new handle-based analysis tools
 */

import { handleAnalyzeByQueryHandle } from '../services/handlers/ai-powered/analyze-by-query-handle.handler.js';
import { handleListQueryHandles } from '../services/handlers/query-handles/list-query-handles.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { analyzeByQueryHandleSchema, listQueryHandlesSchema } from '../config/schemas.js';

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
    get: jest.fn().mockResolvedValue({
      data: {
        value: [
          {
            id: 12345,
            fields: {
              'System.Title': 'Test Item 1',
              'System.WorkItemType': 'PBI',
              'System.State': 'Active',
              'System.AssignedTo': { displayName: 'John Doe' },
              'Microsoft.VSTS.Scheduling.StoryPoints': 5,
              'Microsoft.VSTS.Common.Priority': 2,
              'System.CreatedDate': '2025-01-01T00:00:00Z',
              'System.ChangedDate': '2025-10-01T00:00:00Z',
              'System.Tags': '',
              'System.Description': 'Test description'
            }
          },
          {
            id: 67890,
            fields: {
              'System.Title': 'Test Item 2',
              'System.WorkItemType': 'Bug',
              'System.State': 'Done',
              'System.AssignedTo': { displayName: 'Jane Smith' },
              'Microsoft.VSTS.Scheduling.StoryPoints': 3,
              'Microsoft.VSTS.Common.Priority': 1,
              'System.CreatedDate': '2025-02-01T00:00:00Z',
              'System.ChangedDate': '2025-10-02T00:00:00Z',
              'System.Tags': 'Blocked',
              'System.Description': 'Bug description'
            }
          }
        ]
      }
    })
  }))
}));

describe('Handle-Based Analysis Tools', () => {
  beforeEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('wit-analyze-by-query-handle', () => {
    const mockConfig = {
      name: 'wit-analyze-by-query-handle',
      description: 'Test',
      script: '',
      schema: analyzeByQueryHandleSchema,
      inputSchema: {}
    };

    it('should analyze work items using query handle', async () => {
      // Set up query handle
      const workItemIds = [12345, 67890];
      const query = 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"';
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleAnalyzeByQueryHandle(mockConfig, {
        queryHandle: handle,
        analysisType: ['effort', 'assignments', 'completion']
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.query_handle).toBe(handle);
      expect(result.data.item_count).toBe(2);
      expect(result.data.results).toBeDefined();
      expect(result.data.results.effort).toBeDefined();
      expect(result.data.results.assignments).toBeDefined();
      expect(result.data.results.completion).toBeDefined();
    });

    it('should return error for non-existent query handle', async () => {
      const result = await handleAnalyzeByQueryHandle(mockConfig, {
        queryHandle: 'qh_nonexistent',
        analysisType: ['effort']
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should analyze effort correctly', async () => {
      const workItemIds = [12345, 67890];
      const query = 'SELECT [System.Id] FROM WorkItems';
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleAnalyzeByQueryHandle(mockConfig, {
        queryHandle: handle,
        analysisType: ['effort']
      });

      expect(result.success).toBe(true);
      expect(result.data.results.effort).toBeDefined();
      expect(result.data.results.effort.total_items).toBe(2);
      expect(result.data.results.effort.total_story_points).toBe(8); // 5 + 3
      expect(result.data.results.effort.items_with_story_points).toBe(2);
      expect(result.data.results.effort.estimation_coverage).toBe(100);
    });

    it('should analyze assignments correctly', async () => {
      const workItemIds = [12345, 67890];
      const query = 'SELECT [System.Id] FROM WorkItems';
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleAnalyzeByQueryHandle(mockConfig, {
        queryHandle: handle,
        analysisType: ['assignments']
      });

      expect(result.success).toBe(true);
      expect(result.data.results.assignments).toBeDefined();
      expect(result.data.results.assignments.total_items).toBe(2);
      expect(result.data.results.assignments.assigned_items).toBe(2);
      expect(result.data.results.assignments.unassigned_items).toBe(0);
      expect(result.data.results.assignments.unique_assignees).toBe(2);
      expect(result.data.results.assignments.assignment_coverage).toBe(100);
    });

    it('should analyze risks correctly', async () => {
      const workItemIds = [12345, 67890];
      const query = 'SELECT [System.Id] FROM WorkItems';
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleAnalyzeByQueryHandle(mockConfig, {
        queryHandle: handle,
        analysisType: ['risks']
      });

      expect(result.success).toBe(true);
      expect(result.data.results.risks).toBeDefined();
      expect(result.data.results.risks.total_items).toBe(2);
      expect(result.data.results.risks.risk_level).toBeDefined();
      expect(result.data.results.risks.identified_risks).toBeInstanceOf(Array);
      expect(result.data.results.risks.risk_details.blocked_count).toBe(1); // One item has 'Blocked' tag
    });

    it('should handle multiple analysis types', async () => {
      const workItemIds = [12345, 67890];
      const query = 'SELECT [System.Id] FROM WorkItems';
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleAnalyzeByQueryHandle(mockConfig, {
        queryHandle: handle,
        analysisType: ['effort', 'velocity', 'assignments', 'risks', 'completion', 'priorities']
      });

      expect(result.success).toBe(true);
      expect(result.data.results.effort).toBeDefined();
      expect(result.data.results.velocity).toBeDefined();
      expect(result.data.results.assignments).toBeDefined();
      expect(result.data.results.risks).toBeDefined();
      expect(result.data.results.completion).toBeDefined();
      expect(result.data.results.priorities).toBeDefined();
    });
  });

  describe('wit-list-query-handles', () => {
    const mockConfig = {
      name: 'wit-list-query-handles',
      description: 'Test',
      script: '',
      schema: listQueryHandlesSchema,
      inputSchema: {}
    };

    it('should list query handle statistics', async () => {
      // Create some handles
      queryHandleService.storeQuery([1, 2, 3], 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"');
      queryHandleService.storeQuery([4, 5, 6], 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "New"');

      const result = await handleListQueryHandles(mockConfig, {});

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.total_handles).toBe(2);
      expect(result.data.active_handles).toBe(2);
      expect(result.data.expired_handles).toBe(0);
      expect(result.data.guidance).toBeDefined();
      expect(result.data.guidance.handle_lifetime).toBe('1 hour (default)');
    });

    it('should provide warnings when no handles exist', async () => {
      const result = await handleListQueryHandles(mockConfig, {});

      expect(result.success).toBe(true);
      expect(result.data.total_handles).toBe(0);
      expect(result.warnings).toContain('No query handles found. Use wit-get-work-items-by-query-wiql with returnQueryHandle=true to create handles.');
    });

    it('should warn about high number of handles', async () => {
      // Create many handles
      for (let i = 0; i < 12; i++) {
        queryHandleService.storeQuery([i], `SELECT [System.Id] FROM WorkItems WHERE [System.Id] = ${i}`);
      }

      const result = await handleListQueryHandles(mockConfig, {});

      expect(result.success).toBe(true);
      expect(result.data.active_handles).toBe(12);
      expect(result.warnings).toContain('High number of active handles (12). Consider cleaning up unused handles.');
    });

    it('should handle expired handles', async () => {
      // Create expired handle
      queryHandleService.storeQuery([1, 2], 'SELECT [System.Id] FROM WorkItems', undefined, 1); // 1ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await handleListQueryHandles(mockConfig, {});

      expect(result.success).toBe(true);
      // The exact counts depend on cleanup timing, but we should get stats
      expect(result.data).toBeDefined();
      expect(result.data.guidance).toBeDefined();
    });
  });
});