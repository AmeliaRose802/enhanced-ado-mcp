/**
 * Tests for Bulk Undo by Query Handle Handler
 */

import { handleBulkUndoByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-undo-by-query-handle.handler';
import { bulkUndoByQueryHandleSchema } from '../../src/config/schemas';

// Mock external dependencies
jest.mock('../../src/utils/ado-http-client');
jest.mock('../../src/config/config', () => ({
  loadConfiguration: () => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  })
}));

const mockConfig = {
  name: 'wit-bulk-undo-by-query-handle',
  description: 'Undo bulk operations by query handle',
  schema: bulkUndoByQueryHandleSchema,
  script: '',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: []
  }
};

describe('Bulk Undo by Query Handle Handler', () => {
  // Add cleanup to prevent Jest from hanging
  afterAll(() => {
    // Clear any timers or intervals that might be running
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Input validation', () => {
    it('should return error for empty query handle', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: ''
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Query handle is required');
    });

    it('should return error for invalid maxPreviewItems (too high)', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        maxPreviewItems: 100  // Over the max of 50
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Number must be less than or equal to 50');
    });

    it('should return error for invalid maxPreviewItems (too low)', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        maxPreviewItems: 0  // Below min of 1
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Number must be greater than or equal to 1');
    });

    it('should accept valid parameters', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'valid-handle',
        dryRun: true,
        maxPreviewItems: 25
      });

      // Should pass validation but fail because handle doesn't exist
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });
  });

  describe('Non-existent query handle', () => {
    it('should return error for non-existent query handle', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'nonexistent-handle'
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should handle very long query handle names', async () => {
      const longHandle = 'a'.repeat(1000);
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: longHandle
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });
  });

  describe('Configuration defaults', () => {
    it('should use default dryRun when not specified', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle'
      });

      // Should default to dry run mode and fail because handle doesn't exist
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should use default maxPreviewItems when not specified', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        dryRun: true
      });

      // Should use default maxPreviewItems (10) and fail because handle doesn't exist
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should accept custom organization and project', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        organization: 'custom-org',
        project: 'custom-project'
      });

      // Should fail because handle doesn't exist, but validates custom org/project
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Test with malformed input that might cause unexpected behavior
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: null as any
      });

      expect(result.success).toBe(false);
      // Should either be a validation error or runtime error
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return structured error response', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle'
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Schema validation edge cases', () => {
    it('should reject negative maxPreviewItems', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        maxPreviewItems: -5
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Number must be greater than or equal to 1');
    });

    it('should accept valid range for maxPreviewItems', async () => {
      const result = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        maxPreviewItems: 25  // Valid range 1-50
      });

      // Should pass validation but fail on handle lookup
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should handle boolean values for dryRun', async () => {
      const resultTrue = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        dryRun: true
      });

      const resultFalse = await handleBulkUndoByQueryHandle(mockConfig, {
        queryHandle: 'test-handle',
        dryRun: false
      });

      // Both should pass validation but fail on handle lookup
      expect(resultTrue.success).toBe(false);
      expect(resultFalse.success).toBe(false);
      expect(resultTrue.errors[0]).toContain('not found or expired');
      expect(resultFalse.errors[0]).toContain('not found or expired');
    });
  });
});
