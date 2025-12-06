/**
 * Comprehensive Error Handling Tests for Export Work Items Handler
 * 
 * Focus: Error scenarios for bulk export operations
 * - Invalid query handles
 * - Format validation errors
 * - File system errors
 * - Excel generation failures
 * - Memory/streaming errors
 * - Network failures during data fetch
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ToolConfig } from '../../../src/types/index.js';

// Mock dependencies
const mockValidateAndParse = jest.fn() as jest.Mock;
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
const mockQueryHandleService = {
  resolveItemSelector: jest.fn() as jest.Mock,
  getQueryData: jest.fn() as jest.Mock
};
const mockADOHttpClient = jest.fn() as jest.Mock;
const mockLoadConfiguration = jest.fn() as jest.Mock;
const mockGetTokenProvider = jest.fn() as jest.Mock;
const mockExportWorkItems = jest.fn() as jest.Mock;

jest.mock('../../../src/utils/handler-helpers.js', () => ({
  validateAndParse: mockValidateAndParse
}));

jest.mock('../../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

jest.mock('../../../src/services/query-handle-service.js', () => ({
  queryHandleService: mockQueryHandleService
}));

jest.mock('../../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: mockADOHttpClient
}));

jest.mock('../../../src/config/config.js', () => ({
  loadConfiguration: mockLoadConfiguration
}));

jest.mock('../../../src/utils/token-provider.js', () => ({
  getTokenProvider: mockGetTokenProvider
}));

jest.mock('../../../src/services/export-service.js', () => ({
  exportWorkItems: mockExportWorkItems
}));

import { handleExportWorkItems } from '../../../src/services/handlers/bulk-operations/export-work-items.handler.js';

describe('Export Work Items Handler - Error Scenarios', () => {
  const mockConfig: ToolConfig = {
    name: 'export-work-items',
    description: 'Export work items',
    script: 'test',
    schema: {} as any,
    inputSchema: {} as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLoadConfiguration.mockReturnValue({
      azureDevOps: {
        organization: 'test-org',
        project: 'test-project'
      }
    });
    
    mockGetTokenProvider.mockReturnValue(jest.fn().mockResolvedValue('test-token'));
  });

  describe('Query Handle Errors', () => {
    it('should handle invalid query handle', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'invalid-qh',
          format: 'csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue(null);
      mockQueryHandleService.getQueryData.mockReturnValue(null);

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
      expect(result.errors[0]).toContain('invalid-qh');
    });

    it('should handle expired query handle', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-expired',
          format: 'xlsx'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue(null);
      mockQueryHandleService.getQueryData.mockReturnValue(null);

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('24 hours');
    });

    it('should handle query handle with no matching items', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-empty',
          format: 'csv',
          itemSelector: 'all'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        wiql: 'SELECT [System.Id] FROM WorkItems',
        project: 'test'
      });

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No work items matched');
    });

    it('should handle invalid item selector criteria', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          itemSelector: { states: ['NonExistentState'] }
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No work items matched');
    });
  });

  describe('Format Validation Errors', () => {
    it('should handle unsupported export format', async () => {
      mockValidateAndParse.mockReturnValue({
        success: false,
        error: {
          success: false,
          data: null,
          errors: ['Invalid format: "pdf". Supported formats: csv, xlsx, tsv'],
          warnings: [],
          metadata: { source: 'validation' }
        }
      });

      const result = await handleExportWorkItems(mockConfig, { format: 'pdf' });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid format');
    });

    it('should handle missing required format parameter', async () => {
      mockValidateAndParse.mockReturnValue({
        success: false,
        error: {
          success: false,
          data: null,
          errors: ['Missing required parameter: format'],
          warnings: [],
          metadata: { source: 'validation' }
        }
      });

      const result = await handleExportWorkItems(mockConfig, { queryHandle: 'qh-123' });

      expect(result.success).toBe(false);
    });
  });

  describe('File System Errors', () => {
    it('should handle permission denied when writing file', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          outputPath: '/root/protected/export.csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('EACCES: permission denied, open \'/root/protected/export.csv\'')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('EACCES');
    });

    it('should handle disk full error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'xlsx',
          outputPath: '/tmp/export.xlsx'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('ENOSPC: no space left on device')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('ENOSPC');
    });

    it('should handle invalid output path (directory not exists)', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          outputPath: '/nonexistent/directory/export.csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('ENOENT');
    });

    it('should handle readonly file system', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          outputPath: '/media/readonly/export.csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('EROFS: read-only file system')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('read-only');
    });
  });

  describe('Excel Generation Errors', () => {
    it('should handle Excel worksheet name too long', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'xlsx',
          excelOptions: {
            sheetNames: {
              workItems: 'This is a very long worksheet name that exceeds Excel maximum'
            }
          }
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Worksheet name exceeds 31 character limit')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Worksheet name');
    });

    it('should handle Excel row limit exceeded', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-huge',
          format: 'xlsx'
        }
      });

      // Simulate query handle with too many items
      const hugeArray = new Array(1048577).fill(0).map((_, i) => i + 1);
      mockQueryHandleService.resolveItemSelector.mockReturnValue(hugeArray);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: hugeArray,
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Excel row limit (1,048,576) exceeded')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('row limit');
    });

    it('should handle Excel library error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'xlsx'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Failed to create workbook: Internal library error')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('library error');
    });
  });

  describe('Data Fetch Errors', () => {
    it('should handle network timeout during work item fetch', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Request timeout after 30000ms while fetching work items')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('timeout');
    });

    it('should handle API rate limit during bulk fetch', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('HTTP 429: Too Many Requests. Rate limit exceeded.')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('429');
      expect(result.errors[0]).toContain('Rate limit');
    });

    it('should handle partial work item fetch failure', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv'
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 999]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 999],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Work item 999 not found or access denied')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('999');
    });
  });

  describe('Memory and Streaming Errors', () => {
    it('should handle out of memory error for large export', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-large',
          format: 'xlsx',
          streamLargeExports: false // Buffering in memory
        }
      });

      const largeArray = new Array(50000).fill(0).map((_, i) => i + 1);
      mockQueryHandleService.resolveItemSelector.mockReturnValue(largeArray);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: largeArray,
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('JavaScript heap out of memory')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('out of memory');
    });

    it('should handle stream write error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          streamLargeExports: true
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Stream write error: Connection closed')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Stream write error');
    });
  });

  describe('Field and Relationship Errors', () => {
    it('should handle invalid field name in field selection', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          fields: ['System.Id', 'NonExistent.Field', 'System.Title']
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Field "NonExistent.Field" not found in work item type definition')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('NonExistent.Field');
    });

    it('should handle circular relationship detection failure', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv',
          includeRelationships: true,
          relationshipDepth: 3
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Circular relationship detected at depth 3')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Circular relationship');
    });

    it('should handle comments fetch failure for includeComments', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'xlsx',
          includeComments: true
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Comments API unavailable or access denied')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Comments API');
    });

    it('should handle history revision fetch failure', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'xlsx',
          includeHistory: true,
          maxHistoryRevisions: 50
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('History API timeout after fetching 30 revisions')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('History API');
    });
  });

  describe('Configuration Errors', () => {
    it('should handle missing organization configuration', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv'
        }
      });

      mockLoadConfiguration.mockReturnValue({
        azureDevOps: {
          project: 'test-project'
          // Missing organization
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Missing required configuration: organization')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('organization');
    });

    it('should handle missing project configuration', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          queryHandle: 'qh-123',
          format: 'csv'
        }
      });

      mockLoadConfiguration.mockReturnValue({
        azureDevOps: {
          organization: 'test-org'
          // Missing project
        }
      });

      mockQueryHandleService.resolveItemSelector.mockReturnValue([1, 2, 3]);
      mockQueryHandleService.getQueryData.mockReturnValue({
        workItemIds: [1, 2, 3],
        contextMap: new Map()
      });

      mockExportWorkItems.mockRejectedValue(
        new Error('Missing required configuration: project')
      );

      const result = await handleExportWorkItems(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('project');
    });
  });
});
