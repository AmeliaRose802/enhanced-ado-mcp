/**
 * Unit tests for get-configuration handler
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleGetConfiguration } from '../../src/services/handlers/core/get-configuration.handler.js';
import type { MCPServerConfig } from '../../src/config/config.js';

// Mock the config module
jest.mock('../../src/config/config.js');

describe('get-configuration handler', () => {
  let mockConfig: MCPServerConfig;

  beforeEach(() => {
    // Setup mock configuration
    mockConfig = {
      azureDevOps: {
        organization: 'test-org',
        project: 'test-project',
        areaPath: 'TestProject\\Team',
        areaPaths: ['TestProject\\Team'],
        iterationPath: 'TestProject\\Sprint 1',
        defaultWorkItemType: 'Product Backlog Item',
        defaultPriority: 2,
        defaultAssignedTo: 'test@example.com',
        inheritParentPaths: false
      },
      gitRepository: {
        defaultBranch: 'main'
      },
      gitHubCopilot: {
        defaultGuid: 'test-guid-123'
      },
      authentication: {
        type: 'azcli'
      },
      verboseLogging: false,
      enableDebugTools: false
    };

    // Mock loadConfiguration to return our mock config
    const configModule = require('../../src/config/config.js');
    configModule.loadConfiguration = jest.fn(() => mockConfig);
  });

  describe('Basic Functionality', () => {
    it('should return all configuration when section is "all"', async () => {
      const result = await handleGetConfiguration({ Section: 'all' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as { configuration: Record<string, unknown> };
      expect(data.configuration.azureDevOps).toBeDefined();
      expect(data.configuration.gitRepository).toBeDefined();
      expect(data.configuration.gitHubCopilot).toBeDefined();
    });

    it('should return all configuration when no section specified', async () => {
      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { configuration: Record<string, unknown> };
      expect(data.configuration.azureDevOps).toBeDefined();
      expect(data.configuration.gitRepository).toBeDefined();
    });

    it('should return only azureDevOps section when requested', async () => {
      const result = await handleGetConfiguration({ Section: 'azureDevOps' });

      expect(result.success).toBe(true);
      const data = result.data as { configuration: Record<string, unknown> };
      expect(data.configuration.azureDevOps).toBeDefined();
      expect(data.configuration.gitRepository).toBeUndefined();
      expect(data.configuration.gitHubCopilot).toBeUndefined();
    });

    it('should return only gitRepository section when requested', async () => {
      const result = await handleGetConfiguration({ Section: 'gitRepository' });

      expect(result.success).toBe(true);
      const data = result.data as { configuration: Record<string, unknown> };
      expect(data.configuration.azureDevOps).toBeUndefined();
      expect(data.configuration.gitRepository).toBeDefined();
      expect(data.configuration.gitHubCopilot).toBeUndefined();
    });

    it('should return only gitHubCopilot section when requested', async () => {
      const result = await handleGetConfiguration({ Section: 'gitHubCopilot' });

      expect(result.success).toBe(true);
      const data = result.data as { configuration: Record<string, unknown> };
      expect(data.configuration.azureDevOps).toBeUndefined();
      expect(data.configuration.gitRepository).toBeUndefined();
      expect(data.configuration.gitHubCopilot).toBeDefined();
    });
  });

  describe('Help Text', () => {
    it('should include helpful area path text', async () => {
      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.areaPath).toContain('TestProject\\Team');
      expect(data.helpText.areaPath).toContain('Default area path is configured');
    });

    it('should include helpful iteration path text', async () => {
      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.iterationPath).toContain('TestProject\\Sprint 1');
      expect(data.helpText.iterationPath).toContain('Default iteration path is configured');
    });

    it('should include helpful GitHub Copilot text when GUID is configured', async () => {
      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.gitHubCopilot).toContain('GitHub Copilot GUID is configured');
    });

    it('should show appropriate message when no area path configured', async () => {
      mockConfig.azureDevOps.areaPath = undefined;
      mockConfig.azureDevOps.areaPaths = [];

      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.areaPath).toBe('No default area path configured.');
    });

    it('should show appropriate message when no iteration path configured', async () => {
      mockConfig.azureDevOps.iterationPath = undefined;

      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.iterationPath).toBe('No default iteration path configured.');
    });

    it('should show appropriate message when no GitHub Copilot GUID configured', async () => {
      mockConfig.gitHubCopilot.defaultGuid = '';

      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.gitHubCopilot).toContain('No GitHub Copilot GUID configured');
      expect(data.helpText.gitHubCopilot).toContain('--copilot-guid parameter');
    });
  });

  describe('Multiple Area Paths', () => {
    it('should handle multiple area paths correctly', async () => {
      mockConfig.azureDevOps.areaPaths = [
        'TestProject\\Team1',
        'TestProject\\Team2',
        'TestProject\\Team3'
      ];

      const result = await handleGetConfiguration({});

      expect(result.success).toBe(true);
      const data = result.data as { helpText: Record<string, string> };
      expect(data.helpText.areaPath).toContain('3 area paths configured');
      expect(data.helpText.areaPath).toContain('Team1');
      expect(data.helpText.areaPath).toContain('Team2');
      expect(data.helpText.areaPath).toContain('Team3');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Make loadConfiguration throw an error
      const configModule = require('../../src/config/config.js');
      configModule.loadConfiguration = jest.fn(() => {
        throw new Error('Configuration load failed');
      });

      const result = await handleGetConfiguration({});

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Configuration load failed');
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata', async () => {
      const result = await handleGetConfiguration({ Section: 'azureDevOps' });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe('internal');
      expect(result.metadata.section).toBe('azureDevOps');
    });
  });
});
