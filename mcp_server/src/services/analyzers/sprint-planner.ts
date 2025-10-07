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
        additional_constraints: args.additionalConstraints || null,
        include_full_analysis: args.includeFullAnalysis ?? false,
        raw_analysis_on_error: args.rawAnalysisOnError ?? false
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
