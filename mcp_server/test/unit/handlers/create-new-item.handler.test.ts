/**
 * Comprehensive Error Handling Tests for Create New Item Handler
 * 
 * Focus: Error scenarios and validation edge cases
 * - Invalid parent work item IDs
 * - Missing required fields
 * - Template errors
 * - Multi-area path validation
 * - Work item type restrictions
 * - Azure CLI errors
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ToolConfig } from '../../../src/types/index.js';

// Mock dependencies
const mockValidateAndParse = jest.fn<any>();
const mockCreateWorkItem = jest.fn<any>();
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
const mockQueryHandleService = {
  storeQuery: jest.fn<any>()
};
const mockTemplateService = {
  mergeTemplateWithArgs: jest.fn<any>()
};
const mockGetRequiredConfig = jest.fn<any>();

jest.mock('../../../src/utils/handler-helpers.js', () => ({
  validateAndParse: mockValidateAndParse
}));

jest.mock('../../../src/services/ado-work-item-service.js', () => ({
  createWorkItem: mockCreateWorkItem
}));

jest.mock('../../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

jest.mock('../../../src/services/query-handle-service.js', () => ({
  queryHandleService: mockQueryHandleService
}));

jest.mock('../../../src/services/template-service.js', () => ({
  templateService: mockTemplateService
}));

// Import handler after mocks
import { handleCreateNewItem } from '../../../src/services/handlers/core/create-new-item.handler.js';

describe('Create New Item Handler - Error Scenarios', () => {
  const mockConfig: ToolConfig = {
    name: 'create-workitem',
    description: 'Create work item',
    script: 'test',
    schema: {} as any,
    inputSchema: {} as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks for successful path
    mockGetRequiredConfig.mockReturnValue({
      organization: 'test-org',
      project: 'test-project',
      defaultAreaPath: 'test-area',
      defaultAreaPaths: ['test-area'],
      defaultWorkItemType: 'Task',
      defaultPriority: 2
    });
    
    mockValidateAndParse.mockReturnValue({
      success: true,
      data: {
        title: 'Test Item',
        description: 'Test Description'
      }
    });

    // Mock dynamic import
    jest.mock('../../../src/config/config.js', () => ({
      getRequiredConfig: mockGetRequiredConfig
    }), { virtual: true });
  });

  describe('Template Errors', () => {
    it('should handle template not found error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          template: 'non-existent-template',
          title: 'Test Item'
        }
      });

      (mockTemplateService.mergeTemplateWithArgs as jest.Mock).mockRejectedValue(
        new Error('Template "non-existent-template" not found')
      );

      const result = await handleCreateNewItem(mockConfig, { template: 'non-existent-template' });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Template error: Template "non-existent-template" not found');
    });

    it('should handle template parsing error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          template: 'invalid-template',
          title: 'Test'
        }
      });

      (mockTemplateService.mergeTemplateWithArgs as jest.Mock).mockRejectedValue(
        new Error('Invalid template syntax at line 5')
      );

      const result = await handleCreateNewItem(mockConfig, { template: 'invalid-template' });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Template error: Invalid template syntax at line 5');
    });

    it('should handle template variable substitution error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          template: 'test-template',
          title: 'Test'
        }
      });

      (mockTemplateService.mergeTemplateWithArgs as jest.Mock).mockRejectedValue(
        new Error('Missing required variable: {projectName}')
      );

      const result = await handleCreateNewItem(mockConfig, { template: 'test-template' });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Template error');
    });
  });

  describe('Parent Work Item Validation Errors', () => {
    it('should reject Task without parent', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test Task',
          workItemType: 'Task'
          // No parentWorkItemId
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('requires a parent');
      expect(result.errors[0]).toContain('Task');
    });

    it('should reject Product Backlog Item without parent', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test PBI',
          workItemType: 'Product Backlog Item'
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('requires a parent');
    });

    it('should reject Bug without parent', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test Bug',
          workItemType: 'Bug'
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('analyze-bulk');
      expect(result.errors[0]).toContain('parent-recommendation');
    });

    it('should allow Epic without parent', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test Epic',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockResolvedValue({
        id: 123,
        title: 'Test Epic',
        state: 'New',
        type: 'Epic',
        parent_linked: false
      });

      mockQueryHandleService.storeQuery.mockReturnValue('qh-123');

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(true);
    });

    it('should allow Key Result without parent', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test Key Result',
          workItemType: 'Key Result'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockResolvedValue({
        id: 124,
        title: 'Test Key Result',
        state: 'New',
        type: 'Key Result',
        parent_linked: false
      });

      mockQueryHandleService.storeQuery.mockReturnValue('qh-124');

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(true);
    });
  });

  describe('Multi-Area Path Configuration Errors', () => {
    it('should reject when multiple area paths configured and none specified', async () => {
      mockGetRequiredConfig.mockReturnValue({
        organization: 'test-org',
        project: 'test-project',
        defaultAreaPath: 'area1',
        defaultAreaPaths: ['area1', 'area2', 'area3'],
        defaultWorkItemType: 'Epic'
      });

      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic'
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Multiple area paths configured');
      expect(result.errors[0]).toContain('area1, area2, area3');
    });

    it('should reject when specified area path not in configured list', async () => {
      mockGetRequiredConfig.mockReturnValue({
        organization: 'test-org',
        project: 'test-project',
        defaultAreaPath: 'area1',
        defaultAreaPaths: ['area1', 'area2'],
        defaultWorkItemType: 'Epic'
      });

      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic',
          areaPath: 'area3'
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not in configured paths');
      expect(result.errors[0]).toContain('area3');
    });

    it('should accept when area path matches configured list', async () => {
      mockGetRequiredConfig.mockReturnValue({
        organization: 'test-org',
        project: 'test-project',
        defaultAreaPaths: ['area1', 'area2'],
        defaultWorkItemType: 'Epic'
      });

      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic',
          areaPath: 'area2'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockResolvedValue({
        id: 125,
        title: 'Test',
        state: 'New',
        type: 'Epic',
        parent_linked: false
      });

      mockQueryHandleService.storeQuery.mockReturnValue('qh-125');

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(true);
    });
  });

  describe('Work Item Creation API Errors', () => {
    it('should handle Azure DevOps API failure', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(new Error('TF400898: An Internal Error Occurred'));

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors).toContain('TF400898: An Internal Error Occurred');
    });

    it('should handle parent work item not found', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test Task',
          workItemType: 'Task',
          parentWorkItemId: 999999
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(
        new Error('Parent work item 999999 not found')
      );

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('999999');
    });

    it('should handle invalid parent type (cannot link to Bug)', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test Task',
          workItemType: 'Task',
          parentWorkItemId: 100
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(
        new Error('Cannot create parent-child link between Task and Bug')
      );

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('parent-child link');
    });

    it('should handle unauthorized error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(new Error('HTTP 401: Unauthorized'));

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors).toContain('HTTP 401: Unauthorized');
    });

    it('should handle insufficient permissions error', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(
        new Error('TF400813: The user does not have permissions')
      );

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('TF400813');
    });

    it('should handle network timeout', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(new Error('Request timeout after 30000ms'));

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('timeout');
    });
  });

  describe('Validation Errors from validateAndParse', () => {
    it('should handle missing title field', async () => {
      mockValidateAndParse.mockReturnValue({
        success: false,
        error: {
          success: false,
          data: null,
          errors: ['Missing required field: title'],
          warnings: [],
          metadata: { source: 'validation' }
        }
      });

      const result = await handleCreateNewItem(mockConfig, { description: 'No title' });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: title');
    });

    it('should handle Azure CLI not available', async () => {
      mockValidateAndParse.mockReturnValue({
        success: false,
        error: {
          success: false,
          data: null,
          errors: ['Azure CLI is not installed or not available in PATH'],
          warnings: [],
          metadata: { source: 'validation' }
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
    });

    it('should handle Azure CLI not logged in', async () => {
      mockValidateAndParse.mockReturnValue({
        success: false,
        error: {
          success: false,
          data: null,
          errors: ['Azure CLI is not logged in. Run: az login'],
          warnings: [],
          metadata: { source: 'validation' }
        }
      });

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('az login');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty title string', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: '',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(
        new Error('Title cannot be empty')
      );

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
    });

    it('should handle title with only whitespace', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: '   ',
          workItemType: 'Epic'
        }
      });

      (mockCreateWorkItem as jest.Mock).mockRejectedValue(
        new Error('Title cannot contain only whitespace')
      );

      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
    });

    it('should handle work item type with leading/trailing whitespace', async () => {
      mockValidateAndParse.mockReturnValue({
        success: true,
        data: {
          title: 'Test',
          workItemType: ' Task '
        }
      });

      // Should trim and check parent requirement
      const result = await handleCreateNewItem(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Task');
      expect(result.errors[0]).toContain('requires a parent');
    });
  });
});
