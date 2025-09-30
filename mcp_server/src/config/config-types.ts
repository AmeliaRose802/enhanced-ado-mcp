import { z } from 'zod';

// ---- TypeScript Interfaces ----
export interface AzureDevOpsConfig {
  organization: string;
  project: string;
  defaultWorkItemType: 'Task' | 'Product Backlog Item' | 'Bug' | 'Feature' | 'Epic' | 'User Story';
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

// ---- Zod Schemas ----

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
  defaultBranch: z.string().min(1).default('main')
});

export const gitHubCopilotConfigSchema = z.object({
  defaultGuid: z.string().default('')
});

export const mcpServerConfigSchema = z.object({
  azureDevOps: azureDevOpsConfigSchema,
  gitRepository: gitRepositoryConfigSchema,
  gitHubCopilot: gitHubCopilotConfigSchema,
  verboseLogging: z.boolean().default(false)
});

export type MCPServerConfigSchema = z.infer<typeof mcpServerConfigSchema>;
