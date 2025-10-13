// @ts-nocheck
/**
 * Unified Query Generator Handler Tests
 * 
 * Tests for the wit-generate-query tool that intelligently chooses
 * between WIQL and OData based on AI analysis of query characteristics.
 */

import { handleUnifiedQueryGenerator } from '../../src/services/handlers/query/unified-query-generator';
import { unifiedQueryGeneratorSchema } from '../../src/config/schemas';
import type { ToolConfig } from '../../src/types/index';
import type { MCPServerLike } from '../../src/types/mcp';

// Mock dependencies
jest.mock('../../src/services/ado-discovery-service', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../../src/config/config', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  })),
  getRequiredConfig: jest.fn(() => ({
    organization: 'test-org',
    project: 'test-project',
    defaultWorkItemType: 'Task',
    defaultPriority: 2,
    defaultAreaPath: '',
    defaultIterationPath: '',
    gitRepository: { defaultBranch: 'main' },
    gitHubCopilot: { guid: '' }
  }))
}));

// Mock the delegated handlers
jest.mock('../../src/services/handlers/query/generate-wiql-query.handler', () => ({
  handleGenerateWiqlQuery: jest.fn(async () => ({
    success: true,
    data: {
      query: 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"',
      format: 'wiql',
      queryHandle: 'qh_test123'
    },
    errors: [],
    warnings: [],
    metadata: { source: 'wiql-generator' }
  }))
}));

jest.mock('../../src/services/handlers/query/generate-odata-query.handler', () => ({
  handleGenerateODataQuery: jest.fn(async () => ({
    success: true,
    data: {
      query: "$filter=State eq 'Active'",
      format: 'odata',
      queryHandle: 'qh_test456'
    },
    errors: [],
    warnings: [],
    metadata: { source: 'odata-generator' }
  }))
}));

