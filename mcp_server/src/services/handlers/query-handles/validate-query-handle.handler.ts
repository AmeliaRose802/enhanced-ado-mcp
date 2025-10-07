/**
 * Handler for wit-validate-query-handle tool
 * 
 * Validates a query handle and returns metadata about the stored query results.
 * Useful for checking if a handle is still valid before using it in bulk operations.
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { ADOWorkItem } from "../../../types/ado.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, 
  buildSuccessResponse, 
  buildSuccessResponseWithWarnings, 
  buildErrorResponse, 
  buildPartialSuccessResponse, 
  buildCatchErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

export async function handleValidateQueryHandle(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { queryHandle, includeSampleItems, organization, project } = parsed.data;

    // Retrieve query data from handle
    const queryData = queryHandleService.getQueryData(queryHandle);
    
    if (!queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "validate-query-handle" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 1 hour.`],
        warnings: []
      };
    }

    logger.info(`Validating query handle: ${queryHandle} (${queryData.workItemIds.length} items)`);

    const result: any = {
      valid: true,
      query_handle: queryHandle,
      item_count: queryData.workItemIds.length,
      created_at: queryData.createdAt.toISOString(),
      expires_at: queryData.expiresAt.toISOString(),
      time_remaining_minutes: Math.round((queryData.expiresAt.getTime() - Date.now()) / 60000),
      original_query: queryData.query
    };

    // Add metadata if present
    if (queryData.metadata) {
      result.metadata = queryData.metadata;
    }

    // Include sample items if requested
    if (includeSampleItems && queryData.workItemIds.length > 0) {
      const sampleIds = queryData.workItemIds.slice(0, 5);
      const cfg = loadConfiguration();
      const org = organization || cfg.azureDevOps.organization;
      const proj = project || cfg.azureDevOps.project;

      try {
        const httpClient = new ADOHttpClient(org);
        const sampleItems: any[] = [];

        for (const id of sampleIds) {
          try {
            const response = await httpClient.get<ADOWorkItem>(
              `${proj}/_apis/wit/workitems/${id}?$expand=none&api-version=7.1`
            );

            if (response.data) {
              sampleItems.push({
                id: response.data.id,
                title: response.data.fields?.['System.Title'],
                type: response.data.fields?.['System.WorkItemType'],
                state: response.data.fields?.['System.State']
              });
            }
          } catch (err) {
            logger.warn(`Failed to fetch work item ${id}: ${err}`);
          }
        }

        result.sample_items = sampleItems;
        if (queryData.workItemIds.length > 5) {
          result.sample_note = `Showing first 5 of ${queryData.workItemIds.length} items`;
        }
      } catch (err) {
        logger.error(`Error fetching sample items: ${err}`);
        result.sample_items_error = "Failed to fetch sample items";
      }
    }

    return {
      success: true,
      data: result,
      metadata: { source: "validate-query-handle" },
      errors: [],
      warnings: []
    };

  } catch (error) {
    logger.error(`Error in handleValidateQueryHandle: ${error}`);
    return buildErrorResponse(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        { source: "validate-query-handle" }
      );
  }
}
