/**
 * Azure DevOps Discovery Service
 * 
 * Provides functionality to discover project structure including:
 * - Area paths and iteration paths
 * - Git repositories and branches  
 * - Work item types and their properties
 * - Team and process information
 */

import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

interface ADOApiResponse<T> {
  count: number;
  value: T[];
}

interface AreaPath {
  id: string;
  name: string;
  path: string;
  hasChildren: boolean;
  children?: AreaPath[];
}

interface IterationPath {
  id: string;
  name: string;
  path: string;
  hasChildren: boolean;
  children?: IterationPath[];
  attributes?: {
    startDate?: string;
    finishDate?: string;
  };
}

interface Repository {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  size: number;
  branches?: string[];
}

interface WorkItemType {
  name: string;
  description?: string;
  color: string;
  icon: string;
  isDisabled: boolean;
  states?: WorkItemState[];
  fields?: WorkItemField[];
}

interface WorkItemState {
  name: string;
  color: string;
  category: string;
}

interface WorkItemField {
  name: string;
  referenceName: string;
  type: string;
  description?: string;
  isRequired: boolean;
  isReadOnly: boolean;
}

/**
 * Execute Azure CLI command and return JSON result
 */
function executeAzCommand(command: string): any {
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000 // 30 second timeout
    });
    
    return JSON.parse(result);
  } catch (error) {
    logger.error(`Azure CLI command failed: ${command}`, error);
    throw new Error(`Azure DevOps API call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get area paths from Azure DevOps project
 */
export async function getAreaPaths(
  organization: string,
  project: string,
  includeChildren: boolean = true,
  maxDepth: number = 10
): Promise<{ areaPaths: AreaPath[], totalCount: number }> {
  const depth = includeChildren ? maxDepth : 1;
  
  const command = `az boards area project list --organization "https://dev.azure.com/${organization}" --project "${project}" --depth ${depth} --output json`;
  
  const response = executeAzCommand(command);
  
  const areaPaths: AreaPath[] = response.map((item: any) => ({
    id: item.identifier,
    name: item.name,
    path: item.path,
    hasChildren: item.hasChildren || false,
    children: item.children ? item.children.map((child: any) => ({
      id: child.identifier,
      name: child.name,
      path: child.path,
      hasChildren: child.hasChildren || false
    })) : undefined
  }));

  return {
    areaPaths,
    totalCount: areaPaths.length
  };
}

/**
 * Get iteration paths from Azure DevOps project
 */
export async function getIterationPaths(
  organization: string,
  project: string,
  includeChildren: boolean = true,
  maxDepth: number = 10,
  includeCompleted: boolean = false
): Promise<{ iterationPaths: IterationPath[], totalCount: number }> {
  const depth = includeChildren ? maxDepth : 1;
  
  const command = `az boards iteration project list --organization "https://dev.azure.com/${organization}" --project "${project}" --depth ${depth} --output json`;
  
  const response = executeAzCommand(command);
  
  const currentDate = new Date();
  
  const iterationPaths: IterationPath[] = response
    .map((item: any) => ({
      id: item.identifier,
      name: item.name,
      path: item.path,
      hasChildren: item.hasChildren || false,
      attributes: item.attributes ? {
        startDate: item.attributes.startDate,
        finishDate: item.attributes.finishDate
      } : undefined,
      children: item.children ? item.children.map((child: any) => ({
        id: child.identifier,
        name: child.name,
        path: child.path,
        hasChildren: child.hasChildren || false,
        attributes: child.attributes ? {
          startDate: child.attributes.startDate,
          finishDate: child.attributes.finishDate
        } : undefined
      })) : undefined
    }))
    .filter((iteration: IterationPath) => {
      if (includeCompleted) return true;
      
      // If no finish date, include it (likely ongoing or future)
      if (!iteration.attributes?.finishDate) return true;
      
      // Include if finish date is in the future
      const finishDate = new Date(iteration.attributes.finishDate);
      return finishDate >= currentDate;
    });

  return {
    iterationPaths,
    totalCount: iterationPaths.length
  };
}

/**
 * Get Git repositories from Azure DevOps project
 */
export async function getRepositories(
  organization: string,
  project: string,
  includeBranches: boolean = true,
  maxRepositories: number = 50
): Promise<{ repositories: Repository[], totalCount: number }> {
  
  const command = `az repos list --organization "https://dev.azure.com/${organization}" --project "${project}" --output json`;
  
  const response = executeAzCommand(command);
  
  const repositories: Repository[] = [];
  
  for (const repo of response.slice(0, maxRepositories)) {
    const repository: Repository = {
      id: repo.id,
      name: repo.name,
      url: repo.remoteUrl || repo.webUrl,
      defaultBranch: repo.defaultBranch || 'main',
      size: repo.size || 0
    };

    if (includeBranches) {
      try {
        // Get branches for this repository
        const branchCommand = `az repos ref list --organization "https://dev.azure.com/${organization}" --project "${project}" --repository "${repo.name}" --filter "heads/" --output json`;
        const branchResponse = executeAzCommand(branchCommand);
        
        repository.branches = branchResponse.map((branch: any) => 
          branch.name.replace('refs/heads/', '')
        ).slice(0, 20); // Limit to 20 branches per repo
      } catch (error) {
        logger.warn(`Failed to get branches for repository ${repo.name}:`, error);
        repository.branches = [repository.defaultBranch];
      }
    }

    repositories.push(repository);
  }

  return {
    repositories,
    totalCount: repositories.length
  };
}

/**
 * Get work item types from Azure DevOps project
 */
export async function getWorkItemTypes(
  organization: string,
  project: string,
  includeFields: boolean = false,
  includeStates: boolean = true
): Promise<{ workItemTypes: WorkItemType[], totalCount: number }> {
  
  const command = `az boards work-item-type list --organization "https://dev.azure.com/${organization}" --project "${project}" --output json`;
  
  const response = executeAzCommand(command);
  
  const workItemTypes: WorkItemType[] = [];
  
  for (const witType of response) {
    const workItemType: WorkItemType = {
      name: witType.name,
      description: witType.description,
      color: witType.color || '#000000',
      icon: witType.icon || 'icon-work-item',
      isDisabled: witType.isDisabled || false
    };

    if (includeStates) {
      try {
        // Get states for this work item type
        const statesCommand = `az boards work-item-type show --organization "https://dev.azure.com/${organization}" --project "${project}" --work-item-type "${witType.name}" --output json`;
        const statesResponse = executeAzCommand(statesCommand);
        
        workItemType.states = statesResponse.states?.map((state: any) => ({
          name: state.name,
          color: state.color || '#000000',
          category: state.category || 'Unknown'
        })) || [];
      } catch (error) {
        logger.warn(`Failed to get states for work item type ${witType.name}:`, error);
        workItemType.states = [];
      }
    }

    if (includeFields) {
      try {
        // Get fields for this work item type  
        const fieldsCommand = `az boards work-item-type show --organization "https://dev.azure.com/${organization}" --project "${project}" --work-item-type "${witType.name}" --expand fields --output json`;
        const fieldsResponse = executeAzCommand(fieldsCommand);
        
        workItemType.fields = Object.values(fieldsResponse.fields || {}).map((field: any) => ({
          name: field.name,
          referenceName: field.referenceName,
          type: field.type,
          description: field.helpText,
          isRequired: field.alwaysRequired || false,
          isReadOnly: field.readOnly || false
        })) || [];
      } catch (error) {
        logger.warn(`Failed to get fields for work item type ${witType.name}:`, error);
        workItemType.fields = [];
      }
    }

    workItemTypes.push(workItemType);
  }

  return {
    workItemTypes,
    totalCount: workItemTypes.length
  };
}

/**
 * Check if Azure CLI is available and user is logged in
 */
export function validateAzureCLI(): { isAvailable: boolean, isLoggedIn: boolean, error?: string } {
  try {
    // Check if az command is available
    execSync('az --version', { stdio: 'pipe' });
    
    // Check if user is logged in
    try {
      execSync('az account show', { stdio: 'pipe' });
      return { isAvailable: true, isLoggedIn: true };
    } catch {
      return { 
        isAvailable: true, 
        isLoggedIn: false, 
        error: 'Azure CLI is available but user is not logged in. Please run: az login' 
      };
    }
  } catch (error) {
    return { 
      isAvailable: false, 
      isLoggedIn: false, 
      error: 'Azure CLI is not installed or not available in PATH' 
    };
  }
}