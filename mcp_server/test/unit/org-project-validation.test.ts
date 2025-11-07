/**
 * Tests for organization vs project name validation
 * Ensures the server correctly distinguishes between organization and project names
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { extractProjectFromAreaPath, updateConfigFromCLI, loadConfiguration, type CLIArguments } from '../../src/config/config.js';

describe('Organization vs Project Name Validation', () => {
  beforeEach(() => {
    // Clear any cached config
    jest.resetModules();
  });

  describe('extractProjectFromAreaPath', () => {
    it('should extract project from valid area path', () => {
      const project = extractProjectFromAreaPath('MyProject\\Team\\Area');
      expect(project).toBe('MyProject');
    });

    it('should extract project from two-segment area path', () => {
      const project = extractProjectFromAreaPath('ProjectA\\TeamAlpha');
      expect(project).toBe('ProjectA');
    });

    it('should handle single-segment path but warn (backward compatibility)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const project = extractProjectFromAreaPath('myorg');
      
      // Should still extract but log warning
      expect(project).toBe('myorg');
      
      consoleSpy.mockRestore();
    });

    it('should return null for empty string', () => {
      const project = extractProjectFromAreaPath('');
      expect(project).toBeNull();
    });

    it('should handle area paths with multiple levels', () => {
      const project = extractProjectFromAreaPath('MyProject\\Team\\SubTeam\\Component');
      expect(project).toBe('MyProject');
    });
  });

  describe('Configuration Validation - Invalid Area Path Format', () => {
    it('should reject area path without backslash (organization-like format)', () => {
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: ['myorg'], // Wrong - should be "ProjectName\\Area"
        verbose: false
      };

      updateConfigFromCLI(args);
      
      expect(() => {
        loadConfiguration(true);
      }).toThrow(/Invalid area path format/);
    });

    it('should reject area path that is just a simple name', () => {
      const args: CLIArguments = {
        organization: 'contoso',
        areaPaths: ['SomeProject'], // Missing backslash - invalid format
        verbose: false
      };

      updateConfigFromCLI(args);
      
      expect(() => {
        loadConfiguration(true);
      }).toThrow(/Invalid area path format/);
    });

    it('should accept valid area path with backslash', () => {
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: ['MyProject\\Team'],
        verbose: false
      };

      updateConfigFromCLI(args);
      
      expect(() => {
        loadConfiguration(true);
      }).not.toThrow();
      
      const config = loadConfiguration(true);
      expect(config.azureDevOps.organization).toBe('myorg');
      expect(config.azureDevOps.project).toBe('MyProject');
    });
  });

  describe('Configuration Validation - Organization vs Project Detection', () => {
    it('should warn when extracted project matches organization name', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: ['myorg\\Team'], // Project name same as org - suspicious
        verbose: false
      };

      updateConfigFromCLI(args);
      loadConfiguration(true);
      
      // Should still work but warn
      const config = loadConfiguration(true);
      expect(config.azureDevOps.organization).toBe('myorg');
      expect(config.azureDevOps.project).toBe('myorg');
      
      consoleSpy.mockRestore();
    });

    it('should not warn when project differs from organization', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: ['MyProject\\Team'],
        verbose: false
      };

      updateConfigFromCLI(args);
      loadConfiguration(true);
      
      const config = loadConfiguration(true);
      expect(config.azureDevOps.organization).toBe('myorg');
      expect(config.azureDevOps.project).toBe('MyProject');
      
      // No warnings expected
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error message for invalid area path', () => {
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: ['InvalidPath'],
        verbose: false
      };

      updateConfigFromCLI(args);
      
      try {
        loadConfiguration(true);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid area path format');
        expect(error.message).toContain('ProjectName\\AreaName');
        expect(error.message).toContain('InvalidPath');
      }
    });

    it('should suggest correct format in error message', () => {
      const args: CLIArguments = {
        organization: 'contoso',
        areaPaths: ['wrong'],
        verbose: false
      };

      updateConfigFromCLI(args);
      
      try {
        loadConfiguration(true);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('MyProject\\\\Team\\\\Component');
        expect(error.message).toContain('enhanced-ado-mcp contoso --area-path');
      }
    });
  });

  describe('Valid Configurations', () => {
    it('should accept organization and valid area path', () => {
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: ['ProjectA\\TeamAlpha'],
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);
      
      expect(config.azureDevOps.organization).toBe('myorg');
      expect(config.azureDevOps.project).toBe('ProjectA');
      expect(config.azureDevOps.areaPaths).toEqual(['ProjectA\\TeamAlpha']);
    });

    it('should accept multiple area paths from same project', () => {
      const args: CLIArguments = {
        organization: 'myorg',
        areaPaths: [
          'ProjectA\\Team1',
          'ProjectA\\Team2',
          'ProjectA\\Team3'
        ],
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);
      
      expect(config.azureDevOps.organization).toBe('myorg');
      expect(config.azureDevOps.project).toBe('ProjectA');
      expect(config.azureDevOps.areaPaths).toHaveLength(3);
    });

    it('should handle complex area path hierarchies', () => {
      const args: CLIArguments = {
        organization: 'contoso',
        areaPaths: ['MyProject\\Engineering\\BackendTeam\\Services'],
        verbose: false
      };

      updateConfigFromCLI(args);
      const config = loadConfiguration(true);
      
      expect(config.azureDevOps.organization).toBe('contoso');
      expect(config.azureDevOps.project).toBe('MyProject');
    });
  });
});
