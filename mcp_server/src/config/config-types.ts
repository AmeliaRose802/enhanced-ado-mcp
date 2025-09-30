import { z } from 'zod';

// ---- TypeScript Interfaces (kept shallow intentionally) ----
export interface AzureDevOpsConfig {
  organization: string; // required (no system default)
  project: string; // required (no system default)
  defaultWorkItemType: 'Task' | 'Product Backlog Item' | 'Bug' | 'Feature' | 'Epic' | 'User Story';
  defaultPriority: number; // 1-4 typical
  defaultAssignedTo: string; // '@me' or user principal name / email
  areaPath?: string;
  iterationPath?: string;
  inheritParentPaths: boolean;
}

export interface GitRepositoryMappingEntry {
  repository: string;
  branch: string;
}

export interface GitRepositoryConfig {
  defaultRepository?: string; // optional - repository should be provided per tool call
  defaultBranch: string; // system default 'main'
  repositoryMappings?: Record<string, GitRepositoryMappingEntry>;
}

export interface GitHubCopilotConfig {
  defaultGuid: string; // required - GitHub Copilot user GUID
  guidMappings?: Record<string, string>;
}

export interface ToolBehaviorConfig {
  defaultTags?: string[];
  autoInheritPaths: boolean;
  dryRunMode: boolean;
  verboseLogging: boolean;
}

export interface SecurityConfig {
  requireAuthentication: boolean;
  allowedOrganizations?: string[];
  allowedProjects?: string[];
  rateLimiting?: {
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
  };
}

export interface MCPServerConfig {
  configVersion?: number;
  azureDevOps: AzureDevOpsConfig;
  gitRepository: GitRepositoryConfig;
  gitHubCopilot: GitHubCopilotConfig;
  toolBehavior: ToolBehaviorConfig;
  security?: SecurityConfig; // optional for now
  // Future extension point: per-tool overrides, templates, etc.
}

// ---- Zod Schemas (light validation; reuse in runtime validation) ----

export const azureDevOpsConfigSchema = z.object({
  organization: z.string().min(1, 'organization required'),
  project: z.string().min(1, 'project required'),
  defaultWorkItemType: z.enum(['Task','Product Backlog Item','Bug','Feature','Epic','User Story']).default('Product Backlog Item'),
  defaultPriority: z.number().int().min(1).max(10).default(2),
  defaultAssignedTo: z.string().min(1).default('@me'),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  inheritParentPaths: z.boolean().default(true)
});

export const gitRepositoryConfigSchema = z.object({
  defaultRepository: z.string().optional(), // Optional - repository provided per tool call
  defaultBranch: z.string().min(1).default('main'),
  repositoryMappings: z.record(z.object({
    repository: z.string(),
    branch: z.string()
  })).optional()
});

export const gitHubCopilotConfigSchema = z.object({
  defaultGuid: z.string().default(''), // Empty allowed - validation happens at tool use time
  guidMappings: z.record(z.string()).optional()
});

export const toolBehaviorConfigSchema = z.object({
  defaultTags: z.array(z.string()).optional(),
  autoInheritPaths: z.boolean().default(true),
  dryRunMode: z.boolean().default(false),
  verboseLogging: z.boolean().default(false)
});

export const securityConfigSchema = z.object({
  requireAuthentication: z.boolean().default(true),
  allowedOrganizations: z.array(z.string()).optional(),
  allowedProjects: z.array(z.string()).optional(),
  rateLimiting: z.object({
    maxRequestsPerMinute: z.number().int().positive(),
    maxConcurrentRequests: z.number().int().positive()
  }).optional()
});

export const mcpServerConfigSchema = z.object({
  configVersion: z.number().int().optional(),
  azureDevOps: azureDevOpsConfigSchema,
  gitRepository: gitRepositoryConfigSchema,
  gitHubCopilot: gitHubCopilotConfigSchema,
  toolBehavior: toolBehaviorConfigSchema,
  security: securityConfigSchema.optional()
});

export type MCPServerConfigSchema = z.infer<typeof mcpServerConfigSchema>;

// Minimal shape for shallow merge (objects only one level deep)
export type ShallowConfigObject = Record<string, any>;
