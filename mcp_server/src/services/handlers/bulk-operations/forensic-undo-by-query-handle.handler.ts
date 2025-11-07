/**
 * Handler for undo-forensic tool
 * 
 * Forensic undo: Analyzes work item revision history to detect and revert changes
 * made by a specific user within a time window, even if those changes were not
 * made through the MCP server.
 * 
 * Features:
 * - Analyzes ADO revision history directly (not MCP operation history)
 * - Detects type changes, state changes, field updates, and link operations
 * - Identifies if changes have already been manually reverted
 * - Only reverts items that still have the unwanted changes
 * - Supports filtering by user and time range
 * - Dry-run mode for safe preview
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import type { ADOWorkItemRevision, ADOWorkItem, ADORelation } from "@/types/ado.js";
import { validateAndParse } from "@/utils/handler-helpers.js";
import { logger } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from '@/utils/ado-http-client.js';
import { getTokenProvider } from '@/utils/token-provider.js';
import { loadConfiguration } from "@/config/config.js";

interface DetectedChange {
  revisionNumber: number;
  timestamp: string;
  changedBy: string;
  changeType: 'field' | 'type' | 'state' | 'link-add' | 'link-remove';
  field?: string;
  oldValue: any;
  newValue: any;
  linkType?: string;
  linkedItemId?: number;
  currentValue?: any; // Current value to check if already reverted
  needsRevert: boolean;
}

const SYSTEM_METADATA_PATTERNS = [
  /^System\.(Changed|Revised|Authorized|Created)(Date|By)$/,
  /^System\.(Board|Person|Comment|Watermark|Rev|Node|Area|Iteration)/,
  /^System\..*Count$/,
  /^Microsoft\.VSTS\.Common\.(State|Activated|Closed|Resolved)(Date|By)$/,
  /^Microsoft\.VSTS\.Common\.(StackRank|BacklogPriority)$/,
  /^System\.(History|Reason)$/,
  /^WEF_.*Kanban\./,
  /ExtensionMarker/
];

function isSubstantialFieldChange(fieldPath: string): boolean {
  return !SYSTEM_METADATA_PATTERNS.some(pattern => pattern.test(fieldPath));
}

interface ForensicAnalysis {
  workItemId: number;
  currentType: string;
  currentState: string;
  analysisTimestamp: string;
  revisionsAnalyzed: number;
  changesDetected: DetectedChange[];
  changesNeedingRevert: number;
  alreadyReverted: number;
  diagnostics?: {
    relationsDataAvailable: boolean;
    relationsInRevisions: number;
    relationsInCurrentItem: number;
    linkChangesDetected: number;
    urlFormatsEncountered: string[];
  };
}

interface RevertResult {
  workItemId: number;
  success: boolean;
  changesReverted: number;
  actionsPerformed: string[];
  error?: string;
}

function extractWorkItemIdFromUrl(url: string): number | undefined {
  const match = url.match(/workItems\/(\d+)|_workitems\/edit\/(\d+)|id=(\d+)/i);
  return match ? parseInt(match[1] || match[2] || match[3], 10) : undefined;
}

function normalizeRelationUrl(url: string): string {
  const workItemId = extractWorkItemIdFromUrl(url);
  if (workItemId) return `workitem-${workItemId}`;
  
  try {
    return new URL(url).pathname.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().replace(/\?.*$/, '').replace(/\/$/, '');
  }
}

function createRelationKey(relation: ADORelation): string {
  return `${relation.rel}|${normalizeRelationUrl(relation.url)}`;
}

export async function handleForensicUndoByQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const {
      queryHandle,
      changedBy,
      afterTimestamp,
      beforeTimestamp,
      maxRevisions = 50,
      detectTypeChanges = true,
      detectStateChanges = true,
      detectFieldChanges = true,
      detectLinkChanges = true,
      fieldPaths,
      dryRun = true,
      maxPreviewItems = 5,
      organization,
      project
    } = validation.data;

    // Parse timestamps
    const afterDate = afterTimestamp ? new Date(afterTimestamp) : undefined;
    const beforeDate = beforeTimestamp ? new Date(beforeTimestamp) : undefined;

    // Verify the query handle exists
    const handleData = queryHandleService.getQueryData(queryHandle);
    
    if (!handleData) {
      return {
        success: false,
        data: null,
        metadata: { source: "forensic-undo-by-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 24 hours.`],
        warnings: []
      };
    }

    logger.info(`Forensic undo: analyzing ${handleData.workItemIds.length} items (user=${changedBy || 'any'})`);

    // Set up HTTP client
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    // Analyze each work item
    const analyses: ForensicAnalysis[] = [];
    const warnings: string[] = [];

    for (const workItemId of handleData.workItemIds) {
      try {
        const analysis = await analyzeWorkItem(
          workItemId,
          httpClient,
          changedBy,
          afterDate,
          beforeDate,
          maxRevisions,
          detectTypeChanges,
          detectStateChanges,
          detectFieldChanges,
          detectLinkChanges,
          fieldPaths
        );
        analyses.push(analysis);
      } catch (error) {
        warnings.push(`Failed to analyze work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const totalChangesDetected = analyses.reduce((sum, a) => sum + a.changesDetected.length, 0);
    const totalNeedingRevert = analyses.reduce((sum, a) => sum + a.changesNeedingRevert, 0);
    const totalAlreadyReverted = analyses.reduce((sum, a) => sum + a.alreadyReverted, 0);
    const itemsNeedingRevert = analyses.filter(a => a.changesNeedingRevert > 0);

    if (dryRun) {
      // Preview mode
      const previewLimit = Math.min(maxPreviewItems, itemsNeedingRevert.length);
      const previewItems = itemsNeedingRevert.slice(0, previewLimit).map(analysis => ({
        work_item_id: analysis.workItemId,
        current_type: analysis.currentType,
        current_state: analysis.currentState,
        changes_detected: analysis.changesDetected.length,
        changes_needing_revert: analysis.changesNeedingRevert,
        already_reverted: analysis.alreadyReverted,
        revert_actions: consolidateRevertActions(analysis.changesDetected.filter(c => c.needsRevert)),
        link_detection_diagnostics: analysis.diagnostics
      }));

      const previewMessage = itemsNeedingRevert.length > previewLimit
        ? `Showing ${previewLimit} of ${itemsNeedingRevert.length} items needing revert...`
        : undefined;

      return {
        success: true,
        data: asToolData({
          dry_run: true,
          query_handle: queryHandle,
          analysis_summary: {
            work_items_analyzed: analyses.length,
            changes_detected: totalChangesDetected,
            changes_needing_revert: totalNeedingRevert,
            already_reverted: totalAlreadyReverted,
            items_needing_revert: itemsNeedingRevert.length
          },
          filters_applied: {
            changed_by: changedBy || "any user",
            after_timestamp: afterTimestamp || "beginning",
            before_timestamp: beforeTimestamp || "now",
            max_revisions: maxRevisions,
            detect_type_changes: detectTypeChanges,
            detect_state_changes: detectStateChanges,
            detect_field_changes: detectFieldChanges,
            detect_link_changes: detectLinkChanges,
            field_paths: fieldPaths || "all fields"
          },
          preview_items: previewItems,
          preview_message: previewMessage,
          summary: `DRY RUN: Would revert ${totalNeedingRevert} change(s) across ${itemsNeedingRevert.length} work item(s). ${totalAlreadyReverted} change(s) already reverted manually.`
        }),
        metadata: {
          source: "forensic-undo-by-query-handle",
          dryRun: true
        },
        errors: [],
        warnings
      };
    }

    // Execute reverts
    const revertResults: RevertResult[] = [];

    for (const analysis of itemsNeedingRevert) {
      try {
        const result = await revertWorkItem(analysis, httpClient);
        revertResults.push(result);
      } catch (error) {
        revertResults.push({
          workItemId: analysis.workItemId,
          success: false,
          changesReverted: 0,
          actionsPerformed: [],
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = revertResults.filter(r => r.success).length;
    const failureCount = revertResults.filter(r => !r.success).length;
    const changesReverted = revertResults.reduce((sum, r) => sum + r.changesReverted, 0);

    return {
      success: failureCount === 0,
      data: asToolData({
        query_handle: queryHandle,
        analysis_summary: {
          work_items_analyzed: analyses.length,
          changes_detected: totalChangesDetected,
          changes_needing_revert: totalNeedingRevert,
          already_reverted: totalAlreadyReverted,
          items_needing_revert: itemsNeedingRevert.length
        },
        revert_summary: {
          items_attempted: revertResults.length,
          items_successful: successCount,
          items_failed: failureCount,
          total_changes_reverted: changesReverted
        },
        results: revertResults,
        summary: `Reverted ${changesReverted} change(s) across ${successCount} of ${revertResults.length} work item(s)${failureCount > 0 ? ` (${failureCount} failed)` : ''}. ${totalAlreadyReverted} change(s) already reverted manually.`
      }),
      metadata: {
        source: "forensic-undo-by-query-handle",
        itemsReverted: successCount
      },
      errors: failureCount > 0
        ? revertResults.filter(r => !r.success).map(r => `Work item ${r.workItemId}: ${r.error}`)
        : [],
      warnings
    };
  } catch (error) {
    logger.error('Forensic undo by query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "forensic-undo-by-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Analyze a single work item's revision history
 */
