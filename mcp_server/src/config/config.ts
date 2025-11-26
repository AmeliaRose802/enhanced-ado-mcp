/**
 * Configuration System
 *
 * All configuration types, schemas, constants, and loading logic in one place.
 *
 * Config sources:
 * 1. CLI arguments (organization, project, area-path, copilot-guid, verbose)
 * 2. Zod schema defaults for optional fields
 */

import { z } from "zod";
import { logger, errorToContext } from "../utils/logger.js";
import { findGitHubCopilotGuid } from "../services/ado-identity-service.js";
import { type AuthenticationType } from "../utils/ado-token.js";

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract project name from area path
 * Azure DevOps area paths follow the format: ProjectName\Area\SubArea
 * @param areaPath - The area path (e.g., "MyProject\\Team\\SubArea")
 * @returns The project name (first segment) or null if invalid
 */
export function extractProjectFromAreaPath(areaPath: string): string | null {
  if (!areaPath || typeof areaPath !== 'string') {
    return null;
  }
  
  const segments = areaPath.split('\\').filter(s => s.length > 0);
  if (segments.length === 0) {
    return null;
  }
  
  // **CRITICAL**: Azure DevOps area paths must have at least 2 segments (Project\Area)
  // Single segment indicates likely confusion between organization and area path
  if (segments.length < 2) {
    logger.warn(`Area path "${areaPath}" appears invalid - should be "ProjectName\\AreaName" format`);
    // Still return the single segment for backward compatibility, but log warning
  }
  
  // First segment is always the project name in Azure DevOps
  return segments[0];
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * CLI arguments structure from yargs
 * Represents the parsed command-line arguments passed to the server
 *
 * Note: yargs includes additional properties (_: for positional args, $0: for script name,
 * and both kebab-case and camelCase versions of options). These are allowed via index signature.
 */
export interface CLIArguments {
  /** Azure DevOps organization name (required positional argument) */
  organization: string;
  /** Optional area path override (from --area-path or -a flag) - DEPRECATED: Use areaPaths for multi-area support */
  areaPath?: string;
  /** Array of area paths (from repeated --area-path flags) - REQUIRED, project extracted automatically */
  areaPaths?: string[];
  /** Optional team name override for iteration path discovery (from --team flag) */
  team?: string;
  /** Optional iteration path override (from --iteration-path or -i flag) */
  iterationPath?: string;
  /** Optional GitHub Copilot user GUID (from --copilot-guid or -g flag) */
  copilotGuid?: string;
  /** Enable verbose logging (from --verbose or -v flag, default: false) */
  verbose?: boolean;
  /** Authentication type: 'interactive', 'azcli', or 'env' */
  authentication?: AuthenticationType;
  /** Azure tenant ID (optional, for multi-tenant scenarios) */
  tenant?: string;
  /** Allow additional yargs properties like _, $0, kebab-case versions, etc. */
  [key: string]: unknown;
}

export interface AzureDevOpsConfig {
  organization: string;
  project: string;
  defaultWorkItemType: "Task" | "Product Backlog Item" | "Bug" | "Feature" | "Epic" | "User Story";
  defaultPriority: number;
  defaultAssignedTo: string;
  /** @deprecated Use areaPaths for multi-area support */
  areaPath?: string;
  /** Array of configured area paths for multi-area support */
  areaPaths?: string[];
  /** Optional team name override for iteration path discovery */
  team?: string;
  iterationPath?: string;
  inheritParentPaths: boolean;
}

export interface GitRepositoryConfig {
  defaultBranch: string;
}

export interface GitHubCopilotConfig {
  defaultGuid: string;
}

export interface AuthenticationConfig {
  type: AuthenticationType;
  tenantId?: string;
}

export interface AIOperationTimeoutsConfig {
  /** Timeout for AI assignment analysis in milliseconds (default: 30000) */
  assignmentAnalysis: number;
  /** Timeout for comprehensive AI workload analysis in milliseconds (default: 120000) */
  workloadAnalysis: number;
  /** Timeout for AI query generation and analysis in milliseconds (default: 120000) */
  queryAnalysis: number;
}

export interface RateLimiterConfig {
  /** Bucket capacity (max burst size, default: 200 for free tier) */
  capacity: number;
  /** Refill rate in tokens per second (default: 3.33 ≈ 200/min for free tier) */
  refillRate: number;
}

export interface TelemetryConfig {
  /** Enable telemetry collection (opt-in, default: false) */
  enabled: boolean;
  /** Maximum events to keep in memory */
  maxEventsInMemory: number;
  /** Auto-export to file periodically */
  autoExport: boolean;
  /** Auto-export interval in milliseconds */
  autoExportInterval: number;
  /** Export directory path */
  exportDir: string;
  /** Enable console logging of telemetry events */
  consoleLogging: boolean;
}

export interface BatchAPIConfig {
  /** Enable batch API for bulk operations (default: true) */
  enabled: boolean;
  /** Maximum operations per batch (max: 200, default: 200) */
  maxBatchSize: number;
  /** Batch request timeout in milliseconds (default: 30000) */
  timeout: number;
  /** Fall back to sequential requests on batch error (default: true) */
  fallbackOnError: boolean;
  /** Auto-detect batch API support on startup (default: true) */
  autoDetectSupport: boolean;
}

export interface MCPServerConfig {
  azureDevOps: AzureDevOpsConfig;
  gitRepository: GitRepositoryConfig;
  gitHubCopilot: GitHubCopilotConfig;
  authentication: AuthenticationConfig;
  aiTimeouts: AIOperationTimeoutsConfig;
  rateLimiter: RateLimiterConfig;
  telemetry: TelemetryConfig;
  batchAPI: BatchAPIConfig;
  verboseLogging: boolean;
  enableDebugTools: boolean;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const azureDevOpsConfigSchema = z.object({
  organization: z.string().min(1, "organization required"),
  project: z.string().min(1, "project required"),
  defaultWorkItemType: z
    .enum(["Task", "Product Backlog Item", "Bug", "Feature", "Epic", "User Story"])
    .default("Product Backlog Item"),
  defaultPriority: z.number().int().min(1).max(10).default(2),
  defaultAssignedTo: z.string().min(1).default("@me"),
  areaPath: z.string().optional(),
  areaPaths: z.array(z.string().min(1)).optional(),
  iterationPath: z.string().optional(),
  inheritParentPaths: z.boolean().default(true),
});

export const gitRepositoryConfigSchema = z.object({
  defaultBranch: z.string().min(1).default("main"),
});

export const gitHubCopilotConfigSchema = z.object({
  defaultGuid: z.string().default(""),
});

export const authenticationConfigSchema = z.object({
  type: z.enum(["interactive", "azcli", "env"]).default("interactive"),
  tenantId: z.string().optional(),
});

export const aiOperationTimeoutsConfigSchema = z.object({
  assignmentAnalysis: z.number().int().min(1000).default(30000), // 30 seconds
  workloadAnalysis: z.number().int().min(1000).default(120000),  // 2 minutes
  queryAnalysis: z.number().int().min(1000).default(120000),      // 2 minutes
});

export const rateLimiterConfigSchema = z.object({
  capacity: z.number().int().min(10).max(2000).default(200),
  refillRate: z.number().min(0.1).max(50).default(3.33),
});

export const telemetryConfigSchema = z.object({
  enabled: z.boolean().default(false), // OPT-IN: Disabled by default
  maxEventsInMemory: z.number().int().min(100).max(100000).default(10000),
  autoExport: z.boolean().default(false),
  autoExportInterval: z.number().int().min(60000).default(300000), // 5 minutes default
  exportDir: z.string().default('./telemetry'),
  consoleLogging: z.boolean().default(false),
});

export const batchAPIConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxBatchSize: z.number().int().min(1).max(200).default(200),
  timeout: z.number().int().min(5000).max(60000).default(30000),
  fallbackOnError: z.boolean().default(true),
  autoDetectSupport: z.boolean().default(true),
});

