/**
 * Detect Patterns Format Tests
 * 
 * Tests for the configurable response format feature in detect-patterns handler
 */

import { handleDetectPatterns } from '../services/handlers/analysis/detect-patterns.handler.js';
import { detectPatternsSchema } from '../config/schemas.js';
import type { ToolConfig } from '../types/index.js';

// Mock dependencies
jest.mock('../services/ado-discovery-service.js', () => ({
  validateAzureCLI: jest.fn(() => ({ isAvailable: true, isLoggedIn: true }))
}));

jest.mock('../services/ado-work-item-service.js', () => ({
  queryWorkItemsByWiql: jest.fn(async () => ({
    workItems: [
      {
        id: 101,
        title: 'TODO: Fix this',
        type: 'Task',
        state: 'Active',
        areaPath: 'Project\\Area',
        assignedTo: 'user@example.com',
        changedDate: '2024-01-01T00:00:00Z',
        url: 'https://dev.azure.com/org/project/_workitems/edit/101',
        additionalFields: { 'System.Description': 'Test description' }
      },
      {
        id: 102,
        title: 'Fix login bug',
        type: 'Bug',
        state: 'Active',
        areaPath: 'Project\\Area',
        assignedTo: undefined,
        changedDate: '2024-01-01T00:00:00Z',
        url: 'https://dev.azure.com/org/project/_workitems/edit/102',
        additionalFields: { 'System.Description': 'Test description' }
      },
      {
        id: 103,
        title: 'Fix login bug',
        type: 'Bug',
        state: 'Active',
        areaPath: 'Project\\Area',
        assignedTo: 'user@example.com',
        changedDate: '2024-01-01T00:00:00Z',
        url: 'https://dev.azure.com/org/project/_workitems/edit/103',
        additionalFields: { 'System.Description': 'Test description' }
      },
      {
        id: 104,
        title: 'Update docs',
        type: 'Task',
        state: 'Active',
        areaPath: 'Project\\Area',
        assignedTo: undefined,
        changedDate: '2024-01-01T00:00:00Z',
        url: 'https://dev.azure.com/org/project/_workitems/edit/104',
        additionalFields: { 'System.Description': '<div></div>' }
      }
    ]
  }))
}));

jest.mock('../utils/work-item-parser.js', () => ({
  escapeAreaPath: (path: string) => path.replace(/\\/g, '\\\\')
}));

