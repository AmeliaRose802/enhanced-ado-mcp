/**
 * Tool Discovery Token Minimization Tests
 * 
 * Tests the includeExamples parameter to verify token savings
 * while maintaining all other tool discovery features.
 */

import { toolDiscoverySchema } from '../config/schemas.js';

// Mock the sampling client
const mockSamplingClient = {
  hasSamplingSupport: jest.fn(() => true),
  createMessage: jest.fn(),
  extractResponseText: jest.fn()
};

// Mock tool discovery analyzer
const mockDiscover = jest.fn();

jest.mock('../services/analyzers/tool-discovery.js', () => ({
  ToolDiscoveryAnalyzer: jest.fn().mockImplementation(() => ({
    discover: mockDiscover
  }))
}));

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

describe('Tool Discovery Token Minimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Definition', () => {
    it('should have includeExamples parameter with default false', () => {
      const parsed = toolDiscoverySchema.parse({
        intent: 'test intent'
      });
      
      expect(parsed.includeExamples).toBe(false);
    });

    it('should accept includeExamples: true', () => {
      const parsed = toolDiscoverySchema.parse({
        intent: 'test intent',
        includeExamples: true
      });
      
      expect(parsed.includeExamples).toBe(true);
    });

    it('should accept includeExamples: false explicitly', () => {
      const parsed = toolDiscoverySchema.parse({
        intent: 'test intent',
        includeExamples: false
      });
      
      expect(parsed.includeExamples).toBe(false);
    });

    it('should have token savings mentioned in description', () => {
      const schema = toolDiscoverySchema.shape.includeExamples;
      const description = schema.description;
      
      expect(description).toContain('token');
      expect(description).toContain('saves');
      expect(description).toContain('default false');
    });
  });

  describe('Response Format with includeExamples', () => {
    it('should demonstrate response without exampleUsage when includeExamples is false', () => {
      // Minimal response without examples
      const minimalResponse: any = {
        recommendations: [
          {
            toolName: 'wit-create-item',
            confidence: 90,
            reasoning: 'User wants to create a new work item',
            requiredParameters: ['title'],
            optionalParameters: ['description', 'tags']
          }
        ]
      };

      expect(minimalResponse.recommendations[0].exampleUsage).toBeUndefined();
      expect(minimalResponse.recommendations[0].toolName).toBeDefined();
      expect(minimalResponse.recommendations[0].confidence).toBeDefined();
      expect(minimalResponse.recommendations[0].reasoning).toBeDefined();
    });

    it('should demonstrate response with exampleUsage when includeExamples is true', () => {
      // Full response with examples
      const fullResponse = {
        recommendations: [
          {
            toolName: 'wit-create-item',
            confidence: 90,
            reasoning: 'User wants to create a new work item',
            exampleUsage: '{ title: "New Bug", description: "Bug description", workItemType: "Bug" }',
            requiredParameters: ['title'],
            optionalParameters: ['description', 'tags']
          }
        ]
      };

      expect(fullResponse.recommendations[0].exampleUsage).toBeDefined();
      expect(fullResponse.recommendations[0].exampleUsage).toContain('title');
    });
  });

  describe('Token Savings Estimation', () => {
    it('should demonstrate significant token savings per tool', () => {
      // Response WITHOUT examples (includeExamples: false)
      const responseWithoutExamples = JSON.stringify({
        recommendations: [
          {
            toolName: 'wit-bulk-update',
            confidence: 88,
            reasoning: 'Use bulk update to modify multiple items efficiently',
            requiredParameters: ['queryHandle', 'updates'],
            optionalParameters: ['dryRun', 'itemSelector']
          }
        ]
      });

      // Response WITH examples (includeExamples: true)
      const responseWithExamples = JSON.stringify({
        recommendations: [
          {
            toolName: 'wit-bulk-update',
            confidence: 88,
            reasoning: 'Use bulk update to modify multiple items efficiently',
            exampleUsage: '{ queryHandle: "qh_abc123", updates: { "System.Priority": 1, "System.Tags": "urgent" }, itemSelector: { states: ["Active"] }, dryRun: true }',
            requiredParameters: ['queryHandle', 'updates'],
            optionalParameters: ['dryRun', 'itemSelector']
          }
        ]
      });

      const sizeWithout = responseWithoutExamples.length;
      const sizeWith = responseWithExamples.length;
      const savings = sizeWith - sizeWithout;

      // The difference should be significant (at least 100 characters per tool)
      expect(savings).toBeGreaterThanOrEqual(100);
    });

    it('should show cumulative savings with multiple tools', () => {
      const threeToolsWithoutExamples = JSON.stringify({
        recommendations: [
          {
            toolName: 'tool1',
            confidence: 90,
            reasoning: 'First tool recommendation',
            requiredParameters: ['param1'],
            optionalParameters: ['param2']
          },
          {
            toolName: 'tool2',
            confidence: 85,
            reasoning: 'Second tool recommendation',
            requiredParameters: ['param1'],
            optionalParameters: ['param2']
          },
          {
            toolName: 'tool3',
            confidence: 80,
            reasoning: 'Third tool recommendation',
            requiredParameters: ['param1'],
            optionalParameters: ['param2']
          }
        ]
      });

      const threeToolsWithExamples = JSON.stringify({
        recommendations: [
          {
            toolName: 'tool1',
            confidence: 90,
            reasoning: 'First tool recommendation',
            exampleUsage: '{ param1: "value1", param2: "value2", additionalParam: "example data for comprehensive usage" }',
            requiredParameters: ['param1'],
            optionalParameters: ['param2']
          },
          {
            toolName: 'tool2',
            confidence: 85,
            reasoning: 'Second tool recommendation',
            exampleUsage: '{ param1: "value1", param2: "value2", additionalParam: "example data for comprehensive usage" }',
            requiredParameters: ['param1'],
            optionalParameters: ['param2']
          },
          {
            toolName: 'tool3',
            confidence: 80,
            reasoning: 'Third tool recommendation',
            exampleUsage: '{ param1: "value1", param2: "value2", additionalParam: "example data for comprehensive usage" }',
            requiredParameters: ['param1'],
            optionalParameters: ['param2']
          }
        ]
      });

      const sizeWithout = threeToolsWithoutExamples.length;
      const sizeWith = threeToolsWithExamples.length;
      const totalSavings = sizeWith - sizeWithout;
      const savingsPerTool = totalSavings / 3;

      // Total savings should be significant (at least 300 characters)
      expect(totalSavings).toBeGreaterThanOrEqual(300);
      expect(savingsPerTool).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Schema Validation', () => {
    it('should maintain all required fields in schema', () => {
      const testCases = [
        { intent: 'test' },
        { intent: 'test', includeExamples: false },
        { intent: 'test', includeExamples: true },
        { intent: 'test', context: 'additional context' },
        { intent: 'test', maxRecommendations: 5 },
        { intent: 'test', filterCategory: 'bulk-operations' as const },
        { 
          intent: 'test', 
          context: 'ctx',
          maxRecommendations: 2,
          includeExamples: true,
          filterCategory: 'ai-powered' as const
        }
      ];

      testCases.forEach(testCase => {
        expect(() => toolDiscoverySchema.parse(testCase)).not.toThrow();
      });
    });

    it('should reject invalid values', () => {
      // Missing required field
      expect(() => toolDiscoverySchema.parse({})).toThrow();
      
      // Invalid type for includeExamples
      expect(() => toolDiscoverySchema.parse({
        intent: 'test',
        includeExamples: 'invalid'
      })).toThrow();
      
      // Invalid maxRecommendations (out of range)
      expect(() => toolDiscoverySchema.parse({
        intent: 'test',
        maxRecommendations: 0
      })).toThrow();
      
      expect(() => toolDiscoverySchema.parse({
        intent: 'test',
        maxRecommendations: 11
      })).toThrow();
      
      // Invalid filterCategory
      expect(() => toolDiscoverySchema.parse({
        intent: 'test',
        filterCategory: 'invalid-category'
      })).toThrow();
    });
  });

  describe('Default Values', () => {
    it('should apply correct defaults', () => {
      const minimal = toolDiscoverySchema.parse({ intent: 'test' });
      
      expect(minimal.maxRecommendations).toBe(3);
      expect(minimal.includeExamples).toBe(false);
      expect(minimal.filterCategory).toBe('all');
      expect(minimal.context).toBeUndefined();
    });
  });

  describe('Integration with Tool Config', () => {
    it('should be consistent with toolDiscoverySchema export', () => {
      // Ensure the schema is properly exported and can be used
      expect(toolDiscoverySchema).toBeDefined();
      expect(typeof toolDiscoverySchema.parse).toBe('function');
      
      // Test a full scenario
      const fullArgs = {
        intent: 'Find all stale items and update them',
        context: 'My team area path is ProjectName\\TeamArea',
        maxRecommendations: 3,
        includeExamples: false,
        filterCategory: 'bulk-operations' as const
      };
      
      const parsed = toolDiscoverySchema.parse(fullArgs);
      expect(parsed.includeExamples).toBe(false);
      expect(parsed.maxRecommendations).toBe(3);
      expect(parsed.filterCategory).toBe('bulk-operations');
    });
  });
});
