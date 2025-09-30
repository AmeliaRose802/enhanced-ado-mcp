/**
 * Work Item Intelligence Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { WorkItemIntelligenceArgs, AnalysisResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../helpers/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../helpers/response-builder.js';
import { extractJSON } from '../helpers/json-parser.js';
import { formatForAI } from '../helpers/sampling-formatters.js';
import { executeTool } from '../tool-service.js';

export class WorkItemIntelligenceAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: WorkItemIntelligenceArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting work item intelligence analysis for: ${args.Title}`);

    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const analysisResult = await this.performAnalysis(args);

      if (args.EnhanceDescription && args.CreateInADO && analysisResult.enhancedDescription) {
        try {
          const createResult = await this.createEnhancedWorkItem(args, analysisResult);
          analysisResult.recommendations.push(`✅ Enhanced work item created: ${createResult}`);
        } catch (error) {
          analysisResult.recommendations.push(`❌ Failed to create enhanced work item: ${error}`);
        }
      }

      return buildSuccessResponse(analysisResult, { 
        source: 'ai-sampling', 
        analysisType: args.AnalysisType 
      });

    } catch (error) {
      return buildErrorResponse(`AI sampling analysis failed: ${error}`, { source: 'ai-sampling-failed' });
    }
  }

  private async performAnalysis(args: WorkItemIntelligenceArgs): Promise<AnalysisResult> {
    const analysisType = args.AnalysisType || 'full';
    const systemPromptName = `${analysisType}-analyzer`;
    const userContent = formatForAI(args);

    const aiResult = await this.samplingClient.createMessage({
      systemPromptName,
      userContent,
      maxTokens: this.getMaxTokens(analysisType),
      temperature: this.getTemperature(analysisType)
    });

    return this.parseAnalysisResponse(aiResult, analysisType);
  }

  private getMaxTokens(analysisType: string): number {
    const tokens: Record<string, number> = {
      'completeness': 300,
      'ai-readiness': 250,
      'enhancement': 400,
      'categorization': 200,
      'full': 500
    };
    return tokens[analysisType] || 500;
  }

  private getTemperature(analysisType: string): number {
    const temps: Record<string, number> = {
      'completeness': 0.3,
      'ai-readiness': 0.2,
      'enhancement': 0.5,
      'categorization': 0.4,
      'full': 0.4
    };
    return temps[analysisType] || 0.3;
  }

  private parseAnalysisResponse(aiResult: any, analysisType: string): AnalysisResult {
    const responseText = this.samplingClient.extractResponseText(aiResult);
    logger.debug(`Parsing AI response for ${analysisType}:`, responseText.substring(0, 200) + '...');
    const jsonData = extractJSON(responseText);
    
    // If we successfully parsed JSON, use it directly with minimal processing
    if (jsonData) {
      return {
        completenessScore: jsonData.overallScore || jsonData.completeness?.overallScore || 5,
        aiReadinessScore: jsonData.aiReadiness?.overallScore || jsonData.overallScore || 5,
        category: jsonData.category || jsonData.categorization?.category || "General",
        priority: jsonData.priority || jsonData.suggestedPriority || jsonData.categorization?.priority || "Medium",
        complexity: jsonData.complexity || jsonData.suggestedComplexity || jsonData.categorization?.complexity || "Medium",
        assignmentSuggestion: jsonData.decision || jsonData.assignment || jsonData.categorization?.assignment,
        recommendations: jsonData.recommendations || jsonData.suggestions || [],
        missingElements: jsonData.missing || jsonData.missingInfo || [],
        strengths: jsonData.strengths || [],
        improvementAreas: [],
        rawAnalysis: jsonData  // Include full JSON for intelligent agent to interpret
      };
    }
    
    throw new Error('Failed to parse AI response as JSON');
  }

  private async createEnhancedWorkItem(args: WorkItemIntelligenceArgs, analysis: AnalysisResult): Promise<string> {
    if (!analysis.enhancedDescription) {
      throw new Error("No enhanced description available");
    }

    const createArgs = {
      Title: args.Title,
      Description: analysis.enhancedDescription,
      WorkItemType: args.WorkItemType || "Task",
      ParentWorkItemId: args.ParentWorkItemId,
      Organization: args.Organization,
      Project: args.Project,
      Tags: "AI-Enhanced,Intelligence-Analyzed"
    };

    const result = await executeTool("wit-create-new-item", createArgs);
    
    if (!result.success) {
      throw new Error(`Failed to create work item: ${result.errors?.join(', ')}`);
    }

    return `Work item created successfully (ID: ${result.data?.id || 'unknown'})`;
  }
}
