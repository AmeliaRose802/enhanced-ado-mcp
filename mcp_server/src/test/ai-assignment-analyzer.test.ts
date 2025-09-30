import { SamplingService } from '../services/sampling-service.js';
import { AIAssignmentAnalyzerArgs } from '../services/sampling-service.js';

/**
 * Test the new AI Assignment Analyzer tool
 */
async function testAIAssignmentAnalyzer() {
  console.log('🧪 Testing AI Assignment Analyzer...');
  
  // Mock server instance
  const mockServer = {
    getClientCapabilities: () => ({ sampling: true }),
    createMessage: async (request: any) => {
      // Mock AI response for testing
      return {
        content: {
          text: `AI Assignment Analysis:

DECISION: AI_FIT
CONFIDENCE: 0.8
RISK SCORE: 25

This work item is well-suited for AI assignment because:
- Clear, specific task with well-defined scope
- Standard implementation pattern (bug fix)
- Low business risk and reversible changes
- Good test coverage requirements specified

ESTIMATED SCOPE:
- Files: 2-4 files
- Complexity: Low

GUARDRAILS:
- Tests required: Yes
- Feature flag needed: No
- Sensitive areas: No
- Code review needed: Yes

The task involves fixing a specific bug with clear reproduction steps and acceptance criteria. This is an ideal candidate for GitHub Copilot assignment.`
        }
      };
    }
  };

  const samplingService = new SamplingService(mockServer);
  
  const testArgs: AIAssignmentAnalyzerArgs = {
    Title: "Fix pagination bug in user dashboard",
    Description: "Users report that pagination controls are not working correctly on the dashboard. When clicking 'Next Page', the data doesn't update and the page number doesn't increment.",
    WorkItemType: "Bug",
    AcceptanceCriteria: "1. Pagination controls work correctly\n2. Data updates when navigating pages\n3. Page numbers display accurately\n4. No console errors",
    Priority: "High",
    Labels: "bug, ui, dashboard",
    EstimatedFiles: "2-3",
    TechnicalContext: "React, TypeScript, REST API",
    TestingRequirements: "Unit tests and integration tests required",
    Organization: "test-org",
    Project: "test-project"
  };

  try {
    const result = await samplingService.analyzeAIAssignment(testArgs);
    
    console.log('✅ AI Assignment Analysis completed successfully!');
    console.log('📊 Result:');
    console.log(`   Decision: ${result.data.decision}`);
    console.log(`   Confidence: ${result.data.confidence}`);
    console.log(`   Risk Score: ${result.data.riskScore}`);
    console.log(`   Files Estimate: ${result.data.estimatedScope.files.min}-${result.data.estimatedScope.files.max}`);
    console.log(`   Complexity: ${result.data.estimatedScope.complexity}`);
    console.log(`   Strategy: ${result.data.assignmentStrategy}`);
    
    return result;
  } catch (error) {
    console.error('❌ AI Assignment Analysis failed:', error);
    throw error;
  }
}

// Run test if called directly
if (process.argv[1]?.endsWith('ai-assignment-analyzer.test.js')) {
  testAIAssignmentAnalyzer()
    .then(() => console.log('🎉 Test completed successfully!'))
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testAIAssignmentAnalyzer };