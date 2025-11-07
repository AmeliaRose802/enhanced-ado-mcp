import type { ToolExecutionResult } from '../../types/index.js';
import type { SprintPlanningAnalyzerArgs, SprintPlanningResult } from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { loadConfiguration } from '../../config/config.js';
import { createADOHttpClient } from '../../utils/ado-http-client.js';
import { getTokenProvider } from '../../utils/token-provider.js';
import type { ADOWorkItem } from '../../types/index.js';

/**
 * Build area path filter for WIQL queries
 * Returns empty string if no area paths available (means query entire project)
 */
function buildAreaPathFilter(areaPaths: string[]): string {
  if (!areaPaths || areaPaths.length === 0) {
    return ''; // No filter - query entire project
  }
  
  if (areaPaths.length === 1) {
    return `[System.AreaPath] UNDER '${areaPaths[0].replace(/'/g, "''")}'`;
  }
  
  // Multiple area paths - use OR condition
  const conditions = areaPaths.map(path => 
    `[System.AreaPath] UNDER '${path.replace(/'/g, "''")}'`
  );
  return `(${conditions.join(' OR ')})`;
}

/**
 * Fetch historical velocity data for team members
 */
async function fetchHistoricalVelocity(
  organization: string,
  project: string,
  areaPaths: string[],
  historicalSprintDays: number
): Promise<ADOWorkItem[]> {
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - historicalSprintDays);
  
  const areaPathFilter = buildAreaPathFilter(areaPaths);
  const whereConditions = [
    areaPathFilter, // May be empty if no area paths
    "[System.State] IN ('Done', 'Completed', 'Closed', 'Resolved')",
    `[Microsoft.VSTS.Common.ClosedDate] >= '${startDate.toISOString().split('T')[0]}'`,
    "[System.AssignedTo] <> ''"
  ].filter(c => c !== ''); // Remove empty conditions
  
  const wiql = `
    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State],
           [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints],
           [System.AreaPath], [System.IterationPath],
           [Microsoft.VSTS.Common.ClosedDate], [System.CreatedDate]
    FROM WorkItems
    WHERE ${whereConditions.join('\n      AND ')}
    ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
  `;
  
  try {
    const response = await httpClient.post<{ workItems: Array<{ id: number }> }>(
      'wit/wiql',
      { query: wiql }
    );
    
    const workItemIds = response.data.workItems?.map(wi => wi.id) || [];
    
    if (workItemIds.length === 0) {
      return [];
    }
    
    // Batch fetch work items (limit to 200 for historical data)
    const batchSize = Math.min(workItemIds.length, 200);
    const idsParam = workItemIds.slice(0, batchSize).join(',');
    const itemsResponse = await httpClient.get<{ value: ADOWorkItem[] }>(
      `wit/workitems?ids=${idsParam}&$expand=all`
    );
    
    return itemsResponse.data.value || [];
  } catch (error) {
    logger.error('Failed to fetch historical velocity data:', error);
    throw new Error(`Failed to fetch historical velocity: ${error}`);
  }
}

/**
 * Fetch active work in progress
 */
async function fetchActiveWorkItems(
  organization: string,
  project: string,
  areaPaths: string[]
): Promise<ADOWorkItem[]> {
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  const areaPathFilter = buildAreaPathFilter(areaPaths);
  const whereConditions = [
    areaPathFilter, // May be empty if no area paths
    "[System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')",
    "[System.AssignedTo] <> ''"
  ].filter(c => c !== ''); // Remove empty conditions
  
  const wiql = `
    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State],
           [System.AssignedTo], [Microsoft.VSTS.Scheduling.StoryPoints],
           [System.AreaPath], [System.IterationPath], [Microsoft.VSTS.Common.Priority],
           [System.CreatedDate], [System.ChangedDate]
    FROM WorkItems
    WHERE ${whereConditions.join('\n      AND ')}
    ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC
  `;
  
  try {
    const response = await httpClient.post<{ workItems: Array<{ id: number }> }>(
      'wit/wiql',
      { query: wiql }
    );
    
    const workItemIds = response.data.workItems?.map(wi => wi.id) || [];
    
    if (workItemIds.length === 0) {
      return [];
    }
    
    const idsParam = workItemIds.join(',');
    const itemsResponse = await httpClient.get<{ value: ADOWorkItem[] }>(
      `wit/workitems?ids=${idsParam}&$expand=all`
    );
    
    return itemsResponse.data.value || [];
  } catch (error) {
    logger.error('Failed to fetch active work items:', error);
    throw new Error(`Failed to fetch active work items: ${error}`);
  }
}

