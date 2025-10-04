import { logger } from '../../utils/logger.js';
import { buildSuccessResponse, buildErrorResponse } from '../../utils/response-builder.js';
import { loadConfiguration } from '../../config/config.js';
import { createADOHttpClient } from '../../utils/ado-http-client.js';
import type { ADOWorkItem, ADOApiResponse } from '../../types/ado.js';

interface CleanedFields {
  [key: string]: string | number | boolean | undefined;
}

interface SimplifiedWorkItem {
  id: number;
  title?: string;
  type?: string;
  state?: string;
  fields?: Record<string, unknown>;
}

interface LinkReference {
  type: string;
  url: string;
}

interface ArtifactLink {
  name: string;
  url: string;
}

interface WorkItemComment {
  id: number;
  text: string;
  createdBy?: string;
  createdDate?: string;
}

interface ADOCommentsResponse {
  comments?: Array<{
    id: number;
    text: string;
    createdBy?: { displayName?: string };
    createdDate?: string;
  }>;
}

interface ADORevisionsResponse {
  value?: Array<{
    id?: number;
    rev?: number;
    fields?: Record<string, unknown>;
  }>;
}

/**
 * Clean up verbose fields from work item data to reduce context window usage.
 * Simplifies user objects to just displayName and removes redundant metadata.
 */
