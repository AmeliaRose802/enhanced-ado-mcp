/**
 * Test for the analyze-by-query-handle handler fix
 */

import { executeTool } from "../services/tool-service.js";
import { logger } from "../utils/logger.js";

async function testAnalyzeByQueryHandle() {
  console.log("\n🧪 Testing wit-analyze-by-query-handle fix...");
  
  try {
    // First, create a query handle by running a WIQL query
    console.log("Step 1: Creating query handle with WIQL query...");
    const wiqlResult = await executeTool("wit-get-work-items-by-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      returnQueryHandle: true,
      maxResults: 5
    });
    
    if (!wiqlResult.success) {
      console.log("❌ Failed to create query handle");
      console.log(`   Errors: ${wiqlResult.errors?.join(", ")}`);
      return false;
    }
    
    const queryHandle = wiqlResult.data?.query_handle;
    if (!queryHandle) {
      console.log("❌ No query handle returned from WIQL query");
      return false;
    }
    
    console.log(`✅ Query handle created: ${queryHandle}`);
    console.log(`   Work items in handle: ${wiqlResult.data?.work_item_count}`);
    
    // Now test the analyze-by-query-handle tool
    console.log("\nStep 2: Testing analyze-by-query-handle...");
    const result = await executeTool("wit-analyze-by-query-handle", {
      queryHandle: queryHandle,
      analysisType: ["effort", "completion", "assignments"]
    });
    
    if (result.success) {
      console.log("✅ wit-analyze-by-query-handle succeeded");
      console.log(`   Query Handle: ${result.data?.query_handle}`);
      console.log(`   Items Analyzed: ${result.data?.item_count}`);
      console.log(`   Analysis Types: ${result.data?.analysis_types?.join(", ")}`);
      
      // Show analysis results
      if (result.data?.results) {
        console.log("   Analysis Results:");
        if (result.data.results.effort) {
          console.log(`     - Effort: ${result.data.results.effort.total_items} items, ${result.data.results.effort.total_story_points} story points`);
        }
        if (result.data.results.completion) {
          console.log(`     - Completion: ${result.data.results.completion.completion_percentage}% complete`);
        }
        if (result.data.results.assignments) {
          console.log(`     - Assignments: ${result.data.results.assignments.assignment_coverage}% assigned`);
        }
      }
    } else {
      console.log("❌ wit-analyze-by-query-handle failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
      return false;
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during analyze-by-query-handle test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Testing Fix for wit-analyze-by-query-handle Tool  ");
  console.log("═══════════════════════════════════════════════════════");
  
  try {
    const testPassed = await testAnalyzeByQueryHandle();
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`wit-analyze-by-query-handle fix: ${testPassed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (testPassed) {
      console.log("\n🎉 Fix successful! The JSON parsing error has been resolved.");
      process.exit(0);
    } else {
      console.log("\n⚠️  Fix verification failed. Review the output above for details.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Test suite failed with exception:", error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}