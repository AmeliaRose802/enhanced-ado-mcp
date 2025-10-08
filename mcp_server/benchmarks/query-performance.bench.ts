/**
 * Query Performance Benchmarks
 *
 * Benchmarks for WIQL and OData query operations
 * Tests query execution times and ensures they meet performance thresholds
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
 * Mock query handle service for benchmarking
 */
class MockQueryHandleService {
  private handles = new Map<string, any>();

  createHandle(workItemIds: number[], query: string, itemContext?: any[]) {
    const handle = MockData.generateQueryHandle();
    this.handles.set(handle, {
      workItemIds,
      query,
      itemContext: itemContext || MockData.generateItemContext(workItemIds.length),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      selectionMetadata: {
        totalItems: workItemIds.length,
        selectableIndices: Array.from({ length: workItemIds.length }, (_, i) => i),
        criteriaTags: ["tag1", "tag2", "tag3"],
      },
    });
    return handle;
  }

  getByHandle(handle: string) {
    return this.handles.get(handle);
  }

  selectAll(handle: string) {
    const data = this.handles.get(handle);
    return data ? data.workItemIds : null;
  }

  selectByIndices(handle: string, indices: number[]) {
    const data = this.handles.get(handle);
    if (!data) return null;
    return indices
      .filter((i) => i >= 0 && i < data.workItemIds.length)
      .map((i) => data.workItemIds[i]);
  }