describe('Unified Query Generator Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-generate-query',
    description: 'Test tool',
    script: '',
    schema: unifiedQueryGeneratorSchema,
    inputSchema: { type: 'object' as const }
  };

  let mockServerInstance: MCPServerLike;
  let mockSamplingSupport: boolean;
  let mockAIResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSamplingSupport = true;
    mockAIResponse = {
      content: {
        text: JSON.stringify({
          format: 'wiql',
          confidence: 0.85,
          reasoning: ['Query involves work item states', 'Simple field filtering']
        })
      }
    };

    // Mock server instance with sampling support
    mockServerInstance = {
      createMessage: jest.fn(async () => mockAIResponse),
      hasSamplingSupport: jest.fn(() => mockSamplingSupport),
      getClientCapabilities: jest.fn(() => ({
        sampling: mockSamplingSupport ? {} : undefined
      }))
    } as any;
  });

  describe('AI-powered format selection', () => {
    it('should choose WIQL format for state-based queries', async () => {
      const { handleGenerateWiqlQuery } = require('../../src/services/handlers/query/generate-wiql-query.handler');

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find all active bugs',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(handleGenerateWiqlQuery).toHaveBeenCalled();
      expect(result.data).toHaveProperty('format', 'wiql');
    });

    it('should choose OData format for aggregation queries', async () => {
      mockAIResponse = {
        content: {
          text: JSON.stringify({
            format: 'odata',
            confidence: 0.90,
            reasoning: ['Aggregation required', 'Analytics query pattern']
          })
        }
      };

      const { handleGenerateODataQuery } = require('../../src/services/handlers/query/generate-odata-query.handler');

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Count bugs by state',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(handleGenerateODataQuery).toHaveBeenCalled();
      expect(result.data).toHaveProperty('format', 'odata');
    });

    it('should include confidence and reasoning in response', async () => {
      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find all work items',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toHaveProperty('formatDecision');
      const formatDecision = result.metadata?.formatDecision as any;
      expect(formatDecision).toMatchObject({
        format: 'wiql',
        confidence: 0.85,
        reasoning: expect.any(Array)
      });
    });
  });

  describe('Parameter forwarding', () => {
    it('should forward all query parameters to delegated handler', async () => {
      const { handleGenerateWiqlQuery } = require('../../src/services/handlers/query/generate-wiql-query.handler');

      await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find bugs',
          organization: 'custom-org',
          project: 'custom-project',
          maxIterations: 5,
          includeExamples: false,
          testQuery: false,
          areaPath: 'MyTeam',
          iterationPath: 'Sprint 1',
          returnQueryHandle: false,
          maxResults: 100,
          includeFields: ['System.Title', 'System.State']
        },
        mockServerInstance
      );

      const callArgs = handleGenerateWiqlQuery.mock.calls[0][1];
      expect(callArgs).toMatchObject({
        description: 'Find bugs',
        organization: 'custom-org',
        project: 'custom-project',
        maxIterations: 5,
        includeExamples: false,
        testQuery: false,
        areaPath: 'MyTeam',
        iterationPath: 'Sprint 1',
        returnQueryHandle: false,
        maxResults: 100,
        includeFields: ['System.Title', 'System.State']
      });
    });
  });

  describe('Error handling', () => {
    it('should return error when Azure CLI not available', async () => {
      const { validateAzureCLI } = require('../../src/services/ado-discovery-service');
      validateAzureCLI.mockReturnValueOnce({
        isAvailable: false,
        isLoggedIn: false
      });

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find bugs',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Azure CLI')])
      );
    });

    it('should return error when sampling not available', async () => {
      mockSamplingSupport = false;

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find bugs',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('sampling')])
      );
    });

    it('should handle invalid schema input', async () => {
      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          // Missing required description
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed AI response gracefully', async () => {
      mockAIResponse = {
        content: {
          text: 'not valid json'
        }
      };

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find bugs',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      // Should succeed with heuristic fallback when AI parsing fails
      expect(result.success).toBe(true);
      expect(result.metadata?.formatDecision?.reasoning).toEqual(
        expect.arrayContaining([expect.stringContaining('Heuristic')])
      );
    });

    it('should handle AI response without required fields', async () => {
      mockAIResponse = {
        content: {
          text: JSON.stringify({
            // Missing format field
            confidence: 0.5
          })
        }
      };

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Find bugs',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      // Should succeed with heuristic fallback when AI response is invalid
      expect(result.success).toBe(true);
      expect(result.metadata?.formatDecision?.reasoning).toEqual(
        expect.arrayContaining([expect.stringContaining('Heuristic')])
      );
    });
  });

  describe('AI response parsing', () => {
    it('should handle different AI response structures', async () => {
      // Test with array of reasoning strings
      mockAIResponse = {
        content: {
          text: JSON.stringify({
            format: 'wiql',
            confidence: 0.75,
            reasoning: ['Reason 1', 'Reason 2', 'Reason 3']
          })
        }
      };

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Test query',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      const formatDecision = result.metadata?.formatDecision as any;
      expect(formatDecision?.reasoning).toHaveLength(3);
    });

    it('should normalize confidence scores', async () => {
      mockAIResponse = {
        content: {
          text: JSON.stringify({
            format: 'odata',
            confidence: 100, // Should be normalized to 1.0
            reasoning: ['High confidence']
          })
        }
      };

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Test query',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      // Confidence should be between 0 and 1
      const formatDecision = result.metadata?.formatDecision as any;
      if (formatDecision?.confidence) {
        expect(formatDecision.confidence).toBeGreaterThanOrEqual(0);
        expect(formatDecision.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Default parameters', () => {
    it('should use default values for optional parameters', async () => {
      const { handleGenerateWiqlQuery } = require('../../src/services/handlers/query/generate-wiql-query.handler');

      await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Simple query',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      const callArgs = handleGenerateWiqlQuery.mock.calls[0][1];
      expect(callArgs.maxIterations).toBe(3);
      expect(callArgs.includeExamples).toBe(true);
      expect(callArgs.testQuery).toBe(true);
      expect(callArgs.returnQueryHandle).toBe(true);
      expect(callArgs.maxResults).toBe(200);
    });
  });

  describe('Delegation behavior', () => {
    it('should propagate successful results from WIQL handler', async () => {
      const { handleGenerateWiqlQuery } = require('../../src/services/handlers/query/generate-wiql-query.handler');
      const expectedResult = {
        success: true,
        data: {
          query: 'SELECT [System.Id] FROM WorkItems',
          queryHandle: 'qh_abc123',
          workItemCount: 42
        },
        errors: [],
        warnings: ['Test warning'],
        metadata: { source: 'wiql-generator' }
      };
      handleGenerateWiqlQuery.mockResolvedValueOnce(expectedResult);

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Test',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(expectedResult.data);
      expect(result.warnings).toContain('Test warning');
    });

    it('should propagate errors from delegated handlers', async () => {
      const { handleGenerateWiqlQuery } = require('../../src/services/handlers/query/generate-wiql-query.handler');
      handleGenerateWiqlQuery.mockResolvedValueOnce({
        success: false,
        data: null,
        errors: ['Query generation failed'],
        warnings: [],
        metadata: {}
      });

      const result = await handleUnifiedQueryGenerator(
        mockConfig,
        {
          description: 'Test',
          organization: 'test-org',
          project: 'test-project'
        },
        mockServerInstance
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Query generation failed');
    });
  });
});

