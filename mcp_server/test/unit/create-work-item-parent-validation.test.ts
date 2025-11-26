/**
 * Tests for parent work item validation in create-workitem tool
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleCreateNewItem } from '../../src/services/handlers/core/create-new-item.handler';
import { createNewItemSchema } from '../../src/config/schemas';
import type { ToolConfig } from '../../src/types/index';

// Mock dependencies
jest.mock('../../src/config/config.js');
jest.mock('../../src/services/ado-work-item-service.js');
jest.mock('../../src/services/query-handle-service.js');
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Create Work Item - Parent Validation', () => {
  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  const toolConfig: ToolConfig = {
    name: 'create-workitem',
    description: 'Test',
    script: '',
    schema: createNewItemSchema,
    inputSchema: {} as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock getRequiredConfig
    const { getRequiredConfig } = require('../../src/config/config.js');
    getRequiredConfig.mockReturnValue({
      organization: 'test-org',
      project: 'TestProject',
      defaultAreaPath: 'TestProject\\Team',
      defaultAreaPaths: ['TestProject\\Team'],
      defaultWorkItemType: 'User Story',
      defaultPriority: 2,
      gitRepository: {
        repository: 'test-repo'
      }
    });
  });

  describe('Root-level work item types (no parent required)', () => {
    it('should allow creating an Epic without a parent', async () => {
      const { createWorkItem } = require('../../src/services/ado-work-item-service.js');
      const { queryHandleService } = require('../../src/services/query-handle-service.js');
      
      createWorkItem.mockResolvedValue({
        id: 123,
        title: 'Test Epic',
        type: 'Epic',
        state: 'New',
        parent_linked: false
      });
      
      queryHandleService.storeQuery.mockReturnValue('qh-123');

      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Epic',
        workItemType: 'Epic'
      });

      expect(result.success).toBe(true);
      expect(createWorkItem).toHaveBeenCalled();
    });

    it('should allow creating a Key Result without a parent', async () => {
      const { createWorkItem } = require('../../src/services/ado-work-item-service.js');
      const { queryHandleService } = require('../../src/services/query-handle-service.js');
      
      createWorkItem.mockResolvedValue({
        id: 124,
        title: 'Test Key Result',
        type: 'Key Result',
        state: 'New',
        parent_linked: false
      });
      
      queryHandleService.storeQuery.mockReturnValue('qh-124');

      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Key Result',
        workItemType: 'Key Result'
      });

      expect(result.success).toBe(true);
      expect(createWorkItem).toHaveBeenCalled();
    });
  });

  describe('Non-root work item types (parent required)', () => {
    it('should reject creating a Feature without a parent', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Feature',
        workItemType: 'Feature'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('parent work item is required');
      expect(result.errors[0]).toContain('analyze-bulk');
      expect(result.errors[0]).toContain('parent-recommendation');
    });

    it('should reject creating a User Story without a parent', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test User Story',
        workItemType: 'User Story'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('parent work item is required');
    });

    it('should reject creating a Task without a parent', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Task',
        workItemType: 'Task'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('parent work item is required');
    });

    it('should reject creating a Bug without a parent', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Bug',
        workItemType: 'Bug'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('parent work item is required');
    });

    it('should reject creating a Product Backlog Item without a parent', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test PBI',
        workItemType: 'Product Backlog Item'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('parent work item is required');
    });

    it('should reject using default work item type (User Story) without a parent', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Item'
        // workItemType not specified, will use default 'User Story'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('User Story');
      expect(result.errors[0]).toContain('requires a parent');
    });
  });

  describe('Work items with parents', () => {
    it('should allow creating a Feature with a parent', async () => {
      const { createWorkItem } = require('../../src/services/ado-work-item-service.js');
      const { queryHandleService } = require('../../src/services/query-handle-service.js');
      
      createWorkItem.mockResolvedValue({
        id: 125,
        title: 'Test Feature',
        type: 'Feature',
        state: 'New',
        parent_linked: true
      });
      
      queryHandleService.storeQuery.mockReturnValue('qh-125');

      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Feature',
        workItemType: 'Feature',
        parentWorkItemId: 100
      });

      expect(result.success).toBe(true);
      expect(createWorkItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Feature',
          workItemType: 'Feature',
          parentWorkItemId: 100
        })
      );
    });

    it('should allow creating a User Story with a parent', async () => {
      const { createWorkItem } = require('../../src/services/ado-work-item-service.js');
      const { queryHandleService } = require('../../src/services/query-handle-service.js');
      
      createWorkItem.mockResolvedValue({
        id: 126,
        title: 'Test User Story',
        type: 'User Story',
        state: 'New',
        parent_linked: true
      });
      
      queryHandleService.storeQuery.mockReturnValue('qh-126');

      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test User Story',
        workItemType: 'User Story',
        parentWorkItemId: 101
      });

      expect(result.success).toBe(true);
      expect(createWorkItem).toHaveBeenCalled();
    });
  });

  describe('Schema validation', () => {
    it('should validate at schema level when explicit work item type provided', () => {
      const result = createNewItemSchema.safeParse({
        title: 'Test Feature',
        workItemType: 'Feature'
        // No parent provided
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('parent');
      }
    });

    it('should pass schema validation for Epic without parent', () => {
      const result = createNewItemSchema.safeParse({
        title: 'Test Epic',
        workItemType: 'Epic'
      });

      expect(result.success).toBe(true);
    });

    it('should pass schema validation for Key Result without parent', () => {
      const result = createNewItemSchema.safeParse({
        title: 'Test Key Result',
        workItemType: 'Key Result'
      });

      expect(result.success).toBe(true);
    });

    it('should pass schema validation when parent is provided', () => {
      const result = createNewItemSchema.safeParse({
        title: 'Test Feature',
        workItemType: 'Feature',
        parentWorkItemId: 100
      });

      expect(result.success).toBe(true);
    });

    it('should pass schema validation when no workItemType specified (default will be checked at runtime)', () => {
      const result = createNewItemSchema.safeParse({
        title: 'Test Item'
        // workItemType not specified, default will be used at runtime
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace in work item type names', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Epic',
        workItemType: '  Epic  ' // With whitespace
      });

      expect(result.success).toBe(true);
    });

    it('should be case-sensitive for work item type names', async () => {
      const result = await handleCreateNewItem(toolConfig, {
        title: 'Test Item',
        workItemType: 'epic' // lowercase
      });

      // Should fail because 'epic' !== 'Epic'
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('parent work item is required');
    });
  });
});
