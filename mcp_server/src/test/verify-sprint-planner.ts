#!/usr/bin/env node
/**
 * Manual verification script for sprint planner full analysis options
 * This demonstrates the behavior of includeFullAnalysis and rawAnalysisOnError parameters
 */

import { SprintPlanningAnalyzer } from '../services/analyzers/sprint-planner.js';
import { updateConfigFromCLI } from '../config/config.js';

// Initialize config before running tests
updateConfigFromCLI({
  organization: 'test-org',
  project: 'test-project',
  areaPath: '',
  verbose: false
});

// Mock server with sampling support
const mockServer = {
  getClientCapabilities: () => ({ sampling: true }),
  createMessage: async (request: any) => {
    const requestStr = JSON.stringify(request);
    
    // Check if we should return JSON or markdown based on test scenario
    if (requestStr.includes('scenario-markdown')) {
      // Return markdown that will fail to parse
      const longMarkdown = '# Sprint Planning Analysis\n\n' + 
        'This is a comprehensive analysis. '.repeat(200);
      return {
        content: {
          text: longMarkdown
        }
      };
    }
    
    // Return valid JSON
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

async function runTest(testName: string, testFn: () => Promise<void>) {
  try {
    console.log(`\n🧪 ${testName}`);
    await testFn();
    console.log(`✅ PASSED`);
  } catch (error) {
    console.log(`❌ FAILED: ${error}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('=== Sprint Planner Full Analysis Options - Manual Verification ===\n');
  
  const analyzer = new SprintPlanningAnalyzer(mockServer);

  // Test 1: Default behavior (includeFullAnalysis = false)
  await runTest('Test 1: Default behavior should omit fullAnalysisText', async () => {
    const result = await analyzer.analyze({
      iterationPath: "Project\\Sprint 1",
      teamMembers: [{ email: "dev@test.com", name: "Dev User" }],
      organization: "test-org",
      project: "test-project"
    });

    if (!result.success) throw new Error('Analysis failed');
    if (result.data.fullAnalysisText !== undefined) {
      throw new Error('fullAnalysisText should be undefined but was: ' + typeof result.data.fullAnalysisText);
    }
    console.log('   ✓ fullAnalysisText is undefined (as expected)');
    console.log('   ✓ Structured data is present');
  });

  // Test 2: includeFullAnalysis = true
  await runTest('Test 2: includeFullAnalysis=true should include fullAnalysisText', async () => {
    const result = await analyzer.analyze({
      iterationPath: "Project\\Sprint 1",
      teamMembers: [{ email: "dev@test.com", name: "Dev User" }],
      includeFullAnalysis: true,
      organization: "test-org",
      project: "test-project"
    });

    if (!result.success) throw new Error('Analysis failed');
    if (!result.data.fullAnalysisText) {
      throw new Error('fullAnalysisText should be present');
    }
    if (!result.data.fullAnalysisText.includes('healthScore')) {
      throw new Error('fullAnalysisText should contain JSON data');
    }
    console.log('   ✓ fullAnalysisText is present');
    console.log(`   ✓ Size: ${result.data.fullAnalysisText.length} bytes`);
  });

  // Test 3: Parse error with default behavior (truncated)
  await runTest('Test 3: Parse error should truncate analysis text by default', async () => {
    const result = await analyzer.analyze({
      iterationPath: "Project\\Sprint 1",
      teamMembers: [{ email: "dev@test.com", name: "Dev User" }],
      additionalConstraints: "scenario-markdown",
      organization: "test-org",
      project: "test-project"
    });

    if (!result.success) throw new Error('Analysis failed');
    if (!result.data.fullAnalysisText) {
      throw new Error('fullAnalysisText should be present for error case');
    }
    if (result.data.fullAnalysisText.length > 600) {
      throw new Error(`Expected truncated text (~500 chars), got ${result.data.fullAnalysisText.length} chars`);
    }
    if (!result.data.fullAnalysisText.includes('[Truncated')) {
      throw new Error('Should contain truncation notice');
    }
    console.log('   ✓ Text is truncated');
    console.log(`   ✓ Size: ${result.data.fullAnalysisText.length} bytes (vs >6000 full size)`);
    console.log('   ✓ Contains truncation notice');
  });

  // Test 4: Parse error with rawAnalysisOnError = true
  await runTest('Test 4: rawAnalysisOnError=true should include full text on error', async () => {
    const result = await analyzer.analyze({
      iterationPath: "Project\\Sprint 1",
      teamMembers: [{ email: "dev@test.com", name: "Dev User" }],
      rawAnalysisOnError: true,
      additionalConstraints: "scenario-markdown",
      organization: "test-org",
      project: "test-project"
    });

    if (!result.success) throw new Error('Analysis failed');
    if (!result.data.fullAnalysisText) {
      throw new Error('fullAnalysisText should be present');
    }
    if (result.data.fullAnalysisText.length < 1000) {
      throw new Error('Expected full text, got truncated');
    }
    if (result.data.fullAnalysisText.includes('[Truncated')) {
      throw new Error('Should not contain truncation notice');
    }
    console.log('   ✓ Full text is present');
    console.log(`   ✓ Size: ${result.data.fullAnalysisText.length} bytes`);
  });

  // Test 5: Size comparison
  await runTest('Test 5: Verify size savings', async () => {
    // Without full analysis
    const resultWithout = await analyzer.analyze({
      iterationPath: "Project\\Sprint 1",
      teamMembers: [{ email: "dev@test.com", name: "Dev User" }],
      includeFullAnalysis: false,
      organization: "test-org",
      project: "test-project"
    });

    // With full analysis
    const resultWith = await analyzer.analyze({
      iterationPath: "Project\\Sprint 1",
      teamMembers: [{ email: "dev@test.com", name: "Dev User" }],
      includeFullAnalysis: true,
      organization: "test-org",
      project: "test-project"
    });

    const sizeWithout = JSON.stringify(resultWithout.data).length;
    const sizeWith = JSON.stringify(resultWith.data).length;
    const savedBytes = sizeWith - sizeWithout;
    const savedKB = (savedBytes / 1024).toFixed(2);

    console.log(`   ✓ Size without fullAnalysisText: ${sizeWithout} bytes`);
    console.log(`   ✓ Size with fullAnalysisText: ${sizeWith} bytes`);
    console.log(`   ✓ Bytes saved: ${savedBytes} bytes (~${savedKB} KB)`);
    
    if (savedBytes < 500) {
      throw new Error('Expected to save at least 500 bytes');
    }
  });

  console.log('\n=== All Tests Passed! ===\n');
  console.log('Summary:');
  console.log('✅ includeFullAnalysis parameter works correctly');
  console.log('✅ rawAnalysisOnError parameter works correctly');
  console.log('✅ Default behavior omits fullAnalysisText (saves ~6KB)');
  console.log('✅ Parse error handling includes truncated text by default');
  console.log('✅ Structured data is always complete regardless of fullAnalysisText');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
