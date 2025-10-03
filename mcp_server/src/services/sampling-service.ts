/**
 * Main Sampling Service - Simple orchestration layer
 */

import type { ToolExecutionResult } from '../types/index.js';
import type { 
  WorkItemIntelligenceArgs,
  AIAssignmentAnalyzerArgs
} from './sampling-types.js';

import { WorkItemIntelligenceAnalyzer } from './analyzers/work-item-intelligence.js';
import { AIAssignmentAnalyzer } from './analyzers/ai-assignment.js';

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
}

export * from './sampling-types.js';
