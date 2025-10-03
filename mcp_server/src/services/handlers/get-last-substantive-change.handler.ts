/**
 * Get Last Substantive Change Handler
 * 
 * Efficiently determines the last meaningful change to a work item by analyzing
 * revision history server-side and filtering out automated changes.
 * Returns minimal data to avoid context window bloat.
 */

import { logger } from '../../utils/logger.js';
import { createADOHttpClient } from '../../utils/ado-http-client.js';
import { loadConfiguration } from '../../config/config.js';
import type { ADOWorkItem, ADOApiResponse, ADOWorkItemRevision } from '../../types/ado.js';

interface WorkItemRevision {
  id?: number;
  rev?: number;
  fields?: Record<string, unknown>;
  url?: string;
  revisedDate?: string;
}

interface LastSubstantiveChangeArgs {
  workItemId: number;
  organization?: string;
  project?: string;
  historyCount?: number;
  automatedPatterns?: string[];
}

interface SubstantiveChangeResult {
  workItemId: number;
  lastSubstantiveChange: string | null;
  daysInactive: number | null;
  lastChangeType: string;
  automatedChangesSkipped: number;
  allChangesWereAutomated: boolean;
  createdDate: string;
  daysSinceCreation: number;
}

/**
 * Fields that indicate substantive changes when modified
 */
const SUBSTANTIVE_FIELDS = [
  'System.Description',
  'System.Title',
  'System.State',
  'System.AssignedTo',
  'Microsoft.VSTS.Common.Priority',
  'Microsoft.VSTS.Common.AcceptanceCriteria',
  'System.Tags'
];

/**
 * Fields that are typically automated/bulk updates
 * Includes backlog priority/stack rank changes which are often automated
 * reordering operations that don't indicate actual work progress
 */
const AUTOMATED_FIELDS = [
  'System.IterationPath',
  'System.AreaPath',
  'Microsoft.VSTS.Common.StackRank',
  'Microsoft.VSTS.Common.BacklogPriority',
  'Microsoft.VSTS.Scheduling.StoryPoints'  // Often bulk-adjusted during planning
];

/**
 * Optional automation account patterns (still supported), but iteration / area path only
 * changes are treated as non-substantive regardless of who performed them.
 */
const DEFAULT_AUTOMATION_PATTERNS = [
  'Project Collection Build Service',
  'Azure DevOps',
  'System Account'
];

/**
 * Determine if a revision represents a substantive change
 */
function isSubstantiveChange(
  revision: WorkItemRevision,
  previousRevision: WorkItemRevision | null,
  automatedPatterns: string[]
): { isSubstantive: boolean; changeType: string } {
  
  // Check if changed by known automation account
  const changedByValue = revision.fields?.['System.ChangedBy'];
  const changedBy = (typeof changedByValue === 'object' && changedByValue !== null && 'displayName' in changedByValue) 
    ? (changedByValue as {displayName: string}).displayName 
    : (typeof changedByValue === 'string' ? changedByValue : '');
  
  const isAutomatedUser = automatedPatterns.some(pattern => 
    changedBy.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (!previousRevision) {
    return { isSubstantive: true, changeType: 'Creation' };
  }
  
  // Compare fields to detect what changed
  const changedFields: string[] = [];
  
  for (const field of SUBSTANTIVE_FIELDS) {
    const currentValue = revision.fields?.[field];
    const previousValue = previousRevision.fields?.[field];
    
    if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
      changedFields.push(field);
    }
  }
  
  // Check if only automated fields changed
  const automatedFieldsChanged: string[] = [];
  for (const field of AUTOMATED_FIELDS) {
    const currentValue = revision.fields?.[field];
    const previousValue = previousRevision.fields?.[field];
    
    if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
      automatedFieldsChanged.push(field);
    }
  }
  
  // If only automated fields changed (iteration/area path churn) and NO substantive fields changed,
  // treat as non-substantive regardless of who made the change. These are administrative realignments.
  if (automatedFieldsChanged.length > 0 && changedFields.length === 0) {
    return {
      isSubstantive: false,
      changeType: `Automated: ${automatedFieldsChanged.join(', ')}`
    };
  }
  
  // If substantive fields changed, it's substantive
  if (changedFields.length > 0) {
    return { 
      isSubstantive: true, 
      changeType: changedFields.map(f => f.split('.').pop()).join(', ') 
    };
  }
  
  // (No remaining path where ONLY automated fields changed, because handled above.)
  
  // No detectable changes (shouldn't happen but handle gracefully)
  return { isSubstantive: false, changeType: 'Unknown' };
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string, date2: string = new Date().toISOString()): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get last substantive change for a work item
 */
