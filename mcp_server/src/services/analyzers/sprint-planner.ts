import type { ToolExecutionResult } from '../../types/index.js';
import type { SprintPlanningAnalyzerArgs, SprintPlanningResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { loadConfiguration } from '../../config/config.js';

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

  constructor(server: any) {
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
      const areaPath = args.areaPath || config.azureDevOps.areaPath || '';
      
      logger.debug(`Starting sprint planning analysis for iteration: ${args.iterationPath}`);

      const analysisInput = {
        iteration_path: args.iterationPath,
        team_members: args.teamMembers,
        sprint_capacity_hours: args.sprintCapacityHours,
        historical_sprints_to_analyze: args.historicalSprintsToAnalyze || 3,
        candidate_work_item_ids: args.candidateWorkItemIds,
        organization: org,
        project: project,
        area_path: areaPath,
        consider_dependencies: args.considerDependencies ?? true,
        consider_skills: args.considerSkills ?? true,
        additional_constraints: args.additionalConstraints || null
      };

      const result = await this.performAnalysis(analysisInput);
      
      return buildSuccessResponse(result, { 
        source: 'sprint-planning-analysis',
        iterationPath: args.iterationPath,
        teamSize: args.teamMembers.length
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

  private buildResultFromJSON(json: any, analysisInput: any): SprintPlanningResult {
    // Build a structured result from JSON response
    // Note: fullAnalysisText will be added by the caller
    return {
      sprintSummary: {
        iterationPath: analysisInput.iteration_path,
        teamSize: analysisInput.team_members.length,
        totalCapacityHours: analysisInput.sprint_capacity_hours || 
          (analysisInput.team_members.length * 60), // Default 60 hours/person
        totalCandidateItems: analysisInput.candidate_work_item_ids?.length || 0,
        healthScore: json.healthScore ?? 75,
        confidenceLevel: json.confidenceLevel ?? "Medium"
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
      sprintRisks: json.sprintRisks ?? {
        critical: [],
        warnings: [],
        recommendations: []
      },
      balanceMetrics: json.balanceMetrics ?? {
        workloadBalance: { score: 0, assessment: "" },
        skillCoverage: { score: 0, assessment: "" },
        dependencyRisk: { score: 0, assessment: "" },
        overallBalance: { score: 0, assessment: "" }
      },
      alternativePlans: json.alternativePlans ?? [],
      actionableSteps: json.actionableSteps ?? [],
      fullAnalysisText: JSON.stringify(json, null, 2)
    };
  }

  private buildResultFromText(text: string, analysisInput: any): SprintPlanningResult {
    // Fallback for when AI returns markdown instead of JSON
    return {
      sprintSummary: {
        iterationPath: analysisInput.iteration_path,
        teamSize: analysisInput.team_members.length,
        totalCapacityHours: analysisInput.sprint_capacity_hours || 
          (analysisInput.team_members.length * 60),
        totalCandidateItems: analysisInput.candidate_work_item_ids?.length || 0,
        healthScore: 50,
        confidenceLevel: "Unknown"
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
      sprintRisks: {
        critical: [{
          title: "Parse Error",
          description: "Could not parse AI response into structured format",
          mitigation: "Review the full analysis text below for insights"
        }],
        warnings: [],
        recommendations: ["Review the full analysis text for planning insights"]
      },
      balanceMetrics: {
        workloadBalance: { score: 0, assessment: "Not available" },
        skillCoverage: { score: 0, assessment: "Not available" },
        dependencyRisk: { score: 0, assessment: "Not available" },
        overallBalance: { score: 0, assessment: "Not available" }
      },
      alternativePlans: [],
      actionableSteps: [
        "Review the full analysis text for planning insights",
        "Consider manual sprint planning based on the analysis"
      ],
      fullAnalysisText: text
    };
  }
}
