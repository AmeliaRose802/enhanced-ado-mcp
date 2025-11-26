import type { ToolExecutionResult } from '../../types/index.js';
import type { 
  PersonalWorkloadAnalyzerArgs, 
  PersonalWorkloadAnalysisResult,
  PersonalWorkloadAnalysisInput
} from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger, errorToContext } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import type { SamplingResponse } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { loadConfiguration } from '../../config/config.js';
import { createADOHttpClient } from '../../utils/ado-http-client.js';
import { getTokenProvider } from '../../utils/token-provider.js';
import type { ADOWorkItem } from '../../types/index.js';

/**
 * Helper function to get story points/effort from work item (supports both field names)
 */
function getEffortValue(workItem: ADOWorkItem): number {
  const effortField = workItem.fields?.['Microsoft.VSTS.Scheduling.Effort'];
  const storyPointsField = workItem.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'];
  
  const effortValue = typeof effortField === 'number' ? effortField : 0;
  const storyPointsValue = typeof storyPointsField === 'number' ? storyPointsField : 0;
  
  return effortValue || storyPointsValue;
}

/**
 * Fetch work items for a specific user using WIQL
 */
async function fetchUserWorkItems(
  organization: string,
  project: string,
  assignedToEmail: string,
  startDate: string,
  endDate: string
): Promise<{ completed: ADOWorkItem[]; active: ADOWorkItem[] }> {
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  // Query for completed work items in the time period
  // Note: Using CONTAINS because System.AssignedTo stores "Display Name <email@domain.com>" format
  const completedWiql = `
    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
           [System.AssignedTo], [System.Tags], [System.AreaPath], [System.IterationPath],
           [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Scheduling.Effort], [Microsoft.VSTS.Common.Priority],
           [System.CreatedDate], [Microsoft.VSTS.Common.ClosedDate], [System.ChangedDate]
    FROM WorkItems
    WHERE [System.AssignedTo] CONTAINS '${assignedToEmail}'
      AND [System.State] IN ('Done', 'Completed', 'Closed', 'Resolved')
      AND [Microsoft.VSTS.Common.ClosedDate] >= '${startDate}'
      AND [Microsoft.VSTS.Common.ClosedDate] <= '${endDate}'
    ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
  `;
  
  // Query for active work items
  // Note: Using CONTAINS because System.AssignedTo stores "Display Name <email@domain.com>" format
  const activeWiql = `
    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
           [System.AssignedTo], [System.Tags], [System.AreaPath], [System.IterationPath],
           [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Scheduling.Effort], [Microsoft.VSTS.Common.Priority],
           [System.CreatedDate], [System.ChangedDate]
    FROM WorkItems
    WHERE [System.AssignedTo] CONTAINS '${assignedToEmail}'
      AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')
    ORDER BY [System.ChangedDate] DESC
  `;
  
  try {
    // Execute WIQL queries
    const completedResponse = await httpClient.post<{ workItems: Array<{ id: number }> }>(
      'wit/wiql',
      { query: completedWiql }
    );
    
    const activeResponse = await httpClient.post<{ workItems: Array<{ id: number }> }>(
      'wit/wiql',
      { query: activeWiql }
    );
    
    // Fetch full work item details
    const completedIds = completedResponse.data.workItems?.map(wi => wi.id) || [];
    const activeIds = activeResponse.data.workItems?.map(wi => wi.id) || [];
    
    const completed: ADOWorkItem[] = [];
    const active: ADOWorkItem[] = [];
    
    // Batch fetch completed work items (limit to 50 most recent)
    if (completedIds.length > 0) {
      const batchSize = Math.min(completedIds.length, 50);
      const idsParam = completedIds.slice(0, batchSize).join(',');
      const response = await httpClient.get<{ value: ADOWorkItem[] }>(
        `wit/workitems?ids=${idsParam}&$expand=all`
      );
      completed.push(...(response.data.value || []));
    }
    
    // Batch fetch active work items
    if (activeIds.length > 0) {
      const idsParam = activeIds.join(',');
      const response = await httpClient.get<{ value: ADOWorkItem[] }>(
        `wit/workitems?ids=${idsParam}&$expand=all`
      );
      active.push(...(response.data.value || []));
    }
    
    return { completed, active };
  } catch (error) {
    logger.error('Failed to fetch user work items:', errorToContext(error));
    throw new Error(`Failed to fetch work items: ${error}`);
  }
}

