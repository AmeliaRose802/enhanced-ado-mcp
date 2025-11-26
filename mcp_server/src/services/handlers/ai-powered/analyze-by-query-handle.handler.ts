/**
 * Handler for analyze-bulk tool
 * 
 * Analyzes work items identified by a query handle without revealing IDs.
 * Forces the use of query handles for analysis workflows to prevent ID hallucination.
 * 
 * Supports both rule-based analyses (effort, velocity, etc.) and AI-powered analyses
 * (work-item-intelligence, assignment-suitability, parent-recommendation).
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import type { ADOWorkItem, ADOApiResponse } from '@/types/index.js';
import type { MCPServer, MCPServerLike } from '@/types/mcp.js';
import { validateAzureCLI } from "../../../utils/azure-cli-validator.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "@/utils/ado-http-client.js";
import { loadConfiguration } from "@/config/config.js";
import { getTokenProvider } from '@/utils/token-provider.js';
import { performFastHierarchyValidation } from "@/services/analyzers/hierarchy-validator-fast.js";
import { SamplingService } from '../../sampling-service.js';
import { SamplingClient } from '../../../utils/sampling-client.js';
import { WorkItemIntelligenceAnalyzer } from '../../analyzers/work-item-intelligence.js';
import { AIAssignmentAnalyzer } from '../../analyzers/ai-assignment.js';
import { handleIntelligentParentFinder } from '../analysis/intelligent-parent-finder-new.handler.js';

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

interface HierarchyAnalysisResult {
  summary: {
    totalItemsAnalyzed: number;
    totalViolations: number;
    errors: number;
    warnings: number;
  };
  [key: string]: unknown;
}

interface AIAnalysisResult {
  total_analyzed: number;
  results: Array<{
    workItemId: number;
    title: string;
    analysis: unknown;
  }>;
}

interface IntelligenceCategorizationResult extends AIAnalysisResult {
  categorization: {
    feature?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    bug?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    tech_debt?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    security?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    documentation?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    research?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    other?: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
  };
}

interface AISuitabilityCategorizationResult extends AIAnalysisResult {
  categorization: {
    ai_fit: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    human_fit: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    hybrid: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
    needs_refinement: {
      count: number;
      query_handle: string | null;
      work_item_ids: number[];
    };
  };
}

interface WorkItemAnalysisResults {
  effort?: EffortAnalysisResult;
  velocity?: VelocityAnalysisResult;
  assignments?: AssignmentAnalysisResult;
  risks?: RiskAnalysisResult;
  completion?: CompletionAnalysisResult;
  priorities?: PriorityAnalysisResult;
  hierarchy?: HierarchyAnalysisResult;
  'work-item-intelligence'?: IntelligenceCategorizationResult | { error: string };
  'assignment-suitability'?: AISuitabilityCategorizationResult | { error: string };
  'parent-recommendation'?: unknown | { error: string };
  [key: string]: unknown;
}

interface WorkItemAnalysis {
  query_handle: string;
  item_count: number;
  total_items_in_handle: number;
  items_skipped: number;
  original_query: string;
  analysis_types: string[];
  results: WorkItemAnalysisResults;
}

/**
 * Handler for analyze-bulk tool
 * 
 * Unified analysis tool for work items identified by a query handle.
 * Supports both rule-based analyses and AI-powered analyses.
 * 
 * This handler fetches work items from Azure DevOps based on a query handle and performs
 * various types of analysis including effort estimation, velocity tracking, assignment
 * distribution, risk identification, completion status, priority distribution, hierarchy validation,
 * work item intelligence, assignment suitability, and parent recommendation.
 * 
 * @param config - Tool configuration containing the Zod schema for validation
 * @param args - Arguments object expected to contain:
 *   - queryHandle: string - The query handle ID from a previous WIQL query
 *   - analysisType: string[] - Array of analysis types to perform:
 *       * 'effort': Analyzes story points and estimation coverage (rule-based)
 *       * 'velocity': Tracks completion rates and trends over time (rule-based)
 *       * 'assignments': Reviews work distribution across team members (rule-based)
 *       * 'risks': Identifies blocked, stale, and high-risk items (rule-based)
 *       * 'completion': Evaluates progress and state distribution (rule-based)
 *       * 'priorities': Analyzes priority balance and distribution (rule-based)
 *       * 'hierarchy': Validates parent-child relationships (rule-based)
 *       * 'work-item-intelligence': AI-powered completeness/enhancement analysis (requires serverInstance)
 *       * 'assignment-suitability': AI-powered Copilot assignment readiness with categorization and query handles (requires serverInstance)
 *       * 'parent-recommendation': AI-powered intelligent parent matching (requires serverInstance)
 *   - organization?: string - Azure DevOps organization (defaults to config value)
 *   - project?: string - Azure DevOps project (defaults to config value)
 * @param serverInstance - Optional MCPServer instance for AI-powered analyses
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
 *   - warnings: Array of warnings (e.g., empty query results, missing serverInstance for AI analyses)
 * @throws {Error} Returns error result (does not throw) if:
 *   - Azure CLI is not available or not logged in
 *   - Query handle is invalid, not found, or expired
 *   - Work item fetching fails
 *   - Analysis execution encounters errors
 * @example
 * ```typescript
 * // Rule-based analysis (no serverInstance needed)
 * const result = await handleAnalyzeByQueryHandle(config, {
 *   queryHandle: 'qh_abc123',
 *   analysisType: ['effort', 'risks']
 * });
 * ```
 * @example
 * ```typescript
 * // AI-powered analysis (requires serverInstance)
 * const result = await handleAnalyzeByQueryHandle(config, {
 *   queryHandle: 'qh_abc123',
 *   analysisType: ['work-item-intelligence', 'assignment-suitability']
 * }, serverInstance);
 * ```
 * @since 1.4.0
 * @since 1.5.0 - Added AI-powered analysis types
 */
