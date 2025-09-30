/**
 * AI Assignment Suitability Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { AIAssignmentAnalyzerArgs, AIAssignmentResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../helpers/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../helpers/response-builder.js';
import { formatWorkItemForAIAnalysis } from '../sampling-formatters.js';
import { extractConfidence, extractNumber, extractFileRange, containsKeyword } from '../helpers/text-extraction.js';

export class AIAssignmentAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting AI assignment analysis for: ${args.Title}`);

    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const analysisResult = await this.performAnalysis(args);

      if (analysisResult.decision === "AI_FIT") {
        analysisResult.recommendedNextSteps.push(
          `✅ Work item is suitable for AI assignment. Use the 'wit-assign-to-copilot' tool to assign it to GitHub Copilot.`
        );
      }

      return buildSuccessResponse(analysisResult, { source: 'ai-assignment-analysis' });

    } catch (error) {
      return buildErrorResponse(`AI assignment analysis failed: ${error}`, { source: 'ai-assignment-failed' });
    }
  }

  private async performAnalysis(args: AIAssignmentAnalyzerArgs): Promise<AIAssignmentResult> {
    const userContent = formatWorkItemForAIAnalysis(args);
    
    const aiResult = await this.samplingClient.createMessage({
      systemPromptName: 'ai-assignment-analyzer',
      userContent,
      maxTokens: 400,
      temperature: 0.2
    });

    return this.parseResponse(aiResult);
  }

  private parseResponse(aiResult: any): AIAssignmentResult {
    const responseText = this.samplingClient.extractResponseText(aiResult);
    logger.debug(`Parsing AI assignment response:`, responseText.substring(0, 200) + '...');
    
    let decision: "AI_FIT" | "HUMAN_FIT" | "HYBRID" = "HUMAN_FIT";
    if (containsKeyword(responseText, ['ai_fit', 'ai-fit'])) decision = "AI_FIT";
    else if (containsKeyword(responseText, ['hybrid'])) decision = "HYBRID";
    
    const confidence = extractConfidence(responseText);
    const riskScore = extractNumber(responseText, 'risk');
    const { min: minFiles, max: maxFiles } = extractFileRange(responseText);
    
    let complexity: "trivial" | "low" | "medium" | "high" = "medium";
    if (containsKeyword(responseText, ['trivial'])) complexity = "trivial";
    else if (containsKeyword(responseText, ['low complexity'])) complexity = "low";
    else if (containsKeyword(responseText, ['high complexity'])) complexity = "high";
    
    const guardrails = {
      testsRequired: containsKeyword(responseText, ['tests required', 'testing needed']),
      featureFlagOrToggle: containsKeyword(responseText, ['feature flag', 'toggle']),
      touchSensitiveAreas: containsKeyword(responseText, ['sensitive', 'critical']),
      needsCodeReviewFromOwner: containsKeyword(responseText, ['code review', 'domain expert'])
    };
    
    return {
      decision,
      confidence,
      riskScore,
      primaryReasons: [responseText],
      missingInfo: [],
      recommendedNextSteps: [],
      estimatedScope: {
        files: { min: minFiles, max: maxFiles },
        complexity
      },
      guardrails,
      assignmentStrategy: this.generateStrategy(decision, confidence, riskScore)
    };
  }

  private generateStrategy(decision: string, confidence: number, riskScore: number): string {
    if (decision === "AI_FIT" && confidence > 0.7 && riskScore < 40) {
      return "✅ Ready for GitHub Copilot assignment. Well-defined task with low risk.";
    } else if (decision === "AI_FIT" && riskScore >= 40) {
      return "⚠️ AI-suitable but requires careful monitoring due to risk factors.";
    } else if (decision === "HYBRID") {
      return "🔄 Hybrid approach: Break down into AI-suitable subtasks with human oversight.";
    }
    return "👤 Human assignment recommended. Requires domain expertise or stakeholder interaction.";
  }
}
