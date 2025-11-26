#!/usr/bin/env ts-node
/**
 * Telemetry Analysis Script
 * 
 * Analyzes exported telemetry data to identify:
 * - Performance bottlenecks
 * - API usage patterns
 * - Cache effectiveness
 * - Error hotspots
 * - Query handle usage
 * - Bulk operation efficiency
 * 
 * Usage:
 *   ts-node scripts/analyze-telemetry.ts <telemetry-file.json>
 *   npm run analyze-telemetry -- telemetry/telemetry-2025-11-18T10-30-00.json
 */

import fs from 'fs/promises';
import path from 'path';

interface TelemetryEvent {
  timestamp: string;
  category: 'tool' | 'api' | 'cache' | 'query-handle' | 'bulk-op' | 'ai' | 'error';
  operation: string;
  duration_ms?: number;
  api_calls?: number;
  cache_hits?: number;
  cache_misses?: number;
  error?: boolean;
  error_type?: string;
  metadata?: Record<string, unknown>;
}

interface TelemetryFile {
  exported_at: string;
  config: {
    enabled: boolean;
    period_start: string;
  };
  stats?: any;
  events: TelemetryEvent[];
}

interface AnalysisResult {
  summary: {
    total_events: number;
    date_range: { start: string; end: string };
    duration_hours: number;
  };
  performance: {
    slowest_operations: Array<{ operation: string; avg_ms: number; count: number; p95_ms: number }>;
    api_heavy_operations: Array<{ operation: string; avg_api_calls: number; count: number }>;
  };
  errors: {
    total_errors: number;
    error_rate: number;
    by_type: Record<string, number>;
    by_operation: Record<string, number>;
  };
  cache: {
    total_hits: number;
    total_misses: number;
    hit_rate: number;
    operations_by_hit_rate: Array<{ operation: string; hit_rate: number; total: number }>;
  };
  api_usage: {
    total_calls: number;
    calls_per_hour: number;
    by_endpoint: Record<string, { count: number; avg_duration_ms: number; error_count: number }>;
  };
  query_handles: {
    created: number;
    read: number;
    expired: number;
    avg_items_per_handle: number;
  };
  bulk_operations: {
    total: number;
    total_items_processed: number;
    avg_items_per_operation: number;
    by_action: Record<string, { count: number; total_items: number; avg_duration_ms: number }>;
  };
  ai_operations?: {
    total: number;
    success_rate: number;
    avg_duration_ms: number;
    by_operation: Record<string, { count: number; success_rate: number; avg_duration_ms: number }>;
  };
  recommendations: string[];
}

