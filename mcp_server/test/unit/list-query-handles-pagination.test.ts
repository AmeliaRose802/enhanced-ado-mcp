/**
 * Tests for wit-query-handle-list pagination functionality
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { handleListQueryHandles } from '../../src/services/handlers/query-handles/list-query-handles.handler.js';
import { listQueryHandlesSchema } from '../../src/config/schemas.js';
import * as adoDiscoveryService from '../../src/services/ado-discovery-service.js';

// Mock Azure CLI validation
jest.mock('../../src/services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({ isAvailable: true, isLoggedIn: true }))
}));

describe('List Query Handles Pagination', () => {
  beforeEach(() => {
    // Clear all handles before each test
    queryHandleService.clearAll();
  });

  afterEach(() => {
    // Clean up after each test
    queryHandleService.clearAll();
  });

  describe('Service Level Pagination', () => {
    it('should return paginated handles with default top=50 and skip=0', () => {
      // Create 100 test handles
      for (let i = 0; i < 100; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const result = queryHandleService.getAllHandles(false, 50, 0);

      expect(result.handles.length).toBe(50);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.skip).toBe(0);
      expect(result.pagination.top).toBe(50);
      expect(result.pagination.returned).toBe(50);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextSkip).toBe(50);
    });

    it('should return second page with skip=50', () => {
      // Create 100 test handles
      for (let i = 0; i < 100; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const result = queryHandleService.getAllHandles(false, 50, 50);

      expect(result.handles.length).toBe(50);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.skip).toBe(50);
      expect(result.pagination.top).toBe(50);
      expect(result.pagination.returned).toBe(50);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextSkip).toBeUndefined();
    });

    it('should handle partial last page', () => {
      // Create 75 test handles
      for (let i = 0; i < 75; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const result = queryHandleService.getAllHandles(false, 50, 50);

      expect(result.handles.length).toBe(25);
      expect(result.pagination.total).toBe(75);
      expect(result.pagination.skip).toBe(50);
      expect(result.pagination.top).toBe(50);
      expect(result.pagination.returned).toBe(25);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextSkip).toBeUndefined();
    });

    it('should handle skip beyond total', () => {
      // Create 10 test handles
      for (let i = 0; i < 10; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const result = queryHandleService.getAllHandles(false, 50, 100);

      expect(result.handles.length).toBe(0);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.skip).toBe(100);
      expect(result.pagination.top).toBe(50);
      expect(result.pagination.returned).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextSkip).toBeUndefined();
    });

    it('should respect custom top parameter', () => {
      // Create 100 test handles
      for (let i = 0; i < 100; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const result = queryHandleService.getAllHandles(false, 10, 0);

      expect(result.handles.length).toBe(10);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.top).toBe(10);
      expect(result.pagination.returned).toBe(10);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextSkip).toBe(10);
    });

    it('should handle empty result set', () => {
      const result = queryHandleService.getAllHandles(false, 50, 0);

      expect(result.handles.length).toBe(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.skip).toBe(0);
      expect(result.pagination.top).toBe(50);
      expect(result.pagination.returned).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextSkip).toBeUndefined();
    });
  });

  describe('Handler Level Pagination', () => {
    it('should return paginated response with default parameters', async () => {
      // Create 75 test handles
      for (let i = 0; i < 75; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const config = {
        name: 'wit-query-handle-list',
        schema: listQueryHandlesSchema,
        description: 'Test',
        script: '',
        inputSchema: { type: 'object' as const }
      };

      const result = await handleListQueryHandles(config, {});

      expect(result.success).toBe(true);
      expect((result.data as any).handles.length).toBe(50); // Default top
      expect((result.data as any).pagination.total).toBe(75);
      expect((result.data as any).pagination.hasMore).toBe(true);
      expect((result.data as any).pagination.nextSkip).toBe(50);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w: string) => w.includes('skip=50'))).toBe(true);
    });

    it('should accept custom top and skip parameters', async () => {
      // Create 100 test handles
      for (let i = 0; i < 100; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const config = {
        name: 'wit-query-handle-list',
        schema: listQueryHandlesSchema,
        description: 'Test',
        script: '',
        inputSchema: { type: 'object' as const }
      };

      const result = await handleListQueryHandles(config, { top: 25, skip: 25 });

      expect(result.success).toBe(true);
      expect((result.data as any).handles.length).toBe(25);
      expect((result.data as any).pagination.skip).toBe(25);
      expect((result.data as any).pagination.top).toBe(25);
      expect((result.data as any).pagination.hasMore).toBe(true);
    });

    it('should include pagination in metadata', async () => {
      // Create 10 test handles
      for (let i = 0; i < 10; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const config = {
        name: 'wit-query-handle-list',
        schema: listQueryHandlesSchema,
        description: 'Test',
        script: '',
        inputSchema: { type: 'object' as const }
      };

      const result = await handleListQueryHandles(config, {});

      expect(result.success).toBe(true);
      expect((result.metadata as any).pagination).toBeDefined();
      expect((result.metadata as any).pagination.total).toBe(10);
      expect((result.metadata as any).pagination.hasMore).toBe(false);
    });

    it('should add warning when more results available', async () => {
      // Create 100 test handles
      for (let i = 0; i < 100; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const config = {
        name: 'wit-query-handle-list',
        schema: listQueryHandlesSchema,
        description: 'Test',
        script: '',
        inputSchema: { type: 'object' as const }
      };

      const result = await handleListQueryHandles(config, { top: 20 });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Showing 20 of 100 handles. Use skip=20 to get the next page.');
    });

    it('should not add pagination warning when all results returned', async () => {
      // Create 10 test handles
      for (let i = 0; i < 10; i++) {
        queryHandleService.storeQuery([i], `test-query-${i}`, {});
      }

      const config = {
        name: 'wit-query-handle-list',
        schema: listQueryHandlesSchema,
        description: 'Test',
        script: '',
        inputSchema: { type: 'object' as const }
      };

      const result = await handleListQueryHandles(config, {});

      expect(result.success).toBe(true);
      expect(result.warnings.some((w: string) => w.includes('skip='))).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    it('should validate top parameter within range', () => {
      const validInput = { top: 100 };
      const result = listQueryHandlesSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject top parameter above max', () => {
      const invalidInput = { top: 300 };
      const result = listQueryHandlesSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject top parameter below min', () => {
      const invalidInput = { top: 0 };
      const result = listQueryHandlesSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject negative skip parameter', () => {
      const invalidInput = { skip: -10 };
      const result = listQueryHandlesSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should apply default values when not provided', () => {
      const result = listQueryHandlesSchema.parse({});
      expect(result.top).toBe(50);
      expect(result.skip).toBe(0);
      expect(result.includeExpired).toBe(false);
    });
  });
});

