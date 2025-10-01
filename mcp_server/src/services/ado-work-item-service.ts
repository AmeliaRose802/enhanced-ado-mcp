/**
 * Azure DevOps Work Item Service
 * 
 * Provides functionality to create and manage work items using Azure DevOps REST API
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../utils/logger.js';
import { AZURE_DEVOPS_RESOURCE_ID } from '../config/config.js';

interface WorkItemField {
  op: string;
  path: string;
  value: any;
}

interface CreateWorkItemArgs {
  Title: string;
  WorkItemType: string;
  ParentWorkItemId?: number;
  Description?: string;
  Organization: string;
  Project: string;
  AreaPath?: string;
  IterationPath?: string;
  AssignedTo?: string;
  Priority?: number;
  Tags?: string;
  InheritParentPaths?: boolean;
}

interface WorkItemResult {
  id: number;
  title: string;
  type: string;
  state: string;
  url: string;
  parent_linked: boolean;
}

/**
 * Get Azure DevOps PAT token from Azure CLI
 */
function getAzureDevOpsToken(organization: string): string {
  try {
    // Use Azure CLI to get a token for Azure DevOps
    const result = execSync(
      `az account get-access-token --resource ${AZURE_DEVOPS_RESOURCE_ID} --query accessToken -o tsv`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (error) {
    logger.error('Failed to get Azure DevOps token from Azure CLI', error);
    throw new Error('Failed to authenticate with Azure DevOps. Please ensure you are logged in with: az login');
  }
}

/**
 * Resolve @me to current user email
 */
function resolveAssignedTo(assignedTo?: string): string | undefined {
  if (!assignedTo || assignedTo === '') {
    return undefined;
  }
  
  if (assignedTo === '@me') {
    try {
      const account = execSync('az account show --output json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const accountData = JSON.parse(account);
      return accountData.user.name;
    } catch (error) {
      logger.warn('Failed to resolve @me assignment, skipping assignment', error);
      return undefined;
    }
  }
  
  return assignedTo;
}

/**
 * Get parent work item details to inherit paths
 */
async function getParentWorkItem(
  organization: string,
  project: string,
  parentId: number,
  token: string
): Promise<{ areaPath?: string; iterationPath?: string } | null> {
  try {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${parentId}?api-version=7.1`;
    
    const curlCommand = `curl -s -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" "${url}"`;
    const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const workItem = JSON.parse(response);
    
    return {
      areaPath: workItem.fields?.['System.AreaPath'],
      iterationPath: workItem.fields?.['System.IterationPath']
    };
  } catch (error) {
    logger.warn(`Failed to get parent work item ${parentId}`, error);
    return null;
  }
}

/**
 * Execute REST API call using temporary file for JSON payload
 */
function executeRestApiCall(url: string, method: string, token: string, payload: any): any {
  const tempFile = join(tmpdir(), `ado-api-${Date.now()}.json`);
  
  try {
    // Write payload to temporary file
    writeFileSync(tempFile, JSON.stringify(payload), 'utf8');
    
    // Execute curl with file input
    const contentType = method === 'POST' ? 'application/json-patch+json' : 'application/json-patch+json';
    const curlCommand = `curl -s -X ${method} -H "Authorization: Bearer ${token}" -H "Content-Type: ${contentType}" -d @${tempFile} "${url}"`;
    
    const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(response);
  } finally {
    // Clean up temporary file
    try {
      unlinkSync(tempFile);
    } catch (error) {
      logger.warn(`Failed to delete temporary file ${tempFile}`, error);
    }
  }
}

/**
 * Create a work item using Azure DevOps REST API
 */
export async function createWorkItem(args: CreateWorkItemArgs): Promise<WorkItemResult> {
  const {
    Title,
    WorkItemType,
    ParentWorkItemId,
    Description,
    Organization,
    Project,
    AreaPath,
    IterationPath,
    AssignedTo,
    Priority,
    Tags,
    InheritParentPaths = true
  } = args;

  // Get authentication token
  const token = getAzureDevOpsToken(Organization);
  
  // Resolve @me assignment
  const resolvedAssignedTo = resolveAssignedTo(AssignedTo);
  
  // Get parent paths if inheriting
  let effectiveAreaPath = AreaPath;
  let effectiveIterationPath = IterationPath;
  
  if (ParentWorkItemId && InheritParentPaths) {
    const parentData = await getParentWorkItem(Organization, Project, ParentWorkItemId, token);
    if (parentData) {
      if (!effectiveAreaPath && parentData.areaPath) {
        effectiveAreaPath = parentData.areaPath;
      }
      if (!effectiveIterationPath && parentData.iterationPath) {
        effectiveIterationPath = parentData.iterationPath;
      }
    }
  }
  
  // Build JSON Patch document for work item creation
  const fields: WorkItemField[] = [
    { op: 'add', path: '/fields/System.Title', value: Title }
  ];
  
  if (Description) {
    fields.push({ op: 'add', path: '/fields/System.Description', value: Description });
  }
  
  if (effectiveAreaPath) {
    fields.push({ op: 'add', path: '/fields/System.AreaPath', value: effectiveAreaPath });
  }
  
  if (effectiveIterationPath) {
    fields.push({ op: 'add', path: '/fields/System.IterationPath', value: effectiveIterationPath });
  }
  
  if (resolvedAssignedTo) {
    fields.push({ op: 'add', path: '/fields/System.AssignedTo', value: resolvedAssignedTo });
  }
  
  if (Priority !== undefined && Priority !== null) {
    fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: Priority });
  }
  
  if (Tags) {
    fields.push({ op: 'add', path: '/fields/System.Tags', value: Tags });
  }
  
  // Create work item via REST API
  // URL-encode the work item type to handle types with spaces like "Product Backlog Item"
  const encodedWorkItemType = encodeURIComponent(WorkItemType);
  const createUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems/$${encodedWorkItemType}?api-version=7.1`;
  
  logger.debug(`Creating work item: ${Title} (${WorkItemType})`);
  
  let workItem: any;
  try {
    workItem = executeRestApiCall(createUrl, 'POST', token, fields);
    
    if (!workItem.id) {
      throw new Error(`Failed to create work item: ${JSON.stringify(workItem)}`);
    }
    
    logger.debug(`Created work item ${workItem.id}`);
  } catch (error) {
    logger.error('Failed to create work item', error);
    throw new Error(`Failed to create work item: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Link to parent if specified
  let parentLinked = false;
  if (ParentWorkItemId) {
    try {
      const linkFields = [
        {
          op: 'add',
          path: '/relations/-',
          value: {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${ParentWorkItemId}`,
            attributes: {
              comment: 'Parent link'
            }
          }
        }
      ];
      
      const linkUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems/${workItem.id}?api-version=7.1`;
      
      executeRestApiCall(linkUrl, 'PATCH', token, linkFields);
      parentLinked = true;
      
      logger.debug(`Linked work item ${workItem.id} to parent ${ParentWorkItemId}`);
    } catch (error) {
      logger.warn(`Failed to link work item ${workItem.id} to parent ${ParentWorkItemId}`, error);
    }
  }
  
  return {
    id: workItem.id,
    title: workItem.fields['System.Title'],
    type: workItem.fields['System.WorkItemType'],
    state: workItem.fields['System.State'],
    url: `https://dev.azure.com/${Organization}/${Project}/_workitems/edit/${workItem.id}`,
    parent_linked: parentLinked
  };
}

/**
 * Query work items using WIQL (Work Item Query Language)
 */
interface WiqlQueryArgs {
  WiqlQuery: string;
  Organization: string;
  Project: string;
  IncludeFields?: string[];
  MaxResults?: number;
}

interface WiqlWorkItemResult {
  id: number;
  title: string;
  type: string;
  state: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  url: string;
  fields: Record<string, any>;
}

export async function queryWorkItemsByWiql(args: WiqlQueryArgs): Promise<{
  workItems: WiqlWorkItemResult[];
  count: number;
  query: string;
}> {
  const {
    WiqlQuery,
    Organization,
    Project,
    IncludeFields = [],
    MaxResults = 200
  } = args;

  // Get authentication token
  const token = getAzureDevOpsToken(Organization);
  
  const tempFile = join(tmpdir(), `ado-wiql-query-${Date.now()}.json`);
  
  try {
    // Execute WIQL query
    const wiqlBody = { query: WiqlQuery };
    const wiqlUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/wiql?api-version=7.1`;
    
    writeFileSync(tempFile, JSON.stringify(wiqlBody), 'utf8');
    const curlCommand = `curl -s -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d @${tempFile} "${wiqlUrl}"`;
    
    logger.debug(`Executing WIQL query: ${WiqlQuery}`);
    
    const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const wiqlResult = JSON.parse(response);

    if (!wiqlResult.workItems || wiqlResult.workItems.length === 0) {
      return {
        workItems: [],
        count: 0,
        query: WiqlQuery
      };
    }

    // Limit results
    const workItemIds = wiqlResult.workItems
      .slice(0, MaxResults)
      .map((wi: any) => wi.id);

    logger.debug(`WIQL query returned ${wiqlResult.workItems.length} items, fetching details for first ${workItemIds.length}`);

    // Fetch work item details
    // Default fields to include
    const defaultFields = [
      'System.Id',
      'System.Title',
      'System.WorkItemType',
      'System.State',
      'System.AreaPath',
      'System.IterationPath',
      'System.AssignedTo'
    ];

    // Combine default fields with user-requested fields
    const allFields = [...new Set([...defaultFields, ...IncludeFields])];
    const fieldsParam = allFields.join(',');

    const ids = workItemIds.join(',');
    const detailsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems?ids=${ids}&fields=${encodeURIComponent(fieldsParam)}&api-version=7.1`;

    const detailsCommand = `curl -s -H "Authorization: Bearer ${token}" "${detailsUrl}"`;
    const detailsResponse = execSync(detailsCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const detailsResult = JSON.parse(detailsResponse);

    if (!detailsResult.value) {
      throw new Error('Failed to fetch work item details');
    }

    // Map work items to result format
    const workItems: WiqlWorkItemResult[] = detailsResult.value.map((wi: any) => ({
      id: wi.id,
      title: wi.fields['System.Title'] || '',
      type: wi.fields['System.WorkItemType'] || '',
      state: wi.fields['System.State'] || '',
      areaPath: wi.fields['System.AreaPath'],
      iterationPath: wi.fields['System.IterationPath'],
      assignedTo: wi.fields['System.AssignedTo']?.displayName || wi.fields['System.AssignedTo']?.uniqueName,
      url: `https://dev.azure.com/${Organization}/${Project}/_workitems/edit/${wi.id}`,
      fields: wi.fields
    }));

    return {
      workItems,
      count: workItems.length,
      query: WiqlQuery
    };

  } catch (error) {
    logger.error('WIQL query execution failed', error);
    throw new Error(`Failed to execute WIQL query: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Clean up temporary file
    try {
      unlinkSync(tempFile);
    } catch (cleanupError) {
      logger.warn(`Failed to delete temporary WIQL file ${tempFile}`, cleanupError);
    }
  }
}
