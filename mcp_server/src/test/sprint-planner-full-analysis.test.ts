import { SprintPlanningAnalyzer } from '../services/analyzers/sprint-planner.js';
import { SprintPlanningAnalyzerArgs } from '../services/sampling-types.js';

/**
 * Test the sprint planner's includeFullAnalysis and rawAnalysisOnError parameters
 */

describe('Sprint Planner Full Analysis Options', () => {
  let mockServer: any;

  beforeEach(() => {
    // Create mock server with sampling support
    mockServer = {
      getClientCapabilities: () => ({ sampling: true }),
      createMessage: async (request: any) => {
        // Return a mock JSON response for successful case
        return {
          content: {
            text: JSON.stringify({
              healthScore: 85,
              confidenceLevel: "High",
              velocityAnalysis: {
                historicalVelocity: {
                  averagePointsPerSprint: 20,
                  trendDirection: "Stable",
                  consistency: "High",
                  lastThreeSprints: []
                },
                predictedVelocity: {
                  estimatedPoints: 22,
                  confidenceRange: { min: 18, max: 26 },
                  assumptions: ["Based on last 3 sprints"]
                }
              },
              teamAssignments: [],
              unassignedItems: [],
              sprintRisks: {
                critical: [],
                warnings: [],
                recommendations: ["Good sprint planning"]
              },
              balanceMetrics: {
                workloadBalance: { score: 85, assessment: "Excellent" },
                skillCoverage: { score: 90, assessment: "Excellent" },
                dependencyRisk: { score: 10, assessment: "Low" },
                overallBalance: { score: 88, assessment: "Excellent" }
              },
              alternativePlans: [],
              actionableSteps: ["Proceed with sprint planning"]
            })
          }
        };
      }
    };
  });

  test('should omit fullAnalysisText when includeFullAnalysis is false (default)', async () => {
    const analyzer = new SprintPlanningAnalyzer(mockServer);
    
    const args: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      organization: "test-org",
      project: "test-project"
    };

    const result = await analyzer.analyze(args);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.fullAnalysisText).toBeUndefined();
    expect(result.data.sprintSummary).toBeDefined();
    expect(result.data.velocityAnalysis).toBeDefined();
  });

  test('should include fullAnalysisText when includeFullAnalysis is true', async () => {
    const analyzer = new SprintPlanningAnalyzer(mockServer);
    
    const args: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      includeFullAnalysis: true,
      organization: "test-org",
      project: "test-project"
    };

    const result = await analyzer.analyze(args);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.fullAnalysisText).toBeDefined();
    expect(result.data.fullAnalysisText).toContain('"healthScore"');
    expect(result.data.fullAnalysisText!.length).toBeGreaterThan(100);
  });

  test('should truncate analysis text on parse error by default', async () => {
    // Mock server that returns markdown instead of JSON
    const mockServerWithMarkdown = {
      getClientCapabilities: () => ({ sampling: true }),
      createMessage: async (request: any) => {
        const longMarkdown = '# Sprint Planning Analysis\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(100);
        return {
          content: {
            text: longMarkdown
          }
        };
      }
    };

    const analyzer = new SprintPlanningAnalyzer(mockServerWithMarkdown);
    
    const args: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      organization: "test-org",
      project: "test-project"
    };

    const result = await analyzer.analyze(args);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.fullAnalysisText).toBeDefined();
    expect(result.data.fullAnalysisText!.length).toBeLessThanOrEqual(600); // 500 chars + truncation message
    expect(result.data.fullAnalysisText).toContain('[Truncated');
    expect(result.data.sprintRisks.critical).toHaveLength(1);
    expect(result.data.sprintRisks.critical[0].title).toBe("Parse Error");
  });

  test('should include full analysis text on parse error when rawAnalysisOnError is true', async () => {
    // Mock server that returns markdown instead of JSON
    const mockServerWithMarkdown = {
      getClientCapabilities: () => ({ sampling: true }),
      createMessage: async (request: any) => {
        const longMarkdown = '# Sprint Planning Analysis\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(100);
        return {
          content: {
            text: longMarkdown
          }
        };
      }
    };

    const analyzer = new SprintPlanningAnalyzer(mockServerWithMarkdown);
    
    const args: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      rawAnalysisOnError: true,
      organization: "test-org",
      project: "test-project"
    };

    const result = await analyzer.analyze(args);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.fullAnalysisText).toBeDefined();
    expect(result.data.fullAnalysisText!.length).toBeGreaterThan(1000);
    expect(result.data.fullAnalysisText).not.toContain('[Truncated');
  });

  test('should respect both includeFullAnalysis and rawAnalysisOnError on error', async () => {
    // Mock server that returns markdown instead of JSON
    const mockServerWithMarkdown = {
      getClientCapabilities: () => ({ sampling: true }),
      createMessage: async (request: any) => {
        return {
          content: {
            text: '# Sprint Planning Analysis\n\nSome markdown content here.'
          }
        };
      }
    };

    const analyzer = new SprintPlanningAnalyzer(mockServerWithMarkdown);
    
    const args: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      includeFullAnalysis: true,
      rawAnalysisOnError: true,
      organization: "test-org",
      project: "test-project"
    };

    const result = await analyzer.analyze(args);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.fullAnalysisText).toBeDefined();
    expect(result.data.fullAnalysisText).toContain('Sprint Planning Analysis');
  });

  test('should save approximately 6KB when fullAnalysisText is omitted', async () => {
    const analyzer = new SprintPlanningAnalyzer(mockServer);
    
    // Test with includeFullAnalysis = false
    const argsWithoutFull: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      includeFullAnalysis: false,
      organization: "test-org",
      project: "test-project"
    };

    const resultWithout = await analyzer.analyze(argsWithoutFull);
    const sizeWithout = JSON.stringify(resultWithout.data).length;

    // Test with includeFullAnalysis = true
    const argsWithFull: SprintPlanningAnalyzerArgs = {
      iterationPath: "Project\\Sprint 1",
      teamMembers: [
        { email: "dev@test.com", name: "Dev User" }
      ],
      includeFullAnalysis: true,
      organization: "test-org",
      project: "test-project"
    };

    const resultWith = await analyzer.analyze(argsWithFull);
    const sizeWith = JSON.stringify(resultWith.data).length;

    // Calculate the difference
    const savedBytes = sizeWith - sizeWithout;
    
    console.log(`Size without fullAnalysisText: ${sizeWithout} bytes`);
    console.log(`Size with fullAnalysisText: ${sizeWith} bytes`);
    console.log(`Bytes saved: ${savedBytes} bytes (~${(savedBytes / 1024).toFixed(2)} KB)`);

    // Verify we're saving significant space (at least 500 bytes for this small test)
    expect(savedBytes).toBeGreaterThan(500);
  });
});
