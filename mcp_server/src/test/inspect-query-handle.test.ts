/**
 * Inspect Query Handle Handler Tests
 * 
 * Tests for the inspect-query-handle handler that provides enhanced
 * UX for understanding and selecting items from query handles.
 */

import { handleInspectQueryHandle } from '../services/handlers/query-handles/inspect-query-handle.handler.js';
import { queryHandleService } from '../services/query-handle-service.js';
import { z } from 'zod';

// Mock configuration
jest.mock('../config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project',
      areaPath: '',
      iterationPath: '',
      defaultWorkItemType: 'Task',
      defaultPriority: 2,
      defaultAssignedTo: '',
      inheritParentPaths: false
    }
  })),
  updateConfigFromCLI: jest.fn()
}));

// Mock Azure CLI validation
jest.mock('../services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

// Schema for testing
const inspectQueryHandleSchema = z.object({
  queryHandle: z.string().describe('Query handle to inspect'),
  includePreview: z.boolean().optional().default(true).describe('Include item preview'),
  includeStats: z.boolean().optional().default(true).describe('Include statistics'),
  includeExamples: z.boolean().optional().default(false).describe('Include selection examples')
});

describe('Inspect Query Handle Handler', () => {
  const mockConfig = {
    name: 'wit-inspect-query-handle',
    description: 'Test',
    script: '',
    schema: inspectQueryHandleSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  // Helper to create test data with rich context
  const createTestHandle = () => {
    const workItemIds = [123, 456, 789, 101112];
    const query = 'SELECT [System.Id] FROM WorkItems';
    
    const workItemContext = new Map();
    workItemContext.set(123, {
      title: 'Fix login bug',
      state: 'Active',
      type: 'Bug',
      daysInactive: 45,
      lastSubstantiveChangeDate: '2025-01-01T10:00:00Z',
      tags: 'frontend;urgent',
      assignedTo: 'John Doe'
    });
    workItemContext.set(456, {
      title: 'Update documentation',
      state: 'Active',
      type: 'Task',
      daysInactive: 10,
      lastSubstantiveChangeDate: '2025-01-15T14:30:00Z',
      tags: 'docs;low-priority',
      assignedTo: 'Jane Smith'
    });
    workItemContext.set(789, {
      title: 'Performance optimization',
      state: 'New',
      type: 'Task',
      daysInactive: 120,
      lastSubstantiveChangeDate: '2024-10-01T09:00:00Z',
      tags: 'backend;performance',
      assignedTo: 'Bob Johnson'
    });
    workItemContext.set(101112, {
      title: 'Security review',
      state: 'Done',
      type: 'Feature',
      daysInactive: 5,
      lastSubstantiveChangeDate: '2025-01-20T16:00:00Z',
      tags: 'security;critical',
      assignedTo: 'Alice Williams'
    });

    return queryHandleService.storeQuery(workItemIds, query, undefined, 60000, workItemContext);
  };

  describe('Enhanced Preview Functionality', () => {
    it('should return indexed preview with array indices', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.itemPreview).toBeDefined();
      expect(Array.isArray(result.data.itemPreview)).toBe(true);
      
      // Check first item has index, id, title, state, type
      const firstItem = result.data.itemPreview[0];
      expect(firstItem.index).toBe(0);
      expect(firstItem.id).toBe(123);
      expect(firstItem.title).toBe('Fix login bug');
      expect(firstItem.state).toBe('Active');
      expect(firstItem.type).toBe('Bug');
      expect(firstItem.tags).toEqual(['frontend', 'urgent']);
    });

    it('should include tags when present', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      const itemWithTags = result.data.itemPreview.find((item: any) => item.id === 123);
      expect(itemWithTags.tags).toEqual(['frontend', 'urgent']);
    });
  });

  describe('Selection Hints', () => {
    it('should provide selection hints', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selectionHints).toBeDefined();
      expect(Array.isArray(result.data.selectionHints)).toBe(true);
      expect(result.data.selectionHints.length).toBeGreaterThan(0);
      
      // Check for specific hints
      expect(result.data.selectionHints).toContain('Use index 0 to select the first item');
      expect(result.data.selectionHints).toContain('Use [0, 2, 5] to select specific items by index');
      expect(result.data.selectionHints.some((hint: string) => hint.includes('states'))).toBe(true);
      expect(result.data.selectionHints.some((hint: string) => hint.includes('tags'))).toBe(true);
      expect(result.data.selectionHints.some((hint: string) => hint.includes('daysInactiveMin'))).toBe(true);
    });
  });

  describe('Available Selection Criteria', () => {
    it('should show available selection criteria with counts', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.availableSelectionCriteria).toBeDefined();
      expect(Array.isArray(result.data.availableSelectionCriteria)).toBe(true);
      
      // Check for states, types, and tags summaries
      const criteriaStr = result.data.availableSelectionCriteria.join(' ');
      expect(criteriaStr).toContain('States available:');
      expect(criteriaStr).toContain('Work item types:');
      expect(criteriaStr).toContain('Tags available:');
      
      // Check for specific counts
      expect(criteriaStr).toContain('Active');
      expect(criteriaStr).toContain('Bug');
      expect(criteriaStr).toContain('frontend');
    });

    it('should show correct item counts for states', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      const statesLine = result.data.availableSelectionCriteria.find((line: string) => 
        line.startsWith('States available:')
      );
      
      expect(statesLine).toContain('Active (2 items)');
      expect(statesLine).toContain('New (1 item)');
      expect(statesLine).toContain('Done (1 item)');
    });

    it('should show correct item counts for types', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      const typesLine = result.data.availableSelectionCriteria.find((line: string) => 
        line.startsWith('Work item types:')
      );
      
      expect(typesLine).toContain('Bug (1 item)');
      expect(typesLine).toContain('Task (2 items)');
      expect(typesLine).toContain('Feature (1 item)');
    });
  });

  describe('Selection Statistics', () => {
    it('should include selection statistics', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selectionStats).toBeDefined();
      expect(result.data.selectionStats.totalItems).toBe(4);
      expect(result.data.selectionStats.byState).toBeDefined();
      expect(result.data.selectionStats.byType).toBeDefined();
      expect(result.data.selectionStats.byTags).toBeDefined();
    });

    it('should have accurate state statistics', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selectionStats.byState).toEqual({
        Active: 2,
        New: 1,
        Done: 1
      });
    });

    it('should have accurate type statistics', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selectionStats.byType).toEqual({
        Bug: 1,
        Task: 2,
        Feature: 1
      });
    });

    it('should have accurate tag statistics', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selectionStats.byTags).toEqual({
        frontend: 1,
        urgent: 1,
        docs: 1,
        'low-priority': 1,
        backend: 1,
        performance: 1,
        security: 1,
        critical: 1
      });
    });
  });

  describe('Contextual Examples', () => {
    it('should provide contextual selection examples when includeExamples is true', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true,
        includeExamples: true
      });

      expect(result.success).toBe(true);
      expect(result.data.exampleSelectors).toBeDefined();
      expect(Array.isArray(result.data.exampleSelectors)).toBe(true);
      expect(result.data.exampleSelectors.length).toBeGreaterThan(0);
      
      // Check examples reference actual data
      const examplesStr = result.data.exampleSelectors.join(' ');
      expect(examplesStr).toContain('all 4 items');
      expect(examplesStr).toContain('Active');
    });

    it('should omit contextual selection examples when includeExamples is false (default)', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true,
        includeExamples: false
      });

      expect(result.success).toBe(true);
      expect(result.data.exampleSelectors).toBeUndefined();
    });

    it('should omit contextual selection examples by default', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.exampleSelectors).toBeUndefined();
    });

    it('should include stale items example when applicable and includeExamples is true', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true,
        includeExamples: true
      });

      expect(result.success).toBe(true);
      const staleExample = result.data.exampleSelectors.find((ex: string) => 
        ex.includes('daysInactiveMin')
      );
      
      expect(staleExample).toBeDefined();
      expect(staleExample).toContain('stale');
    });
  });

  describe('Edge Cases', () => {
    it('should handle expired query handles', async () => {
      const workItemIds = [123, 456];
      const query = 'SELECT [System.Id] FROM WorkItems';
      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        undefined,
        -1 // Already expired
      );

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should handle missing itemContext gracefully', async () => {
      const workItemIds = [123, 456];
      const query = 'SELECT [System.Id] FROM WorkItems';
      // Don't provide workItemContext
      const handle = queryHandleService.storeQuery(workItemIds, query);

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.itemPreview).toBeDefined();
      expect(result.data.selectionStats).toBeDefined();
    });

    it('should work when includePreview is false', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: false
      });

      expect(result.success).toBe(true);
      expect(result.data.itemPreview).toBeUndefined();
      expect(result.data.selectionHints).toBeUndefined();
      expect(result.data.availableSelectionCriteria).toBeUndefined();
      expect(result.data.selectionStats).toBeUndefined();
    });

    it('should handle items without tags', async () => {
      const workItemIds = [123];
      const query = 'SELECT [System.Id] FROM WorkItems';
      
      const workItemContext = new Map();
      workItemContext.set(123, {
        title: 'Item without tags',
        state: 'Active',
        type: 'Bug',
        daysInactive: 5
        // No tags field
      });

      const handle = queryHandleService.storeQuery(workItemIds, query, undefined, 60000, workItemContext);

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selectionStats.byTags).toEqual({});
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain legacy preview format', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.preview).toBeDefined();
      expect(result.data.preview.showing).toBeDefined();
      expect(result.data.preview.items).toBeDefined();
    });

    it('should maintain legacy selection_info format', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_info).toBeDefined();
      expect(result.data.selection_info.total_selectable_indices).toBeDefined();
      expect(result.data.selection_info.available_criteria_tags).toBeDefined();
      // selection_examples should be omitted by default
      expect(result.data.selection_info.selection_examples).toBeUndefined();
    });

    it('should include selection_examples in legacy format when includeExamples is true', async () => {
      const handle = createTestHandle();

      const result = await handleInspectQueryHandle(mockConfig, {
        queryHandle: handle,
        includePreview: true,
        includeExamples: true
      });

      expect(result.success).toBe(true);
      expect(result.data.selection_info).toBeDefined();
      expect(result.data.selection_info.selection_examples).toBeDefined();
      expect(result.data.selection_info.selection_examples.select_all).toBeDefined();
      expect(result.data.selection_info.selection_examples.select_first_item).toBeDefined();
    });
  });
});
