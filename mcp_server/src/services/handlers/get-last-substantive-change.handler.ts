/**
 * Get Last Substantive Change Handler
 * 
 * Efficiently determines the last meaningful change to a work item by analyzing
 * revision history server-side and filtering out automated changes.
 * Returns minimal data to avoid context window bloat.
 */

import { logger } from '../../utils/logger.js';
import { curlJson, getAzureDevOpsToken } from '../../utils/ado-token.js';
import { loadConfiguration } from '../../config/config.js';

interface LastSubstantiveChangeArgs {
  WorkItemId: number;
  Organization?: string;
  Project?: string;
  HistoryCount?: number;
  AutomatedPatterns?: string[];
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
  revision: any,
  previousRevision: any,
  automatedPatterns: string[]
): { isSubstantive: boolean; changeType: string } {
  
  // Check if changed by known automation account
  const changedBy = revision.fields?.['System.ChangedBy']?.displayName || 
                    revision.fields?.['System.ChangedBy'] || '';
  
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
  const Organization = args.Organization || cfg.azureDevOps.organization;
  const Project = args.Project || cfg.azureDevOps.project;
  const HistoryCount = args.HistoryCount || 50;
  const automatedPatterns = args.AutomatedPatterns || DEFAULT_AUTOMATION_PATTERNS;
  
  try {
    const token = getAzureDevOpsToken();
    
    // Get work item to extract created date
    const wiUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${args.WorkItemId}?$expand=none&api-version=7.1`;
    const workItem = curlJson(wiUrl, token);
    const createdDate = workItem.fields['System.CreatedDate'];
    const daysSinceCreation = daysBetween(createdDate);
    
    // Get revision history
    const revsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${args.WorkItemId}/revisions?$top=${HistoryCount}&api-version=7.1`;
    const historyResponse = curlJson(revsUrl, token);
    const revisions = historyResponse.value || [];
    
    if (revisions.length === 0) {
      return {
        workItemId: args.WorkItemId,
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
    revisions.sort((a: any, b: any) => {
      const dateA = new Date(a.fields['System.ChangedDate']).getTime();
      const dateB = new Date(b.fields['System.ChangedDate']).getTime();
      return dateB - dateA;
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
        lastSubstantiveChange = currentRev.fields['System.ChangedDate'];
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
      workItemId: args.WorkItemId,
      lastSubstantiveChange,
      daysInactive,
      lastChangeType,
      automatedChangesSkipped,
      allChangesWereAutomated,
      createdDate,
      daysSinceCreation
    };
    
  } catch (error) {
    logger.error(`Failed to get last substantive change for work item ${args.WorkItemId}:`, error);
    throw error;
  }
}
