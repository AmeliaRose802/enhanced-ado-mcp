import { logger } from '../../utils/logger.js';
import { buildSuccessResponse, buildErrorResponse } from '../../utils/response-builder.js';
import { loadConfiguration } from '../../config/config.js';
import { getAzureDevOpsToken, curlJson } from '../../utils/ado-token.js';

/**
 * Clean up verbose fields from work item data to reduce context window usage.
 * Simplifies user objects to just displayName and removes redundant metadata.
 */
function cleanFields(fields: any): any {
  if (!fields || typeof fields !== 'object') return fields;
  
  const cleaned: any = {};
  
  for (const [key, value] of Object.entries(fields)) {
    // Simplify user objects (System.CreatedBy, System.ChangedBy, System.AssignedTo, etc.)
    if (value && typeof value === 'object' && 'displayName' in value) {
      cleaned[key] = value.displayName;
    }
    // Keep other fields as-is
    else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

interface ContextPackageArgs {
  WorkItemId: number;
  Organization?: string;
  Project?: string;
  IncludeHistory?: boolean;
  HistoryCount?: number;
  IncludeComments?: boolean;
  IncludeRelations?: boolean;
  IncludeChildren?: boolean;
  IncludeParent?: boolean;
  IncludeLinkedPRsAndCommits?: boolean;
  IncludeExtendedFields?: boolean;
  IncludeHtml?: boolean;
  MaxChildDepth?: number;
  MaxRelatedItems?: number;
  IncludeAttachments?: boolean;
  IncludeTags?: boolean;
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
    WorkItemId,
    Organization = cfg.azureDevOps.organization,
    Project = cfg.azureDevOps.project,
    IncludeHistory = true,
    HistoryCount = 10,
    IncludeComments = true,
    IncludeRelations = true,
    IncludeChildren = true,
    IncludeParent = true,
    IncludeLinkedPRsAndCommits = true,
    IncludeExtendedFields = false,
    IncludeHtml = false,
    MaxChildDepth = 1,
    MaxRelatedItems = 50,
    IncludeAttachments = false,
    IncludeTags = true
  } = args;

  try {
    const token = getAzureDevOpsToken();

    // Build field list
    const baseFields = [
      'System.Id','System.Title','System.WorkItemType','System.State','System.AreaPath','System.IterationPath','System.AssignedTo',
      'System.CreatedDate','System.ChangedDate','System.CreatedBy','System.ChangedBy','System.Tags','System.Description'
    ];
    const extendedFields = [
      'Microsoft.VSTS.Common.AcceptanceCriteria','Microsoft.VSTS.Common.Priority','Microsoft.VSTS.Scheduling.StoryPoints',
      'Microsoft.VSTS.Scheduling.RemainingWork','Microsoft.VSTS.Common.Risk','Microsoft.VSTS.Common.ValueArea'
    ];
    const fields = IncludeExtendedFields ? baseFields.concat(extendedFields) : baseFields;
    const fieldParam = fields.join(',');

    // Note: Azure DevOps API doesn't allow both $expand and fields parameters together
    // Use $expand=all to get both relations and all fields
    const workItemUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems/${WorkItemId}?$expand=all&api-version=7.1`;
    
    logger.debug(`Fetching work item ${WorkItemId} from ${Organization}/${Project}`);
    logger.debug(`URL: ${workItemUrl}`);
    
    const wi = curlJson(workItemUrl, token);
    if (!wi || !wi.id) {
      throw new Error(`Work item ${WorkItemId} not found in organization '${Organization}', project '${Project}'. Verify the work item ID exists and you have access to it.`);
    }

    // Parent and children detection
    let parent: any = null;
    const children: any[] = [];
    let related: any[] = [];
    let attachments: any[] = [];
    let prLinks: any[] = [];
    let commitLinks: any[] = [];

    if (IncludeRelations && wi.relations) {
      for (const rel of wi.relations) {
        const relRef = rel.rel || '';
        if (relRef === 'System.LinkTypes.Hierarchy-Reverse' && IncludeParent) {
          parent = { id: parseInt(rel.url.split('/').pop() || '0', 10) };
        } else if (relRef === 'System.LinkTypes.Hierarchy-Forward' && IncludeChildren) {
          children.push({ id: parseInt(rel.url.split('/').pop() || '0', 10) });
        } else if (relRef.startsWith('System.LinkTypes')) {
          related.push({ type: relRef, url: rel.url });
        } else if (relRef === 'ArtifactLink') {
          // Heuristic for commits/PRs: look at attributes.name
          const name = rel.attributes?.name || '';
            if (IncludeLinkedPRsAndCommits && name.startsWith('PR ')) {
              prLinks.push({ name, url: rel.url });
            } else if (IncludeLinkedPRsAndCommits && name.startsWith('Commit ')) {
              commitLinks.push({ name, url: rel.url });
            } else if (IncludeAttachments && name.startsWith('Attached File')) {
              attachments.push({ name, url: rel.url });
            }
        }
      }
    }

    // Expand parent
    if (parent && parent.id) {
      try {
        const pUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems/${parent.id}?fields=System.Id,System.Title,System.WorkItemType,System.State&api-version=7.1`;
        parent = curlJson(pUrl, token);
      } catch (e) { logger.warn(`Failed to expand parent ${parent.id}`, e); }
    }

    // Expand children (one depth only unless MaxChildDepth >1; we only support depth=1 for now to avoid complexity)
    let expandedChildren: any[] = [];
    if (children.length && MaxChildDepth > 0) {
      const childIds = children.map(c => c.id).slice(0, 200);
      const idsParam = childIds.join(',');
      const cUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems?ids=${idsParam}&fields=System.Id,System.Title,System.WorkItemType,System.State&api-version=7.1`;
      const cRes = curlJson(cUrl, token);
      if (cRes && cRes.value) expandedChildren = cRes.value;
    }

    // Get comments
    let comments: any[] = [];
    if (IncludeComments) {
      try {
        const commentsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${WorkItemId}/comments?api-version=7.1`;
        const cRes = curlJson(commentsUrl, token);
        comments = cRes.comments?.map((c: any) => ({
          id: c.id,
          text: c.text,
          createdBy: c.createdBy?.displayName,
          createdDate: c.createdDate
        })) || [];
      } catch (e) { logger.warn(`Failed to load comments for ${WorkItemId}`, e); }
    }

    // History (recent revisions)
    let history: any[] = [];
    if (IncludeHistory) {
      try {
        const revsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${WorkItemId}/revisions?$top=${HistoryCount}&api-version=7.1`;
        const hRes = curlJson(revsUrl, token);
        history = (hRes.value || []).map((r: any) => {
          const cleanedFields = cleanFields(r.fields);
          return {
            id: r.id,
            rev: r.rev,
            changedDate: cleanedFields?.['System.ChangedDate'],
            changedBy: cleanedFields?.['System.ChangedBy'],
            state: cleanedFields?.['System.State'],
            title: cleanedFields?.['System.Title'],
            iterationPath: cleanedFields?.['System.IterationPath'],
            areaPath: cleanedFields?.['System.AreaPath'],
            assignedTo: cleanedFields?.['System.AssignedTo'],
            description: cleanedFields?.['System.Description'] ? (cleanedFields['System.Description'].length > 100 ? cleanedFields['System.Description'].substring(0, 100) + '...' : cleanedFields['System.Description']) : undefined
          };
        });
      } catch (e) { logger.warn(`Failed to load history for ${WorkItemId}`, e); }
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
      description: IncludeHtml ? {
        html: fieldsMap['System.Description'],
        text: stripHtml(fieldsMap['System.Description'])
      } : stripHtml(fieldsMap['System.Description']),
      tags: IncludeTags && fieldsMap['System.Tags'] ? String(fieldsMap['System.Tags']).split(/;|,/).map((t: string) => t.trim()).filter(Boolean) : [],
      url: `https://dev.azure.com/${Organization}/${Project}/_workitems/edit/${wi.id}`,
      parent: parent ? {
        id: parent.id,
        title: parent.fields?.['System.Title'],
        type: parent.fields?.['System.WorkItemType'],
        state: parent.fields?.['System.State']
      } : null,
      children: expandedChildren.map(c => ({ id: c.id, title: c.fields['System.Title'], type: c.fields['System.WorkItemType'], state: c.fields['System.State'] })),
      related: related.slice(0, MaxRelatedItems),
      pullRequests: prLinks,
      commits: commitLinks,
      attachments: IncludeAttachments ? attachments : undefined,
      comments,
      history,
      _raw: IncludeExtendedFields ? { fields: cleanFields(fieldsMap) } : undefined
    };

    return buildSuccessResponse({ contextPackage: result }, { tool: 'wit-get-work-item-context-package' });
  } catch (error) {
    logger.error('Failed to build context package', error);
    return buildErrorResponse(error as Error, { tool: 'wit-get-work-item-context-package' });
  }
}
