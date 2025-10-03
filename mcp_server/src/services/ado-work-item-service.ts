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
import { getAzureDevOpsToken as getToken } from '../utils/ado-token.js';

interface WorkItemField {
  op: string;
  path: string;
  value: any;
}

interface CreateWorkItemArgs {
  title: string;
  workItemType: string;
  parentWorkItemId?: number;
  description?: string;
  organization: string;
  project: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  priority?: number;
  tags?: string;
  inheritParentPaths?: boolean;
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
 * Get Azure DevOps PAT token from Azure CLI (wrapper for consistency)
 */
function getAzureDevOpsToken(organization?: string): string {
  // organization parameter kept for API compatibility but not used
  // Token is valid for all orgs in the Azure DevOps resource
  return getToken();
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
    title,
    workItemType,
    parentWorkItemId,
    description,
    organization,
    project,
    areaPath,
    iterationPath,
    assignedTo,
    priority,
    tags,
    inheritParentPaths = true
  } = args;

  // Get authentication token
  const token = getAzureDevOpsToken(organization);
  
  // Resolve @me assignment
  const resolvedAssignedTo = resolveAssignedTo(assignedTo);
  
  // Get parent paths if inheriting
  let effectiveAreaPath = areaPath;
  let effectiveIterationPath = iterationPath;
  
  if (parentWorkItemId && inheritParentPaths) {
    const parentData = await getParentWorkItem(organization, project, parentWorkItemId, token);
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
    { op: 'add', path: '/fields/System.Title', value: title }
  ];
  
  if (description) {
    fields.push({ op: 'add', path: '/fields/System.Description', value: description });
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
  
  if (priority !== undefined && priority !== null) {
    fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: priority });
  }
  
  if (tags) {
    fields.push({ op: 'add', path: '/fields/System.Tags', value: tags });
  }
  
  // Create work item via REST API
  // URL-encode the work item type to handle types with spaces like "Product Backlog Item"
  const encodedWorkItemType = encodeURIComponent(workItemType);
  const createUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/$${encodedWorkItemType}?api-version=7.1`;
  
  logger.debug(`Creating work item: ${title} (${workItemType})`);
  
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
  if (parentWorkItemId) {
    try {
      const linkFields = [
        {
          op: 'add',
          path: '/relations/-',
          value: {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: `https://dev.azure.com/${organization}/${project}/_apis/wit/workItems/${parentWorkItemId}`,
            attributes: {
              comment: 'Parent link'
            }
          }
        }
      ];
      
      const linkUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItem.id}?api-version=7.1`;
      
      executeRestApiCall(linkUrl, 'PATCH', token, linkFields);
      parentLinked = true;
      
      logger.debug(`Linked work item ${workItem.id} to parent ${parentWorkItemId}`);
    } catch (error) {
      logger.warn(`Failed to link work item ${workItem.id} to parent ${parentWorkItemId}`, error);
    }
  }
  
  return {
    id: workItem.id,
    title: workItem.fields['System.Title'],
    type: workItem.fields['System.WorkItemType'],
    state: workItem.fields['System.State'],
    url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${workItem.id}`,
    parent_linked: parentLinked
  };
}

/**
 * Assign work item to GitHub Copilot and link to branch
 */
interface AssignToCopilotArgs {
  workItemId: number;
  organization: string;
  project: string;
  repository: string;
  branch?: string;
  gitHubCopilotGuid: string;
}

