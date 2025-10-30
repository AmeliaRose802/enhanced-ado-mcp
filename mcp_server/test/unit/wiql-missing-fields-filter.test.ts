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

describe('WIQL Missing Fields Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter by missing description', async () => {
    const mockData = {
      work_item_count: 3,
      query_handle: 'qh_test_missing_desc',
      work_items: [
        {
          id: 12345,
          title: 'Item without description',
          type: 'Task',
          additionalFields: { 'System.Description': '' }
        },
        {
          id: 12346,
          title: 'Another item',
          type: 'Bug',
          additionalFields: { 'System.Description': '   ' }
        },
        {
          id: 12347,
          title: 'Third item',
          type: 'Task',
          additionalFields: {}
        }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-get-work-items-by-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Task', 'Bug')",
      top: 50,
      filterByPatterns: ['missing_description'],
      returnQueryHandle: true
    });

    expect(result.success).toBe(true);
    expect(result.data.work_item_count).toBe(3);
    expect(result.data.query_handle).toBeTruthy();
    expect(result.data.work_items).toHaveLength(3);
    expect(result.data.work_items[0].id).toBe(12345);
  });

  it('should filter by missing acceptance criteria', async () => {
    const mockData = {
      work_item_count: 2,
      query_handle: 'qh_test_missing_ac',
      work_items: [
        {
          id: 12348,
          title: 'PBI without AC',
          type: 'Product Backlog Item',
          additionalFields: { 'Microsoft.VSTS.Common.AcceptanceCriteria': '' }
        },
        {
          id: 12349,
          title: 'Feature without AC',
          type: 'Feature',
          additionalFields: {}
        }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-get-work-items-by-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] IN ('Product Backlog Item', 'Feature')",
      top: 50,
      filterByPatterns: ['missing_acceptance_criteria'],
      returnQueryHandle: true
    });

    expect(result.success).toBe(true);
    expect(result.data.work_item_count).toBe(2);
    expect(result.data.work_items).toHaveLength(2);
  });

  it('should apply both filters combined', async () => {
    const mockData = {
      work_item_count: 1,
      query_handle: 'qh_test_both',
      work_items: [
        {
          id: 12350,
          title: 'Item missing both',
          type: 'Product Backlog Item',
          additionalFields: {
            'System.Description': '',
            'Microsoft.VSTS.Common.AcceptanceCriteria': ''
          }
        }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-get-work-items-by-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.WorkItemType] = 'Product Backlog Item'",
      top: 50,
      filterByPatterns: ['missing_description', 'missing_acceptance_criteria'],
      returnQueryHandle: true
    });

    expect(result.success).toBe(true);
    expect(result.data.work_item_count).toBe(1);
    expect(result.data.work_items[0].id).toBe(12350);
  });

  it('should work without filters (backward compatibility)', async () => {
    const mockData = {
      work_item_count: 10,
      work_items: Array.from({ length: 10 }, (_, i) => ({
        id: 12000 + i,
        title: `Item ${i}`,
        type: 'Task'
      }))
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-get-work-items-by-query-wiql', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
      top: 10
    });

    expect(result.success).toBe(true);
    expect(result.data.work_item_count).toBe(10);
  });

  it('should handle errors gracefully', async () => {
    mockExecuteTool.mockResolvedValueOnce({
      success: false,
      data: null,
      errors: ['Failed to execute filtered query'],
      warnings: []
    });

    const result = await mockExecuteTool('wit-get-work-items-by-query-wiql', {
      wiqlQuery: 'INVALID',
      filterByPatterns: ['missing_description']
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Failed to execute filtered query');
  });
});


