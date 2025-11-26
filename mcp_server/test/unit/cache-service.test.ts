/**
 * Cache Service Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CacheService, CacheDataType } from '../../src/services/cache-service.js';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService({
      enabled: true,
      maxSize: 10,
      maxMemoryBytes: 10 * 1024, // 10KB
      defaultTTL: 1000
    });
  });

  afterEach(() => {
    cacheService.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cacheService.set('key1', 'value1');
      const result = cacheService.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const result = cacheService.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.has('key1')).toBe(true);
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    it('should delete keys', () => {
      cacheService.set('key1', 'value1');
      const deleted = cacheService.delete('key1');
      expect(deleted).toBe(true);
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should clear all entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.clear();
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBeNull();
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      cacheService.set('key1', 'value1', 100);
      expect(cacheService.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should not expire before TTL', async () => {
      cacheService.set('key1', 'value1', 200);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(cacheService.get('key1')).toBe('value1');
    });

    it('should use default TTL when not specified', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.has('key1')).toBe(true);
    });
  });

  describe('Size Limits', () => {
    it('should evict oldest entry when max size reached', () => {
      const smallCache = new CacheService({ maxSize: 3, defaultTTL: 10000 });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      smallCache.set('key4', 'value4');
      
      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });

    it('should report correct stats', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      
      const stats = cacheService.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.entries.map((e: any) => e.key)).toContain('key1');
      expect(stats.entries.map((e: any) => e.key)).toContain('key2');
    });
  });

  describe('Data Types', () => {
    it('should handle objects', () => {
      const obj = { foo: 'bar', num: 42 };
      cacheService.set('obj', obj);
      expect(cacheService.get('obj')).toEqual(obj);
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      cacheService.set('arr', arr);
      expect(cacheService.get('arr')).toEqual(arr);
    });

    it('should handle null values', () => {
      cacheService.set('null', null);
      expect(cacheService.has('null')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cacheService.set('key1', 'value1');
      
      cacheService.get('key1'); // Hit
      cacheService.get('key2'); // Miss
      cacheService.get('key1'); // Hit
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0.5);
    });

    it('should track evictions', () => {
      // Fill cache beyond capacity
      for (let i = 0; i < 12; i++) {
        cacheService.set(`key${i}`, `value${i}`);
      }
      
      const stats = cacheService.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      cacheService.set('key1', 'value1');
      cacheService.get('key1');
      cacheService.get('key2');
      
      cacheService.resetStats();
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Pattern-Based Invalidation', () => {
    it('should delete entries matching string pattern', () => {
      cacheService.set('workitem:123', 'data1');
      cacheService.set('workitem:124', 'data2');
      cacheService.set('iteration:current', 'data3');
      
      const deleted = cacheService.deletePattern('workitem:');
      
      expect(deleted).toBe(2);
      expect(cacheService.get('workitem:123')).toBeNull();
      expect(cacheService.get('iteration:current')).toBe('data3');
    });

    it('should delete entries matching regex pattern', () => {
      cacheService.set('workitem:123', 'data1');
      cacheService.set('workitem:124', 'data2');
      cacheService.set('iteration:123', 'data3');
      
      const deleted = cacheService.deletePattern(/.*:123$/);
      
      expect(deleted).toBe(2);
      expect(cacheService.get('workitem:124')).toBe('data2');
    });
  });

  describe('Enable/Disable', () => {
    it('should not cache when disabled', () => {
      cacheService.disable();
      
      cacheService.set('key1', 'value1');
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should cache when re-enabled', () => {
      cacheService.disable();
      cacheService.enable();
      
      cacheService.set('key1', 'value1');
      expect(cacheService.get('key1')).toBe('value1');
    });
  });

  describe('Data Type TTLs', () => {
    it('should use correct TTL for iterations', () => {
      const ttl = cacheService.getTTLForType(CacheDataType.ITERATIONS);
      expect(ttl).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should use correct TTL for work item content', () => {
      const ttl = cacheService.getTTLForType(CacheDataType.WORK_ITEM_CONTENT);
      expect(ttl).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys', () => {
      const key1 = CacheService.generateKey('prefix', 'part1', 'part2');
      const key2 = CacheService.generateKey('prefix', 'part1', 'part2');
      expect(key1).toBe(key2);
    });

    it('should handle undefined values', () => {
      const key = CacheService.generateKey('prefix', 'part1', undefined, 'part2');
      expect(key).toContain('prefix');
      expect(key).not.toContain('undefined');
    });
  });
});
