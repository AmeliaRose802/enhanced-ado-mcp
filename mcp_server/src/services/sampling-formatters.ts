/**
 * Formatting utilities for sampling requests
 */

import type { 
  WorkItemIntelligenceArgs, 
  AIAssignmentAnalyzerArgs, 
  FeatureDecomposerArgs,
  WorkItemHierarchyInfo,
  HierarchyValidatorArgs,
  DecomposedWorkItem
} from './sampling-types.js';

export function formatWorkItemForAnalysis(args: WorkItemIntelligenceArgs): string {
  let content = `WORK ITEM ANALYSIS REQUEST

Title: ${args.Title}
Type: ${args.WorkItemType || 'Not specified'}

Description:
${args.Description || 'No description provided'}

Acceptance Criteria:
${args.AcceptanceCriteria || 'No acceptance criteria provided'}`;

  if (args.ContextInfo) {
    content += `\n\nContext Information:\n${args.ContextInfo}`;
  }

  return content;
}

export function formatWorkItemForAIAnalysis(args: AIAssignmentAnalyzerArgs): string {
  let content = `WORK ITEM AI ASSIGNMENT ANALYSIS

Title: ${args.Title}
Type: ${args.WorkItemType || 'Not specified'}
Priority: ${args.Priority || 'Not specified'}

Description:
${args.Description || 'No description provided'}

Acceptance Criteria:
${args.AcceptanceCriteria || 'No acceptance criteria provided'}`;

  if (args.Labels) content += `\n\nLabels/Tags: ${args.Labels}`;
  if (args.EstimatedFiles) content += `\n\nEstimated Files to Touch: ${args.EstimatedFiles}`;
  if (args.TechnicalContext) content += `\n\nTechnical Context: ${args.TechnicalContext}`;
  if (args.ExternalDependencies) content += `\n\nExternal Dependencies: ${args.ExternalDependencies}`;
  if (args.TimeConstraints) content += `\n\nTime Constraints: ${args.TimeConstraints}`;
  if (args.RiskFactors) content += `\n\nKnown Risk Factors: ${args.RiskFactors}`;
  if (args.TestingRequirements) content += `\n\nTesting Requirements: ${args.TestingRequirements}`;

  content += `\n\nProvide your analysis with specific reasoning for the assignment decision.`;

  return content;
}

export function formatFeatureForDecomposition(args: FeatureDecomposerArgs): string {
  let content = `FEATURE DECOMPOSITION REQUEST

Feature Title: ${args.Title}
Target Work Item Type: ${args.WorkItemType || 'Task'}
Target Complexity: ${args.TargetComplexity || 'medium'}
Maximum Items: ${args.MaxItems || 8}

Feature Description:
${args.Description || 'No description provided'}`;

  if (args.BusinessContext) content += `\n\nBusiness Context:\n${args.BusinessContext}`;
  if (args.TechnicalContext) content += `\n\nTechnical Context:\n${args.TechnicalContext}`;
  if (args.ExistingComponents) content += `\n\nExisting Components/Systems:\n${args.ExistingComponents}`;
  if (args.Dependencies) content += `\n\nKnown Dependencies:\n${args.Dependencies}`;
  if (args.QualityRequirements) content += `\n\nQuality Requirements:\n${args.QualityRequirements}`;
  if (args.TimeConstraints) content += `\n\nTime Constraints:\n${args.TimeConstraints}`;

  content += `\n\nRequests:
- Generate acceptance criteria: ${args.GenerateAcceptanceCriteria ? 'Yes' : 'No'}
- Analyze AI suitability: ${args.AnalyzeAISuitability ? 'Yes' : 'No'}

Please provide a comprehensive breakdown with implementation strategy and reasoning.`;

  return content;
}

export function formatWorkItemsForHierarchyAnalysis(workItems: WorkItemHierarchyInfo[], args: HierarchyValidatorArgs): string {
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

export function buildItemTags(baseTags: string | undefined, item: DecomposedWorkItem): string {
  const tags = [];
  
  if (baseTags) tags.push(baseTags);
  
  tags.push("Feature-Decomposed", `Complexity-${item.complexity}`);
  
  if (item.aiSuitability) {
    tags.push(`AI-${item.aiSuitability.replace('_', '-')}`);
  }
  
  return tags.join(';');
}
