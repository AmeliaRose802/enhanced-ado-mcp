/**
 * Main Sampling Service - Simple orchestration layer
 */

import type { ToolExecutionResult } from '../types/index.js';
import type { MCPServer, MCPServerLike } from '../types/mcp.js';
import type { 
  WorkItemIntelligenceArgs,
  AIAssignmentAnalyzerArgs,
  PersonalWorkloadAnalyzerArgs,
  SprintPlanningAnalyzerArgs
} from '../types/analysis.js';

import { WorkItemIntelligenceAnalyzer } from './analyzers/work-item-intelligence.js';
import { AIAssignmentAnalyzer } from './analyzers/ai-assignment.js';
import { PersonalWorkloadAnalyzer } from './analyzers/personal-workload.js';
import { SprintPlanningAnalyzer } from './analyzers/sprint-planner.js';
import { ToolDiscoveryAnalyzer, type ToolDiscoveryArgs } from './analyzers/tool-discovery.js';

export class SamplingService {
  private workItemAnalyzer: WorkItemIntelligenceAnalyzer;
  private aiAssignmentAnalyzer: AIAssignmentAnalyzer;
  private personalWorkloadAnalyzer: PersonalWorkloadAnalyzer;
  private sprintPlanningAnalyzer: SprintPlanningAnalyzer;
  private toolDiscoveryAnalyzer: ToolDiscoveryAnalyzer;
  
  constructor(private server: MCPServer | MCPServerLike) {
    this.workItemAnalyzer = new WorkItemIntelligenceAnalyzer(server);
    this.aiAssignmentAnalyzer = new AIAssignmentAnalyzer(server);
    this.personalWorkloadAnalyzer = new PersonalWorkloadAnalyzer(server);
    this.sprintPlanningAnalyzer = new SprintPlanningAnalyzer(server);
    this.toolDiscoveryAnalyzer = new ToolDiscoveryAnalyzer(server);
  }

  getServer(): MCPServer | MCPServerLike {
    return this.server;
  }

  async analyzeWorkItem(args: WorkItemIntelligenceArgs): Promise<ToolExecutionResult> {
    return this.workItemAnalyzer.analyze(args);
  }

  async analyzeAIAssignment(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    return this.aiAssignmentAnalyzer.analyze(args);
  }

  async analyzePersonalWorkload(args: PersonalWorkloadAnalyzerArgs): Promise<ToolExecutionResult> {
    return this.personalWorkloadAnalyzer.analyze(args);
  }

  async analyzeSprintPlanning(args: SprintPlanningAnalyzerArgs): Promise<ToolExecutionResult> {
    return this.sprintPlanningAnalyzer.analyze(args);
  }

  async discoverTools(args: ToolDiscoveryArgs): Promise<ToolExecutionResult> {
    return this.toolDiscoveryAnalyzer.discover(args);
  }
}

export type { 
  WorkItemIntelligenceArgs,
  AIAssignmentAnalyzerArgs,
  PersonalWorkloadAnalyzerArgs,
  SprintPlanningAnalyzerArgs
} from '../types/analysis.js';
export type { ToolDiscoveryArgs } from './analyzers/tool-discovery.js';
