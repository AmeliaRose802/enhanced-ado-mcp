import type { ToolExecutionResult } from "../types/index.js";
import { toolConfigs } from "../config/tool-configs.js";
import { executeScript } from "../utils/script-executor.js";
import { logger } from "../utils/logger.js";
import { loadConfiguration } from "../config/config.js";
import { SamplingService } from "./sampling-service.js";
import { 
  validateAzureCLI 
} from "./ado-discovery-service.js";
import { createWorkItem } from "./ado-work-item-service.js";

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
      
      return {
        success: true,
        data: {
          configuration: configData,
          helpText: {
            areaPath: cfg.azureDevOps.areaPath
              ? `Default area path is configured as: ${cfg.azureDevOps.areaPath}.` :
              'No default area path configured.',
            iterationPath: cfg.azureDevOps.iterationPath
              ? `Default iteration path is configured as: ${cfg.azureDevOps.iterationPath}.` :
              'No default iteration path configured.',
            gitHubCopilot: cfg.gitHubCopilot.defaultGuid ?
              'GitHub Copilot GUID is configured for automatic assignment.' :
              'No GitHub Copilot GUID configured. Provide --copilot-guid parameter.'
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

  // Create work item using REST API (TypeScript implementation)
  if (name === 'wit-create-new-item') {
    try {
      const azValidation = validateAzureCLI();
      if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
        throw new Error(azValidation.error || 'Azure CLI validation failed');
      }

      // Parse and validate arguments using the schema
      const parsed = config.schema.safeParse(args || {});
      if (!parsed.success) {
        throw new Error(`Validation error: ${parsed.error.message}`);
      }

      logger.debug(`Creating work item with REST API: ${parsed.data.Title}`);
      
      const result = await createWorkItem(parsed.data);
      
      return {
        success: true,
        data: {
          work_item: result
        },
        raw: { 
          stdout: JSON.stringify({ work_item: result }, null, 2), 
          stderr: '', 
          exitCode: 0 
        },
        metadata: { 
          source: 'rest-api',
          workItemId: result.id,
          parentLinked: result.parent_linked
        },
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: { 
          stdout: '', 
          stderr: error instanceof Error ? error.message : String(error), 
          exitCode: 1 
        },
        metadata: { source: 'rest-api' },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
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