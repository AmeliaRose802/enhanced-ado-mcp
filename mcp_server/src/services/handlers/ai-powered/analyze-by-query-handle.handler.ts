/**
 * Handler for wit-analyze-items tool
 * 
 * Analyzes work items identified by a query handle without revealing IDs.
 * Forces the use of query handles for analysis workflows to prevent ID hallucination.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import type { ADOWorkItem, ADOApiResponse } from '../../../types/index.js';
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

// Type definitions for analysis results
interface EffortAnalysisResult {
  total_items: number;
  items_with_story_points: number;
  items_without_story_points: number;
  total_story_points: number;
  average_story_points: number;
  type_distribution: Record<string, { count: number; storyPoints: number }>;
  estimation_coverage: number;
}

interface VelocityAnalysisResult {
  total_completed: number;
  completion_by_month: Record<string, { count: number; storyPoints: number }>;
  avg_monthly_items: number;
  avg_monthly_story_points: number;
}

interface AssignmentAnalysisResult {
  total_items: number;
  assigned_items: number;
  unassigned_items: number;
  unique_assignees: number;
  assignment_distribution: Record<string, number>;
  assignment_coverage: number;
}

interface RiskAnalysisResult {
  total_items?: number;
  risk_score: number;
  risk_level: string;
  identified_risks: string[];
  risk_details: {
    unestimated_count: number;
    blocked_count: number;
    stale_count: number;
    unassigned_high_priority_count: number;
  };
}

interface CompletionAnalysisResult {
  total_items: number;
  completed_items: number;
  active_items: number;
  backlog_items: number;
  completion_percentage: number;
  state_distribution: Record<string, number>;
  health_indicator: string;
}

interface PriorityAnalysisResult {
  total_items: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  priority_distribution: Record<string, number>;
  priority_balance: string;
}

interface WorkItemAnalysisResults {
  effort?: EffortAnalysisResult;
  velocity?: VelocityAnalysisResult;
  assignments?: AssignmentAnalysisResult;
  risks?: RiskAnalysisResult;
  completion?: CompletionAnalysisResult;
  priorities?: PriorityAnalysisResult;
  [key: string]: EffortAnalysisResult | VelocityAnalysisResult | AssignmentAnalysisResult | RiskAnalysisResult | CompletionAnalysisResult | PriorityAnalysisResult | { error: string } | undefined;
}

interface WorkItemAnalysis {
  query_handle: string;
  item_count: number;
  original_query: string;
  analysis_types: string[];
  results: WorkItemAnalysisResults;
}

/**
 * Handler for wit-analyze-items tool
 * 
 * Analyzes work items identified by a query handle without revealing IDs.
 * Forces the use of query handles for analysis workflows to prevent ID hallucination.
 * 
 * This handler fetches work items from Azure DevOps based on a query handle and performs
 * various types of analysis including effort estimation, velocity tracking, assignment
 * distribution, risk identification, completion status, and priority distribution.
 * 
 * @param config - Tool configuration containing the Zod schema for validation
 * @param args - Arguments object expected to contain:
 *   - queryHandle: string - The query handle ID from a previous WIQL query
 *   - analysisType: string[] - Array of analysis types to perform:
 *       * 'effort': Analyzes story points and estimation coverage
 *       * 'velocity': Tracks completion rates and trends over time
 *       * 'assignments': Reviews work distribution across team members
 *       * 'risks': Identifies blocked, stale, and high-risk items
 *       * 'completion': Evaluates progress and state distribution
 *       * 'priorities': Analyzes priority balance and distribution
 *   - organization?: string - Azure DevOps organization (defaults to config value)
 *   - project?: string - Azure DevOps project (defaults to config value)
 * @returns Promise<ToolExecutionResult> with the following structure:
 *   - success: boolean - True if analysis completed without errors
 *   - data: WorkItemAnalysis object containing:
 *       * query_handle: string - The input query handle
 *       * item_count: number - Total work items analyzed
 *       * original_query: string - The WIQL query that created the handle
 *       * analysis_types: string[] - Requested analysis types
 *       * results: Record of analysis results keyed by type
 *   - metadata: Source identifier and context
 *   - errors: Array of error messages if failures occurred
 *   - warnings: Array of warnings (e.g., empty query results)
 * @throws {Error} Returns error result (does not throw) if:
 *   - Azure CLI is not available or not logged in
 *   - Query handle is invalid, not found, or expired
 *   - Work item fetching fails
 *   - Analysis execution encounters errors
 * @example
 * ```typescript
 * // Analyze effort and risks for a query handle
 * const result = await handleAnalyzeByQueryHandle(config, {
 *   queryHandle: 'qh_abc123',
 *   analysisType: ['effort', 'risks']
 * });
 * // Returns analysis with story point coverage and identified risks
 * ```
 * @example
 * ```typescript
 * // Comprehensive analysis across all categories
 * const result = await handleAnalyzeByQueryHandle(config, {
 *   queryHandle: 'qh_abc123',
 *   analysisType: ['effort', 'velocity', 'assignments', 'risks', 'completion', 'priorities'],
 *   organization: 'myorg',
 *   project: 'myproject'
 * });
 * ```
 * @since 1.4.0
 */
