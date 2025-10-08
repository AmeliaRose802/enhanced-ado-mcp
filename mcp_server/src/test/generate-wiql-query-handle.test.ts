/**
 * Generate WIQL Query Handler Tests - Query Handle Feature
 * 
 * Tests for the query handle functionality in the WIQL query generator
 */

import { handleGenerateWiqlQuery } from '../services/handlers/query/generate-wiql-query.handler.js';
import { generateWiqlQuerySchema } from '../config/schemas.js';
import { queryHandleService } from '../services/query-handle-service.js';

// Mock configuration
jest.mock('../config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project',
      areaPath: 'Test\\Area',
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

// Mock sampling client
const mockSamplingClient = {
  hasSamplingSupport: jest.fn(() => true),
  createMessage: jest.fn(),
  extractResponseText: jest.fn()
};

jest.mock('../utils/sampling-client.js', () => ({
  SamplingClient: jest.fn(() => mockSamplingClient)
}));

// Mock queryWorkItemsByWiql
jest.mock('../services/ado-work-item-service.js', () => ({
  queryWorkItemsByWiql: jest.fn()
}));

import { queryWorkItemsByWiql } from '../services/ado-work-item-service.js';
const mockQueryWorkItemsByWiql = queryWorkItemsByWiql as jest.MockedFunction<typeof queryWorkItemsByWiql>;

describe('Generate WIQL Query Handler - returnQueryHandle parameter', () => {
  const mockConfig = {
    name: 'wit-ai-generate-wiql',
    description: 'Test',
    script: '',
    schema: generateWiqlQuerySchema,
    inputSchema: {}
  };

  const mockServerInstance = {
    requestSampling: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when returnQueryHandle is false (default)', () => {
    it('should return only the generated query without creating a handle', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = \'Active\'');

      // Mock query validation
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [{ id: 123, title: 'Test', type: 'Task', state: 'Active', url: 'http://test.com/123' }],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 10,
        hasMore: false
      });

      const result = await handleGenerateWiqlQuery(
        mockConfig,
        {
          description: 'Find all active work items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: false
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.data.query).toBeDefined();
      expect(result.data.query_handle).toBeUndefined();
      expect(result.data.work_items).toBeUndefined();
    });
  });

  describe('when returnQueryHandle is true', () => {
    it('should create a query handle and return work items', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'');

      // Mock query validation (first call)
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [{ id: 123, title: 'Validation Test', type: 'Task', state: 'Active', url: 'http://test.com/123' }],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 10,
        hasMore: false
      });

      // Mock query execution for handle creation (second call)
      const mockWorkItems = [
        {
          id: 123,
          title: 'Test Item 1',
          state: 'Active',
          type: 'Task',
          url: 'http://test.com/123',
          createdDate: '2025-01-01',
          changedDate: '2025-01-02',
          areaPath: 'Test\\Area',
          iterationPath: 'Sprint 1',
          assignedTo: 'user@test.com',
          additionalFields: {
            'System.Tags': 'test;mock'
          }
        },
        {
          id: 456,
          title: 'Test Item 2',
          state: 'Active',
          type: 'Bug',
          url: 'http://test.com/456',
          createdDate: '2025-01-03',
          changedDate: '2025-01-04',
          areaPath: 'Test\\Area',
          iterationPath: 'Sprint 1',
          assignedTo: 'user2@test.com',
          additionalFields: {
            'System.Tags': 'test'
          }
        }
      ];

      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: mockWorkItems,
        totalCount: 2,
        count: 2,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 200,
        hasMore: false
      });

      const result = await handleGenerateWiqlQuery(
        mockConfig,
        {
          description: 'Find all active work items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true,
          maxResults: 200
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.data.query_handle).toBeDefined();
      expect(result.data.query_handle).toMatch(/^qh_/);
      expect(result.data.work_items).toBeDefined();
      expect(result.data.work_items).toHaveLength(2);
      expect(result.data.work_item_count).toBe(2);
      expect(result.data.next_steps).toBeDefined();
      expect(result.data.expires_at).toBeDefined();
      expect(result.metadata.queryHandleMode).toBe(true);
      expect(result.metadata.handle).toBe(result.data.query_handle);

      // Verify the handle can be retrieved
      const handle = result.data.query_handle;
      const storedData = queryHandleService.getQueryData(handle);
      expect(storedData).toBeDefined();
      expect(storedData?.workItemIds).toEqual([123, 456]);
    });

    it('should handle query with no results gracefully', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'NonExistent\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'NonExistent\'');

      // Mock query validation (first call - returns something to pass validation)
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [{ id: 999, title: 'Test', type: 'Task', state: 'Active', url: 'http://test.com/999' }],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 10,
        hasMore: false
      });

      // Mock query execution for handle creation (second call - returns no results)
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [],
        totalCount: 0,
        count: 0,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 200,
        hasMore: false
      });

      const result = await handleGenerateWiqlQuery(
        mockConfig,
        {
          description: 'Find non-existent items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.data.query).toBeDefined();
      expect(result.data.query_handle).toBeUndefined();
      expect(result.data.resultCount).toBe(0);
      expect(result.warnings).toContain('⚠️ Query is valid but returned 0 results - you may need to adjust the criteria');
    });

    it('should include custom fields when specified', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'');

      // Mock query validation
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [{ id: 123, title: 'Test', type: 'Task', state: 'Active', url: 'http://test.com/123' }],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 10,
        hasMore: false
      });

      // Mock query execution for handle creation
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [
          {
            id: 123,
            title: 'Test',
            state: 'Active',
            type: 'Task',
            url: 'http://test.com/123',
            createdDate: '2025-01-01',
            changedDate: '2025-01-02',
            areaPath: 'Test\\Area',
            iterationPath: 'Sprint 1',
            assignedTo: 'user@test.com',
            additionalFields: {
              'System.Priority': 1,
              'Microsoft.VSTS.Common.Severity': 'High'
            }
          }
        ],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 200,
        hasMore: false
      });

      const result = await handleGenerateWiqlQuery(
        mockConfig,
        {
          description: 'Find active items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true,
          includeFields: ['System.Id', 'System.Title', 'System.State', 'System.Priority', 'Microsoft.VSTS.Common.Severity']
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.data.work_items[0]).toHaveProperty('additionalFields');
      expect(result.data.work_items[0].additionalFields['System.Priority']).toBe(1);
      expect(result.data.work_items[0].additionalFields['Microsoft.VSTS.Common.Severity']).toBe('High');

      // Verify includeFields was passed to queryWorkItemsByWiql
      expect(mockQueryWorkItemsByWiql).toHaveBeenLastCalledWith(
        expect.objectContaining({
          includeFields: ['System.Id', 'System.Title', 'System.State', 'System.Priority', 'Microsoft.VSTS.Common.Severity']
        })
      );
    });

    it('should handle API errors gracefully and fallback to query-only response', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'');

      // Mock query validation (first call - succeeds)
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [{ id: 123, title: 'Test', type: 'Task', state: 'Active', url: 'http://test.com/123' }],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 10,
        hasMore: false
      });

      // Mock query execution for handle creation (second call - fails)
      mockQueryWorkItemsByWiql.mockRejectedValueOnce(new Error('Internal Server Error'));

      const result = await handleGenerateWiqlQuery(
        mockConfig,
        {
          description: 'Find active items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.data.query).toBeDefined();
      expect(result.data.query_handle).toBeUndefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Failed to create query handle'))).toBe(true);
    });
  });

  describe('maxResults parameter', () => {
    it('should respect maxResults when fetching work items', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'');

      // Mock query validation
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [{ id: 123, title: 'Test', type: 'Task', state: 'Active', url: 'http://test.com/123' }],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 10,
        hasMore: false
      });

      // Mock query execution for handle creation
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [
          {
            id: 123,
            title: 'Test',
            state: 'Active',
            type: 'Task',
            url: 'http://test.com/123',
            createdDate: '2025-01-01',
            changedDate: '2025-01-02',
            areaPath: 'Test\\Area',
            iterationPath: 'Sprint 1',
            assignedTo: 'user@test.com',
            additionalFields: {}
          }
        ],
        totalCount: 1,
        count: 1,
        query: 'SELECT [System.Id] FROM WorkItems',
        skip: 0,
        top: 50,
        hasMore: false
      });

      await handleGenerateWiqlQuery(
        mockConfig,
        {
          description: 'Find active items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true,
          maxResults: 50
        },
        mockServerInstance
      );

      // Verify maxResults was passed as 'top' to queryWorkItemsByWiql
      expect(mockQueryWorkItemsByWiql).toHaveBeenLastCalledWith(
        expect.objectContaining({
          top: 50
        })
      );
    });
  });
});
