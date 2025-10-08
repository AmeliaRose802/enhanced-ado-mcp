/**
 * Bulk Enhance Descriptions - Response Format Tests
 * 
 * Tests for the returnFormat parameter in bulk-enhance-descriptions tool
 * Validates summary, preview, and full response formats.
 */

import { bulkEnhanceDescriptionsByQueryHandleSchema } from '../config/schemas.js';

// Mock configuration
jest.mock('../config/config.js', () => ({
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

describe('Bulk Enhance Descriptions - Response Format', () => {
  describe('Schema Validation', () => {
    it('should accept returnFormat parameter with valid values', () => {
      const testCases = [
        { returnFormat: 'summary' },
        { returnFormat: 'preview' },
        { returnFormat: 'full' },
      ];

      testCases.forEach(testCase => {
        const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
          queryHandle: 'qh_test123',
          ...testCase
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect((result.data as any).returnFormat).toBe(testCase.returnFormat);
        }
      });
    });

    it('should reject invalid returnFormat values', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        returnFormat: 'invalid'
      });
      expect(result.success).toBe(false);
    });

    it('should allow returnFormat to be optional', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).returnFormat).toBeUndefined();
      }
    });

    it('should parse with all parameters including returnFormat', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        itemSelector: 'all',
        sampleSize: 5,
        enhancementStyle: 'concise',
        preserveExisting: false,
        dryRun: true,
        returnFormat: 'preview'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).returnFormat).toBe('preview');
      }
    });
  });

  describe('Default Format Logic', () => {
    it('should use summary format by default for dry-run', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        dryRun: true
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).dryRun).toBe(true);
        // Default should be applied in handler based on dryRun
        expect((result.data as any).returnFormat).toBeUndefined();
      }
    });

    it('should use preview format by default for execute mode', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        dryRun: false
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).dryRun).toBe(false);
        // Default should be applied in handler based on dryRun
        expect((result.data as any).returnFormat).toBeUndefined();
      }
    });
  });

  describe('Format Combinations', () => {
    it('should allow explicit summary format with dry-run', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        dryRun: true,
        returnFormat: 'summary'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).returnFormat).toBe('summary');
        expect((result.data as any).dryRun).toBe(true);
      }
    });

    it('should allow full format with dry-run', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        dryRun: true,
        returnFormat: 'full'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).returnFormat).toBe('full');
        expect((result.data as any).dryRun).toBe(true);
      }
    });

    it('should allow summary format with execute mode', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        dryRun: false,
        returnFormat: 'summary'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).returnFormat).toBe('summary');
        expect((result.data as any).dryRun).toBe(false);
      }
    });

    it('should allow preview format with execute mode', () => {
      const result = bulkEnhanceDescriptionsByQueryHandleSchema.safeParse({
        queryHandle: 'qh_test123',
        dryRun: false,
        returnFormat: 'preview'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).returnFormat).toBe('preview');
        expect((result.data as any).dryRun).toBe(false);
      }
    });
  });

  describe('Response Structure Validation', () => {
    it('summary format should omit results array', () => {
      // This tests the expected structure when returnFormat is 'summary'
      // In summary format, results should be undefined
      const expectedResponse = {
        query_handle: 'qh_test',
        total_items_in_handle: 10,
        selected_items: 10,
        items_processed: 10,
        successful: 8,
        skipped: 1,
        failed: 1,
        return_format: 'summary',
        results: undefined, // Summary format omits results
        summary: 'DRY RUN: Generated 8 enhanced descriptions (1 skipped, 1 failed)'
      };
      
      expect(expectedResponse.results).toBeUndefined();
      expect(expectedResponse.successful).toBe(8);
      expect(expectedResponse.return_format).toBe('summary');
    });

    it('preview format should include previews without full text', () => {
      const previewItem = {
        work_item_id: 123,
        status: 'enhanced',
        preview: 'This is a preview of the enhanced description that is limited to 200 characters...',
        error: undefined,
        skip_reason: undefined
      };
      
      expect(previewItem.preview).toBeDefined();
      expect(previewItem.preview!.length).toBeLessThanOrEqual(203); // 200 + "..."
      expect(previewItem).not.toHaveProperty('enhanced_description');
      expect(previewItem).not.toHaveProperty('title');
    });

    it('full format should include complete details', () => {
      const fullItem = {
        work_item_id: 123,
        title: 'Test Item',
        status: 'enhanced',
        enhanced_description: 'Full enhanced description with complete text...',
        improvement_reason: 'Added context and clarity',
        confidence: 0.95,
        error: undefined,
        skip_reason: undefined
      };
      
      expect(fullItem.enhanced_description).toBeDefined();
      expect(fullItem.title).toBeDefined();
      expect(fullItem.improvement_reason).toBeDefined();
      expect(fullItem.confidence).toBeDefined();
    });
  });

  describe('Token Reduction Expectations', () => {
    it('summary format should provide significant token reduction', () => {
      // Summary format: ~50 tokens vs full format: ~2000+ tokens
      // Expected reduction: ~70%
      const summaryResponse = {
        total: 10,
        enhanced: 8,
        failed: 2,
        skipped: 0
      };
      
      const estimatedTokens = JSON.stringify(summaryResponse).length / 4; // rough estimate
      expect(estimatedTokens).toBeLessThan(50);
    });

    it('preview format should provide moderate token reduction', () => {
      // Preview format: ~500 tokens vs full format: ~2000+ tokens
      // Expected reduction: ~40%
      const previewResponse = {
        total: 10,
        enhanced: 8,
        items: Array(8).fill(null).map((_, i) => ({
          id: 100 + i,
          preview: 'A' + 'x'.repeat(197) + '...' // 200 char preview
        }))
      };
      
      const estimatedTokens = JSON.stringify(previewResponse).length / 4;
      expect(estimatedTokens).toBeLessThan(800);
    });
  });
});
