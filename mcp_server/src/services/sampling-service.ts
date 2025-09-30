/**
 * Main Sampling Service - Simple orchestration layer
 */

import type { ToolExecutionResult } from '../types/index.js';
import type { 
  WorkItemIntelligenceArgs,
  AIAssignmentAnalyzerArgs,
  FeatureDecomposerArgs,
  HierarchyValidatorArgs
} from './sampling-types.js';

import { WorkItemIntelligenceAnalyzer } from './analyzers/work-item-intelligence.js';
import { AIAssignmentAnalyzer } from './analyzers/ai-assignment.js';
import { buildErrorResponse } from './helpers/response-builder.js';
import { logger } from '../utils/logger.js';

export class SamplingService {
  private workItemAnalyzer: WorkItemIntelligenceAnalyzer;
  private aiAssignmentAnalyzer: AIAssignmentAnalyzer;
  
  constructor(private server: any) {
    this.workItemAnalyzer = new WorkItemIntelligenceAnalyzer(server);
    this.aiAssignmentAnalyzer = new AIAssignmentAnalyzer(server);
  }

  async analyzeWorkItem(args: WorkItemIntelligenceArgs): Promise<ToolExecutionResult> {
    return this.workItemAnalyzer.analyze(args);
  }

  async analyzeAIAssignment(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    return this.aiAssignmentAnalyzer.analyze(args);
  }

  async decomposeFeature(args: FeatureDecomposerArgs): Promise<ToolExecutionResult> {
    logger.warn('Feature decomposer not yet migrated to new architecture');
    return buildErrorResponse('Feature decomposer temporarily unavailable during refactoring');
  }

  async validateHierarchy(args: HierarchyValidatorArgs): Promise<ToolExecutionResult> {
    logger.warn('Hierarchy validator not yet migrated to new architecture');
    return buildErrorResponse('Hierarchy validator temporarily unavailable during refactoring');
  }
}

export * from './sampling-types.js';
