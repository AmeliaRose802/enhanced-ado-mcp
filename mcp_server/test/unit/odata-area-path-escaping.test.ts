/**
 * Unit tests for OData Area Path Escaping
 * 
 * Tests proper escaping of area paths for use in OData queries.
 * OData requires different escaping than WIQL:
 * - Single quotes must be doubled: ' → ''
 * - Backslashes must be doubled: \ → \\
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Escape area path for OData queries specifically
 * OData string literals require:
 * - Single quotes doubled: ' → ''
 * - Backslashes doubled: \ → \\
 */
function escapeAreaPathForOData(areaPath: string): string {
  if (!areaPath) return '';
  
  // First escape backslashes (must be done before quotes to avoid double-escaping)
  let escaped = areaPath.replace(/\\/g, '\\\\');
  
  // Then escape single quotes
  escaped = escaped.replace(/'/g, "''");
  
  return escaped;
}

/**
 * Escape area path for WIQL queries specifically
 * WIQL only requires single quotes to be doubled
 */
function escapeAreaPathForWiql(areaPath: string): string {
  if (!areaPath) return '';
  // Replace single quotes with two single quotes (SQL/WIQL escaping)
  return areaPath.replace(/'/g, "''");
}

describe('OData Area Path Escaping', () => {
  describe('escapeAreaPathForOData', () => {
    it('should escape backslashes in area paths', () => {
      const input = 'Project\\Team\\Area';
      const expected = 'Project\\\\Team\\\\Area';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should escape single quotes in area paths', () => {
      const input = "Project\\Team's Area";
      const expected = "Project\\\\Team''s Area";
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should escape both backslashes and single quotes', () => {
      const input = "One\\Azure's Compute\\Team";
      const expected = "One\\\\Azure''s Compute\\\\Team";
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle simple project path', () => {
      const input = 'MyProject';
      const expected = 'MyProject';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle deeply nested paths', () => {
      const input = 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway';
      const expected = 'One\\\\Azure Compute\\\\OneFleet Node\\\\Azure Host Agent\\\\Azure Host Gateway';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle empty string', () => {
      const result = escapeAreaPathForOData('');
      expect(result).toBe('');
    });

    it('should handle path with only backslashes', () => {
      const input = '\\\\';
      const expected = '\\\\\\\\';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle path with only quotes', () => {
      const input = "It's a test";
      const expected = "It''s a test";
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle mixed special characters', () => {
      const input = "Path\\with\\many's\\special's\\chars";
      const expected = "Path\\\\with\\\\many''s\\\\special''s\\\\chars";
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });
  });

  describe('WIQL vs OData Escaping Differences', () => {
    it('WIQL should NOT escape backslashes', () => {
      const input = 'Project\\Team\\Area';
      const result = escapeAreaPathForWiql(input);
      
      // WIQL uses UNDER operator which doesn't need backslash escaping
      expect(result).toBe('Project\\Team\\Area');
    });

    it('WIQL should escape single quotes', () => {
      const input = "Project\\Team's Area";
      const expected = "Project\\Team''s Area";
      const result = escapeAreaPathForWiql(input);
      
      expect(result).toBe(expected);
    });

    it('OData and WIQL produce different output for paths with backslashes', () => {
      const input = 'Project\\Team\\Area';
      
      const odataResult = escapeAreaPathForOData(input);
      const wiqlResult = escapeAreaPathForWiql(input);
      
      expect(odataResult).toBe('Project\\\\Team\\\\Area');
      expect(wiqlResult).toBe('Project\\Team\\Area');
      expect(odataResult).not.toBe(wiqlResult);
    });
  });

  describe('OData Query Construction', () => {
    it('should build valid OData startswith filter', () => {
      const areaPath = 'Project\\Team\\Area';
      const escaped = escapeAreaPathForOData(areaPath);
      const filter = `startswith(Area/AreaPath, '${escaped}')`;
      
      expect(filter).toBe("startswith(Area/AreaPath, 'Project\\\\Team\\\\Area')");
    });

    it('should build valid OData filter with quotes', () => {
      const areaPath = "Project\\Team's Area";
      const escaped = escapeAreaPathForOData(areaPath);
      const filter = `startswith(Area/AreaPath, '${escaped}')`;
      
      expect(filter).toBe("startswith(Area/AreaPath, 'Project\\\\Team''s Area')");
    });

    it('should build complete OData query string', () => {
      const areaPath = 'One\\Azure Compute\\OneFleet Node';
      const escaped = escapeAreaPathForOData(areaPath);
      const query = `$apply=filter(State eq 'Active' and startswith(Area/AreaPath, '${escaped}'))/groupby((State), aggregate($count as Count))`;
      
      expect(query).toContain('One\\\\Azure Compute\\\\OneFleet Node');
      expect(query).not.toContain('One\\Azure Compute\\OneFleet Node');
    });
  });

  describe('WIQL Query Construction', () => {
    it('should build valid WIQL UNDER clause', () => {
      const areaPath = 'Project\\Team\\Area';
      const escaped = escapeAreaPathForWiql(areaPath);
      const clause = `[System.AreaPath] UNDER '${escaped}'`;
      
      // WIQL doesn't need backslash escaping
      expect(clause).toBe("[System.AreaPath] UNDER 'Project\\Team\\Area'");
    });

    it('should build valid WIQL clause with quotes', () => {
      const areaPath = "Project\\Team's Area";
      const escaped = escapeAreaPathForWiql(areaPath);
      const clause = `[System.AreaPath] UNDER '${escaped}'`;
      
      expect(clause).toBe("[System.AreaPath] UNDER 'Project\\Team''s Area'");
    });
  });

  describe('Real-world Examples', () => {
    it('should handle Azure DevOps common path pattern', () => {
      const areaPath = 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway';
      const escaped = escapeAreaPathForOData(areaPath);
      
      expect(escaped).toBe('One\\\\Azure Compute\\\\OneFleet Node\\\\Azure Host Agent\\\\Azure Host Gateway');
      expect(escaped.split('\\\\').length).toBe(5); // Should have 5 segments
    });

    it('should handle path from audit_results.md example', () => {
      const areaPath = 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway';
      const escaped = escapeAreaPathForOData(areaPath);
      const odataQuery = `$apply=filter(CompletedDate ge 2025-08-09T00:00:00Z and CompletedDate le 2025-11-07T23:59:59Z and AssignedTo/UserEmail ne null and startswith(Area/AreaPath, '${escaped}'))/groupby((AssignedTo/UserEmail,AssignedTo/UserName),aggregate($count as Count))&$orderby=Count desc`;
      
      // Verify the escaped path is in the query
      expect(odataQuery).toContain('One\\\\Azure Compute\\\\OneFleet Node\\\\Azure Host Agent\\\\Azure Host Gateway');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input', () => {
      const result = escapeAreaPathForOData(null as any);
      expect(result).toBe('');
    });

    it('should handle undefined input', () => {
      const result = escapeAreaPathForOData(undefined as any);
      expect(result).toBe('');
    });

    it('should handle trailing backslash', () => {
      const input = 'Project\\Team\\';
      const expected = 'Project\\\\Team\\\\';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle leading backslash', () => {
      const input = '\\Project\\Team';
      const expected = '\\\\Project\\\\Team';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle consecutive backslashes', () => {
      const input = 'Project\\\\Team';
      const expected = 'Project\\\\\\\\Team';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });

    it('should handle path with Unicode characters', () => {
      const input = 'Project\\Team™\\Area©';
      const expected = 'Project\\\\Team™\\\\Area©';
      const result = escapeAreaPathForOData(input);
      
      expect(result).toBe(expected);
    });
  });
});
