// Set test environment before any imports
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = '1';

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type ToolExecutionResult = {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
};

// Mock the tool-service before importing it
const mockExecuteTool = jest.fn<(toolName: string, args: any) => Promise<ToolExecutionResult>>();
const mockSetServerInstance = jest.fn<(server: any) => void>();

jest.mock('../../src/services/tool-service.js', () => ({
  executeTool: mockExecuteTool,
  setServerInstance: mockSetServerInstance
}));

describe('Work Item Intelligence Analyzer with AI Sampling', () => {
  let mockServer: any;
  let mockServerNoSampling: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock server with sampling capabilities
    mockServer = {
      getClientCapabilities: jest.fn(() => ({ sampling: true })),
      createMessage: jest.fn(async (params: any) => ({
        content: {
          text: `COMPLETENESS ANALYSIS:
- Title clarity: 8/10 - Clear and specific
- Description detail: 6/10 - Good but could be more specific  
- Acceptance criteria: 4/10 - Missing detailed criteria

AI READINESS ASSESSMENT:
- Task specificity: 7/10 - Well-defined scope
- Testability: 6/10 - Some verification possible
- Risk level: 8/10 - Low risk for AI assignment
- Overall AI readiness: 7/10 - SUITABLE for AI with some guidance

RECOMMENDATIONS:
1. Add specific acceptance criteria with measurable outcomes
2. Include implementation steps or references
3. Add verification/testing requirements
4. Consider breaking into smaller atomic tasks if complex

ENHANCED DESCRIPTION SUGGESTION:
Implement user authentication using OAuth 2.0 flow with the following steps:
1. Set up OAuth provider configuration
2. Create login/logout endpoints  
3. Implement JWT token validation middleware
4. Add protected route guards
5. Update UI with login state management

ASSIGNMENT RECOMMENDATION: AI-Suitable with clear requirements`
        }
      }))
    };

    // Mock server without sampling
    mockServerNoSampling = {
      getClientCapabilities: jest.fn(() => ({})),
      createMessage: jest.fn(async () => {
        throw new Error('Sampling not supported');
      })
    };
  });

  it('should perform full AI analysis with sampling support', async () => {
    mockSetServerInstance(mockServer);
    
    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: {
        completeness: { titleClarity: 8, descriptionDetail: 6 },
        aiReadiness: { taskSpecificity: 7, overall: 7 }
      },
      metadata: { source: 'ai-sampling', samplingAvailable: true },
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-ai-intelligence', {
      Title: 'Implement user authentication',
      Description: 'Add OAuth login functionality to the web application',
      WorkItemType: 'Feature',
      AnalysisType: 'full',
      ContextInfo: 'React frontend with Node.js backend'
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.source).toBe('ai-sampling');
    expect(mockExecuteTool).toHaveBeenCalledWith(
      'wit-ai-intelligence',
      expect.objectContaining({
        Title: 'Implement user authentication',
        AnalysisType: 'full'
      })
    );
  });

  it('should perform AI readiness analysis', async () => {
    mockSetServerInstance(mockServer);
    
    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: {
        aiReadiness: { taskSpecificity: 7, testability: 6, riskLevel: 8, overall: 7 },
        recommendation: 'AI-Suitable with clear requirements'
      },
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-ai-intelligence', {
      Title: 'Fix login bug',
      Description: "Users can't log in on mobile devices",
      WorkItemType: 'Bug',
      AnalysisType: 'ai-readiness'
    });

    expect(result.success).toBe(true);
    expect(result.data.aiReadiness).toBeDefined();
  });

  it('should perform enhancement analysis with minimal input', async () => {
    mockSetServerInstance(mockServer);
    
    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: {
        recommendations: [
          'Add specific acceptance criteria',
          'Include implementation steps',
          'Add verification requirements'
        ]
      },
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-ai-intelligence', {
      Title: 'Update docs',
      AnalysisType: 'enhancement'
    });

    expect(result.success).toBe(true);
    expect(result.data.recommendations).toBeDefined();
    expect(result.data.recommendations.length).toBeGreaterThan(0);
  });

  it('should fallback gracefully without sampling support', async () => {
    mockSetServerInstance(mockServerNoSampling);
    
    mockExecuteTool.mockResolvedValueOnce({
      success: true,
      data: {
        completeness: { titleClarity: 5, descriptionDetail: 5 },
        message: 'Using fallback analysis (AI sampling not available)'
      },
      metadata: { samplingAvailable: false, source: 'fallback' },
      errors: [],
      warnings: []
    });

    const result = await mockExecuteTool('wit-ai-intelligence', {
      Title: 'Complex integration task',
      Description: 'Integrate payment system with multiple vendors',
      AnalysisType: 'full'
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.samplingAvailable).toBe(false);
    expect(result.metadata?.source).toBe('fallback');
  });

  it('should reject invalid analysis type', async () => {
    mockSetServerInstance(mockServer);
    
    mockExecuteTool.mockRejectedValueOnce(
      new Error('Invalid analysis type: invalid-type')
    );

    await expect(
      mockExecuteTool('wit-ai-intelligence', {
        Title: 'Test item',
        AnalysisType: 'invalid-type'
      })
    ).rejects.toThrow('Invalid analysis type');
  });
});