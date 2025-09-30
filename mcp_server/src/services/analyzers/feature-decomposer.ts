/**
 * Feature Decomposer Analyzer
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { FeatureDecomposerArgs, FeatureDecompositionResult, DecomposedWorkItem } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../helpers/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../helpers/response-builder.js';
import { formatFeatureForDecomposition, buildItemTags } from '../sampling-formatters.js';
import { executeTool } from '../tool-service.js';

export class FeatureDecomposerAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: FeatureDecomposerArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting feature decomposition for: ${args.Title}`);

    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      const decompositionResult = await this.performDecomposition(args);

      // Auto-create work items if requested
      if (args.AutoCreateWorkItems) {
        try {
          const createdIds = await this.createWorkItems(args, decompositionResult);
          decompositionResult.createdWorkItemIds = createdIds;
          logger.info(`Created ${createdIds.length} work items from decomposition`);
        } catch (error) {
          logger.error(`Failed to create work items: ${error}`);
          return buildErrorResponse(`Decomposition succeeded but work item creation failed: ${error}`);
        }
      }

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
    const userContent = formatFeatureForDecomposition(args);

    const aiResult = await this.samplingClient.createMessage({
      systemPromptName,
      userContent,
      maxTokens: 1500,
      temperature: 0.4
    });

    return this.parseDecompositionResponse(aiResult, args);
  }

  private parseDecompositionResponse(aiResult: any, args: FeatureDecomposerArgs): FeatureDecompositionResult {
    const responseText = this.samplingClient.extractResponseText(aiResult);
    logger.debug(`Parsing feature decomposition response:`, responseText.substring(0, 200) + '...');
    
    // Try to extract JSON from response
    let jsonData: any = null;
    try {
      // First try: parse directly
      jsonData = JSON.parse(responseText);
    } catch {
      // Second try: extract JSON from markdown code block
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[1]);
        } catch (e) {
          logger.warn(`Failed to parse JSON from code block: ${e}`);
        }
      }
      
      // Third try: find any JSON object in the text
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
    
    // If we successfully parsed JSON, use it directly
    if (jsonData && jsonData.items && Array.isArray(jsonData.items)) {
      const suggestedItems: DecomposedWorkItem[] = jsonData.items.map((item: any) => ({
        title: item.title || 'Untitled Work Item',
        description: item.description || item.title || 'No description provided',
        acceptanceCriteria: item.acceptanceCriteria || [],
        estimatedEffort: item.effort || 'M',
        complexity: this.normalizeComplexity(item.complexity),
        aiSuitability: this.normalizeAISuitability(item.aiSuitability),
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
    
    // Fallback: if JSON parsing failed, return error-like result with raw response
    logger.warn(`Failed to parse JSON response for feature decomposition`);
    return {
      originalFeature: {
        title: args.Title,
        summary: args.Description || 'Feature decomposition requested'
      },
      decompositionStrategy: '⚠️ Parsing failed - raw AI response included',
      suggestedItems: [{
        title: `${args.Title} - Manual Review Required`,
        description: `AI decomposition failed to parse. Raw response:\n\n${responseText.substring(0, 500)}`,
        estimatedEffort: 'M',
        complexity: 'medium',
        reasoning: 'Parsing failed - manual review needed',
        acceptanceCriteria: ['Review AI response', 'Manually decompose feature']
      }],
      implementationOrder: [0],
      overallComplexity: args.TargetComplexity || 'medium',
      estimatedTotalEffort: 'Unknown',
      riskFactors: ['AI parsing failed'],
      dependencies: [],
      qualityConsiderations: []
    };
  }

  private normalizeComplexity(complexity: string | undefined): "simple" | "medium" | "complex" {
    if (!complexity) return "medium";
    const normalized = complexity.toLowerCase();
    if (normalized === 'simple' || normalized === 'trivial') return 'simple';
    if (normalized === 'complex' || normalized === 'difficult' || normalized === 'expert') return 'complex';
    return 'medium';
  }

  private normalizeAISuitability(suitability: string | undefined): "AI_FIT" | "HUMAN_FIT" | "HYBRID" | undefined {
    if (!suitability) return undefined;
    const normalized = suitability.toUpperCase();
    if (normalized.includes('AI_FIT') || normalized.includes('AI-SUITABLE')) return 'AI_FIT';
    if (normalized.includes('HUMAN_FIT') || normalized.includes('HUMAN-REQUIRED')) return 'HUMAN_FIT';
    if (normalized.includes('HYBRID')) return 'HYBRID';
    return undefined;
  }

  private async createWorkItems(args: FeatureDecomposerArgs, result: FeatureDecompositionResult): Promise<number[]> {
    const createdIds: number[] = [];

    for (const item of result.suggestedItems) {
      try {
        const createArgs = {
          Title: item.title,
          Description: item.description,
          WorkItemType: args.WorkItemType || 'Task',
          ParentWorkItemId: args.ParentWorkItemId,
          Organization: args.Organization,
          Project: args.Project,
          AreaPath: args.AreaPath,
          IterationPath: args.IterationPath,
          Tags: buildItemTags(args.Tags, item),
          AcceptanceCriteria: item.acceptanceCriteria?.join('\n')
        };

        const createResult = await executeTool('wit-create-new-item', createArgs);
        
        if (createResult.success && createResult.data?.id) {
          createdIds.push(createResult.data.id);
          logger.info(`Created work item ${createResult.data.id}: ${item.title}`);

          // Auto-assign AI-suitable items if requested
          if (args.AutoAssignAISuitable && item.aiSuitability === 'AI_FIT') {
            try {
              await this.assignToAI(createResult.data.id, args);
            } catch (assignError) {
              logger.warn(`Failed to assign work item ${createResult.data.id} to AI: ${assignError}`);
            }
          }
        } else {
          logger.warn(`Failed to create work item "${item.title}": ${createResult.errors?.join(', ')}`);
        }
      } catch (error) {
        logger.error(`Error creating work item "${item.title}": ${error}`);
      }
    }

    return createdIds;
  }

  private async assignToAI(workItemId: number, args: FeatureDecomposerArgs): Promise<void> {
    // This would call the assign-to-copilot script if available
    // For now, just log the intent
    logger.info(`Would assign work item ${workItemId} to AI/Copilot`);
    // TODO: Implement actual assignment logic when script is available
  }
}
