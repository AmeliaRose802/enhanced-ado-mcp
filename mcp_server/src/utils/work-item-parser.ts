/**
 * Work item data parsing utilities
 */

import type { WorkItemHierarchyInfo, ADOWorkItem, ADORelation } from '../types/index.js';

/**
 * Escape area path for use in WIQL queries
 * WIQL only requires single quotes to be doubled (SQL-style escaping)
 * Backslashes do NOT need escaping in WIQL when using UNDER operator
 */
export function escapeAreaPath(areaPath: string): string {
  if (!areaPath) return '';
  // Replace single quotes with two single quotes (SQL/WIQL escaping)
  return areaPath.replace(/'/g, "''");
}

/**
 * Escape area path for use in OData queries
 * OData string literals require:
 * - Backslashes must be doubled: \ → \\
 * - Single quotes must be doubled: ' → ''
 * 
 * This is different from WIQL, which doesn't require backslash escaping
 * when using the UNDER operator.
 */
export function escapeAreaPathForOData(areaPath: string): string {
  if (!areaPath) return '';
  
  // First escape backslashes (must be done before quotes to avoid double-escaping)
  let escaped = areaPath.replace(/\\/g, '\\\\');
  
  // Then escape single quotes
  escaped = escaped.replace(/'/g, "''");
  
  return escaped;
}

export function parseWorkItemForHierarchy(workItemData: ADOWorkItem): WorkItemHierarchyInfo | null {
  try {
    const fields = workItemData.fields || {};
    const relations = workItemData.relations || [];
    
    let currentParentId: number | undefined;
    let currentParentTitle: string | undefined;
    
    const parentRelation = relations.find((rel: ADORelation) => 
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
      description: String(fields['System.Description'] || fields['Microsoft.VSTS.Common.ReproSteps'] || '')
    };
  } catch (error) {
    return null;
  }
}
