/**
 * Integration test for wit-feature-decomposer tool
 */
import { executeTool, setServerInstance } from '../services/tool-service.js';

// Mock server for testing
const mockServer = {
  getClientCapabilities: () => ({ sampling: true }),
  createMessage: async (request: any) => {
    return {
      content: {
        text: `E-commerce Cart Enhancement Decomposition:

DECOMPOSITION STRATEGY: Breaking down the shopping cart enhancement into incremental, testable components that can be developed in parallel where possible.

WORK ITEMS:

Item 1: Implement persistent cart storage
Description: Add database persistence for shopping cart items across user sessions. Include cart item CRUD operations, quantity management, and cleanup for abandoned carts.
Complexity: Simple
Effort: Small
Technical Notes: Use existing database schema, implement cart expiration policy

Item 2: Create cart API endpoints  
Description: Build RESTful API endpoints for cart management including add/remove items, update quantities, and retrieve cart contents. Include proper error handling and validation.
Complexity: Medium
Effort: Medium
Technical Notes: Standard REST patterns, input validation, rate limiting

Item 3: Develop real-time cart synchronization
Description: Implement WebSocket or Server-Sent Events for real-time cart updates across multiple browser tabs and devices. Handle conflict resolution for concurrent updates.
Complexity: Complex
Effort: Large
Technical Notes: WebSocket implementation, conflict resolution strategy, connection management

Item 4: Add cart sharing functionality
Description: Enable users to share cart contents via email or shareable links. Include privacy controls and expiration settings for shared carts.
Complexity: Medium  
Effort: Medium
Technical Notes: UUID generation for share links, email template system, privacy controls

OVERALL COMPLEXITY: Medium
ESTIMATED TOTAL EFFORT: Large
IMPLEMENTATION ORDER: [0, 1, 3, 2]

RISK FACTORS:
- Real-time synchronization complexity may impact performance
- Concurrent cart updates need careful handling
- Shared cart privacy and security considerations

QUALITY CONSIDERATIONS:
- Performance testing for real-time features required
- Security validation for shared cart links
- Cross-browser compatibility testing needed`
      }
    };
  }
};

async function testFeatureDecomposerIntegration() {
  console.log('🧪 Testing wit-feature-decomposer integration...');
  
  // Set up the mock server instance
  setServerInstance(mockServer);
  
  const testArgs = {
    Title: "Enhanced Shopping Cart with Real-time Sync",
    Description: "Upgrade the existing shopping cart to support persistent storage, real-time synchronization across devices, and cart sharing capabilities for improved user experience.",
    WorkItemType: "Task", 
    TargetComplexity: "medium",
    MaxItems: 4,
    TechnicalContext: "React, Node.js, WebSockets, PostgreSQL, Redis",
    BusinessContext: "E-commerce platform serving 100K+ daily users, mobile-first experience",
    ExistingComponents: "Basic cart functionality, user authentication, product catalog",
    Dependencies: "Redis for session management, WebSocket infrastructure",
    QualityRequirements: "Sub-100ms real-time updates, 99.9% availability, mobile responsive",
    GenerateAcceptanceCriteria: true,
    AnalyzeAISuitability: true,
    AutoCreateWorkItems: false,
    AutoAssignAISuitable: false
  };

  try {
    const result = await executeTool('wit-feature-decomposer', testArgs);
    
    console.log('✅ Feature Decomposer integration test passed!');
    console.log('📊 Success:', result.success);
    console.log('📝 Data keys:', Object.keys(result.data || {}));
    
    if (result.success && result.data) {
      console.log(`   Feature: ${result.data.originalFeature?.title}`);
      console.log(`   Work Items: ${result.data.suggestedItems?.length || 0}`);
      console.log(`   Strategy: ${result.data.decompositionStrategy?.substring(0, 100)}...`);
      console.log(`   Total Effort: ${result.data.estimatedTotalEffort}`);
      console.log(`   Overall Complexity: ${result.data.overallComplexity}`);
      
      if (result.data.assignmentSummary) {
        const summary = result.data.assignmentSummary;
        console.log(`   AI-Suitable: ${summary.aiSuitableCount}, Human: ${summary.humanRequiredCount}, Hybrid: ${summary.hybridCount}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Feature Decomposer integration test failed:', error);
    throw error;
  }
}

// Run test
testFeatureDecomposerIntegration()
  .then(() => console.log('🎉 Integration test completed successfully!'))
  .catch(error => {
    console.error('💥 Integration test failed:', error);
    process.exit(1);
  });