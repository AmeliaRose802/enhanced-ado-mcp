import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { SamplingService } from '../../src/services/sampling-service.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { AIAssignmentAnalyzerArgs } from '../../src/services/sampling-service.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import type { AIAssignmentResult } from '../../src/types/index.js';

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
    workItemId: 12345,  // Mock work item ID
    organization: "test-org",
    project: "test-project",
    outputFormat: "detailed"
  };

  try {
    const result = await samplingService.analyzeAIAssignment(testArgs);
    
    console.log('✅ AI Assignment Analysis completed successfully!');
    console.log('📊 Result:');
    const data = result.data as unknown as AIAssignmentResult;
    console.log(`   Decision: ${data.decision}`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Risk Score: ${data.riskScore}`);
    console.log(`   Files Estimate: ${data.estimatedScope.files.min}-${data.estimatedScope.files.max}`);
    console.log(`   Complexity: ${data.estimatedScope.complexity}`);
    console.log(`   Strategy: ${data.assignmentStrategy}`);
    
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
