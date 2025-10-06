/**
 * Integration tests for Query Handle Selection workflows
 * Tests end-to-end item selection patterns to ensure criteria-based selection works correctly
 */

import { queryHandleService } from '../services/query-handle-service.js';

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
});
