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

  // Helper to create test data with itemContext
  const createTestHandle = () => {
    const workItemIds = [123, 456, 789, 101112];
    const query = 'SELECT [System.Id] FROM WorkItems';
    
    // Create workItemContext map
    const workItemContext = new Map();
    workItemContext.set(123, {
      title: 'Fix login bug',
      state: 'New',
      type: 'Bug',
      daysInactive: 45,
      lastSubstantiveChangeDate: '2025-01-01T10:00:00Z',
      tags: 'frontend;urgent'
    });
    workItemContext.set(456, {
      title: 'Update documentation',
      state: 'Active',
      type: 'Task',
      daysInactive: 10,
      lastSubstantiveChangeDate: '2025-01-15T14:30:00Z',
      tags: 'docs;low-priority'
    });
    workItemContext.set(789, {
      title: 'Performance optimization',
      state: 'New',
      type: 'Task',
      daysInactive: 120,
      lastSubstantiveChangeDate: '2024-10-01T09:00:00Z',
      tags: 'backend;performance'
    });
    workItemContext.set(101112, {
      title: 'Security review',
      state: 'Done',
      type: 'Task',
      daysInactive: 5,
      lastSubstantiveChangeDate: '2025-01-20T16:00:00Z',
      tags: 'security;critical'
    });

    return queryHandleService.storeQuery(workItemIds, query, undefined, 60000, workItemContext);
  };

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

  // NEW: Tests for itemSelector functionality
  describe('itemSelector functionality', () => {
    describe('getItemsByIndices', () => {
      it('should return work items by indices', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByIndices(handle, [0, 2]);
        expect(result).toEqual([123, 789]); // First and third items
      });

      it('should filter invalid indices', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByIndices(handle, [0, 5, 2]);
        expect(result).toEqual([123, 789]); // Index 5 is invalid (only 4 items)
      });

      it('should return empty array for all invalid indices', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByIndices(handle, [10, 20]);
        expect(result).toEqual([]);
      });

      it('should return null for invalid handle', () => {
        const result = queryHandleService.getItemsByIndices('invalid', [0, 1]);
        expect(result).toBeNull();
      });
    });

    describe('getItemsByCriteria', () => {
      it('should filter by states', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByCriteria(handle, { states: ['New'] });
        expect(result).toEqual([123, 789]); // Both Bug and Task with state 'New'
      });

      it('should filter by daysInactive range', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByCriteria(handle, { 
          daysInactiveMin: 40,
          daysInactiveMax: 50 
        });
        expect(result).toEqual([123]); // Only item with 45 days inactive
      });

      it('should filter by title contains', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByCriteria(handle, { 
          titleContains: ['bug', 'security'] 
        });
        expect(result).toEqual([123, 101112]); // Items with 'bug' or 'security' in title
      });

      it('should filter by tags', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByCriteria(handle, { 
          tags: ['urgent'] 
        });
        expect(result).toEqual([123]); // Only item with 'urgent' tag
      });

      it('should combine multiple criteria', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByCriteria(handle, { 
          states: ['New'],
          daysInactiveMin: 100
        });
        expect(result).toEqual([789]); // New items with >100 days inactive
      });

      it('should return empty array when no items match', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.getItemsByCriteria(handle, { 
          states: ['NonExistentState']
        });
        expect(result).toEqual([]);
      });

      it('should return null for invalid handle', () => {
        const result = queryHandleService.getItemsByCriteria('invalid', { states: ['New'] });
        expect(result).toBeNull();
      });
    });

    describe('resolveItemSelector', () => {
      it('should resolve "all" selector', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.resolveItemSelector(handle, 'all');
        expect(result).toEqual([123, 456, 789, 101112]);
      });

      it('should resolve index array selector', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.resolveItemSelector(handle, [1, 3]);
        expect(result).toEqual([456, 101112]); // Second and fourth items
      });

      it('should resolve criteria selector', () => {
        const handle = createTestHandle();
        
        const result = queryHandleService.resolveItemSelector(handle, { 
          states: ['Active'] 
        });
        expect(result).toEqual([456]); // Only active item
      });

      it('should return null for invalid handle', () => {
        const result = queryHandleService.resolveItemSelector('invalid', 'all');
        expect(result).toBeNull();
      });
    });

    describe('itemContext creation', () => {
      it('should create itemContext array from workItemContext', () => {
        const handle = createTestHandle();
        const data = queryHandleService.getQueryData(handle);
        
        expect(data?.itemContext).toHaveLength(4);
        
        // Check first item
        const firstItem = data?.itemContext[0];
        expect(firstItem).toEqual({
          index: 0,
          id: 123,
          title: 'Fix login bug',
          state: 'New',
          type: 'Bug',
          daysInactive: 45,
          lastChange: '2025-01-01T10:00:00Z',
          tags: ['frontend', 'urgent']
        });
      });

      it('should create selectionMetadata', () => {
        const handle = createTestHandle();
        const data = queryHandleService.getQueryData(handle);
        
        expect(data?.selectionMetadata).toEqual({
          totalItems: 4,
          selectableIndices: [0, 1, 2, 3],
          criteriaTags: ['frontend', 'urgent', 'docs', 'low-priority', 'backend', 'performance', 'security', 'critical']
        });
      });
    });
  });
});
