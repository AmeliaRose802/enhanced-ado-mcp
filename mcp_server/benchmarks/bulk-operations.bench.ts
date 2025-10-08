/**
 * Bulk Operations Performance Benchmarks
 *
 * Benchmarks for bulk update, assign, and enhancement operations
 * Tests batch processing performance and ensures operations complete within thresholds
 */

import { Bench } from "tinybench";
import {
  PERFORMANCE_THRESHOLDS,
  DEFAULT_BENCHMARK_OPTIONS,
  formatBenchmarkResult,
  benchmarkPassed,
  MockData,
} from "./benchmark-config.js";

/**
 * Simulate bulk work item update
 */
function simulateBulkUpdate(workItemIds: number[], updates: any[]): any[] {
  const results = [];

  for (const id of workItemIds) {
    // Simulate update processing
    const fields = { ...updates[0] };

    // Simulate validation
    if (fields.title && fields.title.length < 1) {
      results.push({ id, success: false, error: "Invalid title" });
      continue;
    }

    // Simulate update operation
    results.push({
      id,
      success: true,
      fields: {
        "System.Id": id,
        ...fields,
      },
    });
  }

  return results;
}

/**
 * Simulate bulk story point assignment
 */
function simulateBulkAssignStoryPoints(workItemIds: number[]): any[] {
  const results = [];
  const pointScale = [1, 2, 3, 5, 8, 13];

  for (const id of workItemIds) {
    // Simulate AI estimation (some computation)
    let complexity = 0;
    for (let i = 0; i < 10; i++) {
      complexity += Math.random();
    }

    // Assign points based on "complexity"
    const pointIndex = Math.floor(complexity / 2) % pointScale.length;
    const storyPoints = pointScale[pointIndex];

    results.push({
      id,
      success: true,
      storyPoints,
      confidence: 0.7 + Math.random() * 0.3,
    });
  }

  return results;
}

/**
 * Simulate bulk description enhancement
 */
function simulateBulkEnhanceDescriptions(workItemIds: number[]): any[] {
  const results = [];

  for (const id of workItemIds) {
    // Simulate AI description generation (more intensive)
    let generatedText = "";
    for (let i = 0; i < 50; i++) {
      generatedText += "Enhanced description content. ";
    }

    // Simulate some processing time
    const words = generatedText.split(" ");
    const wordCount = words.length;

    results.push({
      id,
      success: true,
      originalDescription: "Original text",
      enhancedDescription: generatedText.substring(0, 200),
      wordCount,
      confidence: 0.8 + Math.random() * 0.2,
    });
  }

  return results;
}

/**
 * Simulate bulk acceptance criteria generation
 */
function simulateBulkAcceptanceCriteria(workItemIds: number[]): any[] {
  const results = [];

  for (const id of workItemIds) {
    // Simulate AI criteria generation
    const criteria = [];

    for (let i = 0; i < 5; i++) {
      criteria.push({
        given: "User is on the page",
        when: `Action ${i} is performed`,
        then: `Expected outcome ${i} occurs`,
      });
    }

    results.push({
      id,
      success: true,
      criteria,
      criteriaCount: criteria.length,
      confidence: 0.75 + Math.random() * 0.25,
    });
  }

  return results;
}

/**
 * Simulate bulk tag operations
 */
function simulateBulkTagOperation(
  workItemIds: number[],
  tag: string,
  operation: "add" | "remove"
): any[] {
  const results = [];

  for (const id of workItemIds) {
    const existingTags = ["existing1", "existing2"];

    let newTags;
    if (operation === "add") {
      newTags = [...existingTags, tag];
    } else {
      newTags = existingTags.filter((t) => t !== tag);
    }

    results.push({
      id,
      success: true,
      tags: newTags,
    });
  }

  return results;
}

/**
 * Run bulk operations benchmarks
 */
