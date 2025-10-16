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
import { logger } from "../utils/logger.js";
import { findGitHubCopilotGuid } from "../services/ado-identity-service.js";

// ============================================================================
// Constants
// ============================================================================

/** Azure DevOps OAuth resource ID (Microsoft well-known constant) */
export const AZURE_DEVOPS_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";

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
  /** Azure DevOps project name (optional if area-path is provided - will be extracted from area path) */
  project?: string;
  /** Optional area path override (from --area-path or -a flag) */
  areaPath?: string;
  /** Optional GitHub Copilot user GUID (from --copilot-guid or -g flag) */
  copilotGuid?: string;
  /** Enable verbose logging (from --verbose or -v flag, default: false) */
  verbose?: boolean;
  /** Allow additional yargs properties like _, $0, kebab-case versions, etc. */
  [key: string]: unknown;
}

export interface AzureDevOpsConfig {
  organization: string;
  project: string;
  defaultWorkItemType: "Task" | "Product Backlog Item" | "Bug" | "Feature" | "Epic" | "User Story";
  defaultPriority: number;
  defaultAssignedTo: string;
  areaPath?: string;
  iterationPath?: string;
  inheritParentPaths: boolean;
}

export interface GitRepositoryConfig {
  defaultBranch: string;
}

export interface GitHubCopilotConfig {
  defaultGuid: string;
}

export interface MCPServerConfig {
  azureDevOps: AzureDevOpsConfig;
  gitRepository: GitRepositoryConfig;
  gitHubCopilot: GitHubCopilotConfig;
  verboseLogging: boolean;
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
  iterationPath: z.string().optional(),
  inheritParentPaths: z.boolean().default(true),
});

export const gitRepositoryConfigSchema = z.object({
  defaultBranch: z.string().min(1).default("main"),
});

export const gitHubCopilotConfigSchema = z.object({
  defaultGuid: z.string().default(""),
});

export const mcpServerConfigSchema = z.object({
  azureDevOps: azureDevOpsConfigSchema,
  gitRepository: gitRepositoryConfigSchema,
  gitHubCopilot: gitHubCopilotConfigSchema,
  verboseLogging: z.boolean().default(false),
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
        "Usage: enhanced-ado-msp <organization> [project] --area-path <path>\\n" +
        "Example: enhanced-ado-msp MyOrganization --area-path \"MyProject\\\\Team\\\\Component\""
    );
  }

  // Determine project: use explicit project or extract from area path
  let project = cliArgs.project;
  if (!project && cliArgs.areaPath) {
    const extractedProject = extractProjectFromAreaPath(cliArgs.areaPath);
    if (extractedProject) {
      project = extractedProject;
      if (verbose) {
        logger.info(`Extracted project name '${project}' from area path '${cliArgs.areaPath}'`);
      }
    }
  }

  // Validate we have both organization and project
  if (!cliArgs.organization) {
    throw formatConfigError(
      "validate",
      "Organization is required.\\n" +
        "Usage: enhanced-ado-msp <organization> [project] --area-path <path>\\n" +
        "Example: enhanced-ado-msp MyOrganization --area-path \"MyProject\\\\Team\\\\Component\""
    );
  }

  if (!project) {
    throw formatConfigError(
      "validate",
      "Project is required. Provide either:\\n" +
        "  1. Project as positional argument: enhanced-ado-msp <organization> <project>\\n" +
        "     Example: enhanced-ado-msp MyOrganization MyProject\\n" +
        "  2. Area path that includes project: --area-path \"ProjectName\\\\Area\"\\n" +
        "     Example: enhanced-ado-msp MyOrganization --area-path \"MyProject\\\\Team\\\\Component\""
    );
  }

  // Build config from CLI args + schema defaults
  const configData = {
    azureDevOps: {
      organization: cliArgs.organization,
      project: project,
      ...(cliArgs.areaPath && { areaPath: cliArgs.areaPath }),
    },
    gitRepository: {},
    gitHubCopilot: {
      ...(cliArgs.copilotGuid && { defaultGuid: cliArgs.copilotGuid }),
    },
    verboseLogging: cliArgs.verbose || false,
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
 */
export async function ensureGitHubCopilotGuid(): Promise<string | null> {
  const config = loadConfiguration();
  
  // If already configured, return it
  if (config.gitHubCopilot.defaultGuid) {
    return config.gitHubCopilot.defaultGuid;
  }
  
  // Try to look it up automatically
  logger.info('GitHub Copilot GUID not configured, attempting automatic lookup...');
  try {
    const guid = await findGitHubCopilotGuid(config.azureDevOps.organization);
    
    if (guid) {
      // Update the cached config with the found GUID
      config.gitHubCopilot.defaultGuid = guid;
      logger.info(`✓ Automatically discovered GitHub Copilot GUID: ${guid}`);
      return guid;
    } else {
      logger.warn('Could not automatically find GitHub Copilot GUID. Copilot assignment features will not work.');
      logger.warn('You can manually specify the GUID with --copilot-guid flag');
      return null;
    }
  } catch (error) {
    logger.error('Failed to lookup GitHub Copilot GUID', error);
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
  return {
    organization: config.azureDevOps.organization,
    project: config.azureDevOps.project,
    defaultWorkItemType: config.azureDevOps.defaultWorkItemType,
    defaultPriority: config.azureDevOps.defaultPriority,
    defaultAreaPath: config.azureDevOps.areaPath,
    defaultIterationPath: config.azureDevOps.iterationPath,
    gitRepository: {
      defaultBranch: config.gitRepository.defaultBranch,
    },
    gitHubCopilot: {
      guid: config.gitHubCopilot.defaultGuid,
    },
  };
}
