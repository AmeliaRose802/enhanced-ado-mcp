import { buildSuccessResponse, buildErrorResponse } from '../../../utils/response-builder.js';
import { loadConfiguration } from '../../../config/config.js';
import { logger } from '../../../utils/logger.js';
import { createADOHttpClient } from '../../../utils/ado-http-client.js';
import type { ADOApiResponse, ADOWorkItem } from '../../../types/index.js';
import type { BatchContextArgs } from '../../../types/index.js';

interface GraphNode {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo?: string;
  url: string;
  areaPath?: string;
  iterationPath?: string;
  tags?: string[];
  storyPoints?: number;
  priority?: number;
  risk?: string;
  remainingWork?: number;
  commentCount?: number;
  relationshipCounts?: {
    parents: number;
    children: number;
    related: number;
    linkedPRs: number;
    linkedCommits: number;
  };
  hasParentInSet?: boolean;
  hasChildrenInSet?: boolean;
  parentId?: number;
  childIds?: number[];
  riskScore?: number;
  aiAssignmentScore?: number;
  relationships?: RelationContext;
}

interface GraphEdge {
  from: number;
  to: number;
  type: string;
}

interface OutsideReference {
  id: number;
  title?: string;
  type?: string;
  state?: string;
  url?: string;
}

interface RelationContext {
  parentOutsideSet?: OutsideReference;
  childrenOutsideSet?: OutsideReference[];
  parentId?: number;
  childIds?: number[];
  relatedCount?: number;
  linkedPRs?: number;
  linkedCommits?: number;
  commentCount?: number;
}

interface Aggregates {
  stateCounts?: Record<string, number>;
  typeCounts?: Record<string, number>;
  storyPoints?: {
    total: number;
    average: number;
    max: number;
    count: number;
  };
  riskHeuristic?: {
    highAttentionCount: number;
  };
  aiAssignmentCandidates?: number[];
}