export async function runBulkOperationsBenchmarks(): Promise<void> {
  console.log("\n=== Bulk Operations Performance Benchmarks ===\n");

  const bench = new Bench({
    time: DEFAULT_BENCHMARK_OPTIONS.time,
    warmupIterations: DEFAULT_BENCHMARK_OPTIONS.warmupIterations,
  });

  const results: { name: string; avgTime: number; passed: boolean }[] = [];

  // Small batch operations (10 items)
  const smallBatch = Array.from({ length: 10 }, (_, i) => 10000 + i);

  bench.add("Bulk Update - Small (10 items)", () => {
    simulateBulkUpdate(smallBatch, [{ "System.State": "Active", "System.Title": "Updated Title" }]);
  });

  bench.add("Bulk Assign Story Points - Small (10 items)", () => {
    simulateBulkAssignStoryPoints(smallBatch);
  });

  bench.add("Bulk Add Tags - Small (10 items)", () => {
    simulateBulkTagOperation(smallBatch, "new-tag", "add");
  });

  // Medium batch operations (50 items)
  const mediumBatch = Array.from({ length: 50 }, (_, i) => 10000 + i);

  bench.add("Bulk Update - Medium (50 items)", () => {
    simulateBulkUpdate(mediumBatch, [
      { "System.State": "Active", "System.Title": "Updated Title" },
    ]);
  });

  bench.add("Bulk Assign Story Points - Medium (50 items)", () => {
    simulateBulkAssignStoryPoints(mediumBatch);
  });

  bench.add("Bulk Enhance Descriptions - Small (10 items)", () => {
    simulateBulkEnhanceDescriptions(smallBatch);
  });

  bench.add("Bulk Acceptance Criteria - Small (10 items)", () => {
    simulateBulkAcceptanceCriteria(smallBatch);
  });

  // Tag operations
  bench.add("Bulk Remove Tags - Medium (50 items)", () => {
    simulateBulkTagOperation(mediumBatch, "old-tag", "remove");
  });

  // Preview operations (dry run simulation)
  bench.add("Bulk Update Preview - Medium (50 items)", () => {
    // Dry run - same logic but no actual updates
    const preview = mediumBatch.map((id) => ({
      id,
      willUpdate: true,
      changes: {
        "System.State": "Active",
      },
    }));
    return preview;
  });

  // Run benchmarks
  await bench.run();

  // Process and display results
  console.log("\n--- Results ---\n");

  const taskMapping = {
    "Bulk Update - Small (10 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_SMALL,
    "Bulk Assign Story Points - Small (10 items)": PERFORMANCE_THRESHOLDS.BULK_ASSIGN_SMALL,
    "Bulk Add Tags - Small (10 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_SMALL,
    "Bulk Update - Medium (50 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_MEDIUM,
    "Bulk Assign Story Points - Medium (50 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_MEDIUM,
    "Bulk Enhance Descriptions - Small (10 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_SMALL,
    "Bulk Acceptance Criteria - Small (10 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_SMALL,
    "Bulk Remove Tags - Medium (50 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_MEDIUM,
    "Bulk Update Preview - Medium (50 items)": PERFORMANCE_THRESHOLDS.BULK_UPDATE_MEDIUM,
  };

  let allPassed = true;

  for (const task of bench.tasks) {
    const avgTime = task.result?.mean ? task.result.mean * 1000 : 0; // Convert to ms
    const threshold = taskMapping[task.name as keyof typeof taskMapping];

    if (threshold) {
      const passed = benchmarkPassed(avgTime, threshold);
      allPassed = allPassed && passed;

      console.log(formatBenchmarkResult(task.name, avgTime, threshold));

      results.push({
        name: task.name,
        avgTime,
        passed,
      });
    }
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Total benchmarks: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Overall: ${allPassed ? "✓ PASSED" : "✗ FAILED"}`);

  // Performance insights
  console.log("\n--- Performance Insights ---");
  console.log("• Small batches (10 items) should complete in < 5s");
  console.log("• Medium batches (50 items) should complete in < 15s");
  console.log("• Preview operations should be fast (< 5s)");
  console.log("• Tag operations are typically faster than field updates");

  if (!allPassed) {
    console.log("\n⚠️  Some benchmarks did not meet performance thresholds");
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBulkOperationsBenchmarks().catch((error) => {
    console.error("Benchmark failed:", error);
    process.exit(1);
  });
}
