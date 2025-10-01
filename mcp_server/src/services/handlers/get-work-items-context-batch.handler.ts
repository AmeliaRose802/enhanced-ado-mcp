import { buildSuccessResponse, buildErrorResponse } from '../../utils/response-builder.js';
import { loadConfiguration } from '../../config/config.js';
import { logger } from '../../utils/logger.js';
import { getAzureDevOpsToken, curlJson } from '../../utils/ado-token.js';

interface BatchArgs {
  WorkItemIds: number[];
  Organization?: string;
  Project?: string;
  IncludeRelations?: boolean;
  IncludeFields?: string[];
  IncludeExtendedFields?: boolean;
  IncludeTags?: boolean;
  IncludeStateCounts?: boolean;
  IncludeStoryPointAggregation?: boolean;
  IncludeRiskScoring?: boolean;
  IncludeAIAssignmentHeuristic?: boolean;
  IncludeParentOutsideSet?: boolean;
  IncludeChildrenOutsideSet?: boolean;
  MaxOutsideReferences?: number;
  ReturnFormat?: 'graph' | 'array';
}

export async function handleGetWorkItemsContextBatch(args: BatchArgs) {
  const cfg = loadConfiguration();
  const {
    WorkItemIds,
    Organization = cfg.azureDevOps.organization,
    Project = cfg.azureDevOps.project,
    IncludeRelations = true,
    IncludeFields = [],
    IncludeExtendedFields = false,
    IncludeTags = true,
    IncludeStateCounts = true,
    IncludeStoryPointAggregation = true,
    IncludeRiskScoring = false,
    IncludeAIAssignmentHeuristic = false,
    IncludeParentOutsideSet = true,
    IncludeChildrenOutsideSet = false,
    MaxOutsideReferences = 50,
    ReturnFormat = 'graph'
  } = args;

  try {
    const token = getAzureDevOpsToken();
    const baseFields = [
      'System.Id','System.Title','System.WorkItemType','System.State','System.AreaPath','System.IterationPath','System.AssignedTo','System.Tags'
    ];
    const extendedFields = [
      'Microsoft.VSTS.Scheduling.StoryPoints','Microsoft.VSTS.Common.Priority','Microsoft.VSTS.Common.Risk','Microsoft.VSTS.Scheduling.RemainingWork'
    ];
    const allFields = [...new Set([...baseFields, ...(IncludeExtendedFields ? extendedFields : []), ...IncludeFields])];
    const fieldsParam = allFields.join(',');

    const idsParam = WorkItemIds.join(',');
    // Note: Azure DevOps API doesn't allow both $expand and fields parameters together
    // Use $expand=all to get both relations and all fields when IncludeRelations is true
    const expandParam = IncludeRelations ? '$expand=all' : '';
    const detailsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems?ids=${idsParam}${expandParam ? '&' + expandParam : ''}&api-version=7.1`;
    const details = curlJson(detailsUrl, token);
    if (!details.value) {
      throw new Error('Failed to fetch work items');
    }

    const insideSet = new Set(WorkItemIds);
    const nodes: any[] = [];
    const edges: any[] = [];
    const outsideRefs: Map<number, any> = new Map();

    for (const wi of details.value) {
      const f = wi.fields || {};
      const node = {
        id: wi.id,
        title: f['System.Title'],
        type: f['System.WorkItemType'],
        state: f['System.State'],
        assignedTo: f['System.AssignedTo']?.displayName || f['System.AssignedTo']?.uniqueName,
        storyPoints: f['Microsoft.VSTS.Scheduling.StoryPoints'],
        priority: f['Microsoft.VSTS.Common.Priority'],
        risk: f['Microsoft.VSTS.Common.Risk'],
        remainingWork: f['Microsoft.VSTS.Scheduling.RemainingWork'],
        tags: IncludeTags && f['System.Tags'] ? String(f['System.Tags']).split(/;|,/).map((t: string) => t.trim()).filter(Boolean) : [],
        url: `https://dev.azure.com/${Organization}/${Project}/_workitems/edit/${wi.id}`,
        _raw: IncludeExtendedFields ? { fields: f } : undefined
      };
      nodes.push(node);

      if (IncludeRelations && wi.relations) {
        for (const rel of wi.relations) {
          const relType = rel.rel || '';
          const targetId = parseInt(rel.url.split('/').pop() || '0', 10);
          if (!targetId) continue;

            if (relType === 'System.LinkTypes.Hierarchy-Forward') { // parent -> child edge
              edges.push({ from: wi.id, to: targetId, type: 'child' });
              if (!insideSet.has(targetId) && IncludeChildrenOutsideSet && outsideRefs.size < MaxOutsideReferences) {
                outsideRefs.set(targetId, { id: targetId, minimal: true });
              }
            } else if (relType === 'System.LinkTypes.Hierarchy-Reverse') { // child -> parent edge
              edges.push({ from: targetId, to: wi.id, type: 'child' });
              if (!insideSet.has(targetId) && IncludeParentOutsideSet && outsideRefs.size < MaxOutsideReferences) {
                outsideRefs.set(targetId, { id: targetId, minimal: true });
              }
            } else if (relType === 'System.LinkTypes.Related') {
              // Use normalized ordering to avoid duplicates
              const a = Math.min(wi.id, targetId);
              const b = Math.max(wi.id, targetId);
              edges.push({ from: a, to: b, type: 'related' });
              if (!insideSet.has(targetId) && outsideRefs.size < MaxOutsideReferences) {
                outsideRefs.set(targetId, { id: targetId, minimal: true });
              }
            }
        }
      }
    }

    // Deduplicate edges (for related)
    const seen = new Set<string>();
    const dedupedEdges: any[] = [];
    for (const e of edges) {
      const key = `${e.from}-${e.to}-${e.type}`;
      if (!seen.has(key)) { seen.add(key); dedupedEdges.push(e); }
    }

    // Fetch minimal outside references (title/state/type) in a single batch if any
    if (outsideRefs.size) {
      try {
        const refIds = Array.from(outsideRefs.keys());
        const refUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workitems?ids=${refIds.join(',')}&fields=System.Id,System.Title,System.WorkItemType,System.State&api-version=7.1`;
        const refRes = curlJson(refUrl, token);
        if (refRes.value) {
          for (const r of refRes.value) {
            const entry = outsideRefs.get(r.id);
            if (entry) {
              entry.title = r.fields['System.Title'];
              entry.type = r.fields['System.WorkItemType'];
              entry.state = r.fields['System.State'];
              entry.url = `https://dev.azure.com/${Organization}/${Project}/_workitems/edit/${r.id}`;
            }
          }
        }
      } catch (e) { logger.warn('Failed to expand outside references', e); }
    }

    // Aggregations
    const aggregates: any = {};
    if (IncludeStateCounts) {
      aggregates.stateCounts = nodes.reduce((acc: any, n) => { acc[n.state] = (acc[n.state] || 0) + 1; return acc; }, {});
      aggregates.typeCounts = nodes.reduce((acc: any, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {});
    }
    if (IncludeStoryPointAggregation) {
      const points = nodes.map(n => n.storyPoints).filter((p: any) => typeof p === 'number');
      aggregates.storyPoints = { total: points.reduce((a: number,b: number)=>a+b,0), count: points.length };
    }

    if (IncludeRiskScoring) {
      // Simple heuristic: risk flag if priority high & state not started; staleness based on absence of remainingWork but not done
      const riskItems = nodes.filter(n => (n.priority === 1 || n.priority === 2) && !['Done','Closed','Removed'].includes(n.state));
      aggregates.riskHeuristic = { highAttentionCount: riskItems.length };
    }

    if (IncludeAIAssignmentHeuristic) {
      // Simple heuristic: candidate if type Task or Bug and state New/Active and storyPoints <=3
      const aiCandidates = nodes.filter(n => ['Task','Bug','User Story','Product Backlog Item'].includes(n.type) && ['New','Active','To Do','Proposed'].includes(n.state) && (n.storyPoints == null || n.storyPoints <= 3));
      aggregates.aiAssignmentCandidates = aiCandidates.map(c => c.id);
    }

    const outside = Array.from(outsideRefs.values());

    const graph = {
      nodes,
      edges: dedupedEdges,
      outsideReferences: outside,
      aggregates
    };

    const data = ReturnFormat === 'graph' ? graph : { items: nodes, edges: dedupedEdges, aggregates };

    return buildSuccessResponse({ batchContext: data }, { tool: 'wit-get-work-items-context-batch' });
  } catch (error) {
    logger.error('Batch context retrieval failed', error);
    return buildErrorResponse(error as Error, { tool: 'wit-get-work-items-context-batch' });
  }
}
