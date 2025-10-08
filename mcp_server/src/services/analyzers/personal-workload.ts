import type { ToolExecutionResult } from '../../types/index.js';
import type { PersonalWorkloadAnalyzerArgs, PersonalWorkloadAnalysisResult } from '../sampling-types.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { loadConfiguration } from '../../config/config.js';

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

      const analysisInput = {
        assigned_to_email: args.assignedToEmail,
        analysis_period_days: analysisPeriodDays,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        organization: org,
        project: project,
        area_path: areaPath,
        additional_intent: args.additionalIntent || null
      };

      // The actual data fetching and analysis will be done by the prompt/AI
      // This is just the orchestration layer
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
