/**
 * Feature Decomposer Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { FeatureDecomposerArgs, FeatureDecompositionResult, DecomposedWorkItem } from '../sampling-types.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';

export class FeatureDecomposerAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: FeatureDecomposerArgs): Promise<ToolExecutionResult> {
    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const decompositionResult = await this.performDecomposition(args);
      return buildSuccessResponse(decompositionResult, { 
        source: 'ai-sampling', 
        featureTitle: args.Title,
        itemCount: decompositionResult.suggestedItems.length
      });
    } catch (error) {
      return buildErrorResponse(`Feature decomposition failed: ${error}`, { source: 'ai-sampling-failed' });
    }
  }

  private async performDecomposition(args: FeatureDecomposerArgs): Promise<FeatureDecompositionResult> {
    const systemPromptName = 'feature-decomposer';
    const userContent = formatForAI(args);

    // Add timeout wrapper to prevent hanging
    const timeoutMs = 180000; // 180 seconds (3 minutes)
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName,
      userContent,
      maxTokens: 1500,
      temperature: 0.4
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI sampling timeout after 180 seconds')), timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);

    return this.parseDecompositionResponse(aiResult, args);
  }

  private parseDecompositionResponse(aiResult: any, args: FeatureDecomposerArgs): FeatureDecompositionResult {
    const responseText = this.samplingClient.extractResponseText(aiResult);
    const jsonData = extractJSON(responseText);
    
    if (jsonData && jsonData.items && Array.isArray(jsonData.items)) {
      const suggestedItems: DecomposedWorkItem[] = jsonData.items.map((item: any) => ({
        title: item.title || 'Untitled Work Item',
        description: item.description || item.title || 'No description provided',
        acceptanceCriteria: item.acceptanceCriteria || [],
        estimatedEffort: item.effort || 'M',
        complexity: item.complexity,
        aiSuitability: item.aiSuitability,
        confidence: item.confidence,
        riskScore: item.riskScore,
        reasoning: item.reasoning || item.technicalNotes || 'Generated from feature decomposition',
        dependencies: item.dependencies || [],
        technicalNotes: item.technicalNotes,
        testingStrategy: item.testingStrategy
      }));

      // Calculate assignment summary
      const assignmentSummary = {
        aiSuitableCount: suggestedItems.filter(i => i.aiSuitability === 'AI_FIT').length,
        humanRequiredCount: suggestedItems.filter(i => i.aiSuitability === 'HUMAN_FIT').length,
        hybridCount: suggestedItems.filter(i => i.aiSuitability === 'HYBRID').length
      };

      return {
        originalFeature: {
          title: args.Title,
          summary: args.Description || 'Feature decomposition requested'
        },
        decompositionStrategy: jsonData.strategy || 'Decomposition analysis completed',
        suggestedItems,
        implementationOrder: jsonData.implementationOrder || suggestedItems.map((_, idx) => idx),
        overallComplexity: jsonData.overallComplexity || args.TargetComplexity || 'medium',
        estimatedTotalEffort: jsonData.totalEffort || 'Medium',
        riskFactors: jsonData.risks || [],
        dependencies: jsonData.dependencies || [],
        qualityConsiderations: jsonData.qualityConsiderations || [],
        assignmentSummary
      };
    }
    
    throw new Error('Failed to parse AI response as JSON or missing required fields');
  }
}
