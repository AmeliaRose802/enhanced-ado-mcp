/**
 * Handler for wit-query-wiql tool
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { WorkItemContext, WorkItemContextPackage } from "../../../types/work-items.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { handleGetWorkItemContextPackage } from "../context/get-work-item-context-package.handler.js";

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
    if (parsed.data.fetchFullPackages) {
      logger.debug(`Full context packages will be fetched for each work item`);
    }
    
    const result = await queryWorkItemsByWiql(parsed.data);
    
    const pageSize = parsed.data.top ?? parsed.data.maxResults ?? 200;

    // If fetchFullPackages is enabled, fetch full context packages for each work item
    let fullPackages: WorkItemContextPackage[] | undefined = undefined;
    if (parsed.data.fetchFullPackages) {
      logger.info(`Fetching full context packages for ${result.workItems.length} work items...`);
      const packagePromises = result.workItems.map(async (wi: any) => {
        try {
          const packageResult = await handleGetWorkItemContextPackage({
            workItemId: wi.id,
            organization: parsed.data.organization,
            project: parsed.data.project,
            includeHistory: true,
            maxHistoryRevisions: 10,
            includeComments: true,
            includeRelations: true,
            includeChildren: true,
            includeParent: true,
            includeLinkedPRsAndCommits: true,
            includeExtendedFields: true,
            includeHtml: false,
            maxChildDepth: 1,
            maxRelatedItems: 50,
            includeAttachments: false,
            includeTags: true
          });
          
          // Type guard for context package result
          const data = packageResult.data as { contextPackage?: unknown } | undefined;
          if (packageResult.success && data?.contextPackage) {
            return data.contextPackage;
          } else {
            logger.warn(`Failed to fetch context package for work item ${wi.id}`);
            return null;
          }
        } catch (error) {
          logger.error(`Error fetching context package for work item ${wi.id}:`, error);
          return null;
        }
      });
      
      const packages = await Promise.all(packagePromises);
      fullPackages = packages.filter((p: any): p is NonNullable<typeof p> => p !== null);
      logger.info(`Successfully fetched ${fullPackages?.length ?? 0} of ${result.workItems.length} context packages`);
    }

    // If returnQueryHandle is true, store results and return handle along with work items
    if (parsed.data.returnQueryHandle) {
      const workItemIds = result.workItems.map((wi: any) => wi.id);
      
      // Build work item context map if we have work items data
      const workItemContext = new Map<number, WorkItemContext>();
      for (const wi of result.workItems) {
        // Get tags from System.Tags field (stored as semicolon-separated string)
        const tagsValue = wi.additionalFields?.['System.Tags'];
        const tagsString = typeof tagsValue === 'string' ? tagsValue : '';
        
        workItemContext.set(wi.id, {
          title: wi.title,
          state: wi.state,
          type: wi.type,
          createdDate: wi.createdDate,
          assignedTo: wi.assignedTo,
          areaPath: wi.areaPath,
          iterationPath: wi.iterationPath,
          changedDate: wi.changedDate,
          tags: tagsString, // Store as string for service to parse
          ...(wi.lastSubstantiveChangeDate && { lastSubstantiveChangeDate: wi.lastSubstantiveChangeDate }),
          ...(wi.daysInactive !== undefined && { daysInactive: wi.daysInactive }),
          ...(wi.additionalFields && wi.additionalFields)
        });
      }

      // Build analysis metadata
      const analysisMetadata = {
        includeSubstantiveChange: parsed.data.includeSubstantiveChange || false,
        stalenessThresholdDays: parsed.data.staleThresholdDays,
        analysisTimestamp: new Date().toISOString(),
        successCount: result.workItems.filter((wi: any) => wi.lastSubstantiveChangeDate !== undefined).length,
        failureCount: result.workItems.length - result.workItems.filter((wi: any) => wi.lastSubstantiveChangeDate !== undefined).length
      };
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        parsed.data.wiqlQuery,
        {
          project: parsed.data.project,
          queryType: 'wiql'
        },
        60 * 60 * 1000, // 1 hour TTL
        workItemContext,
        analysisMetadata
      );

      logger.info(`Query handle created: ${handle} (${workItemIds.length} work items)`);

      return {
        success: true,
        data: {
          query_handle: handle,
          work_items: result.workItems,
          ...(fullPackages && { full_packages: fullPackages }),
          work_item_count: workItemIds.length,
          total_count: result.totalCount,
          query: result.query,
          summary: fullPackages 
            ? `Query handle created for ${workItemIds.length} work item(s) with full context packages. Use the handle with bulk operation tools (wit-bulk-*-by-query-handle) to perform safe operations. Handle expires in 1 hour.`
            : `Query handle created for ${workItemIds.length} work item(s) along with full work item details. Use the handle with bulk operation tools (wit-bulk-*-by-query-handle) to perform safe operations. Handle expires in 1 hour.`,
          next_steps: [
            "Review the work_items array to see what will be affected",
            ...(fullPackages ? ["Review the full_packages array for detailed context including descriptions, comments, relations, and history"] : []),
            "Use wit-bulk-comment to add comments to all items",
            "Use wit-bulk-update to update fields on all items",
            "Use wit-bulk-assign to assign all items to a user",
            "Use wit-bulk-remove to remove all items",
            "Always use dryRun: true first to preview changes before applying them"
          ],
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          ...((result.totalCount > result.top || parsed.data.includePaginationDetails) && {
            pagination: {
              skip: result.skip,
              top: result.top,
              totalCount: result.totalCount,
              hasMore: result.hasMore,
              ...(result.hasMore && { nextSkip: result.skip + result.top })
            }
          }),
          ...(parsed.data.includeSubstantiveChange && { 
            substantiveChangeIncluded: true 
          }),
          ...(fullPackages && {
            fullPackagesIncluded: true,
            fullPackagesCount: fullPackages.length
          })
        },
        metadata: {
          source: "rest-api-wiql",
          queryHandleMode: true,
          handle,
          count: workItemIds.length,
          totalCount: result.totalCount,
          substantiveChangeAnalysis: parsed.data.includeSubstantiveChange || false,
          fullPackagesFetched: !!fullPackages
        },
        errors: [],
        warnings: [
          ...(result.hasMore
            ? [`Query returned ${result.totalCount} total results. Handle contains first ${workItemIds.length} items. Use pagination if you need all results.`]
            : []),
          ...(fullPackages && fullPackages.length < result.workItems.length
            ? [`Successfully fetched ${fullPackages.length} of ${result.workItems.length} full context packages. Some packages may have failed to load.`]
            : []),
          ...(parsed.data.fetchFullPackages && workItemIds.length > 50
            ? [`⚠️ Fetching full packages for ${workItemIds.length} items made ${workItemIds.length * 2} API calls. Consider using pagination or filtering for smaller result sets.`]
            : [])
        ]
      };
    }
    
    // Standard response with full work item details
    return {
      success: true,
      data: {
        work_items: result.workItems,
        ...(fullPackages && { full_packages: fullPackages }),
        count: result.count,
        query: result.query,
        summary: fullPackages
          ? `Found ${result.count} work item(s) with full context packages matching the query (showing ${result.skip + 1}-${result.skip + result.count} of ${result.totalCount} total)`
          : `Found ${result.count} work item(s) matching the query (showing ${result.skip + 1}-${result.skip + result.count} of ${result.totalCount} total)`,
        ...((result.totalCount > result.top || parsed.data.includePaginationDetails) && {
          pagination: {
            skip: result.skip,
            top: result.top,
            totalCount: result.totalCount,
            hasMore: result.hasMore,
            ...(result.hasMore && {
              nextSkip: result.skip + result.top,
              message: `Use skip=${result.skip + result.top} to get the next page of results`
            })
          }
        }),
        ...(parsed.data.includeSubstantiveChange && { 
          substantiveChangeIncluded: true 
        }),
        ...(fullPackages && {
          fullPackagesIncluded: true,
          fullPackagesCount: fullPackages.length
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
        substantiveChangeAnalysis: parsed.data.includeSubstantiveChange || false,
        fullPackagesFetched: !!fullPackages
      },
      errors: [],
      warnings: [
        ...(result.hasMore
          ? [`Query returned ${result.totalCount} total results. Showing page ${Math.floor(result.skip / result.top) + 1}. Use skip=${result.skip + result.top} to get the next page.`]
          : []),
        ...(fullPackages && fullPackages.length < result.workItems.length
          ? [`Successfully fetched ${fullPackages.length} of ${result.workItems.length} full context packages. Some packages may have failed to load.`]
          : []),
        ...(parsed.data.fetchFullPackages && result.count > 50
          ? [`⚠️ Fetching full packages for ${result.count} items made ${result.count * 2} API calls. Consider using pagination or filtering for smaller result sets.`]
          : [])
      ]
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
