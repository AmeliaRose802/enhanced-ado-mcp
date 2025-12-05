/**
 * Fast rule-based hierarchy validation for work items
 * Used by wit-analyze-by-query-handle when analysisType includes 'hierarchy'
 */

import type { ADOWorkItem } from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import { queryHandleService } from '../query-handle-service.js';
import { ADOHttpClient } from '@/utils/ado-http-client.js';
import { getTokenProvider } from '@/utils/token-provider.js';

interface HierarchyViolation {
  child_id: number;
  child_type: string;
  child_title: string;
  child_state: string;
  parent_id?: number;
  parent_type?: string;
  parent_state?: string;
  violation: string;
  violation_type: 'type_mismatch' | 'state_inconsistency' | 'orphaned';
}

interface FastHierarchyValidationResult {
  summary: {
    totalItemsAnalyzed: number;
    totalViolations: number;
    errors: number;
    warnings: number;
  };
  type_violations: HierarchyViolation[];
  state_violations: HierarchyViolation[];
  orphaned_items: HierarchyViolation[];
  violation_query_handles?: {
    type_violations?: string;
    state_violations?: string;
    orphaned_items?: string;
  };
}

/**
 * Perform fast rule-based hierarchy validation
 */
export async function performFastHierarchyValidation(
  workItems: ADOWorkItem[],
  organization: string,
  project: string,
  options: {
    validateTypes?: boolean;
    validateStates?: boolean;
    returnQueryHandles?: boolean;
  } = {}
): Promise<FastHierarchyValidationResult> {
  const { validateTypes = true, validateStates = true, returnQueryHandles = true } = options;

  logger.debug(`Performing fast hierarchy validation on ${workItems.length} items`);

  const typeViolations: HierarchyViolation[] = [];
  const stateViolations: HierarchyViolation[] = [];
  const orphanedItems: HierarchyViolation[] = [];

  // Build parent lookup map
  const httpClient = new ADOHttpClient(organization, getTokenProvider(), project);
  const parentMap = await fetchParentRelations(workItems, httpClient);

  // Validate each work item
  for (const item of workItems) {
    const itemId = item.id;
    const itemType = item.fields?.['System.WorkItemType'] || 'Unknown';
    const itemTitle = item.fields?.['System.Title'] || '';
    const itemState = item.fields?.['System.State'] || '';
    const parentId = parentMap.get(itemId);

    // Check for orphaned items (no parent when one is expected)
    if (!parentId && shouldHaveParent(itemType)) {
      orphanedItems.push({
        child_id: itemId,
        child_type: itemType,
        child_title: itemTitle,
        child_state: itemState,
        violation: `${itemType} should have a parent but is orphaned`,
        violation_type: 'orphaned'
      });
      continue;
    }

    // Skip if no parent (and it's okay to not have one)
    if (!parentId) {
      continue;
    }

    // Find parent work item
    const parentItem = workItems.find(wi => wi.id === parentId);
    if (!parentItem) {
      // Parent not in the current set, skip validation
      continue;
    }

    const parentType = parentItem.fields?.['System.WorkItemType'] || 'Unknown';
    const parentState = parentItem.fields?.['System.State'] || '';

    // Type validation
    if (validateTypes && !isValidParentChildType(parentType, itemType)) {
      typeViolations.push({
        child_id: itemId,
        child_type: itemType,
        child_title: itemTitle,
        child_state: itemState,
        parent_id: parentId,
        parent_type: parentType,
        violation: `${itemType} cannot be direct child of ${parentType}. Expected hierarchy: Epic -> Feature -> PBI -> Task/Bug`,
        violation_type: 'type_mismatch'
      });
    }

    // State validation
    if (validateStates && !isValidParentChildState(parentState, itemState)) {
      stateViolations.push({
        child_id: itemId,
        child_type: itemType,
        child_title: itemTitle,
        child_state: itemState,
        parent_id: parentId,
        parent_type: parentType,
        parent_state: parentState,
        violation: `Child is ${itemState} but parent is ${parentState}`,
        violation_type: 'state_inconsistency'
      });
    }
  }

  const result: FastHierarchyValidationResult = {
    summary: {
      totalItemsAnalyzed: workItems.length,
      totalViolations: typeViolations.length + stateViolations.length + orphanedItems.length,
      errors: typeViolations.length,
      warnings: stateViolations.length + orphanedItems.length
    },
    type_violations: typeViolations,
    state_violations: stateViolations,
    orphaned_items: orphanedItems
  };

  // Create query handles for violation categories if requested
  if (returnQueryHandles) {
    const violationHandles: Record<string, string> = {};

    if (typeViolations.length > 0) {
      const ids = typeViolations.map(v => v.child_id);
      const handle = queryHandleService.storeQuery(
        ids,
        'Type violations from hierarchy analysis',
        { project, queryType: 'hierarchy-type-violations' }
      );
      violationHandles.type_violations = handle;
    }

    if (stateViolations.length > 0) {
      const ids = stateViolations.map(v => v.child_id);
      const handle = queryHandleService.storeQuery(
        ids,
        'State violations from hierarchy analysis',
        { project, queryType: 'hierarchy-state-violations' }
      );
      violationHandles.state_violations = handle;
    }

    if (orphanedItems.length > 0) {
      const ids = orphanedItems.map(v => v.child_id);
      const handle = queryHandleService.storeQuery(
        ids,
        'Orphaned items from hierarchy analysis',
        { project, queryType: 'hierarchy-orphaned-items' }
      );
      violationHandles.orphaned_items = handle;
    }

    if (Object.keys(violationHandles).length > 0) {
      result.violation_query_handles = violationHandles;
    }
  }

  return result;
}