export async function handleGetWorkItemsContextBatch(args: BatchContextArgs) {
  const cfg = loadConfiguration();
  const {
    workItemIds,
    organization = cfg.azureDevOps.organization,
    project = cfg.azureDevOps.project,
    includeRelations = true,
    includeFields = [],
    includeExtendedFields = false,
    includeTags = true,
    includeStateCounts = true,
    includeStoryPointAggregation = true,
    includeRiskScoring = false,
    includeAIAssignmentHeuristic = false,
    includeParentOutsideSet = true,
    includeChildrenOutsideSet = false,
    maxOutsideReferences = 50,
    returnFormat = 'graph'
  } = args;

  try {
    const httpClient = createADOHttpClient(organization, project);
    const baseFields = [
      'System.Id','System.Title','System.WorkItemType','System.State','System.AreaPath','System.IterationPath','System.AssignedTo','System.Tags','System.CommentCount'
    ];
    const extendedFields = [
      'Microsoft.VSTS.Scheduling.StoryPoints','Microsoft.VSTS.Common.Priority','Microsoft.VSTS.Common.Risk','Microsoft.VSTS.Scheduling.RemainingWork'
    ];
    const allFields = [...new Set([...baseFields, ...(includeExtendedFields ? extendedFields : []), ...includeFields])];
    const fieldsParam = allFields.join(',');

    const idsParam = workItemIds.join(',');
    // Note: Azure DevOps API doesn't allow both $expand and fields parameters together
    // Use $expand=all to get both relations and all fields when includeRelations is true
    const expandParam = includeRelations ? '$expand=all' : '';
    const detailsResponse = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
      `wit/workitems?ids=${idsParam}${expandParam ? '&' + expandParam : ''}`
    );
    const details = detailsResponse.data;
    if (!details.value) {
      throw new Error('Failed to fetch work items');
    }

    const insideSet = new Set(workItemIds);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const outsideRefs: Map<number, OutsideReference> = new Map();

    for (const wi of details.value) {
      const f = wi.fields || {};
      
      // Analyze relationships for this work item
      let parentCount = 0;
      let childCount = 0;
      let relatedCount = 0;
      let linkedPRCount = 0;
      let linkedCommitCount = 0;
      let parentId: number | undefined;
      let childIds: number[] = [];
      
      if (wi.relations) {
        for (const rel of wi.relations) {
          const relType = rel.rel || '';
          const targetId = parseInt(rel.url.split('/').pop() || '0', 10);
          
          if (relType === 'System.LinkTypes.Hierarchy-Forward') {
            childCount++;
            childIds.push(targetId);
          } else if (relType === 'System.LinkTypes.Hierarchy-Reverse') {
            parentCount++;
            parentId = targetId;
          } else if (relType === 'System.LinkTypes.Related') {
            relatedCount++;
          } else if (relType === 'ArtifactLink') {
            // Check if it's a PR or commit link
            const artifactUrl = rel.url || '';
            if (artifactUrl.includes('/pullrequest/') || artifactUrl.includes('vstfs:///Git/PullRequestId')) {
              linkedPRCount++;
            } else if (artifactUrl.includes('/commit/') || artifactUrl.includes('vstfs:///Git/Commit')) {
              linkedCommitCount++;
            }
          }
        }
      }
      
      // Calculate comment count from CommentCount field if available
      const commentCount: number = (typeof f['System.CommentCount'] === 'number' ? f['System.CommentCount'] : 0);
      
      const node: GraphNode = {
        id: wi.id,
        title: f['System.Title'],
        type: f['System.WorkItemType'],
        state: f['System.State'],
        assignedTo: f['System.AssignedTo']?.displayName || f['System.AssignedTo']?.uniqueName,
        url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${wi.id}`
      };

      // Add optional fields only if they exist
      if (f['Microsoft.VSTS.Scheduling.StoryPoints'] !== undefined) {
        node.storyPoints = f['Microsoft.VSTS.Scheduling.StoryPoints'];
      }
      if (f['Microsoft.VSTS.Common.Priority'] !== undefined) {
        node.priority = f['Microsoft.VSTS.Common.Priority'];
      }
      if (f['Microsoft.VSTS.Common.Risk'] && typeof f['Microsoft.VSTS.Common.Risk'] === 'string') {
        node.risk = f['Microsoft.VSTS.Common.Risk'];
      }
      if (f['Microsoft.VSTS.Scheduling.RemainingWork'] !== undefined) {
        node.remainingWork = f['Microsoft.VSTS.Scheduling.RemainingWork'];
      }
      if (includeTags && f['System.Tags']) {
        node.tags = String(f['System.Tags']).split(/;|,/).map((t: string) => t.trim()).filter(Boolean);
      }

      // Add relationship context only if there are relationships
      if (parentId || childIds.length > 0 || relatedCount > 0 || linkedPRCount > 0 || linkedCommitCount > 0 || commentCount > 0) {
        const relContext: RelationContext = {};
        if (parentId) relContext.parentId = parentId;
        if (childIds.length > 0) relContext.childIds = childIds;
        if (relatedCount > 0) relContext.relatedCount = relatedCount;
        if (linkedPRCount > 0) relContext.linkedPRs = linkedPRCount;
        if (linkedCommitCount > 0) relContext.linkedCommits = linkedCommitCount;
        if (commentCount > 0) relContext.commentCount = commentCount;
        node.relationships = relContext;
      }

      nodes.push(node);

      if (includeRelations && wi.relations) {
        for (const rel of wi.relations) {
          const relType = rel.rel || '';
          const targetId = parseInt(rel.url.split('/').pop() || '0', 10);
          if (!targetId) continue;

            if (relType === 'System.LinkTypes.Hierarchy-Forward') { // parent -> child edge
              edges.push({ from: wi.id, to: targetId, type: 'child' });
              if (!insideSet.has(targetId) && includeChildrenOutsideSet && outsideRefs.size < maxOutsideReferences) {
                outsideRefs.set(targetId, { id: targetId });
              }
            } else if (relType === 'System.LinkTypes.Hierarchy-Reverse') { // child -> parent edge
              edges.push({ from: targetId, to: wi.id, type: 'child' });
              if (!insideSet.has(targetId) && includeParentOutsideSet && outsideRefs.size < maxOutsideReferences) {
                outsideRefs.set(targetId, { id: targetId });
              }
            } else if (relType === 'System.LinkTypes.Related') {
              // Use normalized ordering to avoid duplicates
              const a = Math.min(wi.id, targetId);
              const b = Math.max(wi.id, targetId);
              edges.push({ from: a, to: b, type: 'related' });
              if (!insideSet.has(targetId) && outsideRefs.size < maxOutsideReferences) {
                outsideRefs.set(targetId, { id: targetId });
              }
            }
        }
      }
    }

    // Deduplicate edges (for related)
    const seen = new Set<string>();
    const dedupedEdges: GraphEdge[] = [];
    for (const e of edges) {
      const key = `${e.from}-${e.to}-${e.type}`;
      if (!seen.has(key)) { seen.add(key); dedupedEdges.push(e); }
    }

    // Fetch minimal outside references (title/state/type) in a single batch if any
    if (outsideRefs.size) {
      try {
        const refIds = Array.from(outsideRefs.keys());
        const refResponse = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
          `wit/workitems?ids=${refIds.join(',')}&fields=System.Id,System.Title,System.WorkItemType,System.State`
        );
        const refRes = refResponse.data;
        if (refRes.value) {
          for (const r of refRes.value) {
            const entry = outsideRefs.get(r.id);
            if (entry) {
              entry.title = r.fields['System.Title'];
              entry.type = r.fields['System.WorkItemType'];
              entry.state = r.fields['System.State'];
              entry.url = `https://dev.azure.com/${organization}/${project}/_workitems/edit/${r.id}`;
            }
          }
        }
      } catch (e) { logger.warn('Failed to expand outside references', e); }
    }

    // Aggregations
    const aggregates: Aggregates = {};
    if (includeStateCounts) {
      aggregates.stateCounts = nodes.reduce((acc: Record<string, number>, n) => { acc[n.state] = (acc[n.state] || 0) + 1; return acc; }, {});
      aggregates.typeCounts = nodes.reduce((acc: Record<string, number>, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {});
    }
    if (includeStoryPointAggregation) {
      const points = nodes.map(n => n.storyPoints).filter((p: number | undefined): p is number => typeof p === 'number');
      aggregates.storyPoints = { 
        total: points.reduce((a: number,b: number)=>a+b,0), 
        count: points.length,
        average: points.length > 0 ? points.reduce((a: number,b: number)=>a+b,0) / points.length : 0,
        max: points.length > 0 ? Math.max(...points) : 0
      };
    }

    if (includeRiskScoring) {
      // Simple heuristic: risk flag if priority high & state not started; staleness based on absence of remainingWork but not done
      const riskItems = nodes.filter(n => (n.priority === 1 || n.priority === 2) && !['Done','Closed','Removed'].includes(n.state));
      aggregates.riskHeuristic = { highAttentionCount: riskItems.length };
    }

    if (includeAIAssignmentHeuristic) {
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

    const data = returnFormat === 'graph' ? graph : { items: nodes, edges: dedupedEdges, aggregates };

    return buildSuccessResponse({ batchContext: data }, { tool: 'wit-get-context-batch' });
  } catch (error) {
    logger.error('Batch context retrieval failed', error);
    return buildErrorResponse(error as Error, { tool: 'wit-get-context-batch' });
  }
}