describe('Detect Patterns - Format Options', () => {
  const config: ToolConfig = {
    name: 'wit-analyze-patterns',
    description: 'Test',
    script: 'test.ps1',
    schema: detectPatternsSchema,
    inputSchema: { type: 'object' as const }
  };

  const baseArgs = {
    workItemIds: [101, 102, 103, 104],
    organization: 'test-org',
    project: 'test-project',
    patterns: ['duplicates', 'placeholder_titles', 'unassigned_committed', 'no_description']
  };

  it('should use categorized format by default', async () => {
    const result = await handleDetectPatterns(config, baseArgs);
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('categorized');
    expect((result.data as any)?.categorized).toHaveProperty('critical');
    expect((result.data as any)?.categorized).toHaveProperty('warning');
    expect((result.data as any)?.categorized).toHaveProperty('info');
    
    // Categorized format should have count and matches for each severity
    expect((result.data as any)?.categorized.warning).toHaveProperty('count');
    expect((result.data as any)?.categorized.warning).toHaveProperty('matches');
    expect(Array.isArray((result.data as any)?.categorized.warning.matches)).toBe(true);
    
    // Should not have flat matches array at top level
    expect(result.data).not.toHaveProperty('matches');
  });

  it('should support summary format with counts only', async () => {
    const result = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'summary'
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('totalItemsAnalyzed');
    expect(result.data).toHaveProperty('totalMatches');
    expect(result.data).toHaveProperty('bySeverity');
    expect(result.data).toHaveProperty('byPattern');
    
    // Summary format should only have counts, not arrays
    expect((result.data as any)?.bySeverity).toHaveProperty('critical_count');
    expect((result.data as any)?.bySeverity).toHaveProperty('warning_count');
    expect((result.data as any)?.bySeverity).toHaveProperty('info_count');
    
    // Should not have matches arrays
    expect(result.data).not.toHaveProperty('matches');
    expect(result.data).not.toHaveProperty('categorized');
  });

  it('should support flat format with single array', async () => {
    const result = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'flat'
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('matches');
    expect(Array.isArray((result.data as any)?.matches)).toBe(true);
    
    // Each match should have pattern field
    if ((result.data as any)?.matches && (result.data as any).matches.length > 0) {
      const match = (result.data as any).matches[0];
      expect(match).toHaveProperty('pattern');
      expect(match).toHaveProperty('workItemId');
      expect(match).toHaveProperty('title');
      expect(match).toHaveProperty('severity');
      expect(match).toHaveProperty('details');
    }
    
    // Should not have categorized structure
    expect(result.data).not.toHaveProperty('categorized');
  });

  it('should include format in metadata', async () => {
    const resultSummary = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'summary'
    });
    expect(resultSummary.metadata?.format).toBe('summary');
    
    const resultCategorized = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'categorized'
    });
    expect(resultCategorized.metadata?.format).toBe('categorized');
    
    const resultFlat = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'flat'
    });
    expect(resultFlat.metadata?.format).toBe('flat');
  });

  it('should detect placeholder patterns', async () => {
    const result = await handleDetectPatterns(config, baseArgs);
    
    expect(result.success).toBe(true);
    expect((result.data as any)?.summary.totalMatches).toBeGreaterThan(0);
    
    // Should detect the TODO pattern in work item 101
    const allMatches = (result.data as any)?.categorized 
      ? [...(result.data as any).categorized.critical.matches, 
         ...(result.data as any).categorized.warning.matches, 
         ...(result.data as any).categorized.info.matches]
      : [];
    
    const placeholderMatch = allMatches.find((m: any) => 
      m.workItemId === 101 && m.patterns.includes('placeholder_titles')
    );
    expect(placeholderMatch).toBeDefined();
  });

  it('should detect duplicates', async () => {
    const result = await handleDetectPatterns(config, baseArgs);
    
    expect(result.success).toBe(true);
    
    // Work items 102 and 103 have the same title
    const allMatches = (result.data as any)?.categorized 
      ? [...(result.data as any).categorized.critical.matches, 
         ...(result.data as any).categorized.warning.matches, 
         ...(result.data as any).categorized.info.matches]
      : [];
    
    const duplicateMatches = allMatches.filter((m: any) => 
      m.patterns.includes('duplicates') && [102, 103].includes(m.workItemId)
    );
    expect(duplicateMatches.length).toBe(2);
  });

  it('should detect unassigned committed items', async () => {
    const result = await handleDetectPatterns(config, baseArgs);
    
    expect(result.success).toBe(true);
    
    // Work items 102 and 104 are in Active state but unassigned
    const allMatches = (result.data as any)?.categorized 
      ? [...(result.data as any).categorized.critical.matches, 
         ...(result.data as any).categorized.warning.matches, 
         ...(result.data as any).categorized.info.matches]
      : [];
    
    const unassignedMatches = allMatches.filter((m: any) => 
      m.patterns.includes('unassigned_committed')
    );
    expect(unassignedMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('should reduce context size with summary format', async () => {
    const resultCategorized = await handleDetectPatterns(config, baseArgs);
    const resultSummary = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'summary'
    });
    
    expect(resultCategorized.success).toBe(true);
    expect(resultSummary.success).toBe(true);
    
    // Summary format should have much less data (no match arrays)
    const categorizedSize = JSON.stringify(resultCategorized.data).length;
    const summarySize = JSON.stringify(resultSummary.data).length;
    
    expect(summarySize).toBeLessThan(categorizedSize);
    
    // Should be at least 40% smaller (conservative estimate)
    const reduction = (categorizedSize - summarySize) / categorizedSize;
    expect(reduction).toBeGreaterThan(0.4);
  });

  it('should have same match counts across all formats', async () => {
    const resultCategorized = await handleDetectPatterns(config, baseArgs);
    const resultSummary = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'summary'
    });
    const resultFlat = await handleDetectPatterns(config, {
      ...baseArgs,
      format: 'flat'
    });
    
    expect(resultCategorized.success).toBe(true);
    expect(resultSummary.success).toBe(true);
    expect(resultFlat.success).toBe(true);
    
    // All formats should report the same total match count
    const categorizedTotal = (resultCategorized.data as any)?.summary.totalMatches;
    const summaryTotal = (resultSummary.data as any)?.totalMatches;
    const flatTotal = (resultFlat.data as any)?.matches?.length;
    
    expect(categorizedTotal).toBe(summaryTotal);
    expect(categorizedTotal).toBe(flatTotal);
  });
});
