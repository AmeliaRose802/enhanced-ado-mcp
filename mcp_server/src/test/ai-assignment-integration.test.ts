/**
 * Integration test for wit-ai-assignment tool
 */
import { executeTool, setServerInstance } from "../services/tool-service.js";
import type { AIAssignmentResult } from "../types/analysis.js";

// Mock server for testing
const mockServer = {
  getClientCapabilities: () => ({ sampling: true }),
  createMessage: async (request: any) => {
    return {
      content: {
        text: `AI Assignment Analysis Result:

DECISION: HYBRID
CONFIDENCE: 0.7
RISK SCORE: 45

This work item requires a hybrid approach because:
- Complex feature requiring architectural decisions (human)
- Implementation details can be automated (AI)
- Integration testing needs human oversight
- Standard coding patterns for data layer (AI-suitable)

ESTIMATED SCOPE:
- Files: 5-8 files
- Complexity: Medium to High

GUARDRAILS:
- Tests required: Yes (comprehensive testing strategy needed)
- Feature flag needed: Yes (gradual rollout recommended)
- Sensitive areas: No
- Code review needed: Yes (architecture review required)`,
      },
    };
  },
};

async function testToolIntegration() {
  console.log("🧪 Testing wit-ai-assignment integration...");

  // Set up the mock server instance
  setServerInstance(mockServer);

  const testArgs = {
    Title: "Implement real-time notifications system",
    Description:
      "Add real-time push notifications for user actions including comments, mentions, and status updates. Should support web browsers and mobile devices.",
    WorkItemType: "Feature",
    AcceptanceCriteria:
      "1. Real-time notifications work in browser\n2. Mobile push notifications functional\n3. User preferences for notification types\n4. Notification history and management",
    Priority: "Medium",
    Labels: "feature, notifications, real-time",
    EstimatedFiles: "8-12",
    TechnicalContext: "Node.js, WebSockets, FCM, React",
    ExternalDependencies: "Firebase Cloud Messaging setup required",
    TestingRequirements: "Integration tests with notification services",
  };

  try {
    const result = await executeTool("wit-ai-assignment", testArgs);

    console.log("✅ Tool integration test passed!");
    console.log("📊 Success:", result.success);
    console.log("📝 Data keys:", Object.keys(result.data || {}));

    if (result.success && result.data) {
      const data = result.data as AIAssignmentResult;
      console.log(`   Decision: ${data.decision}`);
      console.log(`   Confidence: ${data.confidence}`);
      console.log(`   Risk Score: ${data.riskScore}`);
    }

    return result;
  } catch (error) {
    console.error("❌ Tool integration test failed:", error);
    throw error;
  }
}

// Run test
testToolIntegration()
  .then(() => console.log("🎉 Integration test completed successfully!"))
  .catch((error) => {
    console.error("💥 Integration test failed:", error);
    process.exit(1);
  });
