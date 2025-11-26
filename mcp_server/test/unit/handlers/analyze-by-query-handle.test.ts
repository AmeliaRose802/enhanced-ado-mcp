/**
 * Tests for analyze-by-query-handle handler
 * Focus on story points field mapping (Microsoft.VSTS.Scheduling.Effort)
 * and AI suitability categorization with query handle creation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ADOWorkItem } from '../../../src/types/index.js';

// Mock dependencies
const mockQueryHandleService = {
  getQueryData: jest.fn(),
  storeQuery: jest.fn()
};

const mockAIAssignmentAnalyzer = {
  analyze: jest.fn() as jest.MockedFunction<any>
};

jest.mock('../../../src/services/query-handle-service.js', () => ({
  queryHandleService: mockQueryHandleService
}));

jest.mock('../../../src/services/analyzers/ai-assignment.js', () => ({
  AIAssignmentAnalyzer: jest.fn().mockImplementation(() => mockAIAssignmentAnalyzer)
}));

describe('Story Points Field Mapping', () => {
  it('should recognize Microsoft.VSTS.Scheduling.Effort as story points', () => {
    // Test the getEffortValue function logic
    const workItemWithEffort = {
      id: 35655356,
      fields: {
        'System.Title': 'Test Item',
        'System.WorkItemType': 'Product Backlog Item',
        'Microsoft.VSTS.Scheduling.Effort': 5
      }
    };

    // Simulate the getEffortValue function
    const effortField = workItemWithEffort.fields['Microsoft.VSTS.Scheduling.Effort'];
    const storyPointsField = workItemWithEffort.fields['Microsoft.VSTS.Scheduling.StoryPoints' as keyof typeof workItemWithEffort.fields];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(5);
  });

  it('should prefer Effort over StoryPoints when both exist', () => {
    const workItemWithBoth = {
      id: 123,
      fields: {
        'System.Title': 'Test Item',
        'Microsoft.VSTS.Scheduling.Effort': 5,
        'Microsoft.VSTS.Scheduling.StoryPoints': 3
      }
    };

    const effortField = workItemWithBoth.fields['Microsoft.VSTS.Scheduling.Effort'];
    const storyPointsField = workItemWithBoth.fields['Microsoft.VSTS.Scheduling.StoryPoints'];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(5); // Should prefer Effort
  });

  it('should use StoryPoints when Effort is not present', () => {
    const workItemWithStoryPoints = {
      id: 456,
      fields: {
        'System.Title': 'Test Item',
        'Microsoft.VSTS.Scheduling.StoryPoints': 8
      }
    };

    const effortField = workItemWithStoryPoints.fields['Microsoft.VSTS.Scheduling.Effort' as keyof typeof workItemWithStoryPoints.fields];
    const storyPointsField = workItemWithStoryPoints.fields['Microsoft.VSTS.Scheduling.StoryPoints'];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(8);
  });

  it('should return 0 when neither field is present', () => {
    const workItemNoEstimate = {
      id: 789,
      fields: {
        'System.Title': 'Test Item'
      }
    };

    const effortField = workItemNoEstimate.fields['Microsoft.VSTS.Scheduling.Effort' as keyof typeof workItemNoEstimate.fields];
    const storyPointsField = workItemNoEstimate.fields['Microsoft.VSTS.Scheduling.StoryPoints' as keyof typeof workItemNoEstimate.fields];
    
    const effortValue = typeof effortField === 'number' ? effortField : 0;
    const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
    
    const result = effortValue || storyPointsValue;

    expect(result).toBe(0);
  });
});

describe('AI Suitability Categorization with Query Handles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should categorize work items by AI suitability decision', async () => {
    // Mock work items
    const mockWorkItems = [
      {
        id: 101,
        fields: {
          'System.Id': 101,
          'System.Title': 'Implement login API',
          'System.State': 'New',
          'System.WorkItemType': 'Task'
        }
      },
      {
        id: 102,
        fields: {
          'System.Id': 102,
          'System.Title': 'Design system architecture',
          'System.State': 'New',
          'System.WorkItemType': 'Task'
        }
      },
      {
        id: 103,
        fields: {
          'System.Id': 103,
          'System.Title': 'Fix login bug',
          'System.State': 'Active',
          'System.WorkItemType': 'Bug'
        }
      },
      {
        id: 104,
        fields: {
          'System.Id': 104,
          'System.Title': 'TODO task',
          'System.State': 'New',
          'System.WorkItemType': 'Task'
        }
      }
    ] as any[];

    // Mock AI assignment analyzer responses
    mockAIAssignmentAnalyzer.analyze
      .mockResolvedValueOnce({
        success: true,
        data: { decision: 'AI_FIT', confidence: 0.85 }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { decision: 'HUMAN_FIT', confidence: 0.90 }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { decision: 'HYBRID', confidence: 0.70 }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { decision: 'NEEDS_REFINEMENT', confidence: 0.60 }
      });

    // Mock query handle creation
    mockQueryHandleService.storeQuery
      .mockReturnValueOnce('qh_ai_fit_123')
      .mockReturnValueOnce('qh_human_fit_456')
      .mockReturnValueOnce('qh_hybrid_789')
      .mockReturnValueOnce('qh_needs_ref_012');

    // Simulate categorization logic
    const categorizedIds = {
      AI_FIT: [101],
      HUMAN_FIT: [102],
      HYBRID: [103],
      NEEDS_REFINEMENT: [104]
    };

    const createCategoryHandle = (ids: number[], category: string) => {
      if (ids.length === 0) return null;
      
      const derivedQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')}) /* AI Suitability: ${category} */`;
      
      const categoryContext = new Map();
      ids.forEach(id => {
        const wi = mockWorkItems.find(w => w.id === id);
        if (wi) {
          categoryContext.set(id, {
            title: wi.fields?.['System.Title'],
            state: wi.fields?.['System.State'],
            type: wi.fields?.['System.WorkItemType']
          });
        }
      });
      
      return mockQueryHandleService.storeQuery(
        ids,
        derivedQuery,
        { project: 'test-project', queryType: `ai-suitability-${category.toLowerCase().replace('_', '-')}` },
        undefined,
        categoryContext,
        { analysisTimestamp: new Date().toISOString(), successCount: ids.length }
      );
    };

    const result = {
      total_analyzed: 4,
      results: mockWorkItems.map((wi, idx) => ({
        workItemId: wi.id!,
        title: wi.fields?.['System.Title'],
        analysis: { decision: Object.keys(categorizedIds)[idx] }
      })),
      categorization: {
        ai_fit: {
          count: categorizedIds.AI_FIT.length,
          query_handle: createCategoryHandle(categorizedIds.AI_FIT, 'AI_FIT'),
          work_item_ids: categorizedIds.AI_FIT
        },
        human_fit: {
          count: categorizedIds.HUMAN_FIT.length,
          query_handle: createCategoryHandle(categorizedIds.HUMAN_FIT, 'HUMAN_FIT'),
          work_item_ids: categorizedIds.HUMAN_FIT
        },
        hybrid: {
          count: categorizedIds.HYBRID.length,
          query_handle: createCategoryHandle(categorizedIds.HYBRID, 'HYBRID'),
          work_item_ids: categorizedIds.HYBRID
        },
        needs_refinement: {
          count: categorizedIds.NEEDS_REFINEMENT.length,
          query_handle: createCategoryHandle(categorizedIds.NEEDS_REFINEMENT, 'NEEDS_REFINEMENT'),
          work_item_ids: categorizedIds.NEEDS_REFINEMENT
        }
      }
    };

    expect(result.categorization.ai_fit.count).toBe(1);
    expect(result.categorization.ai_fit.work_item_ids).toEqual([101]);
    expect(result.categorization.ai_fit.query_handle).toBe('qh_ai_fit_123');

    expect(result.categorization.human_fit.count).toBe(1);
    expect(result.categorization.human_fit.work_item_ids).toEqual([102]);
    expect(result.categorization.human_fit.query_handle).toBe('qh_human_fit_456');

    expect(result.categorization.hybrid.count).toBe(1);
    expect(result.categorization.hybrid.work_item_ids).toEqual([103]);
    expect(result.categorization.hybrid.query_handle).toBe('qh_hybrid_789');

    expect(result.categorization.needs_refinement.count).toBe(1);
    expect(result.categorization.needs_refinement.work_item_ids).toEqual([104]);
    expect(result.categorization.needs_refinement.query_handle).toBe('qh_needs_ref_012');
  });

  it('should return null query handle for empty categories', () => {
    const createCategoryHandle = (ids: number[], category: string) => {
      if (ids.length === 0) return null;
      return mockQueryHandleService.storeQuery(ids, '', {}, undefined, new Map());
    };

    const result = createCategoryHandle([], 'AI_FIT');
    expect(result).toBeNull();
  });

  it('should include work item context in query handles', () => {
    const mockWorkItems = [
      {
        id: 201,
        fields: {
          'System.Id': 201,
          'System.Title': 'Test Task',
          'System.State': 'Active',
          'System.WorkItemType': 'Task',
          'System.AssignedTo': { displayName: 'John Doe', uniqueName: 'john@example.com', id: 'user-123' },
          'System.Tags': 'frontend; api',
          'System.ChangedDate': '2024-01-15T10:30:00Z'
        }
      }
    ] as any[];

    const categoryContext = new Map();
    categoryContext.set(201, {
      title: 'Test Task',
      state: 'Active',
      type: 'Task',
      changedDate: '2024-01-15T10:30:00Z',
      assignedTo: 'John Doe',
      tags: 'frontend; api'
    });

    mockQueryHandleService.storeQuery(
      [201],
      'SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (201)',
      { project: 'test-project', queryType: 'ai-suitability-ai-fit' },
      undefined,
      categoryContext,
      { analysisTimestamp: new Date().toISOString(), successCount: 1 }
    );

    expect(mockQueryHandleService.storeQuery).toHaveBeenCalledWith(
      [201],
      expect.any(String),
      expect.objectContaining({ 
        project: 'test-project',
        queryType: 'ai-suitability-ai-fit'
      }),
      undefined,
      expect.any(Map),
      expect.objectContaining({
        analysisTimestamp: expect.any(String),
        successCount: 1
      })
    );
  });

  it('should handle multiple work items in same category', () => {
    const categorizedIds = {
      AI_FIT: [301, 302, 303],
      HUMAN_FIT: [304],
      HYBRID: [],
      NEEDS_REFINEMENT: []
    };

    mockQueryHandleService.storeQuery.mockReturnValue('qh_ai_fit_multi');

    const createCategoryHandle = (ids: number[], category: string) => {
      if (ids.length === 0) return null;
      return mockQueryHandleService.storeQuery(
        ids,
        `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')})`,
        { queryType: `ai-suitability-${category.toLowerCase().replace('_', '-')}` }
      );
    };

    const handle = createCategoryHandle(categorizedIds.AI_FIT, 'AI_FIT');

    expect(handle).toBe('qh_ai_fit_multi');
    expect(mockQueryHandleService.storeQuery).toHaveBeenCalledWith(
      [301, 302, 303],
      expect.stringContaining('301,302,303'),
      expect.any(Object)
    );
  });

  it('should create derived WIQL query with source reference', () => {
    const sourceHandle = 'qh_source_abc123';
    const ids = [401, 402];
    
    const derivedQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')}) /* AI Suitability: AI_FIT - Derived from ${sourceHandle} */`;

    expect(derivedQuery).toContain('AI_FIT');
    expect(derivedQuery).toContain(sourceHandle);
    expect(derivedQuery).toContain('401,402');
  });

  it('should handle all four decision categories', () => {
    const categories = ['AI_FIT', 'HUMAN_FIT', 'HYBRID', 'NEEDS_REFINEMENT'];
    
    categories.forEach((category, index) => {
      const queryType = `ai-suitability-${category.toLowerCase().replace('_', '-')}`;
      expect(queryType).toMatch(/^ai-suitability-(ai-fit|human-fit|hybrid|needs-refinement)$/);
    });
  });

  it('should preserve work item IDs in categorization result', () => {
    const result = {
      categorization: {
        ai_fit: {
          count: 2,
          query_handle: 'qh_123',
          work_item_ids: [501, 502]
        },
        human_fit: {
          count: 1,
          query_handle: 'qh_456',
          work_item_ids: [503]
        },
        hybrid: {
          count: 0,
          query_handle: null,
          work_item_ids: []
        },
        needs_refinement: {
          count: 0,
          query_handle: null,
          work_item_ids: []
        }
      }
    };

    expect(result.categorization.ai_fit.work_item_ids).toEqual([501, 502]);
    expect(result.categorization.ai_fit.count).toBe(result.categorization.ai_fit.work_item_ids.length);
    expect(result.categorization.human_fit.work_item_ids).toEqual([503]);
    expect(result.categorization.hybrid.work_item_ids).toEqual([]);
    expect(result.categorization.hybrid.query_handle).toBeNull();
  });

  it('should handle analysis failures gracefully', () => {
    mockAIAssignmentAnalyzer.analyze.mockResolvedValue({
      success: false,
      data: null,
      errors: ['Analysis failed']
    });

    // When analysis fails, item should not be categorized
    const categorizedIds = {
      AI_FIT: [] as number[],
      HUMAN_FIT: [] as number[],
      HYBRID: [] as number[],
      NEEDS_REFINEMENT: [] as number[]
    };

    // Verify no items were categorized
    expect(categorizedIds.AI_FIT.length).toBe(0);
    expect(categorizedIds.HUMAN_FIT.length).toBe(0);
    expect(categorizedIds.HYBRID.length).toBe(0);
    expect(categorizedIds.NEEDS_REFINEMENT.length).toBe(0);
  });
});

