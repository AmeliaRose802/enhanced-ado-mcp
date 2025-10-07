/**
 * Benchmark Configuration
 * 
 * Shared configuration and utilities for performance benchmarks
 */

export interface BenchmarkThresholds {
  /** Maximum acceptable time in milliseconds */
  maxTime: number;
  /** Target time in milliseconds (what we aim for) */
  targetTime: number;
  /** Description of the operation */
  description: string;
}

/**
 * Performance thresholds for different operation types
 */
export const PERFORMANCE_THRESHOLDS = {
  // Query operations
  WIQL_SIMPLE: {
    maxTime: 2000,
    targetTime: 1000,
    description: 'Simple WIQL query (< 50 results)'
  },
  WIQL_COMPLEX: {
    maxTime: 5000,
    targetTime: 3000,
    description: 'Complex WIQL query (50-200 results)'
  },
  ODATA_SIMPLE: {
    maxTime: 2000,
    targetTime: 1000,
    description: 'Simple OData analytics query'
  },
  ODATA_AGGREGATION: {
    maxTime: 3000,
    targetTime: 2000,
    description: 'OData query with aggregations'
  },
  
  // Bulk operations
  BULK_UPDATE_SMALL: {
    maxTime: 5000,
    targetTime: 3000,
    description: 'Bulk update (10 items)'
  },
  BULK_UPDATE_MEDIUM: {
    maxTime: 15000,
    targetTime: 10000,
    description: 'Bulk update (50 items)'
  },
  BULK_ASSIGN_SMALL: {
    maxTime: 5000,
    targetTime: 3000,
    description: 'Bulk assign story points (10 items)'
  },
  
  // AI-powered tools
  AI_ANALYSIS_SINGLE: {
    maxTime: 10000,
    targetTime: 5000,
    description: 'Single work item AI analysis'
  },
  AI_BATCH_SMALL: {
    maxTime: 30000,
    targetTime: 20000,
    description: 'AI batch analysis (10 items)'
  },
  AI_ENHANCEMENT_SINGLE: {
    maxTime: 8000,
    targetTime: 5000,
    description: 'Single work item enhancement'
  },
  
  // Query handle operations
  QUERY_HANDLE_CREATE: {
    maxTime: 150,
    targetTime: 50,
    description: 'Create query handle'
  },
  QUERY_HANDLE_RETRIEVE: {
    maxTime: 10,
    targetTime: 5,
    description: 'Retrieve by query handle'
  },
  QUERY_HANDLE_SELECT_ALL: {
    maxTime: 10,
    targetTime: 5,
    description: 'Select all items from handle'
  },
  QUERY_HANDLE_SELECT_CRITERIA: {
    maxTime: 100,
    targetTime: 50,
    description: 'Select items by criteria (100 items)'
  },
  
  // Validation operations
  HIERARCHY_VALIDATE_FAST: {
    maxTime: 1000,
    targetTime: 500,
    description: 'Fast hierarchy validation (100 items)'
  }
} as const;

/**
 * Benchmark options
 */
export interface BenchmarkOptions {
  /** Number of iterations to run */
  iterations?: number;
  /** Warmup iterations before measuring */
  warmupIterations?: number;
  /** Time to run benchmark in milliseconds */
  time?: number;
  /** Whether to log results */
  verbose?: boolean;
}

export const DEFAULT_BENCHMARK_OPTIONS: BenchmarkOptions = {
  iterations: 10,
  warmupIterations: 2,
  time: 1000, // 1 second
  verbose: true
};

/**
 * Format benchmark results
 */
export function formatBenchmarkResult(
  name: string,
  avgTime: number,
  threshold: BenchmarkThresholds
): string {
  const status = avgTime <= threshold.targetTime 
    ? '✓ EXCELLENT' 
    : avgTime <= threshold.maxTime 
      ? '✓ ACCEPTABLE' 
      : '✗ SLOW';
  
  return `${status} | ${name}: ${avgTime.toFixed(2)}ms (target: ${threshold.targetTime}ms, max: ${threshold.maxTime}ms)`;
}

/**
 * Check if benchmark passed
 */
export function benchmarkPassed(avgTime: number, threshold: BenchmarkThresholds): boolean {
  return avgTime <= threshold.maxTime;
}

/**
 * Mock data generators for benchmarks
 */
export const MockData = {
  /**
   * Generate mock work items
   */
  generateWorkItems(count: number) {
    const workItems = [];
    for (let i = 0; i < count; i++) {
      workItems.push({
        id: 10000 + i,
        title: `Test Work Item ${i}`,
        state: i % 3 === 0 ? 'Active' : i % 3 === 1 ? 'New' : 'Resolved',
        type: i % 2 === 0 ? 'Task' : 'Bug',
        assignedTo: i % 5 === 0 ? undefined : `user${i % 5}@example.com`,
        tags: i % 2 === 0 ? ['tag1', 'tag2'] : ['tag3'],
        daysInactive: i % 10,
        lastChange: new Date(Date.now() - i * 86400000).toISOString(),
        fields: {
          'System.Id': 10000 + i,
          'System.Title': `Test Work Item ${i}`,
          'System.State': i % 3 === 0 ? 'Active' : i % 3 === 1 ? 'New' : 'Resolved',
          'System.WorkItemType': i % 2 === 0 ? 'Task' : 'Bug',
          'System.AssignedTo': i % 5 === 0 ? undefined : `user${i % 5}@example.com`,
          'System.Tags': i % 2 === 0 ? 'tag1; tag2' : 'tag3'
        }
      });
    }
    return workItems;
  },

  /**
   * Generate mock query handle
   */
  generateQueryHandle(): string {
    return `qh_${Math.random().toString(36).substring(2, 15)}`;
  },

  /**
   * Generate mock item context
   */
  generateItemContext(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      id: 10000 + i,
      title: `Test Item ${i}`,
      state: i % 3 === 0 ? 'Active' : i % 3 === 1 ? 'New' : 'Resolved',
      type: i % 2 === 0 ? 'Task' : 'Bug',
      daysInactive: i % 10,
      lastChange: new Date(Date.now() - i * 86400000).toISOString(),
      tags: i % 2 === 0 ? ['tag1', 'tag2'] : ['tag3']
    }));
  }
};
