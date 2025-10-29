/**
 * Cache Service Unit Tests
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { CacheService } from '../../src/services/cache-service.js';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService(100, 1000);
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
      const smallCache = new CacheService(3, 10000);
      
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
      expect(stats.maxSize).toBe(100);
      expect(stats.entries).toContain('key1');
      expect(stats.entries).toContain('key2');
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
});
