/**
 * Integration test for wit-hierarchy-validator tool
 */
import { executeTool, setServerInstance } from '../services/tool-service.js';

// Mock server for testing
const mockServer = {
  getClientCapabilities: () => ({ sampling: true }),
  createMessage: async (request: any) => {
    return {
      content: {
        text: `Project Management Hierarchy Analysis:

STRUCTURE ASSESSMENT:
The analyzed work items show a mixed hierarchy health with several opportunities for improvement.

FINDINGS:

Epic #5001: Mobile App Redesign
Status: Well-positioned at Epic level
Assessment: Appropriate scope and level for an Epic
Recommendation: Consider creating parent Theme or Initiative for broader mobile strategy

Feature #5002: User Profile Enhancement  
Current Parent: Mobile App Redesign Epic
Status: Correctly parented
Assessment: Good logical fit under mobile redesign Epic

Task #5003: Update profile photo upload
Current Parent: None (Orphaned)
Issue: Missing parent relationship
Severity: Medium
Recommendation: Should be parented under User Profile Enhancement Feature
Confidence: 0.89

Bug #5004: Profile photo not displaying
Current Parent: Mobile App Redesign Epic  
Issue: Too high in hierarchy - should be under Feature
Severity: Medium
Recommendation: Move under User Profile Enhancement Feature for better organization
Confidence: 0.85

Task #5005: Implement photo compression
Current Parent: User Profile Enhancement Feature
Status: Well-parented
Assessment: Correctly organized under appropriate Feature

HIERARCHY HEALTH: 60% (3 of 5 items well-organized)

PRIORITY ACTIONS:
1. Parent orphaned Task #5003 under appropriate Feature
2. Move Bug #5004 to correct hierarchy level  
3. Consider creating Initiative-level parent for Epic #5001

BEST PRACTICES OBSERVED:
- Clear Epic → Feature → Task progression where implemented
- Logical content grouping in well-parented items
- Appropriate work item type usage`
      }
    };
  }
};

async function testHierarchyValidatorIntegration() {
  console.log('🧪 Testing wit-hierarchy-validator integration...');
  
  // Set up the mock server instance
  setServerInstance(mockServer);
  
  const testArgs = {
    WorkItemIds: [5001, 5002, 5003, 5004, 5005], // Provide specific work item IDs
    AreaPath: "MyProject\\Mobile\\UserExperience",
    IncludeChildAreas: true,
    MaxItemsToAnalyze: 10,
    AnalysisDepth: "shallow",
    SuggestAlternatives: true,
    IncludeConfidenceScores: true,
    FilterByWorkItemType: ["Epic", "Feature", "Task", "Bug"],
    ExcludeStates: ["Done", "Removed"]
  };

  try {
    const result = await executeTool('wit-hierarchy-validator', testArgs);
    
    console.log('✅ Hierarchy Validator integration test passed!');
    console.log('📊 Success:', result.success);
    console.log('📝 Data keys:', Object.keys(result.data || {}));
    
    if (result.success && result.data) {
      console.log(`   Analysis Context: ${result.data.analysisContext?.analyzedItemCount || 0} items`);
      console.log(`   Health Summary: ${result.data.healthySummary?.itemsWellParented || 0} well-parented`);
      console.log(`   Issues Found: ${result.data.issuesFound?.length || 0} items with issues`);
      console.log(`   Recommendations: ${result.data.recommendations?.highPriorityActions?.length || 0} high priority actions`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Hierarchy Validator integration test failed:', error);
    throw error;
  }
}

// Run test
testHierarchyValidatorIntegration()
  .then(() => console.log('🎉 Integration test completed successfully!'))
  .catch(error => {
    console.error('💥 Integration test failed:', error);
    process.exit(1);
  });