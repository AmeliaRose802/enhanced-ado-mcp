import type { ToolExecutionResult } from "../types/index.js";
import { toolConfigs } from "../config/tool-configs.js";
import { executeScript } from "../utils/script-executor.js";
import { logger } from "../utils/logger.js";
import { getRedactedConfig, loadConfiguration } from "../config/config-manager.js";
import { SamplingService } from "./sampling-service.js";
import { 
  getAreaPaths, 
  getIterationPaths, 
  getRepositories, 
  getWorkItemTypes, 
  validateAzureCLI 
} from "./ado-discovery-service.js";

// Global server instance for sampling service
let serverInstance: any = null;

/**
 * Set the server instance for sampling capabilities
 */
export function setServerInstance(server: any) {
  serverInstance = server;
}

/**
 * Execute a tool by name with the given arguments
 */
export async function executeTool(name: string, args: any): Promise<ToolExecutionResult> {
  let config = toolConfigs.find(t => t.name === name);
  if (!config && name.startsWith('enhanced-ado-msp-')) {
    const legacy = 'wit-' + name.replace('enhanced-ado-msp-', '');
    config = toolConfigs.find(t => t.name === legacy);
  }
  if (!config) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Internal pseudo-tool (no script execution)
  if (name === 'wit-show-config') {
    // ensure config loaded (will throw if invalid / secrets missing)
    const cfg = loadConfiguration();
    const redacted = getRedactedConfig();
    return {
      success: true,
      data: redacted,
      raw: { stdout: JSON.stringify(redacted, null, 2), stderr: '', exitCode: 0 },
      metadata: { source: 'internal', configVersion: cfg.configVersion ?? 1 },
      errors: [],
      warnings: []
    };
  }

  // Get configuration information
  if (name === 'wit-get-configuration') {
    try {
      const cfg = loadConfiguration();
      const section = args?.Section || 'all';
      const includeSensitive = args?.IncludeSensitive || false;
      
      let configData: any = {};
      
      if (section === 'all' || section === 'azureDevOps') {
        configData.azureDevOps = cfg.azureDevOps;
      }
      if (section === 'all' || section === 'gitRepository') {
        configData.gitRepository = cfg.gitRepository;
      }
      if (section === 'all' || section === 'gitHubCopilot') {
        configData.gitHubCopilot = includeSensitive ? cfg.gitHubCopilot : { 
          defaultGuid: cfg.gitHubCopilot.defaultGuid ? '***' : ''
        };
      }
      if (section === 'all' || section === 'toolBehavior') {
        configData.toolBehavior = cfg.toolBehavior;
      }
      if (section === 'all' || section === 'security') {
        configData.security = cfg.security;
      }
      
      return {
        success: true,
        data: {
          configuration: configData,
          helpText: {
            areaPath: cfg.azureDevOps.areaPath ? 
              `Default area path is configured as: ${cfg.azureDevOps.areaPath}. Use wit-discover-area-paths to see all available paths.` :
              'No default area path configured. Use wit-discover-area-paths to see available paths.',
            iterationPath: cfg.azureDevOps.iterationPath ?
              `Default iteration path is configured as: ${cfg.azureDevOps.iterationPath}. Use wit-discover-iteration-paths to see all available paths.` :
              'No default iteration path configured. Use wit-discover-iteration-paths to see available paths.',
            repositories: cfg.gitRepository.defaultRepository ?
              `Default repository is configured as: ${cfg.gitRepository.defaultRepository}. Use wit-discover-repositories to see all available repositories.` :
              'No default repository configured. Use wit-discover-repositories to see available repositories.',
            gitHubCopilot: cfg.gitHubCopilot.defaultGuid ?
              'GitHub Copilot GUID is configured for automatic assignment.' :
              'No GitHub Copilot GUID configured. Provide copilot-guid parameter or configure gitHubCopilot.defaultGuid.'
          }
        },
        raw: { stdout: JSON.stringify(configData, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'internal', section },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
        metadata: { source: 'internal' },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }

  // Discover area paths
  if (name === 'wit-discover-area-paths') {
    try {
      const azValidation = validateAzureCLI();
      if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
        throw new Error(azValidation.error || 'Azure CLI validation failed');
      }

      const result = await getAreaPaths(
        args?.Organization || loadConfiguration().azureDevOps.organization,
        args?.Project || loadConfiguration().azureDevOps.project,
        args?.IncludeChildPaths !== false,
        args?.MaxDepth || 10
      );

      return {
        success: true,
        data: {
          areaPaths: result.areaPaths,
          totalCount: result.totalCount,
          helpText: 'Use these area paths when creating work items. Include the full path (e.g., "MyProject\\Team\\Component") in the AreaPath parameter.'
        },
        raw: { stdout: JSON.stringify(result, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'azure-cli', discoveryType: 'areaPaths' },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
        metadata: { source: 'azure-cli', discoveryType: 'areaPaths' },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }

  // Discover iteration paths
  if (name === 'wit-discover-iteration-paths') {
    try {
      const azValidation = validateAzureCLI();
      if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
        throw new Error(azValidation.error || 'Azure CLI validation failed');
      }

      const result = await getIterationPaths(
        args?.Organization || loadConfiguration().azureDevOps.organization,
        args?.Project || loadConfiguration().azureDevOps.project,
        args?.IncludeChildPaths !== false,
        args?.MaxDepth || 10,
        args?.IncludeCompleted || false
      );

      return {
        success: true,
        data: {
          iterationPaths: result.iterationPaths,
          totalCount: result.totalCount,
          helpText: 'Use these iteration paths when creating work items. Include the full path (e.g., "MyProject\\Sprint 1") in the IterationPath parameter.'
        },
        raw: { stdout: JSON.stringify(result, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'azure-cli', discoveryType: 'iterationPaths' },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
        metadata: { source: 'azure-cli', discoveryType: 'iterationPaths' },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }

  // Discover repositories
  if (name === 'wit-discover-repositories') {
    try {
      const azValidation = validateAzureCLI();
      if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
        throw new Error(azValidation.error || 'Azure CLI validation failed');
      }

      const result = await getRepositories(
        args?.Organization || loadConfiguration().azureDevOps.organization,
        args?.Project || loadConfiguration().azureDevOps.project,
        args?.IncludeBranches !== false,
        args?.MaxRepositories || 50
      );

      return {
        success: true,
        data: {
          repositories: result.repositories,
          totalCount: result.totalCount,
          helpText: 'Use these repository names when assigning work items to GitHub Copilot or linking to Git repositories.'
        },
        raw: { stdout: JSON.stringify(result, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'azure-cli', discoveryType: 'repositories' },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
        metadata: { source: 'azure-cli', discoveryType: 'repositories' },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }

  // Discover work item types
  if (name === 'wit-discover-work-item-types') {
    try {
      const azValidation = validateAzureCLI();
      if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
        throw new Error(azValidation.error || 'Azure CLI validation failed');
      }

      const result = await getWorkItemTypes(
        args?.Organization || loadConfiguration().azureDevOps.organization,
        args?.Project || loadConfiguration().azureDevOps.project,
        args?.IncludeFields || false,
        args?.IncludeStates !== false
      );

      return {
        success: true,
        data: {
          workItemTypes: result.workItemTypes,
          totalCount: result.totalCount,
          helpText: 'Use these work item type names when creating work items. Each type may have different required fields and available states.'
        },
        raw: { stdout: JSON.stringify(result, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'azure-cli', discoveryType: 'workItemTypes' },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
        metadata: { source: 'azure-cli', discoveryType: 'workItemTypes' },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }

  // AI-powered intelligence analysis (uses sampling if available)
  if (name === 'wit-intelligence-analyzer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeWorkItem(args);
  }

  // Enhanced AI assignment analysis (uses sampling if available)
  if (name === 'wit-ai-assignment-analyzer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.analyzeAIAssignment(args);
  }

  // Feature decomposition with intelligent breakdown (uses sampling if available)
  if (name === 'wit-feature-decomposer') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.decomposeFeature(args);
  }

  // Hierarchy validation with intelligent parenting suggestions (uses sampling if available)
  if (name === 'wit-hierarchy-validator') {
    if (!serverInstance) {
      throw new Error("Server instance not available for sampling");
    }
    
    const samplingService = new SamplingService(serverInstance);
    return await samplingService.validateHierarchy(args);
  }

  logger.debug(`Executing tool '${name}' with args: ${JSON.stringify(args)}`);
  
  const parsed = config.schema.safeParse(args || {});
  if (!parsed.success) {
    throw new Error(`Validation error: ${parsed.error.message}`);
  }

  const result = await executeScript(name, config.script, parsed.data);
  logger.debug(`Tool '${name}' completed (success=${result.success}).`);
  
  return result;
}

/**
 * Get tool configuration by name
 */
export function getToolConfig(name: string) {
  return toolConfigs.find(t => t.name === name);
}

/**
 * Get all available tools
 */
export function getAllTools() {
  return toolConfigs;
}