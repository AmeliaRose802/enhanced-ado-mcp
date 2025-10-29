/**
 * Tests for bulk operation preview limits (maxPreviewItems parameter)
 * Validates that all bulk operations respect the preview item limit in dry-run mode
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleBulkAssignByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-assign-by-query-handle.handler.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleBulkRemoveByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-remove-by-query-handle.handler.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleBulkUpdateByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-update-by-query-handle.handler.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleBulkCommentByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-comment-by-query-handle.handler.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { 
  bulkAssignByQueryHandleSchema,
  bulkRemoveByQueryHandleSchema,
  bulkUpdateByQueryHandleSchema,
  bulkCommentByQueryHandleSchema
} from '../../src/config/schemas.js';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import type { ToolConfig } from '../../src/types/index.js';

// Mock the dependencies
jest.mock('../../src/services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    patch: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({})
  }))
}));

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  }))
}));

describe('Bulk Operations Preview Limits', () => {
  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Default preview limit (5 items)', () => {
    it('should default to 5 items for bulk-assign', async () => {
      const workItemIds = Array.from({ length: 20 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(5);
      expect((result.data as any).selected_items_count).toBe(20);
      expect((result.data as any).preview_message).toBe('Showing 5 of 20 items...');
    });

    it('should default to 5 items for bulk-remove', async () => {
      const workItemIds = Array.from({ length: 15 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-remove',
        description: 'Test tool',
        script: '',
        schema: bulkRemoveByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkRemoveByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        removeReason: 'Test removal',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(5);
      expect((result.data as any).selected_items_count).toBe(15);
      expect((result.data as any).preview_message).toBe('Showing 5 of 15 items...');
    });

    it('should default to 10 items for bulk-update', async () => {
      const workItemIds = Array.from({ length: 12 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-update',
        description: 'Test tool',
        script: '',
        schema: bulkUpdateByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkUpdateByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        updates: [{ op: 'add', path: '/fields/System.State', value: 'Resolved' }],
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(10);
      expect((result.data as any).selected_items_count).toBe(12);
      expect((result.data as any).preview_message).toBe('Showing 10 of 12 items...');
    });

    it('should default to 10 items for bulk-comment', async () => {
      const workItemIds = Array.from({ length: 10 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-comment',
        description: 'Test tool',
        script: '',
        schema: bulkCommentByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkCommentByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        comment: 'Test comment',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(10);
      expect((result.data as any).selected_items_count).toBe(10);
      expect((result.data as any).preview_message).toBeUndefined(); // All 10 items shown, no truncation
    });
  });

  describe('Custom preview limits', () => {
    it('should respect custom limit of 1', async () => {
      const workItemIds = Array.from({ length: 20 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 1
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(1);
      expect((result.data as any).selected_items_count).toBe(20);
      expect((result.data as any).preview_message).toBe('Showing 1 of 20 items...');
    });

    it('should respect custom limit of 10', async () => {
      const workItemIds = Array.from({ length: 20 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 10
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(10);
      expect((result.data as any).selected_items_count).toBe(20);
      expect((result.data as any).preview_message).toBe('Showing 10 of 20 items...');
    });

    it('should respect custom limit of 50', async () => {
      const workItemIds = Array.from({ length: 100 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 50
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(50);
      expect((result.data as any).selected_items_count).toBe(100);
      expect((result.data as any).preview_message).toBe('Showing 50 of 100 items...');
    });
  });

  describe('Truncation message handling', () => {
    it('should show truncation message when preview is limited', async () => {
      const workItemIds = Array.from({ length: 20 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 3
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_message).toBeDefined();
      expect((result.data as any).preview_message).toBe('Showing 3 of 20 items...');
    });

    it('should not show truncation message when preview shows all items', async () => {
      const workItemIds = Array.from({ length: 3 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 5
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(3);
      expect((result.data as any).preview_message).toBeUndefined();
    });

    it('should not show truncation message when limit equals selected count', async () => {
      const workItemIds = Array.from({ length: 5 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 5
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(5);
      expect((result.data as any).preview_message).toBeUndefined();
    });
  });

  describe('Total count always shown', () => {
    it('should always show total selected count even when preview is limited', async () => {
      const workItemIds = Array.from({ length: 50 }, (_, i) => 1000 + i);
      const workItemContext = new Map(
        workItemIds.map(id => [
          id,
          { id, title: `Task ${id}`, state: 'Active', type: 'Task', assignedTo: '' }
        ])
      );
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: 'all',
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 2
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(2);
      expect((result.data as any).selected_items_count).toBe(50);
      expect((result.data as any).total_items_in_handle).toBe(50);
    });

    it('should show correct counts with itemSelector criteria', async () => {
      const workItemIds = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010];
      const workItemContext = new Map([
        [1001, { id: 1001, title: 'Task 1', state: 'New', type: 'Task', assignedTo: '' }],
        [1002, { id: 1002, title: 'Task 2', state: 'Active', type: 'Task', assignedTo: '' }],
        [1003, { id: 1003, title: 'Task 3', state: 'New', type: 'Task', assignedTo: '' }],
        [1004, { id: 1004, title: 'Task 4', state: 'Active', type: 'Task', assignedTo: '' }],
        [1005, { id: 1005, title: 'Task 5', state: 'New', type: 'Task', assignedTo: '' }],
        [1006, { id: 1006, title: 'Task 6', state: 'Active', type: 'Task', assignedTo: '' }],
        [1007, { id: 1007, title: 'Task 7', state: 'New', type: 'Task', assignedTo: '' }],
        [1008, { id: 1008, title: 'Task 8', state: 'Active', type: 'Task', assignedTo: '' }],
        [1009, { id: 1009, title: 'Task 9', state: 'New', type: 'Task', assignedTo: '' }],
        [1010, { id: 1010, title: 'Task 10', state: 'Active', type: 'Task', assignedTo: '' }]
      ]);

      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const config: ToolConfig = {
        name: 'wit-bulk-assign',
        description: 'Test tool',
        script: '',
        schema: bulkAssignByQueryHandleSchema,
        inputSchema: { type: 'object' as const }
      };

      const result = await handleBulkAssignByQueryHandle(config, {
        queryHandle: handle,
        itemSelector: { states: ['New'] },
        assignTo: 'user@company.com',
        dryRun: true,
        maxPreviewItems: 2
      });

      expect(result.success).toBe(true);
      expect((result.data as any).preview_items).toHaveLength(2);
      expect((result.data as any).selected_items_count).toBe(5); // Only 5 New items
      expect((result.data as any).total_items_in_handle).toBe(10); // Total in handle
      expect((result.data as any).preview_message).toBe('Showing 2 of 5 items...');
    });
  });

  describe('Schema validation', () => {
    it('should validate maxPreviewItems min value (1)', () => {
      const result = bulkAssignByQueryHandleSchema.safeParse({
        queryHandle: 'test',
        assignTo: 'user@test.com',
        maxPreviewItems: 0
      });

      expect(result.success).toBe(false);
    });

    it('should validate maxPreviewItems max value (50)', () => {
      const result = bulkAssignByQueryHandleSchema.safeParse({
        queryHandle: 'test',
        assignTo: 'user@test.com',
        maxPreviewItems: 51
      });

      expect(result.success).toBe(false);
    });

    it('should accept valid maxPreviewItems values', () => {
      const result1 = bulkAssignByQueryHandleSchema.safeParse({
        queryHandle: 'test',
        assignTo: 'user@test.com',
        maxPreviewItems: 1
      });
      expect(result1.success).toBe(true);

      const result2 = bulkAssignByQueryHandleSchema.safeParse({
        queryHandle: 'test',
        assignTo: 'user@test.com',
        maxPreviewItems: 25
      });
      expect(result2.success).toBe(true);

      const result3 = bulkAssignByQueryHandleSchema.safeParse({
        queryHandle: 'test',
        assignTo: 'user@test.com',
        maxPreviewItems: 50
      });
      expect(result3.success).toBe(true);
    });
  });
});

