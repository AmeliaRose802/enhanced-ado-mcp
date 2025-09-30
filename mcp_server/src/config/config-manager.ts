import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';
import { SYSTEM_DEFAULTS, USER_CONFIG_DIR, USER_CONFIG_FILE, PROJECT_CONFIG_FILE } from './defaults.js';
import { mcpServerConfigSchema, type MCPServerConfig, type ShallowConfigObject } from './config-types.js';

let cachedConfig: MCPServerConfig | null = null;

// Utility: shallow merge (object keys only, arrays & primitives overwritten)
function shallowMerge<T extends ShallowConfigObject>(base: T, override: ShallowConfigObject | undefined | null): T {
  if (!override) return base;
  const merged: ShallowConfigObject = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === null || v === undefined) continue; // ignore null/undefined
    merged[k] = v; // shallow assignment (arrays/primitives replaced)
  }
  return merged as T;
}

function loadJsonIfExists(filePath: string): any | undefined {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    throw formatConfigError('read', `Failed reading ${filePath}: ${(err as Error).message}`);
  }
  return undefined;
}

export function formatConfigError(stage: string, details: string): Error {
  return new Error(`config:${stage}: ${details}`);
}

function resolveUserConfigPath(): string {
  const home = os.homedir();
  return path.join(home, USER_CONFIG_DIR, USER_CONFIG_FILE);
}

function resolveProjectConfigPath(): string {
  return path.join(process.cwd(), PROJECT_CONFIG_FILE);
}

// No secret env management; rely solely on az login. PAT support removed.

function applyVerboseLoggingFlag(baseCfg: MCPServerConfig) {
  if (baseCfg.toolBehavior.verboseLogging) {
    process.env.MCP_DEBUG = process.env.MCP_DEBUG || '1';
  }
}

export function loadConfiguration(forceReload = false): MCPServerConfig {
  if (cachedConfig && !forceReload) return cachedConfig;

  const verbose = process.env.MCP_DEBUG === '1';

  // 1. system defaults (already shaped as partial config) – we will validate after merging overrides
  let working: ShallowConfigObject = JSON.parse(JSON.stringify(SYSTEM_DEFAULTS));

  // 2. user config
  const userPath = resolveUserConfigPath();
  const userCfg = loadJsonIfExists(userPath);
  if (userCfg) {
    if (verbose) logger.info(`Loaded user config: ${userPath}`);
    working = shallowMerge(working, userCfg);
  }

  // 3. project config
  const projectPath = resolveProjectConfigPath();
  const projectCfg = loadJsonIfExists(projectPath);
  if (projectCfg) {
    if (verbose) logger.info(`Loaded project config: ${projectPath}`);
    working = shallowMerge(working, projectCfg);
  }

  // 4. CLI overrides (highest priority)
  const cliConfigOverride = process.env.MCP_CLI_CONFIG;
  if (cliConfigOverride) {
    try {
      const cliCfg = JSON.parse(cliConfigOverride);
      if (verbose) logger.info('Applied CLI configuration overrides');
      working = shallowMerge(working, cliCfg);
    } catch (e) {
      logger.warn('Invalid CLI configuration override, ignoring');
    }
  }

  // Validate (will also apply defaults from schema for missing optional sub-values)
  const parsed = mcpServerConfigSchema.safeParse(working);
  if (!parsed.success) {
    throw formatConfigError('validate', parsed.error.message);
  }

  // Required: organization & project must exist (schema already enforces but ensure user awareness if absent)
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
  applyVerboseLoggingFlag(cfg);
  cachedConfig = cfg;
  return cfg;
}

export function updateConfigFromCLI(cliArgs: any): void {
  // Create temporary config override from CLI arguments
  const cliOverride: any = {
    azureDevOps: {},
    gitHubCopilot: {}
  };
  
  // Required positional arguments
  if (cliArgs.organization) {
    cliOverride.azureDevOps.organization = cliArgs.organization;
  }
  
  if (cliArgs.project) {
    cliOverride.azureDevOps.project = cliArgs.project;
  }
  
  // Optional arguments
  if (cliArgs.areaPath) {
    cliOverride.azureDevOps.areaPath = cliArgs.areaPath;
  }
  
  if (cliArgs.copilotGuid) {
    cliOverride.gitHubCopilot.defaultGuid = cliArgs.copilotGuid;
  }
  
  // Set environment variable for config override
  process.env.MCP_CLI_CONFIG = JSON.stringify(cliOverride);
}