export const mcpServerConfigSchema = z.object({
  azureDevOps: azureDevOpsConfigSchema,
  gitRepository: gitRepositoryConfigSchema,
  gitHubCopilot: gitHubCopilotConfigSchema,
  authentication: authenticationConfigSchema,
  aiTimeouts: aiOperationTimeoutsConfigSchema,
  rateLimiter: rateLimiterConfigSchema,
  telemetry: telemetryConfigSchema,
  batchAPI: batchAPIConfigSchema,
  verboseLogging: z.boolean().default(false),
  enableDebugTools: z.boolean().default(false),
});

export type MCPServerConfigSchema = z.infer<typeof mcpServerConfigSchema>;

// ============================================================================
// Configuration Loading
// ============================================================================

let cachedConfig: MCPServerConfig | null = null;
let cliArgs: CLIArguments | null = null;

function formatConfigError(stage: string, details: string): Error {
  return new Error(`config:${stage}: ${details}`);
}

export function loadConfiguration(forceReload = false): MCPServerConfig {
  if (cachedConfig && !forceReload) return cachedConfig;

  const verbose = process.env.MCP_DEBUG === "1";

  if (!cliArgs) {
    throw formatConfigError(
      "validate",
      "Configuration not initialized. CLI args must be set first.\\n" +
        "Usage: enhanced-ado-mcp <organization> --area-path <path>\\n" +
        "Example: enhanced-ado-mcp MyOrganization --area-path \"MyProject\\\\Team\\\\Component\""
    );
  }

  // Normalize area paths: support both single areaPath and multiple areaPaths
  let areaPaths: string[] = [];
  if (cliArgs.areaPaths && cliArgs.areaPaths.length > 0) {
    areaPaths = cliArgs.areaPaths;
  } else if (cliArgs.areaPath) {
    areaPaths = [cliArgs.areaPath];
    if (verbose) {
      logger.info('Single areaPath provided - normalized to areaPaths array for consistency');
    }
  }

  // Validate area paths
  if (areaPaths.length > 0) {
    const emptyIndices = areaPaths.map((p, i) => (!p || p.trim() === '') ? i : -1).filter(i => i !== -1);
    if (emptyIndices.length > 0) {
      throw formatConfigError(
        "validate",
        `Area path cannot be empty at indices: ${emptyIndices.join(', ')}`
      );
    }

    // Validate area path format (must contain backslash for Project\Area format)
    const invalidPaths = areaPaths.filter(p => !p.includes('\\'));
    if (invalidPaths.length > 0) {
      throw formatConfigError(
        "validate",
        `Invalid area path format. Area paths must follow "ProjectName\\AreaName" format.\\n` +
        `Invalid paths: ${invalidPaths.join(', ')}\\n` +
        `Example: "MyProject\\\\Team\\\\Component"\\n\\n` +
        `NOTE: If you meant to provide an organization name, it should be the first positional argument:\\n` +
        `  Correct: enhanced-ado-mcp ${cliArgs.organization} --area-path "MyProject\\\\Team"`
      );
    }

    // Check for duplicates
    const uniquePaths = new Set(areaPaths);
    if (uniquePaths.size !== areaPaths.length) {
      throw formatConfigError(
        "validate",
        `Duplicate area paths detected. Each area path must be unique.`
      );
    }
  }

  // Extract project from area paths (always required)
  let project: string | undefined = undefined;
  if (areaPaths.length > 0) {
    // Extract projects from all area paths
    const extractedProjects = new Set<string>();
    for (const areaPath of areaPaths) {
      const extractedProject = extractProjectFromAreaPath(areaPath);
      if (extractedProject) {
        extractedProjects.add(extractedProject);
      }
    }

    if (extractedProjects.size > 1) {
      throw formatConfigError(
        "validate",
        `Multiple projects detected in area paths: ${Array.from(extractedProjects).join(', ')}. ` +
        `Please provide explicit project parameter when using area paths from different projects.`
      );
    }

    if (extractedProjects.size === 1) {
      project = Array.from(extractedProjects)[0];
      
      // **CRITICAL**: Check if extracted project matches organization name (likely misconfiguration)
      if (project === cliArgs.organization) {
        logger.warn(`⚠️  WARNING: Extracted project name "${project}" matches organization name "${cliArgs.organization}"`);
        logger.warn(`⚠️  This is likely a configuration error. Did you mean to provide an area path like "${project}\\\\TeamName"?`);
        logger.warn(`⚠️  If "${project}" is both your organization AND project name, ignore this warning.`);
      }
      
      if (verbose) {
        logger.info(`Extracted project name '${project}' from area path(s)`);
      }
    }
  }

  // Validate we have both organization and project
  if (!cliArgs.organization) {
    throw formatConfigError(
      "validate",
      "Organization is required.\\n" +
        "Usage: enhanced-ado-mcp <organization> --area-path <path>\\n" +
        "Example: enhanced-ado-mcp MyOrganization --area-path \"MyProject\\\\Team\\\\Component\""
    );
  }

  if (!project) {
    throw formatConfigError(
      "validate",
      "Project is required. Provide area path that includes project:\\n" +
        "  Usage: enhanced-ado-mcp <organization> --area-path \"ProjectName\\\\Area\"\\n" +
        "  Example: enhanced-ado-mcp MyOrganization --area-path \"MyProject\\\\Team\\\\Component\""
    );
  }

  // Build config from CLI args + schema defaults
  const configData = {
    azureDevOps: {
      organization: cliArgs.organization,
      project: project,
      // Include both for backward compatibility
      ...(cliArgs.areaPath && { areaPath: cliArgs.areaPath }),
      ...(areaPaths.length > 0 && { areaPaths }),
      // Include team override if provided
      ...(cliArgs.team && { team: cliArgs.team }),
      // Include iteration path override if provided
      ...(cliArgs.iterationPath && { iterationPath: cliArgs.iterationPath }),
    },
    gitRepository: {},
    gitHubCopilot: {
      ...(cliArgs.copilotGuid && { defaultGuid: cliArgs.copilotGuid }),
    },
    authentication: {
      type: cliArgs.authentication || "interactive",
      ...(cliArgs.tenant && { tenantId: cliArgs.tenant }),
    },
    aiTimeouts: {
      // Schema defaults will be applied
    },
    rateLimiter: {
      // Schema defaults will be applied (capacity: 200, refillRate: 3.33)
    },
    telemetry: {
      // Schema defaults will be applied (enabled: false, opt-in)
      // Can be overridden with environment variables
      ...(process.env.MCP_TELEMETRY_ENABLED === '1' && { enabled: true }),
      ...(process.env.MCP_TELEMETRY_EXPORT_DIR && { exportDir: process.env.MCP_TELEMETRY_EXPORT_DIR }),
    },
    batchAPI: {
      // Schema defaults will be applied (enabled: true, maxBatchSize: 200, timeout: 30000)
      // Can be overridden with environment variables
      ...(process.env.ADO_BATCH_API_ENABLED === 'false' && { enabled: false }),
      ...(process.env.ADO_BATCH_SIZE && { maxBatchSize: parseInt(process.env.ADO_BATCH_SIZE, 10) }),
      ...(process.env.ADO_BATCH_TIMEOUT && { timeout: parseInt(process.env.ADO_BATCH_TIMEOUT, 10) }),
    },
    verboseLogging: cliArgs.verbose || false,
    enableDebugTools: process.env.MCP_ENABLE_DEBUG_TOOLS === "1",
  };

  // Validate and apply schema defaults
  const parsed = mcpServerConfigSchema.safeParse(configData);
  if (!parsed.success) {
    throw formatConfigError("validate", parsed.error.message);
  }

  const cfg = parsed.data;

  // Apply verbose logging flag
  if (cfg.verboseLogging) {
    process.env.MCP_DEBUG = process.env.MCP_DEBUG || "1";
  }

  if (verbose) {
    logger.info(
      `Config loaded: org=${cfg.azureDevOps.organization}, project=${cfg.azureDevOps.project}`
    );
  }

  cachedConfig = cfg;
  return cfg;
}

