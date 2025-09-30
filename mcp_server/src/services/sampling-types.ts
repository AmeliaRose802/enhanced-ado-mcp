/**
 * Type definitions for sampling service
 */

export interface WorkItemIntelligenceArgs {
  Title: string;
  Description?: string;
  WorkItemType?: string;
  AcceptanceCriteria?: string;
  AnalysisType?: "completeness" | "ai-readiness" | "enhancement" | "categorization" | "full";
  ContextInfo?: string;
  EnhanceDescription?: boolean;
  CreateInADO?: boolean;
  ParentWorkItemId?: number;
  Organization?: string;
  Project?: string;
}

export interface AIAssignmentAnalyzerArgs {
  Title: string;
  Description?: string;
  WorkItemType?: string;
  AcceptanceCriteria?: string;
  Priority?: string;
  Labels?: string;
  EstimatedFiles?: string;
  TechnicalContext?: string;
  ExternalDependencies?: string;
  TimeConstraints?: string;
  RiskFactors?: string;
  TestingRequirements?: string;
  Organization?: string;
  Project?: string;
}

export interface FeatureDecomposerArgs {
  Title: string;
  Description?: string;
  ParentWorkItemId?: number;
  WorkItemType?: string;
  TargetComplexity?: "simple" | "medium";
  MaxItems?: number;
  TechnicalContext?: string;
  BusinessContext?: string;
  ExistingComponents?: string;
  Dependencies?: string;
  TimeConstraints?: string;
  QualityRequirements?: string;
  GenerateAcceptanceCriteria?: boolean;
  AnalyzeAISuitability?: boolean;
  AutoCreateWorkItems?: boolean;
  AutoAssignAISuitable?: boolean;
  Organization?: string;
  Project?: string;
  AreaPath?: string;
  IterationPath?: string;
  Tags?: string;
}

export interface HierarchyValidatorArgs {
  WorkItemIds?: number[];
  AreaPath?: string;
  IncludeChildAreas?: boolean;
  MaxItemsToAnalyze?: number;
  AnalysisDepth?: "shallow" | "deep";
  SuggestAlternatives?: boolean;
  IncludeConfidenceScores?: boolean;
  FilterByWorkItemType?: string[];
  ExcludeStates?: string[];
  Organization?: string;
  Project?: string;
}

export interface AnalysisResult {
  completenessScore: number;
  aiReadinessScore: number;
  category: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  complexity: "Simple" | "Medium" | "Complex" | "Expert";
  assignmentSuggestion: "AI" | "Human" | "Hybrid";
  recommendations: string[];
  enhancedDescription?: string;
  missingElements: string[];
  strengths: string[];
  improvementAreas: string[];
  rawAnalysis?: any;  // Full JSON response from AI for intelligent agent interpretation
}

export interface AIAssignmentResult {
  decision: "AI_FIT" | "HUMAN_FIT" | "HYBRID";
  confidence: number;
  riskScore: number;
  primaryReasons: string[];
  missingInfo: string[];
  recommendedNextSteps: string[];
  estimatedScope: {
    files: { min: number; max: number };
    complexity: "trivial" | "low" | "medium" | "high";
  };
  guardrails: {
    testsRequired: boolean;
    featureFlagOrToggle: boolean;
    touchSensitiveAreas: boolean;
    needsCodeReviewFromOwner: boolean;
  };
  enhancedDescription?: string;
  assignmentStrategy?: string;
}

export interface DecomposedWorkItem {
  title: string;
  description: string;
  acceptanceCriteria?: string[];
  estimatedEffort: string;
  complexity: "simple" | "medium" | "complex";
  aiSuitability?: "AI_FIT" | "HUMAN_FIT" | "HYBRID";
  confidence?: number;
  riskScore?: number;
  reasoning: string;
  dependencies?: string[];
  technicalNotes?: string;
  testingStrategy?: string;
}

export interface FeatureDecompositionResult {
  originalFeature: {
    title: string;
    summary: string;
  };
  decompositionStrategy: string;
  suggestedItems: DecomposedWorkItem[];
  implementationOrder: number[];
  overallComplexity: "simple" | "medium" | "complex" | "expert";
  estimatedTotalEffort: string;
  riskFactors: string[];
  dependencies: string[];
  qualityConsiderations: string[];
  createdWorkItemIds?: number[];
  assignmentSummary?: {
    aiSuitableCount: number;
    humanRequiredCount: number;
    hybridCount: number;
  };
}

export interface WorkItemHierarchyInfo {
  id: number;
  title: string;
  type: string;
  state: string;
  currentParentId?: number;
  currentParentTitle?: string;
  areaPath: string;
  assignedTo?: string;
  description?: string;
}

export interface ParentingSuggestion {
  suggestedParentId: number;
  suggestedParentTitle: string;
  suggestedParentType: string;
  confidence: number;
  reasoning: string;
  benefits: string[];
  potentialIssues?: string[];
}

export interface HierarchyValidationIssue {
  issueType: "misparented" | "orphaned" | "incorrect_level" | "circular_dependency" | "type_mismatch";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendations: string[];
}

export interface HierarchyValidationResult {
  analysisContext: {
    analyzedItemCount: number;
    areaPath?: string;
    analysisDepth: string;
    timestamp: string;
  };
  workItemsAnalyzed: WorkItemHierarchyInfo[];
  issuesFound: Array<{
    workItemId: number;
    workItemTitle: string;
    issues: HierarchyValidationIssue[];
    parentingSuggestions: ParentingSuggestion[];
  }>;
  healthySummary: {
    totalAnalyzed: number;
    itemsWithIssues: number;
    itemsWellParented: number;
    orphanedItems: number;
    incorrectlyParented: number;
  };
  recommendations: {
    highPriorityActions: string[];
    improvementSuggestions: string[];
    bestPractices: string[];
  };
}
