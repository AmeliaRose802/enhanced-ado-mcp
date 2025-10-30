import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type ToolExecutionResult = {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
};

// Mock dependencies before importing
const mockExecuteTool = jest.fn<(toolName: string, args: any) => Promise<ToolExecutionResult>>();
const mockUpdateConfigFromCLI = jest.fn<(args: any) => void>();
const mockLoadConfiguration = jest.fn<() => any>();

jest.mock('../../src/services/tool-service.js', () => ({
  executeTool: mockExecuteTool
}));

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: mockLoadConfiguration,
  updateConfigFromCLI: mockUpdateConfigFromCLI
}));

describe('Configuration and Discovery Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock configuration
    mockLoadConfiguration.mockReturnValue({
      azureDevOps: {
        organization: 'test-org',
        project: 'test-project',
        areaPath: 'TestProject\\TestTeam\\TestComponent',
        defaultWorkItemType: 'Task'
      }
    });
  });

  describe('wit-get-config', () => {
    it('should get all configuration sections', async () => {
      const mockConfigData = {
        configuration: {
          azureDevOps: {
            organization: 'test-org',
            project: 'test-project',
            areaPath: 'TestProject\\TestTeam',
            defaultWorkItemType: 'Task'
          },
          defaults: {
            priority: 2,
            assignee: 'GitHub Copilot'
          }
        },
        helpText: {
          areaPath: 'Area path format: ProjectName\\Team\\Component',
          defaultWorkItemType: 'Default type for new work items'
        }
      };

      mockExecuteTool.mockResolvedValueOnce({
        success: true,
        data: mockConfigData,
        errors: [],
        warnings: []
      });

      const result = await mockExecuteTool('wit-get-config', { Section: 'all' });

      expect(result.success).toBe(true);
      expect(result.data.configuration).toBeDefined();
      expect(result.data.helpText).toBeDefined();
      expect(result.data.configuration.azureDevOps.organization).toBe('test-org');
    });

    it('should get Azure DevOps section only', async () => {
      const mockConfigData = {
        configuration: {
          azureDevOps: {
            organization: 'test-org',
            project: 'test-project',
            areaPath: 'TestProject\\TestTeam',
            defaultWorkItemType: 'Product Backlog Item'
          }
        }
      };

      mockExecuteTool.mockResolvedValueOnce({
        success: true,
        data: mockConfigData,
        errors: [],
        warnings: []
      });

      const result = await mockExecuteTool('wit-get-config', {
        Section: 'azureDevOps',
        IncludeSensitive: true
      });

      expect(result.success).toBe(true);
      expect(result.data.configuration.azureDevOps).toBeDefined();
      expect(result.data.configuration.azureDevOps.organization).toBe('test-org');
      expect(result.data.configuration.azureDevOps.defaultWorkItemType).toBe('Product Backlog Item');
    });

    it('should include help text for configuration guidance', async () => {
      const mockConfigData = {
        configuration: { azureDevOps: {} },
        helpText: {
          areaPath: 'Area path format: ProjectName\\Team\\Component',
          organization: 'Your Azure DevOps organization name',
          project: 'Extracted from area path (first segment)'
        }
      };

      mockExecuteTool.mockResolvedValueOnce({
        success: true,
        data: mockConfigData,
        errors: [],
        warnings: []
      });

      const result = await mockExecuteTool('wit-get-config', { Section: 'all' });

      expect(result.success).toBe(true);
      expect(result.data.helpText).toBeDefined();
      expect(result.data.helpText.areaPath).toContain('ProjectName\\Team\\Component');
    });

    it('should handle configuration errors', async () => {
      mockExecuteTool.mockResolvedValueOnce({
        success: false,
        data: null,
        errors: ['Configuration not found or invalid'],
        warnings: []
      });

      const result = await mockExecuteTool('wit-get-config', { Section: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Configuration not found or invalid');
    });
  });

  describe('updateConfigFromCLI', () => {
    it('should update configuration with CLI arguments', () => {
      mockUpdateConfigFromCLI.mockImplementation((args) => {
        expect(args.organization).toBe('test-org');
        expect(args.project).toBe('test-project');
        expect(args.areaPath).toBe('TestProject\\TestTeam\\TestComponent');
      });

      mockUpdateConfigFromCLI({
        organization: 'test-org',
        project: 'test-project',
        areaPath: 'TestProject\\TestTeam\\TestComponent'
      });

      expect(mockUpdateConfigFromCLI).toHaveBeenCalledTimes(1);
    });
  });
});