async function analyzeWorkItem(
  workItemId: number,
  httpClient: ADOHttpClient,
  changedBy: string | undefined,
  afterDate: Date | undefined,
  beforeDate: Date | undefined,
  maxRevisions: number,
  detectTypeChanges: boolean,
  detectStateChanges: boolean,
  detectFieldChanges: boolean,
  detectLinkChanges: boolean,
  fieldPaths: string[] | undefined
): Promise<ForensicAnalysis> {
  
  // Get current work item and revision history
  const currentItem = await httpClient.get<ADOWorkItem>(`wit/workItems/${workItemId}?$expand=all`);
  const currentWorkItem = currentItem.data;
  
  const revisionsResponse = await httpClient.get<{ count: number; value: ADOWorkItemRevision[] }>(
    `wit/workItems/${workItemId}/revisions?$expand=relations`
  );
  const allRevisions = (revisionsResponse.data.value ?? []).sort((a, b) => a.rev - b.rev);
  
  const detectedChanges: DetectedChange[] = [];
  
  // Build revision chain with filter matching
  interface RevisionInfo {
    rev: number;
    fields: any;
    changedBy: string;
    changeDate: Date;
    matchesFilter: boolean;
  }
  
  const fullRevisionChain: RevisionInfo[] = allRevisions.map(r => {
    const changedByValue = r.fields['System.ChangedBy'];
    const changedBy = typeof changedByValue === 'object' && changedByValue !== null
      ? (changedByValue as any).displayName || (changedByValue as any).uniqueName || 'Unknown'
      : typeof changedByValue === 'string' ? changedByValue : 'Unknown';
    
    return {
      rev: r.rev,
      fields: r.fields,
      changedBy,
      changeDate: new Date(r.fields['System.ChangedDate'] || ''),
      matchesFilter: false
    };
  });
  
  const revisionInfoMap = new Map<number, RevisionInfo>();
  for (const info of fullRevisionChain) {
    revisionInfoMap.set(info.rev, info);
  }

  // Mark which revisions match the filter
  let firstMatchedRevIndex: number | null = null;
  for (let index = 0; index < fullRevisionChain.length; index++) {
    const revInfo = fullRevisionChain[index];
    const matchesUser = !changedBy || revInfo.changedBy.toLowerCase().includes(changedBy.toLowerCase());
    const inTimeRange = (!afterDate || revInfo.changeDate >= afterDate) && 
                       (!beforeDate || revInfo.changeDate <= beforeDate);
    revInfo.matchesFilter = matchesUser && inTimeRange;
    
    if (revInfo.matchesFilter && firstMatchedRevIndex === null) {
      firstMatchedRevIndex = index;
    }
  }

  // Compute baseline value for a field (value before first filtered revision)
  const revertValueCache = new Map<string, any>();
  const computeRevertValue = (fieldPath: string): any => {
    if (revertValueCache.has(fieldPath)) {
      return revertValueCache.get(fieldPath);
    }

    const scanLimit = firstMatchedRevIndex !== null ? firstMatchedRevIndex : fullRevisionChain.length;
    let value: any = undefined;
    
    for (let index = 0; index < scanLimit; index++) {
      const rev = fullRevisionChain[index];
      if (Object.prototype.hasOwnProperty.call(rev.fields, fieldPath)) {
        value = rev.fields[fieldPath as keyof typeof rev.fields];
      }
    }
    
    revertValueCache.set(fieldPath, value);
    return value;
  };
  
  // Compute baseline relations
  const baselineRelations = new Set<string>();
  if (firstMatchedRevIndex !== null && firstMatchedRevIndex > 0) {
    const baselineRev = allRevisions[firstMatchedRevIndex - 1];
    if (baselineRev.relations) {
      baselineRev.relations.forEach(rel => baselineRelations.add(createRelationKey(rel)));
    }
  }
  
  // Track diagnostics
  const linkDetectionDiagnostics = {
    relationsDataAvailable: false,
    relationsInRevisions: 0,
    relationsInCurrentItem: (currentWorkItem.relations || []).length,
    linkChangesDetected: 0,
    urlFormatsEncountered: new Set<string>()
  };
  
  // Analyze revisions in reverse chronological order
  for (let i = allRevisions.length - 1; i > 0; i--) {
    const currentRev = allRevisions[i];
    const previousRev = allRevisions[i - 1];
    const currentRevInfo = revisionInfoMap.get(currentRev.rev);
    
    if (!currentRevInfo?.matchesFilter) continue;
    
    // Check if revision has substantial changes
    let hasSubstantialChanges = false;
    const hasTypeChange = detectTypeChanges && previousRev.fields['System.WorkItemType'] !== currentRev.fields['System.WorkItemType'];
    const hasStateChange = detectStateChanges && previousRev.fields['System.State'] !== currentRev.fields['System.State'];
    
    if (hasTypeChange || hasStateChange) {
      hasSubstantialChanges = true;
    } else if (detectFieldChanges) {
      for (const fieldPath in currentRev.fields) {
        if (isSubstantialFieldChange(fieldPath) && 
            fieldPath !== 'System.WorkItemType' && 
            fieldPath !== 'System.State') {
          const oldValue = previousRev.fields[fieldPath as keyof typeof previousRev.fields];
          const newValue = currentRev.fields[fieldPath as keyof typeof currentRev.fields];
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            hasSubstantialChanges = true;
            break;
          }
        }
      }
    }
    
    if (!hasSubstantialChanges) continue;
    
    // Detect type changes
    if (hasTypeChange) {
      const oldType = previousRev.fields['System.WorkItemType'];
      const newType = currentRev.fields['System.WorkItemType'];
      const currentType = currentWorkItem.fields['System.WorkItemType'];
      
      const expectedType = computeRevertValue('System.WorkItemType');
      const needsRevert = expectedType !== undefined && 
                          String(currentType).trim() !== String(expectedType).trim();
      
      detectedChanges.push({
        revisionNumber: currentRev.rev,
        timestamp: currentRev.fields['System.ChangedDate'] || '',
        changedBy: currentRevInfo.changedBy,
        changeType: 'type',
        field: 'System.WorkItemType',
        oldValue: oldType,
        newValue: newType,
        currentValue: currentType,
        needsRevert
      });
    }
    
    // Detect state changes
    if (hasStateChange) {
      const oldState = previousRev.fields['System.State'];
      const newState = currentRev.fields['System.State'];
      const currentState = currentWorkItem.fields['System.State'];
      
      const expectedState = computeRevertValue('System.State');
      const needsRevert = expectedState !== undefined && 
                          String(currentState).trim() !== String(expectedState).trim();
      
      detectedChanges.push({
        revisionNumber: currentRev.rev,
        timestamp: currentRev.fields['System.ChangedDate'] || '',
        changedBy: currentRevInfo.changedBy,
        changeType: 'state',
        field: 'System.State',
        oldValue: oldState,
        newValue: newState,
        currentValue: currentState,
        needsRevert
      });
    }
    
    // Detect field changes
    if (detectFieldChanges) {
      const fieldsToCheck = fieldPaths || Object.keys(currentRev.fields);
      const readOnlyFields = ['System.Id', 'System.Rev', 'System.CreatedDate', 'System.CreatedBy',
                              'System.ChangedDate', 'System.ChangedBy', 'System.RevisedDate'];
      
      for (const fieldPath of fieldsToCheck) {
        if (fieldPath === 'System.WorkItemType' || fieldPath === 'System.State' ||
            readOnlyFields.includes(fieldPath) || !isSubstantialFieldChange(fieldPath)) {
          continue;
        }
        
        const oldValue = previousRev.fields[fieldPath as keyof typeof previousRev.fields];
        const newValue = currentRev.fields[fieldPath as keyof typeof currentRev.fields];
        
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const currentValue = currentWorkItem.fields[fieldPath as keyof typeof currentWorkItem.fields];
          
          // If type changed, field changes are side effects
          let needsRevert: boolean;
          if (hasTypeChange) {
            const expectedType = computeRevertValue('System.WorkItemType');
            const currentType = currentWorkItem.fields['System.WorkItemType'];
            needsRevert = expectedType !== undefined && 
                         JSON.stringify(currentType) !== JSON.stringify(expectedType);
          } else {
            const expectedValue = computeRevertValue(fieldPath);
            needsRevert = expectedValue !== undefined && 
                         JSON.stringify(currentValue) !== JSON.stringify(expectedValue);
          }
          
          detectedChanges.push({
            revisionNumber: currentRev.rev,
            timestamp: currentRev.fields['System.ChangedDate'] || '',
            changedBy: currentRevInfo.changedBy,
            changeType: 'field',
            field: fieldPath,
            oldValue,
            newValue,
            currentValue,
            needsRevert
          });
        }
      }
    }
    
    // Detect link changes
    if (detectLinkChanges) {
      const previousRelations = previousRev.relations;
      const currentRelations = currentRev.relations;
      
      if (previousRelations !== undefined || currentRelations !== undefined) {
        linkDetectionDiagnostics.relationsDataAvailable = true;
        linkDetectionDiagnostics.relationsInRevisions = Math.max(
          linkDetectionDiagnostics.relationsInRevisions,
          (previousRelations || []).length,
          (currentRelations || []).length
        );
      }
      
      if (previousRelations === undefined && currentRelations === undefined) continue;
      
      const prevRels = previousRelations || [];
      const currRels = currentRelations || [];
      
      // Track URL formats
      for (const rel of [...prevRels, ...currRels]) {
        if (rel.url.includes('/_workitems/edit/')) {
          linkDetectionDiagnostics.urlFormatsEncountered.add('web-ui');
        } else if (rel.url.includes('/_apis/wit/workItems/')) {
          linkDetectionDiagnostics.urlFormatsEncountered.add('rest-api');
        }
      }
      
      // Create relation maps for comparison
      const previousRelMap = new Map(prevRels.map(rel => [createRelationKey(rel), rel]));
      const currentRelMap = new Map(currRels.map(rel => [createRelationKey(rel), rel]));
      const currentItemRelations = currentWorkItem.relations || [];
      
      // Detect added relations
      for (const [key, relation] of currentRelMap) {
        if (!previousRelMap.has(key)) {
          const linkedItemId = extractWorkItemIdFromUrl(relation.url);
          const currentlyExists = currentItemRelations.some(r => createRelationKey(r) === key);
          const needsRevert = currentlyExists && !baselineRelations.has(key);
          
          linkDetectionDiagnostics.linkChangesDetected++;
          detectedChanges.push({
            revisionNumber: currentRev.rev,
            timestamp: currentRev.fields['System.ChangedDate'] || '',
            changedBy: currentRevInfo.changedBy,
            changeType: 'link-add',
            field: 'relations',
            oldValue: null,
            newValue: relation.url,
            currentValue: currentlyExists,
            linkType: relation.rel,
            linkedItemId,
            needsRevert
          });
        }
      }
      
      // Detect removed relations
      for (const [key, relation] of previousRelMap) {
        if (!currentRelMap.has(key)) {
          const linkedItemId = extractWorkItemIdFromUrl(relation.url);
          const currentlyExists = currentItemRelations.some(r => createRelationKey(r) === key);
          const needsRevert = !currentlyExists && baselineRelations.has(key);
          
          linkDetectionDiagnostics.linkChangesDetected++;
          detectedChanges.push({
            revisionNumber: currentRev.rev,
            timestamp: currentRev.fields['System.ChangedDate'] || '',
            changedBy: currentRevInfo.changedBy,
            changeType: 'link-remove',
            field: 'relations',
            oldValue: relation.url,
            newValue: null,
            currentValue: !currentlyExists,
            linkType: relation.rel,
            linkedItemId,
            needsRevert
          });
        }
      }
    }
  }
  
  return {
    workItemId,
    currentType: currentWorkItem.fields['System.WorkItemType'],
    currentState: currentWorkItem.fields['System.State'],
    analysisTimestamp: new Date().toISOString(),
    revisionsAnalyzed: allRevisions.length,
    changesDetected: detectedChanges,
    changesNeedingRevert: detectedChanges.filter(c => c.needsRevert).length,
    alreadyReverted: detectedChanges.filter(c => !c.needsRevert).length,
    diagnostics: {
      relationsDataAvailable: linkDetectionDiagnostics.relationsDataAvailable,
      relationsInRevisions: linkDetectionDiagnostics.relationsInRevisions,
      relationsInCurrentItem: linkDetectionDiagnostics.relationsInCurrentItem,
      linkChangesDetected: linkDetectionDiagnostics.linkChangesDetected,
      urlFormatsEncountered: Array.from(linkDetectionDiagnostics.urlFormatsEncountered)
    }
  };
}

