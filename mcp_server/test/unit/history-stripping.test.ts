/**
 * Test suite for history stripping parameters in context package
 */
import { workItemContextPackageSchema } from '../../src/config/schemas.js';
import { z } from 'zod';

// Mock configuration to avoid initialization issues in tests
jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project',
      patToken: 'test-token'
    }
  }))
}));

describe('History Stripping Parameters', () => {
  describe('Schema Defaults', () => {
    it('should default includeHistory to false', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({ workItemId: 123 });
      expect(result.includeHistory).toBe(false);
    });

    it('should default maxHistoryRevisions to 3', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({ workItemId: 123 });
      expect(result.maxHistoryRevisions).toBe(3);
    });

    it('should allow overriding includeHistory to true', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({ workItemId: 123, includeHistory: true });
      expect(result.includeHistory).toBe(true);
    });

    it('should allow custom maxHistoryRevisions value', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({ workItemId: 123, maxHistoryRevisions: 20 });
      expect(result.maxHistoryRevisions).toBe(20);
    });
  });

  describe('Parameter Behavior', () => {
    it('should accept maxHistoryRevisions parameter without error', () => {
      const schema = workItemContextPackageSchema;
      expect(() => {
        schema.parse({
          workItemId: 123,
          includeHistory: true,
          maxHistoryRevisions: 10
        });
      }).not.toThrow();
    });

    it('should not accept historyCount parameter (old name)', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({
        workItemId: 123,
        historyCount: 10 // This should be ignored as it's not in the schema
      } as any);
      
      // historyCount should not appear in parsed result
      expect('historyCount' in result).toBe(false);
      // maxHistoryRevisions should use default
      expect(result.maxHistoryRevisions).toBe(3);
    });
  });

  describe('Context Window Optimization', () => {
    it('should describe history as optimized for context window efficiency', () => {
      const schema = workItemContextPackageSchema;
      const includeHistoryField = schema.shape.includeHistory;
      const description = includeHistoryField.description;
      
      expect(description).toContain('Optimized for context window efficiency');
    });

    it('should describe maxHistoryRevisions context optimization', () => {
      const schema = workItemContextPackageSchema;
      const maxHistoryField = schema.shape.maxHistoryRevisions;
      const description = maxHistoryField.description;
      
      expect(description).toContain('Default reduced to 3 for context window efficiency');
    });
  });

  describe('Integration with other parameters', () => {
    it('should work correctly with all parameters', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({
        workItemId: 123,
        includeHistory: true,
        maxHistoryRevisions: 15,
        includeComments: false,
        includeRelations: true,
        includeChildren: false
      });
      
      expect(result.workItemId).toBe(123);
      expect(result.includeHistory).toBe(true);
      expect(result.maxHistoryRevisions).toBe(15);
      expect(result.includeComments).toBe(false);
      expect(result.includeRelations).toBe(true);
      expect(result.includeChildren).toBe(false);
    });
  });

  describe('Backward Compatibility Considerations', () => {
    it('should handle explicit includeHistory: false', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({
        workItemId: 123,
        includeHistory: false
      });
      
      expect(result.includeHistory).toBe(false);
    });

    it('should handle explicit includeHistory: true with defaults', () => {
      const schema = workItemContextPackageSchema;
      const result = schema.parse({
        workItemId: 123,
        includeHistory: true
      });
      
      expect(result.includeHistory).toBe(true);
      expect(result.maxHistoryRevisions).toBe(3); // Default when not specified
    });
  });
});

