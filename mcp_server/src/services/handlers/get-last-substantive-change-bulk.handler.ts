import { logger } from '../../utils/logger.js';
import { curlJson, getAzureDevOpsToken } from '../../utils/ado-token.js';
import { loadConfiguration } from '../../config/config.js';

interface BulkSubstantiveChangeArgs {
  WorkItemIds: number[];
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

interface BulkSubstantiveChangeResult {
  results: SubstantiveChangeResult[];
  summary: {
    totalItems: number;
    successCount: number;
    errorCount: number;
    averageDaysInactive: number;
    itemsWithOnlyAutomatedChanges: number;
  };
  errors: Array<{ workItemId: number; error: string }>;
}

// Optional automation account patterns (still supported). Iteration / area path only
// changes are considered non-substantive regardless of actor.
const DEFAULT_AUTOMATION_PATTERNS = [
  'Project Collection Build Service',
  'Azure DevOps',
  'System Account',
  'Bot',
];

// Fields that indicate substantive changes
const SUBSTANTIVE_FIELDS = [
  'System.Description',
  'System.Title',
  'System.State',
  'System.AssignedTo',
  'Microsoft.VSTS.Common.Priority',
  'Microsoft.VSTS.Common.AcceptanceCriteria',
  'System.Tags',
  'Microsoft.VSTS.Common.ReproSteps',
];

// Fields that are typically automated/bulk updates
// Includes backlog priority/stack rank changes which are often automated
// reordering operations that don't indicate actual work progress
const AUTOMATED_FIELDS = [
  'System.IterationPath',
  'System.AreaPath',
  'Microsoft.VSTS.Common.StackRank',
  'Microsoft.VSTS.Common.BacklogPriority',
  'Microsoft.VSTS.Scheduling.StoryPoints',  // Often bulk-adjusted during planning
];

function daysBetween(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isSubstantiveChange(
  currentRev: any,
  previousRev: any,
  automatedPatterns: string[]
): { isSubstantive: boolean; changeType: string } {
  if (!previousRev) {
    return { isSubstantive: false, changeType: 'Creation' };
  }

  const changedBy = currentRev.fields['System.ChangedBy']?.displayName || '';
  const isAutomatedAccount = automatedPatterns.some((pattern) =>
    changedBy.includes(pattern)
  ); // retained for future extensibility

  // Check what fields changed
  const changedFields: string[] = [];
  for (const field of SUBSTANTIVE_FIELDS) {
    if (currentRev.fields[field] !== previousRev.fields[field]) {
      changedFields.push(field);
    }
  }

  const automatedFieldsChanged: string[] = [];
  for (const field of AUTOMATED_FIELDS) {
    if (currentRev.fields[field] !== previousRev.fields[field]) {
      automatedFieldsChanged.push(field);
    }
  }

  // If only automated fields changed (iteration/area path churn) and NO substantive fields changed,
  // treat as non-substantive regardless of actor.
  if (changedFields.length === 0 && automatedFieldsChanged.length > 0) {
    return {
      isSubstantive: false,
      changeType: `Automated: ${automatedFieldsChanged.join(', ')}`,
    };
  }

  // If any substantive field changed, it's substantive
  if (changedFields.length > 0) {
    return {
      isSubstantive: true,
      changeType: changedFields.map((f) => f.split('.').pop()).join(', '),
    };
  }

  // (Automated field only scenario already handled above.)

  return { isSubstantive: false, changeType: 'No significant changes' };
}

async function processWorkItem(
  workItemId: number,
  Organization: string,
  Project: string,
  HistoryCount: number,
  automatedPatterns: string[],
  token: string
): Promise<SubstantiveChangeResult> {
  // Get work item to extract created date
  const wiUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${workItemId}?$expand=none&api-version=7.1`;
  const workItem = curlJson(wiUrl, token);
  const createdDate = workItem.fields['System.CreatedDate'];
  const daysSinceCreation = daysBetween(createdDate);

  // Get revision history
  const revsUrl = `https://dev.azure.com/${Organization}/${Project}/_apis/wit/workItems/${workItemId}/revisions?$top=${HistoryCount}&api-version=7.1`;
  const revisions = curlJson(revsUrl, token).value || [];

  // Sort revisions by rev number descending (newest first)
  revisions.sort((a: any, b: any) => b.rev - a.rev);

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
    workItemId,
    lastSubstantiveChange,
    daysInactive,
    lastChangeType,
    automatedChangesSkipped,
    allChangesWereAutomated,
    createdDate,
    daysSinceCreation,
  };
}

export async function getLastSubstantiveChangeBulk(
  args: BulkSubstantiveChangeArgs
): Promise<BulkSubstantiveChangeResult> {
  const config = loadConfiguration();
  const Organization = args.Organization || config.azureDevOps.organization;
  const Project = args.Project || config.azureDevOps.project;
  const HistoryCount = args.HistoryCount || 50;
  const automatedPatterns = args.AutomatedPatterns || DEFAULT_AUTOMATION_PATTERNS;

  if (!args.WorkItemIds || args.WorkItemIds.length === 0) {
    throw new Error('WorkItemIds array is required and must not be empty');
  }

  if (args.WorkItemIds.length > 100) {
    throw new Error('Maximum 100 work items can be processed at once');
  }

  const results: SubstantiveChangeResult[] = [];
  const errors: Array<{ workItemId: number; error: string }> = [];

  try {
    const token = getAzureDevOpsToken();

    // Process each work item
    for (const workItemId of args.WorkItemIds) {
      try {
        const result = await processWorkItem(
          workItemId,
          Organization,
          Project,
          HistoryCount,
          automatedPatterns,
          token
        );
        results.push(result);
      } catch (error: any) {
        logger.error(`Error processing work item ${workItemId}:`, error);
        errors.push({
          workItemId,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Calculate summary statistics
    const successCount = results.length;
    const errorCount = errors.length;
    const itemsWithOnlyAutomatedChanges = results.filter(
      (r) => r.allChangesWereAutomated
    ).length;
    const averageDaysInactive =
      successCount > 0
        ? Math.round(
            results.reduce((sum, r) => sum + (r.daysInactive || 0), 0) / successCount
          )
        : 0;

    const bulkResult: BulkSubstantiveChangeResult = {
      results,
      summary: {
        totalItems: args.WorkItemIds.length,
        successCount,
        errorCount,
        averageDaysInactive,
        itemsWithOnlyAutomatedChanges,
      },
      errors,
    };

    console.log(JSON.stringify(bulkResult, null, 2));
    return bulkResult;
  } catch (error: any) {
    logger.error('Error in getLastSubstantiveChangeBulk:', error);
    throw error;
  }
}
