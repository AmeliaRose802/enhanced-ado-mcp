// @ts-nocheck
/**
 * Backlog Cleanup Analyzer Handler Tests
 * 
 * Tests for the wit-backlog-cleanup-analyzer tool that analyzes
 * backlog items and returns separate query handles for each category.
 */

import { handleBacklogCleanupAnalyzer } from '../../src/services/handlers/ai-powered/backlog-cleanup-analyzer.handler';
import { queryHandleService } from '../../src/services/query-handle-service';
import { backlogCleanupAnalyzerSchema } from '../../src/config/schemas';
import type { ToolConfig } from '../../src/types/index';

// Mock dependencies
jest.mock('../../src/services/ado-discovery-service', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

jest.mock('../../src/services/ado-work-item-service', () => ({
  queryWorkItemsByWiql: jest.fn()
}));

jest.mock('../../src/config/config', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project'
    }
  })),
  getRequiredConfig: jest.fn(() => ({
    organization: 'test-org',
    project: 'test-project',
    defaultWorkItemType: 'Task',
    defaultPriority: 2,
    defaultAreaPath: 'TestProject\\TestArea',
    defaultIterationPath: '',
    gitRepository: { defaultBranch: 'main' },
    gitHubCopilot: { guid: '' }
  }))
}));

import { queryWorkItemsByWiql } from '../../src/services/ado-work-item-service';

