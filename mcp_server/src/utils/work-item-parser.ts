/**
 * Work item data parsing utilities
 */

import type { WorkItemHierarchyInfo } from '../services/sampling-types.js';

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

export function createMockWorkItem(id: number, areaPath?: string): WorkItemHierarchyInfo {
  const mockTypes = ['Epic', 'Feature', 'User Story', 'Task', 'Bug'];
  const mockStates = ['New', 'Active', 'Resolved', 'Closed'];
  
  return {
    id,
    title: `Mock Work Item ${id}`,
    type: mockTypes[id % mockTypes.length],
    state: mockStates[id % mockStates.length],
    currentParentId: id > 1000 ? Math.floor(id / 10) : undefined,
    currentParentTitle: id > 1000 ? `Mock Parent ${Math.floor(id / 10)}` : undefined,
    areaPath: areaPath || 'MockProject\\MockTeam',
    assignedTo: 'Mock User',
    description: `Mock description for work item ${id}`
  };
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
