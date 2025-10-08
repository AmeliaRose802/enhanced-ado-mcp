/**
 * Test for WIQL query filtering by missing description and acceptance criteria
 */

import { executeTool } from "../services/tool-service.js";

async function testFilterByMissingDescription() {
  console.log("\n🧪 Testing WIQL query with filterByMissingDescription...");

  try {
    const result = await executeTool("wit-query-wiql", {
      wiqlQuery:
        "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task', 'Bug')",
      top: 50,
      filterByMissingDescription: true,
      returnQueryHandle: true,
    });

    if (result.success) {
      console.log("✅ Filter by missing description succeeded");
      console.log(`   Work Items Found: ${result.data?.work_item_count}`);
      console.log(`   Query Handle: ${result.data?.query_handle}`);

      if (result.data?.work_items && result.data.work_items.length > 0) {
        console.log(`\n   Sample Items Without Description:`);
        const sampleItems = result.data.work_items.slice(0, 3);
        sampleItems.forEach((wi: any) => {
          console.log(`     - #${wi.id}: ${wi.title} (${wi.type})`);
          const desc = wi.additionalFields?.["System.Description"] || "";
          const descText = String(desc)
            .replace(/<[^>]*>/g, "")
            .trim();
          console.log(`       Description length: ${descText.length} chars`);
        });
      }

      if (result.warnings && result.warnings.length > 0) {
        console.log(`\n   Warnings:`);
        result.warnings.forEach((w) => console.log(`     - ${w}`));
      }
    } else {
      console.log("❌ Filter by missing description failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }

    return result.success;
  } catch (error) {
    console.log("❌ Exception during missing description filter test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testFilterByMissingAcceptanceCriteria() {
  console.log("\n🧪 Testing WIQL query with filterByMissingAcceptanceCriteria...");

  try {
    const result = await executeTool("wit-query-wiql", {
      wiqlQuery:
        "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Feature')",
      top: 50,
      filterByMissingAcceptanceCriteria: true,
      returnQueryHandle: true,
    });

    if (result.success) {
      console.log("✅ Filter by missing acceptance criteria succeeded");
      console.log(`   Work Items Found: ${result.data?.work_item_count}`);
      console.log(`   Query Handle: ${result.data?.query_handle}`);

      if (result.data?.work_items && result.data.work_items.length > 0) {
        console.log(`\n   Sample Items Without Acceptance Criteria:`);
        const sampleItems = result.data.work_items.slice(0, 3);
        sampleItems.forEach((wi: any) => {
          console.log(`     - #${wi.id}: ${wi.title} (${wi.type})`);
          const ac = wi.additionalFields?.["Microsoft.VSTS.Common.AcceptanceCriteria"] || "";
          const acText = String(ac)
            .replace(/<[^>]*>/g, "")
            .trim();
          console.log(`       Acceptance Criteria length: ${acText.length} chars`);
        });
      }
    } else {
      console.log("❌ Filter by missing acceptance criteria failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }

    return result.success;
  } catch (error) {
    console.log("❌ Exception during missing acceptance criteria filter test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testBothFilters() {
  console.log("\n🧪 Testing WIQL query with both filters combined...");

  try {
    const result = await executeTool("wit-query-wiql", {
      wiqlQuery:
        "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] = 'Product Backlog Item'",
      top: 50,
      filterByMissingDescription: true,
      filterByMissingAcceptanceCriteria: true,
      returnQueryHandle: true,
    });

    if (result.success) {
      console.log("✅ Combined filters succeeded");
      console.log(`   Work Items Found: ${result.data?.work_item_count}`);
      console.log(`   (Items missing BOTH description AND acceptance criteria)`);

      if (result.data?.work_items && result.data.work_items.length > 0) {
        console.log(`\n   Sample Incomplete Items:`);
        const sampleItems = result.data.work_items.slice(0, 3);
        sampleItems.forEach((wi: any) => {
          console.log(`     - #${wi.id}: ${wi.title}`);
        });
      } else {
        console.log(`   ✅ Great! No items found missing both fields`);
      }
    } else {
      console.log("❌ Combined filters failed");
      console.log(`   Errors: ${result.errors?.join(", ")}`);
    }

    return result.success;
  } catch (error) {
    console.log("❌ Exception during combined filters test:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testRegularQueryStillWorks() {
  console.log("\n🧪 Testing regular WIQL query (without missing filters)...");

  try {
    const result = await executeTool("wit-query-wiql", {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
      top: 10,
    });

    if (result.success) {
      console.log("✅ Regular WIQL query succeeded");
      console.log(`   Work Items Found: ${result.data?.work_item_count}`);
      console.log("✅ Verified: backward compatibility maintained");
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
  console.log("  Testing WIQL Missing Fields Filter Feature  ");
  console.log("═══════════════════════════════════════════════════════");

  try {
    const missingDescPassed = await testFilterByMissingDescription();
    const missingAcPassed = await testFilterByMissingAcceptanceCriteria();
    const bothFiltersPassed = await testBothFilters();
    const regularPassed = await testRegularQueryStillWorks();

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`Missing description filter:        ${missingDescPassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Missing acceptance criteria filter: ${missingAcPassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Combined filters:                   ${bothFiltersPassed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Regular query (backward compat):    ${regularPassed ? "✅ PASS" : "❌ FAIL"}`);

    if (missingDescPassed && missingAcPassed && bothFiltersPassed && regularPassed) {
      console.log("\n🎉 All missing fields filter tests passed!");
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