/**
 * Fetch parent relations for work items
 */
async function fetchParentRelations(
  workItems: ADOWorkItem[],
  httpClient: ADOHttpClient
): Promise<Map<number, number>> {
  const parentMap = new Map<number, number>();

  // Batch fetch relations
  const batchSize = 50;
  for (let i = 0; i < workItems.length; i += batchSize) {
    const batch = workItems.slice(i, i + batchSize);
    const ids = batch.map(wi => wi.id).join(',');

    try {
      const response = await httpClient.get<any>(
        `wit/workitems?ids=${ids}&$expand=Relations`
      );

      if (response.data?.value) {
        for (const item of response.data.value) {
          interface RelationObject {
            rel: string;
            url: string;
            attributes?: Record<string, string>;
          }
          
          const parentRelation = item.relations?.find((r: RelationObject) => 
            r.rel === 'System.LinkTypes.Hierarchy-Reverse'
          );
          if (parentRelation?.url) {
            const parentId = parseInt(parentRelation.url.split('/').pop() || '0');
            if (parentId > 0) {
              parentMap.set(item.id, parentId);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to fetch relations for batch: ${error}`);
    }
  }

  return parentMap;
}

/**
 * Check if work item type should have a parent
 */
function shouldHaveParent(type: string): boolean {
  const typesRequiringParent = ['Task', 'Bug', 'Product Backlog Item', 'User Story', 'Feature'];
  return typesRequiringParent.includes(type);
}

/**
 * Validate parent-child type relationship
 */
function isValidParentChildType(parentType: string, childType: string): boolean {
  const validRelationships: Record<string, string[]> = {
    'Epic': ['Feature'],
    'Feature': ['Product Backlog Item', 'User Story'],
    'Product Backlog Item': ['Task', 'Bug'],
    'User Story': ['Task', 'Bug']
  };

  return validRelationships[parentType]?.includes(childType) || false;
}

/**
 * Validate parent-child state consistency
 */
function isValidParentChildState(parentState: string, childState: string): boolean {
  // Active/In Progress children should not have Closed/Done parents
  const activeStates = ['Active', 'In Progress', 'Committed', 'New'];
  const closedStates = ['Closed', 'Done', 'Removed', 'Completed'];

  if (activeStates.includes(childState) && closedStates.includes(parentState)) {
    return false;
  }

  return true;
}
