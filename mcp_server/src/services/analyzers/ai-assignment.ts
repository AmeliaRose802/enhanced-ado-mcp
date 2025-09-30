/**
 * AI Assignment Suitability Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { AIAssignmentAnalyzerArgs, AIAssignmentResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../helpers/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../helpers/response-builder.js';
import { formatWorkItemForAIAnalysis } from '../sampling-formatters.js';

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
    
    // Try to extract JSON from response
    let jsonData: any = null;
    try {
      jsonData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[1]);
        } catch (e) {
          logger.warn(`Failed to parse JSON from code block: ${e}`);
        }
      }
      
      if (!jsonData) {
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          try {
            jsonData = JSON.parse(objectMatch[0]);
          } catch (e) {
            logger.warn(`Failed to parse extracted JSON object: ${e}`);
          }
        }
      }
    }
    
    // If JSON parsed successfully, use it
    if (jsonData) {
      const decision = this.normalizeDecision(jsonData.decision);
      const confidence = jsonData.confidence || 0.5;
      const riskScore = jsonData.riskScore || 50;
      
      return {
        decision,
        confidence,
        riskScore,
        primaryReasons: jsonData.reasons || jsonData.primaryReasons || [],
        missingInfo: jsonData.missingInfo || [],
        recommendedNextSteps: jsonData.nextSteps || jsonData.recommendedNextSteps || [],
        estimatedScope: {
          files: {
            min: jsonData.scope?.filesMin || jsonData.estimatedScope?.files?.min || 1,
            max: jsonData.scope?.filesMax || jsonData.estimatedScope?.files?.max || 5
          },
          complexity: jsonData.scope?.complexity || jsonData.estimatedScope?.complexity || "medium"
        },
        guardrails: {
          testsRequired: jsonData.guardrails?.testsRequired || false,
          featureFlagOrToggle: jsonData.guardrails?.featureFlag || jsonData.guardrails?.featureFlagOrToggle || false,
          touchSensitiveAreas: jsonData.guardrails?.touchesSensitive || jsonData.guardrails?.touchSensitiveAreas || false,
          needsCodeReviewFromOwner: jsonData.guardrails?.needsReview || jsonData.guardrails?.needsCodeReviewFromOwner || false
        }
      };
    }
    
    // Fallback: return conservative default with raw response
    logger.warn(`Failed to parse JSON response for AI assignment analysis`);
    return {
      decision: "HUMAN_FIT",
      confidence: 0.3,
      riskScore: 70,
      primaryReasons: [`⚠️ Parsing failed - raw response: ${responseText.substring(0, 200)}`],
      missingInfo: ["Unable to parse AI response"],
      recommendedNextSteps: ["Manual review required"],
      estimatedScope: {
        files: { min: 1, max: 10 },
        complexity: "medium"
      },
      guardrails: {
        testsRequired: true,
        featureFlagOrToggle: false,
        touchSensitiveAreas: true,
        needsCodeReviewFromOwner: true
      },
      assignmentStrategy: "👤 Manual review needed due to parsing failure"
    };
  }
  
  private normalizeDecision(decision: string | undefined): "AI_FIT" | "HUMAN_FIT" | "HYBRID" {
    if (!decision) return "HUMAN_FIT";
    const normalized = decision.toUpperCase();
    if (normalized.includes('AI_FIT') || normalized.includes('AI-FIT')) return "AI_FIT";
    if (normalized.includes('HYBRID')) return "HYBRID";
    return "HUMAN_FIT";
  }
}
