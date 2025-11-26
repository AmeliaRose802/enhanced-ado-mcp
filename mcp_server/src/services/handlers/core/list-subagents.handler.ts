/**
 * Handler for list-agents tool
 * Discovers available specialized Copilot agents in a repository
 */

import type { ToolExecutionResult } from "@/types/index.js";
import { getRequiredConfig } from "@/config/config.js";
import { logger, errorToContext } from "@/utils/logger.js";
import { listSubagentsSchema } from "@/config/schemas.js";
import { 
  buildValidationErrorResponse, 
  buildErrorResponse, 
  buildSuccessResponse 
} from "@/utils/response-builder.js";
import { createADOHttpClient } from "@/utils/ado-http-client.js";
import { getTokenProvider } from "@/utils/token-provider.js";
import { z } from "zod";
import yaml from "yaml";

type ListSubagentsInput = z.infer<typeof listSubagentsSchema>;

interface SubagentMetadata {
  name: string;
  description: string;
  url: string;
  tag: string;
}

interface GitItem {
  path: string;
  gitObjectType: string;
  url?: string;
}

interface GitItemsResponse {
  value: GitItem[];
  count: number;
}

/**
 * Parse YAML content to extract subagent metadata
 * Returns metadata object or null if parsing fails
 */
function parseSubagentMetadata(
  content: string, 
  filePath: string, 
  organization: string, 
  project: string, 
  repository: string
): SubagentMetadata | null {
  try {
    logger.debug(`Parsing YAML from ${filePath}, first 200 chars: ${content.substring(0, 200)}`);
    
    const parsed = yaml.parse(content);
    
    const parsedPreview = JSON.stringify(parsed, null, 2).substring(0, 500);
    logger.debug(`Parsed YAML structure: ${parsedPreview}`);
    
    // Look for metadata section - check both root level and nested
    if (parsed && typeof parsed === 'object') {
      // Check if name and description are at root level
      if ('name' in parsed && 'description' in parsed) {
        const name = String(parsed.name || '').trim();
        const description = String(parsed.description || '').trim();
        
        if (name && description) {
          // Extract tag from configuration section
          // Support multiple configuration formats:
          // 1. configuration.pullRequestCopilotPrimitive.copilotAgentName
          // 2. configuration.copilotConfiguration.specializedAgent.name
          let tag: string | undefined;
          
          if ('configuration' in parsed && parsed.configuration && typeof parsed.configuration === 'object') {
            const config = parsed.configuration as Record<string, any>;
            
            // Format 1: pullRequestCopilotPrimitive.copilotAgentName
            if ('pullRequestCopilotPrimitive' in config && 
                config.pullRequestCopilotPrimitive && 
                typeof config.pullRequestCopilotPrimitive === 'object') {
              const primitive = config.pullRequestCopilotPrimitive as Record<string, any>;
              if ('copilotAgentName' in primitive && primitive.copilotAgentName) {
                const agentName = String(primitive.copilotAgentName).trim();
                if (agentName) {
                  tag = `copilot:agent=${agentName}`;
                  logger.debug(`Found agent tag (format 1): ${tag}`);
                }
              }
            }
            
            // Format 2: copilotConfiguration.specializedAgent.name
            if (!tag && 'copilotConfiguration' in config && 
                config.copilotConfiguration && 
                typeof config.copilotConfiguration === 'object') {
              const copilotConfig = config.copilotConfiguration as Record<string, any>;
              if ('specializedAgent' in copilotConfig && 
                  copilotConfig.specializedAgent && 
                  typeof copilotConfig.specializedAgent === 'object') {
                const specializedAgent = copilotConfig.specializedAgent as Record<string, any>;
                if ('name' in specializedAgent && specializedAgent.name) {
                  const agentName = String(specializedAgent.name).trim();
                  if (agentName) {
                    tag = `copilot:agent=${agentName}`;
                    logger.debug(`Found agent tag (format 2): ${tag}`);
                  }
                }
              }
            }
          }
          
          // Build Azure DevOps URL for the file
          const encodedPath = encodeURIComponent(filePath);
          const url = `https://dev.azure.com/${organization}/${project}/_git/${repository}?path=${encodedPath}`;
          
          logger.debug(`Found metadata at root: name="${name}", description="${description}", tag="${tag || 'none'}"`);
          
          // Only return if we found a tag (assignable agent)
          if (tag) {
            return {
              name,
              description,
              url,
              tag
            };
          }
        }
      }
    }
    
    logger.debug(`No valid metadata found in parsed YAML for ${filePath}`);
    return null;
  } catch (error) {
    const errorMsg = `Failed to parse YAML from ${filePath}: ${error}`;
    logger.warn(errorMsg);
    return null;
  }
}

/**
 * List specialized subagents in a repository
 */
