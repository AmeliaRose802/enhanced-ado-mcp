/**
 * Handler for wit-validate-hierarchy tool
 * Fast validation of work item hierarchy relationships and state consistency
 * Non-intelligent: applies strict rules for parent-child types and state progression
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { logger } from "../../../utils/logger.js";
import { escapeAreaPath } from "../../../utils/work-item-parser.js";

interface ValidateHierarchyArgs {
  workItemIds?: number[];
  areaPath?: string;
  organization: string;
  project: string;
  maxResults?: number;
  includeSubAreas?: boolean;
  validateTypes?: boolean;
  validateStates?: boolean;
}

interface HierarchyViolation {
  workItemId: number;
  title: string;
  type: string;
  state: string;
  parentId?: number;
  parentTitle?: string;
  parentType?: string;
  parentState?: string;
  violationType: 'invalid_parent_type' | 'invalid_state_progression' | 'orphaned_child';
  severity: 'error' | 'warning';
  issue: string;
  expectedCorrection: string;
}

// Define valid parent-child type relationships (Azure DevOps standard hierarchy)
const VALID_CHILD_TYPES: Record<string, string[]> = {
  'Key Result': ['Epic'],
  'Epic': ['Feature'],
  'Feature': ['Product Backlog Item', 'User Story'],
  'Product Backlog Item': ['Task', 'Bug'],
  'User Story': ['Task', 'Bug'],
  'Task': [], // Tasks don't have children
  'Bug': []  // Bugs don't have children
};

// Define state progression rules
// Parent cannot be in an earlier state than active children
const STATE_HIERARCHY: Record<string, number> = {
  'New': 1,
  'Proposed': 1,
  'To Do': 1,
  'Active': 2,
  'Committed': 2,
  'In Progress': 2,
  'Doing': 2,
  'Resolved': 3,
  'Done': 4,
  'Completed': 4,
  'Closed': 4,
  'Removed': 5
};

/**
 * Check if a child type is valid for a parent type
 */
function isValidChildType(parentType: string, childType: string): boolean {
  const validChildren = VALID_CHILD_TYPES[parentType];
  if (!validChildren) {
    return false; // Unknown parent type
  }
  return validChildren.includes(childType);
}

/**
 * Check if parent state is consistent with child state
 * Parent cannot be "New" if child is "Active" or "Done"
 * Parent cannot be "Done" if child is still "Active" or "New"
 */
function isValidStateProgression(parentState: string, childState: string): { valid: boolean; issue?: string } {
  const parentLevel = STATE_HIERARCHY[parentState];
  const childLevel = STATE_HIERARCHY[childState];

  if (parentLevel === undefined || childLevel === undefined) {
    // Unknown states - skip validation
    return { valid: true };
  }

  // Parent cannot be in initial state (New) if child is active or beyond
  if (parentLevel === 1 && childLevel >= 2) {
    return {
      valid: false,
      issue: `Parent is in '${parentState}' but child is in '${childState}'. Parent should be at least 'Active' when children are in progress.`
    };
  }

  // Parent cannot be Done/Completed if child is not also done
  if (parentLevel === 4 && childLevel < 3) {
    return {
      valid: false,
      issue: `Parent is in '${parentState}' but child is still '${childState}'. All children must be completed or resolved before parent can be marked done.`
    };
  }

  return { valid: true };
}

