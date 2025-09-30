/**
 * Simple test to verify the sampling tool is working
 */

import { toolConfigs } from "../config/tool-configs.js";
import { executeTool, setServerInstance } from "../services/tool-service.js";

console.log("🧪 Testing Sampling Tool Registration and Basic Functionality\n");

// Test 1: Check if sampling tool is registered
console.log("1️⃣ Checking tool registration...");
const samplingTool = toolConfigs.find(t => t.name === "wit-intelligence-analyzer");
if (samplingTool) {
  console.log("✅ Sampling tool found:", samplingTool.name);
  console.log("   Description:", samplingTool.description);
} else {
  console.log("❌ Sampling tool not found in toolConfigs");
  process.exit(1);
}

// Test 2: Mock server for testing
console.log("\n2️⃣ Setting up mock server...");
const mockServer = {
  getClientCapabilities: () => ({ sampling: true }),
  createMessage: async (params: any) => {
    console.log("📡 Mock AI call received");
    return {
      content: {
        text: "Mock AI analysis: This work item looks good with score 8/10"
      }
    };
  }
};
setServerInstance(mockServer);
console.log("✅ Mock server configured");

// Test 3: Basic tool execution
console.log("\n3️⃣ Testing basic tool execution...");
try {
  const result = await executeTool("wit-intelligence-analyzer", {
    Title: "Test Work Item",
    AnalysisType: "completeness"
  });
  
  console.log("✅ Tool execution successful");
  console.log("   Success:", result.success);
  console.log("   Source:", result.metadata?.source);
  console.log("   Has data:", !!result.data);
} catch (error) {
  console.error("❌ Tool execution failed:", (error as Error).message);
}

console.log("\n🎉 Basic test completed!");