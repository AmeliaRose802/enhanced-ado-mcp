/**
 * Main Benchmark Runner
 *
 * Runs all performance benchmarks and generates a consolidated report
 */

import { runQueryBenchmarks } from "./query-performance.bench.js";
import { runBulkOperationsBenchmarks } from "./bulk-operations.bench.js";
import { runAIToolsBenchmarks } from "./ai-tools.bench.js";

async function runAllBenchmarks(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║   Enhanced ADO MCP Server - Performance Benchmarks            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Running comprehensive performance benchmarks...");
  console.log("This may take several minutes to complete.");
  console.log("");

  const startTime = Date.now();
  let allPassed = true;
  const results: { suite: string; passed: boolean; error?: string }[] = [];

  // Run Query Benchmarks
  try {
    console.log("\n[1/3] Running Query Performance Benchmarks...");
    await runQueryBenchmarks();
    results.push({ suite: "Query Performance", passed: true });
  } catch (error) {
    console.error("Query benchmarks failed:", error);
    results.push({
      suite: "Query Performance",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    allPassed = false;
  }

  // Run Bulk Operations Benchmarks
  try {
    console.log("\n[2/3] Running Bulk Operations Benchmarks...");
    await runBulkOperationsBenchmarks();
    results.push({ suite: "Bulk Operations", passed: true });
  } catch (error) {
    console.error("Bulk operations benchmarks failed:", error);
    results.push({
      suite: "Bulk Operations",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    allPassed = false;
  }

  // Run AI Tools Benchmarks
  try {
    console.log("\n[3/3] Running AI Tools Benchmarks...");
    await runAIToolsBenchmarks();
    results.push({ suite: "AI Tools", passed: true });
  } catch (error) {
    console.error("AI tools benchmarks failed:", error);
    results.push({
      suite: "AI Tools",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    allPassed = false;
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // Final Summary
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                    Benchmark Summary                           ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");

  for (const result of results) {
    const status = result.passed ? "✓ PASSED" : "✗ FAILED";
    console.log(`${status} | ${result.suite}`);
    if (result.error) {
      console.log(`         Error: ${result.error}`);
    }
  }

  console.log("");
  console.log(`Total time: ${totalTime}s`);
  console.log(`Suites run: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log("");
  console.log(`Overall Result: ${allPassed ? "✓ PASSED" : "✗ FAILED"}`);

  if (!allPassed) {
    console.log("");
    console.log("⚠️  Some benchmark suites failed to meet performance thresholds.");
    console.log("Review the output above for details on which benchmarks failed.");
    process.exit(1);
  }

  console.log("");
  console.log("✓ All benchmarks passed! Performance is within acceptable thresholds.");
}

// Run all benchmarks
runAllBenchmarks().catch((error) => {
  console.error("Benchmark runner failed:", error);
  process.exit(1);
});
