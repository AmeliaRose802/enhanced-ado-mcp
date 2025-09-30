import { SamplingService } from '../services/sampling-service.js';
import { HierarchyValidatorArgs } from '../services/sampling-service.js';

/**
 * Test the new Hierarchy Validator tool
 */
async function testHierarchyValidator() {
  console.log('🧪 Testing Hierarchy Validator...');
  
  // Mock server instance with hierarchy analysis responses
  const mockServer = {
    getClientCapabilities: () => ({ sampling: true }),
    createMessage: async (request: any) => {
      // Mock AI response for hierarchy validation
      return {
        content: {
          text: `Hierarchy Validation Analysis:

ANALYSIS SUMMARY:
Total Work Items: 5
Issues Identified: 3 items with hierarchy problems
Well-Parented Items: 2

DETAILED ANALYSIS:

Item #1234: Implement user authentication system
Current Parent: None (Orphaned)
Issue: High-level Epic without appropriate parent
Severity: High
Recommendation: Create parent Epic "User Management Platform" or link to existing product Epic
Confidence: 0.85
Reasoning: This authentication system appears to be a significant feature that should roll up to a larger product initiative

Item #1235: Add login form validation
Current Parent: #1200 (Product Roadmap Planning)
Issue: Misparented - task under planning Epic instead of feature Epic
Severity: Medium  
Recommendation: Move under "Implement user authentication system" (#1234) as logical parent
Confidence: 0.92
Reasoning: Form validation is clearly a sub-task of the authentication implementation

Item #1236: Fix password reset bug
Current Parent: None (Orphaned)
Issue: Bug without appropriate parent organization
Severity: Medium
Recommendation: Create "Authentication Bug Fixes" Epic or link to authentication feature Epic
Confidence: 0.78
Reasoning: Password reset bugs should be organized under authentication-related work

Item #1237: Database user table migration
Current Parent: #1234 (Implement user authentication system)
Issue: None - correctly parented
Assessment: Well-organized - database work appropriately under authentication Epic

Item #1238: Authentication API endpoints
Current Parent: #1234 (Implement user authentication system)  
Issue: None - correctly parented
Assessment: Well-organized - API work appropriately under authentication Epic

RECOMMENDATIONS:
High Priority:
1. Address orphaned Epic #1234 by creating or finding appropriate parent
2. Re-parent task #1235 to correct feature Epic
3. Organize bug #1236 under appropriate parent Epic

Improvement Opportunities:
- Consider creating "Authentication" area for better organization
- Establish clear Epic → Feature → Task hierarchy patterns
- Regular hierarchy reviews during sprint planning

Best Practices:
- Ensure Epics have clear parent Initiatives or Themes
- Tasks should always roll up to Features or User Stories
- Bugs can be organized under Feature Epics or dedicated Bug Epics`
        }
      };
    }
  };

  const samplingService = new SamplingService(mockServer);
  
  const testArgs: HierarchyValidatorArgs = {
    WorkItemIds: [1234, 1235, 1236, 1237, 1238],
    AnalysisDepth: "deep",
    SuggestAlternatives: true,
    IncludeConfidenceScores: true,
    FilterByWorkItemType: ["Epic", "Feature", "Task", "Bug"],
    ExcludeStates: ["Done", "Closed"],
    Organization: "test-org",
    Project: "test-project"
  };

  try {
    const result = await samplingService.validateHierarchy(testArgs);
    
    console.log('✅ Hierarchy Validation completed successfully!');
    console.log('📊 Analysis Summary:');
    console.log(`   Items Analyzed: ${result.data.analysisContext.analyzedItemCount}`);
    console.log(`   Analysis Depth: ${result.data.analysisContext.analysisDepth}`);
    console.log(`   Total Items: ${result.data.healthySummary.totalAnalyzed}`);
    console.log(`   Items with Issues: ${result.data.healthySummary.itemsWithIssues}`);
    console.log(`   Well-Parented: ${result.data.healthySummary.itemsWellParented}`);
    console.log(`   Orphaned Items: ${result.data.healthySummary.orphanedItems}`);
    console.log(`   Incorrectly Parented: ${result.data.healthySummary.incorrectlyParented}`);
    
    console.log('\n🔍 Issues Found:');
    result.data.issuesFound.forEach((item: any, index: number) => {
      console.log(`   ${index + 1}. #${item.workItemId}: ${item.workItemTitle}`);
      console.log(`      Issues: ${item.issues.length}, Suggestions: ${item.parentingSuggestions.length}`);
      
      item.issues.forEach((issue: any) => {
        console.log(`      - ${issue.issueType} (${issue.severity}): ${issue.description}`);
      });
    });
    
    console.log('\n🎯 High Priority Recommendations:');
    result.data.recommendations.highPriorityActions.forEach((action: string, index: number) => {
      console.log(`   ${index + 1}. ${action}`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Hierarchy Validation failed:', error);
    throw error;
  }
}

// Run test if called directly
if (process.argv[1]?.endsWith('hierarchy-validator.test.js')) {
  testHierarchyValidator()
    .then(() => console.log('🎉 Test completed successfully!'))
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testHierarchyValidator };