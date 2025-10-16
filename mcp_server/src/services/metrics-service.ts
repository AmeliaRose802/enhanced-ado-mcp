/**
 * Metrics Service
 * 
 * Provides comprehensive metrics tracking for MCP server operations.
 * Tracks counters, histograms, and gauges for monitoring and debugging.
 */

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramStats>;
  gauges: Record<string, number>;
  timestamp: string;
}

export interface HistogramStats {
  count: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
}

interface HistogramEntry {
  values: number[];
  lastUpdate: number;
}

export class MetricsService {
  private counters = new Map<string, number>();
  private histograms = new Map<string, HistogramEntry>();
  private gauges = new Map<string, number>();
  private maxHistogramSize = 1000;
  private startTime = Date.now();

  increment(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  recordDuration(name: string, durationMs: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const entry = this.histograms.get(key) || { values: [], lastUpdate: Date.now() };
    entry.values.push(durationMs);
    entry.lastUpdate = Date.now();
    if (entry.values.length > this.maxHistogramSize) {
      entry.values = entry.values.slice(-this.maxHistogramSize);
    }
    this.histograms.set(key, entry);
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.gauges.set(key, value);
  }

  getSnapshot(): MetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: this.calculateHistogramStats(),
      gauges: Object.fromEntries(this.gauges),
      timestamp: new Date().toISOString()
    };
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.startTime = Date.now();
  }

  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.buildKey(name, tags);
    return this.counters.get(key) || 0;
  }

  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.buildKey(name, tags);
    return this.gauges.get(key);
  }

  getHistogramStats(name: string, tags?: Record<string, string>): HistogramStats | undefined {
    const key = this.buildKey(name, tags);
    const entry = this.histograms.get(key);
    if (!entry || entry.values.length === 0) return undefined;
    return this.calculateStatsForValues(entry.values);
  }

  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) return name;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  }

  private calculateHistogramStats(): Record<string, HistogramStats> {
    const stats: Record<string, HistogramStats> = {};
    for (const [key, entry] of this.histograms) {
      if (entry.values.length > 0) {
        stats[key] = this.calculateStatsForValues(entry.values);
      }
    }
    return stats;
  }

  private calculateStatsForValues(values: number[]): HistogramStats {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}

export const metricsService = new MetricsService();
