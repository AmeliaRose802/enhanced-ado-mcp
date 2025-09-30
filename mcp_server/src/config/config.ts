/**
 * Configuration System
 * 
 * All configuration types, schemas, constants, and loading logic in one place.
 * 
 * Config sources:
 * 1. CLI arguments (organization, project, area-path, copilot-guid, verbose)
 * 2. Zod schema defaults for optional fields
 */

import { logger } from '../utils/logger.js';
import {
  type MCPServerConfig,
  type MCPServerConfigSchema,
  mcpServerConfigSchema
} from './config-types.js';

// ============================================================================
// Constants
// ============================================================================

/** Azure DevOps OAuth resource ID (Microsoft well-known constant) */
export const AZURE_DEVOPS_RESOURCE_ID = '499b84ac-1321-427f-aa17-267ca6975798';

// Re-export types and schemas for convenience
export * from './config-types.js';

// ============================================================================
// Configuration Loading
// ============================================================================

let cachedConfig: MCPServerConfig | null = null;
let cliArgs: any = null;

function formatConfigError(stage: string, details: string): Error {
  return new Error(`config:${stage}: ${details}`);
}

export function loadConfiguration(forceReload = false): MCPServerConfig {
  if (cachedConfig && !forceReload) return cachedConfig;

  const verbose = process.env.MCP_DEBUG === '1';

  if (!cliArgs) {
    throw formatConfigError('validate',
      'Configuration not initialized. CLI args must be set first.\\n' +
      'Usage: enhanced-ado-msp <organization> <project> [options]'
    );
  }

  // Build config from CLI args + schema defaults
  const configData = {
    azureDevOps: {
      organization: cliArgs.organization,
      project: cliArgs.project,
      ...(cliArgs.areaPath && { areaPath: cliArgs.areaPath })
    },
    gitRepository: {},
    gitHubCopilot: {
      ...(cliArgs.copilotGuid && { defaultGuid: cliArgs.copilotGuid })
    },
    verboseLogging: cliArgs.verbose || false
  };

  // Validate and apply schema defaults
  const parsed = mcpServerConfigSchema.safeParse(configData);
  if (!parsed.success) {
    throw formatConfigError('validate', parsed.error.message);
  }

  const cfg = parsed.data;
  
  // Apply verbose logging flag
  if (cfg.verboseLogging) {
    process.env.MCP_DEBUG = process.env.MCP_DEBUG || '1';
  }
  
  if (verbose) {
    logger.info(`Config loaded: org=${cfg.azureDevOps.organization}, project=${cfg.azureDevOps.project}`);
  }
  
  cachedConfig = cfg;
  return cfg;
}

export function updateConfigFromCLI(args: any): void {
  cliArgs = args;
}