export async function handleAnalyzeByQueryHandle(
  config: ToolConfig, 
  args: unknown,
  serverInstance?: MCPServer | MCPServerLike
): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, analysisType, organization, project, maxItemsToAnalyze, skip } = parsed.data;

    // Retrieve work item IDs from query handle
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "analyze-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 24 hours.`],
        warnings: []
      };
    }

    const allWorkItemIds = queryData.workItemIds;
    
    // Apply pagination
    const skipCount = skip || 0;
    const paginatedIds = maxItemsToAnalyze !== undefined 
      ? allWorkItemIds.slice(skipCount, skipCount + maxItemsToAnalyze)
      : allWorkItemIds.slice(skipCount);
    
    const workItemIds = paginatedIds;
    
    logger.info(`Analyzing ${workItemIds.length} work items via query handle (total: ${allWorkItemIds.length}, skip: ${skipCount}, analysis types: ${analysisType.join(', ')})`);

    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    const analysis: WorkItemAnalysis = {
      query_handle: queryHandle,
      item_count: workItemIds.length,
      total_items_in_handle: allWorkItemIds.length,
      items_skipped: skipCount,
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
          'Microsoft.VSTS.Scheduling.StoryPoints', 'Microsoft.VSTS.Scheduling.Effort',
          'Microsoft.VSTS.Common.Priority', 'System.Tags', 'System.Description'
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
              case 'hierarchy':
                // Perform fast rule-based hierarchy validation
                const hierarchyResult = await performFastHierarchyValidation(
                  workItems,
                  org,
                  proj,
                  {
                    validateTypes: parsed.data.validateTypes,
                    validateStates: parsed.data.validateStates,
                    returnQueryHandles: parsed.data.returnQueryHandles
                  }
                );
                analysis.results.hierarchy = hierarchyResult as unknown as HierarchyAnalysisResult;
                break;
              case 'work-item-intelligence':
                // AI-powered work item intelligence analysis
                if (!serverInstance) {
                  analysis.results['work-item-intelligence'] = {
                    error: 'AI-powered work item intelligence analysis requires VS Code sampling support. Ensure VS Code MCP integration is enabled.'
                  };
                  logger.warn('work-item-intelligence analysis requires serverInstance for sampling');
                } else {
                  const intelligenceResults = [];
                  const intelligenceAnalyzer = new WorkItemIntelligenceAnalyzer(serverInstance);
                  const analysisType = parsed.data.intelligenceAnalysisType || 'full';
                  
                  // Categories for work item IDs (when using categorization analysis)
                  const categorizedIds: Record<string, number[]> = {};
                  
                  // Analyze each work item
                  for (const wi of workItems) {
                    try {
                      const analysisResult = await intelligenceAnalyzer.analyze({
                        Title: wi.fields?.['System.Title'] || '',
                        Description: wi.fields?.['System.Description'] || '',
                        WorkItemType: wi.fields?.['System.WorkItemType'] || '',
                        AcceptanceCriteria: wi.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
                        AnalysisType: analysisType,
                        ContextInfo: parsed.data.contextInfo,
                        EnhanceDescription: parsed.data.enhanceDescription || false
                      });
                      
                      if (analysisResult.success && analysisResult.data) {
                        intelligenceResults.push({
                          workItemId: wi.id,
                          title: wi.fields?.['System.Title'],
                          analysis: analysisResult.data
                        });
                        
                        // Categorize by category if using categorization analysis
                        if (analysisType === 'categorization') {
                          const category = (analysisResult.data as any)?.category;
                          if (category && wi.id) {
                            const categoryKey = category.toLowerCase().replace(/\s+/g, '_');
                            if (!categorizedIds[categoryKey]) {
                              categorizedIds[categoryKey] = [];
                            }
                            categorizedIds[categoryKey].push(wi.id);
                          }
                        }
                      }
                    } catch (error) {
                      logger.error(`Failed to analyze work item ${wi.id}: ${error}`);
                    }
                  }
                  
                  // Create base result
                  const baseResult: IntelligenceCategorizationResult = {
                    total_analyzed: intelligenceResults.length,
                    results: intelligenceResults,
                    categorization: {}
                  };
                  
                  // Create query handles for each category if categorization was used
                  if (analysisType === 'categorization' && Object.keys(categorizedIds).length > 0) {
                    const createCategoryHandle = (ids: number[], categoryForQueryType: string) => {
                      if (ids.length === 0) return null;
                      
                      const derivedQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')}) /* Intelligence Category: ${categoryForQueryType.replace(/-/g, ' ')} - Derived from ${queryHandle} */`;
                      
                      const categoryContext = new Map();
                      ids.forEach(id => {
                        const wi = workItems.find(w => w.id === id);
                        if (wi) {
                          categoryContext.set(id, {
                            title: wi.fields?.['System.Title'] || `Work Item ${id}`,
                            state: wi.fields?.['System.State'] || 'Unknown',
                            type: wi.fields?.['System.WorkItemType'] || 'Unknown',
                            changedDate: wi.fields?.['System.ChangedDate'],
                            assignedTo: wi.fields?.['System.AssignedTo']?.displayName || wi.fields?.['System.AssignedTo'],
                            tags: wi.fields?.['System.Tags']
                          });
                        }
                      });
                      
                      return queryHandleService.storeQuery(
                        ids,
                        derivedQuery,
                        {
                          project: proj,
                          queryType: `intelligence-category-${categoryForQueryType}`
                        },
                        undefined,
                        categoryContext,
                        {
                          analysisTimestamp: new Date().toISOString(),
                          successCount: ids.length
                        }
                      );
                    };
                    
                    // Create handles for each discovered category
                    for (const [categoryKey, ids] of Object.entries(categorizedIds)) {
                      const categoryNameForDisplay = categoryKey.replace(/_/g, ' ');
                      const categoryNameForQueryType = categoryKey.replace(/_/g, '-');
                      baseResult.categorization[categoryKey as keyof typeof baseResult.categorization] = {
                        count: ids.length,
                        query_handle: createCategoryHandle(ids, categoryNameForQueryType),
                        work_item_ids: ids
                      } as any;
                    }
                  }
                  
                  analysis.results['work-item-intelligence'] = baseResult;
                }
                break;
              case 'assignment-suitability':
                // AI-powered assignment suitability analysis
                if (!serverInstance) {
                  analysis.results['assignment-suitability'] = {
                    error: 'AI-powered assignment suitability analysis requires VS Code sampling support. Ensure VS Code MCP integration is enabled.'
                  };
                  logger.warn('assignment-suitability analysis requires serverInstance for sampling');
                } else {
                  const assignmentResults = [];
                  const assignmentAnalyzer = new AIAssignmentAnalyzer(serverInstance);
                  
                  // Categories for work item IDs
                  const categorizedIds = {
                    AI_FIT: [] as number[],
                    HUMAN_FIT: [] as number[],
                    HYBRID: [] as number[],
                    NEEDS_REFINEMENT: [] as number[]
                  };
                  
                  // Analyze each work item
                  for (const wi of workItems) {
                    try {
                      const analysisResult = await assignmentAnalyzer.analyze({
                        workItemId: wi.id || 0,
                        repository: parsed.data.repository,
                        outputFormat: parsed.data.outputFormat || 'detailed'
                      });
                      
                      if (analysisResult.success && analysisResult.data) {
                        assignmentResults.push({
                          workItemId: wi.id,
                          title: wi.fields?.['System.Title'],
                          analysis: analysisResult.data
                        });
                        
                        // Categorize based on decision
                        const decision = (analysisResult.data as any)?.decision;
                        if (decision && wi.id) {
                          if (categorizedIds[decision as keyof typeof categorizedIds]) {
                            categorizedIds[decision as keyof typeof categorizedIds].push(wi.id);
                          }
                        }
                      }
                    } catch (error) {
                      logger.error(`Failed to analyze assignment suitability for work item ${wi.id}: ${error}`);
                    }
                  }
                  
                  // Create query handles for each category
                  const createCategoryHandle = (ids: number[], category: string) => {
                    if (ids.length === 0) return null;
                    
                    // Create a derived WIQL query for documentation
                    const derivedQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${ids.join(',')}) /* AI Suitability: ${category} - Derived from ${queryHandle} */`;
                    
                    // Build work item context for the handle
                    const categoryContext = new Map();
                    ids.forEach(id => {
                      const wi = workItems.find(w => w.id === id);
                      if (wi) {
                        categoryContext.set(id, {
                          title: wi.fields?.['System.Title'] || `Work Item ${id}`,
                          state: wi.fields?.['System.State'] || 'Unknown',
                          type: wi.fields?.['System.WorkItemType'] || 'Unknown',
                          changedDate: wi.fields?.['System.ChangedDate'],
                          assignedTo: wi.fields?.['System.AssignedTo']?.displayName || wi.fields?.['System.AssignedTo'],
                          tags: wi.fields?.['System.Tags']
                        });
                      }
                    });
                    
                    return queryHandleService.storeQuery(
                      ids,
                      derivedQuery,
                      {
                        project: proj,
                        queryType: `ai-suitability-${category.toLowerCase().replace('_', '-')}`
                      },
                      undefined,
                      categoryContext,
                      {
                        analysisTimestamp: new Date().toISOString(),
                        successCount: ids.length
                      }
                    );
                  };
                  
                  analysis.results['assignment-suitability'] = {
                    total_analyzed: assignmentResults.length,
                    results: assignmentResults,
                    categorization: {
                      ai_fit: {
                        count: categorizedIds.AI_FIT.length,
                        query_handle: createCategoryHandle(categorizedIds.AI_FIT, 'AI_FIT'),
                        work_item_ids: categorizedIds.AI_FIT
                      },
                      human_fit: {
                        count: categorizedIds.HUMAN_FIT.length,
                        query_handle: createCategoryHandle(categorizedIds.HUMAN_FIT, 'HUMAN_FIT'),
                        work_item_ids: categorizedIds.HUMAN_FIT
                      },
                      hybrid: {
                        count: categorizedIds.HYBRID.length,
                        query_handle: createCategoryHandle(categorizedIds.HYBRID, 'HYBRID'),
                        work_item_ids: categorizedIds.HYBRID
                      },
                      needs_refinement: {
                        count: categorizedIds.NEEDS_REFINEMENT.length,
                        query_handle: createCategoryHandle(categorizedIds.NEEDS_REFINEMENT, 'NEEDS_REFINEMENT'),
                        work_item_ids: categorizedIds.NEEDS_REFINEMENT
                      }
                    }
                  };
                }
                break;
              case 'cluster-topics':
                // Smart topic clustering using keyword extraction
                const clusterMethod = parsed.data.clusteringMethod || 'keywords';
                const minClusterSize = parsed.data.minClusterSize || 2;
                const maxClusters = parsed.data.maxClusters || 20;
                
                if (clusterMethod === 'ai-semantic' && !serverInstance) {
                  analysis.results['cluster-topics'] = {
                    error: 'AI-semantic clustering requires VS Code sampling support. Use clusteringMethod: "keywords" instead.'
                  };
                  logger.warn('ai-semantic clustering requires serverInstance for sampling');
                } else {
                  const clusters = await clusterWorkItemsByTopic(
                    workItems,
                    org,
                    proj,
                    {
                      minClusterSize,
                      maxClusters,
                      method: clusterMethod,
                      serverInstance: clusterMethod === 'ai-semantic' ? serverInstance : undefined
                    }
                  );
                  
                  // Create query handles for each cluster
                  const clusterHandles = clusters.map(cluster => {
                    const derivedQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${cluster.workItemIds.join(',')}) /* Topic Cluster: ${cluster.topicName} - Derived from ${queryHandle} */`;
                    
                    const clusterContext = new Map();
                    cluster.workItemIds.forEach(id => {
                      const wi = workItems.find(w => w.id === id);
                      if (wi) {
                        clusterContext.set(id, {
                          title: wi.fields?.['System.Title'] || `Work Item ${id}`,
                          state: wi.fields?.['System.State'] || 'Unknown',
                          type: wi.fields?.['System.WorkItemType'] || 'Unknown',
                          changedDate: wi.fields?.['System.ChangedDate'],
                          assignedTo: wi.fields?.['System.AssignedTo']?.displayName || wi.fields?.['System.AssignedTo'],
                          tags: wi.fields?.['System.Tags']
                        });
                      }
                    });
                    
                    return {
                      topicName: cluster.topicName,
                      queryHandle: queryHandleService.storeQuery(
                        cluster.workItemIds,
                        derivedQuery,
                        {
                          project: proj,
                          queryType: `topic-cluster`
                        },
                        undefined,
                        clusterContext,
                        {
                          analysisTimestamp: new Date().toISOString(),
                          successCount: cluster.workItemIds.length
                        }
                      ),
                      itemCount: cluster.workItemIds.length,
                      keywords: cluster.keywords,
                      cohesionScore: cluster.cohesionScore
                    };
                  });
                  
                  analysis.results['cluster-topics'] = {
                    total_clusters: clusterHandles.length,
                    total_clustered_items: clusterHandles.reduce((sum, c) => sum + c.itemCount, 0),
                    clustering_method: clusterMethod,
                    clusters: clusterHandles,
                    unclustered_items: workItems.length - clusterHandles.reduce((sum, c) => sum + c.itemCount, 0)
                  };
                }
                break;
              case 'parent-recommendation':
                // AI-powered intelligent parent matching
                if (!serverInstance) {
                  analysis.results['parent-recommendation'] = {
                    error: 'AI-powered parent recommendation requires VS Code sampling support. Ensure VS Code MCP integration is enabled.'
                  };
                  logger.warn('parent-recommendation analysis requires serverInstance for sampling');
                } else {
                  // Delegate to the intelligent parent finder handler
                  const parentFinderArgs = {
                    childQueryHandle: queryHandle,
                    dryRun: parsed.data.dryRun,
                    areaPath: parsed.data.areaPath,
                    includeSubAreas: parsed.data.includeSubAreas,
                    maxParentCandidates: parsed.data.maxParentCandidates,
                    maxRecommendations: parsed.data.maxRecommendations,
                    parentWorkItemTypes: parsed.data.parentWorkItemTypes,
                    searchScope: parsed.data.searchScope,
                    iterationPath: parsed.data.iterationPath,
                    requireActiveParents: parsed.data.requireActiveParents,
                    confidenceThreshold: parsed.data.confidenceThreshold,
                    organization: org,
                    project: proj
                  };
                  
                  // Import the schema for parent finder
                  const { intelligentParentFinderSchema } = await import('@/config/schemas.js');
                  const samplingService = new SamplingService(serverInstance);
                  const parentResult = await handleIntelligentParentFinder(
                    { 
                      schema: intelligentParentFinderSchema, 
                      name: 'recommend-parent', 
                      description: '', 
                      script: '', 
                      inputSchema: { type: 'object', properties: {} } as const
                    },
                    parentFinderArgs,
                    samplingService
                  );
                  
                  analysis.results['parent-recommendation'] = parentResult.data || {
                    error: parentResult.errors?.[0] || 'Parent recommendation failed'
                  };
                }
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

