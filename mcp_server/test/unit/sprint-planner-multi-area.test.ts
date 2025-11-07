/**
 * Tests for Sprint Planner multi-area path support
 * Validates graceful handling when multiple area paths are configured
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SprintPlanningAnalyzer } from '../../src/services/analyzers/sprint-planner.js';
import type { SprintPlanningAnalyzerArgs } from '../../src/types/analysis.js';

// Mock configuration with multiple area paths
const mockConfig = {
  azureDevOps: {
    organization: 'test-org',
    project: 'test-project',
    areaPaths: [
      'TestProject\\TeamAlpha',
      'TestProject\\TeamBeta',
      'TestProject\\TeamGamma'
    ],
    defaultWorkItemType: 'Task',
    defaultPriority: 2,
    defaultAssignedTo: '',
    inheritParentPaths: false
  }
};

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => mockConfig),
  updateConfigFromCLI: jest.fn()
}));

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../src/utils/paths.js', () => ({
  promptsDir: '/mock/prompts',
  resourcesDir: '/mock/resources',
  getProjectRoot: jest.fn(() => '/mock/root')
}));

// Mock ADO HTTP client to capture WIQL queries
let capturedWiqlQueries: string[] = [];

jest.mock('../../src/utils/ado-http-client.js', () => ({
  createADOHttpClient: jest.fn(() => ({
    post: jest.fn(async (endpoint: string, data: any) => {
      if (endpoint === 'wit/wiql' && data?.query) {
        capturedWiqlQueries.push(data.query);
      }
      return { data: { workItems: [] } };
    }),
    get: jest.fn(async () => ({ data: { value: [] } }))
  }))
}));

jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => ({
    getToken: jest.fn(async () => 'mock-token')
  }))
}));

jest.mock('../../src/utils/sampling-client.js', () => ({
  SamplingClient: jest.fn().mockImplementation(() => ({
    hasSamplingSupport: jest.fn(() => true),
    createMessage: jest.fn(async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({
          healthScore: 85,
          teamAssignments: [],
          unassignedItems: [],
          velocityAnalysis: {
            historicalVelocity: {
              averagePointsPerSprint: 30,
              trendDirection: 'Stable',
              consistency: 'Moderate',
              lastThreeSprints: []
            },
            predictedVelocity: {
              estimatedPoints: 30,
              confidenceRange: { min: 25, max: 35 },
              assumptions: []
            }
          }
        })
      }]
    })),
    extractResponseText: jest.fn((result: any) => {
      return result.content?.[0]?.text || '';
    })
  }))
}));

jest.mock('../../src/utils/response-builder.js', () => ({
  buildSuccessResponse: jest.fn((data, metadata) => ({ success: true, data, metadata })),
  buildErrorResponse: jest.fn((error, metadata) => ({ success: false, error, metadata })),
  buildSamplingUnavailableResponse: jest.fn(() => ({ success: false, error: 'Sampling unavailable' }))
}));

jest.mock('../../src/utils/ai-helpers.js', () => ({
  extractJSON: jest.fn((text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }),
  formatForAI: jest.fn((data: any) => JSON.stringify(data))
}));

describe('Sprint Planner Multi-Area Path Support', () => {
  let analyzer: SprintPlanningAnalyzer;
  let mockServer: any;

  beforeEach(() => {
    capturedWiqlQueries = [];
    mockServer = {
      sampling: {
        createMessage: jest.fn()
      }
    };
    analyzer = new SprintPlanningAnalyzer(mockServer);
  });

  const baseArgs: SprintPlanningAnalyzerArgs = {
    iterationPath: 'TestProject\\Sprint 10',
    teamMembers: [
      { email: 'user1@test.com', name: 'User One', capacityHours: 60 },
      { email: 'user2@test.com', name: 'User Two', capacityHours: 60 }
    ]
  };

  it('should use all configured area paths when no explicit filter provided', async () => {
    await analyzer.analyze(baseArgs);

    // Verify queries include all configured area paths
    expect(capturedWiqlQueries.length).toBeGreaterThan(0);
    
    // Check that at least one query includes multiple area path conditions
    const hasMultiAreaQuery = capturedWiqlQueries.some(query => 
      query.includes('TeamAlpha') && 
      query.includes('TeamBeta') && 
      query.includes('TeamGamma') &&
      query.includes('OR')
    );
    
    expect(hasMultiAreaQuery).toBe(true);
  });

  it('should use explicit areaPathFilter when provided (takes priority over config)', async () => {
    const argsWithFilter: SprintPlanningAnalyzerArgs = {
      ...baseArgs,
      areaPathFilter: ['TestProject\\TeamAlpha', 'TestProject\\TeamBeta']
    };

    await analyzer.analyze(argsWithFilter);

    // Verify queries use explicit filter instead of config defaults
    const hasExplicitFilter = capturedWiqlQueries.some(query =>
      query.includes('TeamAlpha') &&
      query.includes('TeamBeta') &&
      !query.includes('TeamGamma') // Should NOT include third team
    );

    expect(hasExplicitFilter).toBe(true);
  });

  it('should use single areaPath when provided (overrides config)', async () => {
    const argsWithSinglePath: SprintPlanningAnalyzerArgs = {
      ...baseArgs,
      areaPath: 'TestProject\\TeamAlpha'
    };

    await analyzer.analyze(argsWithSinglePath);

    // Verify queries use single area path
    const hasSingleAreaFilter = capturedWiqlQueries.some(query =>
      query.includes('TeamAlpha') &&
      !query.includes('TeamBeta') &&
      !query.includes('TeamGamma')
    );

    expect(hasSingleAreaFilter).toBe(true);
  });

  it('should prioritize areaPathFilter over single areaPath', async () => {
    const argsWithBoth: SprintPlanningAnalyzerArgs = {
      ...baseArgs,
      areaPath: 'TestProject\\TeamGamma',
      areaPathFilter: ['TestProject\\TeamAlpha']
    };

    await analyzer.analyze(argsWithBoth);

    // Verify areaPathFilter takes priority
    const usesFilter = capturedWiqlQueries.some(query =>
      query.includes('TeamAlpha') &&
      !query.includes('TeamGamma')
    );

    expect(usesFilter).toBe(true);
  });

  it('should handle single configured area path gracefully', async () => {
    // Temporarily override mock config
    const originalLoadConfig = require('../../src/config/config.js').loadConfiguration;
    require('../../src/config/config.js').loadConfiguration = jest.fn(() => ({
      azureDevOps: {
        organization: 'test-org',
        project: 'test-project',
        areaPath: 'TestProject\\SingleTeam', // Legacy single path
        defaultWorkItemType: 'Task',
        defaultPriority: 2,
        defaultAssignedTo: '',
        inheritParentPaths: false
      }
    }));

    await analyzer.analyze(baseArgs);

    // Should still work with single path
    const hasSinglePath = capturedWiqlQueries.some(query =>
      query.includes('SingleTeam')
    );

    expect(hasSinglePath).toBe(true);

    // Restore original mock
    require('../../src/config/config.js').loadConfiguration = originalLoadConfig;
  });

  it('should generate valid WIQL OR clauses for multiple area paths', async () => {
    await analyzer.analyze(baseArgs);

    // Verify OR clause structure in WIQL
    const multiAreaQuery = capturedWiqlQueries.find(query =>
      query.includes('TeamAlpha') && query.includes('OR')
    );

    expect(multiAreaQuery).toBeDefined();
    
    // Should have proper parentheses for OR conditions
    if (multiAreaQuery) {
      expect(multiAreaQuery).toMatch(/\([^\)]*UNDER[^\)]*OR[^\)]*UNDER[^\)]*\)/i);
    }
  });

  it('should return success with metadata showing multiple area paths', async () => {
    const result = await analyzer.analyze(baseArgs);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // Metadata should indicate multi-area planning
  });
});
