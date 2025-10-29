/**
 * Hierarchy Analysis with Query Handles Handler
 * 
 * Enhanced hierarchy validation that groups violations by type and creates
 * query handles for each group, enabling direct bulk operations on problematic items.
 */

import type { ToolExecutionResult } from '../../../types/index.js';
import type { HierarchyValidatorArgs, WorkItemHierarchyInfo } from '../../../types/index.js';
import { asToolData } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';
import { queryHandleService } from '../../query-handle-service.js';
import { HierarchyValidatorAnalyzer } from '../../analyzers/hierarchy-validator.js';

interface ViolationGroup {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  queryHandle: string;
  workItemIds: number[];
  description: string;
  suggestedActions: string[];
  examples: Array<{
    id: number;
    title: string;
    issue: string;
  }>;
}

interface HierarchyAnalysisWithHandlesResult {
  summary: {
    totalAnalyzed: number;
    itemsWithIssues: number;
    itemsHealthy: number;
    violationGroupsCreated: number;
    analysisTimestamp: string;
  };
  violationGroups: ViolationGroup[];
  detailedIssues: any[];
  recommendations: {
    highPriorityActions: string[];
    improvementSuggestions: string[];
    bestPractices: string[];
  };
  queryHandles: {
    [key: string]: string;
  };
}

/**
 * Handle hierarchy analysis with query handle generation
 */