export async function handleValidateHierarchy(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      throw new Error(azValidation.error || "Azure CLI validation failed");
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      throw new Error(`Validation error: ${parsed.error.message}`);
    }

    const {
      workItemIds,
      areaPath,
      organization,
      project,
      maxResults = 500,
      includeSubAreas = true,
      validateTypes = true,
      validateStates = true
    } = parsed.data as ValidateHierarchyArgs;

    logger.debug(`Validating hierarchy (types=${validateTypes}, states=${validateStates})`);

    let workItems: Array<{id: number; title: string; type: string; state: string; additionalFields?: Record<string, unknown>}> = [];

    // Get work items either by IDs or area path
    if (workItemIds && workItemIds.length > 0) {
      const result = await queryWorkItemsByWiql({
        wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${workItemIds.join(',')})`,
        organization,
        project,
        includeFields: ['System.Parent', 'System.State', 'System.WorkItemType', 'System.Title'],
        maxResults: workItemIds.length
      });
      workItems = result.workItems;
    } else if (areaPath) {
      const escapedAreaPath = escapeAreaPath(areaPath);
      const areaClause = includeSubAreas ? `[System.AreaPath] UNDER '${escapedAreaPath}'` : `[System.AreaPath] = '${escapedAreaPath}'`;
      const result = await queryWorkItemsByWiql({
        wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE ${areaClause} AND [System.State] NOT IN ('Removed', 'Closed', 'Done', 'Completed', 'Resolved') ORDER BY [System.WorkItemType], [System.Id]`,
        organization,
        project,
        includeFields: ['System.Parent', 'System.State', 'System.WorkItemType', 'System.Title'],
        maxResults
      });
      workItems = result.workItems;
    } else {
      throw new Error('Either workItemIds or areaPath must be provided');
    }

    logger.debug(`Analyzing ${workItems.length} work items for hierarchy violations`);

    const violations: HierarchyViolation[] = [];
    const parentIds = new Set<number>();
    
    // Collect all parent IDs that need to be fetched
    for (const item of workItems) {
      const parentId = item.additionalFields?.['System.Parent'];
      if (typeof parentId === 'number') {
        parentIds.add(parentId);
      }
    }

    // Fetch parent work items in batch if needed
    const parentMap = new Map<number, {id: number; title: string; type: string; state: string}>();
    if (parentIds.size > 0 && (validateTypes || validateStates)) {
      const parentIdArray = Array.from(parentIds);
      
      // Fetch in batches of 200 to avoid URL length limits
      for (let i = 0; i < parentIdArray.length; i += 200) {
        const batch = parentIdArray.slice(i, i + 200);
        const result = await queryWorkItemsByWiql({
          wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${batch.join(',')})`,
          organization,
          project,
          includeFields: ['System.State', 'System.WorkItemType', 'System.Title'],
          maxResults: batch.length
        });
        
        for (const parent of result.workItems) {
          parentMap.set(parent.id, parent);
        }
      }
    }

    // Validate each work item
    for (const item of workItems) {
      const parentId = item.additionalFields?.['System.Parent'];
      
      if (typeof parentId === 'number') {
        const parent = parentMap.get(parentId);
        
        if (!parent) {
          // Parent exists but is outside the scope (possibly Removed/Closed)
          violations.push({
            workItemId: item.id,
            title: item.title,
            type: item.type,
            state: item.state,
            parentId: parentId,
            violationType: 'orphaned_child',
            severity: 'warning',
            issue: `Parent work item #${parentId} not found or is in Removed/Closed state`,
            expectedCorrection: `Verify parent #${parentId} exists and is in an active state, or unlink this item from its parent`
          });
          continue;
        }

        // Validate parent-child type relationship
        if (validateTypes) {
          if (!isValidChildType(parent.type, item.type)) {
            violations.push({
              workItemId: item.id,
              title: item.title,
              type: item.type,
              state: item.state,
              parentId: parent.id,
              parentTitle: parent.title,
              parentType: parent.type,
              parentState: parent.state,
              violationType: 'invalid_parent_type',
              severity: 'error',
              issue: `${item.type} cannot be a child of ${parent.type}`,
              expectedCorrection: `Valid children for ${parent.type}: ${VALID_CHILD_TYPES[parent.type]?.join(', ') || 'none'}`
            });
          }
        }

        // Validate state progression
        if (validateStates) {
          const stateCheck = isValidStateProgression(parent.state, item.state);
          if (!stateCheck.valid) {
            violations.push({
              workItemId: item.id,
              title: item.title,
              type: item.type,
              state: item.state,
              parentId: parent.id,
              parentTitle: parent.title,
              parentType: parent.type,
              parentState: parent.state,
              violationType: 'invalid_state_progression',
              severity: 'warning',
              issue: stateCheck.issue || 'Invalid state progression',
              expectedCorrection: `Update parent to appropriate state or adjust child state to align with parent`
            });
          }
        }
      } else {
        // No parent - check if this should have a parent
        const shouldHaveParent = !['Key Result', 'Epic'].includes(item.type);
        
        if (shouldHaveParent) {
          violations.push({
            workItemId: item.id,
            title: item.title,
            type: item.type,
            state: item.state,
            violationType: 'orphaned_child',
            severity: 'warning',
            issue: `${item.type} has no parent link`,
            expectedCorrection: `${item.type} items should be linked to a parent (e.g., ${getExpectedParentTypes(item.type).join(' or ')})`
          });
        }
      }
    }

    // Categorize violations
    const byType = {
      invalid_parent_type: violations.filter(v => v.violationType === 'invalid_parent_type'),
      invalid_state_progression: violations.filter(v => v.violationType === 'invalid_state_progression'),
      orphaned_child: violations.filter(v => v.violationType === 'orphaned_child')
    };

    const bySeverity = {
      error: violations.filter(v => v.severity === 'error'),
      warning: violations.filter(v => v.severity === 'warning')
    };

    return {
      success: true,
      data: asToolData({
        summary: {
          totalItemsAnalyzed: workItems.length,
          totalViolations: violations.length,
          errors: bySeverity.error.length,
          warnings: bySeverity.warning.length,
          byViolationType: {
            invalid_parent_type: byType.invalid_parent_type.length,
            invalid_state_progression: byType.invalid_state_progression.length,
            orphaned_child: byType.orphaned_child.length
          }
        },
        violations: violations,
        categorized: {
          byType,
          bySeverity
        },
        validationRules: {
          validChildTypes: VALID_CHILD_TYPES,
          stateHierarchy: STATE_HIERARCHY
        }
      }),
      metadata: {
        source: "validate-hierarchy",
        itemsAnalyzed: workItems.length,
        violationCount: violations.length
      },
      errors: [],
      warnings: violations.length > 0 ? [`Found ${violations.length} hierarchy violations`] : []
    };
  } catch (error) {
    logger.error('Validate hierarchy error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "validate-hierarchy" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Get expected parent types for a given work item type
 */
function getExpectedParentTypes(childType: string): string[] {
  const parentTypes: string[] = [];
  
  for (const [parentType, validChildren] of Object.entries(VALID_CHILD_TYPES)) {
    if (validChildren.includes(childType)) {
      parentTypes.push(parentType);
    }
  }
  
  return parentTypes;
}
