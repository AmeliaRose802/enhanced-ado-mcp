/**
 * Comprehensive unit tests for OData Query Handler
 * 
 * Coverage areas:
 * - Query parsing and validation
 * - Filter construction (including area path filtering)
 * - Query handle lifecycle
 * - AI-powered query generation
 * - Error handling and edge cases
 * - Analytics API vs Query Handle modes
 * 
 * Target: 60-70% coverage (comparable to WIQL handler at 68.75%)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ToolConfig, ToolExecutionResult, ODataResponse } from '../../../src/types/index.js';
import { odataQuerySchema } from '../../../src/config/schemas.js';
import { handleODataQuery } from '../../../src/services/handlers/query/odata-query.handler.js';

// Mock dependencies
const mockValidateAzureCLI = jest.fn() as jest.Mock;
const mockGetRequiredConfig = jest.fn() as jest.Mock;
const mockGetTokenProvider = jest.fn() as jest.Mock;
const mockCreateAuthenticator = jest.fn() as jest.Mock;
const mockEscapeAreaPathForOData = jest.fn() as jest.Mock;
const mockCacheService = {
  get: jest.fn() as jest.Mock,
  set: jest.fn() as jest.Mock
};
const mockQueryHandleService = {
  storeQuery: jest.fn() as jest.Mock,
  getDefaultTTL: jest.fn().mockReturnValue(86400000) as jest.Mock // 24 hours
};
const mockSamplingClient = {
  hasSamplingSupport: jest.fn() as jest.Mock,
  createMessage: jest.fn() as jest.Mock,
  extractResponseText: jest.fn() as jest.Mock
};
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockBuildValidationErrorResponse = jest.fn() as jest.Mock;
const mockBuildAzureCliErrorResponse = jest.fn() as jest.Mock;
const mockBuildSamplingUnavailableResponse = jest.fn() as jest.Mock;

// Mock global fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

jest.mock('../../../src/utils/azure-cli-validator.js', () => ({
  validateAzureCLI: mockValidateAzureCLI
}));

jest.mock('../../../src/config/config.js', () => ({
  getRequiredConfig: mockGetRequiredConfig
}));

jest.mock('../../../src/utils/response-builder.js', () => ({
  buildValidationErrorResponse: mockBuildValidationErrorResponse,
  buildAzureCliErrorResponse: mockBuildAzureCliErrorResponse,
  buildSamplingUnavailableResponse: mockBuildSamplingUnavailableResponse
}));

jest.mock('../../../src/utils/token-provider.js', () => ({
  getTokenProvider: mockGetTokenProvider
}));

jest.mock('../../../src/utils/ado-token.js', () => ({
  createAuthenticator: mockCreateAuthenticator
}));

jest.mock('../../../src/utils/work-item-parser.js', () => ({
  escapeAreaPath: jest.fn((path: string) => path.replace(/'/g, "''")),
  escapeAreaPathForOData: mockEscapeAreaPathForOData
}));

jest.mock('../../../src/services/cache-service.js', () => ({
  cacheService: mockCacheService
}));

jest.mock('../../../src/services/query-handle-service.js', () => ({
  queryHandleService: mockQueryHandleService
}));

jest.mock('../../../src/utils/sampling-client.js', () => ({
  SamplingClient: jest.fn().mockImplementation(() => mockSamplingClient)
}));

describe('OData Query Handler', () => {
  // Helper to create test config
  const createTestConfig = (): ToolConfig => ({
    name: 'query-odata',
    description: 'Test OData query',
    script: 'test-script',
    schema: odataQuerySchema,
    inputSchema: {} as any // Mock JSON schema for tests
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful Azure CLI validation
    mockValidateAzureCLI.mockReturnValue({
      isAvailable: true,
      isLoggedIn: true
    });
    
    // Default config
    mockGetRequiredConfig.mockReturnValue({
      organization: 'test-org',
      project: 'test-project',
      defaultAreaPath: 'TestProject\\TestTeam',
      defaultIterationPath: 'TestProject\\Sprint 1'
    });
    
    // Default token provider
    const mockTokenFn = (jest.fn() as jest.Mock).mockResolvedValue('mock-token');
    mockCreateAuthenticator.mockReturnValue(mockTokenFn);
    
    // Default area path escaping
    mockEscapeAreaPathForOData.mockImplementation((path: string) => {
      if (!path) return '';
      return path.replace(/\\/g, '\\\\').replace(/'/g, "''");
    });
    
    // Default cache miss
    mockCacheService.get.mockReturnValue(null);
    
    // Mock response builders with sensible defaults
    mockBuildValidationErrorResponse.mockReturnValue({
      success: false,
      data: null,
      metadata: { source: 'odata-query' },
      errors: ['Validation error'],
      warnings: []
    });
    
    mockBuildAzureCliErrorResponse.mockReturnValue({
      success: false,
      data: null,
      metadata: { source: 'odata-query' },
      errors: ['Azure CLI error'],
      warnings: []
    });
    
    mockBuildSamplingUnavailableResponse.mockReturnValue({
      success: false,
      data: null,
      metadata: { source: 'odata-query' },
      errors: ['Sampling unavailable'],
      warnings: []
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Azure CLI Validation Tests
  // =========================================================================

  describe('Azure CLI Validation', () => {
    it('should fail when Azure CLI is not available', async () => {
      mockValidateAzureCLI.mockReturnValue({
        isAvailable: false,
        isLoggedIn: false
      });

      const config = createTestConfig();

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail when not logged into Azure CLI', async () => {
      mockValidateAzureCLI.mockReturnValue({
        isAvailable: true,
        isLoggedIn: false
      });

      const config = createTestConfig();

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Input Validation Tests
  // =========================================================================

  describe('Input Validation', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
  describe('Input Validation', () => {
    const config = createTestConfig();

    it('should reject invalid input schema', async () => {
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should require description, queryType, or customODataQuery', async () => {
      const result = await handleODataQuery(config, {
        organization: 'test-org',
        project: 'test-project'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Must provide either 'description'");
    });

    it('should validate organization and project are provided', async () => {
      mockGetRequiredConfig.mockReturnValue({
        organization: '',
        project: ''
      });

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Missing required parameters');
    });
  });

  // =========================================================================
  // Area Path Filtering Tests (Critical - Recently Fixed)
  // =========================================================================

  describe('Area Path Filtering', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
  describe('Area Path Filtering', () => {
    const config = createTestConfig();

    it('should properly escape area paths with backslashes', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        areaPath: 'Project\\Team\\Area'
      });

      expect(mockEscapeAreaPathForOData).toHaveBeenCalledWith('Project\\Team\\Area');
      expect(global.fetch).toHaveBeenCalled();
      
      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      // Should contain properly escaped area path
      expect(url).toContain('Project\\\\Team\\\\Area');
    });

    it('should properly escape area paths with single quotes', async () => {
      mockEscapeAreaPathForOData.mockReturnValue("Project\\\\Team''s Area");

      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 10 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        areaPath: "Project\\Team's Area"
      });

      expect(mockEscapeAreaPathForOData).toHaveBeenCalledWith("Project\\Team's Area");
      
      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain("Project\\\\Team''s Area");
    });

    it('should use default area path when not provided', async () => {
      mockGetRequiredConfig.mockReturnValue({
        organization: 'test-org',
        project: 'test-project',
        defaultAreaPath: 'DefaultProject\\DefaultTeam'
      });

      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 5 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(mockEscapeAreaPathForOData).toHaveBeenCalledWith('DefaultProject\\DefaultTeam');
    });

    it('should handle deeply nested area paths', async () => {
      const deepPath = 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway';
      mockEscapeAreaPathForOData.mockReturnValue('One\\\\Azure Compute\\\\OneFleet Node\\\\Azure Host Agent\\\\Azure Host Gateway');

      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 15 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        areaPath: deepPath
      });

      expect(mockEscapeAreaPathForOData).toHaveBeenCalledWith(deepPath);
      
      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('One\\\\Azure Compute\\\\OneFleet Node');
    });
  });

  // =========================================================================
  // Query Type Tests
  // =========================================================================

  describe('Query Type Execution', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
      handler: handleODataQuery
    };

    it('should execute workItemCount query', async () => {
      const mockResponse: ODataResponse = {
  describe('Query Type Execution', () => {
    const config = createTestConfig();

    it('should execute workItemCount query', async () => {
      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).count).toBe(1);
      expect((result.data as any).results[0].Count).toBe(42);
    });

    it('should execute groupByState query', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [
          { State: 'Active', Count: 10 },
          { State: 'Closed', Count: 5 }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'groupByState'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).count).toBe(2);
      expect((result.data as any).results).toHaveLength(2);
    });

    it('should execute groupByType query', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [
          { WorkItemType: 'Bug', Count: 15 },
          { WorkItemType: 'Task', Count: 20 }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'groupByType'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).results).toHaveLength(2);
      expect((result.data as any).results[0].WorkItemType).toBe('Bug');
    });

    it('should execute groupByAssignee query', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [
          { AssignedTo: { UserName: 'john@example.com' }, Count: 8 },
          { AssignedTo: { UserName: 'jane@example.com' }, Count: 12 }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'groupByAssignee'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).results).toHaveLength(2);
    });

    it('should execute velocityMetrics query', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [
          { WorkItemId: 1, State: 'Closed', CompletedDate: '2024-01-15T10:00:00Z' },
          { WorkItemId: 2, State: 'Done', CompletedDate: '2024-01-16T14:30:00Z' }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'velocityMetrics'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).results).toHaveLength(2);
    });

    it('should execute customODataQuery', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ WorkItemId: 123, Title: 'Test Item' }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        customODataQuery: "$filter=State eq 'Active'&$select=WorkItemId,Title"
      });

      expect(result.success).toBe(true);
      expect((result.data as any).results).toHaveLength(1);
      expect((result.data as any).results[0].WorkItemId).toBe(123);
    });
  });

  // =========================================================================
  // Filter Construction Tests
  // =========================================================================

  describe('Filter Construction', () => {
    const config = createTestConfig();

    it('should apply date range filters', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 5 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        dateRangeField: 'CreatedDate',
        dateRangeStart: '2024-01-01',
        dateRangeEnd: '2024-01-31'
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('CreatedDate ge 2024-01-01T00:00:00Z');
      expect(url).toContain('CreatedDate le 2024-01-31T23:59:59Z');
    });

    it('should apply custom filters', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 3 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        filters: {
          State: 'Active',
          Priority: 1
        }
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain("State eq 'Active'");
      expect(url).toContain('Priority eq 1');
    });

    it('should apply iteration path filter', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 8 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        iterationPath: 'Project\\Sprint 5'
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain("Iteration/IterationPath eq 'Project\\Sprint 5'");
    });
  });

  // =========================================================================
  // Query Handle Tests
  // =========================================================================

  describe('Query Handle Lifecycle', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
  describe('Query Handle Lifecycle', () => {
    const config = createTestConfig();

    it('should create query handle for non-aggregation queries', async () => {
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      mockQueryHandleService.storeQuery.mockReturnValue('qh_odata_abc123');

      const result = await handleODataQuery(config, {
        customODataQuery: "$filter=State eq 'Active'",
        returnQueryHandle: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).query_handle).toBe('qh_odata_abc123');
      expect((result.data as any).work_item_count).toBe(2);
      expect(mockQueryHandleService.storeQuery).toHaveBeenCalledWith(
        [101, 102],
        expect.any(String),
        expect.objectContaining({ queryType: 'odata' }),
        expect.any(Number),
        expect.any(Map)
      );
    });

    it('should not create query handle for aggregation queries', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ State: 'Active', Count: 10 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'groupByState',
        returnQueryHandle: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).query_handle).toBeUndefined();
      expect(mockQueryHandleService.storeQuery).not.toHaveBeenCalled();
    });

    it('should handle empty query results gracefully', async () => {
      const mockResponse = {
        value: []
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        customODataQuery: "$filter=State eq 'NonExistent'",
        returnQueryHandle: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).resultCount).toBe(0);
      expect((result.data as any).query_handle).toBeUndefined();
      expect(result.warnings).toContain('⚠️ Query returned 0 results - you may need to adjust the criteria');
    });

    it('should include work item context in query handle', async () => {
      const mockResponse = {
        value: [
          {
            WorkItemId: 201,
            Title: 'Test Item',
            State: 'Active',
            WorkItemType: 'Task',
            AreaPath: 'Project\\Team',
            IterationPath: 'Project\\Sprint 1',
            Tags: 'frontend; api'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      mockQueryHandleService.storeQuery.mockReturnValue('qh_with_context');

      await handleODataQuery(config, {
        customODataQuery: "$filter=State eq 'Active'",
        returnQueryHandle: true
      });

      expect(mockQueryHandleService.storeQuery).toHaveBeenCalled();
      
      const storeCall = mockQueryHandleService.storeQuery.mock.calls[0];
      const contextMap = storeCall[4] as Map<number, any>;
      
      expect(contextMap).toBeInstanceOf(Map);
      expect(contextMap.has(201)).toBe(true);
      expect(contextMap.get(201).title).toBe('Test Item');
      expect(contextMap.get(201).state).toBe('Active');
    });
  });

  // =========================================================================
  // Pagination Tests
  // =========================================================================

  describe('Pagination', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
  describe('Pagination', () => {
    const config = createTestConfig();

    it('should handle pagination parameters', async () => {

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'velocityMetrics',
        top: 50,
        skip: 0
      });

      expect(result.success).toBe(true);
      expect((result.data as any).pagination).toBeDefined();
      expect((result.data as any).pagination.hasMore).toBe(true);
      expect((result.data as any).pagination.nextSkip).toBe(50);
    });

    it('should include pagination warning when more results available', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: Array.from({ length: 100 }, (_, i) => ({ WorkItemId: i })),
        '@odata.nextLink': 'next-url'
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'velocityMetrics',
        top: 100
      });

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('More results available');
    });

    it('should not include pagination for single-page results', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 5 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).pagination).toBeUndefined();
    });
  });

  // =========================================================================
  // Cache Tests
  // =========================================================================

  describe('Cache Behavior', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
      handler: handleODataQuery
    };

    it('should use cached results when available', async () => {
      const cachedData: ODataResponse = {
  describe('Cache Behavior', () => {
    const config = createTestConfig();

    it('should use cached results when available', async () => {

      expect(result.success).toBe(true);
      expect((result.data as any).results[0].Count).toBe(42);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Cache hit'));
    });

    it('should cache results after fetch', async () => {
      mockCacheService.get.mockReturnValue(null);

      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 10 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        mockResponse,
        5 * 60 * 1000 // 5 minutes
      );
    });
  });

  // =========================================================================
  // Error Handling Tests
  // =========================================================================

  describe('Error Handling', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
      handler: handleODataQuery
    };

    it('should handle 401 unauthorized errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'TF400813: Resource not available for anonymous access'
      } as Response);
  describe('Error Handling', () => {
    const config = createTestConfig();

    it('should handle 401 unauthorized errors', async () => {

    it('should handle 403 forbidden errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied'
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Analytics API authorization error');
    });

    it('should handle 404 not found errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Project not found'
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Analytics API error');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON');
    });
  });

  // =========================================================================
  // AI-Powered Query Generation Tests
  // =========================================================================

  describe('AI-Powered Query Generation', () => {
    const config = createTestConfig();

    const mockServerInstance = {
      name: 'test-server',
      version: '1.0.0'
    } as any;

    it('should fail AI generation without server instance', async () => {
      const result = await handleODataQuery(config, {
        description: 'Find all active bugs'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('AI generation requires sampling support');
    });

    it('should fail AI generation when sampling not available', async () => {
      mockSamplingClient.hasSamplingSupport.mockReturnValue(false);

      const result = await handleODataQuery(config, {
        description: 'Find all active bugs'
      }, mockServerInstance);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Sampling unavailable');
    });

    it('should generate and execute AI-powered query', async () => {
      mockSamplingClient.hasSamplingSupport.mockReturnValue(true);
      mockSamplingClient.createMessage.mockResolvedValue({
        role: 'assistant',
        content: { type: 'text', text: "$filter=State eq 'Active' and WorkItemType eq 'Bug'" },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }
      });
      mockSamplingClient.extractResponseText.mockReturnValue(
        "$filter=State eq 'Active' and WorkItemType eq 'Bug'"
      );

      const mockResponse = {
        value: [
          { WorkItemId: 301, Title: 'Bug 1', State: 'Active', WorkItemType: 'Bug' }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        description: 'Find all active bugs',
        testQuery: true
      }, mockServerInstance);

      expect(result.success).toBe(true);
      expect(mockSamplingClient.createMessage).toHaveBeenCalled();
      expect(result.metadata?.aiGenerated).toBe(true);
    });

    it('should handle AI generation failures gracefully', async () => {
      mockSamplingClient.hasSamplingSupport.mockReturnValue(true);
      mockSamplingClient.createMessage.mockResolvedValue({
        role: 'assistant',
        content: { type: 'text', text: 'Invalid query syntax' }
      });
      mockSamplingClient.extractResponseText.mockReturnValue('Invalid query syntax');

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid OData syntax'
      } as Response);

      const result = await handleODataQuery(config, {
        description: 'Invalid query request',
        testQuery: true,
        maxIterations: 1
      }, mockServerInstance);

      expect(result.success).toBe(false);
      expect(result.data).toBeDefined();
      expect((result.data as any).isValidated).toBe(false);
    });

    it('should retry failed AI generations', async () => {
      mockSamplingClient.hasSamplingSupport.mockReturnValue(true);
      
      // First attempt fails
      mockSamplingClient.createMessage
        .mockResolvedValueOnce({
          role: 'assistant',
          content: { type: 'text', text: 'bad query' }
        })
        .mockResolvedValueOnce({
          role: 'assistant',
          content: { type: 'text', text: "$filter=State eq 'Active'" }
        });

      mockSamplingClient.extractResponseText
        .mockReturnValueOnce('bad query')
        .mockReturnValueOnce("$filter=State eq 'Active'");

      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Syntax error'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [] })
        } as Response);

      const result = await handleODataQuery(config, {
        description: 'Find active items',
        testQuery: true,
        maxIterations: 2
      }, mockServerInstance);

      expect(mockSamplingClient.createMessage).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Metadata Options Tests
  // =========================================================================

  describe('Metadata Options', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
  describe('Metadata Options', () => {
    const config = createTestConfig();

    it('should include OData metadata when requested', async () => {

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount',
        includeOdataMetadata: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any)['@odata.context']).toBeDefined();
      expect((result.data as any)['@odata.count']).toBe(42);
    });

    it('should strip OData metadata by default', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ '@odata.id': '123', Count: 10 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(true);
      expect((result.data as any)['@odata.context']).toBeUndefined();
      expect((result.data as any).results[0]['@odata.id']).toBeUndefined();
    });

    it('should include query metadata when requested', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 5 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount',
        includeMetadata: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).query).toBeDefined();
      expect((result.data as any).analyticsUrl).toBeDefined();
      expect((result.data as any).analyticsUrl).toContain('analytics.dev.azure.com');
    });
  });

  // =========================================================================
  // Edge Cases and Special Scenarios
  // =========================================================================

  describe('Edge Cases', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
  describe('Edge Cases', () => {
    const config = createTestConfig();

    it('should handle empty result sets', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'workItemCount'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).count).toBe(0);
      expect((result.data as any).results).toHaveLength(0);
    });

    it('should handle null values in results', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [
          { WorkItemId: 1, Title: 'Test', AssignedTo: null, Tags: null }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'velocityMetrics'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).results[0].AssignedTo).toBeNull();
    });

    it('should handle very large result sets', async () => {
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        WorkItemId: i + 1,
        Title: `Item ${i + 1}`
      }));

      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: largeResults
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'velocityMetrics',
        top: 1000
      });

      expect(result.success).toBe(true);
      expect((result.data as any).results).toHaveLength(1000);
    });

    it('should handle aggregation query with zero results', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: []
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await handleODataQuery(config, {
        queryType: 'groupByState'
      });

      expect(result.success).toBe(true);
      expect((result.data as any).count).toBe(0);
    });

    it('should handle special characters in filter values', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Count: 1 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'workItemCount',
        filters: {
          Title: "Test's Item & More"
        }
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      // Should properly encode special characters
      expect(url).toContain('filter');
    });

    it('should handle undefined fields in work item context', async () => {
      const mockResponse = {
        value: [
          {
            WorkItemId: 401,
            Title: 'Item',
            // Missing State, AreaPath, etc.
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      mockQueryHandleService.storeQuery.mockReturnValue('qh_partial');

      const result = await handleODataQuery(config, {
        customODataQuery: "$filter=WorkItemId eq 401",
        returnQueryHandle: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).query_handle).toBe('qh_partial');
    });
  });

  // =========================================================================
  // Query Building Tests
  // =========================================================================

  describe('Query Building', () => {
    const config: ToolConfig = {
      name: 'query-odata',
      description: 'Test',
      schema: odataQuerySchema,
      handler: handleODataQuery
    };

    it('should build query with multiple filters', async () => {
      const mockResponse: ODataResponse = {
  describe('Query Building', () => {
    const config = createTestConfig();

    it('should build query with multiple filters', async () => {
      await handleODataQuery(config, {
        queryType: 'workItemCount',
        filters: {
          State: 'Active',
          WorkItemType: 'Bug',
          Priority: 1
        },
        areaPath: 'Project\\Team',
        dateRangeField: 'CreatedDate',
        dateRangeStart: '2024-01-01'
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain("State eq 'Active'");
      expect(url).toContain("WorkItemType eq 'Bug'");
      expect(url).toContain('Priority eq 1');
      expect(url).toContain('CreatedDate ge 2024-01-01T00:00:00Z');
    });

    it('should apply custom groupBy and orderBy', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ Priority: 1, Count: 5 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'customQuery',
        groupBy: ['Priority'],
        orderBy: 'Priority asc'
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('groupby((Priority)');
      expect(url).toContain('$orderby=Priority asc');
    });

    it('should apply select fields', async () => {
      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ WorkItemId: 1, Title: 'Test' }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(config, {
        queryType: 'customQuery',
        select: ['WorkItemId', 'Title', 'State']
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('$select=WorkItemId,Title,State');
    });

    it('should URL encode organization and project names with special characters', async () => {
      // Test case for ADO-Work-Item-MSP-48: Fix sprint planning 404 error for project lookup
      const configWithSpaces = {
        ...config,
        azureDevOps: {
          ...config.azureDevOps,
          organization: 'My Org',
          project: 'Project One'
        }
      };

      const mockResponse: ODataResponse = {
        '@odata.context': 'test',
        value: [{ WorkItemId: 1 }]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await handleODataQuery(configWithSpaces, {
        queryType: 'velocityMetrics',
        dateRangeStart: '2024-01-01'
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      // Verify URL encoding (spaces become %20)
      expect(url).toContain('My%20Org');
      expect(url).toContain('Project%20One');
      // Should NOT contain unencoded spaces
      expect(url).not.toContain('My Org');
      expect(url).not.toContain('Project One');
    });
  });
});