export class PersonalWorkloadAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: PersonalWorkloadAnalyzerArgs): Promise<ToolExecutionResult> {
    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    // Handle both single email and array of emails
    const isArray = Array.isArray(args.assignedToEmail);
    
    if (isArray) {
      return this.analyzeBatch(args);
    } else {
      return this.analyzeSingle(args);
    }
  }

  private async analyzeSingle(args: PersonalWorkloadAnalyzerArgs): Promise<ToolExecutionResult> {
    try {
      const email = args.assignedToEmail as string;
      const config = loadConfiguration();
      const org = args.organization || config.azureDevOps.organization;
      const project = args.project || config.azureDevOps.project;
      const areaPath = args.areaPath || config.azureDevOps.areaPath || '';
      const analysisPeriodDays = args.analysisPeriodDays || 90;
      
      logger.debug(`Starting personal workload analysis for ${email} over ${analysisPeriodDays} days`);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - analysisPeriodDays);

      // Fetch work items from Azure DevOps
      logger.debug(`Fetching work items for ${email} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const { completed, active } = await fetchUserWorkItems(
        org,
        project,
        email,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      logger.debug(`Found ${completed.length} completed and ${active.length} active work items`);

      // Build analysis input with actual work item data
      const analysisInput = {
        assigned_to_email: email,
        analysis_period_days: analysisPeriodDays,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        organization: org,
        project: project,
        area_path: areaPath,
        additional_intent: args.additionalIntent || null,
        completed_work_items: completed.map(wi => ({
          id: wi.id,
          title: wi.fields?.['System.Title'] || '',
          type: wi.fields?.['System.WorkItemType'] || '',
          state: wi.fields?.['System.State'] || '',
          story_points: getEffortValue(wi),
          priority: wi.fields?.['Microsoft.VSTS.Common.Priority'] || 2,
          tags: wi.fields?.['System.Tags'] || '',
          area_path: wi.fields?.['System.AreaPath'] || '',
          iteration_path: wi.fields?.['System.IterationPath'] || '',
          created_date: wi.fields?.['System.CreatedDate'] || '',
          closed_date: String(wi.fields?.['Microsoft.VSTS.Common.ClosedDate'] || ''),
          changed_date: wi.fields?.['System.ChangedDate'] || ''
        })),
        active_work_items: active.map(wi => ({
          id: wi.id,
          title: wi.fields?.['System.Title'] || '',
          type: wi.fields?.['System.WorkItemType'] || '',
          state: wi.fields?.['System.State'] || '',
          story_points: getEffortValue(wi),
          priority: wi.fields?.['Microsoft.VSTS.Common.Priority'] || 2,
          tags: wi.fields?.['System.Tags'] || '',
          area_path: wi.fields?.['System.AreaPath'] || '',
          iteration_path: wi.fields?.['System.IterationPath'] || '',
          created_date: wi.fields?.['System.CreatedDate'] || '',
          changed_date: wi.fields?.['System.ChangedDate'] || ''
        }))
      };

      // The actual analysis is done by the AI with the work item data
      const result = await this.performAnalysis(analysisInput);
      
      return buildSuccessResponse(result, { 
        source: 'personal-workload-analysis',
        analysisType: args.additionalIntent ? 'custom-intent' : 'standard'
      });
    } catch (error) {
      logger.error('Personal workload analysis failed:', errorToContext(error));
      return buildErrorResponse(`Personal workload analysis failed: ${error}`, { 
        source: 'personal-workload-analysis-failed' 
      });
    }
  }

  private async performAnalysis(analysisInput: PersonalWorkloadAnalysisInput): Promise<PersonalWorkloadAnalysisResult> {
    // Timeout wrapper to prevent hanging
    const config = loadConfiguration();
    const timeoutMs = config.aiTimeouts.workloadAnalysis;
    
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName: 'personal-workload-analyzer',
      userContent: formatForAI(analysisInput),
      maxTokens: 2000, // Larger token count for comprehensive analysis
      temperature: 0.3
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          'Personal workload analysis exceeded 2 minute timeout. ' +
          'The analysis may be too complex. Try reducing the analysis period or contact support.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);
    return this.parseResponse(aiResult, analysisInput);
  }

  private parseResponse(aiResult: unknown, analysisInput: PersonalWorkloadAnalysisInput): PersonalWorkloadAnalysisResult {
    const text = this.samplingClient.extractResponseText(aiResult as SamplingResponse);
    
    // Try to extract JSON if present
    const json = extractJSON(text);
    
    if (json) {
      return this.buildResultFromJSON(json, analysisInput);
    }
    
    // If no JSON, return the text as a formatted result
    // This is a fallback for when the AI returns markdown instead of JSON
    return this.buildResultFromText(text, analysisInput);
  }

  private buildResultFromJSON(json: unknown, analysisInput: PersonalWorkloadAnalysisInput): PersonalWorkloadAnalysisResult {
    // Type guard and cast
    const data = json as Record<string, any>;
    
    // Build a structured result from JSON response
    return {
      executiveSummary: {
        email: analysisInput.assigned_to_email,
        analysisPeriod: {
          startDate: analysisInput.start_date,
          endDate: analysisInput.end_date,
          days: analysisInput.analysis_period_days
        },
        overallHealthScore: data.overallHealthScore ?? data.healthScore ?? 50,
        healthStatus: this.mapHealthStatus(data.overallHealthScore ?? data.healthScore ?? 50),
        primaryConcerns: data.primaryConcerns ?? data.concerns ?? [],
        additionalIntent: analysisInput.additional_intent ?? undefined
      },
      workSummary: data.workSummary ?? {
        completed: {
          totalItems: 0,
          storyPoints: 0,
          velocityPerWeek: 0,
          workTypes: {},
          averageCycleTime: 0
        },
        active: {
          totalItems: 0,
          weightedLoad: 0,
          capacityMultiplier: 1.0,
          wipStatus: "Healthy",
          highPriorityCount: 0,
          oldestItemAge: 0
        },
        estimationQuality: {
          manualPercentage: 0,
          aiEstimatedPercentage: 0,
          lowConfidenceCount: 0,
          status: "Good"
        }
      },
      riskFlags: data.riskFlags ?? {
        critical: [],
        concerning: [],
        minor: [],
        positive: []
      },
      detailedAnalysis: data.detailedAnalysis ?? {
        workloadBalance: { score: 0, assessment: '', recommendation: '' },
        workVariety: { score: 0, workTypeDistribution: {}, specializationRisk: "Low", recommendation: '' },
        codingBalance: { score: 0, codingPercentage: 0, nonCodingPercentage: 0, assessment: '', recommendation: '' },
        complexityGrowth: { score: 0, trend: "Stable", challengeLevel: "Appropriate", recommendation: '' },
        temporalHealth: { score: 0, afterHoursFrequency: '', continuousWorkPattern: '', assessment: '', recommendation: '' },
        growthTrajectory: { score: 0, assessment: '' }
      },
      customIntentAnalysis: data.customIntentAnalysis,
      actionItems: data.actionItems ?? {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        managerDiscussion: [],
        selfCare: []
      },
      topWorkItems: data.topWorkItems ?? []
    };
  }

  private buildResultFromText(text: string, analysisInput: PersonalWorkloadAnalysisInput): PersonalWorkloadAnalysisResult {
    // Fallback: return text-based result when AI doesn't return JSON
    // This preserves the full markdown output from the AI
    return {
      executiveSummary: {
        email: analysisInput.assigned_to_email,
        analysisPeriod: {
          startDate: analysisInput.start_date,
          endDate: analysisInput.end_date,
          days: analysisInput.analysis_period_days
        },
        overallHealthScore: 50,
        healthStatus: "Concerning",
        primaryConcerns: ["Analysis returned in markdown format - see full text output"],
        additionalIntent: analysisInput.additional_intent ?? undefined
      },
      workSummary: {
        completed: {
          totalItems: 0,
          storyPoints: 0,
          velocityPerWeek: 0,
          workTypes: {},
          averageCycleTime: 0
        },
        active: {
          totalItems: 0,
          weightedLoad: 0,
          capacityMultiplier: 1.0,
          wipStatus: "Healthy",
          highPriorityCount: 0,
          oldestItemAge: 0
        },
        estimationQuality: {
          manualPercentage: 0,
          aiEstimatedPercentage: 0,
          lowConfidenceCount: 0,
          status: "Good"
        }
      },
      riskFlags: {
        critical: [],
        concerning: [],
        minor: [],
        positive: []
      },
      detailedAnalysis: {
        workloadBalance: { score: 0, assessment: text, recommendation: 'See full analysis output' },
        workVariety: { score: 0, workTypeDistribution: {}, specializationRisk: "Low", recommendation: '' },
        codingBalance: { score: 0, codingPercentage: 0, nonCodingPercentage: 0, assessment: '', recommendation: '' },
        complexityGrowth: { score: 0, trend: "Stable", challengeLevel: "Appropriate", recommendation: '' },
        temporalHealth: { score: 0, afterHoursFrequency: '', continuousWorkPattern: '', assessment: '', recommendation: '' },
        growthTrajectory: { score: 0, assessment: '' }
      },
      actionItems: {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        managerDiscussion: [],
        selfCare: []
      },
      topWorkItems: []
    };
  }

  private mapHealthStatus(score: number): "Healthy" | "Concerning" | "At Risk" | "Critical" {
    if (score >= 70) return "Healthy";
    if (score >= 50) return "Concerning";
    if (score >= 30) return "At Risk";
    return "Critical";
  }

  /**
   * Batch analysis for multiple team members
   * Processes people in parallel with configurable concurrency
   */
  private async analyzeBatch(args: PersonalWorkloadAnalyzerArgs): Promise<ToolExecutionResult> {
    try {
      const emails = args.assignedToEmail as string[];
      const analysisPeriodDays = args.analysisPeriodDays || 90;
      const maxConcurrency = args.maxConcurrency || 5;
      const continueOnError = args.continueOnError !== false; // Default true
      
      logger.info(`Starting batch workload analysis for ${emails.length} team members`);
      
      const startTime = Date.now();
      const results: Array<{
        email: string;
        success: boolean;
        analysis?: PersonalWorkloadAnalysisResult;
        error?: string;
      }> = [];

      // Calculate date range (same for all analyses)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - analysisPeriodDays);

      logger.debug(`Processing with max concurrency: ${maxConcurrency}, continueOnError: ${continueOnError}`);

      // Process in batches
      for (let i = 0; i < emails.length; i += maxConcurrency) {
        const batch = emails.slice(i, i + maxConcurrency);
        logger.debug(`Processing batch ${Math.floor(i / maxConcurrency) + 1}: ${batch.join(', ')}`);

        const batchPromises = batch.map(async (email) => {
          try {
            logger.debug(`Analyzing workload for ${email}`);
            
            // Create single-email args for individual analysis
            const singleArgs: PersonalWorkloadAnalyzerArgs = {
              assignedToEmail: email,
              analysisPeriodDays: args.analysisPeriodDays,
              additionalIntent: args.additionalIntent,
              organization: args.organization,
              project: args.project,
              areaPath: args.areaPath
            };
            
            const result = await this.analyzeSingle(singleArgs);

            if (result.success && result.data) {
              logger.debug(`Successfully analyzed ${email}`);
              return {
                email,
                success: true,
                analysis: result.data as unknown as PersonalWorkloadAnalysisResult
              };
            } else {
              const errorMsg = result.errors.join('; ') || 'Unknown error';
              logger.warn(`Failed to analyze ${email}: ${errorMsg}`);
              
              if (!continueOnError) {
                throw new Error(`Analysis failed for ${email}: ${errorMsg}`);
              }
              
              return {
                email,
                success: false,
                error: errorMsg
              };
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Error analyzing ${email}:`, errorToContext(error));
            
            if (!continueOnError) {
              throw error;
            }
            
            return {
              email,
              success: false,
              error: errorMsg
            };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Calculate team-level metrics
      const successfulResults = results.filter(r => r.success && r.analysis);
      const teamMetrics = this.calculateTeamMetrics(successfulResults.map(r => r.analysis!));

      const duration = Date.now() - startTime;
      logger.info(`Batch analysis completed in ${duration}ms: ${successfulResults.length}/${results.length} successful`);

      const batchResult = {
        summary: {
          totalAnalyzed: results.length,
          successCount: successfulResults.length,
          errorCount: results.filter(r => !r.success).length,
          analysisPeriodDays,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          additionalIntent: args.additionalIntent
        },
        results,
        teamMetrics: successfulResults.length > 0 ? teamMetrics : undefined
      };

      return buildSuccessResponse(batchResult, {
        source: 'batch-personal-workload-analysis',
        duration,
        concurrency: maxConcurrency,
        continueOnError
      });

    } catch (error) {
      logger.error('Batch personal workload analysis failed:', errorToContext(error));
      return buildErrorResponse(`Batch workload analysis failed: ${error}`, {
        source: 'batch-workload-analysis-failed'
      });
    }
  }

  /**
   * Calculate team-level metrics from individual analyses
   */
  private calculateTeamMetrics(analyses: PersonalWorkloadAnalysisResult[]): {
    averageHealthScore: number;
    healthDistribution: Record<string, number>;
    topConcerns: Array<{ concern: string; count: number }>;
    totalWorkItems: { completed: number; active: number };
  } {
    if (analyses.length === 0) {
      return {
        averageHealthScore: 0,
        healthDistribution: {},
        topConcerns: [],
        totalWorkItems: { completed: 0, active: 0 }
      };
    }

    // Average health score
    const totalHealthScore = analyses.reduce((sum, a) => sum + a.executiveSummary.overallHealthScore, 0);
    const averageHealthScore = Math.round(totalHealthScore / analyses.length);

    // Health status distribution
    const healthDistribution: Record<string, number> = {};
    analyses.forEach(a => {
      const status = a.executiveSummary.healthStatus;
      healthDistribution[status] = (healthDistribution[status] || 0) + 1;
    });

    // Aggregate top concerns
    const concernCounts = new Map<string, number>();
    analyses.forEach(a => {
      a.executiveSummary.primaryConcerns.forEach(concern => {
        concernCounts.set(concern, (concernCounts.get(concern) || 0) + 1);
      });
    });

    const topConcerns = Array.from(concernCounts.entries())
      .map(([concern, count]) => ({ concern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 concerns

    // Total work items
    const totalWorkItems = analyses.reduce(
      (acc, a) => ({
        completed: acc.completed + a.workSummary.completed.totalItems,
        active: acc.active + a.workSummary.active.totalItems
      }),
      { completed: 0, active: 0 }
    );

    return {
      averageHealthScore,
      healthDistribution,
      topConcerns,
      totalWorkItems
    };
  }
}
