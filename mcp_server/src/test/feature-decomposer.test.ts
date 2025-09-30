import { SamplingService } from '../services/sampling-service.js';
import { FeatureDecomposerArgs } from '../services/sampling-service.js';

/**
 * Test the new Feature Decomposer tool
 */
async function testFeatureDecomposer() {
  console.log('🧪 Testing Feature Decomposer...');
  
  // Mock server instance with sophisticated AI responses
  const mockServer = {
    getClientCapabilities: () => ({ sampling: true }),
    createMessage: async (request: any) => {
      // Mock AI response for feature decomposition
      return {
        content: {
          text: `Feature Decomposition Analysis:

STRATEGY: Breaking down the user authentication system into logical, testable components with consideration for security, scalability, and maintainability.

WORK ITEMS:

Item 1: Design and implement user registration API endpoint
Description: Create RESTful API endpoint for user registration with email validation, password hashing, and basic data validation. Include input sanitization and error handling.
Complexity: Medium
Effort: Medium
Dependencies: Database schema setup
Technical Notes: Use bcrypt for password hashing, implement rate limiting for security

Item 2: Create user login authentication service
Description: Implement secure login functionality with JWT token generation, session management, and brute force protection. Include proper error messages without revealing user existence.
Complexity: Medium
Effort: Medium
Dependencies: Registration endpoint
Technical Notes: JWT with refresh tokens, implement account lockout after failed attempts

Item 3: Build user profile management interface
Description: Develop responsive UI components for user profile viewing and editing. Include form validation, image upload capability, and real-time updates.
Complexity: Medium
Effort: Large
Dependencies: Authentication service
Technical Notes: React components with form validation, image resizing and upload to cloud storage

Item 4: Implement password reset functionality
Description: Create secure password reset flow with email verification, temporary tokens, and time-based expiration. Include both email templates and API endpoints.
Complexity: Simple
Effort: Medium
Dependencies: Email service configuration
Technical Notes: Secure random token generation, email template system

Item 5: Add multi-factor authentication (MFA) support
Description: Integrate MFA options including SMS, email, and authenticator apps. Provide backup codes and account recovery mechanisms.
Complexity: Complex
Effort: Large
Dependencies: Authentication service, user profile UI
Technical Notes: TOTP implementation, SMS gateway integration, backup code generation

Item 6: Create comprehensive authentication test suite
Description: Develop unit, integration, and security tests covering all authentication scenarios. Include penetration testing checklist and automated security scans.
Complexity: Medium
Effort: Medium
Dependencies: All authentication components
Technical Notes: Jest test framework, security testing tools, API testing with various scenarios

IMPLEMENTATION ORDER: 1 → 2 → 4 → 3 → 5 → 6

RISK FACTORS:
- Security vulnerabilities in authentication flow
- Performance impact of password hashing
- Integration complexity with existing systems
- Compliance requirements for user data

DEPENDENCIES:
- Database schema design and setup
- Email service configuration
- SMS gateway for MFA
- Cloud storage for profile images`
        }
      };
    }
  };

  const samplingService = new SamplingService(mockServer);
  
  const testArgs: FeatureDecomposerArgs = {
    Title: "User Authentication and Profile Management System",
    Description: "Implement a comprehensive user authentication system with registration, login, profile management, and multi-factor authentication. The system should be secure, scalable, and user-friendly.",
    WorkItemType: "Task",
    TargetComplexity: "medium",
    MaxItems: 6,
    TechnicalContext: "Node.js, Express, React, PostgreSQL, JWT, bcrypt",
    BusinessContext: "B2B SaaS application requiring enterprise-grade security and compliance",
    ExistingComponents: "Basic user database schema, email service configuration",
    Dependencies: "Database migration system, email templates, cloud storage setup",
    QualityRequirements: "Security audit compliance, 99.9% uptime, GDPR compliance",
    GenerateAcceptanceCriteria: true,
    AnalyzeAISuitability: true,
    AutoCreateWorkItems: false,
    AutoAssignAISuitable: false,
    Organization: "test-org",
    Project: "test-project"
  };

  try {
    const result = await samplingService.decomposeFeature(testArgs);
    
    console.log('✅ Feature Decomposition completed successfully!');
    console.log('📊 Result Summary:');
    console.log(`   Original Feature: ${result.data.originalFeature.title}`);
    console.log(`   Generated Items: ${result.data.suggestedItems.length}`);
    console.log(`   Overall Complexity: ${result.data.overallComplexity}`);
    console.log(`   Total Effort: ${result.data.estimatedTotalEffort}`);
    console.log(`   Risk Factors: ${result.data.riskFactors.length}`);
    
    console.log('\n🔍 Generated Work Items:');
    result.data.suggestedItems.forEach((item: any, index: number) => {
      console.log(`   ${index + 1}. ${item.title}`);
      console.log(`      Complexity: ${item.complexity} | Effort: ${item.estimatedEffort}`);
      if (item.aiSuitability) {
        console.log(`      AI Suitability: ${item.aiSuitability} (Confidence: ${item.confidence?.toFixed(1)})`);
      }
    });
    
    if (result.data.assignmentSummary) {
      console.log('\n📋 Assignment Summary:');
      console.log(`   AI-Suitable: ${result.data.assignmentSummary.aiSuitableCount} items`);
      console.log(`   Human-Required: ${result.data.assignmentSummary.humanRequiredCount} items`);
      console.log(`   Hybrid: ${result.data.assignmentSummary.hybridCount} items`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Feature Decomposition failed:', error);
    throw error;
  }
}

// Run test if called directly
if (process.argv[1]?.endsWith('feature-decomposer.test.js')) {
  testFeatureDecomposer()
    .then(() => console.log('🎉 Test completed successfully!'))
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testFeatureDecomposer };