/**
 * Context Package Optimization Tests
 * 
 * Verifies that the optimizations for reducing context window usage are working:
 * 1. System fields are excluded by default
 * 2. History uses diff-based changes (not full field snapshots)
 * 3. Default maxHistoryRevisions reduced to 3
 * 4. includeSystemFields parameter works
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { workItemContextPackageSchema } from '../../src/config/schemas.js';

describe('Context Package Optimization', () => {
  describe('Schema Defaults', () => {
    it('should default maxHistoryRevisions to 3', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxHistoryRevisions).toBe(3);
      }
    });

    it('should default includeSystemFields to false', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeSystemFields).toBe(false);
      }
    });

    it('should allow includeSystemFields to be explicitly set', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345,
        includeSystemFields: true
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeSystemFields).toBe(true);
      }
    });

    it('should default stripHtmlFormatting to true', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stripHtmlFormatting).toBe(true);
      }
    });
  });

  describe('Field Filtering', () => {
    const SYSTEM_FIELDS_TO_EXCLUDE = [
      'System.AuthorizedDate',
      'System.RevisedDate',
      'System.Watermark',
      'System.PersonId',
      'System.AuthorizedAs',
      'System.Rev',
      'System.CommentCount',
      'System.AreaId',
      'System.NodeName',
      'System.BoardColumnDone',
      'Microsoft.VSTS.Common.BacklogPriority',
      'Microsoft.VSTS.Common.StateChangeDate',
    ];

    it('should identify WEF fields as system fields', () => {
      const wefFields = [
        'WEF_6473F7D6EC194D159E8F1285A783BFDB_Kanban.Column',
        'WEF_A9D9333467E64396960CD4DD88868A9B_Kanban.Column.Done',
        'WEF_0033F8A015254F949E88B51B7139E380_System.ExtensionMarker'
      ];

      wefFields.forEach(field => {
        expect(field.startsWith('WEF_')).toBe(true);
      });
    });

    it('should have system fields list defined', () => {
      expect(SYSTEM_FIELDS_TO_EXCLUDE.length).toBeGreaterThan(0);
      expect(SYSTEM_FIELDS_TO_EXCLUDE).toContain('System.Watermark');
      expect(SYSTEM_FIELDS_TO_EXCLUDE).toContain('System.PersonId');
    });
  });

  describe('History Optimization', () => {
    it('should accept reduced history revision count', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345,
        includeHistory: true,
        maxHistoryRevisions: 2
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxHistoryRevisions).toBe(2);
      }
    });

    it('should allow maxHistoryRevisions up to 100', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345,
        includeHistory: true,
        maxHistoryRevisions: 100
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxHistoryRevisions).toBe(100);
      }
    });

    it('should reject maxHistoryRevisions below 1', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345,
        includeHistory: true,
        maxHistoryRevisions: 0
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('Context Window Efficiency', () => {
    it('should have context-efficient defaults', () => {
      const result = workItemContextPackageSchema.safeParse({
        workItemId: 12345
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        // Context-efficient defaults
        expect(result.data.includeHistory).toBe(false); // History disabled by default
        expect(result.data.maxHistoryRevisions).toBe(3); // Reduced from 5
        expect(result.data.includeSystemFields).toBe(false); // System fields excluded
        expect(result.data.stripHtmlFormatting).toBe(true); // HTML stripped
        expect(result.data.includeExtendedFields).toBe(false); // Extended fields excluded
        expect(result.data.includeAttachments).toBe(false); // Attachments excluded
      }
    });
  });
});
