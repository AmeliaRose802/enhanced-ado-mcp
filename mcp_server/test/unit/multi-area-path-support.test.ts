// @ts-nocheck
/**
 * Unit tests for Multi-Area Path Support (Phase 1: Backward Compatible)
 * 
 * Tests the configuration, validation, and query filtering for multiple area paths
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { 
  updateConfigFromCLI, 
  loadConfiguration,
  extractProjectFromAreaPath,
  getRequiredConfig,
  type CLIArguments 
} from '../../src/config/config.js';

describe('Multi-Area Path Support', () => {
  const originalEnv = process.env.MCP_DEBUG;

  afterEach(() => {
    process.env.MCP_DEBUG = originalEnv;
  });

  describe('CLI Arguments with Multiple Area Paths', () => {
    it('should accept multiple area paths via areaPaths array', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          'ProjectA\\TeamBeta',
          'ProjectA\\TeamGamma'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);

      expect(config.azureDevOps.organization).toBe('test-org');
      expect(config.azureDevOps.project).toBe('ProjectA');
      expect(config.azureDevOps.areaPaths).toEqual([
        'ProjectA\\TeamAlpha',
        'ProjectA\\TeamBeta',
        'ProjectA\\TeamGamma'
      ]);
    });

    it('should normalize single areaPath to areaPaths array', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPath: 'ProjectA\\TeamAlpha',
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);

      expect(config.azureDevOps.areaPaths).toEqual(['ProjectA\\TeamAlpha']);
      expect(config.azureDevOps.areaPath).toBe('ProjectA\\TeamAlpha');
    });

    it('should support backward compatibility with single areaPath', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPath: 'ProjectA\\TeamAlpha',
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);

      expect(config.azureDevOps.project).toBe('ProjectA');
      expect(config.azureDevOps.areaPath).toBe('ProjectA\\TeamAlpha');
      expect(config.azureDevOps.areaPaths).toEqual(['ProjectA\\TeamAlpha']);
    });
  });

  describe('Project Extraction from Multiple Area Paths', () => {
    it('should extract project from multiple area paths (same project)', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          'ProjectA\\TeamBeta'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);

      expect(config.azureDevOps.project).toBe('ProjectA');
    });

    it('should error when area paths contain different projects', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          'ProjectB\\TeamBeta'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);

      expect(() => loadConfiguration(true)).toThrow(/Multiple projects detected/);
      expect(() => loadConfiguration(true)).toThrow(/ProjectA, ProjectB/);
    });


  });

  describe('Area Path Validation', () => {
    it('should reject empty area paths in array', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          '',
          'ProjectA\\TeamBeta'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);

      expect(() => loadConfiguration(true)).toThrow(/Area path cannot be empty/);
    });

    it('should reject duplicate area paths', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          'ProjectA\\TeamBeta',
          'ProjectA\\TeamAlpha'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);

      expect(() => loadConfiguration(true)).toThrow(/Duplicate area paths/);
    });

    it('should accept valid multiple area paths', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          'ProjectA\\TeamBeta',
          'ProjectA\\TeamGamma'
        ],
        verbose: false
      };

      expect(() => {
        updateConfigFromCLI(args);
        loadConfiguration(true);
      }).not.toThrow();
    });
  });

  describe('getRequiredConfig with Multiple Area Paths', () => {
    it('should return array of area paths in defaultAreaPaths', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: [
          'ProjectA\\TeamAlpha',
          'ProjectA\\TeamBeta',
          'ProjectA\\TeamGamma'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);
      loadConfiguration(true);
      const requiredConfig = getRequiredConfig();

      expect(requiredConfig.defaultAreaPaths).toEqual([
        'ProjectA\\TeamAlpha',
        'ProjectA\\TeamBeta',
        'ProjectA\\TeamGamma'
      ]);
      expect(requiredConfig.defaultAreaPath).toBe('ProjectA\\TeamAlpha');
    });

    it('should normalize single areaPath to defaultAreaPaths array', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPath: 'ProjectA\\TeamAlpha',
        verbose: false
      };

      updateConfigFromCLI(args);
      loadConfiguration(true);
      const requiredConfig = getRequiredConfig();

      expect(requiredConfig.defaultAreaPaths).toEqual(['ProjectA\\TeamAlpha']);
      expect(requiredConfig.defaultAreaPath).toBe('ProjectA\\TeamAlpha');
    });


  });

  describe('Backward Compatibility', () => {
    it('should work with existing single area path configurations', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPath: 'ProjectA\\TeamAlpha',
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);

      expect(config.azureDevOps.areaPath).toBe('ProjectA\\TeamAlpha');
      expect(config.azureDevOps.areaPaths).toEqual(['ProjectA\\TeamAlpha']);
    });

    it('should maintain defaultAreaPath for backward compatibility', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: ['ProjectA\\TeamAlpha', 'ProjectA\\TeamBeta'],
        verbose: false
      };

      updateConfigFromCLI(args);
      loadConfiguration(true);
      const requiredConfig = getRequiredConfig();

      // First area path should be available as defaultAreaPath
      expect(requiredConfig.defaultAreaPath).toBe('ProjectA\\TeamAlpha');
    });
  });

  describe('Configuration Schema Validation', () => {
    it('should validate areaPaths is array of strings', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: ['ProjectA\\TeamAlpha', 'ProjectA\\TeamBeta'],
        verbose: false
      };

      expect(() => {
        updateConfigFromCLI(args);
        loadConfiguration(true);
      }).not.toThrow();
    });

    it('should require organization', () => {
      const args: CLIArguments = {
        organization: '',
        areaPaths: ['ProjectA\\TeamAlpha'],
        verbose: false
      };

      updateConfigFromCLI(args);

      expect(() => loadConfiguration(true)).toThrow(/Organization is required/);
    });

    it('should require project or area path', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        verbose: false
      };

      updateConfigFromCLI(args);

      expect(() => loadConfiguration(true)).toThrow(/Project is required/);
    });
  });
});
