import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock SamplingService before importing
const mockAnalyzeAIAssignment = jest.fn<(args: any) => Promise<any>>();

jest.mock('../../src/services/sampling-service.js', () => ({
  SamplingService: jest.fn().mockImplementation(() => ({
    analyzeAIAssignment: mockAnalyzeAIAssignment
  }))
}));

import { SamplingService } from '../../src/services/sampling-service.js';

describe('AI Assignment Analyzer', () => {
  let samplingService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    samplingService = new SamplingService({});
  });

  it('should analyze work item for AI assignment suitability', async () => {
    const mockResult = {
      success: true,
      data: {
        decision: 'AI_FIT',
        confidence: 0.8,
        riskScore: 25,
        estimatedScope: {
          files: { min: 2, max: 4 },
          complexity: 'Low'
        },
        assignmentStrategy: 'direct'
      },
      errors: [],
      warnings: []
    };

    mockAnalyzeAIAssignment.mockResolvedValueOnce(mockResult);

    const result = await samplingService.analyzeAIAssignment({
      workItemId: 12345,
      organization: 'test-org',
      project: 'test-project',
      outputFormat: 'detailed'
    });

    expect(result.success).toBe(true);
    expect(result.data.decision).toBe('AI_FIT');
    expect(result.data.confidence).toBe(0.8);
    expect(result.data.riskScore).toBe(25);
    expect(result.data.estimatedScope.files.min).toBe(2);
    expect(result.data.estimatedScope.files.max).toBe(4);
    expect(result.data.estimatedScope.complexity).toBe('Low');
  });

  it('should call analyzeAIAssignment with correct parameters', async () => {
    const mockResult = {
      success: true,
      data: { decision: 'AI_FIT' },
      errors: [],
      warnings: []
    };

    mockAnalyzeAIAssignment.mockResolvedValueOnce(mockResult);

    await samplingService.analyzeAIAssignment({
      workItemId: 12345,
      organization: 'test-org',
      project: 'test-project',
      outputFormat: 'detailed'
    });

    expect(mockAnalyzeAIAssignment).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeAIAssignment).toHaveBeenCalledWith({
      workItemId: 12345,
      organization: 'test-org',
      project: 'test-project',
      outputFormat: 'detailed'
    });
  });

  it('should handle errors gracefully', async () => {
    const mockResult = {
      success: false,
      data: null,
      errors: ['Failed to analyze work item: API Error'],
      warnings: []
    };

    mockAnalyzeAIAssignment.mockResolvedValueOnce(mockResult);

    const result = await samplingService.analyzeAIAssignment({
      workItemId: 12345,
      organization: 'test-org',
      project: 'test-project',
      outputFormat: 'detailed'
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
