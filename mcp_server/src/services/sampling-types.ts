/**
 * Type definitions for sampling service
 * 
 * @deprecated This file is kept for backward compatibility.
 * All types have been moved to ../types/analysis.ts
 * Please import from '../types/analysis.js' instead.
 */

// Re-export all analysis types from the new location
export type {
  WorkItemIntelligenceArgs,
  AnalysisResult,
  AIAssignmentAnalyzerArgs,
  AIAssignmentResult,
  PersonalWorkloadAnalyzerArgs,
  PersonalWorkloadAnalysisResult,
  FeatureDecomposerArgs,
  DecomposedWorkItem,
  FeatureDecompositionResult,
  HierarchyValidatorArgs,
  WorkItemHierarchyInfo,
  ParentingSuggestion,
  HierarchyValidationIssue,
  HierarchyValidationResult,
  SprintPlanningAnalyzerArgs,
  TeamMemberAssignment,
  SprintPlanningResult,
} from '../types/analysis.js';
