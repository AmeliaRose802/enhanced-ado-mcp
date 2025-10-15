/**
 * Unified WIQL Query Tool Tests - AI Generation Mode
 * 
 * Tests for the AI-powered query generation functionality of the unified wit-wiql-query tool
 */

import { handleWiqlQuery } from '../../src/services/handlers/query/wiql-query.handler.js';
import { wiqlQuerySchema } from '../../src/config/schemas.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';

// Mock configuration
jest.mock('../../src/config/config.js', () => ({
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
  updateConfigFromCLI: jest.fn(),
  getRequiredConfig: jest.fn(() => ({
    organization: 'test-org',
    project: 'test-project',
    defaultWorkItemType: 'Task',
    defaultPriority: 2,
    defaultAreaPath: 'Test\\Area',
    defaultIterationPath: '',
    gitRepository: { defaultBranch: 'main' },
    gitHubCopilot: { guid: '' }
  }))
}));

// Mock Azure CLI validation
jest.mock('../../src/services/ado-discovery-service.js', () => ({
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

jest.mock('../../src/utils/sampling-client.js', () => ({
  SamplingClient: jest.fn(() => mockSamplingClient)
}));

// Mock queryWorkItemsByWiql
jest.mock('../../src/services/ado-work-item-service.js', () => ({
  queryWorkItemsByWiql: jest.fn()
}));

import { queryWorkItemsByWiql } from '../../src/services/ado-work-item-service.js';
const mockQueryWorkItemsByWiql = queryWorkItemsByWiql as jest.MockedFunction<typeof queryWorkItemsByWiql>;

describe('Unified WIQL Query Tool - AI Generation with returnQueryHandle parameter', () => {
  const mockConfig = {
    name: 'wit-wiql-query',
    description: 'Test',
    script: '',
    schema: wiqlQuerySchema,
    inputSchema: { type: 'object' as const }
  };

  const mockServerInstance = {
    requestSampling: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Stop the query handle service cleanup interval to allow Jest to exit
    queryHandleService.stopCleanup();
  });

  describe('Direct WIQL mode (wiqlQuery parameter)', () => {
    it('should execute direct WIQL query without AI generation', async () => {
      // Mock query execution
      mockQueryWorkItemsByWiql.mockResolvedValueOnce({
        workItems: [
          {
            id: 123,
            title: 'Test Item',
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
        query: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'',
        skip: 0,
        top: 200,
        hasMore: false
      });

      const result = await handleWiqlQuery(
        mockConfig,
        {
          wiqlQuery: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect((result.data as any).query_handle).toBeDefined();
      expect((result.data as any).work_items).toBeDefined();
      expect((result.data as any).work_items).toHaveLength(1);
      
      // Verify AI generation was NOT used (sampling client should not be called)
      expect(mockSamplingClient.createMessage).not.toHaveBeenCalled();
      
      // Verify direct query execution
      expect(mockQueryWorkItemsByWiql).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI Generation mode (description parameter) - when returnQueryHandle is false (default)', () => {
    it('should return only the generated query without creating a handle', async () => {
      // NOTE: Using 'description' parameter triggers AI generation mode
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

      const result = await handleWiqlQuery(
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
      expect((result.data as any).query).toBeDefined();
      expect((result.data as any).query_handle).toBeUndefined();
      expect((result.data as any).work_items).toBeUndefined();
    });
  });

  describe('AI Generation mode (description parameter) - when returnQueryHandle is true', () => {
    it('should create a query handle and return work items', async () => {
      // NOTE: Using 'description' parameter triggers AI generation mode
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

      const result = await handleWiqlQuery(
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
      expect((result.data as any).query_handle).toBeDefined();
      expect((result.data as any).query_handle).toMatch(/^qh_/);
      expect((result.data as any).work_items).toBeDefined();
      expect((result.data as any).work_items).toHaveLength(2);
      expect((result.data as any).work_item_count).toBe(2);
      expect((result.data as any).next_steps).toBeDefined();
      expect((result.data as any).expires_at).toBeDefined();
      expect((result.metadata as any).queryHandleMode).toBe(true);
      expect((result.metadata as any).handle).toBe((result.data as any).query_handle);

      // Verify the handle can be retrieved
      const handle = (result.data as any).query_handle;
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

      const result = await handleWiqlQuery(
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
      expect((result.data as any).query).toBeDefined();
      expect((result.data as any).query_handle).toBeUndefined();
      expect((result.data as any).resultCount).toBe(0);
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

      const result = await handleWiqlQuery(
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
      expect((result.data as any).work_items[0]).toHaveProperty('additionalFields');
      expect((result.data as any).work_items[0].additionalFields['System.Priority']).toBe(1);
      expect((result.data as any).work_items[0].additionalFields['Microsoft.VSTS.Common.Severity']).toBe('High');

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

      const result = await handleWiqlQuery(
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
      expect((result.data as any).query).toBeDefined();
      expect((result.data as any).query_handle).toBeUndefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w: string) => w.includes('Failed to create query handle'))).toBe(true);
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

      const result = await handleWiqlQuery(
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

      // Verify the result was successful
      expect(result.success).toBe(true);

      // Verify maxResults was passed as 'top' to queryWorkItemsByWiql
      expect(mockQueryWorkItemsByWiql).toHaveBeenCalledTimes(2);
      expect(mockQueryWorkItemsByWiql).toHaveBeenLastCalledWith(
        expect.objectContaining({
          top: 50
        })
      );
    });
  });
});