/**
 * Asynchronously look up and cache the GitHub Copilot GUID if not already configured
 * This should be called after initial configuration load to automatically discover Copilot
 * 
 * Uses Azure CLI authentication for identity lookups (separate from main OAuth flow)
 */
export async function ensureGitHubCopilotGuid(): Promise<string | null> {
  const config = loadConfiguration();
  
  // If already configured, return it
  if (config.gitHubCopilot.defaultGuid) {
    return config.gitHubCopilot.defaultGuid;
  }
  
  // Attempt auto-discovery using Azure CLI authentication
  logger.info('Attempting to auto-discover GitHub Copilot GUID...');
  
  try {
    const guid = await findGitHubCopilotGuid(config.azureDevOps.organization);
    
    if (guid) {
      // Cache the discovered GUID
      config.gitHubCopilot.defaultGuid = guid;
      cachedConfig = config;
      return guid;
    }
    
    // Not found via auto-discovery
    logger.info('GitHub Copilot identity not found via auto-discovery.');
    logger.info('Please specify the GUID with --copilot-guid flag if you want to enable Copilot assignment');
    return null;
  } catch (error) {
    logger.warn('Auto-discovery failed:', errorToContext(error));
    logger.info('Please ensure you are logged in with: az login');
    logger.info('Or specify the GUID manually with --copilot-guid flag');
    return null;
  }
}

