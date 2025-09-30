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
import { FeatureDecomposerAnalyzer } from './analyzers/feature-decomposer.js';
import { HierarchyValidatorAnalyzer } from './analyzers/hierarchy-validator.js';
import { logger } from '../utils/logger.js';

export class SamplingService {
  private workItemAnalyzer: WorkItemIntelligenceAnalyzer;
  private aiAssignmentAnalyzer: AIAssignmentAnalyzer;
  private featureDecomposerAnalyzer: FeatureDecomposerAnalyzer;
  private hierarchyValidatorAnalyzer: HierarchyValidatorAnalyzer;
  
  constructor(private server: any) {
    this.workItemAnalyzer = new WorkItemIntelligenceAnalyzer(server);
    this.aiAssignmentAnalyzer = new AIAssignmentAnalyzer(server);
    this.featureDecomposerAnalyzer = new FeatureDecomposerAnalyzer(server);
    this.hierarchyValidatorAnalyzer = new HierarchyValidatorAnalyzer(server);
  }

  async analyzeWorkItem(args: WorkItemIntelligenceArgs): Promise<ToolExecutionResult> {
    return this.workItemAnalyzer.analyze(args);
  }

  async analyzeAIAssignment(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    return this.aiAssignmentAnalyzer.analyze(args);
  }

  async decomposeFeature(args: FeatureDecomposerArgs): Promise<ToolExecutionResult> {
    return this.featureDecomposerAnalyzer.analyze(args);
  }

  async validateHierarchy(args: HierarchyValidatorArgs): Promise<ToolExecutionResult> {
    return this.hierarchyValidatorAnalyzer.analyze(args);
  }
}

export * from './sampling-types.js';