export async function getLastSubstantiveChange(
  args: LastSubstantiveChangeArgs
): Promise<SubstantiveChangeResult> {
  const cfg = loadConfiguration();
  const organization = args.organization || cfg.azureDevOps.organization;
  const project = args.project || cfg.azureDevOps.project;
  const historyCount = args.historyCount || 50;
  const automatedPatterns = args.automatedPatterns || DEFAULT_AUTOMATION_PATTERNS;
  
  try {
    const httpClient = createADOHttpClient(organization, project);
    
    // Get work item to extract created date
    const wiResponse = await httpClient.get<ADOWorkItem>(`wit/workItems/${args.workItemId}?$expand=none`);
    const workItem = wiResponse.data;
    const createdDate = workItem.fields['System.CreatedDate'] || new Date().toISOString();
    const daysSinceCreation = daysBetween(createdDate);
    
    // Get revision history
    const historyResponse = await httpClient.get<ADOApiResponse<ADOWorkItemRevision[]>>(`wit/workItems/${args.workItemId}/revisions?$top=${historyCount}`);
    const historyData = historyResponse.data;
    const revisions = historyData.value || [];
    
    if (revisions.length === 0) {
      return {
        workItemId: args.workItemId,
        lastSubstantiveChange: null,
        daysInactive: null,
        lastChangeType: 'No history',
        automatedChangesSkipped: 0,
        allChangesWereAutomated: false,
        createdDate,
        daysSinceCreation
      };
    }
    
    // Sort revisions by date descending (newest first)
    revisions.sort((a: WorkItemRevision, b: WorkItemRevision) => {
      const dateA = a.fields?.['System.ChangedDate'];
      const dateB = b.fields?.['System.ChangedDate'];
      const timeA = typeof dateA === 'string' || typeof dateA === 'number' ? new Date(dateA).getTime() : 0;
      const timeB = typeof dateB === 'string' || typeof dateB === 'number' ? new Date(dateB).getTime() : 0;
      return timeB - timeA;
    });
    
    let automatedChangesSkipped = 0;
    let lastSubstantiveChange: string | null = null;
    let lastChangeType = 'Unknown';
    
    // Walk through revisions from newest to oldest
    for (let i = 0; i < revisions.length; i++) {
      const currentRev = revisions[i];
      const previousRev = i < revisions.length - 1 ? revisions[i + 1] : null;
      
      const analysis = isSubstantiveChange(currentRev, previousRev, automatedPatterns);
      
      if (analysis.isSubstantive) {
        lastSubstantiveChange = currentRev.fields['System.ChangedDate'] || createdDate;
        lastChangeType = analysis.changeType;
        break;
      } else {
        automatedChangesSkipped++;
      }
    }
    
    // If no substantive change found, use creation date
    if (!lastSubstantiveChange) {
      lastSubstantiveChange = createdDate;
      lastChangeType = 'No substantive changes since creation';
    }
    
    const daysInactive = lastSubstantiveChange ? daysBetween(lastSubstantiveChange) : null;
    const allChangesWereAutomated = automatedChangesSkipped === revisions.length;
    
    return {
      workItemId: args.workItemId,
      lastSubstantiveChange,
      daysInactive,
      lastChangeType,
      automatedChangesSkipped,
      allChangesWereAutomated,
      createdDate,
      daysSinceCreation
    };
    
  } catch (error) {
    logger.error(`Failed to get last substantive change for work item ${args.workItemId}:`, error);
    throw error;
  }
}
