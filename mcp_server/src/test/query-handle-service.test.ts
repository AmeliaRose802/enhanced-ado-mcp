/**
 * Query Handle Service Tests
 * 
 * Tests for the query handle service that stores and retrieves work item IDs
 * for safe bulk operations without ID hallucination risk.
 */

import { queryHandleService } from '../services/query-handle-service.js';

describe('Query Handle Service', () => {
  beforeEach(() => {
    // Clear all handles before each test
    queryHandleService.clearAll();
  });

  afterAll(() => {
    // Stop cleanup interval after tests
    queryHandleService.stopCleanup();
  });

  describe('storeQuery', () => {
    it('should generate unique handles', () => {
      const handle1 = queryHandleService.storeQuery([1, 2, 3], 'SELECT [System.Id] FROM WorkItems');
      const handle2 = queryHandleService.storeQuery([4, 5, 6], 'SELECT [System.Id] FROM WorkItems');
      
      expect(handle1).toMatch(/^qh_[a-f0-9]{32}$/);
      expect(handle2).toMatch(/^qh_[a-f0-9]{32}$/);
      expect(handle1).not.toBe(handle2);
    });

    it('should store work item IDs', () => {
      const workItemIds = [123, 456, 789];
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');
      
      const retrieved = queryHandleService.getWorkItemIds(handle);
      expect(retrieved).toEqual(workItemIds);
    });

    it('should store metadata', () => {
      const workItemIds = [123, 456];
      const query = 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"';
      const metadata = { project: 'TestProject', queryType: 'wiql' };
      
      const handle = queryHandleService.storeQuery(workItemIds, query, metadata);
      
      const data = queryHandleService.getQueryData(handle);
      expect(data).not.toBeNull();
      expect(data?.workItemIds).toEqual(workItemIds);
      expect(data?.query).toBe(query);
      expect(data?.metadata).toEqual(metadata);
    });
  });

  describe('getWorkItemIds', () => {
    it('should retrieve stored work item IDs', () => {
      const workItemIds = [100, 200, 300];
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems');
      
      const retrieved = queryHandleService.getWorkItemIds(handle);
      expect(retrieved).toEqual(workItemIds);
    });

    it('should return null for non-existent handle', () => {
      const retrieved = queryHandleService.getWorkItemIds('qh_nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired handle', () => {
      const workItemIds = [1, 2, 3];
      const handle = queryHandleService.storeQuery(workItemIds, 'SELECT [System.Id] FROM WorkItems', undefined, 1); // 1ms TTL
      
      // Wait for expiration
      return new Promise(resolve => {
        setTimeout(() => {
          const retrieved = queryHandleService.getWorkItemIds(handle);
          expect(retrieved).toBeNull();
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('getQueryData', () => {
    it('should return full query data', () => {
      const workItemIds = [1, 2, 3];
      const query = 'SELECT [System.Id] FROM WorkItems';
      const metadata = { project: 'MyProject' };
      
      const handle = queryHandleService.storeQuery(workItemIds, query, metadata);
      
      const data = queryHandleService.getQueryData(handle);
      expect(data).not.toBeNull();
      expect(data?.workItemIds).toEqual(workItemIds);
      expect(data?.query).toBe(query);
      expect(data?.metadata).toEqual(metadata);
      expect(data?.createdAt).toBeInstanceOf(Date);
      expect(data?.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteHandle', () => {
    it('should delete handle', () => {
      const handle = queryHandleService.storeQuery([1, 2, 3], 'SELECT [System.Id] FROM WorkItems');
      
      const deleted = queryHandleService.deleteHandle(handle);
      expect(deleted).toBe(true);
      
      const retrieved = queryHandleService.getWorkItemIds(handle);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent handle', () => {
      const deleted = queryHandleService.deleteHandle('qh_nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      queryHandleService.storeQuery([1, 2], 'query1');
      queryHandleService.storeQuery([3, 4], 'query2');
      queryHandleService.storeQuery([5, 6], 'query3', undefined, 1); // Expire immediately
      
      // Wait for one handle to expire
      return new Promise(resolve => {
        setTimeout(() => {
          const stats = queryHandleService.getStats();
          expect(stats.totalHandles).toBe(3);
          expect(stats.activeHandles).toBe(2);
          expect(stats.expiredHandles).toBe(1);
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('cleanup', () => {
    it('should remove expired handles', () => {
      queryHandleService.storeQuery([1, 2], 'query1');
      queryHandleService.storeQuery([3, 4], 'query2', undefined, 1); // 1ms TTL
      queryHandleService.storeQuery([5, 6], 'query3', undefined, 1); // 1ms TTL
      
      return new Promise(resolve => {
        setTimeout(() => {
          const deletedCount = queryHandleService.cleanup();
          expect(deletedCount).toBe(2);
          
          const stats = queryHandleService.getStats();
          expect(stats.totalHandles).toBe(1);
          expect(stats.activeHandles).toBe(1);
          expect(stats.expiredHandles).toBe(0);
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('TTL behavior', () => {
    it('should use default TTL (1 hour)', () => {
      const handle = queryHandleService.storeQuery([1, 2, 3], 'query');
      const data = queryHandleService.getQueryData(handle);
      
      expect(data).not.toBeNull();
      const ttl = data!.expiresAt.getTime() - data!.createdAt.getTime();
      expect(ttl).toBeGreaterThanOrEqual(60 * 60 * 1000 - 100); // Allow 100ms tolerance
      expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000 + 100);
    });

    it('should use custom TTL', () => {
      const customTTL = 5 * 60 * 1000; // 5 minutes
      const handle = queryHandleService.storeQuery([1, 2, 3], 'query', undefined, customTTL);
      const data = queryHandleService.getQueryData(handle);
      
      expect(data).not.toBeNull();
      const ttl = data!.expiresAt.getTime() - data!.createdAt.getTime();
      expect(ttl).toBeGreaterThanOrEqual(customTTL - 100);
      expect(ttl).toBeLessThanOrEqual(customTTL + 100);
    });
  });

  describe('clearAll', () => {
    it('should remove all handles', () => {
      queryHandleService.storeQuery([1], 'query1');
      queryHandleService.storeQuery([2], 'query2');
      queryHandleService.storeQuery([3], 'query3');
      
      queryHandleService.clearAll();
      
      const stats = queryHandleService.getStats();
      expect(stats.totalHandles).toBe(0);
    });
  });
});
