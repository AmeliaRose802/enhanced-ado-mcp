/**
 * Unit tests for autoLaunchBrowser configuration
 * Tests that browser auto-launch can be controlled via configuration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  updateConfigFromCLI, 
  loadConfiguration,
  type CLIArguments,
  type MCPServerConfig 
} from '../../src/config/config.js';

// Mock execSync to prevent actual Azure CLI calls
jest.mock('child_process', () => ({
  execSync: jest.fn(() => 'mock-token')
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    markMCPConnected: jest.fn()
  }
}));

describe('AutoLaunchBrowser Configuration', () => {
  describe('Configuration schema', () => {
    beforeEach(() => {
      // Setup valid CLI args before each test
      updateConfigFromCLI({
        organization: 'test-org',
        project: 'test-project',
        verbose: false
      });
    });

    it('should default autoLaunchBrowser to false', () => {
      const config: MCPServerConfig = loadConfiguration(true);
      
      expect(config.autoLaunchBrowser).toBe(false);
    });

    it('should accept autoLaunchBrowser from CLI arguments', () => {
      updateConfigFromCLI({
        organization: 'test-org',
        project: 'test-project',
        autoLaunchBrowser: true,
        verbose: false
      });

      const config: MCPServerConfig = loadConfiguration(true);
      
      expect(config.autoLaunchBrowser).toBe(true);
    });

    it('should handle autoLaunchBrowser false explicitly', () => {
      updateConfigFromCLI({
        organization: 'test-org',
        project: 'test-project',
        autoLaunchBrowser: false,
        verbose: false
      });

      const config: MCPServerConfig = loadConfiguration(true);
      
      expect(config.autoLaunchBrowser).toBe(false);
    });
  });

  describe('CLI arguments interface', () => {
    it('should accept autoLaunchBrowser in CLI arguments', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        project: 'test-project',
        autoLaunchBrowser: true
      };

      expect(args.autoLaunchBrowser).toBe(true);
    });

    it('should allow autoLaunchBrowser to be optional', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        project: 'test-project'
      };

      expect(args.autoLaunchBrowser).toBeUndefined();
    });

    it('should simulate yargs result with auto-launch-browser flag', () => {
      // This simulates what yargs returns when --auto-launch-browser is used
      const yargsResult: CLIArguments = {
        organization: 'test-org',
        project: 'test-project',
        autoLaunchBrowser: true,
        'auto-launch-browser': true, // yargs adds kebab-case version
        _: [],
        $0: 'enhanced-ado-msp'
      };

      expect(yargsResult.autoLaunchBrowser).toBe(true);
      expect(yargsResult['auto-launch-browser']).toBe(true);
    });
  });

  describe('Type safety', () => {
    it('should properly type autoLaunchBrowser as boolean', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        project: 'test-project',
        autoLaunchBrowser: true
      };

      // TypeScript should enforce boolean type
      expect(typeof args.autoLaunchBrowser).toBe('boolean');
    });

    it('should allow autoLaunchBrowser to be undefined', () => {
      const args: CLIArguments = {
        organization: 'test-org',
        project: 'test-project'
      };

      // TypeScript knows this can be undefined
      if (args.autoLaunchBrowser !== undefined) {
        expect(typeof args.autoLaunchBrowser).toBe('boolean');
      } else {
        expect(args.autoLaunchBrowser).toBeUndefined();
      }
    });
  });

  describe('Integration with full configuration', () => {
    it('should include autoLaunchBrowser in complete configuration', () => {
      updateConfigFromCLI({
        organization: 'test-org',
        project: 'test-project',
        areaPath: 'test-area',
        copilotGuid: 'test-guid',
        verbose: true,
        autoLaunchBrowser: true
      });

      const config = loadConfiguration(true);

      // Verify all config sections are present
      expect(config.azureDevOps).toBeDefined();
      expect(config.gitRepository).toBeDefined();
      expect(config.gitHubCopilot).toBeDefined();
      expect(config.verboseLogging).toBe(true);
      expect(config.autoLaunchBrowser).toBe(true);
    });

    it('should work with minimal configuration', () => {
      updateConfigFromCLI({
        organization: 'min-org',
        project: 'min-project'
      });

      const config = loadConfiguration(true);

      // Should use defaults
      expect(config.verboseLogging).toBe(false);
      expect(config.autoLaunchBrowser).toBe(false);
    });
  });
});