// Helper function to get story points/effort from work item (supports both field names)
function getEffortValue(workItem: ADOWorkItem): number {
  const effortField = workItem.fields?.['Microsoft.VSTS.Scheduling.Effort'];
  const storyPointsField = workItem.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'];
  
  const effortValue = typeof effortField === 'number' ? effortField : 0;
  const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
  
  return effortValue || storyPointsValue;
}

// Analysis functions
function analyzeEffort(workItems: ADOWorkItem[]): EffortAnalysisResult {
  const withStoryPoints = workItems.filter(wi => getEffortValue(wi) > 0);
  const totalStoryPoints = withStoryPoints.reduce((sum, wi) => sum + getEffortValue(wi), 0);
  
  const typeDistribution: { [key: string]: { count: number, storyPoints: number } } = {};
  workItems.forEach(wi => {
    const type = wi.fields?.['System.WorkItemType'] || 'Unknown';
    if (!typeDistribution[type]) {
      typeDistribution[type] = { count: 0, storyPoints: 0 };
    }
    typeDistribution[type].count++;
    typeDistribution[type].storyPoints += getEffortValue(wi);
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
      completedByMonth[month].storyPoints += getEffortValue(wi);
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
  const unestimated = workItems.filter(wi => getEffortValue(wi) === 0);
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

/**
 * Cluster work items by topic using keyword extraction
 * Smart, fast implementation that doesn't require embeddings
 */
interface TopicCluster {
  topicName: string;
  workItemIds: number[];
  keywords: string[];
  cohesionScore: number;
}

interface ClusterOptions {
  minClusterSize: number;
  maxClusters: number;
  method: 'keywords' | 'ai-semantic';
  serverInstance?: MCPServer | MCPServerLike;
}

async function clusterWorkItemsByTopic(
  workItems: ADOWorkItem[],
  org: string,
  project: string,
  options: ClusterOptions
): Promise<TopicCluster[]> {
  if (options.method === 'keywords') {
    return clusterByKeywords(workItems, options);
  } else {
    return clusterByAISemantic(workItems, options.serverInstance!, options);
  }
}

/**
 * Fast keyword-based clustering (deterministic, no LLM calls)
 */
function clusterByKeywords(workItems: ADOWorkItem[], options: ClusterOptions): TopicCluster[] {
  // Extract meaningful keywords from each work item
  const itemKeywords = workItems.map(wi => {
    const title = (wi.fields?.['System.Title'] as string || '').toLowerCase();
    const description = (wi.fields?.['System.Description'] as string || '').toLowerCase().replace(/<[^>]*>/g, ' ');
    const tags = (wi.fields?.['System.Tags'] as string || '').toLowerCase();
    const text = `${title} ${title} ${title} ${description} ${tags}`; // Weight title 3x
    
    // Extract keywords (2-3 word phrases and single significant words)
    const words = text.match(/\b[a-z]{4,}\b/gi) || [];
    const stopWords = new Set(['with', 'from', 'have', 'this', 'that', 'will', 'been', 'were', 'their', 'would', 'there', 'could', 'should', 'about', 'which', 'these', 'those', 'when', 'where', 'what', 'who', 'how']);
    const filtered = words.filter(w => !stopWords.has(w));
    
    // Count word frequency
    const freq = new Map<string, number>();
    filtered.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
    
    // Top keywords by frequency
    const topKeywords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return {
      id: wi.id!,
      keywords: topKeywords,
      keywordSet: new Set(topKeywords)
    };
  });
  
  // Build similarity matrix based on keyword overlap
  const clusters: TopicCluster[] = [];
  const clustered = new Set<number>();
  
  for (const item of itemKeywords) {
    if (clustered.has(item.id)) continue;
    
    // Find similar items (Jaccard similarity > 0.3)
    const clusterItems = [item.id];
    const clusterKeywords = new Set(item.keywords);
    
    for (const other of itemKeywords) {
      if (item.id === other.id || clustered.has(other.id)) continue;
      
      const intersection = new Set([...item.keywordSet].filter(k => other.keywordSet.has(k)));
      const union = new Set([...item.keywordSet, ...other.keywordSet]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      
      if (jaccard >= 0.3) {
        clusterItems.push(other.id);
        other.keywords.forEach(k => clusterKeywords.add(k));
        clustered.add(other.id);
      }
    }
    
    if (clusterItems.length >= options.minClusterSize) {
      clustered.add(item.id);
      
      // Pick top 3-5 most common keywords as cluster name
      const keywordCounts = new Map<string, number>();
      itemKeywords
        .filter(i => clusterItems.includes(i.id))
        .forEach(i => {
          i.keywords.forEach(k => keywordCounts.set(k, (keywordCounts.get(k) || 0) + 1));
        });
      
      const topClusterKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);
      
      // Calculate cohesion (avg keyword overlap)
      let totalOverlap = 0;
      let comparisons = 0;
      for (let i = 0; i < clusterItems.length; i++) {
        for (let j = i + 1; j < clusterItems.length; j++) {
          const item1 = itemKeywords.find(it => it.id === clusterItems[i]);
          const item2 = itemKeywords.find(it => it.id === clusterItems[j]);
          if (item1 && item2) {
            const intersection = new Set([...item1.keywordSet].filter(k => item2.keywordSet.has(k)));
            const union = new Set([...item1.keywordSet, ...item2.keywordSet]);
            totalOverlap += union.size > 0 ? intersection.size / union.size : 0;
            comparisons++;
          }
        }
      }
      const cohesion = comparisons > 0 ? totalOverlap / comparisons : 0;
      
      clusters.push({
        topicName: topClusterKeywords.join(' + ') || 'Related Items',
        workItemIds: clusterItems,
        keywords: topClusterKeywords,
        cohesionScore: Math.round(cohesion * 100) / 100
      });
    }
  }
  
  // Sort by cluster size (largest first) and limit
  return clusters
    .sort((a, b) => b.workItemIds.length - a.workItemIds.length)
    .slice(0, options.maxClusters);
}

/**
 * AI-powered semantic clustering (uses LLM for topic extraction)
 */
async function clusterByAISemantic(
  workItems: ADOWorkItem[],
  serverInstance: MCPServer | MCPServerLike,
  options: ClusterOptions
): Promise<TopicCluster[]> {
  const samplingClient = new SamplingClient(serverInstance);
  
  // Extract titles for AI analysis
  const itemTitles = workItems.map(wi => ({
    id: wi.id!,
    title: wi.fields?.['System.Title'] as string || '',
    type: wi.fields?.['System.WorkItemType'] as string || ''
  }));
  
  // Ask AI to identify topics and group items
  const prompt = `Analyze these work items and group them into ${Math.min(options.maxClusters, 10)} cohesive topic clusters. Return ONLY a JSON array of clusters.

Work Items:
${itemTitles.map((item, idx) => `${idx + 1}. [${item.type}] ${item.title}`).join('\n')}

Return format:
[
  {
    "topicName": "brief topic description (3-5 words)",
    "itemIndices": [1, 5, 7],
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
]

Rules:
- Min ${options.minClusterSize} items per cluster
- Topic names should be concise and descriptive
- Group by semantic similarity, not just keywords
- Prefer fewer, more cohesive clusters over many small ones`;

  try {
    const result = await samplingClient.createMessage({
      systemPromptName: 'topic-clustering',
      userContent: prompt,
      maxTokens: 2000,
      temperature: 0.2
    });
    
    const responseText = samplingClient.extractResponseText(result);
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const aiClusters = JSON.parse(jsonMatch[0]) as Array<{
        topicName: string;
        itemIndices: number[];
        keywords: string[];
      }>;
      
      return aiClusters
        .filter(c => c.itemIndices.length >= options.minClusterSize)
        .map(c => ({
          topicName: c.topicName,
          workItemIds: c.itemIndices.map(idx => itemTitles[idx - 1]?.id).filter(Boolean),
          keywords: c.keywords,
          cohesionScore: 0.85 // AI clustering assumed to be high quality
        }));
    }
  } catch (error) {
    logger.error(`AI semantic clustering failed, falling back to keyword clustering: ${error}`);
  }
  
  // Fallback to keyword clustering if AI fails
  return clusterByKeywords(workItems, options);
}