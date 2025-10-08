/**
 * Unit tests for Azure DevOps token utility with browser auto-launch control
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { execSync } from 'child_process';

// Mock child_process
jest.mock('child_process');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  markMCPConnected: jest.fn()
};

jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

// Mock configuration
let mockConfig = {
  azureDevOps: {
    organization: 'test-org',
    project: 'test-project',
    defaultWorkItemType: 'Task' as const,
    defaultPriority: 2,
    defaultAssignedTo: '@me',
    inheritParentPaths: true
  },
  gitRepository: {
    defaultBranch: 'main'
  },
  gitHubCopilot: {
    defaultGuid: ''
  },
  verboseLogging: false,
  autoLaunchBrowser: false
};

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => mockConfig),
  AZURE_DEVOPS_RESOURCE_ID: '499b84ac-1321-427f-aa17-267ca6975798'
}));

// Import after mocking
import { getAzureDevOpsToken, clearTokenCache } from '../../src/utils/ado-token.js';

describe('Azure DevOps Token - Browser Auto-Launch Control', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    clearTokenCache();
    
    // Reset mock config
    mockConfig.autoLaunchBrowser = false;
    
    // Default mock implementation
    mockExecSync.mockReturnValue('mock-access-token' as any);
  });

  describe('when autoLaunchBrowser is false (default)', () => {
    it('should include --allow-no-subscriptions flag in Azure CLI command', () => {
      mockConfig.autoLaunchBrowser = false;

      getAzureDevOpsToken();

      expect(mockExecSync).toHaveBeenCalledTimes(1);
      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('--allow-no-subscriptions');
    });

    it('should log helpful message about browser launch being disabled', () => {
      mockConfig.autoLaunchBrowser = false;

      getAzureDevOpsToken();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Browser auto-launch is disabled for authentication. To enable, use --auto-launch-browser flag.'
      );
    });

    it('should still include --only-show-errors flag', () => {
      mockConfig.autoLaunchBrowser = false;

      getAzureDevOpsToken();

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('--only-show-errors');
    });

    it('should return token successfully', () => {
      mockConfig.autoLaunchBrowser = false;
      mockExecSync.mockReturnValue('  test-token-123  ' as any);

      const token = getAzureDevOpsToken();

      expect(token).toBe('test-token-123');
    });
  });

  describe('when autoLaunchBrowser is true (opt-in)', () => {
    it('should NOT include --allow-no-subscriptions flag', () => {
      mockConfig.autoLaunchBrowser = true;

      getAzureDevOpsToken();

      expect(mockExecSync).toHaveBeenCalledTimes(1);
      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).not.toContain('--allow-no-subscriptions');
    });

    it('should NOT log message about browser launch being disabled', () => {
      mockConfig.autoLaunchBrowser = true;

      getAzureDevOpsToken();

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should still include --only-show-errors flag', () => {
      mockConfig.autoLaunchBrowser = true;

      getAzureDevOpsToken();

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('--only-show-errors');
    });

    it('should return token successfully', () => {
      mockConfig.autoLaunchBrowser = true;
      mockExecSync.mockReturnValue('  opt-in-token-456  ' as any);

      const token = getAzureDevOpsToken();

      expect(token).toBe('opt-in-token-456');
    });
  });

  describe('token caching behavior', () => {
    it('should cache token and not call Azure CLI on subsequent requests', () => {
      mockConfig.autoLaunchBrowser = false;
      mockExecSync.mockReturnValue('cached-token' as any);

      // First call
      const token1 = getAzureDevOpsToken();
      expect(mockExecSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const token2 = getAzureDevOpsToken();
      expect(mockExecSync).toHaveBeenCalledTimes(1); // Still 1, not called again
      expect(token1).toBe(token2);
    });

    it('should respect autoLaunchBrowser setting from cache initialization', () => {
      mockConfig.autoLaunchBrowser = false;
      mockExecSync.mockReturnValue('cached-token' as any);

      // Initialize cache with autoLaunchBrowser = false
      getAzureDevOpsToken();
      const firstCommand = mockExecSync.mock.calls[0][0] as string;
      expect(firstCommand).toContain('--allow-no-subscriptions');

      // Change config (cache should still be used)
      mockConfig.autoLaunchBrowser = true;
      getAzureDevOpsToken();
      
      // Should not have called execSync again
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('should clear cache and call Azure CLI again after clearTokenCache', () => {
      mockExecSync.mockReturnValue('token-after-clear' as any);

      // First call
      getAzureDevOpsToken();
      expect(mockExecSync).toHaveBeenCalledTimes(1);

      // Clear cache
      clearTokenCache();

      // Next call should hit Azure CLI again
      getAzureDevOpsToken();
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('configuration not loaded edge case', () => {
    it('should default to false (no browser launch) if config cannot be loaded', () => {
      // Mock loadConfiguration to throw
      const { loadConfiguration } = require('../../src/config/config.js');
      loadConfiguration.mockImplementationOnce(() => {
        throw new Error('Config not initialized');
      });

      getAzureDevOpsToken();

      const command = mockExecSync.mock.calls[0][0] as string;
      // Should default to safe behavior (no browser launch)
      expect(command).toContain('--allow-no-subscriptions');
    });
  });

  describe('error handling', () => {
    it('should throw error if Azure CLI command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Azure CLI not found');
      });

      expect(() => getAzureDevOpsToken()).toThrow(
        'Failed to get Azure DevOps token. Ensure you are logged in with az login (non-interactive)'
      );
    });

    it('should throw same error regardless of autoLaunchBrowser setting', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Authentication failed');
      });

      // Test with false
      mockConfig.autoLaunchBrowser = false;
      expect(() => getAzureDevOpsToken()).toThrow('Failed to get Azure DevOps token');

      clearTokenCache();

      // Test with true
      mockConfig.autoLaunchBrowser = true;
      expect(() => getAzureDevOpsToken()).toThrow('Failed to get Azure DevOps token');
    });
  });

  describe('Azure CLI command structure', () => {
    it('should build correct command with all flags when browser launch disabled', () => {
      mockConfig.autoLaunchBrowser = false;

      getAzureDevOpsToken();

      const command = mockExecSync.mock.calls[0][0] as string;
      
      // Verify command structure
      expect(command).toContain('az account get-access-token');
      expect(command).toContain('--resource 499b84ac-1321-427f-aa17-267ca6975798');
      expect(command).toContain('--query accessToken');
      expect(command).toContain('-o tsv');
      expect(command).toContain('--only-show-errors');
      expect(command).toContain('--allow-no-subscriptions');
    });

    it('should build correct command without --allow-no-subscriptions when browser launch enabled', () => {
      mockConfig.autoLaunchBrowser = true;

      getAzureDevOpsToken();

      const command = mockExecSync.mock.calls[0][0] as string;
      
      // Verify command structure
      expect(command).toContain('az account get-access-token');
      expect(command).toContain('--resource 499b84ac-1321-427f-aa17-267ca6975798');
      expect(command).toContain('--query accessToken');
      expect(command).toContain('-o tsv');
      expect(command).toContain('--only-show-errors');
      expect(command).not.toContain('--allow-no-subscriptions');
    });
  });
});
