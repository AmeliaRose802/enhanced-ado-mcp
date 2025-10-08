/**
 * Generate OData Query Handler Tests - Query Handle Feature
 * 
 * Tests for the query handle functionality in the OData query generator
 */

import { handleGenerateODataQuery } from '../services/handlers/query/generate-odata-query.handler.js';
import { generateODataQuerySchema } from '../config/schemas.js';
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

// Mock Azure DevOps token
jest.mock('../utils/ado-token.js', () => ({
  getAzureDevOpsToken: jest.fn(() => 'mock-token')
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock sampling client
const mockSamplingClient = {
  hasSamplingSupport: jest.fn(() => true),
  createMessage: jest.fn(),
  extractResponseText: jest.fn()
};

jest.mock('../utils/sampling-client.js', () => ({
  SamplingClient: jest.fn(() => mockSamplingClient)
}));

describe('Generate OData Query Handler - returnQueryHandle parameter', () => {
  const mockConfig = {
    name: 'wit-ai-generate-odata',
    description: 'Test',
    script: '',
    schema: generateODataQuerySchema,
    inputSchema: { type: 'object' as const }
  };

  const mockServerInstance = {
    requestSampling: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when returnQueryHandle is false (opt-out)', () => {
    it('should return only the generated query without creating a handle', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: '$filter=State eq \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'Active\'');

      // Mock query validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 123, Title: 'Test' }],
          '@odata.count': 1
        })
      });

      const result = await handleGenerateODataQuery(
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

  describe('when returnQueryHandle is true (default)', () => {
    it('should create a query handle by default when returnQueryHandle is not specified', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: '$filter=State eq \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'Active\'');

      // Mock query validation (first call)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 789, Title: 'Default Test' }],
          '@odata.count': 1
        })
      });

      // Mock query execution for handle creation (second call)
      const mockWorkItems = [
        {
          WorkItemId: 789,
          Title: 'Test Item (Default)',
          State: 'Active',
          WorkItemType: 'Task',
          CreatedDate: '2025-01-01',
          ChangedDate: '2025-01-02',
          AreaPath: 'Test\\Area',
          IterationPath: 'Sprint 1',
          Tags: 'test'
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: mockWorkItems,
          '@odata.count': 1
        })
      });

      const result = await handleGenerateODataQuery(
        mockConfig,
        {
          description: 'Find all active work items',
          organization: 'test-org',
          project: 'test-project'
          // returnQueryHandle not specified - should default to true
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect((result.data as any).query_handle).toBeDefined();
      expect((result.data as any).query_handle).toMatch(/^qh_/);
      expect((result.data as any).work_items).toBeDefined();
      expect((result.data as any).work_items).toHaveLength(1);
      expect((result.data as any).work_item_count).toBe(1);
      expect((result.metadata as any).queryHandleMode).toBe(true);
    });

    it('should create a query handle and return work items', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: '$filter=State eq \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'Active\'');

      // Mock query validation (first call)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 123, Title: 'Validation Test' }],
          '@odata.count': 1
        })
      });

      // Mock query execution for handle creation (second call)
      const mockWorkItems = [
        {
          WorkItemId: 123,
          Title: 'Test Item 1',
          State: 'Active',
          WorkItemType: 'Task',
          CreatedDate: '2025-01-01',
          ChangedDate: '2025-01-02',
          AreaPath: 'Test\\Area',
          IterationPath: 'Sprint 1',
          Tags: 'test;mock'
        },
        {
          WorkItemId: 456,
          Title: 'Test Item 2',
          State: 'Active',
          WorkItemType: 'Bug',
          CreatedDate: '2025-01-03',
          ChangedDate: '2025-01-04',
          AreaPath: 'Test\\Area',
          IterationPath: 'Sprint 1',
          Tags: 'test'
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: mockWorkItems,
          '@odata.count': 2
        })
      });

      const result = await handleGenerateODataQuery(
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
        content: [{ type: 'text', text: '$filter=State eq \'NonExistent\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'NonExistent\'');

      // Mock query validation (first call - returns something to pass validation)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 999 }],
          '@odata.count': 1
        })
      });

      // Mock query execution for handle creation (second call - returns no results)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          '@odata.count': 0
        })
      });

      const result = await handleGenerateODataQuery(
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
        content: [{ type: 'text', text: '$filter=State eq \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'Active\'');

      // Mock query validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 123 }],
          '@odata.count': 1
        })
      });

      // Mock query execution for handle creation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              WorkItemId: 123,
              Title: 'Test',
              State: 'Active',
              WorkItemType: 'Task',
              Priority: 1,
              Severity: 'High'
            }
          ]
        })
      });

      const result = await handleGenerateODataQuery(
        mockConfig,
        {
          description: 'Find active items',
          organization: 'test-org',
          project: 'test-project',
          returnQueryHandle: true,
          includeFields: ['WorkItemId', 'Title', 'State', 'Priority', 'Severity']
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect((result.data as any).work_items[0]).toHaveProperty('Priority');
      expect((result.data as any).work_items[0]).toHaveProperty('Severity');
    });

    it('should handle API errors gracefully and fallback to query-only response', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: '$filter=State eq \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'Active\'');

      // Mock query validation (first call - succeeds)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 123 }],
          '@odata.count': 1
        })
      });

      // Mock query execution for handle creation (second call - fails)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      const result = await handleGenerateODataQuery(
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
      expect(result.warnings.some(w => w.includes('Failed to create query handle'))).toBe(true);
    });
  });

  describe('maxResults parameter', () => {
    it('should respect maxResults when fetching work items', async () => {
      // Mock AI response
      mockSamplingClient.createMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: '$filter=State eq \'Active\'' }],
        usage: { inputTokens: 100, outputTokens: 50 }
      });
      mockSamplingClient.extractResponseText.mockReturnValueOnce('$filter=State eq \'Active\'');

      // Mock query validation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ WorkItemId: 123 }],
          '@odata.count': 1
        })
      });

      let capturedUrl = '';
      (global.fetch as jest.Mock).mockImplementationOnce((url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            value: [{ WorkItemId: 123, Title: 'Test', State: 'Active', WorkItemType: 'Task' }]
          })
        });
      });

      await handleGenerateODataQuery(
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

      expect(capturedUrl).toContain('$top=50');
    });
  });
});
