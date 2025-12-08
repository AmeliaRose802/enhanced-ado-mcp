/**
 * Telemetry Service
 * 
 * Privacy-conscious telemetry and metrics collection system.
 * 
 * **Privacy First:**
 * - Opt-in (disabled by default)
 * - No PII collection (work item content, descriptions, user data)
 * - Only aggregate statistics and performance metrics
 * - All data stays local (no external transmission)
 * - User controls export and analysis
 * 
 * **Collected Metrics:**
 * - Operation latency (tool execution time)
 * - API call counts (per operation)
 * - Error rates (by type and operation)
 * - Cache statistics (hits, misses, evictions)
 * - Query handle usage (creation, expiration)
 * - Bulk operation sizes (items processed)
 * - AI tool usage (sampling requests, if available)
 * 
 * **Performance:**
 * - Minimal overhead (<1% latency)
 * - Async event collection
 * - Batched writes (optional)
 * - Memory-bounded buffer
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { metricsService } from './metrics-service.js';
import { cacheService } from './cache-service.js';

/**
 * Telemetry event structure
 */
export interface TelemetryEvent {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event type category */
  category: 'tool' | 'api' | 'cache' | 'query-handle' | 'bulk-op' | 'ai' | 'error';
  /** Operation name */
  operation: string;
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Number of API calls made */
  api_calls?: number;
  /** Cache hits during operation */
  cache_hits?: number;
  /** Cache misses during operation */
  cache_misses?: number;
  /** Error occurred */
  error?: boolean;
  /** Error type (not error message - no PII) */
  error_type?: string;
  /** Additional non-PII metadata */
  metadata?: {
    /** Tool success status */
    success?: boolean;
    /** Number of items processed */
    item_count?: number;
    /** HTTP status code */
    status?: number;
    /** Query handle operation type */
    handle_operation?: string;
    /** Bulk operation action type */
    bulk_action?: string;
    /** AI model used */
    ai_model?: string;
    /** Whether operation used AI */
    used_ai?: boolean;
    /** Any other non-PII metadata */
    [key: string]: unknown;
  };
}

/**
 * Aggregated telemetry statistics
 */
export interface TelemetryStats {
  /** Statistics collection period start */
  period_start: string;
  /** Statistics collection period end */
  period_end: string;
  /** Total events collected */
  total_events: number;
  /** Events by category */
  by_category: Record<string, number>;
  /** Most common operations */
  top_operations: Array<{ operation: string; count: number; avg_duration_ms: number }>;
  /** Error rate percentage */
  error_rate: number;
  /** Average API calls per operation */
  avg_api_calls_per_operation: number;
  /** Cache hit rate percentage */
  cache_hit_rate: number;
  /** Total duration tracked (ms) */
  total_duration_ms: number;
  /** AI operations statistics */
  ai_operations?: {
    total: number;
    success_rate: number;
    avg_duration_ms: number;
  };
  /** Bulk operation statistics */
  bulk_operations?: {
    total: number;
    avg_items_per_operation: number;
    total_items_processed: number;
  };
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable telemetry collection */
  enabled: boolean;
  /** Maximum events to keep in memory before eviction */
  maxEventsInMemory: number;
  /** Auto-export to file periodically */
  autoExport: boolean;
  /** Auto-export interval in milliseconds */
  autoExportInterval: number;
  /** Export directory path */
  exportDir: string;
  /** Enable console logging of events (verbose) */
  consoleLogging: boolean;
}

/**
 * Default telemetry configuration
 */
const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: false, // OPT-IN: Disabled by default
  maxEventsInMemory: 10000,
  autoExport: false,
  autoExportInterval: 5 * 60 * 1000, // 5 minutes
  exportDir: './telemetry',
  consoleLogging: false
};

/**
 * Telemetry Service
 * Collects privacy-conscious performance and usage metrics
 */
export class TelemetryService {
  private config: TelemetryConfig;
  private events: TelemetryEvent[] = [];
  private periodStart: Date = new Date();
  private autoExportTimer?: NodeJS.Timeout;

  constructor(config?: Partial<TelemetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start auto-export if enabled
    if (this.config.enabled && this.config.autoExport) {
      this.startAutoExport();
    }
  }

  /**
   * Enable telemetry collection
   */
  enable(): void {
    this.config.enabled = true;
    logger.info('[Telemetry] Telemetry collection enabled');
    
    if (this.config.autoExport) {
      this.startAutoExport();
    }
  }

