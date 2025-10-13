/**
 * Integration tests for Query Handle Selection workflows
 * Tests end-to-end item selection patterns to ensure criteria-based selection works correctly
 */

import { queryHandleService } from '../../src/services/query-handle-service.js';

describe('Query Handle Selection Integration Tests', () => {
  
  beforeEach(() => {
    // Clear any existing handles before each test (access private property for testing)
    (queryHandleService as any).queryHandles = new Map();
  });

  afterAll(() => {
    // Stop the cleanup interval to prevent "Jest did not exit one second after the test run" warning
    queryHandleService.stopCleanup();
  });

  describe('Index-based Selection', () => {
    it('should select items by zero-based indices', () => {
      // Arrange: Store a query with 10 items
      const workItemIds = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      // Act: Select items at indices 0, 2, 5
      const result = queryHandleService.getItemsByIndices(handle, [0, 2, 5]);

      // Assert
      expect(result).toEqual([101, 103, 106]);
    });

    it('should handle out-of-bounds indices gracefully', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.getItemsByIndices(handle, [0, 5, 10]);

      expect(result).toEqual([101]); // Only index 0 is valid
    });

    it('should handle empty index array', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.getItemsByIndices(handle, []);

      expect(result).toEqual([]);
    });

    it('should return null for invalid handle', () => {
      const result = queryHandleService.getItemsByIndices('invalid-handle', [0, 1]);

      expect(result).toBeNull();
    });

    it('should filter out negative indices', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.getItemsByIndices(handle, [-1, 0, -5, 2]);

      expect(result).toEqual([101, 103]); // Negative indices filtered out
    });

    it('should handle duplicate indices', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.getItemsByIndices(handle, [0, 1, 0, 2, 1]);

      // Duplicates are allowed - maps directly to work item IDs
      expect(result).toEqual([101, 102, 101, 103, 102]);
    });

    it('should handle selection from empty query result', () => {
      const workItemIds: number[] = [];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.getItemsByIndices(handle, [0, 1]);

      expect(result).toEqual([]); // All indices out of bounds
    });
  });

  describe('Criteria-based Selection', () => {
    it('should filter by state', () => {
      // Arrange: Create handle with itemContext containing state info
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug' }],
        [104, { id: 104, title: 'Item 4', state: 'Closed', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      // Act: Filter by state
      const result = queryHandleService.getItemsByCriteria(handle, {
        states: ['Active']
      });

      // Assert
      expect(result).toEqual([101, 103]);
    });

    it('should filter by tags', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', tags: ['Priority1', 'Security'] }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', tags: ['Priority2'] }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', tags: ['Security', 'Bug'] }],
        [104, { id: 104, title: 'Item 4', state: 'Closed', type: 'Task', tags: [] }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        tags: ['Security']
      });

      expect(result).toEqual([101, 103]);
    });

    it('should filter by title keywords', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Fix login bug', state: 'Active', type: 'Bug' }],
        [102, { id: 102, title: 'Update documentation', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Bug in payment system', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        titleContains: ['bug']
      });

      expect(result).toEqual([101, 103]);
    });

    it('should filter by staleness (daysInactive)', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', daysInactive: 10 }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', daysInactive: 45 }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', daysInactive: 90 }],
        [104, { id: 104, title: 'Item 4', state: 'Closed', type: 'Task', daysInactive: 120 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        daysInactiveMin: 30,
        daysInactiveMax: 100
      });

      expect(result).toEqual([102, 103]);
    });

    it('should combine multiple criteria with AND logic', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Bug in login', state: 'Active', type: 'Bug', tags: ['Security'], daysInactive: 50 }],
        [102, { id: 102, title: 'Bug in payment', state: 'New', type: 'Bug', tags: ['Security'], daysInactive: 10 }],
        [103, { id: 103, title: 'Update docs', state: 'Active', type: 'Task', tags: ['Documentation'], daysInactive: 60 }],
        [104, { id: 104, title: 'Security bug fix', state: 'Active', type: 'Bug', tags: ['Security'], daysInactive: 70 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        states: ['Active'],
        tags: ['Security'],
        daysInactiveMin: 45
      });

      expect(result).toEqual([101, 104]);
    });

    it('should return null for invalid handle', () => {
      const result = queryHandleService.getItemsByCriteria('invalid-handle', {
        states: ['Active']
      });

      expect(result).toBeNull();
    });

    it('should return empty array when criteria matches no items', () => {
      const workItemIds = [101, 102];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        states: ['Closed'] // No items match
      });

      expect(result).toEqual([]);
    });

    it('should filter by multiple states', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Item 3', state: 'Closed', type: 'Bug' }],
        [104, { id: 104, title: 'Item 4', state: 'Active', type: 'Task' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        states: ['Active', 'Closed']
      });

      expect(result).toEqual([101, 103, 104]);
    });

    it('should filter by multiple tags', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', tags: ['Security', 'Critical'] }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', tags: ['Documentation'] }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', tags: ['Performance'] }],
        [104, { id: 104, title: 'Item 4', state: 'Active', type: 'Task', tags: ['Critical', 'Bug'] }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        tags: ['Security', 'Performance']
      });

      expect(result).toEqual([101, 103]); // Items with Security OR Performance
    });

    it('should filter by daysInactiveMin only', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', daysInactive: 10 }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', daysInactive: 45 }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', daysInactive: 90 }],
        [104, { id: 104, title: 'Item 4', state: 'Closed', type: 'Task', daysInactive: 120 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        daysInactiveMin: 60
      });

      expect(result).toEqual([103, 104]); // Items with daysInactive >= 60
    });

    it('should filter by daysInactiveMax only', () => {
      const workItemIds = [101, 102, 103, 104];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', daysInactive: 10 }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', daysInactive: 45 }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', daysInactive: 90 }],
        [104, { id: 104, title: 'Item 4', state: 'Closed', type: 'Task', daysInactive: 120 }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        daysInactiveMax: 50
      });

      expect(result).toEqual([101, 102]); // Items with daysInactive <= 50
    });

    it('should return all items when empty criteria is provided', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task' }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Item 3', state: 'Closed', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {});

      expect(result).toEqual([101, 102, 103]); // Empty criteria matches all
    });

    it('should handle special characters in title search', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Fix bug: [Auth] Login fails', state: 'Active', type: 'Bug' }],
        [102, { id: 102, title: 'Update docs (v2.0)', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Bug in payment $$ system', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        titleContains: ['[Auth]']
      });

      expect(result).toEqual([101]);
    });

    it('should handle tags with spaces and special characters', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', tags: ['High Priority', 'Security-Critical'] }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', tags: ['Low Priority'] }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', tags: ['Security-Critical', 'Bug Fix'] }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        tags: ['Security-Critical']
      });

      expect(result).toEqual([101, 103]);
    });

    it('should handle case-insensitive title search', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Fix BUG in login', state: 'Active', type: 'Bug' }],
        [102, { id: 102, title: 'Update documentation', state: 'New', type: 'Task' }],
        [103, { id: 103, title: 'Bug in payment system', state: 'Active', type: 'Bug' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        titleContains: ['bug']
      });

      expect(result).toEqual([101, 103]); // Case-insensitive match
    });

    it('should handle case-insensitive tag search', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', tags: ['SECURITY', 'Critical'] }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', tags: ['Documentation'] }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Bug', tags: ['security', 'Bug'] }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.getItemsByCriteria(handle, {
        tags: ['security']
      });

      expect(result).toEqual([101, 103]); // Case-insensitive match
    });
  });

  describe('Unified Item Selector Resolution', () => {
    it('should handle "all" selector', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.resolveItemSelector(handle, 'all');

      expect(result).toEqual([101, 102, 103]);
    });

    it('should handle index array selector', () => {
      const workItemIds = [101, 102, 103, 104, 105];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const result = queryHandleService.resolveItemSelector(handle, [1, 3]);

      expect(result).toEqual([102, 104]);
    });

    it('should handle criteria object selector', () => {
      const workItemIds = [101, 102, 103];
      const itemContext = new Map([
        [101, { id: 101, title: 'Item 1', state: 'Active', type: 'Task', tags: ['Tag1'] }],
        [102, { id: 102, title: 'Item 2', state: 'New', type: 'Task', tags: ['Tag2'] }],
        [103, { id: 103, title: 'Item 3', state: 'Active', type: 'Task', tags: ['Tag1'] }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const result = queryHandleService.resolveItemSelector(handle, {
        states: ['Active'],
        tags: ['Tag1']
      });

      expect(result).toEqual([101, 103]);
    });

    it('should return null for invalid handle', () => {
      const result = queryHandleService.resolveItemSelector('invalid-handle', 'all');

      expect(result).toBeNull();
    });

    it('should handle invalid selector type gracefully', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      // Test with invalid selector types - TypeScript would catch this but test runtime behavior
      const result1 = queryHandleService.resolveItemSelector(handle, null as any);
      expect(result1).toBeNull(); // Should handle gracefully

      const result2 = queryHandleService.resolveItemSelector(handle, 42 as any);
      expect(result2).toBeNull(); // Should handle gracefully

      const result3 = queryHandleService.resolveItemSelector(handle, 'invalid' as any);
      expect(result3).toBeNull(); // Should handle gracefully
    });
  });

  describe('Edge Cases and Expiration', () => {
    it('should return null for expired handles', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        -1 // Already expired
      );

      const result = queryHandleService.resolveItemSelector(handle, 'all');

      expect(result).toBeNull();
    });

    it('should handle selection with missing itemContext gracefully', () => {
      const workItemIds = [101, 102, 103];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
        // No itemContext provided
      );

      // Index-based selection should still work
      const indexResult = queryHandleService.getItemsByIndices(handle, [0, 1]);
      expect(indexResult).toEqual([101, 102]);

      // "all" selector should still work
      const allResult = queryHandleService.resolveItemSelector(handle, 'all');
      expect(allResult).toEqual([101, 102, 103]);
    });
  });

  describe('Performance Tests', () => {
    it('should handle selection from large itemContext (1000+ items)', () => {
      // Create 1000 work items
      const workItemIds = Array.from({ length: 1000 }, (_, i) => 1000 + i);
      const itemContext = new Map(
        workItemIds.map(id => [
          id,
          {
            id,
            title: `Item ${id}`,
            state: id % 2 === 0 ? 'Active' : 'New',
            type: id % 3 === 0 ? 'Bug' : 'Task',
            tags: id % 5 === 0 ? ['Critical'] : ['Normal'],
            daysInactive: id % 100
          }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const startTime = Date.now();

      // Test index selection on large dataset
      const indices = Array.from({ length: 100 }, (_, i) => i * 10);
      const result = queryHandleService.getItemsByIndices(handle, indices);

      const endTime = Date.now();

      expect(result).toHaveLength(100);
      expect(result![0]).toBe(1000);
      expect(result![99]).toBe(1990);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle complex criteria with many conditions on large dataset', () => {
      const workItemIds = Array.from({ length: 1000 }, (_, i) => 1000 + i);
      const itemContext = new Map(
        workItemIds.map(id => [
          id,
          {
            id,
            title: `Item ${id} ${id % 10 === 0 ? 'bug' : 'feature'}`,
            state: id % 3 === 0 ? 'Active' : id % 3 === 1 ? 'New' : 'Closed',
            type: id % 2 === 0 ? 'Bug' : 'Task',
            tags: id % 5 === 0 ? ['Critical', 'Security'] : id % 7 === 0 ? ['Performance'] : ['Normal'],
            daysInactive: id % 100
          }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const startTime = Date.now();

      // Complex criteria with multiple conditions
      const result = queryHandleService.getItemsByCriteria(handle, {
        states: ['Active', 'New'],
        titleContains: ['bug'],
        tags: ['Critical', 'Security'],
        daysInactiveMin: 20,
        daysInactiveMax: 80
      });

      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast even with complex criteria
    });

    it('should handle index array with many indices', () => {
      const workItemIds = Array.from({ length: 500 }, (_, i) => 2000 + i);
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000
      );

      const startTime = Date.now();

      // Select 250 indices
      const indices = Array.from({ length: 250 }, (_, i) => i * 2);
      const result = queryHandleService.getItemsByIndices(handle, indices);

      const endTime = Date.now();

      expect(result).toHaveLength(250);
      expect(result![0]).toBe(2000);
      expect(result![249]).toBe(2498);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });

    it('should efficiently filter large datasets with criteria', () => {
      const workItemIds = Array.from({ length: 2000 }, (_, i) => 3000 + i);
      const itemContext = new Map(
        workItemIds.map(id => [
          id,
          {
            id,
            title: `Item ${id}`,
            state: 'Active',
            type: 'Task',
            daysInactive: id % 200
          }
        ])
      );

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        itemContext
      );

      const startTime = Date.now();

      const result = queryHandleService.getItemsByCriteria(handle, {
        states: ['Active'],
        daysInactiveMin: 50,
        daysInactiveMax: 150
      });

      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result!.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should handle 2000 items efficiently
    });
  });
});