/**
 * Fetch candidate work items for sprint planning
 */
async function fetchCandidateWorkItems(
  organization: string,
  project: string,
  candidateIds?: number[]
): Promise<ADOWorkItem[]> {
  if (!candidateIds || candidateIds.length === 0) {
    return [];
  }
  
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  try {
    const idsParam = candidateIds.join(',');
    const response = await httpClient.get<{ value: ADOWorkItem[] }>(
      `wit/workitems?ids=${idsParam}&$expand=all`
    );
    
    return response.data.value || [];
  } catch (error) {
    logger.error('Failed to fetch candidate work items:', error);
    throw new Error(`Failed to fetch candidate work items: ${error}`);
  }
}

/**
 * Sprint Planning Analyzer - AI-powered sprint planning and work assignment
 * 
 * This analyzer helps create optimal sprint plans by:
 * - Analyzing team member capacity and historical velocity
 * - Evaluating available work items for sprint assignment
 * - Proposing balanced work distribution across team members
 * - Considering skills, workload, and dependencies
 * - Providing sprint health metrics and risk assessment
 */
export class SprintPlanningAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: SprintPlanningAnalyzerArgs): Promise<ToolExecutionResult> {
    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const config = loadConfiguration();
      const org = args.organization || config.azureDevOps.organization;
      const project = args.project || config.azureDevOps.project;
      
      // Get area paths with priority: explicit areaPathFilter > single areaPath > config defaults
      let areaPaths: string[] = [];
      if (args.areaPathFilter && args.areaPathFilter.length > 0) {
        // Explicit filter takes highest priority
        areaPaths = args.areaPathFilter;
        logger.debug(`Using explicit area path filter (${areaPaths.length} paths)`);
      } else if (args.areaPath) {
        // Single area path provided
        areaPaths = [args.areaPath];
        logger.debug(`Using single area path from parameter`);
      } else if (config.azureDevOps.areaPaths && config.azureDevOps.areaPaths.length > 0) {
        // Multiple configured area paths
        areaPaths = config.azureDevOps.areaPaths;
        logger.debug(`Using ${areaPaths.length} configured area paths`);
      } else if (config.azureDevOps.areaPath) {
        // Single configured area path (legacy)
        areaPaths = [config.azureDevOps.areaPath];
        logger.debug(`Using single configured area path (legacy)`);
      }
      // If still empty, query entire project (no area path filter)
      
      const historicalSprintsToAnalyze = args.historicalSprintsToAnalyze || 3;
      const historicalDays = historicalSprintsToAnalyze * 14; // Assume 2-week sprints
      
      logger.debug(`Starting sprint planning analysis for iteration: ${args.iterationPath}`);
      if (areaPaths.length > 0) {
        logger.info(`Sprint planning across ${areaPaths.length} area path(s): ${areaPaths.join(', ')}`);
      } else {
        logger.info(`Sprint planning across entire project (no area path filter)`);
      }

      // Fetch historical velocity data
      logger.debug(`Fetching historical velocity data (last ${historicalDays} days)`);
      const historicalWorkItems = await fetchHistoricalVelocity(
        org,
        project,
        areaPaths,
        historicalDays
      );
      
      // Fetch current active work
      logger.debug('Fetching active work items');
      const activeWorkItems = await fetchActiveWorkItems(org, project, areaPaths);
      