function cleanFields(fields: Record<string, unknown>): CleanedFields {
  if (!fields || typeof fields !== 'object') return {};
  
  const cleaned: CleanedFields = {};
  
  for (const [key, value] of Object.entries(fields)) {
    // Simplify user objects (System.CreatedBy, System.ChangedBy, System.AssignedTo, etc.)
    if (value && typeof value === 'object' && 'displayName' in value) {
      cleaned[key] = (value as {displayName: string}).displayName;
    }
    // Keep other fields as-is
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined) {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

interface ContextPackageArgs {
  workItemId: number;
  organization?: string;
  project?: string;
  includeHistory?: boolean;
  historyCount?: number;
  includeComments?: boolean;
  includeRelations?: boolean;
  includeChildren?: boolean;
  includeParent?: boolean;
  includeLinkedPRsAndCommits?: boolean;
  includeExtendedFields?: boolean;
  includeHtml?: boolean;
  maxChildDepth?: number;
  maxRelatedItems?: number;
  includeAttachments?: boolean;
  includeTags?: boolean;
}

// Basic HTML to markdown/text simplifier (lightweight; not full fidelity)
function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|h\d|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function handleGetWorkItemContextPackage(args: ContextPackageArgs) {
  const cfg = loadConfiguration();
  const {
    workItemId,
    organization = cfg.azureDevOps.organization,
    project = cfg.azureDevOps.project,
    includeHistory = true,
    historyCount = 10,
    includeComments = true,
    includeRelations = true,
    includeChildren = true,
    includeParent = true,
    includeLinkedPRsAndCommits = true,
    includeExtendedFields = false,
    includeHtml = false,
    maxChildDepth = 1,
    maxRelatedItems = 50,
    includeAttachments = false,
    includeTags = true
  } = args;

  try {
    const httpClient = createADOHttpClient(organization, project);

    // Build field list
    const baseFields = [
      'System.Id','System.Title','System.WorkItemType','System.State','System.AreaPath','System.IterationPath','System.AssignedTo',
      'System.CreatedDate','System.ChangedDate','System.CreatedBy','System.ChangedBy','System.Tags','System.Description'
    ];
    const extendedFields = [
      'Microsoft.VSTS.Common.AcceptanceCriteria','Microsoft.VSTS.Common.Priority','Microsoft.VSTS.Scheduling.StoryPoints',
      'Microsoft.VSTS.Scheduling.RemainingWork','Microsoft.VSTS.Common.Risk','Microsoft.VSTS.Common.ValueArea'
    ];
    const fields = includeExtendedFields ? baseFields.concat(extendedFields) : baseFields;
    const fieldParam = fields.join(',');

    // Note: Azure DevOps API doesn't allow both $expand and fields parameters together
    // Use $expand=all to get both relations and all fields
    const workItemUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?$expand=all&api-version=7.1`;
    
    logger.debug(`Fetching work item ${workItemId} from ${organization}/${project}`);
    
    const wiResponse = await httpClient.get<ADOWorkItem>(`wit/workitems/${workItemId}?$expand=all`);
    const wi = wiResponse.data;
    if (!wi || !wi.id) {
      throw new Error(`Work item ${workItemId} not found in organization '${organization}', project '${project}'. Verify the work item ID exists and you have access to it.`);
    }

    // Parent and children detection
    let parent: SimplifiedWorkItem | null = null;
    const children: SimplifiedWorkItem[] = [];
    let related: LinkReference[] = [];
    let attachments: ArtifactLink[] = [];
    let prLinks: ArtifactLink[] = [];
    let commitLinks: ArtifactLink[] = [];

    if (includeRelations && wi.relations) {
      for (const rel of wi.relations) {
        const relRef = rel.rel || '';
        if (relRef === 'System.LinkTypes.Hierarchy-Reverse' && includeParent) {
          parent = { id: parseInt(rel.url.split('/').pop() || '0', 10) };
        } else if (relRef === 'System.LinkTypes.Hierarchy-Forward' && includeChildren) {
          children.push({ id: parseInt(rel.url.split('/').pop() || '0', 10) });
        } else if (relRef.startsWith('System.LinkTypes')) {
          // Store related links - we'll filter them after expanding
          related.push({ type: relRef, url: rel.url });
        } else if (relRef === 'ArtifactLink') {
          // Heuristic for commits/PRs: look at attributes.name
          const name = rel.attributes?.name || '';
            if (includeLinkedPRsAndCommits && name.startsWith('PR ')) {
              prLinks.push({ name, url: rel.url });
            } else if (includeLinkedPRsAndCommits && name.startsWith('Commit ')) {
              commitLinks.push({ name, url: rel.url });
            } else if (includeAttachments && name.startsWith('Attached File')) {
              attachments.push({ name, url: rel.url });
            }
        }
      }
    }

    // Expand parent
    if (parent && parent.id) {
      try {
        const pResponse = await httpClient.get<ADOWorkItem>(`wit/workitems/${parent.id}?fields=System.Id,System.Title,System.WorkItemType,System.State`);
        parent = pResponse.data;
      } catch (e) { logger.warn(`Failed to expand parent ${parent.id}`, e); }
    }

    // Expand children (one depth only unless maxChildDepth >1; we only support depth=1 for now to avoid complexity)
    let expandedChildren: SimplifiedWorkItem[] = [];
    if (children.length && maxChildDepth > 0) {
      const childIds = children.map(c => c.id).slice(0, 200);
      const idsParam = childIds.join(',');
      const cResponse = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(`wit/workitems?ids=${idsParam}&fields=System.Id,System.Title,System.WorkItemType,System.State`);
      if (cResponse.data && cResponse.data.value) {
        // Filter out Done/Removed/Closed children immediately to reduce context
        expandedChildren = cResponse.data.value.filter(c => {
          const state = c.fields?.['System.State'];
          return state !== 'Done' && state !== 'Removed' && state !== 'Closed';
        });
      }
    }
    
    // Expand related items and filter out Done/Removed/Closed ones
    let expandedRelated: Array<{type: string; id: number; title?: string; state?: string}> = [];
    if (related.length > 0) {
      try {
        const relatedIds = related.map(r => parseInt(r.url.split('/').pop() || '0', 10)).filter(id => id > 0);
        if (relatedIds.length > 0) {
          const relIdsParam = relatedIds.slice(0, maxRelatedItems).join(',');
          const relResponse = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(`wit/workitems?ids=${relIdsParam}&fields=System.Id,System.Title,System.WorkItemType,System.State`);
          if (relResponse.data && relResponse.data.value) {
            // Filter out Done/Removed/Closed related items
            expandedRelated = relResponse.data.value
              .filter(r => {
                const state = r.fields?.['System.State'];
                return state !== 'Done' && state !== 'Removed' && state !== 'Closed';
              })
              .map((r, idx) => ({
                type: related[idx]?.type || 'Related',
                id: r.id || 0,
                title: r.fields?.['System.Title'] as string,
                state: r.fields?.['System.State'] as string
              }));
          }
        }
      } catch (e) { logger.warn('Failed to expand related items', e); }
    }

    // Get comments
    let comments: Array<{id: number; text: string; createdBy?: string; createdDate?: string}> = [];
    if (includeComments) {
      try {
        const commentsResponse = await httpClient.get<ADOCommentsResponse>(`wit/workItems/${workItemId}/comments`);
        const cRes = commentsResponse.data;
        comments = cRes.comments?.map((c) => ({
          id: c.id,
          text: c.text,
          createdBy: c.createdBy?.displayName,
          createdDate: c.createdDate
        })) || [];
      } catch (e) { logger.warn(`Failed to load comments for ${workItemId}`, e); }
    }

    // History (recent revisions)
    let history: Array<{rev: number; changedDate: string; changedBy?: string; fields: CleanedFields}> = [];
    if (includeHistory) {
      try {
        const hResponse = await httpClient.get<ADORevisionsResponse>(`wit/workItems/${workItemId}/revisions?$top=${historyCount}`);
        const hRes = hResponse.data;
        history = (hRes.value || []).map((r) => {
          const cleanedFields = cleanFields(r.fields || {});
          return {
            rev: r.rev || 0,
            changedDate: typeof cleanedFields?.['System.ChangedDate'] === 'string' ? cleanedFields['System.ChangedDate'] : '',
            changedBy: typeof cleanedFields?.['System.ChangedBy'] === 'string' ? cleanedFields['System.ChangedBy'] : undefined,
            fields: cleanedFields
          };
        });
      } catch (e) { logger.warn(`Failed to load history for ${workItemId}`, e); }
    }

    // Build normalized core representation
    const fieldsMap = wi.fields || {};
    const result = {
      id: wi.id,
      title: fieldsMap['System.Title'],
      type: fieldsMap['System.WorkItemType'],
      state: fieldsMap['System.State'],
      areaPath: fieldsMap['System.AreaPath'],
      iterationPath: fieldsMap['System.IterationPath'],
      assignedTo: fieldsMap['System.AssignedTo']?.displayName || fieldsMap['System.AssignedTo']?.uniqueName,
      createdDate: fieldsMap['System.CreatedDate'],
      createdBy: fieldsMap['System.CreatedBy']?.displayName || fieldsMap['System.CreatedBy']?.uniqueName,
      changedDate: fieldsMap['System.ChangedDate'],
      changedBy: fieldsMap['System.ChangedBy']?.displayName || fieldsMap['System.ChangedBy']?.uniqueName,
      priority: fieldsMap['Microsoft.VSTS.Common.Priority'],
      storyPoints: fieldsMap['Microsoft.VSTS.Scheduling.StoryPoints'],
      remainingWork: fieldsMap['Microsoft.VSTS.Scheduling.RemainingWork'],
      acceptanceCriteria: fieldsMap['Microsoft.VSTS.Common.AcceptanceCriteria'],
      description: includeHtml ? {
        html: fieldsMap['System.Description'],
        text: stripHtml(fieldsMap['System.Description'])
      } : stripHtml(fieldsMap['System.Description']),
      tags: includeTags && fieldsMap['System.Tags'] ? String(fieldsMap['System.Tags']).split(/;|,/).map((t: string) => t.trim()).filter(Boolean) : [],
      url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${wi.id}`,
      parent: parent ? {
        id: parent.id,
        title: parent.fields?.['System.Title'],
        type: parent.fields?.['System.WorkItemType'],
        state: parent.fields?.['System.State']
      } : null,
      children: expandedChildren.map(c => ({ 
        id: c.id, 
        title: c.fields?.['System.Title'], 
        type: c.fields?.['System.WorkItemType'], 
        state: c.fields?.['System.State'] 
      })),
      related: expandedRelated,
      pullRequests: prLinks,
      commits: commitLinks,
      attachments: includeAttachments ? attachments : undefined,
      comments,
      history,
      _raw: includeExtendedFields ? { fields: cleanFields(fieldsMap) } : undefined
    };

    return buildSuccessResponse({ contextPackage: result }, { tool: 'wit-get-work-item-context-package' });
  } catch (error) {
    logger.error('Failed to build context package', error);
    return buildErrorResponse(error as Error, { tool: 'wit-get-work-item-context-package' });
  }
}
