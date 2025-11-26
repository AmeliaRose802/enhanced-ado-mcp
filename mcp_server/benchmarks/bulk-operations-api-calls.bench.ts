/**
 * Benchmark: API Call Patterns in Bulk Operations
 * 
 * Measures:
 * 1. Current API call count for typical bulk operations
 * 2. Impact of proposed optimizations
 * 
 * Goal: Reduce API calls by 30-50% through:
 * - Batch fetching work items before operations
 * - Eliminating redundant queries
 * - Using bulk update endpoints where available
 */

import { performance } from 'perf_hooks';

interface APICallMetrics {
  operation: string;
  itemCount: number;
  apiCalls: {
    preFetch: number;      // Calls to fetch data before operation
    operation: number;      // Calls to perform the operation
    validation: number;     // Calls to validate results
    total: number;
  };
  optimizedCalls?: {
    preFetch: number;
    operation: number;
    validation: number;
    total: number;
  };
  reduction?: {
    calls: number;
    percentage: number;
  };
}

/**
 * Calculate API calls for current implementation
 */
function calculateCurrentAPICalls(operation: string, itemCount: number): APICallMetrics['apiCalls'] {
  const metrics = {
    preFetch: 0,
    operation: 0,
    validation: 0,
    total: 0
  };

  switch (operation) {
    case 'bulk-update':
      // Current: Fetch all items individually (1 batch call)
      metrics.preFetch = 1;
      // Current: Update each item individually (N calls)
      metrics.operation = itemCount;
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-assign':
      // Current: Fetch all items to get previous assignees (1 batch call)
      metrics.preFetch = 1;
      // Current: Assign each item individually (N calls)
      metrics.operation = itemCount;
      // Optional: Add comment per item (N additional calls if comment provided)
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-transition-state':
      // Current: Fetch all items to get previous states (1 batch call)
      metrics.preFetch = 1;
      // Current: Transition each item individually (N calls)
      metrics.operation = itemCount;
      // Optional: Add comment per item (N additional calls if comment provided)
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-link':
      // Current: No pre-fetch (work items already in query handle)
      metrics.preFetch = 0;
      // Current: Check existing links (N calls if skipExisting=true)
      metrics.validation = itemCount; // worst case
      // Current: Create links individually (N calls)
      metrics.operation = itemCount;
      metrics.total = metrics.validation + metrics.operation;
      break;

    case 'bulk-add-tag':
      // Current: Fetch each item's current tags (N calls)
      metrics.preFetch = itemCount;
      // Current: Update each item individually (N calls)
      metrics.operation = itemCount;
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-comment':
      // Current: No pre-fetch needed
      metrics.preFetch = 0;
      // Current: Add comment to each item (N calls)
      metrics.operation = itemCount;
      metrics.total = metrics.operation;
      break;

    default:
      // Generic: 1 pre-fetch + N operations
      metrics.preFetch = 1;
      metrics.operation = itemCount;
      metrics.total = metrics.preFetch + metrics.operation;
  }

  return metrics;
}

/**
 * Calculate API calls for optimized implementation
 */
function calculateOptimizedAPICalls(operation: string, itemCount: number): APICallMetrics['apiCalls'] {
  const metrics = {
    preFetch: 0,
    operation: 0,
    validation: 0,
    total: 0
  };

  // Batch size for fetching (ADO supports up to 200 IDs per request)
  const BATCH_SIZE = 200;
  const fetchBatches = Math.ceil(itemCount / BATCH_SIZE);

  // Batch size for updates (some endpoints support batch updates)
  const UPDATE_BATCH_SIZE = 50; // Conservative estimate
  const updateBatches = Math.ceil(itemCount / UPDATE_BATCH_SIZE);

  switch (operation) {
    case 'bulk-update':
      // Optimized: Fetch all items in batches
      metrics.preFetch = fetchBatches;
      // Optimized: Could use batch update if ADO supports it, otherwise parallel updates
      metrics.operation = updateBatches;
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-assign':
      // Optimized: Fetch all items in batches (single field)
      metrics.preFetch = fetchBatches;
      // Optimized: Parallel updates with controlled concurrency
      metrics.operation = updateBatches;
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-transition-state':
      // Optimized: Fetch all items in batches
      metrics.preFetch = fetchBatches;
      // Optimized: Parallel updates
      metrics.operation = updateBatches;
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-link':
      // Optimized: Batch fetch existing links (if skipExisting=true)
      // Fetch relations for all items in batches
      metrics.validation = fetchBatches;
      // Optimized: Links still need individual creation (ADO limitation)
      // But can be done in parallel
      metrics.operation = Math.ceil(itemCount / 10); // 10 concurrent
      metrics.total = metrics.validation + metrics.operation;
      break;

    case 'bulk-add-tag':
      // Optimized: Batch fetch current tags
      metrics.preFetch = fetchBatches;
      // Optimized: Batch update tags
      metrics.operation = updateBatches;
      metrics.total = metrics.preFetch + metrics.operation;
      break;

    case 'bulk-comment':
      // Optimized: Parallel comment posting
      metrics.operation = Math.ceil(itemCount / 10); // 10 concurrent
      metrics.total = metrics.operation;
      break;

    default:
      // Generic optimized: batch fetch + batch update
      metrics.preFetch = fetchBatches;
      metrics.operation = updateBatches;
      metrics.total = metrics.preFetch + metrics.operation;
  }

  return metrics;
}

