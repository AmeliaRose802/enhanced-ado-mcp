/**
 * Handler for wit-inspect-query-handle tool
 * Allows inspection of query handle contents including staleness data
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { buildValidationErrorResponse, 
  buildSuccessResponse, 
  buildSuccessResponseWithWarnings, 
  buildErrorResponse, 
  buildPartialSuccessResponse, 
  buildCatchErrorResponse, 
  buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";

export async function handleInspectQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, includePreview = true, includeStats = true, includeExamples = false } = parsed.data;

    const queryData = queryHandleService.getQueryData(queryHandle);
    if (!queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "query-handle-service" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    const response: any = {
      query_handle: queryHandle,
      work_item_count: queryData.workItemIds.length,
      created_at: queryData.createdAt.toISOString(),
      expires_at: queryData.expiresAt.toISOString(),
      query: queryData.query,
      metadata: queryData.metadata || {},
      // NEW: Item context and selection info
      has_item_context: !!queryData.itemContext,
      selection_enabled: true
    };

    // Include analysis metadata if available
    if (queryData.analysisMetadata && includeStats) {
      response.analysis = {
        staleness_analysis_included: queryData.analysisMetadata.includeSubstantiveChange || false,
        staleness_threshold_days: queryData.analysisMetadata.stalenessThresholdDays,
        analysis_timestamp: queryData.analysisMetadata.analysisTimestamp,
        staleness_success_count: queryData.analysisMetadata.successCount || 0,
        staleness_failure_count: queryData.analysisMetadata.failureCount || 0,
        staleness_coverage: queryData.analysisMetadata.successCount ? 
          ((queryData.analysisMetadata.successCount / queryData.workItemIds.length) * 100).toFixed(1) + '%' : 
          'N/A'
      };

      // Note: Verbose staleness statistics have been removed to reduce token usage.
      // Individual work items in the preview still contain last_activity (as last_substantive_change)
      // and days_inactive for basic staleness checks.
    }

    // Include preview of work items with indices and selection hints
    if (includePreview) {
      const previewItems = queryData.itemContext.slice(0, 10).map(item => {
        const context = queryData.workItemContext?.get(item.id);
        
        const previewItem: any = {
          index: item.index,              // Zero-based index for selection
          id: item.id,
          title: item.title,
          state: item.state,
          type: item.type
        };

        if (item.daysInactive !== undefined) {
          previewItem.days_inactive = item.daysInactive;
        }

        if (item.lastChange) {
          previewItem.last_substantive_change = item.lastChange;
        }

        if (context?.assignedTo) {
          previewItem.assigned_to = context.assignedTo;
        }

        if (item.tags && item.tags.length > 0) {
          previewItem.tags = item.tags;
        }

        return previewItem;
      });

      // Calculate statistics for selection criteria
      const stateStats: Record<string, number> = {};
      const typeStats: Record<string, number> = {};
      const tagStats: Record<string, number> = {};

      queryData.itemContext.forEach(item => {
        // Count by state
        stateStats[item.state] = (stateStats[item.state] || 0) + 1;
        
        // Count by type
        typeStats[item.type] = (typeStats[item.type] || 0) + 1;
        
        // Count by tags
        if (item.tags) {
          item.tags.forEach(tag => {
            tagStats[tag] = (tagStats[tag] || 0) + 1;
          });
        }
      });

      // Build available criteria summary
      const availableCriteria: string[] = [];
      
      // States summary
      const statesSummary = Object.entries(stateStats)
        .map(([state, count]) => `${state} (${count} item${count !== 1 ? 's' : ''})`)
        .join(', ');
      availableCriteria.push(`States available: ${statesSummary}`);
      
      // Types summary
      const typesSummary = Object.entries(typeStats)
        .map(([type, count]) => `${type} (${count} item${count !== 1 ? 's' : ''})`)
        .join(', ');
      availableCriteria.push(`Work item types: ${typesSummary}`);
      
      // Tags summary
      if (Object.keys(tagStats).length > 0) {
        const tagsSummary = Object.entries(tagStats)
          .sort(([, a], [, b]) => b - a) // Sort by count descending
          .slice(0, 10) // Show top 10 tags
          .map(([tag, count]) => `${tag} (${count} item${count !== 1 ? 's' : ''})`)
          .join(', ');
        availableCriteria.push(`Tags available: ${tagsSummary}`);
      }

      // Build contextual selection examples
      const totalItems = queryData.workItemIds.length;
      const exampleStates = Object.keys(stateStats).slice(0, 2);
      const exampleTags = Object.keys(tagStats).slice(0, 1);
      const hasStaleItems = queryData.itemContext.some(item => item.daysInactive && item.daysInactive >= 7);
      
      const selectionExamples: string[] = [
        `"all" - selects all ${totalItems} items`,
        `[0, 1, 2] - selects first 3 items`,
      ];
      
      if (exampleStates.length > 0) {
        const stateCount = stateStats[exampleStates[0]] || 0;
        selectionExamples.push(`{states: ["${exampleStates[0]}"]} - selects ${stateCount} ${exampleStates[0]} item${stateCount !== 1 ? 's' : ''}`);
      }
      
      if (exampleTags.length > 0) {
        const tagCount = tagStats[exampleTags[0]] || 0;
        selectionExamples.push(`{tags: ["${exampleTags[0]}"]} - selects ${tagCount} item${tagCount !== 1 ? 's' : ''} tagged "${exampleTags[0]}"`);
      }
      
      if (hasStaleItems) {
        const staleCount = queryData.itemContext.filter(item => item.daysInactive && item.daysInactive >= 7).length;
        selectionExamples.push(`{daysInactiveMin: 7} - selects ${staleCount} stale item${staleCount !== 1 ? 's' : ''}`);
      }

      response.itemPreview = previewItems;
      
      response.selectionHints = [
        `Use index 0 to select the first item`,
        `Use [0, 2, 5] to select specific items by index`,
        `Use {states: ["Active"]} to select all Active items`,
        `Use {tags: ["critical"]} to select items tagged "critical"`,
        `Use {daysInactiveMin: 7} to select stale items (inactive 7+ days)`
      ];
      
      response.availableSelectionCriteria = availableCriteria;
      
      response.selectionStats = {
        totalItems: totalItems,
        byState: stateStats,
        byType: typeStats,
        byTags: tagStats
      };
      
      // Only include examples when explicitly requested (saves ~300 tokens by default)
      if (includeExamples) {
        response.exampleSelectors = selectionExamples;
      }

      // Add legacy preview format for backward compatibility
      response.preview = {
        showing: `First ${previewItems.length} of ${queryData.workItemIds.length} items`,
        items: previewItems
      };

      // Add legacy selection_info for backward compatibility
      response.selection_info = {
        total_selectable_indices: queryData.selectionMetadata.selectableIndices.length,
        available_criteria_tags: queryData.selectionMetadata.criteriaTags
      };
      
      // Only include selection_examples when explicitly requested
      if (includeExamples) {
        response.selection_info.selection_examples = {
          select_all: "itemSelector: 'all'",
          select_first_item: "itemSelector: [0]",
          select_multiple_by_index: "itemSelector: [0, 2, 5]",
          select_by_state: "itemSelector: { states: ['Active', 'New'] }",
          select_stale_items: "itemSelector: { daysInactiveMin: 90 }"
        };
      }
    }

    // Time until expiration
    const now = new Date();
    const timeUntilExpiration = queryData.expiresAt.getTime() - now.getTime();
    const minutesUntilExpiration = Math.floor(timeUntilExpiration / (1000 * 60));

    response.expiration_info = {
      expires_in_minutes: minutesUntilExpiration,
      expires_in_hours: (minutesUntilExpiration / 60).toFixed(1),
      is_expired: timeUntilExpiration <= 0
    };

    const warnings: string[] = [];
    if (minutesUntilExpiration < 10) {
      warnings.push(`Query handle expires in ${minutesUntilExpiration} minutes. Consider regenerating soon.`);
    }

    if (queryData.analysisMetadata?.failureCount && queryData.analysisMetadata.failureCount > 0) {
      warnings.push(`${queryData.analysisMetadata.failureCount} work items failed staleness analysis - they lack lastSubstantiveChangeDate/daysInactive fields`);
    }

    return {
      success: true,
      data: response,
      metadata: { 
        source: "query-handle-service",
        handle: queryHandle,
        inspected_at: new Date().toISOString()
      },
      errors: [],
      warnings
    };
  } catch (error) {
    logger.error('Handler error:', error);
    return buildCatchErrorResponse(error, 'query-handle-service');
  }
}