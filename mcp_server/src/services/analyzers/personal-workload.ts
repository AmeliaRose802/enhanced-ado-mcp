import type { ToolExecutionResult } from '../../types/index.js';
import type { PersonalWorkloadAnalyzerArgs, PersonalWorkloadAnalysisResult } from '../../types/index.js';
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
  const completedWiql = `
    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
           [System.AssignedTo], [System.Tags], [System.AreaPath], [System.IterationPath],
           [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Common.Priority],
           [System.CreatedDate], [Microsoft.VSTS.Common.ClosedDate], [System.ChangedDate]
    FROM WorkItems
    WHERE [System.AssignedTo] = '${assignedToEmail}'
      AND [System.State] IN ('Done', 'Completed', 'Closed', 'Resolved')
      AND [Microsoft.VSTS.Common.ClosedDate] >= '${startDate}'
      AND [Microsoft.VSTS.Common.ClosedDate] <= '${endDate}'
    ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
  `;
  
  // Query for active work items
  const activeWiql = `
    SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
           [System.AssignedTo], [System.Tags], [System.AreaPath], [System.IterationPath],
           [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Common.Priority],
           [System.CreatedDate], [System.ChangedDate]
    FROM WorkItems
    WHERE [System.AssignedTo] = '${assignedToEmail}'
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
    logger.error('Failed to fetch user work items:', error);
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

    try {
      const config = loadConfiguration();
      const org = args.organization || config.azureDevOps.organization;
      const project = args.project || config.azureDevOps.project;
      const areaPath = args.areaPath || config.azureDevOps.areaPath || '';
      const analysisPeriodDays = args.analysisPeriodDays || 90;
      
      logger.debug(`Starting personal workload analysis for ${args.assignedToEmail} over ${analysisPeriodDays} days`);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - analysisPeriodDays);

      // Fetch work items from Azure DevOps
      logger.debug(`Fetching work items for ${args.assignedToEmail} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const { completed, active } = await fetchUserWorkItems(
        org,
        project,
        args.assignedToEmail,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      logger.debug(`Found ${completed.length} completed and ${active.length} active work items`);

      // Build analysis input with actual work item data
      const analysisInput = {
        assigned_to_email: args.assignedToEmail,
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
          story_points: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
          priority: wi.fields?.['Microsoft.VSTS.Common.Priority'] || 2,
          tags: wi.fields?.['System.Tags'] || '',
          area_path: wi.fields?.['System.AreaPath'] || '',
          iteration_path: wi.fields?.['System.IterationPath'] || '',
          created_date: wi.fields?.['System.CreatedDate'] || '',
          closed_date: wi.fields?.['Microsoft.VSTS.Common.ClosedDate'] || '',
          changed_date: wi.fields?.['System.ChangedDate'] || ''
        })),
        active_work_items: active.map(wi => ({
          id: wi.id,
          title: wi.fields?.['System.Title'] || '',
          type: wi.fields?.['System.WorkItemType'] || '',
          state: wi.fields?.['System.State'] || '',
          story_points: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
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
      logger.error('Personal workload analysis failed:', error);
      return buildErrorResponse(`Personal workload analysis failed: ${error}`, { 
        source: 'personal-workload-analysis-failed' 
      });
    }
  }

  private async performAnalysis(analysisInput: any): Promise<PersonalWorkloadAnalysisResult> {
    // Timeout wrapper to prevent hanging
    const timeoutMs = 120000; // 2 minutes for comprehensive analysis
    
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

  private parseResponse(aiResult: any, analysisInput: any): PersonalWorkloadAnalysisResult {
    const text = this.samplingClient.extractResponseText(aiResult);
    
    // Try to extract JSON if present
    const json = extractJSON(text);
    
    if (json) {
      return this.buildResultFromJSON(json, analysisInput);
    }
    
    // If no JSON, return the text as a formatted result
    // This is a fallback for when the AI returns markdown instead of JSON
    return this.buildResultFromText(text, analysisInput);
  }

  private buildResultFromJSON(json: any, analysisInput: any): PersonalWorkloadAnalysisResult {
    // Build a structured result from JSON response
    return {
      executiveSummary: {
        email: analysisInput.assigned_to_email,
        analysisPeriod: {
          startDate: analysisInput.start_date,
          endDate: analysisInput.end_date,
          days: analysisInput.analysis_period_days
        },
        overallHealthScore: json.overallHealthScore ?? json.healthScore ?? 50,
        healthStatus: this.mapHealthStatus(json.overallHealthScore ?? json.healthScore ?? 50),
        primaryConcerns: json.primaryConcerns ?? json.concerns ?? [],
        additionalIntent: analysisInput.additional_intent
      },
      workSummary: json.workSummary ?? {
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
      riskFlags: json.riskFlags ?? {
        critical: [],
        concerning: [],
        minor: [],
        positive: []
      },
      detailedAnalysis: json.detailedAnalysis ?? {
        workloadBalance: { score: 0, assessment: '', recommendation: '' },
        workVariety: { score: 0, workTypeDistribution: {}, specializationRisk: "Low", recommendation: '' },
        codingBalance: { score: 0, codingPercentage: 0, nonCodingPercentage: 0, assessment: '', recommendation: '' },
        complexityGrowth: { score: 0, trend: "Stable", challengeLevel: "Appropriate", recommendation: '' },
        temporalHealth: { score: 0, afterHoursFrequency: '', continuousWorkPattern: '', assessment: '', recommendation: '' },
        growthTrajectory: { score: 0, assessment: '' }
      },
      customIntentAnalysis: json.customIntentAnalysis,
      actionItems: json.actionItems ?? {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        managerDiscussion: [],
        selfCare: []
      },
      topWorkItems: json.topWorkItems ?? []
    };
  }

  private buildResultFromText(text: string, analysisInput: any): PersonalWorkloadAnalysisResult {
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
        additionalIntent: analysisInput.additional_intent
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
}
