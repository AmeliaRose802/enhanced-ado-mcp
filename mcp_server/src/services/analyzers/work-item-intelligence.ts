/**
 * Work Item Intelligence Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { WorkItemIntelligenceArgs, AnalysisResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../helpers/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../helpers/response-builder.js';
import { formatWorkItemForAnalysis } from '../sampling-formatters.js';
import { extractScore, containsKeyword } from '../helpers/text-extraction.js';
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
    const userContent = formatWorkItemForAnalysis(args);

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
    
    const completenessScore = extractScore(responseText, 'complete');
    const aiReadinessScore = extractScore(responseText, 'readiness|ai');
    
    let priority: "Low" | "Medium" | "High" | "Critical" = "Medium";
    if (containsKeyword(responseText, ['critical'])) priority = "Critical";
    else if (containsKeyword(responseText, ['high'])) priority = "High";
    else if (containsKeyword(responseText, ['low'])) priority = "Low";
    
    let complexity: "Simple" | "Medium" | "Complex" | "Expert" = "Medium";
    if (containsKeyword(responseText, ['simple', 'trivial'])) complexity = "Simple";
    else if (containsKeyword(responseText, ['complex'])) complexity = "Complex";
    else if (containsKeyword(responseText, ['expert'])) complexity = "Expert";
    
    let assignmentSuggestion: "AI" | "Human" | "Hybrid" = "Human";
    if (containsKeyword(responseText, ['ai-suitable', 'ai suitable'])) assignmentSuggestion = "AI";
    else if (containsKeyword(responseText, ['hybrid'])) assignmentSuggestion = "Hybrid";
    
    return {
      completenessScore,
      aiReadinessScore,
      category: "General",
      priority,
      complexity,
      assignmentSuggestion,
      recommendations: [`🤖 **AI Analysis (${analysisType.toUpperCase()})**:\n\n${responseText}\n\n`],
      missingElements: [],
      strengths: [],
      improvementAreas: []
    };
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
