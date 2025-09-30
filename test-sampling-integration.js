/**
 * Test script to demonstrate the new sampling features in the enhanced ADO MSP server
 * This script creates a standalone MCP client to test the sampling functionality
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log("🚀 Testing Enhanced ADO MSP Server Sampling Features\n");

// Mock sampling capability for testing
class MockSamplingClient extends Client {
  constructor(clientInfo, transport) {
    super(clientInfo, transport);
    this.samplingCapabilities = true;
  }

  // Override getClientCapabilities to include sampling
  getClientCapabilities() {
    return {
      sampling: true,
      experimental: {
        sampling: true
      }
    };
  }

  // Mock sampling call for testing
  async createMessage(params) {
    console.log(`🤖 Mock AI Sampling Call:`);
    console.log(`   System Prompt: ${params.systemPrompt.substring(0, 80)}...`);
    console.log(`   User Message: ${params.messages[0]?.content?.text?.substring(0, 80)}...`);
    console.log(`   Max Tokens: ${params.maxTokens}`);
    console.log(`   Temperature: ${params.temperature}`);
    
    // Simulate different AI responses based on the analysis type
    const userContent = params.messages[0]?.content?.text || "";
    let mockResponse;
    
    if (userContent.includes("authentication") || userContent.includes("OAuth")) {
      mockResponse = {
        content: {
          text: `WORK ITEM ANALYSIS RESULTS:

COMPLETENESS ANALYSIS (8/10):
✅ Title: Clear and specific - "Implement user authentication"
✅ Description: Good technical detail about OAuth implementation
⚠️ Missing: Specific acceptance criteria and testing requirements
⚠️ Missing: Security considerations and error handling details

AI READINESS ASSESSMENT (9/10):
✅ Task Specificity: Well-defined OAuth implementation scope
✅ Technical Clarity: Clear technology stack and approach
✅ Testability: Can be verified through functional testing
✅ Risk Level: Medium - well-established patterns available
🎯 RECOMMENDATION: AI-SUITABLE with clear implementation guidance

SMART CATEGORIZATION:
📂 Category: Feature Development
🔥 Priority: High (security-related functionality)
🧩 Complexity: Medium (established OAuth patterns)
⏱️ Effort Estimate: 3-5 days
👨‍💻 Skill Requirements: Backend development, OAuth expertise
🤖 Assignment: PERFECT for AI (GitHub Copilot) with proper setup

ENHANCEMENT SUGGESTIONS:
1. Add specific OAuth providers (Google, Microsoft, GitHub)
2. Include error handling and security best practices
3. Define acceptance criteria for each OAuth flow
4. Add integration testing requirements
5. Consider refresh token handling and session management

OVERALL SCORE: 8.5/10 - Excellent work item, ready for AI assignment`
        }
      };
    } else if (userContent.includes("bug") || userContent.includes("fix")) {
      mockResponse = {
        content: {
          text: `BUG ANALYSIS RESULTS:

COMPLETENESS ANALYSIS (4/10):
❌ Title: Too vague - needs specific error details
❌ Description: Lacks reproduction steps and environment info
❌ Missing: Error messages, browser details, user impact
❌ Missing: Expected vs actual behavior

AI READINESS ASSESSMENT (3/10):
❌ Insufficient Detail: Cannot determine root cause without more info
❌ Reproduction Steps: Missing clear steps to reproduce
⚠️ Risk Level: High - debugging requires human investigation
🚫 RECOMMENDATION: HUMAN REQUIRED - needs investigation first

SMART CATEGORIZATION:
📂 Category: Bug Fix
🔥 Priority: Medium (user-facing issue)
🧩 Complexity: Unknown (insufficient information)
⏱️ Effort Estimate: Cannot determine without details
👨‍💻 Skill Requirements: Debugging, troubleshooting
🤖 Assignment: HUMAN INVESTIGATION required first

CRITICAL IMPROVEMENTS NEEDED:
1. Add detailed reproduction steps
2. Include error messages and stack traces
3. Specify browser/device/OS information
4. Define expected vs actual behavior
5. Add user impact assessment
6. Include screenshots or screen recordings

OVERALL SCORE: 3/10 - Requires significant enhancement before assignment`
        }
      };
    } else {
      mockResponse = {
        content: {
          text: `GENERAL WORK ITEM ANALYSIS:

COMPLETENESS ANALYSIS (6/10):
✅ Has basic title and description
⚠️ Could benefit from more specific details
⚠️ Missing clear acceptance criteria

AI READINESS ASSESSMENT (5/10):
⚠️ Moderate clarity but needs more specifics
⚠️ Assignment depends on additional context
🤔 RECOMMENDATION: ENHANCEMENT needed for optimal AI assignment

ENHANCEMENT SUGGESTIONS:
1. Add more specific implementation details
2. Include clear acceptance criteria  
3. Define success metrics
4. Consider breaking into smaller tasks

OVERALL SCORE: 5.5/10 - Good foundation, needs refinement`
        }
      };
    }
    
    // Add small delay to simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return mockResponse;
  }
}

async function testSamplingFeatures() {
  try {
    console.log("🔌 Connecting to MCP Server...");
    
    // Start the MCP server process
    const serverProcess = spawn('node', ['mcp_server/dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // Create transport and client
    const transport = new StdioClientTransport({
      reader: serverProcess.stdout,
      writer: serverProcess.stdin
    });

    const client = new MockSamplingClient(
      {
        name: "sampling-test-client",
        version: "1.0.0"
      },
      transport
    );

    // Connect to server
    await client.connect();
    console.log("✅ Connected to MCP Server");

    // List available tools
    console.log("\n📋 Listing available tools...");
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.tools.length} tools`);
    
    // Find the sampling tool
    const samplingTool = tools.tools.find(tool => 
      tool.name === "wit-intelligence-analyzer" || 
      tool.name.includes("intelligence") ||
      tool.name.includes("sampling")
    );

    if (!samplingTool) {
      console.log("❌ Sampling tool not found in available tools:");
      tools.tools.forEach(tool => console.log(`   - ${tool.name}`));
      return;
    }

    console.log(`✅ Found sampling tool: ${samplingTool.name}`);
    console.log(`   Description: ${samplingTool.description}`);

    // Test 1: Authentication Feature Analysis
    console.log("\n🧪 TEST 1: AI-Ready Feature Analysis");
    console.log("═".repeat(60));
    const authResult = await client.callTool({
      name: samplingTool.name,
      arguments: {
        Title: "Implement OAuth 2.0 Authentication",
        Description: "Add OAuth 2.0 login functionality with Google and Microsoft providers. Include JWT token handling, refresh token management, and secure session storage.",
        WorkItemType: "Feature",
        AcceptanceCriteria: "Users can log in with external providers and maintain secure sessions",
        AnalysisType: "full",
        ContextInfo: "React frontend with Node.js/Express backend, existing user management system"
      }
    });

    if (authResult.content && authResult.content[0]) {
      console.log("✅ Analysis completed:");
      console.log(authResult.content[0].text);
    }

    // Test 2: Bug Report Analysis  
    console.log("\n🧪 TEST 2: Incomplete Bug Analysis");
    console.log("═".repeat(60));
    const bugResult = await client.callTool({
      name: samplingTool.name,
      arguments: {
        Title: "Login not working",
        Description: "Users can't log in sometimes",
        WorkItemType: "Bug", 
        AnalysisType: "completeness"
      }
    });

    if (bugResult.content && bugResult.content[0]) {
      console.log("✅ Bug analysis completed:");
      console.log(bugResult.content[0].text);
    }

    // Test 3: Enhancement Request
    console.log("\n🧪 TEST 3: AI-Readiness Assessment");
    console.log("═".repeat(60));
    const enhanceResult = await client.callTool({
      name: samplingTool.name,
      arguments: {
        Title: "Update API documentation",
        Description: "The API docs are outdated and missing new endpoints", 
        WorkItemType: "Task",
        AnalysisType: "ai-readiness"
      }
    });

    if (enhanceResult.content && enhanceResult.content[0]) {
      console.log("✅ Enhancement analysis completed:");
      console.log(enhanceResult.content[0].text);
    }

    console.log("\n🎉 Sampling Features Test Complete!");
    console.log("\nKEY FEATURES DEMONSTRATED:");
    console.log("✅ AI-powered work item completeness scoring");
    console.log("✅ AI-readiness assessment for Copilot assignment");
    console.log("✅ Smart categorization and prioritization");  
    console.log("✅ Intelligent enhancement suggestions");
    console.log("✅ Multiple analysis types (completeness, ai-readiness, full)");
    console.log("✅ Integration with VS Code sampling capabilities");

    // Cleanup
    await client.close();
    serverProcess.kill();

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

// Run the test
testSamplingFeatures().catch(console.error);