/**
 * Work Item Repository
 * 
 * Encapsulates all Azure DevOps Work Item API calls.
 * Separates data access logic from business logic.
 */

import { logger } from '../utils/logger.js';
import { createADOHttpClient, ADOHttpClient } from '../utils/ado-http-client.js';
import type { 
  ADOWorkItem, 
  ADORepository, 
  ADOWorkItemRevision, 
  ADOApiResponse, 
  ADOWiqlResult,
  ADOFieldOperation 
} from '../types/index.js';

/**
 * Work Item Repository
 * Handles all direct ADO API calls for work items
 */
export class WorkItemRepository {
  private httpClient: ADOHttpClient;
  private organization: string;
  private project: string;

  constructor(organization: string, project: string) {
    this.organization = organization;
    this.project = project;
    this.httpClient = createADOHttpClient(organization, project);
  }

  /**
   * Get a single work item by ID
   */
  async getById(workItemId: number, fields?: string[]): Promise<ADOWorkItem> {
    const fieldsParam = fields ? `?fields=${encodeURIComponent(fields.join(','))}` : '';
    const response = await this.httpClient.get<ADOWorkItem>(
      `wit/workitems/${workItemId}${fieldsParam}`
    );
    return response.data;
  }

  /**
   * Get multiple work items by IDs
   */
  async getBatch(workItemIds: number[], fields?: string[]): Promise<ADOWorkItem[]> {
    const ids = workItemIds.join(',');
    const fieldsParam = fields ? `&fields=${encodeURIComponent(fields.join(','))}` : '';
    const response = await this.httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
      `wit/workitems?ids=${ids}${fieldsParam}`
    );
    return response.data.value || [];
  }

  /**
   * Create a new work item
   */
  async create(workItemType: string, fields: ADOFieldOperation[]): Promise<ADOWorkItem> {
    const encodedWorkItemType = encodeURIComponent(workItemType);
    const response = await this.httpClient.post<ADOWorkItem>(
      `wit/workitems/$${encodedWorkItemType}`,
      fields
    );
    return response.data;
  }

  /**
   * Update a work item (PATCH operation)
   */
  async update(workItemId: number, fields: ADOFieldOperation[]): Promise<ADOWorkItem> {
    const response = await this.httpClient.patch<ADOWorkItem>(
      `wit/workitems/${workItemId}`,
      fields
    );
    return response.data;
  }

  /**
   * Delete a work item
   */
  async delete(workItemId: number, hardDelete = false): Promise<void> {
    const endpoint = hardDelete 
      ? `wit/workitems/${workItemId}?destroy=true`
      : `wit/workitems/${workItemId}`;
    
    await this.httpClient.delete(endpoint);
  }

  /**
   * Link a work item to a parent
   */
  async linkToParent(workItemId: number, parentWorkItemId: number): Promise<void> {
    const linkFields: ADOFieldOperation[] = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `https://dev.azure.com/${this.organization}/${this.project}/_apis/wit/workItems/${parentWorkItemId}`,
          attributes: {
            comment: 'Parent link'
          }
        }
      }
    ];
    
    await this.httpClient.patch(`wit/workitems/${workItemId}`, linkFields);
  }

  /**
   * Link a work item to a branch artifact
   */
  async linkToBranch(
    workItemId: number, 
    projectId: string, 
    repositoryId: string, 
    branch: string,
    repositoryName: string
  ): Promise<void> {
    const vstfsUrl = `vstfs:///Git/Ref/${projectId}%2F${repositoryId}%2FGB${branch}`;
    const linkFields: ADOFieldOperation[] = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'ArtifactLink',
          url: vstfsUrl,
          attributes: {
            name: 'Branch',
            comment: `GitHub Copilot branch link: ${repositoryName}/${branch}`
          }
        }
      }
    ];
    
    await this.httpClient.patch(`wit/workitems/${workItemId}`, linkFields);
  }

  /**
   * Get work item revision history
   */
  async getRevisions(workItemId: number, top?: number): Promise<ADOWorkItemRevision[]> {
    const topParam = top ? `?$top=${top}` : '';
    const response = await this.httpClient.get<ADOApiResponse<ADOWorkItemRevision[]>>(
      `wit/workItems/${workItemId}/revisions${topParam}`
    );
    return response.data.value || [];
  }

  /**
   * Execute a WIQL query
   */
  async executeWiql(wiqlQuery: string): Promise<ADOWiqlResult> {
    const wiqlBody = { query: wiqlQuery };
    const response = await this.httpClient.post<ADOWiqlResult>('wit/wiql', wiqlBody);
    return response.data;
  }

  /**
   * Get repository information
   */
  async getRepository(repositoryNameOrId: string): Promise<ADORepository> {
    try {
      const response = await this.httpClient.get<ADORepository>(
        `git/repositories/${repositoryNameOrId}`
      );
      return response.data;
    } catch (error) {
      // Repository not found by exact match, try listing all repos
      const listResponse = await this.httpClient.get<ADOApiResponse<ADORepository[]>>(
        'git/repositories'
      );
      const reposList = listResponse.data;
      
      const repo = reposList.value?.find((r: ADORepository) => 
        r.name === repositoryNameOrId || 
        r.id === repositoryNameOrId || 
        r.name.toLowerCase() === repositoryNameOrId.toLowerCase()
      );
      
      if (!repo) {
        const availableRepos = reposList.value?.map((r: ADORepository) => r.name).join(', ') || 'none';
        throw new Error(`Repository '${repositoryNameOrId}' not found. Available: ${availableRepos}`);
      }
      
      return repo;
    }
  }
}

/**
 * Create a work item repository instance
 */
export function createWorkItemRepository(organization: string, project: string): WorkItemRepository {
  return new WorkItemRepository(organization, project);
}
