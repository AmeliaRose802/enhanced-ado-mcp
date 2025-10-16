/**
 * Metrics Service Unit Tests
 */

import { MetricsService } from '../../src/services/metrics-service.js';

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  afterEach(() => {
    metricsService.reset();
  });

  describe('Counter Operations', () => {
    it('should increment counter by default value of 1', () => {
      metricsService.increment('test.counter');
      const value = metricsService.getCounter('test.counter');
      expect(value).toBe(1);
    });

    it('should increment counter by specified value', () => {
      metricsService.increment('test.counter', 5);
      const value = metricsService.getCounter('test.counter');
      expect(value).toBe(5);
    });

    it('should accumulate multiple increments', () => {
      metricsService.increment('test.counter', 3);
      metricsService.increment('test.counter', 2);
      metricsService.increment('test.counter', 1);
      const value = metricsService.getCounter('test.counter');
      expect(value).toBe(6);
    });

    it('should handle counters with tags', () => {
      metricsService.increment('test.counter', 1, { tool: 'create' });
      metricsService.increment('test.counter', 2, { tool: 'update' });
      
      const createValue = metricsService.getCounter('test.counter', { tool: 'create' });
      const updateValue = metricsService.getCounter('test.counter', { tool: 'update' });
      
      expect(createValue).toBe(1);
      expect(updateValue).toBe(2);
    });

    it('should return 0 for non-existent counter', () => {
      const value = metricsService.getCounter('nonexistent');
      expect(value).toBe(0);
    });
  });

  describe('Histogram Operations', () => {
    it('should record duration values', () => {
      metricsService.recordDuration('test.duration', 100);
      metricsService.recordDuration('test.duration', 200);
      metricsService.recordDuration('test.duration', 300);
      
      const stats = metricsService.getHistogramStats('test.duration');
      
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(300);
      expect(stats!.mean).toBe(200);
    });

    it('should calculate percentiles correctly', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      values.forEach(v => metricsService.recordDuration('test.duration', v));
      
      const stats = metricsService.getHistogramStats('test.duration');
      
      expect(stats!.p50).toBeCloseTo(55, 0);
      expect(stats!.p95).toBeCloseTo(95.5, 0);
      expect(stats!.p99).toBeCloseTo(99.1, 0);
    });

    it('should handle single value histogram', () => {
      metricsService.recordDuration('test.duration', 42);
      
      const stats = metricsService.getHistogramStats('test.duration');
      
      expect(stats!.count).toBe(1);
      expect(stats!.min).toBe(42);
      expect(stats!.max).toBe(42);
      expect(stats!.mean).toBe(42);
      expect(stats!.p50).toBe(42);
      expect(stats!.p95).toBe(42);
      expect(stats!.p99).toBe(42);
    });

    it('should limit histogram size', () => {
      const maxSize = 1000;
      
      for (let i = 0; i < maxSize + 100; i++) {
        metricsService.recordDuration('test.duration', i);
      }
      
      const stats = metricsService.getHistogramStats('test.duration');
      expect(stats!.count).toBe(maxSize);
    });

    it('should return undefined for non-existent histogram', () => {
      const stats = metricsService.getHistogramStats('nonexistent');
      expect(stats).toBeUndefined();
    });
  });

  describe('Gauge Operations', () => {
    it('should set and get gauge value', () => {
      metricsService.setGauge('test.gauge', 42);
      const value = metricsService.getGauge('test.gauge');
      expect(value).toBe(42);
    });

    it('should overwrite previous gauge value', () => {
      metricsService.setGauge('test.gauge', 10);
      metricsService.setGauge('test.gauge', 20);
      const value = metricsService.getGauge('test.gauge');
      expect(value).toBe(20);
    });

    it('should handle gauges with tags', () => {
      metricsService.setGauge('test.gauge', 100, { instance: 'a' });
      metricsService.setGauge('test.gauge', 200, { instance: 'b' });
      
      const valueA = metricsService.getGauge('test.gauge', { instance: 'a' });
      const valueB = metricsService.getGauge('test.gauge', { instance: 'b' });
      
      expect(valueA).toBe(100);
      expect(valueB).toBe(200);
    });

    it('should return undefined for non-existent gauge', () => {
      const value = metricsService.getGauge('nonexistent');
      expect(value).toBeUndefined();
    });
  });

  describe('Snapshot Operations', () => {
    it('should return complete metrics snapshot', () => {
      metricsService.increment('counter.a', 5);
      metricsService.recordDuration('duration.a', 100);
      metricsService.setGauge('gauge.a', 42);
      
      const snapshot = metricsService.getSnapshot();
      
      expect(snapshot.counters['counter.a']).toBe(5);
      expect(snapshot.histograms['duration.a']).toBeDefined();
      expect(snapshot.histograms['duration.a'].count).toBe(1);
      expect(snapshot.gauges['gauge.a']).toBe(42);
      expect(snapshot.timestamp).toBeDefined();
    });

    it('should include timestamp in snapshot', () => {
      const snapshot = metricsService.getSnapshot();
      expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Reset Operations', () => {
    it('should clear all metrics on reset', () => {
      metricsService.increment('counter.a', 10);
      metricsService.recordDuration('duration.a', 100);
      metricsService.setGauge('gauge.a', 42);
      
      metricsService.reset();
      
      const snapshot = metricsService.getSnapshot();
      expect(Object.keys(snapshot.counters).length).toBe(0);
      expect(Object.keys(snapshot.histograms).length).toBe(0);
      expect(Object.keys(snapshot.gauges).length).toBe(0);
    });
  });

  describe('Uptime Tracking', () => {
    it('should track uptime in seconds', async () => {
      const initialUptime = metricsService.getUptime();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const laterUptime = metricsService.getUptime();
      expect(laterUptime).toBeGreaterThanOrEqual(initialUptime);
    });

    it('should reset uptime on reset', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      metricsService.reset();
      
      const uptime = metricsService.getUptime();
      expect(uptime).toBeLessThan(1);
    });
  });

  describe('Tag Handling', () => {
    it('should sort tags consistently', () => {
      metricsService.increment('test', 1, { b: '2', a: '1', c: '3' });
      metricsService.increment('test', 1, { c: '3', a: '1', b: '2' });
      
      const snapshot = metricsService.getSnapshot();
      const keys = Object.keys(snapshot.counters);
      
      expect(keys.length).toBe(1);
      expect(keys[0]).toBe('test{a:1,b:2,c:3}');
      expect(snapshot.counters[keys[0]]).toBe(2);
    });

    it('should handle empty tags object', () => {
      metricsService.increment('test', 1, {});
      const value = metricsService.getCounter('test');
      expect(value).toBe(1);
    });
  });
});
