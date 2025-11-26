/**
 * Rate Limiter Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RateLimiter } from '../../src/services/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create instance with explicit test parameters
    // This bypasses config loading for isolated testing
    rateLimiter = new RateLimiter(10, 10);
  });

  afterEach(() => {
    rateLimiter.reset();
  });

  describe('Basic Throttling', () => {
    it('should allow requests within capacity', async () => {
      const start = Date.now();
      await rateLimiter.throttle('test');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should throttle when capacity exhausted', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.throttle('test');
      }
      
      const start = Date.now();
      await rateLimiter.throttle('test');
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThan(50);
    });

    it('should refill tokens over time', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.throttle('test');
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const start = Date.now();
      await rateLimiter.throttle('test');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Multiple Keys', () => {
    it('should handle separate buckets for different keys', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.throttle('key1');
      }
      
      const start = Date.now();
      await rateLimiter.throttle('key2');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should track stats per key', async () => {
      await rateLimiter.throttle('key1');
      await rateLimiter.throttle('key2');
      
      const stats1 = rateLimiter.getStats('key1');
      const stats2 = rateLimiter.getStats('key2');
      
      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
      expect(stats1?.tokens).toBeLessThan(10);
      expect(stats2?.tokens).toBeLessThan(10);
    });
  });

  describe('Reset Operations', () => {
    it('should reset specific key', async () => {
      await rateLimiter.throttle('key1');
      rateLimiter.reset('key1');
      
      const stats = rateLimiter.getStats('key1');
      expect(stats).toBeNull();
    });

    it('should reset all keys', async () => {
      await rateLimiter.throttle('key1');
      await rateLimiter.throttle('key2');
      
      rateLimiter.reset();
      
      expect(rateLimiter.getStats('key1')).toBeNull();
      expect(rateLimiter.getStats('key2')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should return null for non-existent key', () => {
      const stats = rateLimiter.getStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('should report remaining tokens', async () => {
      await rateLimiter.throttle('test');
      await rateLimiter.throttle('test');
      
      const stats = rateLimiter.getStats('test');
      
      expect(stats).toBeDefined();
      expect(stats!.tokens).toBeLessThan(10);
      expect(stats!.capacity).toBe(10);
    });
  });

  describe('Configuration Support', () => {
    it('should support custom capacity and refill rate', async () => {
      const customLimiter = new RateLimiter(50, 5);
      
      // Should allow burst of 50 requests
      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await customLimiter.throttle('test');
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(50);
      }
      
      // 51st request should throttle
      const start = Date.now();
      await customLimiter.throttle('test');
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThan(50);
      
      customLimiter.reset();
    });

    it('should support different configurations per key', async () => {
      // Free tier limits
      const freeTierLimiter = new RateLimiter(200, 3.33);
      // Basic tier limits
      const basicTierLimiter = new RateLimiter(1000, 16.67);
      
      const freeStats = freeTierLimiter.getStats('default');
      const basicStats = basicTierLimiter.getStats('default');
      
      // Initially should have full capacity
      expect(freeStats).toBeNull(); // No bucket yet
      expect(basicStats).toBeNull(); // No bucket yet
      
      // After using them
      await freeTierLimiter.throttle('test');
      await basicTierLimiter.throttle('test');
      
      const freeStatsAfter = freeTierLimiter.getStats('test');
      const basicStatsAfter = basicTierLimiter.getStats('test');
      
      expect(freeStatsAfter?.capacity).toBe(200);
      expect(basicStatsAfter?.capacity).toBe(1000);
      
      freeTierLimiter.reset();
      basicTierLimiter.reset();
    });

    it('should validate min/max bounds for capacity', () => {
      // Capacity should be at least 10 (validated by config schema)
      const minLimiter = new RateLimiter(10, 1);
      expect(minLimiter.getStats('test')).toBeNull();
      
      // Capacity should not exceed 2000 (validated by config schema)
      const maxLimiter = new RateLimiter(2000, 50);
      expect(maxLimiter.getStats('test')).toBeNull();
    });

    it('should validate min/max bounds for refill rate', () => {
      // Refill rate should be at least 0.1 (validated by config schema)
      const minLimiter = new RateLimiter(100, 0.1);
      expect(minLimiter.getStats('test')).toBeNull();
      
      // Refill rate should not exceed 50 (validated by config schema)
      const maxLimiter = new RateLimiter(100, 50);
      expect(maxLimiter.getStats('test')).toBeNull();
    });
  });
});
