/**
 * Handler for get-context-bulk tool
 * Retrieves full context packages for multiple work items using query handle pattern
 */

import type { ToolConfig, ToolExecutionResult, JSONValue } from "@/types/index.js";
import { asToolData } from "@/types/index.js";
import { buildValidationErrorResponse, buildErrorResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { handleGetWorkItemContextPackage } from "./get-work-item-context-package.handler.js";

interface SelectionSummary {
  selection_type: 'index-based' | 'all' | 'criteria-based';
  criteria?: JSONValue;
}
import { loadConfiguration } from "@/config/config.js";

/**
 * Handler for retrieving full context packages by query handle
 * Safely retrieves comprehensive context for multiple work items without exposing IDs to LLM
 */
export async function handleGetContextPackagesByQueryHandle(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const {
      queryHandle,
      itemSelector = 'all',
      includeHistory = false,
      maxHistoryRevisions = 5,
      includeComments = true,
      includeRelations = true,
      includeChildren = true,
      includeParent = true,
      includeExtendedFields = false,
      maxPreviewItems = 10,
      organization,
      project
    } = parsed.data;

    const cfg = loadConfiguration();
    const effectiveOrg = organization || cfg.azureDevOps.organization;
    const effectiveProject = project || cfg.azureDevOps.project;

    // Validate query handle exists
    const queryData = queryHandleService.getQueryData(queryHandle);
    if (!queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "get-context-packages-by-query-handle" },
        errors: [
          `Query handle '${queryHandle}' not found or expired.`,
          `Possible causes: 1) Handle expired (handles last 24 hours), 2) MCP server restarted (handles are stored in memory), or 3) Invalid handle ID.`,
          `If the handle was created recently, check if the MCP server was restarted. Re-run the query to generate a new handle.`
        ],
        warnings: []
      };
    }

    // Resolve item selector to work item IDs
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    if (!selectedWorkItemIds) {
      return {
        success: false,
        data: null,
        metadata: { source: "get-context-packages-by-query-handle" },
        errors: [`Failed to resolve item selector for query handle '${queryHandle}'`],
        warnings: []
      };
    }

    if (selectedWorkItemIds.length === 0) {
      return {
        success: true,
        data: {
          query_handle: queryHandle,
          total_items_in_handle: queryData.workItemIds.length,
          selected_items_count: 0,
          context_packages: [],
          message: "No items matched the selection criteria"
        },
        metadata: { source: "get-context-packages-by-query-handle" },
        errors: [],
        warnings: []
      };
    }

    const warnings: string[] = [];
    
    // Limit to maxPreviewItems to avoid overwhelming context
    const itemsToFetch = selectedWorkItemIds.slice(0, maxPreviewItems);
    if (selectedWorkItemIds.length > maxPreviewItems) {
      warnings.push(
        `Selected ${selectedWorkItemIds.length} items but limiting to ${maxPreviewItems} context packages to preserve context window. ` +
        `Adjust maxPreviewItems parameter to retrieve more (max 50).`
      );
    }

    // Warn about large operations
    if (itemsToFetch.length > 20) {
      warnings.push(
        `Fetching ${itemsToFetch.length} context packages will make ${itemsToFetch.length * 2} API calls. ` +
        `Consider using smaller batches or more selective criteria for better performance.`
      );
    }

    logger.info(`Fetching context packages for ${itemsToFetch.length} work items from query handle ${queryHandle}`);

    // Fetch context packages for all selected items
    const packagePromises = itemsToFetch.map(async (workItemId: number) => {
      try {
        const packageResult = await handleGetWorkItemContextPackage({
          workItemId,
          organization: effectiveOrg,
          project: effectiveProject,
          includeHistory,
          maxHistoryRevisions,
          includeComments,
          includeRelations,
          includeChildren,
          includeParent,
          includeLinkedPRsAndCommits: true,
          includeExtendedFields,
          includeHtml: false,
          includeHtmlFields: false,
          stripHtmlFormatting: true,
          maxChildDepth: 1,
          maxRelatedItems: 50,
          includeAttachments: false,
          includeTags: true
        });

        if (packageResult.success && packageResult.data && typeof packageResult.data === 'object' && 'contextPackage' in packageResult.data) {
          return {
            success: true,
            workItemId,
            package: (packageResult.data as any).contextPackage
          };
        } else {
          logger.warn(`Failed to fetch context package for work item ${workItemId}:`, packageResult.errors);
          return {
            success: false,
            workItemId,
            error: packageResult.errors?.[0] || 'Unknown error'
          };
        }
      } catch (error) {
        logger.error(`Error fetching context package for work item ${workItemId}:`, error);
        return {
          success: false,
          workItemId,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    const packageResults = await Promise.all(packagePromises);

    // Separate successful and failed packages
    const successfulPackages = packageResults.filter(r => r.success);
    const failedPackages = packageResults.filter(r => !r.success);

    if (failedPackages.length > 0) {
      warnings.push(
        `${failedPackages.length} item(s) failed to fetch context packages. ` +
        `IDs: ${failedPackages.map(p => p.workItemId).join(', ')}`
      );
    }

    // Build context packages array
    const contextPackages = successfulPackages.map(r => r.package);

    // Build selection summary
    const selectionSummary: SelectionSummary = {
      selection_type: Array.isArray(itemSelector) ? 'index-based' : 
                     typeof itemSelector === 'string' ? 'all' : 'criteria-based'
    };

    if (typeof itemSelector === 'object' && !Array.isArray(itemSelector)) {
      selectionSummary.criteria = itemSelector;
    }

    return {
      success: true,
      data: asToolData({
        query_handle: queryHandle,
        total_items_in_handle: queryData.workItemIds.length,
        selected_items_count: selectedWorkItemIds.length,
        fetched_packages_count: successfulPackages.length,
        failed_packages_count: failedPackages.length,
        selection_summary: selectionSummary,
        context_packages: contextPackages,
        message: `Successfully retrieved ${successfulPackages.length} context packages from query handle`,
        next_steps: [
          "Review context_packages array for detailed work item information",
          "Each package includes core fields, relations, comments, and optional history",
          "Use this rich context for AI-powered analysis and decision making",
          "Combine with bulk operation tools to take action on analyzed items"
        ]
      }),
      metadata: {
        source: "get-context-packages-by-query-handle",
        query_handle_info: {
          created_at: queryData.createdAt.toISOString(),
          expires_at: queryData.expiresAt.toISOString()
        },
        packages_included: {
          history: includeHistory,
          comments: includeComments,
          relations: includeRelations,
          children: includeChildren,
          parent: includeParent,
          extended_fields: includeExtendedFields
        }
      },
      errors: [],
      warnings
    };
  } catch (error) {
    logger.error('Get context packages by query handle error:', error);
    return buildErrorResponse(error as Error, { 
      tool: 'wit-get-context-packages-by-query-handle' 
    });
  }
}