export async function assignWorkItemToCopilot(args: AssignToCopilotArgs): Promise<{
  work_item_id: number;
  assigned_to: string;
  repository_linked: boolean;
  human_friendly_url: string;
  warnings?: string[];
}> {
  const {
    workItemId,
    organization,
    project,
    repository,
    branch = 'main',
    gitHubCopilotGuid
  } = args;

  const token = getAzureDevOpsToken(organization);
  const warnings: string[] = [];
  
  // Get repository information
  let repositoryId: string;
  let projectId: string;
  
  try {
    const repoUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}?api-version=7.1`;
    const curlCommand = `curl -s -H "Authorization: Bearer ${token}" "${repoUrl}"`;
    const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const repoInfo = JSON.parse(response);
    
    if (!repoInfo.id) {
      // Try listing all repos to find it
      const listUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories?api-version=7.1`;
      const listCommand = `curl -s -H "Authorization: Bearer ${token}" "${listUrl}"`;
      const listResponse = execSync(listCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const reposList = JSON.parse(listResponse);
      
      const repo = reposList.value?.find((r: any) => 
        r.name === repository || 
        r.id === repository || 
        r.name.toLowerCase() === repository.toLowerCase()
      );
      
      if (!repo) {
        const availableRepos = reposList.value?.map((r: any) => r.name).join(', ') || 'none';
        throw new Error(`Repository '${repository}' not found. Available: ${availableRepos}`);
      }
      
      repositoryId = repo.id;
      projectId = repo.project.id;
    } else {
      repositoryId = repoInfo.id;
      projectId = repoInfo.project.id;
    }
  } catch (error) {
    throw new Error(`Failed to retrieve repository information: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Create branch artifact link
  let branchLinkCreated = false;
  try {
    const vstfsUrl = `vstfs:///Git/Ref/${projectId}%2F${repositoryId}%2FGB${branch}`;
    const linkFields = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'ArtifactLink',
          url: vstfsUrl,
          attributes: {
            name: 'Branch',
            comment: `GitHub Copilot branch link: ${repository}/${branch}`
          }
        }
      }
    ];
    
    const linkUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
    executeRestApiCall(linkUrl, 'PATCH', token, linkFields);
    branchLinkCreated = true;
    
    logger.debug(`Created branch artifact link for work item ${workItemId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('RelationAlreadyExistsException') || errorMsg.includes('already exists')) {
      warnings.push('Branch artifact link already exists');
      branchLinkCreated = true;
    } else {
      warnings.push(`Could not create branch artifact link: ${errorMsg}`);
    }
  }
  
  // Assign to GitHub Copilot
  try {
    const assignFields = [
      {
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: gitHubCopilotGuid
      }
    ];
    
    const assignUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
    executeRestApiCall(assignUrl, 'PATCH', token, assignFields);
    
    logger.debug(`Assigned work item ${workItemId} to GitHub Copilot`);
  } catch (error) {
    throw new Error(`Failed to assign work item: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    work_item_id: workItemId,
    assigned_to: 'GitHub Copilot',
    repository_linked: branchLinkCreated,
    human_friendly_url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${workItemId}`,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Delete work item
 */
interface DeleteWorkItemArgs {
  WorkItemId: number;
  Organization: string;
  Project: string;
  HardDelete?: boolean;
}

export async function deleteWorkItem(args: DeleteWorkItemArgs): Promise<{
  work_item_id: number;
  deleted: boolean;
  hard_delete: boolean;
}> {
  const {
    WorkItemId,
    Organization,
    Project,
    HardDelete = false
  } = args;

  const token = getAzureDevOpsToken(Organization);
  
  try {
    const deleteUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems/${WorkItemId}?api-version=7.1${HardDelete ? '&destroy=true' : ''}`;
    const curlCommand = `curl -s -X DELETE -H "Authorization: Bearer ${token}" "${deleteUrl}"`;
    
    execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    logger.debug(`Deleted work item ${WorkItemId} (hard delete: ${HardDelete})`);
    
    return {
      work_item_id: WorkItemId,
      deleted: true,
      hard_delete: HardDelete
    };
  } catch (error) {
    throw new Error(`Failed to delete work item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract instruction links from work item body
 */
interface ExtractSecurityLinksArgs {
  workItemId: number;
  organization: string;
  project: string;
  scanType?: 'BinSkim' | 'CodeQL' | 'CredScan' | 'General' | 'All';
  includeWorkItemDetails?: boolean;
}

interface InstructionLink {
  Url: string;
  Type: string;
}

export async function extractSecurityInstructionLinks(args: ExtractSecurityLinksArgs): Promise<{
  work_item_id: number;
  title: string;
  instruction_links: InstructionLink[];
  links_found: number;
  work_item_url: string;
  work_item_details?: {
    assigned_to?: string;
    state: string;
    type: string;
  };
}> {
  const {
    workItemId,
    organization,
    project,
    scanType = 'All',
    includeWorkItemDetails = false
  } = args;

  const token = getAzureDevOpsToken(organization);
  
  // Get work item details
  const workItemUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  const curlCommand = `curl -s -H "Authorization: Bearer ${token}" "${workItemUrl}"`;
  const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const workItem = JSON.parse(response);
  
  if (!workItem.id) {
    throw new Error(`Work item ${workItemId} not found`);
  }
  
  // Extract links from fields
  const fieldsToCheck = [
    'System.Description',
    'Microsoft.VSTS.TCM.ReproSteps',
    'Microsoft.VSTS.Common.AcceptanceCriteria'
  ];
  
  const allLinks: InstructionLink[] = [];
  const urlPattern = /https?:\/\/[^\s<>"]+/gi;
  
  for (const field of fieldsToCheck) {
    const content = workItem.fields[field];
    if (content && typeof content === 'string') {
      const matches = content.match(urlPattern);
      if (matches) {
        for (let url of matches) {
          // Clean up trailing punctuation
          url = url.replace(/[,.;:)]$/, '');
          
          if (url && !url.includes('example.com')) {
            let type = 'General Link';
            
            if (url.match(/docs\.microsoft\.com|learn\.microsoft\.com/i)) {
              type = 'Microsoft Docs';
            } else if (url.match(/aka\.ms/i)) {
              type = 'Microsoft Link';
            } else if (url.match(/github\.com.*security/i)) {
              type = 'GitHub Security';
            } else if (url.match(/security|remediation|mitigation/i)) {
              type = 'Security Guide';
            } else if (url.match(/binskim|codeql|credscan/i)) {
              type = 'Scanner Docs';
            }
            
            allLinks.push({ Url: url, Type: type });
          }
        }
      }
    }
  }
  
  // Remove duplicates
  const uniqueLinks = Array.from(
    new Map(allLinks.map(link => [link.Url, link])).values()
  );
  
  const result: any = {
    work_item_id: workItemId,
    title: workItem.fields['System.Title'],
    instruction_links: uniqueLinks,
    links_found: uniqueLinks.length,
    work_item_url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${workItemId}`
  };
  
  if (includeWorkItemDetails) {
    result.work_item_details = {
      assigned_to: workItem.fields['System.AssignedTo']?.displayName,
      state: workItem.fields['System.State'],
      type: workItem.fields['System.WorkItemType']
    };
  }
  
  return result;
}

