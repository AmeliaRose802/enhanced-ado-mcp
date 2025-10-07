/**
 * Test for the WIQL query tool with fetchFullPackages flag
 */

import { executeTool } from "../services/tool-service.js";

async function testFetchFullPackages() {
  console.log("\n🧪 Testing WIQL query with fetchFullPackages...");
  
  try {
    const result = await executeTool("wit-get-work-items-by-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 3, // Limit to 3 items to minimize API calls
      fetchFullPackages: true,
      returnQueryHandle: true
    });
    
    if (result.success) {
      console.log("✅ WIQL query with fetchFullPackages succeeded");
      console.log(`   Work Items Found: ${result.data?.work_item_count}`);
      console.log(`   Query Handle: ${result.data?.query_handle}`);
      console.log(`   Full Packages Included: ${result.data?.fullPackagesIncluded}`);
      console.log(`   Full Packages Count: ${result.data?.fullPackagesCount}`);
      
      if (result.data?.full_packages && result.data.full_packages.length > 0) {
        const pkg = result.data.full_packages[0];
        console.log(`\n   First Package Details:`);
        console.log(`     - ID: #${pkg.id}`);
        console.log(`     - Title: ${pkg.title}`);
        console.log(`     - Type: ${pkg.type}`);
        console.log(`     - State: ${pkg.state}`);
        console.log(`     - Has Description: ${!!pkg.description}`);
        console.log(`     - Comments Count: ${pkg.comments?.length || 0}`);
        console.log(`     - History Count: ${pkg.history?.length || 0}`);
        console.log(`     - Children Count: ${pkg.children?.length || 0}`);
        console.log(`     - Has Parent: ${!!pkg.parent}`);
        console.log(`     - Related Count: ${pkg.related?.length || 0}`);
      }
      
      if (result.warnings && result.warnings.length > 0) {
        console.log(`\n   Warnings:`);
        result.warnings.forEach(w => console.log(`     - ${w}`));
      }
    } else {
      console.log("❌ WIQL query with fetchFullPackages failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during fetchFullPackages test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testFetchFullPackagesWithoutHandle() {
  console.log("\n🧪 Testing WIQL query with fetchFullPackages (no handle)...");
  
  try {
    const result = await executeTool("wit-get-work-items-by-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 2, // Limit to 2 items
      fetchFullPackages: true,
      returnQueryHandle: false // Test without query handle
    });
    
    if (result.success) {
      console.log("✅ WIQL query with fetchFullPackages (no handle) succeeded");
      console.log(`   Work Items Found: ${result.data?.count}`);
      console.log(`   Full Packages Included: ${result.data?.fullPackagesIncluded}`);
      console.log(`   Full Packages Count: ${result.data?.fullPackagesCount}`);
      
      if (result.data?.full_packages && result.data.full_packages.length > 0) {
        console.log(`   First Package ID: #${result.data.full_packages[0].id}`);
      }
    } else {
      console.log("❌ WIQL query with fetchFullPackages (no handle) failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during fetchFullPackages (no handle) test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testRegularQueryStillWorks() {
  console.log("\n🧪 Testing regular WIQL query (without fetchFullPackages)...");
  
  try {
    const result = await executeTool("wit-get-work-items-by-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 5
    });
    
    if (result.success) {
      console.log("✅ Regular WIQL query succeeded");
      console.log(`   Work Items Found: ${result.data?.work_item_count}`);
      console.log(`   Full Packages Included: ${result.data?.fullPackagesIncluded || false}`);
      
      // Verify full_packages is NOT present
      if (result.data?.full_packages) {
        console.log("❌ Unexpected: full_packages present when fetchFullPackages=false");
        return false;
      }
      
      console.log("✅ Verified: full_packages not included (as expected)");
    } else {
      console.log("❌ Regular WIQL query failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during regular query test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Testing WIQL Query with fetchFullPackages Feature  ");
  console.log("═══════════════════════════════════════════════════════");
  
  try {
    const withHandlePassed = await testFetchFullPackages();
    const withoutHandlePassed = await testFetchFullPackagesWithoutHandle();
    const regularPassed = await testRegularQueryStillWorks();
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`fetchFullPackages with handle:    ${withHandlePassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`fetchFullPackages without handle: ${withoutHandlePassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Regular query (backward compat):  ${regularPassed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (withHandlePassed && withoutHandlePassed && regularPassed) {
      console.log("\n🎉 All fetchFullPackages tests passed!");
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
