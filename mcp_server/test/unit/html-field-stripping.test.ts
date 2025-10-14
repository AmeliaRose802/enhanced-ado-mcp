/**
 * Test for HTML field stripping parameters in context package tool
 */
import { workItemContextPackageSchema } from '../../src/config/schemas.js';

describe('HTML Field Stripping Parameters', () => {
  describe('Schema validation', () => {
    it('should allow includeHtml parameter', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345,
        includeHtml: false
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeHtml).toBe(false);
      }
    });

    it('should default includeHtml to false', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeHtml).toBe(false);
      }
    });

    it('should accept true for includeHtml', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345,
        includeHtml: true
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeHtml).toBe(true);
      }
    });
  });
});


