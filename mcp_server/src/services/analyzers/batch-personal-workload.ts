import type { ToolExecutionResult } from '../../types/index.js';
import type { BatchPersonalWorkloadAnalyzerArgs, BatchPersonalWorkloadAnalysisResult, PersonalWorkloadAnalysisResult } from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger } from '../../utils/logger.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { PersonalWorkloadAnalyzer } from './personal-workload.js';

/**
 * Batch Personal Workload Analyzer
 * Processes multiple team members in parallel for efficient team health analysis
 */
export class BatchPersonalWorkloadAnalyzer {
  private workloadAnalyzer: PersonalWorkloadAnalyzer;
  private samplingAvailable: boolean;

  constructor(server: MCPServer | MCPServerLike) {
    this.workloadAnalyzer = new PersonalWorkloadAnalyzer(server);
    // Check if sampling is available by trying to access the sampling client
    this.samplingAvailable = true; // Will be validated during analysis
  }

  async analyze(args: BatchPersonalWorkloadAnalyzerArgs): Promise<ToolExecutionResult> {
    try {
      logger.info(`Starting batch workload analysis for ${args.assignedToEmails.length} team members`);
      
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
      const analysisPeriodDays = args.analysisPeriodDays || 90;
      startDate.setDate(startDate.getDate() - analysisPeriodDays);

      // Process team members with controlled concurrency
      const maxConcurrency = args.maxConcurrency || 5;
      const continueOnError = args.continueOnError !== false; // Default true
      
      logger.debug(`Processing with max concurrency: ${maxConcurrency}, continueOnError: ${continueOnError}`);

      // Process in batches
      for (let i = 0; i < args.assignedToEmails.length; i += maxConcurrency) {
        const batch = args.assignedToEmails.slice(i, i + maxConcurrency);
        logger.debug(`Processing batch ${Math.floor(i / maxConcurrency) + 1}: ${batch.join(', ')}`);

        const batchPromises = batch.map(async (email) => {
          try {
            logger.debug(`Analyzing workload for ${email}`);
            const result = await this.workloadAnalyzer.analyze({
              assignedToEmail: email,
              analysisPeriodDays: args.analysisPeriodDays,
              additionalIntent: args.additionalIntent,
              organization: args.organization,
              project: args.project,
              areaPath: args.areaPath
            });

            if (result.success && result.data) {
              logger.debug(`Successfully analyzed ${email}`);
              // Type assertion is safe because we know PersonalWorkloadAnalyzer.analyze returns PersonalWorkloadAnalysisResult
              const analysis = result.data;
              return {
                email,
                success: true,
                analysis: analysis as any as PersonalWorkloadAnalysisResult
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
            logger.error(`Error analyzing ${email}:`, error);
            
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

      const batchResult: BatchPersonalWorkloadAnalysisResult = {
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
      logger.error('Batch personal workload analysis failed:', error);
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
