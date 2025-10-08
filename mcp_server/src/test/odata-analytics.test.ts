/**
 * OData Analytics Handler Tests
 * 
 * Tests for the OData analytics handler focusing on the includeOdataMetadata parameter
 * and metadata stripping functionality.
 */

import { handleODataAnalytics } from '../services/handlers/query/odata-analytics.handler.js';
import { odataAnalyticsQuerySchema } from '../config/schemas.js';

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

describe('OData Analytics Handler - includeOdataMetadata parameter', () => {
  const mockConfig = {
    name: 'wit-query-odata',
    description: 'Test',
    script: '',
    schema: odataAnalyticsQuerySchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when includeOdataMetadata is false (default)', () => {
    it('should strip @odata.* fields from results and top-level response', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 2,
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active",
            Count: 5
          },
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(456)",
            WorkItemId: 456,
            State: "Closed",
            Count: 3
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'groupByState',
        organization: 'test-org',
        project: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Check that top-level @odata fields are NOT present
      expect(result.data['@odata.context']).toBeUndefined();
      expect(result.data['@odata.count']).toBeUndefined();
      
      // Check that count field is present (not an @odata field)
      expect(result.data.count).toBe(2);
      
      // Check that @odata fields are stripped from results
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0]['@odata.id']).toBeUndefined();
      expect(result.data.results[0].WorkItemId).toBe(123);
      expect(result.data.results[1]['@odata.id']).toBeUndefined();
      expect(result.data.results[1].WorkItemId).toBe(456);
    });

    it('should strip @odata.nextLink when present', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 100,
        "@odata.nextLink": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems?$skip=50",
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active"
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'workItemCount',
        organization: 'test-org',
        project: 'test-project',
        includeOdataMetadata: false
      });

      expect(result.success).toBe(true);
      expect(result.data['@odata.nextLink']).toBeUndefined();
      expect(result.data['@odata.context']).toBeUndefined();
      expect(result.data['@odata.count']).toBeUndefined();
    });

    it('should filter out null values from results', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 1,
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active",
            AssignedTo: null,
            Tags: null,
            Count: 5
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'groupByState',
        organization: 'test-org',
        project: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data.results[0].AssignedTo).toBeUndefined();
      expect(result.data.results[0].Tags).toBeUndefined();
      expect(result.data.results[0].WorkItemId).toBe(123);
      expect(result.data.results[0].Count).toBe(5);
    });
  });

  describe('when includeOdataMetadata is true', () => {
    it('should include @odata.* fields in response', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 2,
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active",
            Count: 5
          },
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(456)",
            WorkItemId: 456,
            State: "Closed",
            Count: 3
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'groupByState',
        organization: 'test-org',
        project: 'test-project',
        includeOdataMetadata: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Check that top-level @odata fields ARE present
      expect(result.data['@odata.context']).toBe(mockResponse['@odata.context']);
      expect(result.data['@odata.count']).toBe(2);
      
      // Check that @odata fields are kept in results
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0]['@odata.id']).toBe(mockResponse.value[0]['@odata.id']);
      expect(result.data.results[0].WorkItemId).toBe(123);
      expect(result.data.results[1]['@odata.id']).toBe(mockResponse.value[1]['@odata.id']);
      expect(result.data.results[1].WorkItemId).toBe(456);
    });

    it('should include @odata.nextLink when present', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 100,
        "@odata.nextLink": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems?$skip=50",
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active"
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'workItemCount',
        organization: 'test-org',
        project: 'test-project',
        includeOdataMetadata: true
      });

      expect(result.success).toBe(true);
      expect(result.data['@odata.nextLink']).toBe(mockResponse['@odata.nextLink']);
      expect(result.data['@odata.context']).toBe(mockResponse['@odata.context']);
      expect(result.data['@odata.count']).toBe(100);
    });

    it('should NOT filter out null values when metadata is included', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 1,
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active",
            AssignedTo: null,
            Tags: null,
            Count: 5
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'groupByState',
        organization: 'test-org',
        project: 'test-project',
        includeOdataMetadata: true
      });

      expect(result.success).toBe(true);
      // When metadata is included, results are returned as-is
      expect(result.data.results[0].AssignedTo).toBe(null);
      expect(result.data.results[0].Tags).toBe(null);
      expect(result.data.results[0].WorkItemId).toBe(123);
      expect(result.data.results[0].Count).toBe(5);
    });
  });

  describe('includeMetadata parameter compatibility', () => {
    it('should work independently from includeOdataMetadata', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 1,
        value: [
          {
            WorkItemId: 123,
            State: "Active"
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'workItemCount',
        organization: 'test-org',
        project: 'test-project',
        includeMetadata: true,
        includeOdataMetadata: false
      });

      expect(result.success).toBe(true);
      // includeMetadata adds query and URL
      expect(result.data.query).toBeDefined();
      expect(result.data.analyticsUrl).toBeDefined();
      // includeOdataMetadata: false means no @odata fields
      expect(result.data['@odata.context']).toBeUndefined();
      expect(result.data['@odata.count']).toBeUndefined();
    });

    it('should include both types of metadata when both are true', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 1,
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            WorkItemId: 123,
            State: "Active"
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'workItemCount',
        organization: 'test-org',
        project: 'test-project',
        includeMetadata: true,
        includeOdataMetadata: true
      });

      expect(result.success).toBe(true);
      // Both types of metadata should be present
      expect(result.data.query).toBeDefined();
      expect(result.data.analyticsUrl).toBeDefined();
      expect(result.data['@odata.context']).toBe(mockResponse['@odata.context']);
      expect(result.data['@odata.count']).toBe(1);
      expect(result.data.results[0]['@odata.id']).toBe(mockResponse.value[0]['@odata.id']);
    });
  });

  describe('different query types', () => {
    it('should strip metadata for workItemCount query', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            Count: 42
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'workItemCount',
        organization: 'test-org',
        project: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data['@odata.context']).toBeUndefined();
      expect(result.data.results[0]['@odata.id']).toBeUndefined();
      expect(result.data.results[0].Count).toBe(42);
    });

    it('should strip metadata for velocityMetrics query', async () => {
      const mockResponse = {
        "@odata.context": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/$metadata#WorkItems",
        "@odata.count": 5,
        value: [
          {
            "@odata.id": "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0-preview/WorkItems(123)",
            CompletedDate: "2024-01-15",
            Count: 10
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await handleODataAnalytics(mockConfig, {
        queryType: 'velocityMetrics',
        organization: 'test-org',
        project: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data['@odata.context']).toBeUndefined();
      expect(result.data.results[0]['@odata.id']).toBeUndefined();
      expect(result.data.results[0].CompletedDate).toBe("2024-01-15");
    });
  });
});
