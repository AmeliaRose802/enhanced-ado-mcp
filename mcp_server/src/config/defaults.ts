import type { MCPServerConfig } from './config-types.js';

// Azure DevOps OAuth resource ID (Microsoft well-known constant)
export const AZURE_DEVOPS_RESOURCE_ID = '499b84ac-1321-427f-aa17-267ca6975798';

// System defaults kept intentionally minimal; only values safe & generic.
export const SYSTEM_DEFAULTS: Partial<MCPServerConfig> = {
  azureDevOps: {
    // No hardcoded organization/project - require user input via CLI
    organization: '',
    project: '',
    defaultWorkItemType: 'Product Backlog Item',
    defaultPriority: 2,
    defaultAssignedTo: '@me',
    areaPath: '',
    inheritParentPaths: true
  } as any,
  gitRepository: {
    defaultBranch: 'main'
  },
  gitHubCopilot: {
    // no default GUID - user must provide via configuration
    defaultGuid: ''
  },
  toolBehavior: {
    autoInheritPaths: true,
    dryRunMode: false,
    verboseLogging: false
  },
  security: {
    requireAuthentication: true
  }
};

export const USER_CONFIG_DIR = '.mcp/ado-work-item';
export const USER_CONFIG_FILE = 'config.json';
export const PROJECT_CONFIG_FILE = 'mcp-config.json';
