/**
 * Tests for bulk-enhance-descriptions handler parameter optimization
 * Validates includeTitles and includeConfidence parameters
 */

import { handleBulkEnhanceDescriptions } from '../services/handlers/ai-powered/bulk-enhance-descriptions.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { bulkEnhanceDescriptionsByQueryHandleSchema } from '../config/schemas.js';
import type { ToolConfig } from '../types/index.js';
import type { MCPServer } from '../types/mcp.js';

// Mock the dependencies
jest.mock('../services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation((url: string) => {
      const match = url.match(/wit\/workitems\/(\d+)/);
      if (match) {
        const id = parseInt(match[1]);
        return Promise.resolve({
          data: {
            id,
            fields: {
              'System.Title': `Work Item ${id}`,
              'System.Description': 'Current description',
              'System.WorkItemType': 'Task',
              'System.State': 'Active',
              'System.Tags': 'test'
            }
          }
        });
      }
      return Promise.reject(new Error('Not found'));
    }),
    patch: jest.fn().mockResolvedValue({})
  }))
}));

jest.mock('../config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  }))
}));

jest.mock('../utils/sampling-client.js', () => ({
  SamplingClient: jest.fn().mockImplementation(() => ({
    hasSamplingSupport: jest.fn(() => true),
    createMessage: jest.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            enhancedDescription: 'Enhanced description content',
            improvementReason: 'Added more context',
            confidenceScore: 0.95
          })
        }
      ]
    }),
    extractResponseText: jest.fn((result) => {
      return result.content[0].text;
    })
  }))
}));

describe('Bulk Enhance Descriptions - Parameter Minimization', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-bulk-enhance-descriptions-by-query-handle',
    description: 'Test tool',
    script: '',
    schema: bulkEnhanceDescriptionsByQueryHandleSchema,
    inputSchema: {}
  };

  const mockServer = {} as MCPServer;

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('includeTitles parameter', () => {
    it('should omit titles by default (includeTitles: false)', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Default behavior (includeTitles not specified, defaults to false)
      const result = await handleBulkEnhanceDescriptions(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true
      }, mockServer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2);
      
      // Titles should NOT be present
      result.data.results.forEach((item: any) => {
        expect(item.title).toBeUndefined();
        expect(item.work_item_id).toBeDefined();
      });
    });

    it('should include titles when includeTitles: true', async () => {
      // Arrange
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Explicitly request titles
      const result = await handleBulkEnhanceDescriptions(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true,
        includeTitles: true
      }, mockServer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      
      // Titles SHOULD be present
      expect(result.data.results[0].title).toBe('Work Item 101');
      expect(result.data.results[0].work_item_id).toBe(101);
    });
  });

  describe('includeConfidence parameter', () => {
    it('should omit confidence by default (includeConfidence: false)', async () => {
      // Arrange
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Default behavior (includeConfidence not specified, defaults to false)
      const result = await handleBulkEnhanceDescriptions(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true
      }, mockServer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      
      // Confidence should NOT be present
      expect(result.data.results[0].confidence).toBeUndefined();
    });

    it('should omit high confidence scores even when includeConfidence: true', async () => {
      // Arrange - Mock returns high confidence (0.95)
      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Request confidence but mock returns 0.95 (> 0.85 threshold)
      const result = await handleBulkEnhanceDescriptions(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true,
        includeConfidence: true
      }, mockServer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      
      // High confidence (>= 0.85) should be omitted
      expect(result.data.results[0].confidence).toBeUndefined();
    });

    it('should include low confidence scores when includeConfidence: true', async () => {
      // Arrange - Mock returns low confidence (0.70)
      const { SamplingClient } = require('../utils/sampling-client.js');
      SamplingClient.mockImplementationOnce(() => ({
        hasSamplingSupport: jest.fn(() => true),
        createMessage: jest.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                enhancedDescription: 'Enhanced description content',
                improvementReason: 'Added more context',
                confidenceScore: 0.70  // Low confidence < 0.85
              })
            }
          ]
        }),
        extractResponseText: jest.fn((result) => result.content[0].text)
      }));

      const workItemIds = [101];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Request confidence with low score
      const result = await handleBulkEnhanceDescriptions(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true,
        includeConfidence: true
      }, mockServer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      
      // Low confidence (< 0.85) should be included
      expect(result.data.results[0].confidence).toBe(0.70);
    });
  });

  describe('Combined parameter optimization', () => {
    it('should support both parameters together', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Task 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Task 2', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      // Act - Both minimizations active (both false)
      const result = await handleBulkEnhanceDescriptions(mockConfig, {
        queryHandle: handle,
        itemSelector: 'all',
        dryRun: true,
        includeTitles: false,
        includeConfidence: false
      }, mockServer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2);
      
      result.data.results.forEach((item: any) => {
        // Both should be omitted
        expect(item.title).toBeUndefined();
        expect(item.confidence).toBeUndefined();
        
        // Core fields should still be present
        expect(item.work_item_id).toBeDefined();
        expect(item.status).toBeDefined();
      });
    });
  });

  describe('Schema validation', () => {
    it('should have correct default values in schema', () => {
      const schema = bulkEnhanceDescriptionsByQueryHandleSchema;
      
      // Test defaults
      const parsed = schema.parse({
        queryHandle: 'test-handle',
        itemSelector: 'all'
      });
      
      expect(parsed.includeTitles).toBe(false);
      expect(parsed.includeConfidence).toBe(false);
    });

    it('should accept explicit true values', () => {
      const schema = bulkEnhanceDescriptionsByQueryHandleSchema;
      
      const parsed = schema.parse({
        queryHandle: 'test-handle',
        itemSelector: 'all',
        includeTitles: true,
        includeConfidence: true
      });
      
      expect(parsed.includeTitles).toBe(true);
      expect(parsed.includeConfidence).toBe(true);
    });
  });
});
