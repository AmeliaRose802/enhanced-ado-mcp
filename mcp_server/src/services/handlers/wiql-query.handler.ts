/**
 * Handler for wit-get-work-items-by-query-wiql tool
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../ado-work-item-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../utils/response-builder.js";
import { logger } from "../../utils/logger.js";
import { queryHandleService } from "../query-handle-service.js";

export async function handleWiqlQuery(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    logger.debug(`Executing WIQL query: ${parsed.data.wiqlQuery}`);
    if (parsed.data.includeSubstantiveChange) {
      logger.debug(`Substantive change analysis enabled (history depth: ${parsed.data.substantiveChangeHistoryCount || 50})`);
    }
    
    const result = await queryWorkItemsByWiql(parsed.data);
    
    const pageSize = parsed.data.top ?? parsed.data.maxResults ?? 200;

    // If returnQueryHandle is true, store results and return handle instead
    if (parsed.data.returnQueryHandle) {
      const workItemIds = result.workItems.map((wi: any) => wi.id);
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        parsed.data.wiqlQuery,
        {
          project: parsed.data.project,
          queryType: 'wiql'
        }
      );

      logger.info(`Query handle created: ${handle} (${workItemIds.length} work items)`);

      return {
        success: true,
        data: {
          query_handle: handle,
          work_item_count: workItemIds.length,
          total_count: result.totalCount,
          query: result.query,
          summary: `Query handle created for ${workItemIds.length} work item(s). Use this handle with bulk operation tools (wit-bulk-*-by-query-handle) to perform safe operations. Handle expires in 1 hour.`,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          pagination: {
            skip: result.skip,
            top: result.top,
            totalCount: result.totalCount,
            hasMore: result.hasMore
          }
        },
        metadata: {
          source: "rest-api-wiql",
          queryHandleMode: true,
          handle,
          count: workItemIds.length,
          totalCount: result.totalCount
        },
        errors: [],
        warnings: result.hasMore
          ? [`Query returned ${result.totalCount} total results. Handle contains first ${workItemIds.length} items. Use pagination if you need all results.`]
          : []
      };
    }
    
    // Standard response with full work item details
    return {
      success: true,
      data: {
        work_items: result.workItems,
        count: result.count,
        query: result.query,
        summary: `Found ${result.count} work item(s) matching the query (showing ${result.skip + 1}-${result.skip + result.count} of ${result.totalCount} total)`,
        pagination: {
          skip: result.skip,
          top: result.top,
          totalCount: result.totalCount,
          hasMore: result.hasMore,
          ...(result.hasMore && {
            nextSkip: result.skip + result.top,
            message: `Use skip=${result.skip + result.top} to get the next page of results`
          })
        },
        ...(parsed.data.includeSubstantiveChange && { 
          substantiveChangeIncluded: true 
        })
      },
      metadata: { 
        source: "rest-api-wiql",
        count: result.count,
        totalCount: result.totalCount,
        skip: result.skip,
        top: result.top,
        hasMore: result.hasMore,
        maxResults: pageSize,
        substantiveChangeAnalysis: parsed.data.includeSubstantiveChange || false
      },
      errors: [],
      warnings: result.hasMore
        ? [`Query returned ${result.totalCount} total results. Showing page ${Math.floor(result.skip / result.top) + 1}. Use skip=${result.skip + result.top} to get the next page.`]
        : []
    };
  } catch (error) {
    logger.error('WIQL query handler error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "rest-api-wiql" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
