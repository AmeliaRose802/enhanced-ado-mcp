/**
 * AI-Powered Analysis Type Definitions
 * 
 * Comprehensive type definitions for AI-powered analysis features,
 * including work item intelligence, feature decomposition, hierarchy validation,
 * workload analysis, and sprint planning.
 * 
 * Previously located in services/sampling-types.ts - moved to types/ for better organization.
 */

import type { JSONValue } from './index.js';

/**
 * =============================================================================
 * WORK ITEM INTELLIGENCE ANALYSIS
 * =============================================================================
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

export interface AnalysisResult {
  completenessScore: number;
  aiReadinessScore: number;
  outOf: number;  // Maximum score value for completeness and aiReadiness scores (default: 10)
  category: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  complexity: "Simple" | "Medium" | "Complex" | "Expert";
  assignmentSuggestion: "AI" | "Human" | "Hybrid";
  recommendations: string[];
  enhancedDescription?: string;
  missingElements: string[];
  strengths: string[];
  improvementAreas: string[];
  rawAnalysis?: RawAIAnalysisData;  // Full JSON response from AI for intelligent agent interpretation
}

/**
 * Raw AI Analysis Data
 * Represents unstructured JSON response from AI analysis
 * This is intentionally flexible as AI responses can vary in structure
 * Use this for storing complete AI responses that may contain custom fields
 */
export interface RawAIAnalysisData {
  /** 
   * Allow any JSON-serializable fields from AI analysis
   * Note: AI responses are standard JSON (primitives, objects, arrays)
   */
  [key: string]: string | number | boolean | null | undefined | JSONValue[] | { [key: string]: JSONValue };
}

/**
 * =============================================================================
 * AI ASSIGNMENT ANALYSIS
 * =============================================================================
 */

export interface AIAssignmentAnalyzerArgs {
  workItemId: number;
  organization?: string;
  project?: string;
  outputFormat?: "detailed" | "json";
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

/**
 * =============================================================================
 * FEATURE DECOMPOSITION
 * =============================================================================
 */

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

/**
 * =============================================================================
 * HIERARCHY VALIDATION
 * =============================================================================
 */

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

/**
 * =============================================================================
 * PERSONAL WORKLOAD ANALYSIS
 * =============================================================================
 */

export interface PersonalWorkloadAnalyzerArgs {
  assignedToEmail: string | string[];
  analysisPeriodDays?: number;
  additionalIntent?: string;
  organization?: string;
  project?: string;
  areaPath?: string;
  continueOnError?: boolean;
  maxConcurrency?: number;
}

export interface BatchPersonalWorkloadAnalyzerArgs {
  assignedToEmails: string[];
  analysisPeriodDays?: number;
  additionalIntent?: string;
  organization?: string;
  project?: string;
  areaPath?: string;
  continueOnError?: boolean;
  maxConcurrency?: number;
}

export interface BatchPersonalWorkloadAnalysisResult {
  summary: {
    totalAnalyzed: number;
    successCount: number;
    errorCount: number;
    analysisPeriodDays: number;
    startDate: string;
    endDate: string;
    additionalIntent?: string;
  };
  results: Array<{
    email: string;
    success: boolean;
    analysis?: PersonalWorkloadAnalysisResult;
    error?: string;
  }>;
  teamMetrics?: {
    averageHealthScore: number;
    healthDistribution: Record<string, number>;
    topConcerns: Array<{ concern: string; count: number }>;
    totalWorkItems: { completed: number; active: number };
  };
}

export interface PersonalWorkloadAnalysisResult {
  executiveSummary: {
    email: string;
    analysisPeriod: { startDate: string; endDate: string; days: number };
    overallHealthScore: number;
    healthStatus: "Healthy" | "Concerning" | "At Risk" | "Critical";
    primaryConcerns: string[];
    additionalIntent?: string;
  };
  workSummary: {
    completed: {
      totalItems: number;
      storyPoints: number;
      velocityPerWeek: number;
      workTypes: Record<string, { count: number; percentage: number }>;
      averageCycleTime: number;
    };
    active: {
      totalItems: number;
      weightedLoad: number;
      capacityMultiplier: number;
      wipStatus: "Healthy" | "Concerning" | "Critical";
      highPriorityCount: number;
      oldestItemAge: number;
    };
    estimationQuality: {
      manualPercentage: number;
      aiEstimatedPercentage: number;
      lowConfidenceCount: number;
      status: "Good" | "Needs Review";
    };
  };
  riskFlags: {
    critical: Array<{ title: string; description: string; score: number }>;
    concerning: Array<{ title: string; description: string }>;
    minor: Array<{ title: string; description: string }>;
    positive: string[];
  };
  detailedAnalysis: {
    workloadBalance: { score: number; assessment: string; recommendation: string };
    workVariety: { 
      score: number; 
      workTypeDistribution: Record<string, { count: number; percentage: number }>; 
      specializationRisk: "Low" | "Medium" | "High"; 
      recommendation: string 
    };
    codingBalance: { 
      score: number; 
      codingPercentage: number; 
      nonCodingPercentage: number; 
      assessment: string; 
      recommendation: string 
    };
    complexityGrowth: { 
      score: number; 
      trend: "Increasing" | "Stable" | "Decreasing"; 
      challengeLevel: "Appropriate" | "Under-challenged" | "Overwhelmed"; 
      recommendation: string 
    };
    temporalHealth: { 
      score: number; 
      afterHoursFrequency: string; 
      continuousWorkPattern: string; 
      assessment: string; 
      recommendation: string 
    };
    growthTrajectory: { score: number; assessment: string };
  };
  customIntentAnalysis?: {
    intent: string;
    keyFindings: string[];
    recommendations: string[];
    supportingEvidence: string[];
  };
  actionItems: {
    immediate: Array<{ what: string; why: string; owner: string }>;
    shortTerm: string[];
    longTerm: string[];
    managerDiscussion: string[];
    selfCare: string[];
  };
  topWorkItems: Array<{
    id: number;
    title: string;
    type: string;
    state: string;
    storyPoints?: number;
    ageInDays: number;
    complexity: "High" | "Medium" | "Low";
  }>;
}