/**
 * Revert changes for a work item
 */
async function revertWorkItem(
  analysis: ForensicAnalysis,
  httpClient: ADOHttpClient
): Promise<RevertResult> {
  
  const changesToRevert = analysis.changesDetected.filter(c => c.needsRevert);
  logger.debug(`[WI ${analysis.workItemId}] Preparing to revert ${changesToRevert.length} changes...`);
  
  const actionsPerformed: string[] = [];
  
  // Get current work item state (including relations)
  const currentItemResponse = await httpClient.get<ADOWorkItem>(`wit/workItems/${analysis.workItemId}?$expand=relations`);
  const currentItem = currentItemResponse.data;
  const currentRelations = currentItem.relations || [];
  
  // Find relation index by work item ID and link type
  const findRelationIndex = (linkedItemId: number | undefined, linkType: string | undefined): number | null => {
    if (!linkedItemId || !linkType) return null;
    
    for (let i = 0; i < currentRelations.length; i++) {
      const itemId = extractWorkItemIdFromUrl(currentRelations[i].url);
      if (itemId === linkedItemId && currentRelations[i].rel === linkType) {
        return i;
      }
    }
    return null;
  };
  
  // Get full revision history for replay
  const revisionsResponse = await httpClient.get<{ count: number; value: ADOWorkItemRevision[] }>(
    `wit/workItems/${analysis.workItemId}/revisions?$expand=relations`
  );
  const allRevisions = (revisionsResponse.data.value || []).sort((a, b) => a.rev - b.rev);
  const filteredRevNumbers = new Set(changesToRevert.map(c => c.revisionNumber));
  
  // Group changes by field
  const changesByField = new Map<string, typeof changesToRevert>();
  for (const change of changesToRevert) {
    const fieldKey = change.field || 'unknown';
    if (!changesByField.has(fieldKey)) {
      changesByField.set(fieldKey, []);
    }
    changesByField.get(fieldKey)!.push(change);
  }
  
  const patchMap = new Map<string, any>();
  
  // Compute revert value for each field via replay
  for (const [fieldKey, fieldChanges] of changesByField) {
    let revertValue: any = undefined;
    
    for (const rev of allRevisions) {
      if (filteredRevNumbers.has(rev.rev)) continue;
      
      const fieldValue = rev.fields[fieldKey as keyof typeof rev.fields];
      if (fieldValue !== revertValue || revertValue === undefined) {
        revertValue = fieldValue;
      }
    }
    
    const sortedChanges = fieldChanges.sort((a, b) => a.revisionNumber - b.revisionNumber);
    const fieldPath = `/fields/${fieldKey}`;
    const changeCount = sortedChanges.length;
    const revList = sortedChanges.map(c => c.revisionNumber).join(', ');
    
    const oldestChange = sortedChanges[0];
    switch (oldestChange.changeType) {
      case 'type':
        patchMap.set(fieldPath, {
          op: "replace",
          path: fieldPath,
          value: revertValue
        });
        actionsPerformed.push(`Reverted type to ${revertValue} (${changeCount} change${changeCount > 1 ? 's' : ''} in revs ${revList})`);
        break;
        
      case 'state':
        patchMap.set(fieldPath, {
          op: "replace",
          path: fieldPath,
          value: revertValue
        });
        actionsPerformed.push(`Reverted state to ${revertValue} (${changeCount} change${changeCount > 1 ? 's' : ''} in revs ${revList})`);
        break;
        
      case 'field':
        if (revertValue === undefined || revertValue === null) {
          patchMap.set(fieldPath, {
            op: "remove",
            path: fieldPath
          });
          actionsPerformed.push(`Removed ${fieldKey} (${changeCount} change${changeCount > 1 ? 's' : ''} in revs ${revList})`);
        } else {
          patchMap.set(fieldPath, {
            op: "replace",
            path: fieldPath,
            value: revertValue
          });
          actionsPerformed.push(`Reverted ${fieldKey} to ${JSON.stringify(revertValue)} (${changeCount} change${changeCount > 1 ? 's' : ''} in revs ${revList})`);
        }
        break;
        
      case 'link-add':
        // Remove the link that was added
        // Relations use a different patch path structure
        for (const change of sortedChanges) {
          const relationIndex = findRelationIndex(change.linkedItemId, change.linkType);
          if (relationIndex !== null) {
            const relationPath = `/relations/${relationIndex}`;
            patchMap.set(`remove-relation-${relationIndex}`, {
              op: "remove",
              path: relationPath
            });
            actionsPerformed.push(`Removed ${change.linkType} link to item ${change.linkedItemId} (added in rev ${change.revisionNumber})`);
          } else {
            actionsPerformed.push(`Could not find ${change.linkType} link to item ${change.linkedItemId} to remove (may have been already removed)`);
          }
        }
        break;
        
      case 'link-remove':
        // Re-add the link that was removed
        for (const change of sortedChanges) {
          // We need to reconstruct the relation object from the stored data
          const patchKey = `add-relation-${change.linkedItemId}-${change.linkType}`;
          patchMap.set(patchKey, {
            op: "add",
            path: "/relations/-",
            value: {
              rel: change.linkType,
              url: change.oldValue
            }
          });
          actionsPerformed.push(`Re-added ${change.linkType} link to item ${change.linkedItemId} (removed in rev ${change.revisionNumber})`);
        }
        break;
    }
  }
  
  // Apply patches
  const patches = Array.from(patchMap.values());
  
  if (patches.length > 0) {
    await httpClient.patch(`wit/workItems/${analysis.workItemId}`, patches);
  }
  
  return {
    workItemId: analysis.workItemId,
    success: true,
    changesReverted: patches.length,
    actionsPerformed
  };
}

