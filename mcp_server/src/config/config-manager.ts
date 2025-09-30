/**
 * Configuration Manager
 * 
 * Simple config system that merges:
 * 1. mcp-config.json (optional file in cwd) - defaults for work items, area paths, etc.
 * 2. CLI arguments (required: organization, project; optional: area-path, copilot-guid, verbose)
 * 
 * CLI args override config file values for org/project/areaPath/copilotGuid.
 * Schema validation applies sensible defaults for missing optional fields.
 * 
 * No multi-layer config loading, no env var serialization - just direct merge and validate.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { mcpServerConfigSchema, type MCPServerConfig } from './config-types.js';

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
      'Configuration not initialized. CLI args must be set first.\n' +
      'Usage: enhanced-ado-msp <organization> <project> [options]'
    );
  }

  // Start with config file if it exists
  let configData: any = {};
  const configPath = path.join(process.cwd(), 'mcp-config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      configData = JSON.parse(fileContent);
      if (verbose) logger.info(`Loaded config from ${configPath}`);
    } catch (e) {
      logger.warn(`Failed to load ${configPath}, using defaults`);
    }
  }

  // Merge CLI args (they override config file)
  configData.azureDevOps = {
    ...configData.azureDevOps,
    organization: cliArgs.organization,
    project: cliArgs.project,
    ...(cliArgs.areaPath && { areaPath: cliArgs.areaPath })
  };

  configData.gitRepository = configData.gitRepository || {};
  
  configData.gitHubCopilot = {
    ...configData.gitHubCopilot,
    ...(cliArgs.copilotGuid && { defaultGuid: cliArgs.copilotGuid })
  };

  configData.verboseLogging = cliArgs.verbose || configData.verboseLogging || false;

  // Validate and apply schema defaults
  const parsed = mcpServerConfigSchema.safeParse(configData);
  if (!parsed.success) {
    throw formatConfigError('validate', parsed.error.message);
  }

  // Required fields check (should always pass since we just set them)
  if (!parsed.data.azureDevOps.organization) {
    throw formatConfigError('validate',
      'Azure DevOps organization is required.\n' +
      'Usage: enhanced-ado-msp <organization> <project> [options]\n' +
      'Example: enhanced-ado-msp myorg myproject'
    );
  }
  if (!parsed.data.azureDevOps.project) {
    throw formatConfigError('validate',
      'Azure DevOps project is required.\n' +
      'Usage: enhanced-ado-msp <organization> <project> [options]\n' +
      'Example: enhanced-ado-msp myorg myproject'
    );
  }

  const cfg = parsed.data;
  
  // Apply verbose logging flag
  if (cfg.verboseLogging) {
    process.env.MCP_DEBUG = process.env.MCP_DEBUG || '1';
  }
  
  cachedConfig = cfg;
  return cfg;
}

export function updateConfigFromCLI(args: any): void {
  cliArgs = args;
}
