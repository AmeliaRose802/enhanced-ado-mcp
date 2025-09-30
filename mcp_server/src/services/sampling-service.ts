import type { ToolExecutionResult } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { executeTool } from "./tool-service.js";

/**
 * Work Item Intelligence Analysis using VS Code Sampling
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
  AutoAssignToAI?: boolean;
  WorkItemId?: number;
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

interface AnalysisResult {
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
}

interface AIAssignmentResult {
  decision: "AI_FIT" | "HUMAN_FIT" | "HYBRID";
  confidence: number; // 0-1
  riskScore: number; // 0-100
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

interface DecomposedWorkItem {
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

interface FeatureDecompositionResult {
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

interface WorkItemHierarchyInfo {
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

interface ParentingSuggestion {
  suggestedParentId: number;
  suggestedParentTitle: string;
  suggestedParentType: string;
  confidence: number; // 0-1
  reasoning: string;
  benefits: string[];
  potentialIssues?: string[];
}

interface HierarchyValidationIssue {
  issueType: "misparented" | "orphaned" | "incorrect_level" | "circular_dependency" | "type_mismatch";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendations: string[];
}

interface HierarchyValidationResult {
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
 * Main sampling service interface - injects capability to call language models
 */
export class SamplingService {
  private server: any; // MCP Server instance with sampling capability
  
  constructor(server: any) {
    this.server = server;
  }

  /**
   * Check if sampling is available in the current client
   */
  private hasSamplingSupport(): boolean {
    if (!this.server) {
      logger.error('No server instance available for sampling');
      return false;
    }
    
    // Check client capabilities like the working example
    const clientCapabilities = this.server.getClientCapabilities();
    
    if (!clientCapabilities?.sampling) {
      logger.error('Client does not support sampling capabilities');
      return false;
    }
    
    // Check if server has createMessage method for sampling
    if (typeof this.server.createMessage !== 'function') {
      logger.error('Server instance does not have createMessage method');
      return false;
    }
    
    return true;
  }

