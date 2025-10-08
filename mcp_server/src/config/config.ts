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

// ============================================================================
// Constants
// ============================================================================

/** Azure DevOps OAuth resource ID (Microsoft well-known constant) */
export const AZURE_DEVOPS_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";

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
  /** Azure DevOps project name (required positional argument) */
  project: string;
  /** Optional area path override (from --area-path or -a flag) */
  areaPath?: string;
  /** Optional GitHub Copilot user GUID (from --copilot-guid or -g flag) */
  copilotGuid?: string;
  /** Enable verbose logging (from --verbose or -v flag, default: false) */
  verbose?: boolean;
  /** Allow browser auto-launch for authentication (from --auto-launch-browser flag, default: false) */
  autoLaunchBrowser?: boolean;
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
  autoLaunchBrowser: boolean;
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
  autoLaunchBrowser: z.boolean().default(false),
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
        "Usage: enhanced-ado-msp <organization> <project> [options]"
    );
  }

  // Build config from CLI args + schema defaults
  const configData = {
    azureDevOps: {
      organization: cliArgs.organization,
      project: cliArgs.project,
      ...(cliArgs.areaPath && { areaPath: cliArgs.areaPath }),
    },
    gitRepository: {},
    gitHubCopilot: {
      ...(cliArgs.copilotGuid && { defaultGuid: cliArgs.copilotGuid }),
    },
    verboseLogging: cliArgs.verbose || false,
    autoLaunchBrowser: cliArgs.autoLaunchBrowser || false,
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