/**
 * Create work item and immediately assign to GitHub Copilot
 */
interface CreateAndAssignToCopilotArgs extends CreateWorkItemArgs {
  repository: string;
  branch?: string;
  gitHubCopilotGuid: string;
}

export async function createWorkItemAndAssignToCopilot(args: CreateAndAssignToCopilotArgs): Promise<{
  work_item_id: number;
  work_item_title: string;
  work_item_type: string;
  assigned_to: string;
  repository_linked: boolean;
  human_friendly_url: string;
}> {
  const {
    repository,
    branch = 'main',
    gitHubCopilotGuid,
    ...createArgs
  } = args;

  // First create the work item (unassigned)
  const createResult = await createWorkItem({
    ...createArgs,
    assignedTo: '' // Create unassigned initially
  });
  
  // Small delay to let work item initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Then assign to Copilot
  const assignResult = await assignWorkItemToCopilot({
    workItemId: createResult.id,
    organization: args.organization,
    project: args.project,
    repository,
    branch,
    gitHubCopilotGuid
  });
  
  return {
    work_item_id: createResult.id,
    work_item_title: createResult.title,
    work_item_type: createResult.type,
    assigned_to: 'GitHub Copilot',
    repository_linked: assignResult.repository_linked,
    human_friendly_url: assignResult.human_friendly_url
  };
}

/**
 * Query work items using WIQL (Work Item Query Language)
 */
interface WiqlQueryArgs {
  wiqlQuery: string;
  organization: string;
  project: string;
  includeFields?: string[];
  maxResults?: number;
  includeSubstantiveChange?: boolean;
  substantiveChangeHistoryCount?: number;
  computeMetrics?: boolean;
  staleThresholdDays?: number;
}

// Fields that indicate substantive changes
const SUBSTANTIVE_FIELDS = [
  'System.Description',
  'System.Title',
  'System.State',
  'System.AssignedTo',
  'Microsoft.VSTS.Common.Priority',
  'Microsoft.VSTS.Common.AcceptanceCriteria',
  'System.Tags',
  'Microsoft.VSTS.Common.ReproSteps',
];

// Fields that are typically automated/bulk updates
const AUTOMATED_FIELDS = [
  'System.IterationPath',
  'System.AreaPath',
  'Microsoft.VSTS.Common.StackRank',
  'Microsoft.VSTS.Common.BacklogPriority',
  'Microsoft.VSTS.Scheduling.StoryPoints',
];

