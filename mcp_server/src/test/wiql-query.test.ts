/**
 * Test for the WIQL query tool
 */

import { executeTool } from "../services/tool-service.js";
import { logger } from "../utils/logger.js";

async function testBasicWiqlQuery() {
  console.log("\n🧪 Testing basic WIQL query...");
  
  try {
    const result = await executeTool("wit-query-wiql", {
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
    const page1 = await executeTool("wit-query-wiql", {
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
      const page2 = await executeTool("wit-query-wiql", {
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

async function testConditionalPagination() {
  console.log("\n🧪 Testing conditional pagination...");
  
  try {
    // Test 1: Query with single result (totalCount <= top) - should omit pagination
    console.log("\n  Test 1: Single-page result without includePaginationDetails");
    const singlePageResult = await executeTool("wit-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 200,
      skip: 0,
      returnQueryHandle: false
    });
    
    if (!singlePageResult.success) {
      console.log("❌ Single-page query failed");
      console.log(`   Errors: ${singlePageResult.errors?.join(", ")}`);
      return false;
    }
    
    const totalCount = singlePageResult.data?.count || 0;
    const top = 200;
    
    if (totalCount <= top) {
      // For single page results, pagination should be omitted
      if (singlePageResult.data?.pagination) {
        console.log("❌ Pagination should be omitted for single-page results");
        console.log(`   totalCount: ${totalCount}, top: ${top}`);
        return false;
      }
      console.log("✅ Pagination correctly omitted for single-page result");
      console.log(`   totalCount: ${totalCount}, top: ${top}`);
    } else {
      // For multi-page results, pagination should be included
      if (!singlePageResult.data?.pagination) {
        console.log("❌ Pagination should be included for multi-page results");
        console.log(`   totalCount: ${totalCount}, top: ${top}`);
        return false;
      }
      console.log("✅ Pagination correctly included for multi-page result");
      console.log(`   totalCount: ${totalCount}, top: ${top}`);
    }
    
    // Test 2: Query with includePaginationDetails=true - should always include pagination
    console.log("\n  Test 2: Result with includePaginationDetails=true");
    const forcedPaginationResult = await executeTool("wit-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 200,
      skip: 0,
      returnQueryHandle: false,
      includePaginationDetails: true
    });
    
    if (!forcedPaginationResult.success) {
      console.log("❌ Forced pagination query failed");
      console.log(`   Errors: ${forcedPaginationResult.errors?.join(", ")}`);
      return false;
    }
    
    if (!forcedPaginationResult.data?.pagination) {
      console.log("❌ Pagination should be included when includePaginationDetails=true");
      return false;
    }
    
    console.log("✅ Pagination correctly included with includePaginationDetails=true");
    console.log(`   skip: ${forcedPaginationResult.data.pagination.skip}`);
    console.log(`   top: ${forcedPaginationResult.data.pagination.top}`);
    console.log(`   totalCount: ${forcedPaginationResult.data.pagination.totalCount}`);
    console.log(`   hasMore: ${forcedPaginationResult.data.pagination.hasMore}`);
    
    // Test 3: Query with multi-page results - should include pagination
    console.log("\n  Test 3: Multi-page result (top=5)");
    const multiPageResult = await executeTool("wit-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 5,
      skip: 0,
      returnQueryHandle: false
    });
    
    if (!multiPageResult.success) {
      console.log("❌ Multi-page query failed");
      console.log(`   Errors: ${multiPageResult.errors?.join(", ")}`);
      return false;
    }
    
    const multiPageTotalCount = multiPageResult.data?.pagination?.totalCount || 0;
    const multiPageTop = 5;
    
    if (multiPageTotalCount > multiPageTop) {
      if (!multiPageResult.data?.pagination) {
        console.log("❌ Pagination should be included for multi-page results");
        return false;
      }
      console.log("✅ Pagination correctly included for multi-page result");
      console.log(`   totalCount: ${multiPageTotalCount}, top: ${multiPageTop}`);
      
      // Verify nextSkip is included when hasMore is true
      if (multiPageResult.data.pagination.hasMore && !multiPageResult.data.pagination.nextSkip) {
        console.log("❌ nextSkip should be included when hasMore=true");
        return false;
      }
      if (multiPageResult.data.pagination.hasMore) {
        console.log("✅ nextSkip correctly included when hasMore=true");
        console.log(`   nextSkip: ${multiPageResult.data.pagination.nextSkip}`);
      }
    } else {
      console.log("⚠️  Not enough items to test multi-page scenario");
    }
    
    return true;
  } catch (error) {
    console.log("❌ Exception during conditional pagination test:");
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
    const conditionalPaginationPassed = await testConditionalPagination();
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`Basic WIQL query:         ${basicPassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Pagination test:          ${paginationPassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Conditional pagination:   ${conditionalPaginationPassed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (basicPassed && paginationPassed && conditionalPaginationPassed) {
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

main();
