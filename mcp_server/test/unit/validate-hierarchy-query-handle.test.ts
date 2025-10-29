/**
 * Tests for wit-validate-hierarchy with query handle support
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleValidateHierarchy } from '../../src/services/handlers/analysis/validate-hierarchy.handler.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { validateHierarchyFastSchema } from '../../src/config/schemas.js';
import type { ToolConfig } from '../../src/types/index.js';

// Mock the dependencies
jest.mock('../../src/services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../../src/config/config.js', () => ({
  getRequiredConfig: jest.fn(() => ({
    organization: 'test-org',
    project: 'test-project',
    areaPath: 'Project\\Team'
  }))
}));

jest.mock('../../src/services/ado-work-item-service.js', () => ({
  queryWorkItemsByWiql: jest.fn(async ({ wiqlQuery }) => {
    const match = wiqlQuery.match(/IN \(([0-9, ]+)\)/);
    if (match) {
      const ids = match[1].split(',').map((id: string) => parseInt(id.trim()));
      return {
        workItems: ids.map((id: number) => ({
          id,
          title: `Work Item ${id}`,
          type: id === 101 ? 'Epic' : id === 102 ? 'Feature' : 'Task',
          state: 'Active',
          additionalFields: {
            'System.Parent': id === 102 ? 101 : id === 103 ? 102 : undefined
          }
        }))
      };
    }
    return { workItems: [] };
  })
}));

describe('Validate Hierarchy with Query Handle', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-validate-hierarchy',
    description: 'Test tool',
    script: '',
    schema: validateHierarchyFastSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Query Handle Support', () => {
    it('should validate hierarchy using query handle', async () => {
      const workItemIds = [101, 102, 103];
      const workItemContext = new Map([
        [101, { id: 101, title: 'Epic 1', state: 'Active', type: 'Epic' }],
        [102, { id: 102, title: 'Feature 1', state: 'Active', type: 'Feature' }],
        [103, { id: 103, title: 'Task 1', state: 'Active', type: 'Task' }]
      ]);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' },
        60000,
        workItemContext
      );

      const result = await handleValidateHierarchy(mockConfig, {
        queryHandle: handle,
        validateTypes: true,
        validateStates: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data && typeof result.data === 'object' && 'summary' in result.data) {
        expect((result.data as any).summary.totalItemsAnalyzed).toBe(3);
      }
    });

    it('should return error for expired/invalid query handle', async () => {
      const result = await handleValidateHierarchy(mockConfig, {
        queryHandle: 'qh_invalid_handle',
        validateTypes: true,
        validateStates: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Query handle')
      );
    });

    it('should return error when no input method provided', async () => {
      const result = await handleValidateHierarchy(mockConfig, {
        validateTypes: true,
        validateStates: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Either queryHandle or areaPath must be provided')
      );
    });
  });

  describe('Schema Validation', () => {
    it('should accept queryHandle in schema', () => {
      const validInput = {
        queryHandle: 'qh_test123',
        validateTypes: true,
        validateStates: true
      };

      const parsed = validateHierarchyFastSchema.safeParse(validInput);
      expect(parsed.success).toBe(true);
    });

    it('should make queryHandle optional', () => {
      const validInput = {
        workItemIds: [101, 102],
        validateTypes: true
      };

      const parsed = validateHierarchyFastSchema.safeParse(validInput);
      expect(parsed.success).toBe(true);
    });
  });
});
