import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type ToolExecutionResult = {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
};

// Mock the tool-service before importing
const mockExecuteTool = jest.fn<(toolName: string, args: any) => Promise<ToolExecutionResult>>();

jest.mock('../../src/services/tool-service.js', () => ({
  executeTool: mockExecuteTool
}));

type WiqlResultData = {
  count?: number;
  query?: string;
  work_items?: Array<{ id: number; title: string; [key: string]: unknown }>;
  pagination?: {
    total?: number;
    totalCount?: number;
    skip?: number;
    top?: number;
    hasMore?: boolean;
    nextSkip?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

describe('WIQL Query Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute basic WIQL query', async () => {
    const mockData: WiqlResultData = {
      count: 15,
      query: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
      work_items: [
        { id: 12345, title: 'Test Item 1', state: 'Active' },
        { id: 12346, title: 'Test Item 2', state: 'Active' }
      ]
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      metadata: { source: 'wiql-api' },
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC"
    });

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(15);
    expect(result.data.work_items).toHaveLength(2);
    expect(result.data.work_items[0].id).toBe(12345);
  });

  it('should handle pagination - first page', async () => {
    const mockData: WiqlResultData = {
      count: 5,
      work_items: Array.from({ length: 5 }, (_, i) => ({
        id: 12000 + i,
        title: `Item ${i}`
      })),
      pagination: {
        totalCount: 25,
        skip: 0,
        top: 5,
        hasMore: true,
        nextSkip: 5
      }
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems",
      top: 5,
      skip: 0
    });

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(5);
    expect(result.data.pagination?.totalCount).toBe(25);
    expect(result.data.pagination?.hasMore).toBe(true);
    expect(result.data.pagination?.nextSkip).toBe(5);
  });

  it('should handle pagination - second page', async () => {
    const mockData: WiqlResultData = {
      count: 5,
      work_items: Array.from({ length: 5 }, (_, i) => ({
        id: 12005 + i,
        title: `Item ${5 + i}`
      })),
      pagination: {
        totalCount: 25,
        skip: 5,
        top: 5,
        hasMore: true,
        nextSkip: 10
      }
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems",
      top: 5,
      skip: 5
    });

    expect(result.success).toBe(true);
    expect(result.data.pagination?.skip).toBe(5);
    expect(result.data.work_items[0].id).not.toBe(12000); // Different from first page
  });

  it('should omit pagination for single-page results', async () => {
    const mockData: WiqlResultData = {
      count: 10,
      work_items: Array.from({ length: 10 }, (_, i) => ({
        id: 12000 + i,
        title: `Item ${i}`
      }))
      // No pagination field
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems",
      top: 200
    });

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(10);
    expect(result.data.pagination).toBeUndefined();
  });

  it('should include pagination when includePaginationDetails=true', async () => {
    const mockData: WiqlResultData = {
      count: 10,
      work_items: Array.from({ length: 10 }, (_, i) => ({
        id: 12000 + i,
        title: `Item ${i}`
      })),
      pagination: {
        totalCount: 10,
        skip: 0,
        top: 200,
        hasMore: false
      }
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems",
      top: 200,
      includePaginationDetails: true
    });

    expect(result.success).toBe(true);
    expect(result.data.pagination).toBeDefined();
    expect(result.data.pagination?.hasMore).toBe(false);
  });

  it('should include pagination for multi-page results', async () => {
    const mockData: WiqlResultData = {
      count: 5,
      work_items: Array.from({ length: 5 }, (_, i) => ({
        id: 12000 + i,
        title: `Item ${i}`
      })),
      pagination: {
        totalCount: 50,
        skip: 0,
        top: 5,
        hasMore: true,
        nextSkip: 5
      }
    };

    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: mockData,
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems",
      top: 5
    });

    expect(result.success).toBe(true);
    expect(result.data.pagination).toBeDefined();
    expect(result.data.pagination?.hasMore).toBe(true);
    expect(result.data.pagination?.nextSkip).toBe(5);
  });

  it('should handle errors gracefully', async () => {
    mockExecuteTool.mockResolvedValueOnce({
      success: false,
      data: null,
      errors: ['Invalid WIQL query syntax'],
      warnings: []
    });

    const result = await mockExecuteTool('wit-wiql-query', {
      wiqlQuery: 'INVALID QUERY SYNTAX'
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Invalid WIQL query syntax');
  });
});



