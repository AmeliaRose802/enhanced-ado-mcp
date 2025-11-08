/**
 * Work Item Intelligence Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { WorkItemIntelligenceArgs, AnalysisResult } from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, getStringOrDefault, getNumberOrDefault, getArrayOfStrings, getNestedValue, formatForAI } from '../../utils/ai-helpers.js';
import { executeTool } from '../tool-service.js';

export class WorkItemIntelligenceAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
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
    const userContent = formatForAI(args as unknown as Record<string, unknown>);

    // Add timeout wrapper to prevent hanging
    const timeoutMs = 90000; // 90 seconds (1.5 minutes)
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName,
      userContent,
      maxTokens: this.getMaxTokens(analysisType),
      temperature: this.getTemperature(analysisType)
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Work item intelligence analysis (${analysisType}) exceeded 90 second timeout. ` +
          'The AI model may be overloaded. Try again in a moment or use a simpler AnalysisType.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);

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

  private parseAnalysisResponse(aiResult: unknown, analysisType: string): AnalysisResult {
    const responseText = this.samplingClient.extractResponseText(aiResult as { content: { text: string } });
    logger.debug(`Parsing AI response for ${analysisType}:`, responseText.substring(0, 200) + '...');
    const jsonData = extractJSON(responseText);
    
    // If we successfully parsed JSON, use it directly with minimal processing
    if (jsonData) {
      return {
        completenessScore: getNumberOrDefault(
          jsonData.overallScore || getNestedValue(jsonData, ['completeness', 'overallScore']),
          5
        ),
        aiReadinessScore: getNumberOrDefault(
          getNestedValue(jsonData, ['aiReadiness', 'overallScore']) || jsonData.overallScore,
          5
        ),
        outOf: 10,  // All scores are out of 10
        category: getStringOrDefault(
          jsonData.category || getNestedValue(jsonData, ['categorization', 'category']),
          'General'
        ),
        priority: getStringOrDefault(
          jsonData.priority || jsonData.suggestedPriority || getNestedValue(jsonData, ['categorization', 'priority']),
          'Medium'
        ) as 'High' | 'Low' | 'Medium' | 'Critical',
        complexity: getStringOrDefault(
          jsonData.complexity || jsonData.suggestedComplexity || getNestedValue(jsonData, ['categorization', 'complexity']),
          'Medium'
        ) as 'Medium' | 'Simple' | 'Complex' | 'Expert',
        assignmentSuggestion: ((): 'AI' | 'Human' | 'Hybrid' => {
          const value = getStringOrDefault(
            jsonData.decision || jsonData.assignment || getNestedValue(jsonData, ['categorization', 'assignment']),
            'Human'
          );
          if (value === 'AI' || value === 'Human' || value === 'Hybrid') {
            return value;
          }
          return 'Human';
        })(),
        recommendations: getArrayOfStrings(jsonData.recommendations || jsonData.suggestions),
        missingElements: getArrayOfStrings(jsonData.missing || jsonData.missingInfo),
        strengths: getArrayOfStrings(jsonData.strengths),
        improvementAreas: [],
        rawAnalysis: jsonData as Record<string, string | number | boolean | null>
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

    // Type guard for work item result
    const workItemId = (result.data as { id?: number })?.id || 'unknown';
    return `Work item created successfully (ID: ${workItemId})`;
  }
}
