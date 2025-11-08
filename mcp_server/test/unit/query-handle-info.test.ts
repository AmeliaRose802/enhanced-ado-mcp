/**
 * Query Handle Info Handler Tests
 * 
 * Tests for the unified query-handle-info handler that combines
 * validate, inspect, and select functionality.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { handleQueryHandleInfo } from '../../src/services/handlers/query-handles/query-handle-info-handler.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { z } from 'zod';

// Mock token provider
jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => async () => 'mock-token'),
  setTokenProvider: jest.fn()
}));

// Mock configuration
jest.mock('../../src/config/config.js', () => ({
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

// Mock Azure CLI validator
jest.mock('../../src/utils/azure-cli-validator.js', () => ({
  validateAzureCLI: jest.fn(() => ({
    isAvailable: true,
    isLoggedIn: true
  }))
}));

// Mock ADO HTTP Client
const mockGet = jest.fn<any>().mockResolvedValue({
  data: {
    id: 123,
    fields: {
      'System.Title': 'Test Item',
      'System.WorkItemType': 'Task',
      'System.State': 'Active'
    }
  }
});

jest.mock('../../src/utils/ado-http-client.js', () => ({
  ADOHttpClient: jest.fn().mockImplementation(() => ({
    get: mockGet
  }))
}));

// Schema for testing
const queryHandleInfoSchema = z.object({
  queryHandle: z.string(),
  detailed: z.boolean().optional().default(false),
  includePreview: z.boolean().optional().default(true),
  includeStats: z.boolean().optional().default(true),
  includeExamples: z.boolean().optional().default(false),
  itemSelector: z.union([
    z.literal("all"),
    z.array(z.number()),
    z.object({
      states: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      daysInactiveMin: z.number().optional()
    })
  ]).optional(),
  previewCount: z.number().int().optional().default(10),
  includeSampleItems: z.boolean().optional().default(false),
  organization: z.string().optional(),
  project: z.string().optional()
});

describe('Query Handle Info Handler', () => {
  const mockConfig = {
    name: 'wit-query-handle-info',
    description: 'Test',
    script: '',
    schema: queryHandleInfoSchema,
    inputSchema: { type: 'object' as const }
  };

  beforeEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    queryHandleService.stopCleanup();
  });

  // Helper to create test data
  const createTestHandle = () => {
    const workItemIds = [123, 456, 789];
    const query = 'SELECT [System.Id] FROM WorkItems WHERE [System.State] = "Active"';
    
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
      lastSubstantiveChangeDate: '2025-03-01T10:00:00Z',
      tags: 'docs',
      assignedTo: 'Jane Smith'
    });
    workItemContext.set(789, {
      title: 'Add new feature',
      state: 'New',
      type: 'Feature',
      daysInactive: 2,
      lastSubstantiveChangeDate: '2025-03-15T10:00:00Z',
      tags: 'backend',
      assignedTo: 'Bob Johnson'
    });
    
    const handle = queryHandleService.storeQuery(
      workItemIds,
      query,
      { queryType: 'test' },
      60000,
      workItemContext
    );
    
    return handle;
  };

  describe('Basic Mode (detailed=false)', () => {
    it('should return basic inspection data by default', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Check basic fields are present (matching inspect behavior)
      const data = result.data as any;
      expect(data.query_handle).toBe(handle);
      expect(data.work_item_count).toBe(3);
      expect(data.created_at).toBeDefined();
      expect(data.expires_at).toBeDefined();
      expect(data.expires_in_hours).toBeDefined();
      expect(data.expires_in_minutes).toBeDefined();
      expect(typeof data.expires_in_hours).toBe('number');
      expect(typeof data.expires_in_minutes).toBe('number');
      expect(data.expires_in_hours).toBeGreaterThanOrEqual(0);
      expect(data.expires_in_minutes).toBeGreaterThanOrEqual(0);
      expect(data.query).toBeDefined();
      expect(data.has_item_context).toBe(true);
      expect(data.selection_enabled).toBe(true);
    });

    it('should include item preview by default', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.itemPreview).toBeDefined();
      expect(Array.isArray(data.itemPreview)).toBe(true);
      expect(data.itemPreview.length).toBeGreaterThan(0);
      
      // Check first item structure
      const firstItem = data.itemPreview[0];
      expect(firstItem.index).toBe(0);
      expect(firstItem.id).toBe(123);
      expect(firstItem.title).toBe('Fix login bug');
      expect(firstItem.state).toBe('Active');
      expect(firstItem.type).toBe('Bug');
    });

    it('should include selection hints', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        includePreview: true
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.selectionHints).toBeDefined();
      expect(Array.isArray(data.selectionHints)).toBe(true);
      expect(data.selectionHints.length).toBeGreaterThan(0);
    });

    it('should include statistics when includeStats=true', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        includeStats: true
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.selectionStats).toBeDefined();
      expect(data.selectionStats.totalItems).toBe(3);
      expect(data.selectionStats.byState).toBeDefined();
      expect(data.selectionStats.byType).toBeDefined();
    });

    it('should NOT include validation or selection analysis in basic mode', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: false
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.validation).toBeUndefined();
      expect(data.selection_analysis).toBeUndefined();
    });
  });

  describe('Detailed Mode (detailed=true)', () => {
    it('should include validation data when detailed=true', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: true
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.validation).toBeDefined();
      expect(data.validation.valid).toBe(true);
      expect(data.validation.item_count).toBe(3);
      expect(data.validation.time_remaining_minutes).toBeGreaterThanOrEqual(0);
    });

    it('should include selection analysis when detailed=true and itemSelector provided', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: true,
        itemSelector: [0, 1]  // Select first two items
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.selection_analysis).toBeDefined();
      expect(data.selection_analysis.analysis).toBeDefined();
      expect(data.selection_analysis.analysis.selected_items_count).toBe(2);
      expect(data.selection_analysis.analysis.total_items_in_handle).toBe(3);
      expect(data.selection_analysis.analysis.selection_type).toBe('index-based');
    });

    it('should handle "all" itemSelector', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: true,
        itemSelector: "all"
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.selection_analysis).toBeDefined();
      expect(data.selection_analysis.analysis.selected_items_count).toBe(3);
      expect(data.selection_analysis.analysis.selection_type).toBe('all');
    });

    it('should handle criteria-based itemSelector', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: true,
        itemSelector: { states: ['Active'] }
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.selection_analysis).toBeDefined();
      expect(data.selection_analysis.analysis.selection_type).toBe('criteria-based');
      expect(data.selection_analysis.analysis.selected_items_count).toBe(2); // Two Active items
    });

    it('should fetch sample items when detailed=true and includeSampleItems=true', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: true,
        includeSampleItems: true
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.validation).toBeDefined();
      expect(data.validation.sample_items).toBeDefined();
      expect(Array.isArray(data.validation.sample_items)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid query handle', async () => {
      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: 'invalid-handle'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
    });

    it('should return validation error for missing queryHandle', async () => {
      const result = await handleQueryHandleInfo(mockConfig, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Expiration Warnings', () => {
    it('should warn when query handle is about to expire', async () => {
      const workItemIds = [123];
      const query = 'SELECT [System.Id] FROM WorkItems';
      
      // Create handle that expires in 5 minutes
      const handle = queryHandleService.storeQuery(
        workItemIds,
        query,
        { queryType: 'test' },
        5 * 60 * 1000,  // 5 minutes TTL
        new Map()
      );

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.some((w: string) => w.includes('expires'))).toBe(true);
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: false
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.source).toBe('query-handle-info');
      expect(result.metadata?.handle).toBe(handle);
      expect(result.metadata?.detailed_mode).toBe(false);
    });

    it('should reflect detailed mode in metadata', async () => {
      const handle = createTestHandle();

      const result = await handleQueryHandleInfo(mockConfig, {
        queryHandle: handle,
        detailed: true
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.detailed_mode).toBe(true);
    });
  });
});