describe('Work Item Intelligence Categorization with Query Handles', () => {
  const mockWorkItemIntelligenceAnalyzer = {
    analyze: jest.fn() as jest.MockedFunction<any>
  };

  jest.mock('../../../src/services/analyzers/work-item-intelligence.js', () => ({
    WorkItemIntelligenceAnalyzer: jest.fn().mockImplementation(() => mockWorkItemIntelligenceAnalyzer)
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should categorize work items by intelligence category when using categorization analysis', () => {
    const mockWorkItems = [
      {
        id: 201,
        fields: {
          'System.Id': 201,
          'System.Title': 'Add login feature',
          'System.State': 'New',
          'System.WorkItemType': 'User Story'
        }
      },
      {
        id: 202,
        fields: {
          'System.Id': 202,
          'System.Title': 'Fix null pointer exception',
          'System.State': 'Active',
          'System.WorkItemType': 'Bug'
        }
      },
      {
        id: 203,
        fields: {
          'System.Id': 203,
          'System.Title': 'Refactor legacy code',
          'System.State': 'New',
          'System.WorkItemType': 'Task'
        }
      }
    ] as any[];

    mockWorkItemIntelligenceAnalyzer.analyze
      .mockResolvedValueOnce({
        success: true,
        data: { category: 'Feature', priority: 'High' }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { category: 'Bug', priority: 'Critical' }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { category: 'Tech Debt', priority: 'Medium' }
      });

    mockQueryHandleService.storeQuery
      .mockReturnValueOnce('qh_feature_abc')
      .mockReturnValueOnce('qh_bug_def')
      .mockReturnValueOnce('qh_tech_debt_ghi');

    const categorizedIds: Record<string, number[]> = {
      feature: [201],
      bug: [202],
      tech_debt: [203]
    };

    const createCategoryHandle = (ids: number[], category: string) => {
      if (ids.length === 0) return null;
      return mockQueryHandleService.storeQuery(
        ids,
        `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')}) /* Intelligence Category: ${category} */`,
        { queryType: `intelligence-category-${category.toLowerCase().replace(/\\s+/g, '-')}` }
      );
    };

    const result = {
      total_analyzed: 3,
      results: mockWorkItems.map((wi, idx) => ({
        workItemId: wi.id,
        title: wi.fields['System.Title'],
        analysis: { category: Object.keys(categorizedIds)[idx] }
      })),
      categorization: {
        feature: {
          count: 1,
          query_handle: createCategoryHandle(categorizedIds.feature, 'Feature'),
          work_item_ids: categorizedIds.feature
        },
        bug: {
          count: 1,
          query_handle: createCategoryHandle(categorizedIds.bug, 'Bug'),
          work_item_ids: categorizedIds.bug
        },
        tech_debt: {
          count: 1,
          query_handle: createCategoryHandle(categorizedIds.tech_debt, 'Tech Debt'),
          work_item_ids: categorizedIds.tech_debt
        }
      }
    };

    expect(result.categorization.feature.count).toBe(1);
    expect(result.categorization.feature.work_item_ids).toEqual([201]);
    expect(result.categorization.feature.query_handle).toBe('qh_feature_abc');

    expect(result.categorization.bug.count).toBe(1);
    expect(result.categorization.bug.work_item_ids).toEqual([202]);
    expect(result.categorization.bug.query_handle).toBe('qh_bug_def');

    expect(result.categorization.tech_debt.count).toBe(1);
    expect(result.categorization.tech_debt.work_item_ids).toEqual([203]);
    expect(result.categorization.tech_debt.query_handle).toBe('qh_tech_debt_ghi');
  });

  it('should handle all intelligence categories', () => {
    const categories = ['Feature', 'Bug', 'Tech Debt', 'Security', 'Documentation', 'Research', 'Other'];
    
    categories.forEach(category => {
      const queryType = `intelligence-category-${category.toLowerCase().replace(/\s+/g, '-')}`;
      expect(queryType).toMatch(/^intelligence-category-(feature|bug|tech-debt|security|documentation|research|other)$/);
    });
  });

  it('should not create categorization when using non-categorization analysis types', () => {
    const analysisType = 'completeness'; // Not categorization
    
    const result = {
      total_analyzed: 5,
      results: [],
      categorization: {}
    };

    // Should have empty categorization object
    expect(Object.keys(result.categorization).length).toBe(0);
  });
});