      // Fetch candidate work items if IDs provided
      let candidateWorkItems: ADOWorkItem[] = [];
      if (args.candidateWorkItemIds && args.candidateWorkItemIds.length > 0) {
        logger.debug(`Fetching ${args.candidateWorkItemIds.length} candidate work items`);
        candidateWorkItems = await fetchCandidateWorkItems(
          org,
          project,
          args.candidateWorkItemIds
        );
      }

      logger.debug(
        `Data fetched: ${historicalWorkItems.length} historical, ` +
        `${activeWorkItems.length} active, ${candidateWorkItems.length} candidates`
      );

      // Build analysis input with actual work item data
      const analysisInput = {
        iteration_path: args.iterationPath,
        team_members: args.teamMembers,
        sprint_capacity_hours: args.sprintCapacityHours,
        historical_sprints_to_analyze: historicalSprintsToAnalyze,
        organization: org,
        project: project,
        area_path: areaPaths.length > 0 ? areaPaths.join(', ') : 'entire project',
        consider_dependencies: args.considerDependencies ?? true,
        consider_skills: args.considerSkills ?? true,
        additional_constraints: args.additionalConstraints || null,
        include_full_analysis: args.includeFullAnalysis ?? false,
        
        // Historical velocity data
        historical_work_items: historicalWorkItems.map(wi => ({
          id: wi.id,
          title: wi.fields?.['System.Title'] || '',
          type: wi.fields?.['System.WorkItemType'] || '',
          state: wi.fields?.['System.State'] || '',
          assigned_to: wi.fields?.['System.AssignedTo']?.displayName || '',
          story_points: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
          closed_date: wi.fields?.['Microsoft.VSTS.Common.ClosedDate'] || '',
          area_path: wi.fields?.['System.AreaPath'] || '',
          iteration_path: wi.fields?.['System.IterationPath'] || ''
        })),
        
        // Active work in progress
        active_work_items: activeWorkItems.map(wi => ({
          id: wi.id,
          title: wi.fields?.['System.Title'] || '',
          type: wi.fields?.['System.WorkItemType'] || '',
          state: wi.fields?.['System.State'] || '',
          assigned_to: wi.fields?.['System.AssignedTo']?.displayName || '',
          story_points: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
          priority: wi.fields?.['Microsoft.VSTS.Common.Priority'] || 2,
          created_date: wi.fields?.['System.CreatedDate'] || '',
          changed_date: wi.fields?.['System.ChangedDate'] || ''
        })),
        
        // Candidate work items for sprint
        candidate_work_items: candidateWorkItems.map(wi => ({
          id: wi.id,
          title: wi.fields?.['System.Title'] || '',
          description: wi.fields?.['System.Description'] || '',
          type: wi.fields?.['System.WorkItemType'] || '',
          state: wi.fields?.['System.State'] || '',
          story_points: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
          priority: wi.fields?.['Microsoft.VSTS.Common.Priority'] || 2,
          tags: wi.fields?.['System.Tags'] || '',
          area_path: wi.fields?.['System.AreaPath'] || '',
          iteration_path: wi.fields?.['System.IterationPath'] || '',
          acceptance_criteria: wi.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] || ''
        }))
      };

      const result = await this.performAnalysis(analysisInput);
      
      return buildSuccessResponse(result, { 
        source: 'sprint-planning-analysis',
        iterationPath: args.iterationPath,
        teamSize: args.teamMembers.length,
        historicalItemsAnalyzed: historicalWorkItems.length,
        activeItemsAnalyzed: activeWorkItems.length,
        candidateItemsAnalyzed: candidateWorkItems.length
      });
    } catch (error) {
      logger.error('Sprint planning analysis failed:', error);
      return buildErrorResponse(`Sprint planning analysis failed: ${error}`, { 
        source: 'sprint-planning-analysis-failed' 
      });
    }
  }

  private async performAnalysis(analysisInput: any): Promise<SprintPlanningResult> {
    // Timeout wrapper to prevent hanging
    const timeoutMs = 180000; // 3 minutes for comprehensive sprint planning
    
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName: 'sprint-planning-optimizer',
      userContent: formatForAI(analysisInput),
      maxTokens: 3000, // Large token count for comprehensive planning
      temperature: 0.3
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          'Sprint planning analysis exceeded 3 minute timeout. ' +
          'The analysis may be too complex. Try reducing the team size or candidate items.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);
    return this.parseResponse(aiResult, analysisInput);
  }

  private parseResponse(aiResult: any, analysisInput: any): SprintPlanningResult {
    const text = this.samplingClient.extractResponseText(aiResult);
    
    // Try to extract JSON if present
    const json = extractJSON(text);
    
    if (json) {
      return this.buildResultFromJSON(json, analysisInput);
    }
    
    // If no JSON, return the text as a formatted result
    return this.buildResultFromText(text, analysisInput);
  }

  /**
   * Check if balanceMetrics should be omitted (all scores are 0 or assessments are empty/unknown)
   */
  private shouldOmitBalanceMetrics(metrics: any): boolean {
    if (!metrics) return true;
    
    const allScoresZero = (
      (metrics.workloadBalance?.score ?? 0) === 0 &&
      (metrics.skillCoverage?.score ?? 0) === 0 &&
      (metrics.dependencyRisk?.score ?? 0) === 0 &&
      (metrics.overallBalance?.score ?? 0) === 0
    );
    
    const allAssessmentsEmpty = (
      (!metrics.workloadBalance?.assessment || metrics.workloadBalance.assessment === "Not available" || metrics.workloadBalance.assessment === "") &&
      (!metrics.skillCoverage?.assessment || metrics.skillCoverage.assessment === "Not available" || metrics.skillCoverage.assessment === "") &&
      (!metrics.dependencyRisk?.assessment || metrics.dependencyRisk.assessment === "Not available" || metrics.dependencyRisk.assessment === "") &&
      (!metrics.overallBalance?.assessment || metrics.overallBalance.assessment === "Not available" || metrics.overallBalance.assessment === "")
    );
    
    return allScoresZero && allAssessmentsEmpty;
  }

  /**
   * Check if alternativePlans should be omitted (empty or all invalid)
   */
  private shouldOmitAlternativePlans(plans: any[]): boolean {
    if (!plans || plans.length === 0) return true;
    
    // Check if all plans are invalid (missing required fields)
    const allInvalid = plans.every(plan => 
      !plan.planName || !plan.description
    );
    
    return allInvalid;
  }

  /**
   * Check if confidenceLevel should be omitted (unknown or unavailable)
   */
  private shouldOmitConfidenceLevel(level: string | undefined): boolean {
    return !level || level === "Unknown" || level === "unknown";
  }

  /**
   * Check if risks should be omitted (all arrays empty)
   */
  private shouldOmitRisks(risks: any): boolean {
    if (!risks) return true;
    
    return (
      (!risks.critical || risks.critical.length === 0) &&
      (!risks.warnings || risks.warnings.length === 0) &&
      (!risks.recommendations || risks.recommendations.length === 0)
    );
  }

  /**
   * Check if dependencies should be omitted (empty array)
   */
  private shouldOmitDependencies(dependencies: any[]): boolean {
    return !dependencies || dependencies.length === 0;
  }

  private buildResultFromJSON(json: any, analysisInput: any): SprintPlanningResult {
    // Build a structured result from JSON response
    const result: SprintPlanningResult = {
      sprintSummary: {
        iterationPath: analysisInput.iteration_path,
        teamSize: analysisInput.team_members.length,
        totalCapacityHours: analysisInput.sprint_capacity_hours || 
          (analysisInput.team_members.length * 60), // Default 60 hours/person
        totalCandidateItems: analysisInput.candidate_work_item_ids?.length || 0,
        healthScore: json.healthScore ?? 75
      },
      velocityAnalysis: json.velocityAnalysis ?? {
        historicalVelocity: {
          averagePointsPerSprint: 0,
          trendDirection: "Stable",
          consistency: "Moderate",
          lastThreeSprints: []
        },
        predictedVelocity: {
          estimatedPoints: 0,
          confidenceRange: { min: 0, max: 0 },
          assumptions: []
        }
      },
      teamAssignments: json.teamAssignments ?? [],
      unassignedItems: json.unassignedItems ?? [],
      actionableSteps: json.actionableSteps ?? []
    };

    // Conditionally add fullAnalysisText if requested
    if (analysisInput.include_full_analysis) {
      result.fullAnalysisText = JSON.stringify(json, null, 2);
    }

    // Conditionally add confidenceLevel if it's not "Unknown"
    const confidenceLevel = json.confidenceLevel ?? "Medium";
    if (!this.shouldOmitConfidenceLevel(confidenceLevel)) {
      result.sprintSummary.confidenceLevel = confidenceLevel;
    }

    // Conditionally add sprintRisks if not empty
    const sprintRisks = json.sprintRisks ?? {
      critical: [],
      warnings: [],
      recommendations: []
    };
    if (!this.shouldOmitRisks(sprintRisks)) {
      result.sprintRisks = sprintRisks;
    }

    // Conditionally add balanceMetrics if meaningful data exists
    const balanceMetrics = json.balanceMetrics ?? {
      workloadBalance: { score: 0, assessment: "" },
      skillCoverage: { score: 0, assessment: "" },
      dependencyRisk: { score: 0, assessment: "" },
      overallBalance: { score: 0, assessment: "" }
    };
    if (!this.shouldOmitBalanceMetrics(balanceMetrics)) {
      result.balanceMetrics = balanceMetrics;
    }

    // Conditionally add alternativePlans if valid plans exist
    const alternativePlans = json.alternativePlans ?? [];
    if (!this.shouldOmitAlternativePlans(alternativePlans)) {
      result.alternativePlans = alternativePlans;
    }

    // Conditionally add dependencies if they exist
    const dependencies = json.dependencies ?? [];
    if (!this.shouldOmitDependencies(dependencies)) {
      result.dependencies = dependencies;
    }

    return result;
  }

  private buildResultFromText(text: string, analysisInput: any): SprintPlanningResult {
    // Fallback for when AI returns markdown instead of JSON
    const result: SprintPlanningResult = {
      sprintSummary: {
        iterationPath: analysisInput.iteration_path,
        teamSize: analysisInput.team_members.length,
        totalCapacityHours: analysisInput.sprint_capacity_hours || 
          (analysisInput.team_members.length * 60),
        totalCandidateItems: analysisInput.candidate_work_item_ids?.length || 0,
        healthScore: 50
        // confidenceLevel omitted because it would be "Unknown"
      },
      velocityAnalysis: {
        historicalVelocity: {
          averagePointsPerSprint: 0,
          trendDirection: "Unknown",
          consistency: "Unknown",
          lastThreeSprints: []
        },
        predictedVelocity: {
          estimatedPoints: 0,
          confidenceRange: { min: 0, max: 0 },
          assumptions: ["Response not in expected JSON format"]
        }
      },
      teamAssignments: [],
      unassignedItems: [],
      // sprintRisks included because parse error is critical information
      sprintRisks: {
        critical: [{
          title: "Parse Error",
          description: "Could not parse AI response into structured format",
          mitigation: "Review the full analysis text below for insights"
        }],
        warnings: [],
        recommendations: ["Review the full analysis text for planning insights"]
      },
      // balanceMetrics omitted - all scores would be 0 with "Not available"
      // alternativePlans omitted - would be empty array
      // dependencies omitted - would be empty array
      actionableSteps: [
        "Review the full analysis text for planning insights",
        "Consider manual sprint planning based on the analysis"
      ]
    };

    // Conditionally add fullAnalysisText if requested
    if (analysisInput.include_full_analysis) {
      result.fullAnalysisText = text;
    }

    return result;
  }
}
