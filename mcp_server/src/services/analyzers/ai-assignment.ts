import type { ToolExecutionResult } from '../../types/index.js';
import type { AIAssignmentAnalyzerArgs, AIAssignmentResult } from '../sampling-types.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON } from '../../utils/ai-helpers.js';
import { loadConfiguration } from '../../config/config.js';
import { createADOHttpClient } from '../../utils/ado-http-client.js';
import type { ADOWorkItem, ADOApiResponse } from '../../types/ado.js';

/**
 * Work item with enriched relationship context
 */
interface EnrichedWorkItem {
  workItem: ADOWorkItem;
  parent?: {
    id: number;
    title: string;
    type: string;
    state: string;
  } | null;
  children: Array<{
    id: number;
    title: string;
    type: string;
    state: string;
  }>;
  relatedLinks: Array<{
    type: string;
    url: string;
  }>;
}

/**
 * Get work item details from Azure DevOps with relationships
 */
async function getWorkItemWithContext(
  organization: string,
  project: string,
  workItemId: number
): Promise<EnrichedWorkItem> {
  const httpClient = createADOHttpClient(organization, project);
  
  // Fetch work item with all relationships expanded
  const response = await httpClient.get<ADOWorkItem>(`wit/workitems/${workItemId}?$expand=all`);
  const workItem = response.data;
  
  let parent: EnrichedWorkItem['parent'] = null;
  const children: EnrichedWorkItem['children'] = [];
  const relatedLinks: EnrichedWorkItem['relatedLinks'] = [];
  
  // Process relationships if they exist
  if (workItem.relations) {
    const parentIds: number[] = [];
    const childIds: number[] = [];
    
    for (const rel of workItem.relations) {
      const relType = rel.rel || '';
      
      if (relType === 'System.LinkTypes.Hierarchy-Reverse') {
        // This is a parent link
        const parentId = parseInt(rel.url.split('/').pop() || '0', 10);
        if (parentId > 0) {
          parentIds.push(parentId);
        }
      } else if (relType === 'System.LinkTypes.Hierarchy-Forward') {
        // This is a child link
        const childId = parseInt(rel.url.split('/').pop() || '0', 10);
        if (childId > 0) {
          childIds.push(childId);
        }
      } else if (relType.startsWith('System.LinkTypes')) {
        // Other related links (Related, Predecessor, Successor, etc.)
        relatedLinks.push({
          type: relType.replace('System.LinkTypes.', ''),
          url: rel.url
        });
      }
    }
    
    // Fetch parent details if exists
    if (parentIds.length > 0) {
      try {
        const parentResponse = await httpClient.get<ADOWorkItem>(
          `wit/workitems/${parentIds[0]}?fields=System.Id,System.Title,System.WorkItemType,System.State`
        );
        const parentItem = parentResponse.data;
        parent = {
          id: parentItem.id,
          title: parentItem.fields?.['System.Title'] || '',
          type: parentItem.fields?.['System.WorkItemType'] || '',
          state: parentItem.fields?.['System.State'] || ''
        };
      } catch (error) {
        logger.warn(`Failed to fetch parent work item ${parentIds[0]}:`, error);
      }
    }
    
    // Fetch children details in batch
    if (childIds.length > 0) {
      try {
        const childIdsParam = childIds.join(',');
        const childrenResponse = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
          `wit/workitems?ids=${childIdsParam}&fields=System.Id,System.Title,System.WorkItemType,System.State`
        );
        
        if (childrenResponse.data?.value) {
          for (const childItem of childrenResponse.data.value) {
            children.push({
              id: childItem.id,
              title: childItem.fields?.['System.Title'] || '',
              type: childItem.fields?.['System.WorkItemType'] || '',
              state: childItem.fields?.['System.State'] || ''
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch children work items:`, error);
      }
    }
  }
  
  return {
    workItem,
    parent,
    children,
    relatedLinks
  };
}

export class AIAssignmentAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      // First, fetch the work item details from Azure DevOps with full context
      const config = loadConfiguration();
      const org = args.organization || config.azureDevOps.organization;
      const project = args.project || config.azureDevOps.project;
      
      logger.debug(`Fetching work item ${args.workItemId} with relationship context for AI assignment analysis`);
      
      const enrichedWorkItem = await getWorkItemWithContext(org, project, args.workItemId);
      const workItem = enrichedWorkItem.workItem;
      
      if (!workItem || !workItem.fields) {
        return buildErrorResponse(`Work item ${args.workItemId} not found`, { source: 'work-item-not-found' });
      }

      // Check if work item is in a completed state
      const completedStates = ['Done', 'Completed', 'Closed', 'Resolved', 'Removed'];
      if (completedStates.includes(workItem.fields['System.State'])) {
        return buildErrorResponse(
          `Work item ${args.workItemId} is in state '${workItem.fields['System.State']}'. ` +
          `Cannot analyze completed work items. Only active work items should be analyzed for AI assignment.`,
          { source: 'work-item-completed' }
        );
      }

      // Format parent information
      const parentInfo = enrichedWorkItem.parent 
        ? `${enrichedWorkItem.parent.id}: ${enrichedWorkItem.parent.title} (${enrichedWorkItem.parent.type}, ${enrichedWorkItem.parent.state})`
        : 'None';

      // Format children information
      const childrenInfo = enrichedWorkItem.children.length > 0
        ? enrichedWorkItem.children
            .map(child => `${child.id}: ${child.title} (${child.type}, ${child.state})`)
            .join('; ')
        : 'None';

      // Format related links information
      const relatedLinksInfo = enrichedWorkItem.relatedLinks.length > 0
        ? enrichedWorkItem.relatedLinks
            .map(link => link.type)
            .join(', ')
        : 'None';

      // Extract relevant fields for analysis
      const analysisInput = {
        work_item_id: args.workItemId,
        work_item_title: workItem.fields['System.Title'] || '',
        work_item_description: workItem.fields['System.Description'] || '',
        work_item_type: workItem.fields['System.WorkItemType'] || '',
        acceptance_criteria: workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
        priority: workItem.fields['Microsoft.VSTS.Common.Priority']?.toString() || '',
        state: workItem.fields['System.State'] || '',
        assigned_to: workItem.fields['System.AssignedTo']?.displayName || '',
        tags: workItem.fields['System.Tags'] || '',
        area_path: workItem.fields['System.AreaPath'] || '',
        iteration_path: workItem.fields['System.IterationPath'] || '',
        parent: parentInfo,
        children: childrenInfo,
        children_count: enrichedWorkItem.children.length,
        related_links: relatedLinksInfo,
        output_format: args.outputFormat || 'detailed'
      };

      const result = await this.performAnalysis(analysisInput);
      return buildSuccessResponse(result, { source: 'ai-assignment-analysis' });
    } catch (error) {
      return buildErrorResponse(`AI assignment analysis failed: ${error}`, { source: 'ai-assignment-failed' });
    }
  }

  private async performAnalysis(analysisInput: any): Promise<AIAssignmentResult> {
    // Build variables for the system prompt to auto-fill work item context
    const variables: Record<string, string> = {
      WORK_ITEM_ID: String(analysisInput.work_item_id || ''),
      WORK_ITEM_TYPE: analysisInput.work_item_type || 'Not specified',
      WORK_ITEM_TITLE: analysisInput.work_item_title || 'Not specified',
      WORK_ITEM_STATE: analysisInput.state || 'Not specified',
      WORK_ITEM_PRIORITY: analysisInput.priority || 'Not specified',
      WORK_ITEM_DESCRIPTION: analysisInput.work_item_description || 'No description provided',
      ACCEPTANCE_CRITERIA: analysisInput.acceptance_criteria || 'No acceptance criteria specified',
      AREA_PATH: analysisInput.area_path || 'Not specified',
      ITERATION_PATH: analysisInput.iteration_path || 'Not specified',
      TAGS: analysisInput.tags || 'None',
      ASSIGNED_TO: analysisInput.assigned_to || 'Unassigned',
      PARENT_WORK_ITEM: analysisInput.parent || 'None',
      CHILD_WORK_ITEMS: analysisInput.children || 'None',
      CHILD_COUNT: String(analysisInput.children_count || 0),
      RELATED_LINKS: analysisInput.related_links || 'None'
    };

    // Add timeout wrapper to prevent hanging
    const timeoutMs = 30000; // 30 seconds (AI assignment should be fast)
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName: 'ai-assignment-analyzer',
      userContent: `Analyze the work item provided in the context above and determine if it is suitable for AI assignment (GitHub Copilot).

Consider:
- Task clarity and definition
- Scope and complexity
- Risk factors
- Required guardrails
- Missing information

Output format: ${analysisInput.output_format}`,
      variables,
      maxTokens: 400,
      temperature: 0.2
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          'AI assignment analysis exceeded 30 second timeout. ' +
          'The AI model may be overloaded. Try again in a moment.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);
    return this.parseResponse(aiResult);
  }

  private parseResponse(aiResult: any): AIAssignmentResult {
    const text = this.samplingClient.extractResponseText(aiResult);
    const json = extractJSON(text);
    
    if (!json) {
      throw new Error('Failed to parse AI response as JSON');
    }
    
    return this.buildResultFromJSON(json);
  }

  private buildResultFromJSON(json: any): AIAssignmentResult {
    if (!json.decision) {
      throw new Error('AI response missing required field: decision');
    }

    return {
      decision: json.decision,
      confidence: json.confidence ?? 0.5,
      riskScore: json.riskScore ?? 50,
      primaryReasons: json.reasons ?? json.primaryReasons ?? [],
      missingInfo: json.missingInfo ?? [],
      recommendedNextSteps: json.nextSteps ?? json.recommendedNextSteps ?? [],
      estimatedScope: {
        files: {
          min: json.scope?.filesMin ?? json.estimatedScope?.files?.min ?? 1,
          max: json.scope?.filesMax ?? json.estimatedScope?.files?.max ?? 5
        },
        complexity: json.scope?.complexity ?? json.estimatedScope?.complexity ?? "medium"
      },
      guardrails: {
        testsRequired: json.guardrails?.testsRequired ?? false,
        featureFlagOrToggle: json.guardrails?.featureFlag ?? json.guardrails?.featureFlagOrToggle ?? false,
        touchSensitiveAreas: json.guardrails?.touchesSensitive ?? json.guardrails?.touchSensitiveAreas ?? false,
        needsCodeReviewFromOwner: json.guardrails?.needsReview ?? json.guardrails?.needsCodeReviewFromOwner ?? false
      }
    };
  }
}