function consolidateRevertActions(changes: DetectedChange[]): string[] {
  const fieldGroups = new Map<string, DetectedChange[]>();
  
  for (const change of changes) {
    const key = change.changeType === 'link-add' || change.changeType === 'link-remove'
      ? `${change.changeType}-${change.linkType}-${change.linkedItemId}`
      : change.field || 'unknown';
    
    if (!fieldGroups.has(key)) fieldGroups.set(key, []);
    fieldGroups.get(key)!.push(change);
  }
  
  const actions: string[] = [];
  
  for (const [, fieldChanges] of fieldGroups) {
    const sorted = fieldChanges.sort((a, b) => a.revisionNumber - b.revisionNumber);
    const oldest = sorted[0];
    const count = sorted.length;
    const revs = count > 1 ? `${count} revs` : `rev ${oldest.revisionNumber}`;
    
    switch (oldest.changeType) {
      case 'type':
        actions.push(`Revert type to ${oldest.oldValue} (${revs})`);
        break;
      case 'state':
        actions.push(`Revert state to ${oldest.oldValue} (${revs})`);
        break;
      case 'field':
        const val = oldest.oldValue ?? '<remove>';
        actions.push(`Revert ${oldest.field} to ${JSON.stringify(val)} (${revs})`);
        break;
      case 'link-add':
        actions.push(`Remove ${oldest.linkType} to item ${oldest.linkedItemId} (${revs})`);
        break;
      case 'link-remove':
        actions.push(`Re-add ${oldest.linkType} to item ${oldest.linkedItemId} (${revs})`);
        break;
    }
  }
  
  return actions;
}