export async function handleAnalyzeByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, analysisType, organization, project } = parsed.data;

    // Retrieve work item IDs from query handle
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "analyze-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    const workItemIds = queryData.workItemIds;
    logger.info(`Analyzing ${workItemIds.length} work items via query handle (analysis types: ${analysisType.join(', ')})`);

    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, proj);

    const analysis: WorkItemAnalysis = {
      query_handle: queryHandle,
      item_count: workItemIds.length,
      original_query: queryData.query,
      analysis_types: analysisType,
      results: {}
    };

    try {
      // Fetch work items for analysis
      if (workItemIds.length > 0) {
        const fields = [
          'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
          'System.AssignedTo', 'System.CreatedDate', 'System.ChangedDate',
          'Microsoft.VSTS.Scheduling.StoryPoints', 'Microsoft.VSTS.Common.Priority',
          'System.Tags', 'System.Description'
        ];
        
        const batchSize = 50; // ADO batch limit
        const workItems: ADOWorkItem[] = [];
        
        logger.debug(`Fetching ${workItemIds.length} work items in batches of ${batchSize}`);
        
        for (let i = 0; i < workItemIds.length; i += batchSize) {
          const batch = workItemIds.slice(i, i + batchSize);
          const idsParam = batch.join(',');
          
          try {
            const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
              `wit/workitems?ids=${idsParam}&fields=${fields.join(',')}`
            );
            
            if (response.data?.value) {
              workItems.push(...response.data.value);
            }
          } catch (error) {
            logger.error(`Failed to fetch batch of work items (${batch.join(',')}): ${error}`);
            // Continue with other batches rather than failing completely
            throw new Error(`Failed to fetch work items batch for analysis: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        logger.debug(`Successfully fetched ${workItems.length} work items for analysis`);
        
        // Perform requested analyses
        for (const analysisTypeItem of analysisType) {
          try {
            switch (analysisTypeItem) {
              case 'effort':
                analysis.results.effort = analyzeEffort(workItems);
                break;
              case 'velocity':
                analysis.results.velocity = analyzeVelocity(workItems);
                break;
              case 'assignments':
                analysis.results.assignments = analyzeAssignments(workItems);
                break;
              case 'risks':
                analysis.results.risks = analyzeRisks(workItems);
                break;
              case 'completion':
                analysis.results.completion = analyzeCompletion(workItems);
                break;
              case 'priorities':
                analysis.results.priorities = analyzePriorities(workItems);
                break;
              default:
                logger.warn(`Unknown analysis type: ${analysisTypeItem}`);
            }
          } catch (analysisError) {
            logger.error(`Failed to perform ${analysisTypeItem} analysis: ${analysisError}`);
            analysis.results[analysisTypeItem] = {
              error: `Analysis failed: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`
            };
          }
        }
      }

      return {
        success: true,
        data: asToolData(analysis),
        metadata: { source: "analyze-by-query-handle" },
        errors: [],
        warnings: workItemIds.length === 0 ? ["No work items found in query handle"] : []
      };

    } catch (error) {
      logger.error(`Error fetching work items for analysis: ${error}`);
      return {
        success: false,
        data: null,
        metadata: { source: "analyze-by-query-handle" },
        errors: [`Failed to fetch work items for analysis: ${error instanceof Error ? error.message : String(error)}`],
        warnings: []
      };
    }

  } catch (error) {
    logger.error(`Error in handleAnalyzeByQueryHandle: ${error}`);
    return {
      success: false,
      data: null,
      metadata: { source: "analyze-by-query-handle" },
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}

// Analysis functions
function analyzeEffort(workItems: ADOWorkItem[]): EffortAnalysisResult {
  const withStoryPoints = workItems.filter(wi => wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints']);
  const totalStoryPoints = withStoryPoints.reduce((sum, wi) => sum + (wi.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0), 0);
  
  const typeDistribution: { [key: string]: { count: number, storyPoints: number } } = {};
  workItems.forEach(wi => {
    const type = wi.fields?.['System.WorkItemType'] || 'Unknown';
    if (!typeDistribution[type]) {
      typeDistribution[type] = { count: 0, storyPoints: 0 };
    }
    typeDistribution[type].count++;
    typeDistribution[type].storyPoints += wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0;
  });

  return {
    total_items: workItems.length,
    items_with_story_points: withStoryPoints.length,
    items_without_story_points: workItems.length - withStoryPoints.length,
    total_story_points: totalStoryPoints,
    average_story_points: withStoryPoints.length > 0 ? Math.round((totalStoryPoints / withStoryPoints.length) * 10) / 10 : 0,
    type_distribution: typeDistribution,
    estimation_coverage: Math.round((withStoryPoints.length / workItems.length) * 100)
  };
}

function analyzeVelocity(workItems: ADOWorkItem[]): VelocityAnalysisResult {
  const completedItems = workItems.filter(wi => 
    ['Done', 'Closed', 'Resolved', 'Completed'].includes(wi.fields?.['System.State'])
  );
  
  const completedByMonth: { [key: string]: { count: number, storyPoints: number } } = {};
  completedItems.forEach(wi => {
    const changedDate = wi.fields?.['System.ChangedDate'];
    if (changedDate) {
      const month = new Date(changedDate).toISOString().slice(0, 7); // YYYY-MM
      if (!completedByMonth[month]) {
        completedByMonth[month] = { count: 0, storyPoints: 0 };
      }
      completedByMonth[month].count++;
      completedByMonth[month].storyPoints += wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0;
    }
  });

  return {
    total_completed: completedItems.length,
    completion_by_month: completedByMonth,
    avg_monthly_items: Object.keys(completedByMonth).length > 0 ? 
      Math.round(completedItems.length / Object.keys(completedByMonth).length) : 0,
    avg_monthly_story_points: Object.keys(completedByMonth).length > 0 ?
      Math.round(Object.values(completedByMonth).reduce((sum, month) => sum + month.storyPoints, 0) / Object.keys(completedByMonth).length) : 0
  };
}

function analyzeAssignments(workItems: ADOWorkItem[]): AssignmentAnalysisResult {
  const assignmentDistribution: { [key: string]: number } = {};
  let unassignedCount = 0;

  workItems.forEach(wi => {
    const assignedToField = wi.fields?.['System.AssignedTo'];
    const assignedTo = typeof assignedToField === 'object' && assignedToField?.displayName 
      ? assignedToField.displayName 
      : (typeof assignedToField === 'string' ? assignedToField : '');
    
    if (!assignedTo || assignedTo.trim() === '') {
      unassignedCount++;
    } else {
      assignmentDistribution[assignedTo] = (assignmentDistribution[assignedTo] || 0) + 1;
    }
  });

  const sortedAssignments = Object.entries(assignmentDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10); // Top 10 assignees

  return {
    total_items: workItems.length,
    assigned_items: workItems.length - unassignedCount,
    unassigned_items: unassignedCount,
    unique_assignees: Object.keys(assignmentDistribution).length,
    assignment_distribution: Object.fromEntries(sortedAssignments),
    assignment_coverage: Math.round(((workItems.length - unassignedCount) / workItems.length) * 100)
  };
}

function analyzeRisks(workItems: ADOWorkItem[]): RiskAnalysisResult {
  const risks: string[] = [];
  let riskScore = 0;

  // Ensure we have work items
  if (!workItems || workItems.length === 0) {
    return {
      risk_score: 0,
      risk_level: 'Low',
      identified_risks: ['No work items to analyze'],
      risk_details: {
        unestimated_count: 0,
        blocked_count: 0,
        stale_count: 0,
        unassigned_high_priority_count: 0
      }
    };
  }

  // Check for unestimated work
  const unestimated = workItems.filter(wi => !wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints']);
  if (unestimated.length > workItems.length * 0.2) {
    risks.push(`High unestimated work: ${unestimated.length}/${workItems.length} items (${Math.round((unestimated.length/workItems.length)*100)}%) lack Story Points`);
    riskScore += 25;
  }

  // Check for blocked items
  const blocked = workItems.filter(wi => {
    const tags = wi.fields?.['System.Tags'] || '';
    return tags.includes('Blocked') || wi.fields?.['System.State'] === 'Blocked';
  });
  if (blocked.length > 0) {
    risks.push(`Blocked items: ${blocked.length} items are blocked or have blocking tags`);
    riskScore += blocked.length * 5;
  }

  // Check for old items (over 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const staleItems = workItems.filter(wi => {
    const created = new Date(wi.fields?.['System.CreatedDate'] || Date.now());
    return created < sixMonthsAgo;
  });
  if (staleItems.length > workItems.length * 0.1) {
    risks.push(`Stale work: ${staleItems.length} items are older than 6 months`);
    riskScore += 15;
  }

  // Check for high priority items without assignment
  const unassignedHighPriority = workItems.filter(wi => {
    const assignedToField = wi.fields?.['System.AssignedTo'];
    const assignedTo = typeof assignedToField === 'object' && assignedToField?.displayName 
      ? assignedToField.displayName 
      : (typeof assignedToField === 'string' ? assignedToField : '');
    
    return (!assignedTo || assignedTo.trim() === '') &&
           ((wi.fields?.['Microsoft.VSTS.Common.Priority'] ?? 999) <= 2);
  });
  if (unassignedHighPriority.length > 0) {
    risks.push(`Unassigned high-priority: ${unassignedHighPriority.length} high-priority items lack assignment`);
    riskScore += unassignedHighPriority.length * 3;
  }

  return {
    total_items: workItems.length,
    risk_score: Math.min(riskScore, 100), // Cap at 100
    risk_level: riskScore < 20 ? 'Low' : riskScore < 50 ? 'Medium' : 'High',
    identified_risks: risks,
    risk_details: {
      unestimated_count: unestimated.length,
      blocked_count: blocked.length,
      stale_count: staleItems.length,
      unassigned_high_priority_count: unassignedHighPriority.length
    }
  };
}

function analyzeCompletion(workItems: ADOWorkItem[]): CompletionAnalysisResult {
  const stateDistribution: { [key: string]: number } = {};
  workItems.forEach(wi => {
    const state = wi.fields?.['System.State'] || 'Unknown';
    stateDistribution[state] = (stateDistribution[state] || 0) + 1;
  });

  const completedStates = ['Done', 'Closed', 'Resolved', 'Completed'];
  const activeStates = ['Active', 'In Progress', 'Committed'];
  const backlogStates = ['New', 'Proposed', 'To Do', 'Approved'];

  const completed = workItems.filter(wi => completedStates.includes(wi.fields?.['System.State']));
  const active = workItems.filter(wi => activeStates.includes(wi.fields?.['System.State']));
  const backlog = workItems.filter(wi => backlogStates.includes(wi.fields?.['System.State']));

  return {
    total_items: workItems.length,
    completed_items: completed.length,
    active_items: active.length,
    backlog_items: backlog.length,
    completion_percentage: Math.round((completed.length / workItems.length) * 100),
    state_distribution: stateDistribution,
    health_indicator: completed.length > active.length + backlog.length ? 'Healthy' : 
                     active.length > backlog.length ? 'Making Progress' : 'Planning Heavy'
  };
}

function analyzePriorities(workItems: ADOWorkItem[]): PriorityAnalysisResult {
  const priorityDistribution: { [key: string]: number } = {};
  workItems.forEach(wi => {
    const priority = wi.fields?.['Microsoft.VSTS.Common.Priority']?.toString() || 'Unset';
    priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
  });

  const highPriority = workItems.filter(wi => (wi.fields?.['Microsoft.VSTS.Common.Priority'] || 999) <= 2);
  const mediumPriority = workItems.filter(wi => {
    const prio = wi.fields?.['Microsoft.VSTS.Common.Priority'] || 999;
    return prio >= 3 && prio <= 6;
  });
  const lowPriority = workItems.filter(wi => (wi.fields?.['Microsoft.VSTS.Common.Priority'] || 999) > 6);

  return {
    total_items: workItems.length,
    high_priority: highPriority.length,
    medium_priority: mediumPriority.length,
    low_priority: lowPriority.length,
    priority_distribution: priorityDistribution,
    priority_balance: highPriority.length < workItems.length * 0.3 ? 'Balanced' : 'Top-Heavy'
  };
}