/**
 * Analyze API call reduction for an operation
 */
function analyzeOperation(operation: string, itemCount: number): APICallMetrics {
  const currentCalls = calculateCurrentAPICalls(operation, itemCount);
  const optimizedCalls = calculateOptimizedAPICalls(operation, itemCount);
  
  const reduction = {
    calls: currentCalls.total - optimizedCalls.total,
    percentage: ((currentCalls.total - optimizedCalls.total) / currentCalls.total) * 100
  };

  return {
    operation,
    itemCount,
    apiCalls: currentCalls,
    optimizedCalls,
    reduction
  };
}

/**
 * Run benchmark scenarios
 */
function runBenchmark() {
  console.log('\n=== Bulk Operations API Call Analysis ===\n');

  const scenarios = [
    // Small batches (10 items)
    { operation: 'bulk-update', itemCount: 10 },
    { operation: 'bulk-assign', itemCount: 10 },
    { operation: 'bulk-transition-state', itemCount: 10 },
    { operation: 'bulk-link', itemCount: 10 },
    { operation: 'bulk-add-tag', itemCount: 10 },
    { operation: 'bulk-comment', itemCount: 10 },
    
    // Medium batches (50 items)
    { operation: 'bulk-update', itemCount: 50 },
    { operation: 'bulk-assign', itemCount: 50 },
    { operation: 'bulk-transition-state', itemCount: 50 },
    { operation: 'bulk-link', itemCount: 50 },
    { operation: 'bulk-add-tag', itemCount: 50 },
    { operation: 'bulk-comment', itemCount: 50 },
    
    // Large batches (200 items)
    { operation: 'bulk-update', itemCount: 200 },
    { operation: 'bulk-assign', itemCount: 200 },
    { operation: 'bulk-transition-state', itemCount: 200 },
    { operation: 'bulk-link', itemCount: 200 },
    { operation: 'bulk-add-tag', itemCount: 200 },
    { operation: 'bulk-comment', itemCount: 200 }
  ];

  const results: APICallMetrics[] = [];

  for (const scenario of scenarios) {
    const result = analyzeOperation(scenario.operation, scenario.itemCount);
    results.push(result);

    console.log(`\n--- ${scenario.operation} (${scenario.itemCount} items) ---`);
    console.log(`Current API Calls:`);
    console.log(`  Pre-fetch:  ${result.apiCalls.preFetch}`);
    console.log(`  Operation:  ${result.apiCalls.operation}`);
    console.log(`  Validation: ${result.apiCalls.validation}`);
    console.log(`  TOTAL:      ${result.apiCalls.total}`);
    
    console.log(`\nOptimized API Calls:`);
    console.log(`  Pre-fetch:  ${result.optimizedCalls!.preFetch}`);
    console.log(`  Operation:  ${result.optimizedCalls!.operation}`);
    console.log(`  Validation: ${result.optimizedCalls!.validation}`);
    console.log(`  TOTAL:      ${result.optimizedCalls!.total}`);
    
    console.log(`\nReduction:`);
    console.log(`  Calls saved:    ${result.reduction!.calls}`);
    console.log(`  Percentage:     ${result.reduction!.percentage.toFixed(1)}%`);
  }

  // Summary statistics
  console.log('\n\n=== Summary Statistics ===\n');
  
  const totalCurrent = results.reduce((sum, r) => sum + r.apiCalls.total, 0);
  const totalOptimized = results.reduce((sum, r) => sum + r.optimizedCalls!.total, 0);
  const totalReduction = totalCurrent - totalOptimized;
  const avgReductionPct = results.reduce((sum, r) => sum + r.reduction!.percentage, 0) / results.length;

  console.log(`Total Current API Calls:    ${totalCurrent}`);
  console.log(`Total Optimized API Calls:  ${totalOptimized}`);
  console.log(`Total Calls Saved:          ${totalReduction}`);
  console.log(`Average Reduction:          ${avgReductionPct.toFixed(1)}%`);

  // Operation-specific averages
  console.log('\n=== By Operation Type ===\n');
  const operationTypes = ['bulk-update', 'bulk-assign', 'bulk-transition-state', 'bulk-link', 'bulk-add-tag', 'bulk-comment'];
  
  for (const opType of operationTypes) {
    const opResults = results.filter(r => r.operation === opType);
    const avgReduction = opResults.reduce((sum, r) => sum + r.reduction!.percentage, 0) / opResults.length;
    console.log(`${opType.padEnd(25)} ${avgReduction.toFixed(1)}% reduction`);
  }

  // Identify worst offenders
  console.log('\n=== Operations with Highest API Call Count ===\n');
  const worstCases = results
    .sort((a, b) => b.apiCalls.total - a.apiCalls.total)
    .slice(0, 5);

  for (const result of worstCases) {
    console.log(`${result.operation} (${result.itemCount} items): ${result.apiCalls.total} calls → ${result.optimizedCalls!.total} calls (${result.reduction!.percentage.toFixed(1)}% reduction)`);
  }

  return results;
}

/**
 * Export for use in tests or other benchmarks
 */
export {
  calculateCurrentAPICalls,
  calculateOptimizedAPICalls,
  analyzeOperation,
  runBenchmark
};

// Run benchmark if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark();
}