function daysBetween(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isSubstantiveChange(
  currentRev: any,
  previousRev: any
): { isSubstantive: boolean; changeType: string } {
  if (!previousRev) {
    return { isSubstantive: false, changeType: 'Creation' };
  }

  // Check what fields changed
  const changedFields: string[] = [];
  for (const field of SUBSTANTIVE_FIELDS) {
    if (currentRev.fields[field] !== previousRev.fields[field]) {
      changedFields.push(field);
    }
  }

  const automatedFieldsChanged: string[] = [];
  for (const field of AUTOMATED_FIELDS) {
    if (currentRev.fields[field] !== previousRev.fields[field]) {
      automatedFieldsChanged.push(field);
    }
  }

  // If only automated fields changed and NO substantive fields changed, treat as non-substantive
  if (changedFields.length === 0 && automatedFieldsChanged.length > 0) {
    return {
      isSubstantive: false,
      changeType: `Automated: ${automatedFieldsChanged.join(', ')}`,
    };
  }

  // If any substantive field changed, it's substantive
  if (changedFields.length > 0) {
    return {
      isSubstantive: true,
      changeType: changedFields.map((f) => f.split('.').pop()).join(', '),
    };
  }

  return { isSubstantive: false, changeType: 'No significant changes' };
}

async function calculateSubstantiveChange(
  workItemId: number,
  createdDate: string,
  Organization: string,
  Project: string,
  historyCount: number,
  token: string
): Promise<{
  lastSubstantiveChangeDate: string;
  daysInactive: number;
}> {
  try {
    // Get revision history
    const revsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${workItemId}/revisions?$top=${historyCount}&api-version=7.1`;
    const revsCommand = `curl -s -H "Authorization: Bearer ${token}" "${revsUrl}"`;
    const revsResponse = execSync(revsCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const revsData = JSON.parse(revsResponse);
    const revisions = revsData.value || [];

    // Sort revisions by rev number descending (newest first)
    revisions.sort((a: any, b: any) => b.rev - a.rev);

    let lastSubstantiveChangeDate: string = createdDate;

    // Walk through revisions from newest to oldest
    for (let i = 0; i < revisions.length; i++) {
      const currentRev = revisions[i];
      const previousRev = i < revisions.length - 1 ? revisions[i + 1] : null;

      const analysis = isSubstantiveChange(currentRev, previousRev);

      if (analysis.isSubstantive) {
        lastSubstantiveChangeDate = currentRev.fields['System.ChangedDate'];
        break;
      }
    }

    const daysInactive = daysBetween(lastSubstantiveChangeDate);

    return {
      lastSubstantiveChangeDate,
      daysInactive,
    };
  } catch (error) {
    logger.warn(`Failed to calculate substantive change for work item ${workItemId}`, error);
    // Return default values on error
    return {
      lastSubstantiveChangeDate: createdDate,
      daysInactive: daysBetween(createdDate),
    };
  }
}

interface WiqlWorkItemResult {
  id: number;
  title: string;
  type: string;
  state: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  createdDate?: string;
  changedDate?: string;
  url: string;
  additionalFields?: Record<string, any>;  // Only fields explicitly requested via IncludeFields
  lastSubstantiveChangeDate?: string;  // Computed: date of last substantive change (filters automated updates)
  daysInactive?: number;  // Computed: days since last substantive change
  computedMetrics?: {  // Additional computed metrics
    daysSinceCreated?: number;
    daysSinceChanged?: number;
    hasDescription: boolean;
    isStale: boolean;
  };
}

export async function queryWorkItemsByWiql(args: WiqlQueryArgs): Promise<{
  workItems: WiqlWorkItemResult[];
  count: number;
  query: string;
}> {
  const {
    wiqlQuery,
    organization,
    project,
    includeFields = [],
    maxResults = 200,
    includeSubstantiveChange = false,
    substantiveChangeHistoryCount = 50,
    computeMetrics = false,
    staleThresholdDays = 180
  } = args;

  // Get authentication token
  const token = getAzureDevOpsToken(organization);
  
  const tempFile = join(tmpdir(), `ado-wiql-query-${Date.now()}.json`);
  
  try {
    // Execute WIQL query
    const wiqlBody = { query: wiqlQuery };
    const wiqlUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.1`;
    
    writeFileSync(tempFile, JSON.stringify(wiqlBody), 'utf8');
    const curlCommand = `curl -s -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d @${tempFile} "${wiqlUrl}"`;
    
    logger.debug(`Executing WIQL query: ${wiqlQuery}`);
    
    const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const wiqlResult = JSON.parse(response);

    if (!wiqlResult.workItems || wiqlResult.workItems.length === 0) {
      return {
        workItems: [],
        count: 0,
        query: wiqlQuery
      };
    }

    // Limit results
    const workItemIds = wiqlResult.workItems
      .slice(0, maxResults)
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

    // Add date fields if needed for substantive change analysis or computed metrics
    if (includeSubstantiveChange || computeMetrics) {
      defaultFields.push('System.CreatedDate', 'System.ChangedDate');
    }

    // Combine default fields with user-requested fields
    const allFields = [...new Set([...defaultFields, ...includeFields])];
    const fieldsParam = allFields.join(',');

    const ids = workItemIds.join(',');
    const detailsUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems?ids=${ids}&fields=${encodeURIComponent(fieldsParam)}&api-version=7.1`;

    const detailsCommand = `curl -s -H "Authorization: Bearer ${token}" "${detailsUrl}"`;
    const detailsResponse = execSync(detailsCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const detailsResult = JSON.parse(detailsResponse);

    if (!detailsResult.value) {
      throw new Error('Failed to fetch work item details');
    }

    // Map work items to result format
    const workItems: WiqlWorkItemResult[] = detailsResult.value.map((wi: any) => {
      // Extract additional fields not already in the top-level structure
      // Filter out redundant and verbose fields to save context window space
      const additionalFields: Record<string, any> = {};
      const extractedFields = new Set([
        'System.Id',
        'System.Title',
        'System.WorkItemType',
        'System.State',
        'System.AreaPath',
        'System.IterationPath',
        'System.AssignedTo',
        'System.CreatedDate',
        'System.ChangedDate',
        'System.Description'
      ]);
      
      // Only include fields that were explicitly requested and not already extracted
      for (const field of includeFields) {
        if (!extractedFields.has(field) && wi.fields[field] !== undefined) {
          // Simplify AssignedTo-like objects to just displayName
          if (typeof wi.fields[field] === 'object' && wi.fields[field]?.displayName) {
            additionalFields[field] = wi.fields[field].displayName;
          } else {
            additionalFields[field] = wi.fields[field];
          }
        }
      }
      
      const workItem: WiqlWorkItemResult = {
        id: wi.id,
        title: wi.fields['System.Title'] || '',
        type: wi.fields['System.WorkItemType'] || '',
        state: wi.fields['System.State'] || '',
        areaPath: wi.fields['System.AreaPath'],
        iterationPath: wi.fields['System.IterationPath'],
        assignedTo: wi.fields['System.AssignedTo']?.displayName || wi.fields['System.AssignedTo']?.uniqueName,
        createdDate: wi.fields['System.CreatedDate'],
        changedDate: wi.fields['System.ChangedDate'],
        url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${wi.id}`,
        ...(Object.keys(additionalFields).length > 0 && { additionalFields })
      };

      // Compute basic metrics if requested
      if (computeMetrics) {
        const description = wi.fields['System.Description'] || '';
        const descriptionText = description.replace(/<[^>]*>/g, '').trim(); // Strip HTML tags
        const hasDescription = descriptionText.length > 50;
        
        const createdDate = workItem.createdDate ? new Date(workItem.createdDate) : null;
        const changedDate = workItem.changedDate ? new Date(workItem.changedDate) : null;
        const now = new Date();
        
        const daysSinceCreated = createdDate ? Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;
        const daysSinceChanged = changedDate ? Math.floor((now.getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;
        const isStale = daysSinceChanged !== undefined && daysSinceChanged > staleThresholdDays;
        
        workItem.computedMetrics = {
          daysSinceCreated,
          daysSinceChanged,
          hasDescription,
          isStale
        };
      }

      return workItem;
    });

    // If substantive change analysis is requested, calculate it for each work item
    if (includeSubstantiveChange) {
      logger.debug(`Calculating substantive change data for ${workItems.length} work items`);
      
      // Process work items in parallel for efficiency
      const substantiveChangePromises = workItems.map(async (workItem) => {
        if (!workItem.createdDate) {
          return null;
        }
        
        const result = await calculateSubstantiveChange(
          workItem.id,
          workItem.createdDate,
          organization,
          project,
          substantiveChangeHistoryCount,
          token
        );
        
        return { id: workItem.id, ...result };
      });

      const substantiveChangeResults = await Promise.all(substantiveChangePromises);

      // Merge substantive change data into work items
      for (const result of substantiveChangeResults) {
        if (result) {
          const workItem = workItems.find(wi => wi.id === result.id);
          if (workItem) {
            workItem.lastSubstantiveChangeDate = result.lastSubstantiveChangeDate;
            workItem.daysInactive = result.daysInactive;
          }
        }
      }
    }

    return {
      workItems,
      count: workItems.length,
      query: wiqlQuery
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