/**
 * Auto-discover and cache the current iteration path for the team
 * Queries Azure DevOps team settings API to find the active iteration
 * 
 * @returns The discovered iteration path or null if not found
 */
export async function ensureCurrentIterationPath(): Promise<string | null> {
  const config = loadConfiguration();
  
  // If explicitly configured via CLI, use that and skip discovery
  if (config.azureDevOps.iterationPath) {
    logger.info(`Using configured iteration path: ${config.azureDevOps.iterationPath}`);
    return config.azureDevOps.iterationPath;
  }
  
  // Attempt auto-discovery
  logger.info('Attempting to auto-discover current iteration path...');
  
  try {
    const { getCurrentIterationPath } = await import('../services/ado-discovery-service.js');
    
    // Get the first area path for team extraction
    const areaPaths = config.azureDevOps.areaPaths || 
      (config.azureDevOps.areaPath ? [config.azureDevOps.areaPath] : []);
    
    if (areaPaths.length === 0) {
      logger.debug('No area paths configured. Cannot discover iteration path.');
      return null;
    }
    
    const primaryAreaPath = areaPaths[0];
    const iterationPath = await getCurrentIterationPath(
      config.azureDevOps.organization,
      config.azureDevOps.project,
      primaryAreaPath,
      config.azureDevOps.team  // Pass team override if provided
    );
    
    if (iterationPath) {
      logger.info(`Current iteration path discovered: ${iterationPath}`);
      // Cache in configuration
      if (cachedConfig) {
        cachedConfig.azureDevOps.iterationPath = iterationPath;
      }
      return iterationPath;
    } else {
      logger.debug('Current iteration path not found via auto-discovery.');
      logger.debug('New work items will not have a default iteration path unless explicitly specified.');
      return null;
    }
  } catch (error) {
    logger.warn(`Error during iteration path discovery: ${error instanceof Error ? error.message : String(error)}`);
    logger.debug('New work items will not have a default iteration path unless explicitly specified.');
    return null;
  }
}

export function updateConfigFromCLI(args: CLIArguments): void {
  cliArgs = args;
}

/**
 * Get required configuration for work item operations
 * Returns a simple object with organization, project, and other defaults
 */
export function getRequiredConfig() {
  const config = loadConfiguration();
  
  // Normalize area paths: if areaPaths is set, use it; otherwise fall back to single areaPath
  const areaPaths = config.azureDevOps.areaPaths || 
    (config.azureDevOps.areaPath ? [config.azureDevOps.areaPath] : []);
  
  return {
    organization: config.azureDevOps.organization,
    project: config.azureDevOps.project,
    defaultWorkItemType: config.azureDevOps.defaultWorkItemType,
    defaultPriority: config.azureDevOps.defaultPriority,
    /** @deprecated Use defaultAreaPaths instead */
    defaultAreaPath: config.azureDevOps.areaPath || areaPaths[0],
    /** Array of configured area paths */
    defaultAreaPaths: areaPaths,
    defaultIterationPath: config.azureDevOps.iterationPath,
    gitRepository: {
      defaultBranch: config.gitRepository.defaultBranch,
    },
    gitHubCopilot: {
      guid: config.gitHubCopilot.defaultGuid,
    },
  };
}
