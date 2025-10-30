import { logger } from '../utils/logger.js';
import type { ADOWorkItem, ADOWorkItemRevision, ADOApiResponse, ADOFieldOperation } from '../types/index.js';
import { createADOHttpClient, ADOHttpError, ADOHttpClient } from '../utils/ado-http-client.js';
import { getTokenProvider } from '../utils/token-provider.js';
import { createWorkItemRepository } from '../repositories/work-item.repository.js';
import { smartConvertToHtml } from '../utils/markdown-converter.js';

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

function resolveAssignedTo(assignedTo?: string): string | undefined {
  if (!assignedTo) return undefined;
  if (assignedTo === '@me') {
    logger.warn('@me assignment no longer supported. Use explicit email/UPN.');
    return undefined;
  }
  return assignedTo;
}

export async function createWorkItem(args: CreateWorkItemArgs): Promise<WorkItemResult> {
  const {
    title, workItemType, parentWorkItemId, description, organization, project,
    areaPath, iterationPath, assignedTo, priority, tags, inheritParentPaths = true
  } = args;

  const repository = createWorkItemRepository(organization, project);
  const resolvedAssignedTo = resolveAssignedTo(assignedTo);
  let effectiveAreaPath = areaPath;
  let effectiveIterationPath = iterationPath;
  
  if (parentWorkItemId && inheritParentPaths) {
    try {
      const { fields: parentFields } = await repository.getById(parentWorkItemId);
      if (!effectiveAreaPath) effectiveAreaPath = parentFields['System.AreaPath'] as string;
      if (!effectiveIterationPath) effectiveIterationPath = parentFields['System.IterationPath'] as string;
    } catch (error) {
      logger.warn(`Failed to get parent work item ${parentWorkItemId}`, error);
    }
  }

  const fields: ADOFieldOperation[] = [
    { op: 'add', path: '/fields/System.Title', value: title }
  ];
  
  if (description) fields.push({ op: 'add', path: '/fields/System.Description', value: smartConvertToHtml(description) });
  if (effectiveAreaPath) fields.push({ op: 'add', path: '/fields/System.AreaPath', value: effectiveAreaPath });
  if (effectiveIterationPath) fields.push({ op: 'add', path: '/fields/System.IterationPath', value: effectiveIterationPath });
  if (resolvedAssignedTo) fields.push({ op: 'add', path: '/fields/System.AssignedTo', value: resolvedAssignedTo });
  if (priority !== undefined && priority !== null) fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: priority });
  if (tags) fields.push({ op: 'add', path: '/fields/System.Tags', value: tags });
  
  logger.debug(`Creating work item: ${title} (${workItemType})`);
  
  let workItem: ADOWorkItem;
  try {
    workItem = await repository.create(workItemType, fields);
    if (!workItem.id) throw new Error(`Failed to create work item: ${JSON.stringify(workItem)}`);
    logger.debug(`Created work item ${workItem.id}`);
  } catch (error) {
    const message = error instanceof ADOHttpError ? error.message : (error instanceof Error ? error.message : String(error));
    if (error instanceof ADOHttpError) logger.error('Failed to create work item', { status: error.status, message });
    throw new Error(`Failed to create work item: ${message}`);
  }
  
  let parentLinked = false;
  if (parentWorkItemId) {
    try {
      await repository.linkToParent(workItem.id, parentWorkItemId);
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
  const { workItemId, organization, project, repository, branch = 'main', gitHubCopilotGuid } = args;
  const workItemRepository = createWorkItemRepository(organization, project);
  const warnings: string[] = [];

  let repositoryId: string, projectId: string;
  try {
    const repoInfo = await workItemRepository.getRepository(repository);
    ({ id: repositoryId, project: { id: projectId } } = repoInfo);
  } catch (error) {
    throw new Error(`Failed to retrieve repository: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  let branchLinkCreated = false;
  try {
    await workItemRepository.linkToBranch(workItemId, projectId, repositoryId, branch, repository);
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

  try {
    await workItemRepository.update(workItemId, [{ op: 'add' as const, path: '/fields/System.AssignedTo', value: gitHubCopilotGuid }]);
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
  const { WorkItemId, Organization, Project, HardDelete = false } = args;
  const repository = createWorkItemRepository(Organization, Project);
  
  try {
    await repository.delete(WorkItemId, HardDelete);
    logger.debug(`Deleted work item ${WorkItemId} (hard delete: ${HardDelete})`);
    return { work_item_id: WorkItemId, deleted: true, hard_delete: HardDelete };
  } catch (error) {
    throw new Error(`Failed to delete work item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

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
  work_item_details?: { assigned_to?: string; state: string; type: string };
}> {
  const { workItemId, organization, project, scanType = 'All', includeWorkItemDetails = false } = args;
  const repository = createWorkItemRepository(organization, project);

  let workItem: ADOWorkItem;
  try {
    workItem = await repository.getById(workItemId);
  } catch (error) {
    throw new Error(`Work item ${workItemId} not found`);
  }

  const fieldsToCheck = ['System.Description', 'Microsoft.VSTS.TCM.ReproSteps', 'Microsoft.VSTS.Common.AcceptanceCriteria'];
  const allLinks: InstructionLink[] = [];
  const urlPattern = /https?:\/\/[^\s<>"]+/gi;
  
  for (const field of fieldsToCheck) {
    const content = workItem.fields[field];
    if (content && typeof content === 'string') {
      const matches = content.match(urlPattern);
      if (matches) {
        for (let url of matches) {
          url = url.replace(/[,.;:)]$/, ''); // Clean trailing punctuation
          if (!url || url.includes('example.com')) continue;
          
          let type = 'General Link';
          if (url.match(/docs\.microsoft\.com|learn\.microsoft\.com/i)) type = 'Microsoft Docs';
          else if (url.match(/aka\.ms/i)) type = 'Microsoft Link';
          else if (url.match(/github\.com.*security/i)) type = 'GitHub Security';
          else if (url.match(/security|remediation|mitigation/i)) type = 'Security Guide';
          else if (url.match(/binskim|codeql|credscan/i)) type = 'Scanner Docs';
          
          allLinks.push({ Url: url, Type: type });
        }
      }
    }
  }

  const uniqueLinks = Array.from(new Map(allLinks.map(link => [link.Url, link])).values());
  
  const result: {
    work_item_id: number;
    title: string;
    instruction_links: InstructionLink[];
    links_found: number;
    work_item_url: string;
    work_item_details?: { assigned_to?: string; state: string; type: string };
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
  const { repository, branch = 'main', gitHubCopilotGuid, ...createArgs } = args;

  const createResult = await createWorkItem({ ...createArgs, assignedTo: '' });
  await new Promise(resolve => setTimeout(resolve, 2000)); // Allow work item to initialize
  
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
  filterByPatterns?: Array<'duplicates' | 'placeholder_titles' | 'unassigned_committed' | 'stale_automation' | 'missing_description' | 'missing_acceptance_criteria'>;
  areaPathFilter?: string[];
}

const SUBSTANTIVE_FIELDS = [
  'System.Description', 'System.Title', 'System.State', 'System.AssignedTo',
  'Microsoft.VSTS.Common.Priority', 'Microsoft.VSTS.Common.AcceptanceCriteria',
  'System.Tags', 'Microsoft.VSTS.Common.ReproSteps'
];

const AUTOMATED_FIELDS = [
  'System.IterationPath', 'System.AreaPath', 'Microsoft.VSTS.Common.StackRank',
  'Microsoft.VSTS.Common.BacklogPriority', 'Microsoft.VSTS.Scheduling.StoryPoints'
];

/**
 * Inject area path filtering into WIQL query
 * If query already contains [System.AreaPath] filtering, don't modify it
 * Otherwise, add area path filtering to WHERE clause
 */
function injectAreaPathFilter(wiqlQuery: string, areaPaths: string[]): string {
  if (!areaPaths || areaPaths.length === 0) {
    return wiqlQuery;
  }

  // Check if query already has area path filtering
  if (wiqlQuery.toUpperCase().includes('[SYSTEM.AREAPATH]')) {
    logger.debug('Query already contains area path filtering, not injecting');
    return wiqlQuery;
  }

  // Create area path conditions with UNDER clause for hierarchical matching
  const areaPathConditions = areaPaths
    .map(path => `[System.AreaPath] UNDER '${path.replace(/'/g, "''")}'`)
    .join(' OR ');

  // Find WHERE clause and inject area path filtering
  const whereRegex = /\bWHERE\b/i;
  if (whereRegex.test(wiqlQuery)) {
    // Add area path condition at start of WHERE clause
    return wiqlQuery.replace(whereRegex, `WHERE (${areaPathConditions}) AND`);
  } else {
    // No WHERE clause, add one before ORDER BY or at the end
    const orderByRegex = /\bORDER BY\b/i;
    if (orderByRegex.test(wiqlQuery)) {
      return wiqlQuery.replace(orderByRegex, `WHERE (${areaPathConditions}) ORDER BY`);
    } else {
      // Add WHERE clause at the end
      return `${wiqlQuery.trim()} WHERE (${areaPathConditions})`;
    }
  }
}

function daysBetween(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}

function isSubstantiveChange(currentRev: ADOWorkItemRevision, previousRev: ADOWorkItemRevision | null): { isSubstantive: boolean; changeType: string } {
  if (!previousRev) return { isSubstantive: false, changeType: 'Creation' };

  const changedFields = SUBSTANTIVE_FIELDS.filter(field => currentRev.fields[field] !== previousRev.fields[field]);
  const automatedFieldsChanged = AUTOMATED_FIELDS.filter(field => currentRev.fields[field] !== previousRev.fields[field]);

  if (changedFields.length === 0 && automatedFieldsChanged.length > 0) {
    return { isSubstantive: false, changeType: `Automated: ${automatedFieldsChanged.join(', ')}` };
  }

  if (changedFields.length > 0) {
    return { isSubstantive: true, changeType: changedFields.map(f => f.split('.').pop()).join(', ') };
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
): Promise<{ lastSubstantiveChangeDate: string; daysInactive: number }> {
  try {
    const response = await httpClient.get<ADOApiResponse<ADOWorkItemRevision[]>>(
      `wit/workItems/${workItemId}/revisions?$top=${historyCount}`
    );
    const revisions = (response.data.value || []).sort((a: ADOWorkItemRevision, b: ADOWorkItemRevision) => b.rev - a.rev);

    let lastSubstantiveChangeDate = createdDate;

    for (let i = 0; i < revisions.length; i++) {
      const analysis = isSubstantiveChange(revisions[i], i < revisions.length - 1 ? revisions[i + 1] : null);
      if (analysis.isSubstantive) {
        lastSubstantiveChangeDate = revisions[i].fields['System.ChangedDate'] || createdDate;
        break;
      }
    }

    return { lastSubstantiveChangeDate, daysInactive: daysBetween(lastSubstantiveChangeDate) };
  } catch (error) {
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
  additionalFields?: Record<string, unknown>;
  lastSubstantiveChangeDate?: string;
  daysInactive?: number;
  computedMetrics?: {
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
    wiqlQuery, organization, project, includeFields = [], maxResults = 200, skip = 0, top,
    includeSubstantiveChange = false, substantiveChangeHistoryCount = 50,
    filterBySubstantiveChangeAfter, filterBySubstantiveChangeBefore,
    filterByDaysInactiveMin, filterByDaysInactiveMax,
    computeMetrics = false, staleThresholdDays = 180, filterByPatterns,
    areaPathFilter
  } = args;

  const needsSubstantiveChange = includeSubstantiveChange ||
    filterBySubstantiveChangeAfter !== undefined ||
    filterBySubstantiveChangeBefore !== undefined ||
    filterByDaysInactiveMin !== undefined ||
    filterByDaysInactiveMax !== undefined;

  const pageSize = top ?? maxResults;
  const repository = createWorkItemRepository(organization, project);
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  try {
    if (!organization?.trim()) throw new Error('Organization parameter is required');
    if (!project?.trim()) throw new Error('Project parameter is required');

    // Inject area path filtering if provided
    const enhancedQuery = areaPathFilter && areaPathFilter.length > 0
      ? injectAreaPathFilter(wiqlQuery, areaPathFilter)
      : wiqlQuery;

    if (areaPathFilter && areaPathFilter.length > 0) {
      logger.debug(`Injected area path filter (${areaPathFilter.length} paths): ${areaPathFilter.join(', ')}`);
    }
    
    logger.debug(`Executing WIQL query: ${enhancedQuery}`);
    logger.debug(`Target: ${organization}/${project}`);
    
    const wiqlResult = await repository.executeWiql(enhancedQuery);

    if (!wiqlResult.workItems?.length) {
      return { workItems: [], count: 0, query: enhancedQuery, totalCount: 0, skip, top: pageSize, hasMore: false };
    }

    const wiqlTotalCount = wiqlResult.workItems.length;
    const filtersApplied = needsSubstantiveChange || (filterByPatterns?.length ?? 0) > 0;
    
    const workItemIdsToFetch = filtersApplied
      ? wiqlResult.workItems.map((wi: { id: number }) => wi.id)
      : wiqlResult.workItems.slice(skip, skip + pageSize).map((wi: { id: number }) => wi.id);

    logger.debug(filtersApplied
      ? `WIQL returned ${wiqlTotalCount} items. Fetching ALL for filtering before pagination.`
      : `WIQL returned ${wiqlTotalCount} items, fetching ${skip + 1}-${Math.min(skip + pageSize, wiqlTotalCount)} (page size: ${pageSize})`);

    const defaultFields = ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AreaPath', 'System.IterationPath', 'System.AssignedTo'];

    if (needsSubstantiveChange || computeMetrics) defaultFields.push('System.CreatedDate', 'System.ChangedDate');
    if (filterByPatterns?.includes('missing_description')) defaultFields.push('System.Description');
    if (filterByPatterns?.includes('missing_acceptance_criteria')) defaultFields.push('Microsoft.VSTS.Common.AcceptanceCriteria');

    const allFields = [...new Set([...defaultFields, ...includeFields])];
    const detailsResult = await repository.getBatch(workItemIdsToFetch, allFields);

    if (!detailsResult) throw new Error('Failed to fetch work item details');

    const workItems: WiqlWorkItemResult[] = detailsResult.map((wi: ADOWorkItem) => {
      const extractedFields = new Set(['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AreaPath', 'System.IterationPath', 'System.AssignedTo', 'System.CreatedDate', 'System.ChangedDate']);
      const additionalFields: Record<string, unknown> = {};
      
      for (const field of includeFields) {
        if (!extractedFields.has(field) && wi.fields[field] !== undefined) {
          const fieldValue = wi.fields[field];
          additionalFields[field] = (typeof fieldValue === 'object' && fieldValue !== null && 'displayName' in fieldValue)
            ? (fieldValue as { displayName: string }).displayName
            : fieldValue;
        }
      }
      
      // Ensure filter-required fields are available, but don't overwrite already processed fields
      if (filterByPatterns?.includes('missing_description') && !('System.Description' in additionalFields)) {
        const descValue = wi.fields['System.Description'];
        additionalFields['System.Description'] = (typeof descValue === 'object' && descValue !== null && 'displayName' in descValue)
          ? (descValue as { displayName: string }).displayName
          : descValue;
      }
      if (filterByPatterns?.includes('missing_acceptance_criteria') && !('Microsoft.VSTS.Common.AcceptanceCriteria' in additionalFields)) {
        const acValue = wi.fields['Microsoft.VSTS.Common.AcceptanceCriteria'];
        additionalFields['Microsoft.VSTS.Common.AcceptanceCriteria'] = (typeof acValue === 'object' && acValue !== null && 'displayName' in acValue)
          ? (acValue as { displayName: string }).displayName
          : acValue;
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

      if (computeMetrics) {
        const description = wi.fields['System.Description'] || '';
        const descriptionText = description.replace(/<[^>]*>/g, '').trim();
        const hasDescription = descriptionText.length > 50;
        
        const createdDate = workItem.createdDate ? new Date(workItem.createdDate) : null;
        const changedDate = workItem.changedDate ? new Date(workItem.changedDate) : null;
        const now = new Date();
        
        const daysSinceCreated = createdDate ? Math.floor((now.getTime() - createdDate.getTime()) / 86400000) : undefined;
        const daysSinceChanged = changedDate ? Math.floor((now.getTime() - changedDate.getTime()) / 86400000) : undefined;
        const isStale = daysSinceChanged !== undefined && daysSinceChanged > staleThresholdDays;
        
        workItem.computedMetrics = { daysSinceCreated, daysSinceChanged, hasDescription, isStale };
      }

      return workItem;
    });

    if (needsSubstantiveChange) {
      logger.debug(`Calculating substantive change data for ${workItems.length} work items`);
      
      const BATCH_SIZE = 10;
      const workItemsWithCreatedDate = workItems.filter(wi => wi.createdDate);
      logger.debug(`${workItemsWithCreatedDate.length} work items have createdDate, ${workItems.length - workItemsWithCreatedDate.length} do not`);
      
      const allResults: Array<{ id: number; lastSubstantiveChangeDate: string; daysInactive: number } | null> = [];
      let successCount = 0, errorCount = 0;
      
      for (let i = 0; i < workItemsWithCreatedDate.length; i += BATCH_SIZE) {
        const batch = workItemsWithCreatedDate.slice(i, i + BATCH_SIZE);
        logger.debug(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(workItemsWithCreatedDate.length / BATCH_SIZE)} (${batch.length} items)`);
        
        const batchResults = await Promise.all(batch.map(async (workItem) => {
          try {
            const result = await calculateSubstantiveChange(workItem.id, workItem.createdDate!, organization, project, substantiveChangeHistoryCount, httpClient);
            successCount++;
            return { id: workItem.id, ...result };
          } catch (error) {
            errorCount++;
            logger.error(`Failed to calculate substantive change for work item ${workItem.id}:`, error);
            return null;
          }
        }));
        
        allResults.push(...batchResults);
      }
      
      logger.debug(`Substantive change analysis complete: ${successCount} succeeded, ${errorCount} failed`);

      for (const result of allResults) {
        if (result) {
          const workItem = workItems.find(wi => wi.id === result.id);
          if (workItem) {
            workItem.lastSubstantiveChangeDate = result.lastSubstantiveChangeDate;
            workItem.daysInactive = result.daysInactive;
          }
        }
      }
      
      if (errorCount > 0) logger.warn(`${errorCount} work items failed substantive change analysis - they will not have lastSubstantiveChangeDate/daysInactive fields`);
    }

    let filteredWorkItems = workItems;
    if (needsSubstantiveChange) {
      let preFilterCount = filteredWorkItems.length;
      
      if (filterBySubstantiveChangeAfter) {
        const afterDate = new Date(filterBySubstantiveChangeAfter);
        const itemsWithoutDate = filteredWorkItems.filter(wi => !wi.lastSubstantiveChangeDate).length;
        filteredWorkItems = filteredWorkItems.filter(wi => wi.lastSubstantiveChangeDate && new Date(wi.lastSubstantiveChangeDate) > afterDate);
        logger.debug(`Filtered by substantive change after ${filterBySubstantiveChangeAfter}: ${preFilterCount} → ${filteredWorkItems.length}${itemsWithoutDate > 0 ? ` (${itemsWithoutDate} excluded: missing date)` : ''}`);
        preFilterCount = filteredWorkItems.length;
      }
      
      if (filterBySubstantiveChangeBefore) {
        const beforeDate = new Date(filterBySubstantiveChangeBefore);
        const itemsWithoutDate = filteredWorkItems.filter(wi => !wi.lastSubstantiveChangeDate).length;
        filteredWorkItems = filteredWorkItems.filter(wi => wi.lastSubstantiveChangeDate && new Date(wi.lastSubstantiveChangeDate) < beforeDate);
        logger.debug(`Filtered by substantive change before ${filterBySubstantiveChangeBefore}: ${preFilterCount} → ${filteredWorkItems.length}${itemsWithoutDate > 0 ? ` (${itemsWithoutDate} excluded: missing date)` : ''}`);
        preFilterCount = filteredWorkItems.length;
      }
      
      if (filterByDaysInactiveMin !== undefined) {
        const itemsWithoutDays = filteredWorkItems.filter(wi => wi.daysInactive === undefined).length;
        filteredWorkItems = filteredWorkItems.filter(wi => wi.daysInactive !== undefined && wi.daysInactive >= filterByDaysInactiveMin);
        logger.debug(`Filtered by daysInactive >= ${filterByDaysInactiveMin}: ${preFilterCount} → ${filteredWorkItems.length}${itemsWithoutDays > 0 ? ` (${itemsWithoutDays} excluded: missing daysInactive)` : ''}`);
        preFilterCount = filteredWorkItems.length;
      }
      
      if (filterByDaysInactiveMax !== undefined) {
        const itemsWithoutDays = filteredWorkItems.filter(wi => wi.daysInactive === undefined).length;
        filteredWorkItems = filteredWorkItems.filter(wi => wi.daysInactive !== undefined && wi.daysInactive <= filterByDaysInactiveMax);
        logger.debug(`Filtered by daysInactive <= ${filterByDaysInactiveMax}: ${preFilterCount} → ${filteredWorkItems.length}${itemsWithoutDays > 0 ? ` (${itemsWithoutDays} excluded: missing daysInactive)` : ''}`);
      }
    }

    if (filterByPatterns?.length) {
      logger.debug(`Applying pattern filters: ${filterByPatterns.join(', ')}`);
      
      const applyFilter = (name: string, predicate: (wi: WiqlWorkItemResult) => boolean) => {
        const before = filteredWorkItems.length;
        filteredWorkItems = filteredWorkItems.filter(predicate);
        logger.debug(`Filtered by ${name}: ${before} → ${filteredWorkItems.length}`);
      };
      
      if (filterByPatterns.includes('placeholder_titles')) {
        const patterns = [/\b(TBD|TODO|FIXME|XXX)\b/i, /\b(temp|temporary)\b/i, /\b(foo|bar|baz|dummy)\b/i, /^(New|Untitled|Item \d+)$/i, /\[.*\?\?\?.*\]/i];
        applyFilter('placeholder_titles', wi => patterns.some(p => p.test(wi.title)));
      }
      
      if (filterByPatterns.includes('duplicates')) {
        const titleMap = new Map<string, number[]>();
        filteredWorkItems.forEach(wi => {
          const normalized = wi.title.toLowerCase().trim().replace(/[^\w\s]/g, '');
          if (!titleMap.has(normalized)) titleMap.set(normalized, []);
          titleMap.get(normalized)!.push(wi.id);
        });
        const duplicateIds = new Set<number>();
        Array.from(titleMap.values()).filter(ids => ids.length > 1).forEach(ids => ids.forEach(id => duplicateIds.add(id)));
        applyFilter('duplicates', wi => duplicateIds.has(wi.id));
      }
      
      if (filterByPatterns.includes('unassigned_committed')) {
        const committedStates = ['Active', 'Committed', 'In Progress', 'Doing'];
        applyFilter('unassigned_committed', wi => committedStates.includes(wi.state) && !wi.assignedTo);
      }
      
      if (filterByPatterns.includes('missing_description')) {
        applyFilter('missing_description', wi => {
          const desc = wi.additionalFields?.['System.Description'];
          // Return true for items to INCLUDE (items that have missing descriptions)
          if (desc === undefined || desc === null || desc === '') return true;
          const strippedDesc = String(desc).replace(/<[^>]*>/g, '').trim();
          return strippedDesc.length < 10;
        });
      }
      
      if (filterByPatterns.includes('missing_acceptance_criteria')) {
        applyFilter('missing_acceptance_criteria', wi => {
          const criteria = wi.additionalFields?.['Microsoft.VSTS.Common.AcceptanceCriteria'];
          if (criteria === undefined || criteria === null || criteria === '') return true;
          return String(criteria).replace(/<[^>]*>/g, '').trim().length < 10;
        });
      }
      
      if (filterByPatterns.includes('stale_automation')) {
        const automationPatterns = [/\[S360\]/i, /\[automated\]/i, /\[bot\]/i, /\[scan\]/i];
        applyFilter('stale_automation', wi => {
          if (!wi.changedDate || !automationPatterns.some(p => p.test(wi.title))) return false;
          return Math.floor((Date.now() - new Date(wi.changedDate).getTime()) / 86400000) > 180;
        });
      }
    }

    const totalCountAfterFiltering = filteredWorkItems.length;
    const paginatedWorkItems = filtersApplied ? filteredWorkItems.slice(skip, skip + pageSize) : filteredWorkItems;
    const hasMore = filtersApplied ? (skip + pageSize) < totalCountAfterFiltering : (skip + pageSize) < wiqlTotalCount;
    const finalTotalCount = filtersApplied ? totalCountAfterFiltering : wiqlTotalCount;

    logger.debug(filtersApplied
      ? `After filtering: ${totalCountAfterFiltering} items remain. Returning page ${skip + 1}-${Math.min(skip + pageSize, totalCountAfterFiltering)}`
      : `Returning ${paginatedWorkItems.length} items from WIQL query`);

    return {
      workItems: paginatedWorkItems,
      count: paginatedWorkItems.length,
      query: enhancedQuery,
      totalCount: finalTotalCount,
      skip,
      top: pageSize,
      hasMore
    };

  } catch (error) {
    logger.error('WIQL query execution failed', error);
    const errorContext = `Organization: ${organization}, Project: ${project}`;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      throw new Error(
        `Failed to execute WIQL query: HTTP 404: Not Found. ` +
        `Project "${project}" may not exist in organization "${organization}", or you lack access. ${errorContext}. ` +
        `Verify names and login with 'az login'.`
      );
    }
    
    throw new Error(`Failed to execute WIQL query: ${errorMessage}. ${errorContext}`);
  }
}
