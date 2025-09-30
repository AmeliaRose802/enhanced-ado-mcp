import type { ToolExecutionResult } from '../../types/index.js';
import type { AIAssignmentAnalyzerArgs, AIAssignmentResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';

export class AIAssignmentAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const result = await this.performAnalysis(args);
      return buildSuccessResponse(result, { source: 'ai-assignment-analysis' });
    } catch (error) {
      return buildErrorResponse(`AI assignment analysis failed: ${error}`, { source: 'ai-assignment-failed' });
    }
  }

  private async performAnalysis(args: AIAssignmentAnalyzerArgs): Promise<AIAssignmentResult> {
    const aiResult = await this.samplingClient.createMessage({
      systemPromptName: 'ai-assignment-analyzer',
      userContent: formatForAI(args),
      maxTokens: 400,
      temperature: 0.2
    });
    return this.parseResponse(aiResult);
  }

  private parseResponse(aiResult: any): AIAssignmentResult {
    const text = this.samplingClient.extractResponseText(aiResult);
    const json = extractJSON(text);
    
    if (!json) {
      throw new Error('Failed to parse AI response as JSON');
    }
    
    return this.buildResultFromJSON(json);
  }

  private buildResultFromJSON(json: any): AIAssignmentResult {
    if (!json.decision) {
      throw new Error('AI response missing required field: decision');
    }

    return {
      decision: json.decision,
      confidence: json.confidence ?? 0.5,
      riskScore: json.riskScore ?? 50,
      primaryReasons: json.reasons ?? json.primaryReasons ?? [],
      missingInfo: json.missingInfo ?? [],
      recommendedNextSteps: json.nextSteps ?? json.recommendedNextSteps ?? [],
      estimatedScope: {
        files: {
          min: json.scope?.filesMin ?? json.estimatedScope?.files?.min ?? 1,
          max: json.scope?.filesMax ?? json.estimatedScope?.files?.max ?? 5
        },
        complexity: json.scope?.complexity ?? json.estimatedScope?.complexity ?? "medium"
      },
      guardrails: {
        testsRequired: json.guardrails?.testsRequired ?? false,
        featureFlagOrToggle: json.guardrails?.featureFlag ?? json.guardrails?.featureFlagOrToggle ?? false,
        touchSensitiveAreas: json.guardrails?.touchesSensitive ?? json.guardrails?.touchSensitiveAreas ?? false,
        needsCodeReviewFromOwner: json.guardrails?.needsReview ?? json.guardrails?.needsCodeReviewFromOwner ?? false
      }
    };
  }
}
