/**
 * Integration Tests for Bulk Undo Handler
 * Uses real queryHandleService with in-memory state
 */

import { handleBulkUndoByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-undo-by-query-handle.handler';
import { queryHandleService } from '../../src/services/query-handle-service';
import { bulkUndoByQueryHandleSchema } from '../../src/config/schemas';

const mockConfig: any = {
  name: 'wit-bulk-undo-by-query-handle',
  schema: bulkUndoByQueryHandleSchema
};

describe('Bulk Undo Integration Tests', () => {
  beforeEach(() => {
    // Clear all query handles before each test
    queryHandleService.clearAll();
  });

  describe('Query handle validation', () => {
    it('should return error if query handle not found', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'nonexistent-handle'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should return error if no operation history exists', async () => {
      // Create a query handle without operation history
      const handleId = queryHandleService.storeQuery(
        [1, 2, 3],
        'SELECT [System.Id] FROM WorkItems'
      );

      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: handleId
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No operation history found');
    });
  });

  describe('Dry run validation', () => {
    it('should preview undo without making changes when dryRun is true', async () => {
      // Create query handle
      const handleId = queryHandleService.storeQuery(
        [101, 102],
        'SELECT [System.Id] FROM WorkItems'
      );

      // Add operation history
      queryHandleService.recordOperation(
        handleId,
        'bulk-update',
        [
          {
            workItemId: 101,
            changes: { '/fields/System.State': { old: 'New', new: 'Active' } }
          },
          {
            workItemId: 102,
            changes: { '/fields/System.State': { old: 'New', new: 'Active' } }
          }
        ]
      );

      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: handleId,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as any;
      expect(data.dry_run).toBe(true);
      expect(data.operation_to_undo).toBe('bulk-update');
      expect(data.items_to_revert).toBe(2);
      expect(data.preview_items).toBeDefined();
      expect(Array.isArray(data.preview_items)).toBe(true);
    });

    it('should limit preview items to maxPreviewItems', async () => {
      const itemsAffected = Array.from({ length: 20 }, (_, i) => ({
        workItemId: 100 + i,
        changes: { '/fields/System.State': { old: 'New', new: 'Active' } }
      }));

      const handleId = queryHandleService.storeQuery(
        itemsAffected.map(i => i.workItemId),
        'SELECT [System.Id] FROM WorkItems'
      );

      queryHandleService.recordOperation(
        handleId,
        'bulk-update',
        itemsAffected
      );

      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: handleId,
        dryRun: true,
        maxPreviewItems: 5
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.items_to_revert).toBe(20);
      expect(data.preview_items.length).toBeLessThanOrEqual(5);
    });

    it('should include warning for bulk-comment operations', async () => {
      const handleId = queryHandleService.storeQuery(
        [101],
        'SELECT [System.Id] FROM WorkItems'
      );

      queryHandleService.recordOperation(
        handleId,
        'bulk-comment',
        [
          {
            workItemId: 101,
            changes: { comment: 'Test comment' }
          }
        ]
      );

      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: handleId,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('does not support deleting comments'))).toBe(true);
    });
  });

  describe('Default behavior', () => {
    it('should default to dryRun=true', async () => {
      const handleId = queryHandleService.storeQuery(
        [101],
        'SELECT [System.Id] FROM WorkItems'
      );

      queryHandleService.recordOperation(
        handleId,
        'bulk-update',
        [
          {
            workItemId: 101,
            changes: { '/fields/System.State': { old: 'New', new: 'Active' } }
          }
        ]
      );

      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: handleId
        // dryRun not specified, should default to true
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.dry_run).toBe(true);
    });
  });

  describe('Multiple operations in history', () => {
    it('should undo only the last operation', async () => {
      const handleId = queryHandleService.storeQuery(
        [601],
        'SELECT [System.Id] FROM WorkItems'
      );

      // Add multiple operations
      queryHandleService.recordOperation(
        handleId,
        'bulk-update',
        [
          {
            workItemId: 601,
            changes: { '/fields/System.State': { old: 'New', new: 'Active' } }
          }
        ]
      );

      queryHandleService.recordOperation(
        handleId,
        'bulk-assign',
        [
          {
            workItemId: 601,
            changes: { '/fields/System.AssignedTo': { old: null, new: 'User A' } }
          }
        ]
      );

      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: handleId,
        dryRun: true
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.operation_to_undo).toBe('bulk-assign');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid arguments gracefully', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        // Missing required queryHandle
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty query handle', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: ''
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
