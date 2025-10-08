/**
 * Handler for wit-analyze-patterns tool
 * Identifies common issues: duplicates, placeholders, orphans, etc.
 */

import type { ToolConfig, ToolExecutionResult, JSONValue } from "../../../types/index.js";
import { asToolData } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { logger } from "../../../utils/logger.js";
import { escapeAreaPath } from "../../../utils/work-item-parser.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSuccessResponse, buildErrorResponse } from "../../../utils/response-builder.js";

interface WorkItemFromQuery {
  id: number;
  title: string;
  type: string;
  state: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  createdDate?: string;
  changedDate?: string;
  url: string;
  additionalFields?: Record<string, unknown>;
}

interface DetectPatternsArgs {
  workItemIds?: number[];
  areaPath?: string;
  organization: string;
  project: string;
  patterns?: string[];
  maxResults?: number;
  includeSubAreas?: boolean;
  format?: 'summary' | 'categorized' | 'flat';
}

interface PatternMatch {
  workItemId: number;
  title: string;
  patterns: string[];
  severity: 'critical' | 'warning' | 'info';
  details: string;
}

export async function handleDetectPatterns(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, 'detect-patterns');
    }

    const {
      workItemIds,
      areaPath,
      organization,
      project,
      patterns = ['duplicates', 'placeholder_titles', 'orphaned_children', 'unassigned_committed', 'stale_automation'],
      maxResults = 200,
      includeSubAreas = true,
      format = 'categorized'
    } = parsed.data as DetectPatternsArgs;

    logger.debug(`Detecting patterns: ${patterns.join(', ')}`);

    let workItems: WorkItemFromQuery[] = [];

    // Get work items either by IDs or area path
    if (workItemIds && workItemIds.length > 0) {
      // Fetch specific work items
      const result = await queryWorkItemsByWiql({
        wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (${workItemIds.join(',')})`,
        organization,
        project,
        includeFields: ['System.Description', 'System.State', 'System.CreatedDate', 'System.ChangedDate', 'System.Parent'],
        maxResults: workItemIds.length
      });
      workItems = result.workItems;
    } else if (areaPath) {
      // Query by area path (escape for WIQL)
      const escapedAreaPath = escapeAreaPath(areaPath);
      const areaClause = includeSubAreas ? `[System.AreaPath] UNDER '${escapedAreaPath}'` : `[System.AreaPath] = '${escapedAreaPath}'`;
      const result = await queryWorkItemsByWiql({
        wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE ${areaClause} AND [System.State] NOT IN ('Done', 'Completed', 'Closed', 'Resolved', 'Removed')`,
        organization,
        project,
        includeFields: ['System.Description', 'System.State', 'System.CreatedDate', 'System.ChangedDate', 'System.Parent'],
        maxResults
      });
      workItems = result.workItems;
    } else {
      return buildErrorResponse(
        'Either workItemIds or areaPath must be provided',
        { source: 'detect-patterns' }
      );
    }

    const matches: PatternMatch[] = [];
    const patternSummary: Record<string, number> = {};

    // Pattern: Placeholder titles
    if (patterns.includes('placeholder_titles')) {
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
    if (patterns.includes('duplicates')) {
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
    if (patterns.includes('unassigned_committed')) {
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
    if (patterns.includes('no_description')) {
      for (const item of workItems) {
        const description = item.additionalFields?.['System.Description'] || '';
        const descriptionText = typeof description === 'string' ? description.replace(/<[^>]*>/g, '').trim() : '';
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
    if (patterns.includes('stale_automation')) {
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

    // Build response based on format
    let responseData: Record<string, JSONValue>;

    if (format === 'summary') {
      // Summary format: Only counts, no work item arrays
      responseData = {
        totalItemsAnalyzed: workItems.length,
        totalMatches: matches.length,
        patternsDetected: Object.keys(patternSummary).length,
        bySeverity: {
          critical_count: categorized.critical.length,
          warning_count: categorized.warning.length,
          info_count: categorized.info.length
        },
        byPattern: patternSummary,
        patternsSearched: patterns,
        message: `Found ${matches.length} pattern matches across ${workItems.length} work items`
      };
    } else if (format === 'flat') {
      // Flat format: Single array with pattern type field
      const flatMatches = matches.map(match => ({
        pattern: match.patterns[0], // Primary pattern
        workItemId: match.workItemId,
        title: match.title,
        severity: match.severity,
        details: match.details
      }));
      
      responseData = {
        matches: flatMatches,
        summary: {
          totalItemsAnalyzed: workItems.length,
          totalMatches: matches.length,
          patternsDetected: Object.keys(patternSummary).length,
          byPattern: patternSummary
        },
        patternsSearched: patterns,
        message: `Found ${matches.length} pattern matches across ${workItems.length} work items`
      };
    } else {
      // Categorized format (default): Grouped by severity
      responseData = {
        categorized: {
          critical: {
            count: categorized.critical.length,
            matches: categorized.critical
          },
          warning: {
            count: categorized.warning.length,
            matches: categorized.warning
          },
          info: {
            count: categorized.info.length,
            matches: categorized.info
          }
        },
        summary: {
          totalItemsAnalyzed: workItems.length,
          totalMatches: matches.length,
          patternsDetected: Object.keys(patternSummary).length,
          byPattern: patternSummary
        },
        patternsSearched: patterns,
        message: `Found ${matches.length} pattern matches across ${workItems.length} work items`
      } as any;
    }

    return buildSuccessResponse(
      responseData,
      {
        source: "detect-patterns",
        matchCount: matches.length,
        format
      }
    );
  } catch (error) {
    logger.error('Detect patterns error:', error);
    return buildErrorResponse(
      error as Error,
      { source: "detect-patterns" }
    );
  }
}