export async function handleListSubagents(args: unknown): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = listSubagentsSchema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, 'list-subagents');
    }

    const input = parsed.data as ListSubagentsInput;
    
    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();
    const organization = input.organization || requiredConfig.organization;
    const project = input.project || requiredConfig.project;
    const repository = input.repository;

    logger.debug(`Scanning repository ${repository} for specialized agents in /.azuredevops/policies`);

    // Create HTTP client for Git API
    const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
    
    // First, verify the repository exists
    try {
      const repoResponse = await httpClient.get<{ id: string; name: string }>(
        `git/repositories/${encodeURIComponent(repository)}`
      );
      logger.debug(`Found repository: ${repoResponse.data.name} (ID: ${repoResponse.data.id})`);
    } catch (error) {
      return buildErrorResponse(
        new Error(`Repository '${repository}' not found in project '${project}'`),
        { source: 'list-subagents', organization, project }
      );
    }

    // List items in /.azuredevops/policies directory
    const policiesPath = '.azuredevops/policies';
    let gitItems: GitItem[] = [];
    
    try {
      const itemsResponse = await httpClient.get<GitItemsResponse>(
        `git/repositories/${encodeURIComponent(repository)}/items?scopePath=/${encodeURIComponent(policiesPath)}&recursionLevel=OneLevel&api-version=7.1-preview.1`
      );
      
      gitItems = itemsResponse.data.value || [];
      logger.debug(`Found ${gitItems.length} items in ${policiesPath}`);
    } catch (error: any) {
      // If directory doesn't exist or is empty, return empty results
      if (error.status === 404) {
        logger.debug(`Directory ${policiesPath} not found in repository ${repository}`);
        return buildSuccessResponse(
          {
            repository,
            subagents: [],
            message: `No /.azuredevops/policies directory found in repository '${repository}'`
          },
          { 
            source: 'list-subagents',
            organization,
            project
          }
        );
      }
      throw error;
    }

    // Filter for YAML/YML files, excluding non-assignable config files
    const excludedFiles = ['pullrequestcopilot', 'code-reviewer'];
    const yamlFiles = gitItems.filter(item => {
      if (item.gitObjectType !== 'blob') return false;
      if (!item.path.endsWith('.yml') && !item.path.endsWith('.yaml')) return false;
      
      const lowerPath = item.path.toLowerCase();
      return !excludedFiles.some(excluded => lowerPath.includes(excluded));
    });

    logger.debug(`Found ${yamlFiles.length} YAML files in ${policiesPath} (excluding non-assignable configs)`);

    if (yamlFiles.length === 0) {
      return buildSuccessResponse(
        {
          repository,
          subagents: [],
          message: `No YAML files found in /.azuredevops/policies directory`
        },
        { 
          source: 'list-subagents',
          organization,
          project
        }
      );
    }

    // Fetch and parse each YAML file
    const subagents: SubagentMetadata[] = [];
    const errors: string[] = [];

    for (const file of yamlFiles) {
      try {
        logger.debug(`Fetching: ${file.path}`);
        
        // Use native fetch directly for file content to bypass JSON parsing
        // Azure DevOps returns octet-stream for file downloads
        const token = await getTokenProvider()();
        const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${encodeURIComponent(repository)}/items?path=${encodeURIComponent(file.path)}&download=true&api-version=7.1-preview.1`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/plain, application/octet-stream, */*',
            'X-TFS-FedAuthRedirect': 'Suppress'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        
        if (!content || content.length === 0) {
          const msg = `Unable to extract content from ${file.path}`;
          errors.push(msg);
          logger.warn(msg);
          continue;
        }
        
        logger.debug(`Fetched ${file.path}, content length: ${content.length}`);
        
        const metadata = parseSubagentMetadata(content, file.path, organization, project, repository);
        
        if (metadata) {
          // Only include agents that have a tag (assignable agents)
          if (metadata.tag) {
            subagents.push(metadata);
            logger.debug(`Found assignable subagent: ${metadata.name} (${metadata.tag})`);
          } else {
            logger.debug(`Skipping ${metadata.name} - no assignment tag found`);
          }
        } else {
          logger.debug(`No metadata found in ${file.path}`);
        }
      } catch (error) {
        const errorMsg = `Failed to read ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    const result = buildSuccessResponse(
      {
        repository,
        subagents,
        scannedFiles: yamlFiles.length,
        foundAgents: subagents.length
      },
      { 
        source: 'list-subagents',
        organization,
        project
      }
    );

    // Include errors as warnings if any occurred
    if (errors.length > 0) {
      result.warnings = errors;
    }

    return result;
  } catch (error) {
    logger.error('Failed to list subagents', errorToContext(error));
    return buildErrorResponse(
      error as Error,
      { source: 'list-subagents' }
    );
  }
}
