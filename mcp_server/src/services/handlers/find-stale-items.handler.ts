/**
 * Handler for wit-find-stale-items tool
 * Purpose-built for backlog hygiene: find stale/abandoned work items
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../ado-work-item-service.js";
import { logger } from "../../utils/logger.js";

interface FindStaleItemsArgs {
  areaPath: string;
  organization: string;
  project: string;
  minInactiveDays?: number;
  excludeStates?: string[];
  includeSubAreas?: boolean;
  workItemTypes?: string[];
  maxResults?: number;
  includeSubstantiveChange?: boolean;
  includeSignals?: boolean;
}

interface StaleItemSignals {
  reasons: string[];
  riskLevel: 'high' | 'medium' | 'low';
}

export async function handleFindStaleItems(config: any, args: any): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      throw new Error(azValidation.error || "Azure CLI validation failed");
    }

    // Parse and validate arguments
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      throw new Error(`Validation error: ${parsed.error.message}`);
    }

    const {
      areaPath,
      organization,
      project,
      minInactiveDays = 180,
      excludeStates = ['Done', 'Completed', 'Closed', 'Resolved', 'Removed'],
      includeSubAreas = true,
      workItemTypes = [],
      maxResults = 200,
      includeSubstantiveChange = true,
      includeSignals = true
    } = parsed.data as FindStaleItemsArgs;

    logger.debug(`Finding stale items in ${areaPath} (min ${minInactiveDays} days inactive)`);

    // Build WIQL query
    let wiqlQuery = `SELECT [System.Id] FROM WorkItems WHERE `;
    
    // Area path clause
    if (includeSubAreas) {
      wiqlQuery += `[System.AreaPath] UNDER '${areaPath}' `;
    } else {
      wiqlQuery += `[System.AreaPath] = '${areaPath}' `;
    }

    // Exclude states
    if (excludeStates.length > 0) {
      wiqlQuery += `AND [System.State] NOT IN (${excludeStates.map(s => `'${s}'`).join(', ')}) `;
    }

    // Filter by work item types if specified
    if (workItemTypes.length > 0) {
      wiqlQuery += `AND [System.WorkItemType] IN (${workItemTypes.map(t => `'${t}'`).join(', ')}) `;
    }

    wiqlQuery += `ORDER BY [System.ChangedDate] ASC`;

    // Execute query with computed metrics
    const result = await queryWorkItemsByWiql({
      wiqlQuery: wiqlQuery,
      organization,
      project,
      includeFields: ['System.Description', 'System.CreatedDate', 'System.ChangedDate'],
      maxResults,
      computeMetrics: true,
      staleThresholdDays: minInactiveDays,
      includeSubstantiveChange,
      substantiveChangeHistoryCount: 50
    });

    // Filter to only stale items and categorize
    const staleItems = result.workItems.filter(wi => {
      // Use substantive change if available, otherwise use changed date
      const daysInactive = wi.daysInactive ?? wi.computedMetrics?.daysSinceChanged ?? 0;
      return daysInactive >= minInactiveDays;
    });

    // Add signals if requested
    if (includeSignals) {
      for (const item of staleItems) {
        const signals: StaleItemSignals = {
          reasons: [],
          riskLevel: 'low'
        };

        const daysInactive = item.daysInactive ?? item.computedMetrics?.daysSinceChanged ?? 0;
        const daysSinceCreated = item.computedMetrics?.daysSinceCreated ?? 0;

        // Inactivity signals
        if (daysInactive > 365) {
          signals.reasons.push(`Inactive for ${daysInactive} days (>1 year)`);
          signals.riskLevel = 'high';
        } else if (daysInactive > minInactiveDays) {
          signals.reasons.push(`Inactive for ${daysInactive} days`);
          signals.riskLevel = 'medium';
        }

        // Age signals
        if (daysSinceCreated > 1000) {
          signals.reasons.push(`Created ${daysSinceCreated} days ago (>3 years)`);
        }

        // State signals
        const passiveStates = ['New', 'Proposed', 'Backlog', 'To Do'];
        if (passiveStates.includes(item.state)) {
          signals.reasons.push(`In passive state (${item.state})`);
        }

        // Assignment signals
        if (!item.assignedTo) {
          signals.reasons.push('Unassigned');
        }

        // Description signals
        if (!item.computedMetrics?.hasDescription) {
          signals.reasons.push('No description or minimal description (<50 chars)');
        }

        // Title signals (placeholder detection)
        const placeholderPatterns = [/\bTBD\b/i, /\bTODO\b/i, /\btest\b/i, /\bfoo\b/i, /\bbar\b/i, /\bspike\b/i];
        if (placeholderPatterns.some(pattern => pattern.test(item.title))) {
          signals.reasons.push('Title contains placeholder terms');
          signals.riskLevel = 'high';
        }

        (item as any).signals = signals;
      }
    }

    // Categorize by risk level
    const categorized = {
      high: staleItems.filter((item: any) => item.signals?.riskLevel === 'high'),
      medium: staleItems.filter((item: any) => item.signals?.riskLevel === 'medium'),
      low: staleItems.filter((item: any) => item.signals?.riskLevel === 'low')
    };

    return {
      success: true,
      data: {
        summary: {
          total: result.count,
          stale: staleItems.length,
          healthy: result.count - staleItems.length,
          byRiskLevel: {
            high: categorized.high.length,
            medium: categorized.medium.length,
            low: categorized.low.length
          }
        },
        staleItems: staleItems,
        categorized: includeSignals ? categorized : undefined,
        criteria: {
          areaPath: areaPath,
          includeSubAreas: includeSubAreas,
          minInactiveDays: minInactiveDays,
          excludeStates: excludeStates,
          workItemTypes: workItemTypes.length > 0 ? workItemTypes : 'All types'
        },
        message: `Found ${staleItems.length} stale items out of ${result.count} active items in ${areaPath}`
      },
      metadata: {
        source: "find-stale-items",
        totalItems: result.count,
        staleCount: staleItems.length,
        minInactiveDays: minInactiveDays
      },
      errors: [],
      warnings: staleItems.length === 0 ? ["No stale items found"] : []
    };
  } catch (error) {
    logger.error('Find stale items error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "find-stale-items" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
