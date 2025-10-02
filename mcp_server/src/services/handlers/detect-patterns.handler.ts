/**
 * Handler for wit-detect-patterns tool
 * Identifies common issues: duplicates, placeholders, orphans, etc.
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../ado-work-item-service.js";
import { logger } from "../../utils/logger.js";

interface DetectPatternsArgs {
  WorkItemIds?: number[];
  AreaPath?: string;
  Organization: string;
  Project: string;
  Patterns?: string[];
  MaxResults?: number;
  IncludeSubAreas?: boolean;
}

interface PatternMatch {
  workItemId: number;
  title: string;
  patterns: string[];
  severity: 'critical' | 'warning' | 'info';
  details: string;
}

export async function handleDetectPatterns(config: any, args: any): Promise<ToolExecutionResult> {
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
      WorkItemIds,
      AreaPath,
      Organization,
      Project,
      Patterns = ['duplicates', 'placeholder_titles', 'orphaned_children', 'unassigned_committed', 'stale_automation'],
      MaxResults = 200,
      IncludeSubAreas = true
    } = parsed.data as DetectPatternsArgs;

    logger.debug(`Detecting patterns: ${Patterns.join(', ')}`);

    let workItems: any[] = [];

    // Get work items either by IDs or area path
    if (WorkItemIds && WorkItemIds.length > 0) {
      // Fetch specific work items
      const result = await queryWorkItemsByWiql({
        WiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${WorkItemIds.join(',')})`,
        Organization,
        Project,
        IncludeFields: ['System.Description', 'System.State', 'System.CreatedDate', 'System.ChangedDate', 'System.Parent'],
        MaxResults: WorkItemIds.length
      });
      workItems = result.workItems;
    } else if (AreaPath) {
      // Query by area path
      const areaClause = IncludeSubAreas ? `[System.AreaPath] UNDER '${AreaPath}'` : `[System.AreaPath] = '${AreaPath}'`;
      const result = await queryWorkItemsByWiql({
        WiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE ${areaClause} AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')`,
        Organization,
        Project,
        IncludeFields: ['System.Description', 'System.State', 'System.CreatedDate', 'System.ChangedDate', 'System.Parent'],
        MaxResults
      });
      workItems = result.workItems;
    } else {
      throw new Error('Either WorkItemIds or AreaPath must be provided');
    }

    const matches: PatternMatch[] = [];
    const patternSummary: Record<string, number> = {};

    // Pattern: Placeholder titles
    if (Patterns.includes('placeholder_titles')) {
      const placeholderPatterns = [
        { regex: /\b(TBD|TODO|FIXME|XXX)\b/i, name: 'TBD/TODO markers' },
        { regex: /\b(test|testing|temp|temporary)\b/i, name: 'Test/temporary indicators' },
        { regex: /\b(foo|bar|baz|dummy)\b/i, name: 'Placeholder variables' },
        { regex: /^(New|Untitled|Item \d+)$/i, name: 'Default titles' },
        { regex: /\[.*\?\?\?.*\]/i, name: 'Unknown placeholders' }
      ];

      for (const item of workItems) {
        const matchedPatterns: string[] = [];
        for (const pattern of placeholderPatterns) {
          if (pattern.regex.test(item.title)) {
            matchedPatterns.push(pattern.name);
          }
        }

        if (matchedPatterns.length > 0) {
          matches.push({
            workItemId: item.id,
            title: item.title,
            patterns: ['placeholder_titles'],
            severity: 'warning',
            details: `Contains placeholder patterns: ${matchedPatterns.join(', ')}`
          });
          patternSummary['placeholder_titles'] = (patternSummary['placeholder_titles'] || 0) + 1;
        }
      }
    }

    // Pattern: Duplicates (similar titles)
    if (Patterns.includes('duplicates')) {
      const titleMap = new Map<string, number[]>();
      
      for (const item of workItems) {
        const normalizedTitle = item.title.toLowerCase().trim().replace(/[^\w\s]/g, '');
        if (!titleMap.has(normalizedTitle)) {
          titleMap.set(normalizedTitle, []);
        }
        titleMap.get(normalizedTitle)!.push(item.id);
      }

      for (const [title, ids] of titleMap.entries()) {
        if (ids.length > 1) {
          for (const id of ids) {
            const item = workItems.find(wi => wi.id === id);
            if (item) {
              matches.push({
                workItemId: id,
                title: item.title,
                patterns: ['duplicates'],
                severity: 'warning',
                details: `Potential duplicate - ${ids.length} items with similar titles (IDs: ${ids.join(', ')})`
              });
            }
          }
          patternSummary['duplicates'] = (patternSummary['duplicates'] || 0) + ids.length;
        }
      }
    }

    // Pattern: Unassigned items in committed state
    if (Patterns.includes('unassigned_committed')) {
      const committedStates = ['Active', 'Committed', 'In Progress', 'Doing'];
      for (const item of workItems) {
        if (committedStates.includes(item.state) && !item.assignedTo) {
          matches.push({
            workItemId: item.id,
            title: item.title,
            patterns: ['unassigned_committed'],
            severity: 'warning',
            details: `Item in state '${item.state}' but has no assignee`
          });
          patternSummary['unassigned_committed'] = (patternSummary['unassigned_committed'] || 0) + 1;
        }
      }
    }

    // Pattern: Missing descriptions
    if (Patterns.includes('no_description')) {
      for (const item of workItems) {
        const description = item.additionalFields?.['System.Description'] || '';
        const descriptionText = description.replace(/<[^>]*>/g, '').trim();
        if (descriptionText.length < 50 && item.type !== 'Epic') { // Epics often have minimal descriptions
          matches.push({
            workItemId: item.id,
            title: item.title,
            patterns: ['no_description'],
            severity: 'info',
            details: 'Has no description or very minimal description (<50 chars)'
          });
          patternSummary['no_description'] = (patternSummary['no_description'] || 0) + 1;
        }
      }
    }

    // Pattern: Stale automation items (created by automation, not touched in 180+ days)
    if (Patterns.includes('stale_automation')) {
      const automationPatterns = [/\[S360\]/i, /\[automated\]/i, /\[bot\]/i, /\[scan\]/i];
      const now = new Date();
      
      for (const item of workItems) {
        const isAutomation = automationPatterns.some(pattern => pattern.test(item.title));
        if (isAutomation && item.changedDate) {
          const changedDate = new Date(item.changedDate);
          const daysSinceChange = Math.floor((now.getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceChange > 180) {
            matches.push({
              workItemId: item.id,
              title: item.title,
              patterns: ['stale_automation'],
              severity: 'info',
              details: `Automation-created item inactive for ${daysSinceChange} days`
            });
            patternSummary['stale_automation'] = (patternSummary['stale_automation'] || 0) + 1;
          }
        }
      }
    }

    // Categorize by severity
    const categorized = {
      critical: matches.filter(m => m.severity === 'critical'),
      warning: matches.filter(m => m.severity === 'warning'),
      info: matches.filter(m => m.severity === 'info')
    };

    return {
      success: true,
      data: {
        summary: {
          totalItemsAnalyzed: workItems.length,
          totalMatches: matches.length,
          patternsDetected: Object.keys(patternSummary).length,
          bySeverity: {
            critical: categorized.critical.length,
            warning: categorized.warning.length,
            info: categorized.info.length
          },
          byPattern: patternSummary
        },
        matches: matches,
        categorized: categorized,
        patternsSearched: Patterns,
        message: `Found ${matches.length} pattern matches across ${workItems.length} work items`
      },
      metadata: {
        source: "detect-patterns",
        itemsAnalyzed: workItems.length,
        matchCount: matches.length
      },
      errors: [],
      warnings: []
    };
  } catch (error) {
    logger.error('Detect patterns error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "detect-patterns" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
