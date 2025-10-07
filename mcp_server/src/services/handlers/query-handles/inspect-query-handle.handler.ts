/**
 * Handler for wit-inspect-query-handle tool
 * Allows inspection of query handle contents including staleness data
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { buildValidationErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";

export async function handleInspectQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, includePreview = true, includeStats = true } = parsed.data;

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

      // Calculate staleness statistics if we have the data
      if (queryData.workItemContext && queryData.analysisMetadata.includeSubstantiveChange) {
        const stalenessData = Array.from(queryData.workItemContext.values())
          .filter(context => context.daysInactive !== undefined && typeof context.daysInactive === 'number')
          .map(context => context.daysInactive as number);

        if (stalenessData.length > 0) {
          const sortedDays = [...stalenessData].sort((a, b) => a - b);
          response.analysis.staleness_statistics = {
            min_days_inactive: Math.min(...stalenessData),
            max_days_inactive: Math.max(...stalenessData),
            avg_days_inactive: Math.round(stalenessData.reduce((a, b) => a + b, 0) / stalenessData.length),
            median_days_inactive: sortedDays[Math.floor(sortedDays.length / 2)],
            items_over_90_days: stalenessData.filter(d => d > 90).length,
            items_over_180_days: stalenessData.filter(d => d > 180).length,
            items_over_365_days: stalenessData.filter(d => d > 365).length
          };
        }
      }
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
          type: item.type,
          selection_hint: `Use index ${item.index} to select this item`
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

      response.preview = {
        showing: `First ${previewItems.length} of ${queryData.workItemIds.length} items`,
        items: previewItems
      };

      // Add selection metadata
      response.selection_info = {
        total_selectable_indices: queryData.selectionMetadata.selectableIndices.length,
        available_criteria_tags: queryData.selectionMetadata.criteriaTags,
        selection_examples: {
          select_all: "itemSelector: 'all'",
          select_first_item: "itemSelector: [0]",
          select_multiple_by_index: "itemSelector: [0, 2, 5]",
          select_by_state: "itemSelector: { states: ['Active', 'New'] }",
          select_stale_items: "itemSelector: { daysInactiveMin: 90 }"
        }
      };
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
    logger.error('Inspect query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "query-handle-service" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}