export async function handleHierarchyAnalysisWithHandles(
  config: any,
  args: HierarchyValidatorArgs,
  server: any
): Promise<ToolExecutionResult> {
  logger.info('Starting hierarchy analysis with query handle generation');

  try {
    // Create analyzer instance
    const analyzer = new HierarchyValidatorAnalyzer(server);

    // Perform standard hierarchy analysis
    const analysisResult = await analyzer.analyze(args);

    if (!analysisResult.success || !analysisResult.data) {
      return analysisResult;
    }

    const validationResult = analysisResult.data as any;

    // Group violations by type and create query handles
    const violationGroups = await groupViolationsAndCreateHandles(
      validationResult,
      args
    );

    // Build enhanced result
    const enhancedResult: HierarchyAnalysisWithHandlesResult = {
      summary: {
        totalAnalyzed: validationResult.healthySummary?.totalAnalyzed || validationResult.workItemsAnalyzed?.length || 0,
        itemsWithIssues: validationResult.healthySummary?.itemsWithIssues || 0,
        itemsHealthy: validationResult.healthySummary?.itemsWellParented || 0,
        violationGroupsCreated: violationGroups.length,
        analysisTimestamp: new Date().toISOString()
      },
      violationGroups,
      detailedIssues: validationResult.issuesFound || [],
      recommendations: validationResult.recommendations || {
        highPriorityActions: [],
        improvementSuggestions: [],
        bestPractices: []
      },
      queryHandles: violationGroups.reduce((acc, group) => {
        acc[group.type] = group.queryHandle;
        return acc;
      }, {} as Record<string, string>)
    };

    logger.info(`Created ${violationGroups.length} violation groups with query handles`);

    return {
      success: true,
      data: asToolData(enhancedResult),
      errors: [],
      warnings: [],
      metadata: {
        source: 'hierarchy-analysis-with-handles',
        violationGroupCount: violationGroups.length,
        totalIssues: validationResult.healthySummary?.itemsWithIssues || 0
      }
    };

  } catch (error) {
    logger.error('Hierarchy analysis with handles failed:', error);
    return {
      success: false,
      data: null,
      errors: [`Hierarchy analysis failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      metadata: { source: 'hierarchy-analysis-with-handles-error' }
    };
  }
}

/**
 * Group violations by type and create query handles for each group
 */
async function groupViolationsAndCreateHandles(
  validationResult: any,
  args: HierarchyValidatorArgs
): Promise<ViolationGroup[]> {
  const groups: Map<string, {
    ids: Set<number>;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    actions: Set<string>;
    examples: Array<{ id: number; title: string; issue: string }>;
  }> = new Map();

  // Initialize violation categories
  const violationTypes = {
    'orphaned_items': {
      severity: 'critical' as const,
      description: 'Work items without required parent relationships',
      actions: ['Link to appropriate parent', 'Review backlog structure']
    },
    'incorrect_parent_type': {
      severity: 'high' as const,
      description: 'Work items with wrong parent type (e.g., Task under Epic)',
      actions: ['Reparent under correct work item type', 'Review hierarchy rules']
    },
    'state_progression_issues': {
      severity: 'medium' as const,
      description: 'Parent and child items with inconsistent states',
      actions: ['Update parent state to match children', 'Review state workflow']
    },
    'missing_assignments': {
      severity: 'low' as const,
      description: 'Active work items without assigned owners',
      actions: ['Assign to team members', 'Review capacity planning']
    },
    'circular_dependencies': {
      severity: 'critical' as const,
      description: 'Work items with circular parent-child relationships',
      actions: ['Break circular link', 'Restructure hierarchy']
    },
    'depth_violations': {
      severity: 'medium' as const,
      description: 'Hierarchy exceeds recommended nesting depth',
      actions: ['Flatten hierarchy', 'Consolidate intermediate levels']
    }
  };

  // Initialize all groups
  for (const [type, config] of Object.entries(violationTypes)) {
    groups.set(type, {
      ids: new Set(),
      severity: config.severity,
      description: config.description,
      actions: new Set(config.actions),
      examples: []
    });
  }

  // Process issues and categorize them
  const issuesFound = validationResult.issuesFound || [];
  
  for (const item of issuesFound) {
    const workItemId = item.workItemId;
    const workItemTitle = item.workItemTitle || 'Unknown';
    const issues = item.issues || [];

    for (const issue of issues) {
      const issueType = issue.type || '';
      const issueDescription = issue.description || '';

      // Categorize issue
      let category: string | null = null;

      if (issueType.includes('orphan') || issueDescription.toLowerCase().includes('no parent')) {
        category = 'orphaned_items';
      } else if (issueType.includes('parent') && issueType.includes('type')) {
        category = 'incorrect_parent_type';
      } else if (issueType.includes('state') || issueDescription.toLowerCase().includes('state')) {
        category = 'state_progression_issues';
      } else if (issueType.includes('unassigned') || issueDescription.toLowerCase().includes('not assigned')) {
        category = 'missing_assignments';
      } else if (issueType.includes('circular') || issueDescription.toLowerCase().includes('circular')) {
        category = 'circular_dependencies';
      } else if (issueType.includes('depth') || issueDescription.toLowerCase().includes('too deep')) {
        category = 'depth_violations';
      }

      if (category && groups.has(category)) {
        const group = groups.get(category)!;
        group.ids.add(workItemId);
        
        // Add example (limit to 5 per group)
        if (group.examples.length < 5) {
          group.examples.push({
            id: workItemId,
            title: workItemTitle,
            issue: issueDescription
          });
        }

        // Add any additional suggested actions from the issue
        if (item.parentingSuggestions) {
          for (const suggestion of item.parentingSuggestions) {
            if (suggestion.action) {
              group.actions.add(suggestion.action);
            }
          }
        }
      }
    }
  }

  // Create query handles for each non-empty group
  const violationGroups: ViolationGroup[] = [];

  for (const [type, groupData] of groups.entries()) {
    if (groupData.ids.size === 0) {
      continue; // Skip empty groups
    }

    const workItemIds = Array.from(groupData.ids);
    
    // Create work item context for query handle
    const workItemContext = new Map(
      workItemIds.map(id => {
        const item = issuesFound.find((i: any) => i.workItemId === id);
        return [id, {
          id,
          title: item?.workItemTitle || 'Unknown',
          state: 'Active', // Default, will be fetched if needed
          type: 'Unknown'
        }];
      })
    );

    // Create query handle
    const wiqlQuery = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] 
FROM WorkItems 
WHERE [System.Id] IN (${workItemIds.join(',')})`;

    const queryHandle = queryHandleService.storeQuery(
      workItemIds,
      wiqlQuery,
      {
        project: args.Project || 'Unknown',
        queryType: 'wiql' as const
      },
      3600000, // 1 hour TTL
      workItemContext
    );

    violationGroups.push({
      type,
      severity: groupData.severity,
      count: workItemIds.length,
      queryHandle,
      workItemIds,
      description: groupData.description,
      suggestedActions: Array.from(groupData.actions),
      examples: groupData.examples
    });

    logger.debug(`Created query handle ${queryHandle} for ${type} with ${workItemIds.length} items`);
  }

  // Sort by severity (critical first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  violationGroups.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return violationGroups;
}
