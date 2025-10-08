/**
 * Azure DevOps Work Item Service
 * 
 * Provides functionality to create and manage work items using Azure DevOps REST API
 */

import { logger } from '../utils/logger.js';
import { getAzureDevOpsToken as getToken } from '../utils/ado-token.js';

import type { ADOWorkItem, ADORepository, ADOWorkItemRevision, ADOApiResponse, ADOWiqlResult } from '../types/ado.js';
import { createADOHttpClient, ADOHttpError, ADOHttpClient } from '../utils/ado-http-client.js';

interface WorkItemField {
  op: string;
  path: string;
  value: unknown;
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
 * Note: @me resolution now requires an explicit email/UPN instead
 */
function resolveAssignedTo(assignedTo?: string): string | undefined {
  if (!assignedTo || assignedTo === '') {
    return undefined;
  }
  
  if (assignedTo === '@me') {
    logger.warn('@me assignment is no longer supported. Please provide explicit user email/UPN.');
    return undefined;
  }
  
  return assignedTo;
}

/**
 * Create a work item using Azure DevOps REST API (using HTTP client)
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

  // Create HTTP client
  const httpClient = createADOHttpClient(organization, project);
  
  // Resolve @me assignment
  const resolvedAssignedTo = resolveAssignedTo(assignedTo);
  
  // Get parent paths if inheriting
  let effectiveAreaPath = areaPath;
  let effectiveIterationPath = iterationPath;
  
  if (parentWorkItemId && inheritParentPaths) {
    try {
      const parentResponse = await httpClient.get<ADOWorkItem>(`wit/workitems/${parentWorkItemId}`);
      const parentData = parentResponse.data;
      
      if (parentData.fields) {
        if (!effectiveAreaPath && parentData.fields['System.AreaPath']) {
          effectiveAreaPath = parentData.fields['System.AreaPath'] as string;
        }
        if (!effectiveIterationPath && parentData.fields['System.IterationPath']) {
          effectiveIterationPath = parentData.fields['System.IterationPath'] as string;
        }
      }
    } catch (error) {
      logger.warn(`Failed to get parent work item ${parentWorkItemId}`, error);
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
  
  logger.debug(`Creating work item: ${title} (${workItemType})`);
  
  let workItem: ADOWorkItem;
  try {
    // Create work item via HTTP client
    // URL-encode the work item type to handle types with spaces like "Product Backlog Item"
    const encodedWorkItemType = encodeURIComponent(workItemType);
    const response = await httpClient.post<ADOWorkItem>(
      `wit/workitems/$${encodedWorkItemType}`,
      fields
    );
    
    workItem = response.data;
    
    if (!workItem.id) {
      throw new Error(`Failed to create work item: ${JSON.stringify(workItem)}`);
    }
    
    logger.debug(`Created work item ${workItem.id}`);
  } catch (error) {
    if (error instanceof ADOHttpError) {
      logger.error('Failed to create work item', { status: error.status, message: error.message });
      throw new Error(`Failed to create work item: ${error.message}`);
    }
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
      
      await httpClient.patch(`wit/workitems/${workItem.id}`, linkFields);
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

  const httpClient = createADOHttpClient(organization, project);
  const warnings: string[] = [];
  
  // Get repository information
  let repositoryId: string;
  let projectId: string;
  
  try {
    let repoInfo: ADORepository;
    
    try {
      const response = await httpClient.get<ADORepository>(`git/repositories/${repository}`);
      repoInfo = response.data;
    } catch (error) {
      // Repository not found by exact match, try listing all repos
      const listResponse = await httpClient.get<ADOApiResponse<ADORepository[]>>('git/repositories');
      const reposList = listResponse.data;
      
      const repo = reposList.value?.find((r: ADORepository) => 
        r.name === repository || 
        r.id === repository || 
        r.name.toLowerCase() === repository.toLowerCase()
      );
      
      if (!repo) {
        const availableRepos = reposList.value?.map((r: ADORepository) => r.name).join(', ') || 'none';
        throw new Error(`Repository '${repository}' not found. Available: ${availableRepos}`);
      }
      
      repoInfo = repo;
    }
    
    repositoryId = repoInfo.id;
    projectId = repoInfo.project.id;
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
    
    await httpClient.patch(`wit/workitems/${workItemId}`, linkFields);
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
    
    await httpClient.patch(`wit/workitems/${workItemId}`, assignFields);
    
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

  const httpClient = createADOHttpClient(Organization, Project);
  
  try {
    const endpoint = HardDelete 
      ? `wit/workitems/${WorkItemId}?destroy=true`
      : `wit/workitems/${WorkItemId}`;
    
    await httpClient.delete(endpoint);
    
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

  const httpClient = createADOHttpClient(organization, project);
  
  // Get work item details
  let workItem: ADOWorkItem;
  try {
    const response = await httpClient.get<ADOWorkItem>(`wit/workitems/${workItemId}`);
    workItem = response.data;
  } catch (error) {
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
  
  const result: {
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
  } = {
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
  skip?: number;
  top?: number;
  includeSubstantiveChange?: boolean;
  substantiveChangeHistoryCount?: number;
  filterBySubstantiveChangeAfter?: string;
  filterBySubstantiveChangeBefore?: string;
  filterByDaysInactiveMin?: number;
  filterByDaysInactiveMax?: number;
  computeMetrics?: boolean;
  staleThresholdDays?: number;
  filterByMissingDescription?: boolean;
  filterByMissingAcceptanceCriteria?: boolean;
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
  currentRev: ADOWorkItemRevision,
  previousRev: ADOWorkItemRevision | null
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
  httpClient: ADOHttpClient
): Promise<{
  lastSubstantiveChangeDate: string;
  daysInactive: number;
}> {
  try {
    // Get revision history
    const response = await httpClient.get<ADOApiResponse<ADOWorkItemRevision[]>>(
      `wit/workItems/${workItemId}/revisions?$top=${historyCount}`
    );
    const revisions = response.data.value || [];

    // Sort revisions by rev number descending (newest first)
    revisions.sort((a: ADOWorkItemRevision, b: ADOWorkItemRevision) => b.rev - a.rev);

    let lastSubstantiveChangeDate: string = createdDate;

    // Walk through revisions from newest to oldest
    for (let i = 0; i < revisions.length; i++) {
      const currentRev = revisions[i];
      const previousRev = i < revisions.length - 1 ? revisions[i + 1] : null;

      const analysis = isSubstantiveChange(currentRev, previousRev);

      if (analysis.isSubstantive) {
        lastSubstantiveChangeDate = currentRev.fields['System.ChangedDate'] || createdDate;
        break;
      }
    }

    const daysInactive = daysBetween(lastSubstantiveChangeDate);

    return {
      lastSubstantiveChangeDate,
      daysInactive,
    };
  } catch (error) {
    logger.error(`Failed to calculate substantive change for work item ${workItemId}:`, error);
    // Re-throw the error so it can be properly handled upstream
    throw new Error(`Substantive change calculation failed for work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
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
  additionalFields?: Record<string, unknown>;  // Only fields explicitly requested via IncludeFields
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
  totalCount: number;
  skip: number;
  top: number;
  hasMore: boolean;
}> {
  const {
    wiqlQuery,
    organization,
    project,
    includeFields = [],
    maxResults = 200,
    skip = 0,
    top,
    includeSubstantiveChange = false,
    substantiveChangeHistoryCount = 50,
    filterBySubstantiveChangeAfter,
    filterBySubstantiveChangeBefore,
    filterByDaysInactiveMin,
    filterByDaysInactiveMax,
    computeMetrics = false,
    staleThresholdDays = 180,
    filterByMissingDescription = false,
    filterByMissingAcceptanceCriteria = false
  } = args;

  // Auto-enable includeSubstantiveChange if any filtering parameters are provided
  const needsSubstantiveChange = includeSubstantiveChange || 
    filterBySubstantiveChangeAfter !== undefined || 
    filterBySubstantiveChangeBefore !== undefined ||
    filterByDaysInactiveMin !== undefined ||
    filterByDaysInactiveMax !== undefined;

  // Use 'top' if provided, otherwise use 'maxResults'
  const pageSize = top ?? maxResults;

  // Get authentication token
  const httpClient = createADOHttpClient(organization, project);
  
  try {
    // Execute WIQL query
    const wiqlBody = { query: wiqlQuery };
    
    logger.debug(`Executing WIQL query: ${wiqlQuery}`);
    
    const wiqlResponse = await httpClient.post<ADOWiqlResult>('wit/wiql', wiqlBody);
    const wiqlResult = wiqlResponse.data;

    if (!wiqlResult.workItems || wiqlResult.workItems.length === 0) {
      return {
        workItems: [],
        count: 0,
        query: wiqlQuery,
        totalCount: 0,
        skip: skip,
        top: pageSize,
        hasMore: false
      };
    }

    // Store total count before pagination
    const totalCount = wiqlResult.workItems.length;
    
    // Apply pagination: skip items, then take pageSize items
    const paginatedWorkItems = wiqlResult.workItems.slice(skip, skip + pageSize);
    const workItemIds = paginatedWorkItems.map((wi: { id: number }) => wi.id);
    
    // Calculate if there are more results
    const hasMore = (skip + pageSize) < totalCount;

    logger.debug(`WIQL query returned ${totalCount} items, fetching details for items ${skip + 1}-${skip + workItemIds.length} (page size: ${pageSize})`);

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

    // Add description and acceptance criteria fields if filtering by them
    if (filterByMissingDescription) {
      defaultFields.push('System.Description');
    }
    if (filterByMissingAcceptanceCriteria) {
      defaultFields.push('Microsoft.VSTS.Common.AcceptanceCriteria');
    }

    // Combine default fields with user-requested fields
    const allFields = [...new Set([...defaultFields, ...includeFields])];
    const fieldsParam = allFields.join(',');

    const ids = workItemIds.join(',');
    const detailsResponse = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
      `wit/workitems?ids=${ids}&fields=${encodeURIComponent(fieldsParam)}`
    );
    const detailsResult = detailsResponse.data;

    if (!detailsResult.value) {
      throw new Error('Failed to fetch work item details');
    }

    // Map work items to result format
    const workItems: WiqlWorkItemResult[] = detailsResult.value.map((wi: ADOWorkItem) => {
      // Extract additional fields not already in the top-level structure
      // Filter out redundant and verbose fields to save context window space
      const additionalFields: Record<string, unknown> = {};
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
          const fieldValue = wi.fields[field];
          // Simplify AssignedTo-like objects to just displayName
          if (typeof fieldValue === 'object' && fieldValue !== null && 'displayName' in fieldValue) {
            additionalFields[field] = (fieldValue as { displayName: string }).displayName;
          } else {
            additionalFields[field] = fieldValue;
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
    if (needsSubstantiveChange) {
      logger.debug(`Calculating substantive change data for ${workItems.length} work items`);
      
      // Process work items in batches to avoid overwhelming the API
      const BATCH_SIZE = 10; // Process 10 items at a time
      const workItemsWithCreatedDate = workItems.filter(wi => wi.createdDate);
      
      logger.debug(`${workItemsWithCreatedDate.length} work items have createdDate, ${workItems.length - workItemsWithCreatedDate.length} do not`);
      
      const allResults: Array<{ id: number; lastSubstantiveChangeDate: string; daysInactive: number } | null> = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < workItemsWithCreatedDate.length; i += BATCH_SIZE) {
        const batch = workItemsWithCreatedDate.slice(i, i + BATCH_SIZE);
        logger.debug(`Processing substantive change batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(workItemsWithCreatedDate.length / BATCH_SIZE)} (${batch.length} items)`);
        
        const batchPromises = batch.map(async (workItem) => {
          try {
            const result = await calculateSubstantiveChange(
              workItem.id,
              workItem.createdDate!,
              organization,
              project,
              substantiveChangeHistoryCount,
              httpClient
            );
            successCount++;
            return { id: workItem.id, ...result };
          } catch (error) {
            errorCount++;
            logger.error(`Failed to calculate substantive change for work item ${workItem.id}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
      }
      
      logger.debug(`Substantive change analysis complete: ${successCount} succeeded, ${errorCount} failed`);

      // Merge substantive change data into work items
      for (const result of allResults) {
        if (result) {
          const workItem = workItems.find(wi => wi.id === result.id);
          if (workItem) {
            workItem.lastSubstantiveChangeDate = result.lastSubstantiveChangeDate;
            workItem.daysInactive = result.daysInactive;
          }
        }
      }
      
      if (errorCount > 0) {
        logger.warn(`${errorCount} work items failed substantive change analysis - they will not have lastSubstantiveChangeDate/daysInactive fields`);
      }
    }

    // Apply substantive change filters if specified
    let filteredWorkItems = workItems;
    if (needsSubstantiveChange) {
      let preFilterCount = filteredWorkItems.length;
      
      if (filterBySubstantiveChangeAfter) {
        const afterDate = new Date(filterBySubstantiveChangeAfter);
        filteredWorkItems = filteredWorkItems.filter(wi => {
          if (!wi.lastSubstantiveChangeDate) return false;
          return new Date(wi.lastSubstantiveChangeDate) > afterDate;
        });
        logger.debug(`Filtered by substantive change after ${filterBySubstantiveChangeAfter}: ${preFilterCount} → ${filteredWorkItems.length}`);
        preFilterCount = filteredWorkItems.length;
      }
      
      if (filterBySubstantiveChangeBefore) {
        const beforeDate = new Date(filterBySubstantiveChangeBefore);
        filteredWorkItems = filteredWorkItems.filter(wi => {
          if (!wi.lastSubstantiveChangeDate) return false;
          return new Date(wi.lastSubstantiveChangeDate) < beforeDate;
        });
        logger.debug(`Filtered by substantive change before ${filterBySubstantiveChangeBefore}: ${preFilterCount} → ${filteredWorkItems.length}`);
        preFilterCount = filteredWorkItems.length;
      }
      
      if (filterByDaysInactiveMin !== undefined) {
        filteredWorkItems = filteredWorkItems.filter(wi => {
          if (wi.daysInactive === undefined) return false;
          return wi.daysInactive >= filterByDaysInactiveMin;
        });
        logger.debug(`Filtered by daysInactive >= ${filterByDaysInactiveMin}: ${preFilterCount} → ${filteredWorkItems.length}`);
        preFilterCount = filteredWorkItems.length;
      }
      
      if (filterByDaysInactiveMax !== undefined) {
        filteredWorkItems = filteredWorkItems.filter(wi => {
          if (wi.daysInactive === undefined) return false;
          return wi.daysInactive <= filterByDaysInactiveMax;
        });
        logger.debug(`Filtered by daysInactive <= ${filterByDaysInactiveMax}: ${preFilterCount} → ${filteredWorkItems.length}`);
      }
    }

    // Apply missing description filter
    if (filterByMissingDescription) {
      const preFilterCount = filteredWorkItems.length;
      filteredWorkItems = filteredWorkItems.filter(wi => {
        const description = wi.additionalFields?.['System.Description'] || '';
        const descriptionText = String(description).replace(/<[^>]*>/g, '').trim(); // Strip HTML tags
        return descriptionText.length < 10; // Consider empty if less than 10 characters
      });
      logger.debug(`Filtered by missing description: ${preFilterCount} → ${filteredWorkItems.length}`);
    }

    // Apply missing acceptance criteria filter
    if (filterByMissingAcceptanceCriteria) {
      const preFilterCount = filteredWorkItems.length;
      filteredWorkItems = filteredWorkItems.filter(wi => {
        const acceptanceCriteria = wi.additionalFields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] || '';
        const criteriaText = String(acceptanceCriteria).replace(/<[^>]*>/g, '').trim(); // Strip HTML tags
        return criteriaText.length < 10; // Consider empty if less than 10 characters
      });
      logger.debug(`Filtered by missing acceptance criteria: ${preFilterCount} → ${filteredWorkItems.length}`);
    }

    return {
      workItems: filteredWorkItems,
      count: filteredWorkItems.length,
      query: wiqlQuery,
      totalCount,
      skip,
      top: pageSize,
      hasMore
    };

  } catch (error) {
    logger.error('WIQL query execution failed', error);
    throw new Error(`Failed to execute WIQL query: ${error instanceof Error ? error.message : String(error)}`);
  }
}