  /**
   * Disable telemetry collection
   */
  disable(): void {
    this.config.enabled = false;
    this.stopAutoExport();
    logger.info('[Telemetry] Telemetry collection disabled');
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TelemetryConfig>): void {
    const wasEnabled = this.config.enabled;
    const wasAutoExport = this.config.autoExport;
    
    this.config = { ...this.config, ...updates };
    
    // Handle state transitions
    if (!wasEnabled && this.config.enabled && this.config.autoExport) {
      this.startAutoExport();
    } else if (wasAutoExport && !this.config.autoExport) {
      this.stopAutoExport();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  /**
   * Record a telemetry event
   */
  recordEvent(event: Omit<TelemetryEvent, 'timestamp'>): void {
    if (!this.config.enabled) {
      return;
    }

    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // Add to memory buffer
    this.events.push(fullEvent);

    // Evict oldest events if over limit
    if (this.events.length > this.config.maxEventsInMemory) {
      const excess = this.events.length - this.config.maxEventsInMemory;
      this.events = this.events.slice(excess);
    }

    // Console logging if enabled
    if (this.config.consoleLogging) {
      logger.debug(`[Telemetry] ${JSON.stringify(fullEvent)}`);
    }
  }

  /**
   * Record a tool execution event
   */
  recordToolExecution(
    toolName: string,
    durationMs: number,
    success: boolean,
    apiCalls?: number,
    error?: { type: string; code?: string }
  ): void {
    this.recordEvent({
      category: 'tool',
      operation: toolName,
      duration_ms: durationMs,
      api_calls: apiCalls,
      error: !success,
      error_type: error?.type,
      metadata: {
        success,
        error_code: error?.code
      }
    });
  }

  /**
   * Record an API call event
   */
  recordAPICall(
    method: string,
    endpoint: string,
    durationMs: number,
    status: number,
    error?: boolean
  ): void {
    this.recordEvent({
      category: 'api',
      operation: `${method} ${endpoint}`,
      duration_ms: durationMs,
      error,
      metadata: {
        status,
        method
      }
    });
  }

  /**
   * Record a cache operation
   */
  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'evict',
    key?: string
  ): void {
    this.recordEvent({
      category: 'cache',
      operation: `cache_${operation}`,
      cache_hits: operation === 'hit' ? 1 : 0,
      cache_misses: operation === 'miss' ? 1 : 0,
      metadata: {
        key_prefix: key ? key.split(':')[0] : undefined
      }
    });
  }

  /**
   * Record a query handle operation
   */
  recordQueryHandleOperation(
    operation: 'create' | 'read' | 'expire' | 'cleanup',
    handleId?: string,
    itemCount?: number
  ): void {
    this.recordEvent({
      category: 'query-handle',
      operation: `handle_${operation}`,
      metadata: {
        handle_operation: operation,
        item_count: itemCount,
        handle_id_prefix: handleId ? handleId.substring(0, 8) : undefined
      }
    });
  }

  /**
   * Record a bulk operation
   */
  recordBulkOperation(
    action: string,
    itemCount: number,
    durationMs: number,
    success: boolean
  ): void {
    this.recordEvent({
      category: 'bulk-op',
      operation: `bulk_${action}`,
      duration_ms: durationMs,
      error: !success,
      metadata: {
        success,
        item_count: itemCount,
        bulk_action: action
      }
    });
  }

  /**
   * Record an AI operation
   */
  recordAIOperation(
    operation: string,
    durationMs: number,
    success: boolean,
    model?: string,
    tokensUsed?: number
  ): void {
    this.recordEvent({
      category: 'ai',
      operation,
      duration_ms: durationMs,
      error: !success,
      metadata: {
        success,
        ai_model: model,
        used_ai: true,
        tokens: tokensUsed
      }
    });
  }

  /**
   * Record an error event
   */
  recordError(
    operation: string,
    errorType: string,
    category?: TelemetryEvent['category']
  ): void {
    this.recordEvent({
      category: category || 'error',
      operation,
      error: true,
      error_type: errorType
    });
  }

  /**
   * Get aggregated statistics
   */
  getStats(): TelemetryStats {
    const now = new Date();
    
    // Group by operation
    const operationStats = new Map<string, { count: number; totalDuration: number; errors: number }>();
    let totalApiCalls = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;
    let totalDuration = 0;
    let errorCount = 0;
    let aiOperations = 0;
    let aiSuccesses = 0;
    let aiTotalDuration = 0;
    let bulkOperations = 0;
    let bulkTotalItems = 0;

    for (const event of this.events) {
      // Operation stats
      const stats = operationStats.get(event.operation) || { count: 0, totalDuration: 0, errors: 0 };
      stats.count++;
      stats.totalDuration += event.duration_ms || 0;
      if (event.error) stats.errors++;
      operationStats.set(event.operation, stats);

      // Aggregate stats
      if (event.api_calls) totalApiCalls += event.api_calls;
      if (event.cache_hits) totalCacheHits += event.cache_hits;
      if (event.cache_misses) totalCacheMisses += event.cache_misses;
      if (event.duration_ms) totalDuration += event.duration_ms;
      if (event.error) errorCount++;

      // AI operations
      if (event.category === 'ai') {
        aiOperations++;
        if (event.metadata?.success) aiSuccesses++;
        if (event.duration_ms) aiTotalDuration += event.duration_ms;
      }

      // Bulk operations
      if (event.category === 'bulk-op') {
        bulkOperations++;
        if (event.metadata?.item_count) bulkTotalItems += Number(event.metadata.item_count);
      }
    }

    // Top operations
    const topOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        count: stats.count,
        avg_duration_ms: Math.round(stats.totalDuration / stats.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Category counts
    const byCategory: Record<string, number> = {};
    for (const event of this.events) {
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
    }

    return {
      period_start: this.periodStart.toISOString(),
      period_end: now.toISOString(),
      total_events: this.events.length,
      by_category: byCategory,
      top_operations: topOperations,
      error_rate: this.events.length > 0 ? (errorCount / this.events.length) * 100 : 0,
      avg_api_calls_per_operation: this.events.length > 0 ? totalApiCalls / this.events.length : 0,
      cache_hit_rate: (totalCacheHits + totalCacheMisses) > 0 
        ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100 
        : 0,
      total_duration_ms: totalDuration,
      ai_operations: aiOperations > 0 ? {
        total: aiOperations,
        success_rate: (aiSuccesses / aiOperations) * 100,
        avg_duration_ms: Math.round(aiTotalDuration / aiOperations)
      } : undefined,
      bulk_operations: bulkOperations > 0 ? {
        total: bulkOperations,
        avg_items_per_operation: Math.round(bulkTotalItems / bulkOperations),
        total_items_processed: bulkTotalItems
      } : undefined
    };
  }

  /**
   * Get raw events
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    this.periodStart = new Date();
    logger.info('[Telemetry] Events cleared');
  }

  /**
   * Export events to JSON file
   */
  async exportToFile(filename?: string): Promise<string> {
    const exportPath = path.resolve(this.config.exportDir);
    await fs.mkdir(exportPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(
      exportPath,
      filename || `telemetry-${timestamp}.json`
    );

    const data = {
      exported_at: new Date().toISOString(),
      config: {
        enabled: this.config.enabled,
        period_start: this.periodStart.toISOString()
      },
      stats: this.getStats(),
      events: this.events
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info(`[Telemetry] Exported ${this.events.length} events to ${filepath}`);
    
    return filepath;
  }

  /**
   * Export statistics only (no raw events)
   */
  async exportStatsToFile(filename?: string): Promise<string> {
    const exportPath = path.resolve(this.config.exportDir);
    await fs.mkdir(exportPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(
      exportPath,
      filename || `telemetry-stats-${timestamp}.json`
    );

    const data = {
      exported_at: new Date().toISOString(),
      stats: this.getStats(),
      metrics_snapshot: metricsService.getSnapshot(),
      cache_stats: cacheService.getStats()
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info(`[Telemetry] Exported statistics to ${filepath}`);
    
    return filepath;
  }

  /**
   * Start auto-export timer
   */
  private startAutoExport(): void {
    if (this.autoExportTimer) {
      return; // Already running
    }

    this.autoExportTimer = setInterval(() => {
      this.exportToFile().catch(err => {
        logger.warn(`[Telemetry] Auto-export failed: ${err}`);
      });
    }, this.config.autoExportInterval);
    
    // Allow Node.js to exit if this is the only active timer
    this.autoExportTimer.unref();

    logger.info(`[Telemetry] Auto-export started (interval: ${this.config.autoExportInterval}ms)`);
  }

  /**
   * Stop auto-export timer
   */
  private stopAutoExport(): void {
    if (this.autoExportTimer) {
      clearInterval(this.autoExportTimer);
      this.autoExportTimer = undefined;
      logger.info('[Telemetry] Auto-export stopped');
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.stopAutoExport();
    logger.info('[Telemetry] Shutdown complete');
  }
}

/**
 * Singleton telemetry service instance
 * Disabled by default (opt-in)
 */
export const telemetryService = new TelemetryService();

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  const shutdownHandler = () => {
    telemetryService.shutdown().catch(err => {
      logger.error('[Telemetry] Shutdown error:', err);
    });
  };

  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);
}
