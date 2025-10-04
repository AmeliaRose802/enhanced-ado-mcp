/**
 * Test for the WIQL query tool
 */

import { executeTool } from "../services/tool-service.js";
import { logger } from "../utils/logger.js";

async function testBasicWiqlQuery() {
  console.log("\n🧪 Testing basic WIQL query...");
  
  try {
    const result = await executeTool("wit-get-work-items-by-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC"
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

async function testPagination() {
  console.log("\n🧪 Testing WIQL pagination...");
  
  try {
    // Get first page with top=5
    const page1 = await executeTool("wit-get-work-items-by-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 5,
      skip: 0
    });
    
    if (!page1.success) {
      console.log("❌ First page query failed");
      console.log(`   Errors: ${page1.errors?.join(", ")}`);
      return false;
    }
    
    console.log("✅ First page query succeeded");
    console.log(`   Items in page: ${page1.data?.count}`);
    console.log(`   Total count: ${page1.data?.pagination?.totalCount}`);
    console.log(`   Has more: ${page1.data?.pagination?.hasMore}`);
    
    if (page1.data?.pagination?.hasMore) {
      // Get second page
      const page2 = await executeTool("wit-get-work-items-by-query-wiql", {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
        top: 5,
        skip: 5
      });
      
      if (!page2.success) {
        console.log("❌ Second page query failed");
        console.log(`   Errors: ${page2.errors?.join(", ")}`);
        return false;
      }
      
      console.log("✅ Second page query succeeded");
      console.log(`   Items in page: ${page2.data?.count}`);
      console.log(`   Skip: ${page2.data?.pagination?.skip}`);
      console.log(`   Has more: ${page2.data?.pagination?.hasMore}`);
      
      // Verify items are different
      const page1Ids = page1.data?.work_items?.map((item: any) => item.id) || [];
      const page2Ids = page2.data?.work_items?.map((item: any) => item.id) || [];
      const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
      
      if (overlap.length > 0) {
        console.log("❌ Pages have overlapping items");
        return false;
      }
      
      console.log("✅ Pages have no overlapping items");
    }
    
    return true;
  } catch (error) {
    console.log("❌ Exception during pagination test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Testing WIQL Query Tool Implementation  ");
  console.log("═══════════════════════════════════════════════════════");
  
  try {
    const basicPassed = await testBasicWiqlQuery();
    const paginationPassed = await testPagination();
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`Basic WIQL query:    ${basicPassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Pagination test:     ${paginationPassed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (basicPassed && paginationPassed) {
      console.log("\n🎉 All WIQL query tests passed!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests failed. Review the output above for details.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Test suite failed with exception:", error);
    process.exit(1);
  }
}
