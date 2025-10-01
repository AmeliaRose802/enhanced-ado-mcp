/**
 * Test for the WIQL query tool
 */

import { executeTool } from "../services/tool-service.js";
import { logger } from "../utils/logger.js";

async function testBasicWiqlQuery() {
  console.log("\n🧪 Testing basic WIQL query...");
  
  try {
    const result = await executeTool("wit-get-work-items-by-query-wiql", {
      WiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC"
    });
    
    if (result.success) {
      console.log("✅ Basic WIQL query succeeded");
      console.log(`   Work Items Found: ${result.data?.count}`);
      console.log(`   Query: ${result.data?.query}`);
      console.log(`   Source: ${result.metadata?.source}`);
      
      if (result.data?.work_items && result.data.work_items.length > 0) {
        console.log(`   First Item: #${result.data.work_items[0].id} - ${result.data.work_items[0].title}`);
      }
    } else {
      console.log("❌ Basic WIQL query failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during basic WIQL query:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Testing WIQL Query Tool Implementation  ");
  console.log("═══════════════════════════════════════════════════════");
  
  try {
    const passed = await testBasicWiqlQuery();
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`Basic WIQL query:    ${passed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (passed) {
      console.log("\n🎉 WIQL query test passed!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Test failed. Review the output above for details.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Test suite failed with exception:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
