/**
 * Work item data parsing utilities
 */

import type { WorkItemHierarchyInfo } from '../types/index.js';

/**
 * Escape area path for use in WIQL and OData queries
 * Handles single quotes by doubling them (SQL/WIQL escaping)
 */
export function escapeAreaPath(areaPath: string): string {
  if (!areaPath) return '';
  // Replace single quotes with two single quotes (SQL/WIQL escaping)
  return areaPath.replace(/'/g, "''");
}

export function parseWorkItemForHierarchy(workItemData: any): WorkItemHierarchyInfo | null {
  try {
    const fields = workItemData.fields || {};
    const relations = workItemData.relations || [];
    
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
        currentParentTitle = `Parent #${currentParentId}`;
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
    return null;
  }
}

export function getRecommendedParentType(childType: string): string {
  const parentTypeMap: Record<string, string> = {
    'Task': 'User Story or Bug',
    'User Story': 'Feature or Epic',
    'Bug': 'Feature or Epic',
    'Test Case': 'User Story or Feature',
    'Feature': 'Epic',
    'Epic': 'Initiative or Portfolio Item'
  };
  
  return parentTypeMap[childType] || 'appropriate parent';
}