async function loadTelemetryFile(filepath: string): Promise<TelemetryFile> {
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function analyzeTelemetry(data: TelemetryFile): AnalysisResult {
  const events = data.events;
  
  if (events.length === 0) {
    throw new Error('No events in telemetry file');
  }

  // Time range
  const timestamps = events.map(e => new Date(e.timestamp).getTime());
  const startTime = Math.min(...timestamps);
  const endTime = Math.max(...timestamps);
  const durationHours = (endTime - startTime) / (1000 * 60 * 60);

  // Performance analysis
  const operationDurations = new Map<string, number[]>();
  const operationApiCalls = new Map<string, number[]>();
  
  for (const event of events) {
    if (event.duration_ms) {
      const durations = operationDurations.get(event.operation) || [];
      durations.push(event.duration_ms);
      operationDurations.set(event.operation, durations);
    }
    
    if (event.api_calls) {
      const calls = operationApiCalls.get(event.operation) || [];
      calls.push(event.api_calls);
      operationApiCalls.set(event.operation, calls);
    }
  }

  const slowestOperations = Array.from(operationDurations.entries())
    .map(([operation, durations]) => ({
      operation,
      avg_ms: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      count: durations.length,
      p95_ms: Math.round(calculatePercentile(durations, 95))
    }))
    .sort((a, b) => b.avg_ms - a.avg_ms)
    .slice(0, 10);

  const apiHeavyOperations = Array.from(operationApiCalls.entries())
    .map(([operation, calls]) => ({
      operation,
      avg_api_calls: Math.round((calls.reduce((a, b) => a + b, 0) / calls.length) * 10) / 10,
      count: calls.length
    }))
    .sort((a, b) => b.avg_api_calls - a.avg_api_calls)
    .slice(0, 10);

  // Error analysis
  const errorEvents = events.filter(e => e.error);
  const errorsByType = new Map<string, number>();
  const errorsByOperation = new Map<string, number>();
  
  for (const event of errorEvents) {
    if (event.error_type) {
      errorsByType.set(event.error_type, (errorsByType.get(event.error_type) || 0) + 1);
    }
    errorsByOperation.set(event.operation, (errorsByOperation.get(event.operation) || 0) + 1);
  }

  // Cache analysis
  let totalCacheHits = 0;
  let totalCacheMisses = 0;
  const cacheByOperation = new Map<string, { hits: number; misses: number }>();
  
  for (const event of events) {
    if (event.cache_hits || event.cache_misses) {
      totalCacheHits += event.cache_hits || 0;
      totalCacheMisses += event.cache_misses || 0;
      
      const stats = cacheByOperation.get(event.operation) || { hits: 0, misses: 0 };
      stats.hits += event.cache_hits || 0;
      stats.misses += event.cache_misses || 0;
      cacheByOperation.set(event.operation, stats);
    }
  }

  const operationsByHitRate = Array.from(cacheByOperation.entries())
    .map(([operation, stats]) => ({
      operation,
      hit_rate: (stats.hits / (stats.hits + stats.misses)) * 100,
      total: stats.hits + stats.misses
    }))
    .sort((a, b) => b.hit_rate - a.hit_rate);

  // API usage analysis
  const apiEvents = events.filter(e => e.category === 'api');
  const apiByEndpoint = new Map<string, { durations: number[]; errors: number }>();
  
  for (const event of apiEvents) {
    const endpoint = event.operation;
    const stats = apiByEndpoint.get(endpoint) || { durations: [], errors: 0 };
    if (event.duration_ms) stats.durations.push(event.duration_ms);
    if (event.error) stats.errors++;
    apiByEndpoint.set(endpoint, stats);
  }

  const apiByEndpointResult: Record<string, { count: number; avg_duration_ms: number; error_count: number }> = {};
  for (const [endpoint, stats] of apiByEndpoint) {
    apiByEndpointResult[endpoint] = {
      count: stats.durations.length,
      avg_duration_ms: Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length),
      error_count: stats.errors
    };
  }

  // Query handle analysis
  const queryHandleEvents = events.filter(e => e.category === 'query-handle');
  const qhCreated = queryHandleEvents.filter(e => e.operation === 'handle_create').length;
  const qhRead = queryHandleEvents.filter(e => e.operation === 'handle_read').length;
  const qhExpired = queryHandleEvents.filter(e => e.operation === 'handle_expire').length;
  
  const qhItemCounts = queryHandleEvents
    .filter(e => e.operation === 'handle_create' && e.metadata?.item_count)
    .map(e => Number(e.metadata?.item_count));
  const avgItemsPerHandle = qhItemCounts.length > 0
    ? Math.round(qhItemCounts.reduce((a, b) => a + b, 0) / qhItemCounts.length)
    : 0;

  // Bulk operations analysis
  const bulkEvents = events.filter(e => e.category === 'bulk-op');
  const bulkByAction = new Map<string, { durations: number[]; items: number[] }>();
  
  for (const event of bulkEvents) {
    const action = event.metadata?.bulk_action as string || event.operation;
    const stats = bulkByAction.get(action) || { durations: [], items: [] };
    if (event.duration_ms) stats.durations.push(event.duration_ms);
    if (event.metadata?.item_count) stats.items.push(Number(event.metadata.item_count));
    bulkByAction.set(action, stats);
  }

  const bulkByActionResult: Record<string, { count: number; total_items: number; avg_duration_ms: number }> = {};
  let totalBulkItems = 0;
  
  for (const [action, stats] of bulkByAction) {
    const totalItems = stats.items.reduce((a, b) => a + b, 0);
    totalBulkItems += totalItems;
    bulkByActionResult[action] = {
      count: stats.durations.length,
      total_items: totalItems,
      avg_duration_ms: stats.durations.length > 0
        ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
        : 0
    };
  }

  // AI operations analysis
  const aiEvents = events.filter(e => e.category === 'ai');
  let aiAnalysis: AnalysisResult['ai_operations'] | undefined;
  
  if (aiEvents.length > 0) {
    const aiByOperation = new Map<string, { durations: number[]; successes: number; total: number }>();
    
    for (const event of aiEvents) {
      const stats = aiByOperation.get(event.operation) || { durations: [], successes: 0, total: 0 };
      if (event.duration_ms) stats.durations.push(event.duration_ms);
      if (event.metadata?.success) stats.successes++;
      stats.total++;
      aiByOperation.set(event.operation, stats);
    }

    const aiByOperationResult: Record<string, { count: number; success_rate: number; avg_duration_ms: number }> = {};
    for (const [operation, stats] of aiByOperation) {
      aiByOperationResult[operation] = {
        count: stats.total,
        success_rate: (stats.successes / stats.total) * 100,
        avg_duration_ms: stats.durations.length > 0
          ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
          : 0
      };
    }

    const aiSuccesses = aiEvents.filter(e => e.metadata?.success).length;
    const aiDurations = aiEvents.filter(e => e.duration_ms).map(e => e.duration_ms!);
    
    aiAnalysis = {
      total: aiEvents.length,
      success_rate: (aiSuccesses / aiEvents.length) * 100,
      avg_duration_ms: aiDurations.length > 0
        ? Math.round(aiDurations.reduce((a, b) => a + b, 0) / aiDurations.length)
        : 0,
      by_operation: aiByOperationResult
    };
  }

  // Generate recommendations
  const recommendations: string[] = [];
  
  const errorRate = (errorEvents.length / events.length) * 100;
  if (errorRate > 5) {
    recommendations.push(`High error rate (${errorRate.toFixed(1)}%). Investigate error types and operations.`);
  }

  const cacheHitRate = totalCacheHits + totalCacheMisses > 0
    ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100
    : 0;
  if (cacheHitRate < 30) {
    recommendations.push(`Low cache hit rate (${cacheHitRate.toFixed(1)}%). Consider increasing TTL or cache size.`);
  } else if (cacheHitRate > 80) {
    recommendations.push(`Excellent cache hit rate (${cacheHitRate.toFixed(1)}%)!`);
  }

  if (slowestOperations.length > 0 && slowestOperations[0].avg_ms > 5000) {
    recommendations.push(`Slowest operation '${slowestOperations[0].operation}' averages ${slowestOperations[0].avg_ms}ms. Consider optimization.`);
  }

  if (apiHeavyOperations.length > 0 && apiHeavyOperations[0].avg_api_calls > 20) {
    recommendations.push(`Operation '${apiHeavyOperations[0].operation}' makes ${apiHeavyOperations[0].avg_api_calls} API calls on average. Consider batching.`);
  }

  const callsPerHour = apiEvents.length / durationHours;
  if (callsPerHour > 150) {
    recommendations.push(`High API usage rate (${Math.round(callsPerHour)} calls/hour). Close to rate limit threshold of 200/min.`);
  }

  if (qhExpired > qhCreated * 0.2) {
    recommendations.push(`${qhExpired} query handles expired (${((qhExpired / qhCreated) * 100).toFixed(1)}% of created). Consider longer TTL or faster workflows.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('No issues detected. Performance looks good!');
  }

  return {
    summary: {
      total_events: events.length,
      date_range: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString()
      },
      duration_hours: Math.round(durationHours * 100) / 100
    },
    performance: {
      slowest_operations: slowestOperations,
      api_heavy_operations: apiHeavyOperations
    },
    errors: {
      total_errors: errorEvents.length,
      error_rate: Math.round(errorRate * 100) / 100,
      by_type: Object.fromEntries(errorsByType),
      by_operation: Object.fromEntries(errorsByOperation)
    },
    cache: {
      total_hits: totalCacheHits,
      total_misses: totalCacheMisses,
      hit_rate: Math.round(cacheHitRate * 100) / 100,
      operations_by_hit_rate: operationsByHitRate
    },
    api_usage: {
      total_calls: apiEvents.length,
      calls_per_hour: Math.round(callsPerHour * 100) / 100,
      by_endpoint: apiByEndpointResult
    },
    query_handles: {
      created: qhCreated,
      read: qhRead,
      expired: qhExpired,
      avg_items_per_handle: avgItemsPerHandle
    },
    bulk_operations: {
      total: bulkEvents.length,
      total_items_processed: totalBulkItems,
      avg_items_per_operation: bulkEvents.length > 0
        ? Math.round(totalBulkItems / bulkEvents.length)
        : 0,
      by_action: bulkByActionResult
    },
    ai_operations: aiAnalysis,
    recommendations
  };
}

function printAnalysis(analysis: AnalysisResult): void {
  console.log('\n=== TELEMETRY ANALYSIS REPORT ===\n');
  
  console.log('📊 SUMMARY');
  console.log(`  Total Events: ${analysis.summary.total_events}`);
  console.log(`  Date Range: ${analysis.summary.date_range.start} to ${analysis.summary.date_range.end}`);
  console.log(`  Duration: ${analysis.summary.duration_hours} hours\n`);
  
  console.log('⚡ PERFORMANCE');
  console.log('  Slowest Operations:');
  for (const op of analysis.performance.slowest_operations.slice(0, 5)) {
    console.log(`    ${op.operation}: ${op.avg_ms}ms avg (p95: ${op.p95_ms}ms, count: ${op.count})`);
  }
  console.log('  API-Heavy Operations:');
  for (const op of analysis.performance.api_heavy_operations.slice(0, 5)) {
    console.log(`    ${op.operation}: ${op.avg_api_calls} API calls avg (count: ${op.count})`);
  }
  console.log();
  
  console.log('❌ ERRORS');
  console.log(`  Total Errors: ${analysis.errors.total_errors} (${analysis.errors.error_rate}%)`);
  if (Object.keys(analysis.errors.by_type).length > 0) {
    console.log('  By Type:');
    for (const [type, count] of Object.entries(analysis.errors.by_type)) {
      console.log(`    ${type}: ${count}`);
    }
  }
  console.log();
  
  console.log('💾 CACHE');
  console.log(`  Total Hits: ${analysis.cache.total_hits}`);
  console.log(`  Total Misses: ${analysis.cache.total_misses}`);
  console.log(`  Hit Rate: ${analysis.cache.hit_rate}%`);
  if (analysis.cache.operations_by_hit_rate.length > 0) {
    console.log('  Top Cache Users:');
    for (const op of analysis.cache.operations_by_hit_rate.slice(0, 5)) {
      console.log(`    ${op.operation}: ${op.hit_rate.toFixed(1)}% (${op.total} accesses)`);
    }
  }
  console.log();
  
  console.log('🌐 API USAGE');
  console.log(`  Total Calls: ${analysis.api_usage.total_calls}`);
  console.log(`  Rate: ${analysis.api_usage.calls_per_hour} calls/hour`);
  console.log();
  
  console.log('🔗 QUERY HANDLES');
  console.log(`  Created: ${analysis.query_handles.created}`);
  console.log(`  Read: ${analysis.query_handles.read}`);
  console.log(`  Expired: ${analysis.query_handles.expired}`);
  console.log(`  Avg Items per Handle: ${analysis.query_handles.avg_items_per_handle}`);
  console.log();
  
  console.log('📦 BULK OPERATIONS');
  console.log(`  Total Operations: ${analysis.bulk_operations.total}`);
  console.log(`  Total Items Processed: ${analysis.bulk_operations.total_items_processed}`);
  console.log(`  Avg Items per Operation: ${analysis.bulk_operations.avg_items_per_operation}`);
  if (Object.keys(analysis.bulk_operations.by_action).length > 0) {
    console.log('  By Action:');
    for (const [action, stats] of Object.entries(analysis.bulk_operations.by_action)) {
      console.log(`    ${action}: ${stats.count} ops, ${stats.total_items} items, ${stats.avg_duration_ms}ms avg`);
    }
  }
  console.log();
  
  if (analysis.ai_operations) {
    console.log('🤖 AI OPERATIONS');
    console.log(`  Total: ${analysis.ai_operations.total}`);
    console.log(`  Success Rate: ${analysis.ai_operations.success_rate.toFixed(1)}%`);
    console.log(`  Avg Duration: ${analysis.ai_operations.avg_duration_ms}ms`);
    console.log();
  }
  
  console.log('💡 RECOMMENDATIONS');
  for (const rec of analysis.recommendations) {
    console.log(`  • ${rec}`);
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: ts-node analyze-telemetry.ts <telemetry-file.json>');
    process.exit(1);
  }

  const filepath = args[0];
  
  try {
    console.log(`Loading telemetry data from ${filepath}...`);
    const data = await loadTelemetryFile(filepath);
    
    console.log(`Analyzing ${data.events.length} events...`);
    const analysis = analyzeTelemetry(data);
    
    printAnalysis(analysis);
    
    // Optionally export analysis
    if (args.includes('--export')) {
      const analysisPath = filepath.replace('.json', '-analysis.json');
      await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2));
      console.log(`\n✅ Analysis exported to ${analysisPath}`);
    }
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