describe('Backlog Cleanup Analyzer Handler', () => {
  const mockConfig: ToolConfig = {
    name: 'wit-backlog-cleanup-analyzer',
    description: 'Test tool',
    script: '',
    schema: backlogCleanupAnalyzerSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
    jest.clearAllMocks();
  });

  describe('Category Handle Creation', () => {
    it('should return separate query handles for each severity category', async () => {
      // Mock work items with different severity issues
      const mockWorkItems = [
        {
          id: 101,
          title: 'Critical Item',
          type: 'Task',
          state: 'Active',
          url: 'http://test',
          additionalFields: {
            'System.ChangedDate': new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
            'System.State': 'Active',
            // No assignedTo - critical for active items
          }
        },
        {
          id: 102,
          title: 'Warning Item',
          type: 'Product Backlog Item',
          state: 'New',
          url: 'http://test',
          additionalFields: {
            'System.ChangedDate': new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
            'System.Description': '',
            'System.State': 'New',
            'System.AssignedTo': { displayName: 'Test User' }
          }
        },
        {
          id: 103,
          title: 'Info Item',
          type: 'Bug',
          state: 'New',
          url: 'http://test',
          additionalFields: {
            'System.ChangedDate': new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
            'System.State': 'New',
            'System.AssignedTo': { displayName: 'Test User' },
            'System.Description': 'Has description'
          }
        }
      ];

      (queryWorkItemsByWiql as jest.Mock).mockResolvedValue({
        workItems: mockWorkItems,
        message: 'Success'
      });

      const args = {
        areaPath: 'TestProject\\TestArea',
        stalenessThresholdDays: 180,
        returnQueryHandle: true
      };

      const result = await handleBacklogCleanupAnalyzer(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('queryHandle');
      expect(result.data).toHaveProperty('categoryHandles');
      
      const categoryHandles = result.data.categoryHandles;
      expect(categoryHandles).toBeDefined();
      expect(categoryHandles).toHaveProperty('critical');
      expect(categoryHandles).toHaveProperty('warning');
      
      // Verify handles can be retrieved
      const criticalHandle = queryHandleService.getQueryData(categoryHandles.critical);
      expect(criticalHandle).toBeDefined();
      expect(criticalHandle?.workItemIds).toContain(101);
      
      const warningHandle = queryHandleService.getQueryData(categoryHandles.warning);
      expect(warningHandle).toBeDefined();
      expect(warningHandle?.workItemIds).toContain(102);
    });

    it('should only create handles for categories with issues', async () => {
      // Mock work items with only warning severity issues
      const mockWorkItems = [
        {
          id: 201,
          title: 'Stale Item',
          type: 'Product Backlog Item',
          state: 'New',
          url: 'http://test',
          additionalFields: {
            'System.ChangedDate': new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
            'System.Description': '',
            'System.State': 'New',
            'System.AssignedTo': { displayName: 'Test User' }
          }
        }
      ];

      (queryWorkItemsByWiql as jest.Mock).mockResolvedValue({
        workItems: mockWorkItems,
        message: 'Success'
      });

      const args = {
        areaPath: 'TestProject\\TestArea',
        stalenessThresholdDays: 180,
        returnQueryHandle: true
      };

      const result = await handleBacklogCleanupAnalyzer(mockConfig, args);

      expect(result.success).toBe(true);
      const categoryHandles = result.data.categoryHandles;
      expect(categoryHandles).toHaveProperty('warning');
      expect(categoryHandles).not.toHaveProperty('critical');
      expect(categoryHandles).not.toHaveProperty('info');
    });

    it('should not return categoryHandles when no issues found', async () => {
      // Mock work items with no issues
      const mockWorkItems = [
        {
          id: 301,
          title: 'Healthy Item',
          type: 'Product Backlog Item',
          state: 'New',
          url: 'http://test',
          additionalFields: {
            'System.ChangedDate': new Date().toISOString(),
            'System.Description': 'Good description',
            'System.State': 'New',
            'System.AssignedTo': { displayName: 'Test User' },
            'System.IterationPath': 'TestProject\\Sprint 1',
            'Microsoft.VSTS.Common.Priority': 2,
            'Microsoft.VSTS.Common.AcceptanceCriteria': 'Good criteria',
            'Microsoft.VSTS.Scheduling.StoryPoints': 5
          }
        }
      ];

      (queryWorkItemsByWiql as jest.Mock).mockResolvedValue({
        workItems: mockWorkItems,
        message: 'Success'
      });

      const args = {
        areaPath: 'TestProject\\TestArea',
        stalenessThresholdDays: 180,
        returnQueryHandle: true
      };

      const result = await handleBacklogCleanupAnalyzer(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data.categoryHandles).toBeUndefined();
    });

    it('should maintain backward compatibility with main queryHandle', async () => {
      const mockWorkItems = [
        {
          id: 401,
          title: 'Item 1',
          type: 'Task',
          state: 'New',
          url: 'http://test',
          additionalFields: {
            'System.State': 'New'
          }
        }
      ];

      (queryWorkItemsByWiql as jest.Mock).mockResolvedValue({
        workItems: mockWorkItems,
        message: 'Success'
      });

      const args = {
        areaPath: 'TestProject\\TestArea',
        returnQueryHandle: true
      };

      const result = await handleBacklogCleanupAnalyzer(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('queryHandle');
      
      const mainHandle = queryHandleService.getQueryData(result.data.queryHandle);
      expect(mainHandle).toBeDefined();
      expect(mainHandle?.workItemIds).toEqual([401]);
    });
  });

  describe('Issue Categorization', () => {
    it('should categorize critical issues correctly', async () => {
      const mockWorkItems = [
        {
          id: 501,
          title: 'Unassigned Active Item',
          type: 'Task',
          state: 'Active',
          url: 'http://test',
          additionalFields: {
            'System.State': 'Active'
            // No assignedTo - critical
          }
        }
      ];

      (queryWorkItemsByWiql as jest.Mock).mockResolvedValue({
        workItems: mockWorkItems,
        message: 'Success'
      });

      const result = await handleBacklogCleanupAnalyzer(mockConfig, {
        areaPath: 'TestProject\\TestArea'
      });

      expect(result.success).toBe(true);
      expect(result.data.summary.critical).toBe(1);
      expect(result.data.issues.critical).toHaveLength(1);
      expect(result.data.issues.critical[0].workItemId).toBe(501);
    });
  });

  describe('Query Handle Metadata', () => {
    it('should include correct queryType in category handles', async () => {
      const mockWorkItems = [
        {
          id: 601,
          title: 'Critical Item',
          type: 'Task',
          state: 'Active',
          url: 'http://test',
          additionalFields: {
            'System.State': 'Active'
          }
        }
      ];

      (queryWorkItemsByWiql as jest.Mock).mockResolvedValue({
        workItems: mockWorkItems,
        message: 'Success'
      });

      const result = await handleBacklogCleanupAnalyzer(mockConfig, {
        areaPath: 'TestProject\\TestArea',
        returnQueryHandle: true
      });

      const criticalHandle = queryHandleService.getQueryData(result.data.categoryHandles.critical);
      expect(criticalHandle?.metadata?.queryType).toBe('backlog-cleanup-critical');
    });
  });
});
