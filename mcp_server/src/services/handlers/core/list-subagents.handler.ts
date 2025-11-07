/**
 * Handler for wit-list-subagents tool
 * Discovers available specialized Copilot agents in a repository
 */

import type { ToolExecutionResult } from "@/types/index.js";
import { getRequiredConfig } from "@/config/config.js";
import { logger } from "@/utils/logger.js";
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
  filePath: string;
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
 * Returns metadata object or debug info string if failed
 */
function parseSubagentMetadata(content: string, filePath: string): SubagentMetadata | null {
  const debugLines: string[] = [];
  
  try {
    // Show first 300 chars for debugging
    debugLines.push(`    First 300 chars: "${content.substring(0, 300)}..."`);
    logger.debug(`Parsing YAML from ${filePath}, first 200 chars: ${content.substring(0, 200)}`);
    
    const parsed = yaml.parse(content);
    
    const parsedPreview = JSON.stringify(parsed, null, 2).substring(0, 500);
    debugLines.push(`    Parsed structure preview: ${parsedPreview}`);
    logger.debug(`Parsed YAML structure: ${parsedPreview}`);
    
    // Look for metadata section - check both root level and nested
    if (parsed && typeof parsed === 'object') {
      // Check if name and description are at root level
      if ('name' in parsed && 'description' in parsed) {
        const name = parsed.name as string;
        const description = parsed.description as string;
        
        if (name && description) {
          debugLines.push(`    Found at root: name="${name}"`);
          logger.debug(`Found metadata at root: name="${name}", description="${description}"`);
          return {
            name,
            description,
            filePath
          };
        }
      }
      
      // Also check for common YAML comment patterns (metadata might be in comments)
      // Look for lines starting with "# metadata" followed by name/description
      const lines = content.split('\n');
      let inMetadata = false;
      let name = '';
      let description = '';
      
      debugLines.push(`    Scanning ${lines.length} lines for comment metadata...`);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Check if this is a metadata section marker
        if (trimmed === '# metadata' || trimmed === '#metadata') {
          inMetadata = true;
          debugLines.push(`    Found metadata marker at line ${i + 1}`);
          continue;
        }
        
        // If in metadata section and line starts with #
        if (inMetadata && trimmed.startsWith('#')) {
          // Remove leading # and whitespace
          const contentLine = trimmed.substring(1).trim();
          
          if (contentLine.toLowerCase().startsWith('name:')) {
            name = contentLine.substring(5).trim();
            debugLines.push(`    Found name at line ${i + 1}: "${name}"`);
          } else if (contentLine.toLowerCase().startsWith('description:')) {
            description = contentLine.substring(12).trim();
            debugLines.push(`    Found description at line ${i + 1}: "${description.substring(0, 50)}..."`);
          }
        } else if (inMetadata && !trimmed.startsWith('#') && trimmed.length > 0) {
          // Exited metadata comment block
          debugLines.push(`    Exited metadata block at line ${i + 1}`);
          break;
        }
      }
      
      if (name && description) {
        debugLines.push(`    Successfully extracted from comments!`);
        logger.debug(`Found metadata in comments: name="${name}", description="${description}"`);
        return {
          name,
          description,
          filePath
        };
      } else {
        debugLines.push(`    No valid name/description found. name="${name}", description="${description}"`);
      }
    } else {
      debugLines.push(`    Parsed result is not an object: ${typeof parsed}`);
    }
    
    // Log all debug lines
    debugLines.forEach(line => logger.debug(line));
    
    return null;
  } catch (error) {
    const errorMsg = `Failed to parse YAML from ${filePath}: ${error}`;
    debugLines.push(`    Parse error: ${errorMsg}`);
    logger.warn(errorMsg);
    
    // Log all debug lines even on error
    debugLines.forEach(line => logger.debug(line));
    
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

    // Filter for YAML/YML files
    const yamlFiles = gitItems.filter(item => 
      item.gitObjectType === 'blob' && 
      (item.path.endsWith('.yml') || item.path.endsWith('.yaml'))
    );

    logger.debug(`Found ${yamlFiles.length} YAML files in ${policiesPath}`);

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
    const debugInfo: string[] = [];

    for (const file of yamlFiles) {
      try {
        debugInfo.push(`Fetching: ${file.path}`);
        
        // Fetch file content - ADO returns content directly as text when downloading
        // Use includeContent=true to get the actual file content
        const contentResponse = await httpClient.get<string>(
          `git/repositories/${encodeURIComponent(repository)}/items?path=${encodeURIComponent(file.path)}&includeContent=true&api-version=7.1-preview.1`
        );

        // ADO returns the content directly as a string (not base64)
        const content = contentResponse.data;
        const contentType = typeof content;
        const contentPreview = typeof content === 'string' ? content.substring(0, 150) : JSON.stringify(content).substring(0, 150);
        
        debugInfo.push(`  Content type: ${contentType}, preview: ${contentPreview}`);
        logger.debug(`Fetched ${file.path}, content length: ${typeof content === 'string' ? content.length : 'not a string'}`);
        
        if (content && typeof content === 'string') {
          const metadata = parseSubagentMetadata(content, file.path);
          
          if (metadata) {
            subagents.push(metadata);
            debugInfo.push(`  ✓ Found agent: ${metadata.name}`);
            logger.debug(`Found subagent: ${metadata.name}`);
          } else {
            debugInfo.push(`  ✗ No metadata found in file`);
            logger.debug(`No metadata found in ${file.path}`);
          }
        } else {
          const msg = `Invalid content format for ${file.path}: expected string, got ${contentType}`;
          debugInfo.push(`  ✗ ${msg}`);
          errors.push(msg);
          logger.warn(msg);
        }
      } catch (error) {
        const errorMsg = `Failed to read ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
        debugInfo.push(`  ✗ Error: ${errorMsg}`);
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    const result = buildSuccessResponse(
      {
        repository,
        subagents,
        scannedFiles: yamlFiles.length,
        foundAgents: subagents.length,
        debug: debugInfo // Include debug info in response
      },
      { 
        source: 'list-subagents',
        organization,
        project
      }
    );

    // Combine errors and debug info as warnings
    const allWarnings = [...errors];
    if (debugInfo.length > 0) {
      allWarnings.push('=== Debug Info ===', ...debugInfo);
    }
    
    if (allWarnings.length > 0) {
      result.warnings = allWarnings;
    }

    return result;
  } catch (error) {
    logger.error('Failed to list subagents', error);
    return buildErrorResponse(
      error as Error,
      { source: 'list-subagents' }
    );
  }
}
