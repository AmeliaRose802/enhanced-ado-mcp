/**
 * Handler for wit-query-handle-select tool
 * Helps users understand what items they can select from a query handle
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { buildValidationErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";

/**
 * Handler for wit-query-handle-select tool
 * Helps users understand what items they can select from a query handle
 */
export async function handleSelectItemsFromQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, itemSelector, previewCount = 10 } = parsed.data;

    const queryData = queryHandleService.getQueryData(queryHandle);
    if (!queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "select-items-from-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    // Resolve the item selector to get selected IDs
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    if (!selectedWorkItemIds) {
      return {
        success: false,
        data: null,
        metadata: { source: "select-items-from-query-handle" },
        errors: [`Failed to resolve item selector for query handle '${queryHandle}'`],
        warnings: []
      };
    }

    const totalItems = queryData.workItemIds.length;
    const selectedCount = selectedWorkItemIds.length;

    // Build preview of selected items
    const previewItems = selectedWorkItemIds.slice(0, Math.min(previewCount, 50)).map((id: number) => {
      const context = queryData.itemContext.find(item => item.id === id);
      const workItemContext = queryData.workItemContext?.get(id);
      
      return {
        index: context?.index,
        id,
        title: context?.title || "No title",
        state: context?.state || "Unknown",
        type: context?.type || "Unknown",
        days_inactive: context?.daysInactive,
        assigned_to: workItemContext?.assignedTo || "Unassigned",
        tags: context?.tags
      };
    });

    // Analyze selection
    const selectionAnalysis: any = {
      selection_type: Array.isArray(itemSelector) ? 'index-based' : 
                     typeof itemSelector === 'string' ? 'all' : 'criteria-based',
      total_items_in_handle: totalItems,
      selected_items_count: selectedCount,
      selection_percentage: ((selectedCount / totalItems) * 100).toFixed(1) + '%',
      showing_preview: `${previewItems.length} of ${selectedCount} selected items`
    };

    // Add criteria analysis if applicable
    if (typeof itemSelector === 'object' && !Array.isArray(itemSelector)) {
      const criteriaUsed = Object.keys(itemSelector).filter(key => 
        itemSelector[key as keyof typeof itemSelector] !== undefined
      );
      selectionAnalysis.criteria_used = criteriaUsed;
    }

    return {
      success: true,
      data: asToolData({
        query_handle: queryHandle,
        item_selector: itemSelector,
        selection_analysis: selectionAnalysis,
        preview_items: previewItems,
        selection_summary: `Selected ${selectedCount} items out of ${totalItems} total items using ${selectionAnalysis.selection_type} selection`
      }),
      metadata: {
        source: "select-items-from-query-handle",
        queryHandle,
        selectedCount,
        totalItems,
        selectionType: selectionAnalysis.selection_type
      },
      errors: [],
      warnings: selectedCount === 0 ? ['No items matched the selection criteria'] : []
    };

  } catch (error) {
    logger.error('Select items from query handle error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "select-items-from-query-handle" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
