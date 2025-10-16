/**
 * Rate Limiter Unit Tests
 */

import { RateLimiter } from '../../src/services/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
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
});
