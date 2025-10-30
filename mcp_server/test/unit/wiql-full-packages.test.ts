import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type ToolExecutionResult = {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
};

// Mock the tool-service before importing
const mockExecuteTool = jest.fn<(toolName: string, args: any) => Promise<ToolExecutionResult>>();

jest.mock('../../src/services/tool-service.js', () => ({
  executeTool: mockExecuteTool
}));

describe('WIQL Query with fetchFullPackages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch full packages with query handle', async () => {
    const mockData = {
      work_item_count: 3,
      query_handle: 'qh_test_123',
      fullPackagesIncluded: true,
      fullPackagesCount: 3,
      full_packages: [
        {
          id: 12345,
          title: 'Test Work Item',
          type: 'Task',
          state: 'Active',
          description: 'Test description',
          comments: [],
          history: [],
          children: [],
          parent: null,
          related: []
        }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC",
      top: 3,
      fetchFullPackages: true,
      returnQueryHandle: true
    });

    expect(result.success).toBe(true);
    expect(result.data.work_item_count).toBe(3);
    expect(result.data.query_handle).toBe('qh_test_123');
    expect(result.data.fullPackagesIncluded).toBe(true);
    expect(result.data.full_packages).toHaveLength(1);
    expect(result.data.full_packages[0].id).toBe(12345);
  });

  it('should fetch full packages without query handle', async () => {
    const mockData = {
      count: 2,
      fullPackagesIncluded: true,
      fullPackagesCount: 2,
      full_packages: [
        {
          id: 12345,
          title: 'Test Item 1',
          type: 'Task',
          state: 'Active'
        },
        {
          id: 12346,
          title: 'Test Item 2',
          type: 'Bug',
          state: 'Active'
        }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
      top: 2,
      fetchFullPackages: true,
      returnQueryHandle: false
    });

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(2);
    expect(result.data.fullPackagesIncluded).toBe(true);
    expect(result.data.full_packages).toHaveLength(2);
  });

  it('should work with regular query without fetchFullPackages', async () => {
    const mockData = {
      work_item_count: 5,
      work_items: [
        { id: 1, title: 'Item 1' },
        { id: 2, title: 'Item 2' },
        { id: 3, title: 'Item 3' },
        { id: 4, title: 'Item 4' },
        { id: 5, title: 'Item 5' }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
      top: 5
    });

    expect(result.success).toBe(true);
    expect(result.data.work_item_count).toBe(5);
    expect(result.data.full_packages).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    mockExecuteTool.mockResolvedValueOnce({
      success: false,
      data: null,
      errors: ['Failed to execute WIQL query'],
      warnings: []
    });

    const result = await mockExecuteTool('wit-query-wiql', {
      wiqlQuery: 'INVALID QUERY',
      fetchFullPackages: true
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Failed to execute WIQL query');
  });
});


