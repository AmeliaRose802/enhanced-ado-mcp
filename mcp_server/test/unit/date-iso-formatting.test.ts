/**
 * Tests for ISO 8601 date formatting in prompts
 * 
 * This test verifies that dates are correctly formatted
 * for OData queries using full ISO 8601 timestamps (YYYY-MM-DDTHH:mm:ssZ)
 * rather than just date strings (YYYY-MM-DD).
 * 
 * Related issue: ADO-Work-Item-MSP-32
 */

import { describe, it, expect } from '@jest/globals';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Date ISO Formatting', () => {
  it('should generate valid ISO 8601 timestamps for date variables', () => {
    // Test the date formatting directly
    const testDate = new Date('2025-08-13T12:34:56.789Z');
    const isoString = testDate.toISOString();
    
    // Should match ISO 8601 format with full timestamp
    expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(isoString).toBe('2025-08-13T12:34:56.789Z');
  });

  it('should produce timestamps compatible with OData date filters', () => {
    // OData date filters expect format: YYYY-MM-DDTHH:mm:ssZ
    // Example: ChangedDate ge 2025-08-13T00:00:00.000Z
    
    const testDate = new Date('2025-08-13T00:00:00.000Z');
    const isoString = testDate.toISOString();
    
    // Extract the timestamp part that OData expects
    const odataFormat = isoString; // Full ISO string is valid for OData
    
    expect(odataFormat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Verify it can be used in an OData filter clause
    const filterClause = `ChangedDate ge ${odataFormat}`;
    expect(filterClause).toBe('ChangedDate ge 2025-08-13T00:00:00.000Z');
  });

  it('should document correct OData date format in team_health_analyzer prompt', async () => {
    // Verify the prompt documentation is correct
    const promptPath = join(process.cwd(), 'prompts', 'team_health_analyzer.md');
    const content = await readFile(promptPath, 'utf-8');

    // The content should contain ISO timestamp format documentation
    expect(content).toContain('full ISO 8601 timestamp');
    expect(content).toContain('YYYY-MM-DDTHH:mm:ssZ');
    
    // Verify that the documentation no longer mentions the incorrect format
    expect(content).not.toContain('YYYY-MM-DDZ without timestamp');
  });

  it('should not append Z suffix to ISO timestamp variables in prompts', async () => {
    // Regression test: ensure prompts don't use {{start_date_iso}}Z
    // which would create invalid format like "2025-08-13T00:00:00.000ZZ"
    
    const promptPath = join(process.cwd(), 'prompts', 'team_health_analyzer.md');
    const content = await readFile(promptPath, 'utf-8');

    // Should NOT contain the invalid pattern in actual usage
    // (The documentation can mention it, but usage should not have it)
    const lines = content.split('\n');
    const usageLines = lines.filter(line => 
      line.includes('{{start_date_iso}}Z') || line.includes('{{end_date_iso}}Z')
    ).filter(line => 
      // Exclude documentation lines that mention the format
      !line.includes('format:') && !line.includes('OData:')
    );
    
    expect(usageLines.length).toBe(0);
  });

  it('should distinguish between WIQL and OData date formats', async () => {
    // WIQL uses YYYY-MM-DD format
    // OData uses full ISO 8601 timestamp
    
    const promptPath = join(process.cwd(), 'prompts', 'team_health_analyzer.md');
    const content = await readFile(promptPath, 'utf-8');

    // Should document both formats
    expect(content).toContain('WIQL: `{{start_date}}` and `{{end_date}}` as-is (format: YYYY-MM-DD)');
    expect(content).toContain('OData: `{{start_date_iso}}` and `{{end_date_iso}}`');
  });

  it('should format dates correctly for different uses', () => {
    const testDate = new Date('2025-08-13T12:34:56.789Z');
    
    // WIQL format (date only)
    const wiqlFormat = testDate.toISOString().split('T')[0];
    expect(wiqlFormat).toBe('2025-08-13');
    expect(wiqlFormat).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // OData format (full ISO 8601)
    const odataFormat = testDate.toISOString();
    expect(odataFormat).toBe('2025-08-13T12:34:56.789Z');
    expect(odataFormat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // They should be different
    expect(wiqlFormat).not.toBe(odataFormat);
  });
});