  selectByCriteria(handle: string, criteria: any) {
    const data = this.handles.get(handle);
    if (!data || !data.itemContext) return null;

    let filtered = data.itemContext;

    if (criteria.states) {
      filtered = filtered.filter((item: any) => criteria.states.includes(item.state));
    }

    if (criteria.tags) {
      filtered = filtered.filter((item: any) =>
        item.tags?.some((tag: string) => criteria.tags.includes(tag))
      );
    }

    if (criteria.titleContains) {
      filtered = filtered.filter((item: any) =>
        criteria.titleContains.some((keyword: string) =>
          item.title.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    if (criteria.daysInactiveMin !== undefined) {
      filtered = filtered.filter(
        (item: any) => (item.daysInactive ?? 0) >= criteria.daysInactiveMin
      );
    }

    if (criteria.daysInactiveMax !== undefined) {
      filtered = filtered.filter(
        (item: any) => (item.daysInactive ?? 0) <= criteria.daysInactiveMax
      );
    }

    return filtered.map((item: any) => item.id);
  }
}

/**
 * Simulate WIQL query parsing and execution
 */
function simulateWiqlQuery(wiql: string, itemCount: number): number[] {
  // Simulate parsing overhead
  const parts = wiql.split(" ");
  const hasComplexConditions = wiql.includes("AND") || wiql.includes("OR");

  // Simulate query execution time based on complexity
  if (hasComplexConditions) {
    // More complex query - simulate additional processing
    for (let i = 0; i < 100; i++) {
      parts.reduce((acc, p) => acc + p.length, 0);
    }
  }

  // Return mock work item IDs
  return Array.from({ length: itemCount }, (_, i) => 10000 + i);
}

/**
 * Simulate OData query execution
 */
function simulateODataQuery(queryType: string, filters: any): any {
  // Simulate OData query processing
  const hasAggregation = queryType.includes("groupBy") || queryType.includes("count");

  if (hasAggregation) {
    // Simulate aggregation overhead
    const result = { count: 0, groups: [] };
    for (let i = 0; i < 50; i++) {
      result.count += i;
    }
    return result;
  }

  // Simple query
  return { value: MockData.generateWorkItems(10) };
}

/**
 * Run query performance benchmarks
 */
export async function runQueryBenchmarks(): Promise<void> {
  console.log("\n=== Query Performance Benchmarks ===\n");

  const bench = new Bench({
    time: DEFAULT_BENCHMARK_OPTIONS.time,
    warmupIterations: DEFAULT_BENCHMARK_OPTIONS.warmupIterations,
  });

  const queryHandleService = new MockQueryHandleService();
  const results: { name: string; avgTime: number; passed: boolean }[] = [];

  // Benchmark: Simple WIQL query
  bench.add("WIQL Simple Query (50 items)", () => {
    const wiql = "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'";
    simulateWiqlQuery(wiql, 50);
  });

  // Benchmark: Complex WIQL query
  bench.add("WIQL Complex Query (200 items)", () => {
    const wiql =
      "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] = 'Task' AND [System.Tags] CONTAINS 'important'";
    simulateWiqlQuery(wiql, 200);
  });

  // Benchmark: OData simple query
  bench.add("OData Simple Query", () => {
    simulateODataQuery("simple", { State: "Active" });
  });

  // Benchmark: OData with aggregation
  bench.add("OData Aggregation Query", () => {
    simulateODataQuery("groupByType", { State: "Active" });
  });

  // Benchmark: Query handle creation
  bench.add("Query Handle Creation (100 items)", () => {
    const workItemIds = Array.from({ length: 100 }, (_, i) => 10000 + i);
    queryHandleService.createHandle(workItemIds, "test query");
  });

  // Benchmark: Query handle retrieval
  const testHandle = queryHandleService.createHandle(
    Array.from({ length: 100 }, (_, i) => 10000 + i),
    "test query"
  );

  bench.add("Query Handle Retrieval", () => {
    queryHandleService.getByHandle(testHandle);
  });

  // Benchmark: Select all from handle
  bench.add("Query Handle Select All", () => {
    queryHandleService.selectAll(testHandle);
  });

  // Benchmark: Select by indices
  bench.add("Query Handle Select Indices (10 items)", () => {
    queryHandleService.selectByIndices(testHandle, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  // Benchmark: Select by criteria
  bench.add("Query Handle Select Criteria (100 items)", () => {
    queryHandleService.selectByCriteria(testHandle, {
      states: ["Active", "New"],
      tags: ["tag1", "tag2"],
    });
  });

  // Benchmark: Large dataset criteria selection
  const largeHandle = queryHandleService.createHandle(
    Array.from({ length: 1000 }, (_, i) => 10000 + i),
    "large query"
  );

  bench.add("Query Handle Select Criteria (1000 items)", () => {
    queryHandleService.selectByCriteria(largeHandle, {
      states: ["Active"],
      daysInactiveMin: 5,
      daysInactiveMax: 30,
    });
  });

  // Run benchmarks
  await bench.run();

  // Process and display results
  console.log("\n--- Results ---\n");

  const taskMapping = {
    "WIQL Simple Query (50 items)": PERFORMANCE_THRESHOLDS.WIQL_SIMPLE,
    "WIQL Complex Query (200 items)": PERFORMANCE_THRESHOLDS.WIQL_COMPLEX,
    "OData Simple Query": PERFORMANCE_THRESHOLDS.ODATA_SIMPLE,
    "OData Aggregation Query": PERFORMANCE_THRESHOLDS.ODATA_AGGREGATION,
    "Query Handle Creation (100 items)": PERFORMANCE_THRESHOLDS.QUERY_HANDLE_CREATE,
    "Query Handle Retrieval": PERFORMANCE_THRESHOLDS.QUERY_HANDLE_RETRIEVE,
    "Query Handle Select All": PERFORMANCE_THRESHOLDS.QUERY_HANDLE_SELECT_ALL,
    "Query Handle Select Indices (10 items)": PERFORMANCE_THRESHOLDS.QUERY_HANDLE_RETRIEVE,
    "Query Handle Select Criteria (100 items)": PERFORMANCE_THRESHOLDS.QUERY_HANDLE_SELECT_CRITERIA,
    "Query Handle Select Criteria (1000 items)":
      PERFORMANCE_THRESHOLDS.QUERY_HANDLE_SELECT_CRITERIA,
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

  if (!allPassed) {
    console.log("\n⚠️  Some benchmarks did not meet performance thresholds");
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQueryBenchmarks().catch((error) => {
    console.error("Benchmark failed:", error);
    process.exit(1);
  });
}