  /**
   * Execute work item intelligence analysis
   */
  async analyzeWorkItem(args: WorkItemIntelligenceArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting work item intelligence analysis for: ${args.Title}`);

    // Check sampling capability first
    if (!this.hasSamplingSupport()) {
      const error = 'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.';
      logger.error(error);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error, exitCode: 1 },
        metadata: { source: 'sampling-check-failed', samplingAvailable: false },
        errors: [error],
        warnings: []
      };
    }

    try {
      // Perform different types of analysis based on request
      let analysisResult: AnalysisResult;
      
      switch (args.AnalysisType) {
        case "completeness":
          analysisResult = await this.analyzeCompleteness(args);
          break;
        case "ai-readiness": 
          analysisResult = await this.analyzeAIReadiness(args);
          break;
        case "enhancement":
          analysisResult = await this.generateEnhancements(args);
          break;
        case "categorization":
          analysisResult = await this.categorizeWorkItem(args);
          break;
        case "full":
        default:
          analysisResult = await this.performFullAnalysis(args);
          break;
      }

      // If enhancement requested and creation in ADO requested, create the enhanced item
      if (args.EnhanceDescription && args.CreateInADO && analysisResult.enhancedDescription) {
        try {
          const createResult = await this.createEnhancedWorkItem(args, analysisResult);
          analysisResult.recommendations.push(`✅ Enhanced work item created: ${createResult}`);
        } catch (error) {
          analysisResult.recommendations.push(`❌ Failed to create enhanced work item: ${error}`);
        }
      }

      return {
        success: true,
        data: analysisResult,
        raw: { stdout: JSON.stringify(analysisResult, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'ai-sampling', analysisType: args.AnalysisType, samplingAvailable: true },
        errors: [],
        warnings: []
      };

    } catch (error) {
      const errorMsg = `AI sampling analysis failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: errorMsg, exitCode: 1 },
        metadata: { source: 'ai-sampling-failed', samplingAvailable: true },
        errors: [errorMsg],
        warnings: []
      };
    }
  }

  /**
   * Analyze AI assignment suitability with enhanced reasoning and confidence scoring
   */
  async analyzeAIAssignment(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting AI assignment analysis for: ${args.Title}`);

    // Check sampling capability first
    if (!this.hasSamplingSupport()) {
      const error = 'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.';
      logger.error(error);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error, exitCode: 1 },
        metadata: { source: 'sampling-check-failed', samplingAvailable: false },
        errors: [error],
        warnings: []
      };
    }

    try {
      const analysisResult = await this.performAIAssignmentAnalysis(args);

      // If auto-assign is requested and the item is AI-suitable, perform the assignment
      if (args.AutoAssignToAI && args.WorkItemId && analysisResult.decision === "AI_FIT") {
        try {
          const assignResult = await this.autoAssignToAI(args.WorkItemId, args.Organization, args.Project);
          analysisResult.recommendedNextSteps.push(`✅ Auto-assigned to AI: ${assignResult}`);
        } catch (error) {
          analysisResult.recommendedNextSteps.push(`❌ Failed to auto-assign to AI: ${error}`);
        }
      }

      return {
        success: true,
        data: analysisResult,
        raw: { stdout: JSON.stringify(analysisResult, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'ai-assignment-analysis', samplingAvailable: true },
        errors: [],
        warnings: []
      };

    } catch (error) {
      const errorMsg = `AI assignment analysis failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: errorMsg, exitCode: 1 },
        metadata: { source: 'ai-assignment-failed', samplingAvailable: true },
        errors: [errorMsg],
        warnings: []
      };
    }
  }

  /**
   * Intelligently decompose a large feature into smaller, assignable work items
   */
  async decomposeFeature(args: FeatureDecomposerArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting feature decomposition for: ${args.Title}`);

    // Check sampling capability first
    if (!this.hasSamplingSupport()) {
      const error = 'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.';
      logger.error(error);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error, exitCode: 1 },
        metadata: { source: 'sampling-check-failed', samplingAvailable: false },
        errors: [error],
        warnings: []
      };
    }

    try {
      // Step 1: Perform initial feature decomposition analysis
      const decompositionResult = await this.performFeatureDecomposition(args);

      // Step 2: Analyze AI suitability for each generated work item (if requested)
      if (args.AnalyzeAISuitability) {
        decompositionResult.suggestedItems = await this.analyzeWorkItemsSuitability(decompositionResult.suggestedItems);
        decompositionResult.assignmentSummary = this.calculateAssignmentSummary(decompositionResult.suggestedItems);
      }

      // Step 3: Auto-create work items in Azure DevOps (if requested)
      if (args.AutoCreateWorkItems) {
        try {
          const createdIds = await this.createDecomposedWorkItems(args, decompositionResult);
          decompositionResult.createdWorkItemIds = createdIds;

          // Step 4: Auto-assign AI-suitable items to Copilot (if requested)
          if (args.AutoAssignAISuitable && createdIds.length > 0) {
            await this.autoAssignAISuitableItems(createdIds, decompositionResult.suggestedItems, args);
          }
        } catch (error) {
          logger.warn(`Failed to auto-create work items: ${error}`);
          decompositionResult.riskFactors.push(`Work item creation failed: ${error}`);
        }
      }

      return {
        success: true,
        data: decompositionResult,
        raw: { stdout: JSON.stringify(decompositionResult, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'feature-decomposition', samplingAvailable: true },
        errors: [],
        warnings: []
      };

    } catch (error) {
      const errorMsg = `Feature decomposition failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: errorMsg, exitCode: 1 },
        metadata: { source: 'feature-decomposition-failed', samplingAvailable: true },
        errors: [errorMsg],
        warnings: []
      };
    }
  }

  /**
   * Validate work item hierarchy and provide intelligent parenting suggestions
   */
  async validateHierarchy(args: HierarchyValidatorArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting hierarchy validation analysis`);

    // Check sampling capability first
    if (!this.hasSamplingSupport()) {
      const error = 'VS Code language model sampling is not available. Ensure you have GitHub Copilot enabled and the language model is accessible.';
      logger.error(error);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: error, exitCode: 1 },
        metadata: { source: 'sampling-check-failed', samplingAvailable: false },
        errors: [error],
        warnings: []
      };
    }

    try {
      // Step 1: Gather work items to analyze
      const workItemsToAnalyze = await this.gatherWorkItemsForAnalysis(args);
      
      if (workItemsToAnalyze.length === 0) {
        return {
          success: true,
          data: {
            analysisContext: {
              analyzedItemCount: 0,
              areaPath: args.AreaPath,
              analysisDepth: args.AnalysisDepth || 'shallow',
              timestamp: new Date().toISOString()
            },
            workItemsAnalyzed: [],
            issuesFound: [],
            healthySummary: {
              totalAnalyzed: 0,
              itemsWithIssues: 0,
              itemsWellParented: 0,
              orphanedItems: 0,
              incorrectlyParented: 0
            },
            recommendations: {
              highPriorityActions: ['No work items found to analyze'],
              improvementSuggestions: [],
              bestPractices: []
            }
          },
          raw: { stdout: 'No work items found to analyze', stderr: '', exitCode: 0 },
          metadata: { source: 'hierarchy-validation', samplingAvailable: true },
          errors: [],
          warnings: ['No work items found to analyze']
        };
      }

      // Step 2: Perform hierarchy analysis using AI sampling
      const validationResult = await this.performHierarchyValidation(workItemsToAnalyze, args);

      return {
        success: true,
        data: validationResult,
        raw: { stdout: JSON.stringify(validationResult, null, 2), stderr: '', exitCode: 0 },
        metadata: { source: 'hierarchy-validation', samplingAvailable: true },
        errors: [],
        warnings: []
      };

    } catch (error) {
      const errorMsg = `Hierarchy validation failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return {
        success: false,
        data: null,
        raw: { stdout: '', stderr: errorMsg, exitCode: 1 },
        metadata: { source: 'hierarchy-validation-failed', samplingAvailable: true },
        errors: [errorMsg],
        warnings: []
      };
    }
  }

  /**
   * Analyze work item completeness using AI sampling
   */
  private async analyzeCompleteness(args: WorkItemIntelligenceArgs): Promise<AnalysisResult> {
    const systemPrompt = `You are a senior work item analyst. Analyze the work item for completeness and clarity.

Evaluate these aspects:
1. Title clarity and descriptiveness (0-10)
2. Description completeness (0-10) 
3. Acceptance criteria quality (0-10)
4. Missing required information
5. Overall completeness score (0-10)

Provide specific recommendations for improvement.`;

    const userContent = this.formatWorkItemForAnalysis(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 300,
      temperature: 0.3
    });

    return this.parseAnalysisResponse(result, "completeness");
  }

  /**
   * Analyze AI readiness using sampling
   */
  private async analyzeAIReadiness(args: WorkItemIntelligenceArgs): Promise<AnalysisResult> {
    const systemPrompt = `You are an AI assignment specialist. Evaluate if this work item is suitable for AI (GitHub Copilot) assignment.

Rate these factors (0-10 each):
1. Task clarity and specificity
2. Scope definition (atomic vs. complex)
3. Testability and verification criteria
4. Documentation/context availability
5. Risk level (low risk = higher AI suitability)

Determine: AI-Suitable, Human-Required, or Hybrid approach needed.
Provide specific reasons and improvement suggestions.`;

    const userContent = this.formatWorkItemForAnalysis(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 250,
      temperature: 0.2
    });

    return this.parseAnalysisResponse(result, "ai-readiness");
  }

  /**
   * Generate enhancement suggestions using sampling
   */
  private async generateEnhancements(args: WorkItemIntelligenceArgs): Promise<AnalysisResult> {
    const systemPrompt = `You are a work item enhancement specialist. Improve this work item to be clear, actionable, and complete.

Generate:
1. Enhanced title (if needed)
2. Improved description with clear steps
3. Specific acceptance criteria
4. Missing information that should be added
5. Priority and complexity assessment

Make it ready for successful execution by either AI or human developers.`;

    const userContent = this.formatWorkItemForAnalysis(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 400,
      temperature: 0.5
    });

    return this.parseAnalysisResponse(result, "enhancement");
  }

  /**
   * Categorize and prioritize work item using sampling
   */
  private async categorizeWorkItem(args: WorkItemIntelligenceArgs): Promise<AnalysisResult> {
    const systemPrompt = `You are a work item categorization expert. Analyze and categorize this work item.

Determine:
1. Category: Feature, Bug, Tech Debt, Security, Documentation, Research, etc.
2. Priority: Critical, High, Medium, Low
3. Complexity: Simple, Medium, Complex, Expert
4. Estimated effort: Hours/Story Points
5. Required expertise: Front-end, Back-end, DevOps, Security, etc.
6. Dependencies and blockers

Provide clear reasoning for each classification.`;

    const userContent = this.formatWorkItemForAnalysis(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 200,
      temperature: 0.4
    });

    return this.parseAnalysisResponse(result, "categorization");
  }

  /**
   * Perform comprehensive analysis using sampling
   */
  private async performFullAnalysis(args: WorkItemIntelligenceArgs): Promise<AnalysisResult> {
    const systemPrompt = `You are a comprehensive work item intelligence analyzer. Provide a complete analysis covering:

COMPLETENESS (0-10):
- Title clarity
- Description detail
- Acceptance criteria quality

AI READINESS (0-10):
- Task specificity
- Scope definition
- Testability
- Risk assessment

CATEGORIZATION:
- Type: Feature/Bug/Tech Debt/Security/etc.
- Priority: Critical/High/Medium/Low
- Complexity: Simple/Medium/Complex/Expert
- Assignment: AI-Suitable/Human-Required/Hybrid

RECOMMENDATIONS:
- Top 3 improvement suggestions
- Missing information to add
- Strengths to preserve

Be specific and actionable in your analysis.`;

    const userContent = this.formatWorkItemForAnalysis(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 500,
      temperature: 0.4
    });

    return this.parseAnalysisResponse(result, "full");
  }

  /**
   * Format work item data for AI analysis
   */
  private formatWorkItemForAnalysis(args: WorkItemIntelligenceArgs): string {
    let content = `WORK ITEM ANALYSIS REQUEST

Title: ${args.Title}
Type: ${args.WorkItemType || 'Not specified'}

Description:
${args.Description || 'No description provided'}

Acceptance Criteria:
${args.AcceptanceCriteria || 'No acceptance criteria provided'}`;

    if (args.ContextInfo) {
      content += `\n\nContext Information:
${args.ContextInfo}`;
    }

    return content;
  }

  /**
   * Parse AI response into structured analysis result
   */
  private parseAnalysisResponse(aiResult: any, analysisType: string): AnalysisResult {
    // Handle VS Code sampling response format like the working example
    const responseText = aiResult?.content?.text || JSON.stringify(aiResult) || 'No analysis available';
    
    logger.debug(`Parsing AI response for ${analysisType}:`, responseText.substring(0, 200) + '...');
    
    // Try to extract structured data from AI response
    let completenessScore = 5;
    let aiReadinessScore = 5;
    let category = "General";
    let priority: "Low" | "Medium" | "High" | "Critical" = "Medium";
    let complexity: "Simple" | "Medium" | "Complex" | "Expert" = "Medium";
    let assignmentSuggestion: "AI" | "Human" | "Hybrid" = "Human";
    
    // Basic parsing for scores and categories
    const scoreRegex = /(\w+).*?(\d+)\/10/gi;
    let match;
    while ((match = scoreRegex.exec(responseText)) !== null) {
      const [, metric, score] = match;
      const scoreNum = parseInt(score);
      if (metric.toLowerCase().includes('complete')) {
        completenessScore = scoreNum;
      } else if (metric.toLowerCase().includes('readiness') || metric.toLowerCase().includes('ai')) {
        aiReadinessScore = scoreNum;
      }
    }
    
    // Parse priority
    if (responseText.toLowerCase().includes('critical')) priority = "Critical";
    else if (responseText.toLowerCase().includes('high')) priority = "High";
    else if (responseText.toLowerCase().includes('low')) priority = "Low";
    
    // Parse complexity
    if (responseText.toLowerCase().includes('simple')) complexity = "Simple";
    else if (responseText.toLowerCase().includes('complex')) complexity = "Complex";
    else if (responseText.toLowerCase().includes('expert')) complexity = "Expert";
    
    // Parse assignment suggestion
    if (responseText.toLowerCase().includes('ai-suitable') || responseText.toLowerCase().includes('ai suitable')) {
      assignmentSuggestion = "AI";
    } else if (responseText.toLowerCase().includes('hybrid')) {
      assignmentSuggestion = "Hybrid";
    }
    
    const result: AnalysisResult = {
      completenessScore,
      aiReadinessScore,
      category,
      priority,
      complexity,
      assignmentSuggestion,
      recommendations: [`🤖 **AI Analysis (${analysisType.toUpperCase()})**:\n\n${responseText}\n\n✨ *Powered by VS Code MCP Sampling*`],
      missingElements: [],
      strengths: [],
      improvementAreas: []
    };

    return result;
  }

  /**
   * Create enhanced work item in Azure DevOps
   */
  private async createEnhancedWorkItem(args: WorkItemIntelligenceArgs, analysis: AnalysisResult): Promise<string> {
    if (!analysis.enhancedDescription) {
      throw new Error("No enhanced description available");
    }

    const createArgs = {
      Title: args.Title,
      Description: analysis.enhancedDescription,
      WorkItemType: args.WorkItemType || "Task",
      ParentWorkItemId: args.ParentWorkItemId,
      Organization: args.Organization,
      Project: args.Project,
      Tags: "AI-Enhanced,Intelligence-Analyzed"
    };

    const result = await executeTool("wit-create-new-item", createArgs);
    
    if (!result.success) {
      throw new Error(`Failed to create work item: ${result.errors?.join(', ')}`);
    }

    return `Work item created successfully (ID: ${result.data?.id || 'unknown'})`;
  }

  /**
   * Perform comprehensive AI assignment analysis using sampling
   */
  private async performAIAssignmentAnalysis(args: AIAssignmentAnalyzerArgs): Promise<AIAssignmentResult> {
    const systemPrompt = `You are a senior AI assignment specialist evaluating work items for GitHub Copilot assignment. 

Analyze this work item and determine:

1. **ASSIGNMENT DECISION** (AI_FIT, HUMAN_FIT, or HYBRID):
   - AI_FIT: Well-defined, atomic coding tasks with clear requirements
   - HUMAN_FIT: Requires judgment, stakeholder interaction, or complex architecture decisions  
   - HYBRID: Can be partially automated but needs human oversight

2. **CONFIDENCE SCORE** (0.0-1.0): How certain are you about the assignment?

3. **RISK SCORE** (0-100): Overall risk level (higher = more risky for AI)

4. **SCOPE ESTIMATION**:
   - Estimated files to touch (min/max range)
   - Complexity level (trivial/low/medium/high)

5. **GUARDRAILS NEEDED**:
   - Tests required?
   - Feature flag/toggle needed?
   - Touches sensitive areas?
   - Needs code review from domain owner?

Be conservative - when in doubt, prefer HUMAN_FIT or HYBRID over AI_FIT.
Consider: scope clarity, technical complexity, business risk, and verification feasibility.

Provide specific, actionable reasoning for your decision.`;

    const userContent = this.formatWorkItemForAIAnalysis(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 400,
      temperature: 0.2
    });

    return this.parseAIAssignmentResponse(result);
  }

  /**
   * Format work item data for AI assignment analysis
   */
  private formatWorkItemForAIAnalysis(args: AIAssignmentAnalyzerArgs): string {
    let content = `WORK ITEM AI ASSIGNMENT ANALYSIS

Title: ${args.Title}
Type: ${args.WorkItemType || 'Not specified'}
Priority: ${args.Priority || 'Not specified'}

Description:
${args.Description || 'No description provided'}

Acceptance Criteria:
${args.AcceptanceCriteria || 'No acceptance criteria provided'}`;

    if (args.Labels) {
      content += `\n\nLabels/Tags: ${args.Labels}`;
    }

    if (args.EstimatedFiles) {
      content += `\n\nEstimated Files to Touch: ${args.EstimatedFiles}`;
    }

    if (args.TechnicalContext) {
      content += `\n\nTechnical Context: ${args.TechnicalContext}`;
    }

    if (args.ExternalDependencies) {
      content += `\n\nExternal Dependencies: ${args.ExternalDependencies}`;
    }

    if (args.TimeConstraints) {
      content += `\n\nTime Constraints: ${args.TimeConstraints}`;
    }

    if (args.RiskFactors) {
      content += `\n\nKnown Risk Factors: ${args.RiskFactors}`;
    }

    if (args.TestingRequirements) {
      content += `\n\nTesting Requirements: ${args.TestingRequirements}`;
    }

    content += `\n\nProvide your analysis with specific reasoning for the assignment decision.`;

    return content;
  }

  /**
   * Parse AI assignment response into structured result
   */
  private parseAIAssignmentResponse(aiResult: any): AIAssignmentResult {
    const responseText = aiResult?.content?.text || JSON.stringify(aiResult) || 'No analysis available';
    
    logger.debug(`Parsing AI assignment response:`, responseText.substring(0, 200) + '...');
    
    // Default values
    let decision: "AI_FIT" | "HUMAN_FIT" | "HYBRID" = "HUMAN_FIT";
    let confidence = 0.5;
    let riskScore = 60;
    
    // Parse decision
    if (responseText.toLowerCase().includes('ai_fit') || responseText.toLowerCase().includes('ai-fit')) {
      decision = "AI_FIT";
    } else if (responseText.toLowerCase().includes('hybrid')) {
      decision = "HYBRID";
    } else {
      decision = "HUMAN_FIT";
    }
    
    // Parse confidence (look for patterns like "confidence: 0.8" or "80% confident")
    const confidenceMatch = responseText.match(/confidence[:\s]*([0-9.]+)/i) || 
                           responseText.match(/([0-9]+)%\s*confident/i);
    if (confidenceMatch) {
      let confValue = parseFloat(confidenceMatch[1]);
      if (confValue > 1) confValue = confValue / 100; // Convert percentage to decimal
      confidence = Math.min(1, Math.max(0, confValue));
    }
    
    // Parse risk score (look for patterns like "risk: 40" or "risk score: 30")
    const riskMatch = responseText.match(/risk[^0-9]*([0-9]+)/i);
    if (riskMatch) {
      riskScore = Math.min(100, Math.max(0, parseInt(riskMatch[1])));
    }
    
    // Extract primary reasons (look for bullet points or numbered lists)
    const primaryReasons: string[] = [];
    const reasonMatches = responseText.match(/[-*•]\s*(.+)/g) || 
                         responseText.match(/\d+\.\s*(.+)/g);
    if (reasonMatches) {
      reasonMatches.slice(0, 5).forEach((match: string) => {
        const cleaned = match.replace(/^[-*•\d.\s]+/, '').trim();
        if (cleaned.length > 10) primaryReasons.push(cleaned);
      });
    }
    
    if (primaryReasons.length === 0) {
      primaryReasons.push(`AI analysis suggests ${decision} based on work item complexity and requirements`);
    }
    
    // Parse file estimates (look for patterns like "3-5 files" or "min: 2, max: 8")
    let minFiles = 1, maxFiles = 3;
    const filesMatch = responseText.match(/(\d+)[-–]\s*(\d+)\s*files/i) ||
                      responseText.match(/min[:\s]*(\d+)[,\s]*max[:\s]*(\d+)/i);
    if (filesMatch) {
      minFiles = parseInt(filesMatch[1]);
      maxFiles = parseInt(filesMatch[2]);
    }
    
    // Parse complexity
    let complexity: "trivial" | "low" | "medium" | "high" = "medium";
    if (responseText.toLowerCase().includes('trivial')) complexity = "trivial";
    else if (responseText.toLowerCase().includes('low complexity')) complexity = "low";
    else if (responseText.toLowerCase().includes('high complexity')) complexity = "high";
    
    // Parse guardrails (look for boolean indicators)
    const guardrails = {
      testsRequired: responseText.toLowerCase().includes('tests required') || 
                    responseText.toLowerCase().includes('testing needed'),
      featureFlagOrToggle: responseText.toLowerCase().includes('feature flag') || 
                          responseText.toLowerCase().includes('toggle'),
      touchSensitiveAreas: responseText.toLowerCase().includes('sensitive') ||
                          responseText.toLowerCase().includes('critical'),
      needsCodeReviewFromOwner: responseText.toLowerCase().includes('code review') ||
                               responseText.toLowerCase().includes('domain expert')
    };
    
    const result: AIAssignmentResult = {
      decision,
      confidence,
      riskScore,
      primaryReasons,
      missingInfo: [],
      recommendedNextSteps: [`🤖 **AI Assignment Analysis**:\n\n${responseText}\n\n✨ *Powered by VS Code MCP Sampling*`],
      estimatedScope: {
        files: { min: minFiles, max: maxFiles },
        complexity
      },
      guardrails,
      assignmentStrategy: this.generateAssignmentStrategy(decision, confidence, riskScore)
    };

    return result;
  }

  /**
   * Generate assignment strategy based on analysis
   */
  private generateAssignmentStrategy(decision: string, confidence: number, riskScore: number): string {
    if (decision === "AI_FIT" && confidence > 0.7 && riskScore < 40) {
      return "✅ Ready for GitHub Copilot assignment. Well-defined task with low risk.";
    } else if (decision === "AI_FIT" && riskScore >= 40) {
      return "⚠️ AI-suitable but requires careful monitoring due to risk factors.";
    } else if (decision === "HYBRID") {
      return "🔄 Hybrid approach: Break down into AI-suitable subtasks with human oversight.";
    } else {
      return "👤 Human assignment recommended. Requires domain expertise or stakeholder interaction.";
    }
  }

  /**
   * Auto-assign work item to AI (Copilot) if conditions are met
   */
  private async autoAssignToAI(workItemId: number, organization?: string, project?: string): Promise<string> {
    const assignArgs = {
      WorkItemId: workItemId,
      Organization: organization,
      Project: project
    };

    const result = await executeTool("wit-assign-to-copilot", assignArgs);
    
    if (!result.success) {
      throw new Error(`Failed to assign work item to AI: ${result.errors?.join(', ')}`);
    }

    return `Work item ${workItemId} assigned to GitHub Copilot successfully`;
  }

  /**
   * Perform the core feature decomposition using AI sampling
   */
  private async performFeatureDecomposition(args: FeatureDecomposerArgs): Promise<FeatureDecompositionResult> {
    const systemPrompt = `You are a senior software architect specializing in feature decomposition and task breakdown. Your role is to intelligently decompose large features into smaller, manageable work items.

DECOMPOSITION PRINCIPLES:
1. **Atomic Work Items**: Each item should be focused on a single responsibility
2. **Testable Units**: Items should have clear verification criteria
3. **Appropriate Granularity**: Target complexity of ${args.TargetComplexity || 'medium'} 
4. **Logical Dependencies**: Consider implementation order and dependencies
5. **Value Delivery**: Each item should contribute to the overall feature goal

ANALYSIS FRAMEWORK:
- Break down into ${args.MaxItems || 8} or fewer work items
- Consider technical architecture and implementation patterns
- Account for testing, documentation, and quality requirements
- Identify shared components and reusable elements
- Plan for incremental delivery and validation

Generate work items with:
- Clear, specific titles
- Detailed descriptions with implementation guidance
- Acceptance criteria (if requested)
- Complexity and effort estimates
- Technical considerations and dependencies
- Testing strategies

Provide reasoning for the decomposition strategy and implementation order.`;

    const userContent = this.formatFeatureForDecomposition(args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 800,
      temperature: 0.4
    });

    return this.parseDecompositionResponse(result, args);
  }

  /**
   * Format feature data for decomposition analysis
   */
  private formatFeatureForDecomposition(args: FeatureDecomposerArgs): string {
    let content = `FEATURE DECOMPOSITION REQUEST

Feature Title: ${args.Title}
Target Work Item Type: ${args.WorkItemType || 'Task'}
Target Complexity: ${args.TargetComplexity || 'medium'}
Maximum Items: ${args.MaxItems || 8}

Feature Description:
${args.Description || 'No description provided'}`;

    if (args.BusinessContext) {
      content += `\n\nBusiness Context:
${args.BusinessContext}`;
    }

    if (args.TechnicalContext) {
      content += `\n\nTechnical Context:
${args.TechnicalContext}`;
    }

    if (args.ExistingComponents) {
      content += `\n\nExisting Components/Systems:
${args.ExistingComponents}`;
    }

    if (args.Dependencies) {
      content += `\n\nKnown Dependencies:
${args.Dependencies}`;
    }

    if (args.QualityRequirements) {
      content += `\n\nQuality Requirements:
${args.QualityRequirements}`;
    }

    if (args.TimeConstraints) {
      content += `\n\nTime Constraints:
${args.TimeConstraints}`;
    }

    content += `\n\nRequests:
- Generate acceptance criteria: ${args.GenerateAcceptanceCriteria ? 'Yes' : 'No'}
- Analyze AI suitability: ${args.AnalyzeAISuitability ? 'Yes' : 'No'}

Please provide a comprehensive breakdown with implementation strategy and reasoning.`;

    return content;
  }

  /**
   * Parse AI decomposition response into structured result
   */
  private parseDecompositionResponse(aiResult: any, args: FeatureDecomposerArgs): FeatureDecompositionResult {
    const responseText = aiResult?.content?.text || JSON.stringify(aiResult) || 'No decomposition available';
    
    logger.debug(`Parsing decomposition response:`, responseText.substring(0, 300) + '...');
    
    // Extract work items (look for numbered lists, bullet points, or structured sections)
    const suggestedItems: DecomposedWorkItem[] = [];
    
    // Try to parse structured work items
    const itemMatches = responseText.match(/(?:Item|Task|Story)\s*\d+[:\s]*(.*?)(?=(?:Item|Task|Story)\s*\d+|$)/gsi);
    
    if (itemMatches && itemMatches.length > 0) {
      itemMatches.slice(0, args.MaxItems || 8).forEach((match: string, index: number) => {
        const item = this.parseWorkItemFromText(match, index + 1);
        if (item) suggestedItems.push(item);
      });
    } else {
      // Fallback: try to extract from bullet points or numbered lists
      const bulletMatches = responseText.match(/(?:[-*•]\s*|\d+\.\s*)(.+)/g);
      if (bulletMatches) {
        bulletMatches.slice(0, args.MaxItems || 8).forEach((match: string, index: number) => {
          const cleaned = match.replace(/^[-*•\d.\s]+/, '').trim();
          if (cleaned.length > 10) {
            suggestedItems.push({
              title: this.extractTitleFromText(cleaned),
              description: cleaned,
              estimatedEffort: "TBD",
              complexity: args.TargetComplexity || "medium",
              reasoning: "Generated from feature decomposition analysis",
              acceptanceCriteria: args.GenerateAcceptanceCriteria ? this.generateBasicAcceptanceCriteria(cleaned) : undefined
            });
          }
        });
      }
    }
    
    // If no items found, generate default breakdown
    if (suggestedItems.length === 0) {
      suggestedItems.push({
        title: `Implement ${args.Title}`,
        description: `Main implementation task for ${args.Title}`,
        estimatedEffort: "Medium",
        complexity: "medium",
        reasoning: "Default breakdown when AI parsing fails",
        acceptanceCriteria: args.GenerateAcceptanceCriteria ? [`${args.Title} is implemented and functional`, "All tests pass", "Code review completed"] : undefined
      });
    }
    
    // Parse overall strategy and considerations
    const strategy = this.extractStrategy(responseText);
    const riskFactors = this.extractRiskFactors(responseText);
    const dependencies = this.extractDependencies(responseText);
    
    return {
      originalFeature: {
        title: args.Title,
        summary: args.Description || 'Feature decomposition requested'
      },
      decompositionStrategy: strategy,
      suggestedItems,
      implementationOrder: suggestedItems.map((_, index) => index),
      overallComplexity: this.calculateOverallComplexity(suggestedItems),
      estimatedTotalEffort: this.calculateTotalEffort(suggestedItems),
      riskFactors,
      dependencies,
      qualityConsiderations: this.extractQualityConsiderations(responseText)
    };
  }

  /**
   * Parse individual work item from text
   */
  private parseWorkItemFromText(text: string, index: number): DecomposedWorkItem | null {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return null;
    
    const title = this.extractTitleFromText(lines[0]);
    const description = lines.slice(1).join('\n').trim() || title;
    
    // Extract complexity indicators
    let complexity: "simple" | "medium" | "complex" = "medium";
    if (text.toLowerCase().includes('simple') || text.toLowerCase().includes('trivial')) {
      complexity = "simple";
    } else if (text.toLowerCase().includes('complex') || text.toLowerCase().includes('difficult')) {
      complexity = "complex";
    }
    
    // Extract effort estimates
    const effortMatch = text.match(/(?:effort|estimate|points?):\s*(\w+)/i);
    const estimatedEffort = effortMatch ? effortMatch[1] : complexity === "simple" ? "Small" : complexity === "complex" ? "Large" : "Medium";
    
    return {
      title: title.length > 5 ? title : `Work Item ${index}: ${title}`,
      description,
      estimatedEffort,
      complexity,
      reasoning: `Decomposed from feature analysis - ${complexity} complexity task`,
      acceptanceCriteria: this.generateBasicAcceptanceCriteria(description)
    };
  }

  /**
   * Extract title from text (first meaningful part)
   */
  private extractTitleFromText(text: string): string {
    // Remove common prefixes and get the core title
    const cleaned = text
      .replace(/^(?:Item|Task|Story|Work Item)\s*\d*[:\-\s]*/i, '')
      .replace(/^[•\-*\d.\s]+/, '')
      .trim();
    
    // Take first sentence or first 60 characters
    const firstSentence = cleaned.split('.')[0].split('\n')[0];
    return firstSentence.length > 60 ? firstSentence.substring(0, 57) + '...' : firstSentence;
  }

  /**
   * Generate basic acceptance criteria for a work item
   */
  private generateBasicAcceptanceCriteria(description: string): string[] {
    const criteria = [];
    
    // Always include basic completion criteria
    criteria.push("Implementation is complete and functional");
    criteria.push("Code follows project standards and conventions");
    criteria.push("All tests pass successfully");
    
    // Add specific criteria based on description content
    if (description.toLowerCase().includes('ui') || description.toLowerCase().includes('interface')) {
      criteria.push("User interface is responsive and accessible");
    }
    
    if (description.toLowerCase().includes('api') || description.toLowerCase().includes('endpoint')) {
      criteria.push("API endpoints return correct responses");
      criteria.push("Error handling is implemented correctly");
    }
    
    if (description.toLowerCase().includes('database') || description.toLowerCase().includes('data')) {
      criteria.push("Data integrity is maintained");
      criteria.push("Database operations are optimized");
    }
    
    if (description.toLowerCase().includes('security') || description.toLowerCase().includes('auth')) {
      criteria.push("Security requirements are met");
      criteria.push("Access controls are properly implemented");
    }
    
    criteria.push("Code review is completed and approved");
    
    return criteria;
  }

  /**
   * Extract strategy information from AI response
   */
  private extractStrategy(text: string): string {
    // Look for strategy or approach sections
    const strategyMatch = text.match(/(?:strategy|approach|plan)[:\s\n]*(.*?)(?=\n\n|\n[A-Z]|$)/si);
    if (strategyMatch) {
      return strategyMatch[1].trim();
    }
    
    return "Feature broken down into manageable work items with consideration for dependencies and implementation order.";
  }

  /**
   * Extract risk factors from AI response
   */
  private extractRiskFactors(text: string): string[] {
    const risks = [];
    
    if (text.toLowerCase().includes('complex')) {
      risks.push("High complexity may require additional planning");
    }
    
    if (text.toLowerCase().includes('dependency') || text.toLowerCase().includes('dependencies')) {
      risks.push("External dependencies may impact timeline");
    }
    
    if (text.toLowerCase().includes('integration')) {
      risks.push("Integration complexity may require careful testing");
    }
    
    if (text.toLowerCase().includes('performance')) {
      risks.push("Performance requirements may need special attention");
    }
    
    if (text.toLowerCase().includes('security')) {
      risks.push("Security considerations require expert review");
    }
    
    return risks.length > 0 ? risks : ["Standard development risks apply"];
  }

  /**
   * Extract dependencies from AI response
   */
  private extractDependencies(text: string): string[] {
    const dependencies = [];
    
    // Look for explicit dependency mentions
    const depMatch = text.match(/dependenc(?:y|ies)[:\s\n]*(.*?)(?=\n\n|\n[A-Z]|$)/si);
    if (depMatch) {
      const depText = depMatch[1];
      const depItems = depText.split(/[,\n•\-*]/).map(item => item.trim()).filter(item => item.length > 5);
      dependencies.push(...depItems);
    }
    
    return dependencies.length > 0 ? dependencies : ["Implementation order should follow logical dependencies"];
  }

  /**
   * Extract quality considerations from AI response
   */
  private extractQualityConsiderations(text: string): string[] {
    const considerations = [];
    
    if (text.toLowerCase().includes('test')) {
      considerations.push("Comprehensive testing strategy required");
    }
    
    if (text.toLowerCase().includes('performance')) {
      considerations.push("Performance benchmarks should be established");
    }
    
    if (text.toLowerCase().includes('security')) {
      considerations.push("Security review and validation required");
    }
    
    if (text.toLowerCase().includes('documentation')) {
      considerations.push("Documentation updates needed");
    }
    
    return considerations.length > 0 ? considerations : ["Standard quality practices apply"];
  }

  /**
   * Calculate overall complexity from individual items
   */
  private calculateOverallComplexity(items: DecomposedWorkItem[]): "simple" | "medium" | "complex" | "expert" {
    const complexityScores = items.map(item => {
      switch (item.complexity) {
        case "simple": return 1;
        case "medium": return 2;
        case "complex": return 3;
        default: return 2;
      }
    });
    
    const avgComplexity = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length;
    
    if (avgComplexity <= 1.3) return "simple";
    if (avgComplexity <= 2.3) return "medium";
    if (avgComplexity <= 2.7) return "complex";
    return "expert";
  }

  /**
   * Calculate total estimated effort
   */
  private calculateTotalEffort(items: DecomposedWorkItem[]): string {
    const effortMap = { "Small": 1, "Medium": 2, "Large": 3, "XL": 4 };
    const totalPoints = items.reduce((sum, item) => {
      const effort = effortMap[item.estimatedEffort as keyof typeof effortMap] || 2;
      return sum + effort;
    }, 0);
    
    if (totalPoints <= 3) return "Small";
    if (totalPoints <= 8) return "Medium";
    if (totalPoints <= 15) return "Large";
    return "Extra Large";
  }

  /**
   * Analyze AI suitability for generated work items
   */
  private async analyzeWorkItemsSuitability(items: DecomposedWorkItem[]): Promise<DecomposedWorkItem[]> {
    const enhancedItems: DecomposedWorkItem[] = [];
    
    for (const item of items) {
      try {
        // Analyze each item for AI suitability
        const analysisArgs = {
          Title: item.title,
          Description: item.description,
          AcceptanceCriteria: item.acceptanceCriteria?.join('\n'),
          TechnicalContext: item.technicalNotes || '',
          AutoAssignToAI: false
        };
        
        const result = await this.performAIAssignmentAnalysis(analysisArgs);
        
        enhancedItems.push({
          ...item,
          aiSuitability: result.decision as "AI_FIT" | "HUMAN_FIT" | "HYBRID",
          confidence: result.confidence,
          riskScore: result.riskScore,
          reasoning: `${item.reasoning} | AI Analysis: ${result.primaryReasons.join('; ')}`
        });
      } catch (error) {
        logger.warn(`Failed to analyze AI suitability for "${item.title}": ${error}`);
        enhancedItems.push({
          ...item,
          aiSuitability: "HUMAN_FIT",
          confidence: 0.5,
          riskScore: 50,
          reasoning: `${item.reasoning} | AI Analysis failed, defaulting to human assignment`
        });
      }
    }
    
    return enhancedItems;
  }

  /**
   * Calculate assignment summary statistics
   */
  private calculateAssignmentSummary(items: DecomposedWorkItem[]) {
    const summary = {
      aiSuitableCount: 0,
      humanRequiredCount: 0,
      hybridCount: 0
    };
    
    items.forEach(item => {
      switch (item.aiSuitability) {
        case "AI_FIT":
          summary.aiSuitableCount++;
          break;
        case "HUMAN_FIT":
          summary.humanRequiredCount++;
          break;
        case "HYBRID":
          summary.hybridCount++;
          break;
      }
    });
    
    return summary;
  }

  /**
   * Create work items in Azure DevOps from decomposition result
   */
  private async createDecomposedWorkItems(args: FeatureDecomposerArgs, result: FeatureDecompositionResult): Promise<number[]> {
    const createdIds: number[] = [];
    
    for (const item of result.suggestedItems) {
      try {
        const createArgs = {
          Title: item.title,
          Description: item.description,
          WorkItemType: args.WorkItemType || "Task",
          ParentWorkItemId: args.ParentWorkItemId,
          AcceptanceCriteria: item.acceptanceCriteria?.join('\n'),
          Organization: args.Organization,
          Project: args.Project,
          AreaPath: args.AreaPath,
          IterationPath: args.IterationPath,
          Tags: this.buildItemTags(args.Tags, item)
        };
        
        const createResult = await executeTool("wit-create-new-item", createArgs);
        
        if (createResult.success && createResult.data?.id) {
          createdIds.push(createResult.data.id);
          logger.info(`Created work item ${createResult.data.id}: ${item.title}`);
        } else {
          logger.warn(`Failed to create work item "${item.title}": ${createResult.errors?.join(', ')}`);
        }
      } catch (error) {
        logger.error(`Error creating work item "${item.title}": ${error}`);
      }
    }
    
    return createdIds;
  }

  /**
   * Build tags for individual work items
   */
  private buildItemTags(baseTags: string | undefined, item: DecomposedWorkItem): string {
    const tags = [];
    
    if (baseTags) {
      tags.push(baseTags);
    }
    
    tags.push("Feature-Decomposed");
    tags.push(`Complexity-${item.complexity}`);
    
    if (item.aiSuitability) {
      tags.push(`AI-${item.aiSuitability.replace('_', '-')}`);
    }
    
    return tags.join(';');
  }

  /**
   * Auto-assign AI-suitable items to GitHub Copilot
   */
  private async autoAssignAISuitableItems(workItemIds: number[], items: DecomposedWorkItem[], args: FeatureDecomposerArgs): Promise<void> {
    for (let i = 0; i < workItemIds.length && i < items.length; i++) {
      const workItemId = workItemIds[i];
      const item = items[i];
      
      if (item.aiSuitability === "AI_FIT" && item.confidence && item.confidence > 0.7 && item.riskScore && item.riskScore < 40) {
        try {
          await this.autoAssignToAI(workItemId, args.Organization, args.Project);
          logger.info(`Auto-assigned work item ${workItemId} to GitHub Copilot`);
        } catch (error) {
          logger.warn(`Failed to auto-assign work item ${workItemId} to AI: ${error}`);
        }
      }
    }
  }

  /**
   * Gather work items for hierarchy analysis
   */
  private async gatherWorkItemsForAnalysis(args: HierarchyValidatorArgs): Promise<WorkItemHierarchyInfo[]> {
    const workItems: WorkItemHierarchyInfo[] = [];
    
    try {
      if (args.WorkItemIds && args.WorkItemIds.length > 0) {
        // Create mock work items for testing based on provided IDs
        logger.debug(`Creating mock work items for IDs: ${args.WorkItemIds.join(', ')}`);
        
        for (const id of args.WorkItemIds.slice(0, args.MaxItemsToAnalyze || 50)) {
          const mockWorkItem = this.createMockWorkItem(id, args);
          if (mockWorkItem && this.shouldIncludeWorkItem(mockWorkItem, args)) {
            workItems.push(mockWorkItem);
          }
        }
      } else {
        logger.warn('Hierarchy validator requires specific WorkItemIds to analyze. Provide WorkItemIds parameter with array of work item IDs.');
      }
    } catch (error) {
      logger.error(`Error gathering work items: ${error}`);
    }
    
    logger.debug(`Gathered ${workItems.length} work items for analysis`);
    return workItems;
  }

  /**
   * Create a mock work item for testing hierarchy validation
   */
  private createMockWorkItem(id: number, args: HierarchyValidatorArgs): WorkItemHierarchyInfo {
    // Create mock data based on the ID to simulate different scenarios
    const mockTypes = ['Epic', 'Feature', 'User Story', 'Task', 'Bug'];
    const mockStates = ['New', 'Active', 'Resolved', 'Closed'];
    
    const typeIndex = id % mockTypes.length;
    const stateIndex = id % mockStates.length;
    
    return {
      id: id,
      title: `Mock Work Item ${id}`,
      type: mockTypes[typeIndex],
      state: mockStates[stateIndex],
      currentParentId: id > 1000 ? Math.floor(id / 10) : undefined, // Some items have parents
      currentParentTitle: id > 1000 ? `Mock Parent ${Math.floor(id / 10)}` : undefined,
      areaPath: args.AreaPath || 'MockProject\\MockTeam',
      assignedTo: 'Mock User',
      description: `This is a mock description for work item ${id} used for testing hierarchy validation.`
    };
  }

  /**
   * Parse work item data for hierarchy analysis
   */
  private parseWorkItemForHierarchy(workItemData: any): WorkItemHierarchyInfo | null {
    try {
      const fields = workItemData.fields || {};
      const relations = workItemData.relations || [];
      
      // Find parent relationship
      let currentParentId: number | undefined;
      let currentParentTitle: string | undefined;
      
      const parentRelation = relations.find((rel: any) => 
        rel.rel === "System.LinkTypes.Hierarchy-Reverse"
      );
      
      if (parentRelation) {
        const parentUrl = parentRelation.url || '';
        const parentIdMatch = parentUrl.match(/\/(\d+)$/);
        if (parentIdMatch) {
          currentParentId = parseInt(parentIdMatch[1]);
          currentParentTitle = parentRelation.attributes?.name || 'Unknown Parent';
        }
      }
      
      return {
        id: workItemData.id,
        title: fields['System.Title'] || 'Untitled',
        type: fields['System.WorkItemType'] || 'Unknown',
        state: fields['System.State'] || 'Unknown',
        currentParentId,
        currentParentTitle,
        areaPath: fields['System.AreaPath'] || '',
        assignedTo: fields['System.AssignedTo']?.displayName,
        description: fields['System.Description'] || fields['Microsoft.VSTS.Common.ReproSteps'] || ''
      };
    } catch (error) {
      logger.warn(`Failed to parse work item data: ${error}`);
      return null;
    }
  }

  /**
   * Check if work item should be included in analysis
   */
  private shouldIncludeWorkItem(workItem: WorkItemHierarchyInfo, args: HierarchyValidatorArgs): boolean {
    // Filter by work item type
    if (args.FilterByWorkItemType && args.FilterByWorkItemType.length > 0) {
      if (!args.FilterByWorkItemType.includes(workItem.type)) {
        return false;
      }
    }
    
    // Exclude by state
    if (args.ExcludeStates && args.ExcludeStates.includes(workItem.state)) {
      return false;
    }
    
    return true;
  }

  /**
   * Perform the core hierarchy validation using AI sampling
   */
  private async performHierarchyValidation(workItems: WorkItemHierarchyInfo[], args: HierarchyValidatorArgs): Promise<HierarchyValidationResult> {
    const systemPrompt = `You are a senior project manager and Azure DevOps expert specializing in work item hierarchy analysis and optimization. Your role is to analyze work item parent-child relationships and identify issues with current parenting.

ANALYSIS FRAMEWORK:
1. **Hierarchy Best Practices**: Epic → Feature → User Story → Task pattern
2. **Logical Grouping**: Related items should share appropriate parents  
3. **Scope Alignment**: Child items should be subsets of parent scope
4. **Type Relationships**: Validate appropriate work item type hierarchies
5. **Content Analysis**: Use titles and descriptions to assess logical fit

ISSUE IDENTIFICATION:
- **Orphaned Items**: High-level items without appropriate parents
- **Misparented Items**: Items with parents that don't logically contain them
- **Incorrect Level**: Items at wrong hierarchy level for their scope
- **Type Mismatches**: Inappropriate parent-child type relationships

SUGGESTION CRITERIA:
- Consider content similarity and logical containment
- Respect work item type hierarchies
- Prioritize clear scope boundaries
- Account for team organization and area paths

Provide specific, actionable recommendations with confidence scores and clear reasoning.`;

    const userContent = this.formatWorkItemsForHierarchyAnalysis(workItems, args);
    
    const result = await this.server.createMessage({
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: userContent
        }
      }],
      maxTokens: 600,
      temperature: 0.3
    });

    return this.parseHierarchyValidationResponse(result, workItems, args);
  }

  /**
   * Format work items for hierarchy analysis
   */
  private formatWorkItemsForHierarchyAnalysis(workItems: WorkItemHierarchyInfo[], args: HierarchyValidatorArgs): string {
    let content = `HIERARCHY VALIDATION ANALYSIS

Analysis Type: ${args.AnalysisDepth || 'shallow'}
Total Work Items: ${workItems.length}
Area Path: ${args.AreaPath || 'Various'}

WORK ITEMS TO ANALYZE:
`;

    workItems.forEach((item, index) => {
      content += `\n${index + 1}. ID ${item.id}: ${item.title}
   Type: ${item.type} | State: ${item.state}
   Current Parent: ${item.currentParentId ? `#${item.currentParentId} (${item.currentParentTitle})` : 'None (Orphaned)'}
   Area: ${item.areaPath}`;
      
      if (args.AnalysisDepth === 'deep' && item.description) {
        const shortDesc = item.description.substring(0, 150).replace(/\s+/g, ' ').trim();
        content += `\n   Description: ${shortDesc}${item.description.length > 150 ? '...' : ''}`;
      }
    });

    content += `\n\nANALYSIS REQUIREMENTS:
- Identify hierarchy issues and improvement opportunities
- ${args.SuggestAlternatives ? 'Provide alternative parent suggestions' : 'Focus on issue identification'}
- ${args.IncludeConfidenceScores ? 'Include confidence scores (0-1) for recommendations' : 'Provide qualitative assessments'}
- Consider work item types, scope relationships, and logical grouping
- Prioritize suggestions by potential impact and ease of implementation

Please analyze each work item's current parenting and provide recommendations.`;

    return content;
  }

  /**
   * Parse hierarchy validation response from AI
   */
  private parseHierarchyValidationResponse(aiResult: any, workItems: WorkItemHierarchyInfo[], args: HierarchyValidatorArgs): HierarchyValidationResult {
    const responseText = aiResult?.content?.text || JSON.stringify(aiResult) || 'No analysis available';
    
    logger.debug(`Parsing hierarchy validation response:`, responseText.substring(0, 300) + '...');
    
    const issuesFound: Array<{
      workItemId: number;
      workItemTitle: string;
      issues: HierarchyValidationIssue[];
      parentingSuggestions: ParentingSuggestion[];
    }> = [];
    
    // Parse issues and suggestions for each work item
    workItems.forEach(workItem => {
      const issues: HierarchyValidationIssue[] = [];
      const parentingSuggestions: ParentingSuggestion[] = [];
      
      // Check for orphaned items
      if (!workItem.currentParentId) {
        // Determine if this should have a parent based on type
        const needsParent = ['Task', 'User Story', 'Bug', 'Test Case'].includes(workItem.type);
        if (needsParent) {
          issues.push({
            issueType: "orphaned",
            severity: workItem.type === 'Task' ? "medium" : "high",
            description: `${workItem.type} "${workItem.title}" has no parent work item`,
            recommendations: [`Find appropriate ${this.getRecommendedParentType(workItem.type)} to parent this item`]
          });
        }
      }
      
      // Extract AI suggestions from response text
      const workItemSection = this.extractWorkItemAnalysis(responseText, workItem.id, workItem.title);
      if (workItemSection) {
        const extractedIssues = this.extractIssuesFromAnalysis(workItemSection);
        issues.push(...extractedIssues);
        
        if (args.SuggestAlternatives) {
          const suggestions = this.extractParentingSuggestions(workItemSection, workItems, args.IncludeConfidenceScores || false);
          parentingSuggestions.push(...suggestions);
        }
      }
      
      // Only add to results if there are issues or suggestions
      if (issues.length > 0 || parentingSuggestions.length > 0) {
        issuesFound.push({
          workItemId: workItem.id,
          workItemTitle: workItem.title,
          issues,
          parentingSuggestions
        });
      }
    });
    
    // Calculate summary statistics
    const totalAnalyzed = workItems.length;
    const itemsWithIssues = issuesFound.length;
    const itemsWellParented = totalAnalyzed - itemsWithIssues;
    const orphanedItems = workItems.filter(item => !item.currentParentId).length;
    const incorrectlyParented = issuesFound.filter(item => 
      item.issues.some(issue => issue.issueType === 'misparented')
    ).length;
    
    // Generate recommendations
    const recommendations = this.generateHierarchyRecommendations(issuesFound, workItems);
    
    return {
      analysisContext: {
        analyzedItemCount: totalAnalyzed,
        areaPath: args.AreaPath,
        analysisDepth: args.AnalysisDepth || 'shallow',
        timestamp: new Date().toISOString()
      },
      workItemsAnalyzed: workItems,
      issuesFound,
      healthySummary: {
        totalAnalyzed,
        itemsWithIssues,
        itemsWellParented,
        orphanedItems,
        incorrectlyParented
      },
      recommendations
    };
  }

  /**
   * Get recommended parent type for a work item type
   */
  private getRecommendedParentType(childType: string): string {
    const parentTypeMap: { [key: string]: string } = {
      'Task': 'User Story or Bug',
      'User Story': 'Feature or Epic',
      'Bug': 'Feature or Epic',
      'Test Case': 'User Story or Feature',
      'Feature': 'Epic',
      'Epic': 'Initiative or Portfolio Item'
    };
    
    return parentTypeMap[childType] || 'appropriate parent';
  }

  /**
   * Extract work item analysis from AI response
   */
  private extractWorkItemAnalysis(responseText: string, itemId: number, itemTitle: string): string | null {
    // Look for sections mentioning the specific work item
    const patterns = [
      new RegExp(`(?:Item|ID)\\s*#?${itemId}[:\\s]([\\s\\S]*?)(?=(?:Item|ID)\\s*#?\\d+|$)`, 'i'),
      new RegExp(`${itemTitle}[:\\s]([\\s\\S]*?)(?=\\n\\n|$)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = responseText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Extract issues from work item analysis text
   */
  private extractIssuesFromAnalysis(analysisText: string): HierarchyValidationIssue[] {
    const issues: HierarchyValidationIssue[] = [];
    
    // Look for common issue indicators
    if (analysisText.toLowerCase().includes('orphaned') || analysisText.toLowerCase().includes('no parent')) {
      issues.push({
        issueType: "orphaned",
        severity: "medium",
        description: "Work item lacks appropriate parent relationship",
        recommendations: ["Find suitable parent work item based on scope and type"]
      });
    }
    
    if (analysisText.toLowerCase().includes('misparented') || analysisText.toLowerCase().includes('wrong parent')) {
      issues.push({
        issueType: "misparented",
        severity: "medium", 
        description: "Current parent relationship may not be optimal",
        recommendations: ["Review parent-child scope alignment", "Consider alternative parent options"]
      });
    }
    
    if (analysisText.toLowerCase().includes('wrong level') || analysisText.toLowerCase().includes('incorrect level')) {
      issues.push({
        issueType: "incorrect_level",
        severity: "low",
        description: "Work item may be at inappropriate hierarchy level",
        recommendations: ["Review hierarchy level appropriateness", "Consider moving to correct level"]
      });
    }
    
    return issues;
  }

  /**
   * Extract parenting suggestions from analysis text
   */
  private extractParentingSuggestions(analysisText: string, availableItems: WorkItemHierarchyInfo[], includeConfidence: boolean): ParentingSuggestion[] {
    const suggestions: ParentingSuggestion[] = [];
    
    // This is a simplified extraction - in a real implementation, you'd want more sophisticated parsing
    // For now, we'll provide generic suggestions based on work item types
    
    return suggestions; // Returning empty for now - real implementation would parse AI suggestions
  }

  /**
   * Generate hierarchy recommendations based on analysis
   */
  private generateHierarchyRecommendations(issuesFound: any[], workItems: WorkItemHierarchyInfo[]) {
    const highPriorityActions: string[] = [];
    const improvementSuggestions: string[] = [];
    const bestPractices: string[] = [];
    
    // High priority actions
    const orphanedCount = issuesFound.filter(item => 
      item.issues.some((issue: any) => issue.issueType === 'orphaned')
    ).length;
    
    if (orphanedCount > 0) {
      highPriorityActions.push(`Address ${orphanedCount} orphaned work items by finding appropriate parents`);
    }
    
    const misparentedCount = issuesFound.filter(item =>
      item.issues.some((issue: any) => issue.issueType === 'misparented')
    ).length;
    
    if (misparentedCount > 0) {
      highPriorityActions.push(`Review ${misparentedCount} potentially misparented items for better organization`);
    }
    
    // Improvement suggestions
    if (issuesFound.length > workItems.length * 0.3) {
      improvementSuggestions.push("Consider establishing clearer hierarchy guidelines for the team");
    }
    
    improvementSuggestions.push("Regular hierarchy reviews help maintain organized work item structure");
    improvementSuggestions.push("Use consistent work item type patterns (Epic → Feature → Story → Task)");
    
    // Best practices
    bestPractices.push("Ensure child work items are logical subsets of their parents");
    bestPractices.push("Use descriptive titles that clearly indicate scope and relationships");
    bestPractices.push("Maintain appropriate work item type hierarchies");
    bestPractices.push("Regular cleanup of orphaned and misplaced items improves team efficiency");
    
    return {
      highPriorityActions,
      improvementSuggestions,
      bestPractices
    };
  }


}