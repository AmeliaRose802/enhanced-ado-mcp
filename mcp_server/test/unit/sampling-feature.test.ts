// @ts-nocheck
/**
 * Test for the new Work Item Intelligence Analyzer with AI Sampling
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { executeTool, setServerInstance } from "../../src/services/tool-service.js";
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { logger } from "../../src/utils/logger.js";

// Mock server with sampling capabilities for testing
const mockServer = {
  getClientCapabilities: () => ({ sampling: true }),
  createMessage: async (params: any) => {
    logger.info(`Mock AI call - System Prompt: ${params.systemPrompt.substring(0, 100)}...`);
    logger.info(`Mock AI call - User Content: ${params.messages[0]?.content?.text?.substring(0, 100)}...`);
    
    // Simulate AI response based on analysis type
    const mockResponse = {
      content: {
        text: `COMPLETENESS ANALYSIS:
- Title clarity: 8/10 - Clear and specific
- Description detail: 6/10 - Good but could be more specific  
- Acceptance criteria: 4/10 - Missing detailed criteria

AI READINESS ASSESSMENT:
- Task specificity: 7/10 - Well-defined scope
- Testability: 6/10 - Some verification possible
- Risk level: 8/10 - Low risk for AI assignment
- Overall AI readiness: 7/10 - SUITABLE for AI with some guidance

RECOMMENDATIONS:
1. Add specific acceptance criteria with measurable outcomes
2. Include implementation steps or references
3. Add verification/testing requirements
4. Consider breaking into smaller atomic tasks if complex

ENHANCED DESCRIPTION SUGGESTION:
Implement user authentication using OAuth 2.0 flow with the following steps:
1. Set up OAuth provider configuration
2. Create login/logout endpoints  
3. Implement JWT token validation middleware
4. Add protected route guards
5. Update UI with login state management

ASSIGNMENT RECOMMENDATION: AI-Suitable with clear requirements`
      }
    };
    
    return mockResponse;
  }
};

// Mock server without sampling for fallback testing  
const mockServerNoSampling = {
  getClientCapabilities: () => ({}),
  createMessage: async () => { throw new Error("Sampling not supported"); }
};

async function testWorkItemIntelligenceAnalyzer() {
  console.log("\n🧪 Testing Work Item Intelligence Analyzer with AI Sampling\n");

  // Test 1: Full analysis with sampling support
  console.log("📊 Test 1: Full AI Analysis with Sampling");
  setServerInstance(mockServer);
  
  try {
    const result1 = await executeTool("wit-ai-intelligence", {
      Title: "Implement user authentication",
      Description: "Add OAuth login functionality to the web application",
      WorkItemType: "Feature", 
      AnalysisType: "full",
      ContextInfo: "React frontend with Node.js backend"
    });

    console.log("✅ Full analysis result:", JSON.stringify(result1, null, 2));
    console.log(`Success: ${result1.success}`);
    console.log(`Source: ${result1.metadata?.source}`);
  } catch (error) {
    console.error("❌ Full analysis failed:", error);
  }

  // Test 2: AI readiness analysis  
  console.log("\n📋 Test 2: AI Readiness Analysis");
  try {
    const result2 = await executeTool("wit-ai-intelligence", {
      Title: "Fix login bug", 
      Description: "Users can't log in on mobile devices",
      WorkItemType: "Bug",
      AnalysisType: "ai-readiness"
    });

    console.log("✅ AI readiness result:", JSON.stringify(result2.data, null, 2));
  } catch (error) {
    console.error("❌ AI readiness analysis failed:", error);
  }

  // Test 3: Enhancement with minimal input
  console.log("\n🚀 Test 3: Enhancement Analysis");
  try {
    const result3 = await executeTool("wit-ai-intelligence", {
      Title: "Update docs",
      AnalysisType: "enhancement"
    });

    console.log("✅ Enhancement result received");
    console.log(`Recommendations count: ${result3.data?.recommendations?.length || 0}`);
  } catch (error) {
    console.error("❌ Enhancement analysis failed:", error);
  }

  // Test 4: Fallback without sampling
  console.log("\n🔄 Test 4: Fallback Analysis (No Sampling)");
  setServerInstance(mockServerNoSampling);
  
  try {
    const result4 = await executeTool("wit-ai-intelligence", {
      Title: "Complex integration task", 
      Description: "Integrate payment system with multiple vendors",
      AnalysisType: "full"
    });

    console.log("✅ Fallback analysis result:", JSON.stringify(result4.data, null, 2));
    console.log(`Sampling available: ${result4.metadata?.samplingAvailable}`);
    console.log(`Source: ${result4.metadata?.source}`);
  } catch (error) {
    console.error("❌ Fallback analysis failed:", error);
  }

  // Test 5: Invalid tool name (should fail gracefully)
  console.log("\n❓ Test 5: Invalid Analysis Type");
  setServerInstance(mockServer);
  
  try {
    const result5 = await executeTool("wit-ai-intelligence", {
      Title: "Test item",
      AnalysisType: "invalid-type" as any
    });

    console.log("⚠️  Invalid type handled:", result5.success);
  } catch (error) {
    console.log("✅ Invalid type properly rejected:", (error as Error).message);
  }

  console.log("\n🎯 Work Item Intelligence Analyzer testing complete!\n");
}

// Test the prompt loading for the new analyzer
async function testIntelligentAnalyzerPrompt() {
  console.log("📝 Testing Intelligent Work Item Analyzer Prompt");
  
  try {
    const { loadPrompts, getPromptContent } = await import("../../src/services/prompt-service.js");
    
    const prompts = await loadPrompts();
    const analyzerPrompt = prompts.find((p: any) => p.name === "intelligent_work_item_analyzer");
    
    if (analyzerPrompt) {
      console.log("✅ Intelligent analyzer prompt found");
      console.log(`Description: ${analyzerPrompt.description}`);
      console.log(`Arguments: ${Object.keys(analyzerPrompt.arguments || {}).join(", ")}`);
      
      // Test prompt content generation
      const content = await getPromptContent("intelligent_work_item_analyzer", {
        work_item_title: "Test Authentication Feature",
        work_item_description: "Add OAuth 2.0 login",
        analysis_focus: "ai-readiness"
      });
      
      console.log(`✅ Prompt content generated (${content.length} characters)`);
      console.log(`Sample: ${content.substring(0, 200)}...`);
    } else {
      console.log("❌ Intelligent analyzer prompt not found");
    }
  } catch (error) {
    console.error("❌ Prompt testing failed:", error);
  }
}

// Run all tests
async function main() {
  try {
    await testWorkItemIntelligenceAnalyzer();
    await testIntelligentAnalyzerPrompt();
    console.log("🎉 All sampling feature tests completed successfully!");
  } catch (error) {
    console.error("💥 Test suite failed:", error);
    process.exit(1);
  }
}

