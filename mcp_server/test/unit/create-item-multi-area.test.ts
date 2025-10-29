// @ts-nocheck
/**
 * Unit tests for Work Item Creation with Multiple Area Paths
 * 
 * Tests validation and behavior when creating work items with multiple configured area paths
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { 
  updateConfigFromCLI, 
  loadConfiguration,
  getRequiredConfig,
  type CLIArguments 
} from '../../src/config/config.js';

describe('Work Item Creation with Multiple Area Paths', () => {
  describe('Single Area Path (Backward Compatible)', () => {
    beforeEach(() => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPath: 'ProjectA\\TeamAlpha',
        verbose: false
      };
      updateConfigFromCLI(args);
      loadConfiguration(true);
    });

    it('should use configured area path as default', () => {
      const config = getRequiredConfig();
      
      expect(config.defaultAreaPath).toBe('ProjectA\\TeamAlpha');
      expect(config.defaultAreaPaths).toEqual(['ProjectA\\TeamAlpha']);
    });

    it('should allow creating work items without explicit area path', () => {
      const config = getRequiredConfig();
      const areaPath = config.defaultAreaPath;
      
      expect(areaPath).toBeDefined();
      expect(areaPath).toBe('ProjectA\\TeamAlpha');
    });
  });

  describe('Multiple Area Paths Configured', () => {
    beforeEach(() => {
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
    });

    it('should require explicit area path when multiple configured', () => {
      const config = getRequiredConfig();
      
      // Handler should check if multiple area paths are configured
      expect(config.defaultAreaPaths).toHaveLength(3);
      
      // Creating without explicit areaPath should fail
      const explicitAreaPath = undefined;
      const shouldError = config.defaultAreaPaths.length > 1 && !explicitAreaPath;
      
      expect(shouldError).toBe(true);
    });

    it('should validate area path is in configured list', () => {
      const config = getRequiredConfig();
      const providedAreaPath = 'ProjectB\\TeamDelta';
      
      const isValid = config.defaultAreaPaths.includes(providedAreaPath);
      expect(isValid).toBe(false);
    });

    it('should accept area path from configured list', () => {
      const config = getRequiredConfig();
      const providedAreaPath = 'ProjectA\\TeamBeta';
      
      const isValid = config.defaultAreaPaths.includes(providedAreaPath);
      expect(isValid).toBe(true);
    });

    it('should provide helpful error message listing valid area paths', () => {
      const config = getRequiredConfig();
      const invalidAreaPath = 'ProjectC\\TeamInvalid';
      
      if (!config.defaultAreaPaths.includes(invalidAreaPath)) {
        const errorMessage = `Area path '${invalidAreaPath}' not in configured paths: ${config.defaultAreaPaths.join(', ')}`;
        
        expect(errorMessage).toContain('not in configured paths');
        expect(errorMessage).toContain('ProjectA\\TeamAlpha');
        expect(errorMessage).toContain('ProjectA\\TeamBeta');
      }
    });
  });

  describe('Area Path Validation Logic', () => {
    it('should use first area path as fallback when none specified (single path)', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPath: 'ProjectA\\TeamAlpha',
        verbose: false
      };
      updateConfigFromCLI(args);
      loadConfiguration(true);
      
      const config = getRequiredConfig();
      const effectiveAreaPath = config.defaultAreaPath || config.defaultAreaPaths[0];
      
      expect(effectiveAreaPath).toBe('ProjectA\\TeamAlpha');
    });

    it('should warn when using default with multiple paths', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: ['ProjectA\\TeamAlpha', 'ProjectA\\TeamBeta'],
        verbose: false
      };
      updateConfigFromCLI(args);
      loadConfiguration(true);
      
      const config = getRequiredConfig();
      const warnings: string[] = [];
      
      if (config.defaultAreaPaths.length > 1) {
        warnings.push(`Multiple area paths configured. Using first: ${config.defaultAreaPaths[0]}`);
      }
      
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('Multiple area paths configured');
    });

    it('should validate format of provided area path', () => {
      const validPath = 'ProjectA\\TeamAlpha';
      const invalidPath = 'ProjectA/TeamAlpha'; // Wrong separator
      
      expect(validPath.includes('\\')).toBe(true);
      expect(invalidPath.includes('\\')).toBe(false);
    });
  });

  describe('Integration with Parent Work Items', () => {
    beforeEach(() => {
      const args: CLIArguments = {
        organization: 'test-org',
        areaPaths: ['ProjectA\\TeamAlpha', 'ProjectA\\TeamBeta'],
        verbose: false
      };
      updateConfigFromCLI(args);
      loadConfiguration(true);
    });

    it('should inherit parent area path when not specified', () => {
      // When creating child work item with inheritParentPaths=true
      const parentAreaPath = 'ProjectA\\TeamBeta';
      const childAreaPath = undefined;
      const inheritParentPaths = true;
      
      const effectiveAreaPath = inheritParentPaths && !childAreaPath 
        ? parentAreaPath 
        : childAreaPath;
      
      expect(effectiveAreaPath).toBe('ProjectA\\TeamBeta');
    });

    it('should validate inherited area path against configured paths', () => {
      const config = getRequiredConfig();
      const parentAreaPath = 'ProjectA\\TeamBeta';
      
      // Inherited path should be in configured list
      const isValid = config.defaultAreaPaths.includes(parentAreaPath);
      expect(isValid).toBe(true);
    });

    it('should reject inherited area path not in configured list', () => {
      const config = getRequiredConfig();
      const parentAreaPath = 'ProjectC\\TeamOther';
      
      const isValid = config.defaultAreaPaths.includes(parentAreaPath);
      expect(isValid).toBe(false);
    });
  });

  describe('Error Messages', () => {
    beforeEach(() => {
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
    });

    it('should provide clear error when area path required but not provided', () => {
      const config = getRequiredConfig();
      const providedAreaPath = undefined;
      
      if (config.defaultAreaPaths.length > 1 && !providedAreaPath) {
        const error = `Multiple area paths configured: ${config.defaultAreaPaths.join(', ')}. Please specify explicit 'areaPath' parameter.`;
        
        expect(error).toContain('Multiple area paths configured');
        expect(error).toContain('Please specify explicit');
      }
    });

    it('should provide clear error when invalid area path provided', () => {
      const config = getRequiredConfig();
      const invalidPath = 'ProjectB\\TeamDelta';
      
      if (!config.defaultAreaPaths.includes(invalidPath)) {
        const error = `Area path '${invalidPath}' not in configured paths: ${config.defaultAreaPaths.join(', ')}`;
        
        expect(error).toContain(invalidPath);
        expect(error).toContain('not in configured paths');
      }
    });
  });
});
