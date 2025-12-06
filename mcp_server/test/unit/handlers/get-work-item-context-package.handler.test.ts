/**
 * Comprehensive Error Handling Tests for Get Work Item Context Package Handler
 * 
 * Focus: Error scenarios and edge cases
 * - Invalid work item IDs
 * - Network failures
 * - Missing required fields
 * - Azure CLI errors
 * - HTTP error responses
 * - Malformed API responses
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ContextPackageArgs } from '../../../src/types/index.js';

// Mock dependencies
const mockLoadConfiguration = jest.fn() as jest.Mock;
const mockCreateADOHttpClient = jest.fn() as jest.Mock;
const mockGetTokenProvider = jest.fn() as jest.Mock;
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
const mockBuildSuccessResponse = jest.fn() as jest.Mock;
const mockBuildNotFoundError = jest.fn() as jest.Mock;
const mockBuildErrorResponse = jest.fn() as jest.Mock;

// Mock HTTP client
const mockHttpClient = {
  get: jest.fn() as jest.Mock
};

jest.mock('../../../src/config/config.js', () => ({
  loadConfiguration: mockLoadConfiguration
}));

jest.mock('../../../src/utils/ado-http-client.js', () => ({
  createADOHttpClient: mockCreateADOHttpClient
}));

jest.mock('../../../src/utils/token-provider.js', () => ({
  getTokenProvider: mockGetTokenProvider
}));

jest.mock('../../../src/utils/logger.js', () => ({
  logger: mockLogger,
  errorToContext: jest.fn((error) => ({ message: error instanceof Error ? error.message : String(error) }))
}));

jest.mock('../../../src/utils/response-builder.js', () => ({
  buildSuccessResponse: mockBuildSuccessResponse,
  buildNotFoundError: mockBuildNotFoundError,
  buildErrorResponse: mockBuildErrorResponse
}));

// Import handler after mocks are set up
import { handleGetWorkItemContextPackage } from '../../../src/services/handlers/context/get-work-item-context-package.handler.js';

describe('Get Work Item Context Package Handler - Error Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadConfiguration.mockReturnValue({
      azureDevOps: {
        organization: 'test-org',
        project: 'test-project'
      }
    });
    const mockTokenFn = jest.fn() as jest.Mock;
    mockTokenFn.mockResolvedValue('test-token');
    mockGetTokenProvider.mockReturnValue(mockTokenFn);
    mockCreateADOHttpClient.mockReturnValue(mockHttpClient);
  });

  describe('Input Validation Errors', () => {
    it('should handle missing workItemId parameter', async () => {
      const args = {} as ContextPackageArgs;

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Missing required parameter: workItemId'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required parameter: workItemId');
    });

    it('should handle invalid workItemId (negative number)', async () => {
      const args = { workItemId: -1 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue(new Error('Work item not found'));
      (mockBuildNotFoundError as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Work item -1 not found'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
      expect(mockHttpClient.get).toHaveBeenCalled();
    });

    it('should handle invalid workItemId (zero)', async () => {
      const args = { workItemId: 0 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue(new Error('Invalid work item ID'));
      (mockBuildNotFoundError as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Work item 0 not found'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });

    it('should handle non-existent workItemId', async () => {
      const args = { workItemId: 999999 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue({ status: 404, message: 'Not found' });
      (mockBuildNotFoundError as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Work item 999999 not found'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Network and API Errors', () => {
    it('should handle network timeout errors', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      (mockHttpClient.get as jest.Mock).mockRejectedValue(timeoutError);

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Request timeout while fetching work item 123'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Request timeout while fetching work item 123');
    });

    it('should handle connection refused errors', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Network connection failed: ECONNREFUSED'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle DNS resolution errors', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue(new Error('ENOTFOUND dev.azure.com'));

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['DNS resolution failed'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });

    it('should handle HTTP 500 internal server errors', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue({ 
        status: 500, 
        message: 'Internal Server Error',
        statusText: 'Internal Server Error'
      });

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Azure DevOps API error: Internal Server Error'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });

    it('should handle HTTP 401 unauthorized errors', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue({ 
        status: 401, 
        message: 'Unauthorized',
        statusText: 'Unauthorized'
      });

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Authentication failed. Please run: az login'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Authentication failed. Please run: az login');
    });

    it('should handle HTTP 403 forbidden errors', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue({ 
        status: 403, 
        message: 'Access denied',
        statusText: 'Forbidden'
      });

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Insufficient permissions to access work item 123'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });
  });

  describe('Malformed API Response Errors', () => {
    it('should handle missing fields in API response', async () => {
      const args = { workItemId: 123, includeRelations: true } as ContextPackageArgs;

      // API returns work item without critical fields
      (mockHttpClient.get as jest.Mock).mockResolvedValue({
        data: {
          id: 123
          // Missing fields object
        },
        status: 200
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle null/undefined in nested API response', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockResolvedValue({
        data: null,
        status: 200
      });

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Invalid API response: null data'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });

    it('should handle invalid JSON in API response', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockRejectedValue(new Error('Unexpected token < in JSON at position 0'));

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Failed to parse API response as JSON'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });
  });

  describe('Optional Feature Errors', () => {
    it('should handle comments fetch failure gracefully', async () => {
      const args = { 
        workItemId: 123,
        includeComments: true 
      } as ContextPackageArgs;

      // Main work item succeeds
      mockHttpClient.get
        .mockResolvedValueOnce({
          data: {
            id: 123,
            fields: { 'System.Title': 'Test', 'System.State': 'New' }
          },
          status: 200
        })
        // Comments fetch fails
        .mockRejectedValueOnce(new Error('Comments API unavailable'));

      (mockBuildSuccessResponse as jest.Mock).mockReturnValue({
        success: true,
        data: { workItem: { id: 123 } },
        errors: [],
        warnings: ['Failed to fetch comments: Comments API unavailable'],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Failed to fetch comments: Comments API unavailable');
    });

    it('should handle history fetch failure gracefully', async () => {
      const args = { 
        workItemId: 123,
        includeHistory: true 
      } as ContextPackageArgs;

      mockHttpClient.get
        .mockResolvedValueOnce({
          data: {
            id: 123,
            fields: { 'System.Title': 'Test', 'System.State': 'New' }
          },
          status: 200
        })
        .mockRejectedValueOnce(new Error('History API timeout'));

      (mockBuildSuccessResponse as jest.Mock).mockReturnValue({
        success: true,
        data: { workItem: { id: 123 } },
        errors: [],
        warnings: ['Failed to fetch history: History API timeout'],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.warnings).toContain('Failed to fetch history: History API timeout');
    });

    it('should handle children fetch failure gracefully', async () => {
      const args = { 
        workItemId: 123,
        includeChildren: true 
      } as ContextPackageArgs;

      mockHttpClient.get
        .mockResolvedValueOnce({
          data: {
            id: 123,
            fields: { 'System.Title': 'Epic', 'System.WorkItemType': 'Epic' },
            relations: [{ rel: 'System.LinkTypes.Hierarchy-Forward', url: '/workitems/456' }]
          },
          status: 200
        })
        .mockRejectedValueOnce(new Error('Child work item not found'));

      (mockBuildSuccessResponse as jest.Mock).mockReturnValue({
        success: true,
        data: { workItem: { id: 123 } },
        errors: [],
        warnings: ['Some child work items could not be fetched'],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it('should handle relations with invalid URLs', async () => {
      const args = { 
        workItemId: 123,
        includeRelations: true 
      } as ContextPackageArgs;

      (mockHttpClient.get as jest.Mock).mockResolvedValue({
        data: {
          id: 123,
          fields: { 'System.Title': 'Test' },
          relations: [
            { rel: 'System.LinkTypes.Hierarchy-Forward', url: 'invalid-url' },
            { rel: 'System.LinkTypes.Hierarchy-Forward', url: null }
          ]
        },
        status: 200
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Configuration Errors', () => {
    it('should handle missing organization in config', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      mockLoadConfiguration.mockReturnValue({
        azureDevOps: {
          project: 'test-project'
          // Missing organization
        }
      });

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Missing required configuration: organization'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });

    it('should handle missing project in config', async () => {
      const args = { workItemId: 123 } as ContextPackageArgs;

      mockLoadConfiguration.mockReturnValue({
        azureDevOps: {
          organization: 'test-org'
          // Missing project
        }
      });

      (mockBuildErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        data: null,
        errors: ['Missing required configuration: project'],
        warnings: [],
        metadata: { source: 'get-work-item-context-package' }
      });

      const result = await handleGetWorkItemContextPackage(args);

      expect(result.success).toBe(false);
    });
  });
});
