/**
 * Tests for unified-bulk-operations handler
 * Validates all action types and sequential execution
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleUnifiedBulkOperations } from '../../src/services/handlers/bulk-operations/unified-bulk-operations.handler.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { unifiedBulkOperationsSchema } from '../../src/config/schemas.js';
import type { ToolConfig } from '../../src/types/index.js';

// Mock the dependencies
jest.mock('../../src/utils/azure-cli-validator', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

const mockPostFn = jest.fn() as jest.MockedFunction<any>;
const mockPatchFn = jest.fn() as jest.MockedFunction<any>;
const mockGetFn = jest.fn() as jest.MockedFunction<any>;

jest.mock('../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    post: mockPostFn,
    patch: mockPatchFn,
    get: mockGetFn
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

jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => async () => 'mock-token'),
  setTokenProvider: jest.fn()
}));

describe('Unified Bulk Operations Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-unified-bulk-operations',
    description: 'Test tool',
    script: '',
    schema: unifiedBulkOperationsSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
    mockPostFn.mockResolvedValue({});
    mockPatchFn.mockResolvedValue({});
    mockGetFn.mockResolvedValue({
      data: {
        fields: {
          'System.Tags': 'existing-tag'
        }
      }
    });
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  describe('Dry Run Mode', () => {
    it('should preview operations without executing in dry-run mode', async () => {
      // Arrange
      const workItemIds = [101, 102, 103];
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

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Test comment' },
          { type: 'assign', assignTo: 'test@example.com' }
        ],
        dryRun: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).dry_run).toBe(true);
      expect((result.data as any).actions_completed).toBe(2);
      expect((result.data as any).actions_failed).toBe(0);
      expect(mockPostFn).not.toHaveBeenCalled();
      expect(mockPatchFn).not.toHaveBeenCalled();
    });
  });

  describe('Comment Action', () => {
    it('should add comments to all work items', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPostFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Test comment' }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPostFn).toHaveBeenCalledTimes(2);
      expect(mockPostFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101/comments'),
        expect.objectContaining({
          text: 'Test comment',
          format: 1
        })
      );
    });

    it('should handle comment failures gracefully', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPostFn
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Comment failed'));

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Test comment' }
        ],
        dryRun: false,
        stopOnError: false
      });

      // Assert
      expect(result.success).toBe(false);
      expect((result.data as any).action_results[0].items_succeeded).toBe(1);
      expect((result.data as any).action_results[0].items_failed).toBe(1);
    });
  });

  describe('Update Action', () => {
    it('should update work item fields', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'update',
            updates: [
              { op: 'replace', path: '/fields/System.Priority', value: 1 }
            ]
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.Priority',
            value: 1
          })
        ])
      );
    });
  });

  describe('Assign Action', () => {
    it('should assign work items to user', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'assign',
            assignTo: 'john.doe@example.com'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPatchFn).toHaveBeenCalledTimes(2);
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.AssignedTo',
            value: 'john.doe@example.com'
          })
        ])
      );
    });

    it('should add comment when assigning with comment', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPatchFn.mockResolvedValue({});
      mockPostFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'assign',
            assignTo: 'john.doe@example.com',
            comment: 'Assigning to you for review'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPatchFn).toHaveBeenCalledTimes(1); // Assignment
      expect(mockPostFn).toHaveBeenCalledTimes(1); // Comment
    });
  });

  describe('Remove Action', () => {
    it('should move work items to Removed state', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'remove',
            removeReason: 'Duplicate item'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPostFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101/comments'),
        expect.objectContaining({
          text: 'Removal reason: Duplicate item'
        })
      );
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.State',
            value: 'Removed'
          })
        ])
      );
    });
  });

  describe('Transition State Action', () => {
    it('should transition work items to new state', async () => {
      // Arrange
      const workItemIds = [101, 102];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'transition-state',
            targetState: 'Closed',
            reason: 'Completed'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.State',
            value: 'Closed'
          }),
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.Reason',
            value: 'Completed'
          })
        ])
      );
    });
  });

  describe('Move Iteration Action', () => {
    it('should move work items to new iteration', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'move-iteration',
            targetIterationPath: 'MyProject\\Sprint 5'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.IterationPath',
            value: 'MyProject\\Sprint 5'
          })
        ])
      );
    });
  });

  describe('Add Tag Action', () => {
    it('should add tags to work items', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockGetFn.mockResolvedValue({
        data: {
          fields: {
            'System.Tags': 'existing-tag'
          }
        }
      });
      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'add-tag',
            tags: 'new-tag; another-tag'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockGetFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101?fields=System.Tags')
      );
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.Tags',
            value: expect.stringContaining('existing-tag')
          })
        ])
      );
    });
  });

  describe('Remove Tag Action', () => {
    it('should remove tags from work items', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockGetFn.mockResolvedValue({
        data: {
          fields: {
            'System.Tags': 'tag1; tag2; tag3'
          }
        }
      });
      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          {
            type: 'remove-tag',
            tags: 'tag2'
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPatchFn).toHaveBeenCalledWith(
        expect.stringContaining('wit/workItems/101'),
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/fields/System.Tags',
            value: expect.not.stringContaining('tag2')
          })
        ])
      );
    });
  });

  describe('Sequential Execution', () => {
    it('should execute multiple actions sequentially', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPostFn.mockResolvedValue({});
      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Starting work' },
          { type: 'assign', assignTo: 'user@example.com' },
          {
            type: 'update',
            updates: [
              { op: 'replace', path: '/fields/System.Priority', value: 1 }
            ]
          }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).actions_completed).toBe(3);
      expect((result.data as any).actions_failed).toBe(0);
      expect(mockPostFn).toHaveBeenCalledTimes(1); // Comment
      expect(mockPatchFn).toHaveBeenCalledTimes(2); // Assign + Update
    });

    it('should stop on error when stopOnError is true', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPostFn.mockRejectedValueOnce(new Error('Comment failed'));

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Will fail' },
          { type: 'assign', assignTo: 'user@example.com' } // Should not execute
        ],
        dryRun: false,
        stopOnError: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect((result.data as any).actions_completed).toBe(0);
      expect((result.data as any).actions_failed).toBe(1);
      expect(mockPatchFn).not.toHaveBeenCalled(); // Second action not executed
    });

    it('should continue on error when stopOnError is false', async () => {
      // Arrange
      const workItemIds = [101];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPostFn.mockRejectedValueOnce(new Error('Comment failed'));
      mockPatchFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Will fail' },
          { type: 'assign', assignTo: 'user@example.com' } // Should still execute
        ],
        dryRun: false,
        stopOnError: false
      });

      // Assert
      expect(result.success).toBe(false);
      expect((result.data as any).actions_completed).toBe(1);
      expect((result.data as any).actions_failed).toBe(1);
      expect(mockPatchFn).toHaveBeenCalled(); // Second action executed
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid query handle', async () => {
      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: 'invalid-handle',
        actions: [
          { type: 'comment', comment: 'Test' }
        ]
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not found or expired');
    });

    it('should return error for empty work item selection', async () => {
      // Arrange
      const handle = queryHandleService.storeQuery(
        [],
        'SELECT [System.Id] FROM WorkItems WHERE 1=0',
        { project: 'TestProject', queryType: 'wiql' }
      );

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        actions: [
          { type: 'comment', comment: 'Test' }
        ]
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No work items matched');
    });
  });

  describe('Item Selector Support', () => {
    it('should support itemSelector with indices', async () => {
      // Arrange
      const workItemIds = [101, 102, 103, 104];
      const handle = queryHandleService.storeQuery(
        workItemIds,
        'SELECT [System.Id] FROM WorkItems',
        { project: 'TestProject', queryType: 'wiql' }
      );

      mockPostFn.mockResolvedValue({});

      // Act
      const result = await handleUnifiedBulkOperations(mockConfig, {
        queryHandle: handle,
        itemSelector: [0, 2], // Select items at indices 0 and 2 (101 and 103)
        actions: [
          { type: 'comment', comment: 'Selected items only' }
        ],
        dryRun: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect((result.data as any).items_selected).toBe(2);
      expect(mockPostFn).toHaveBeenCalledTimes(2);
    });
  });
});
