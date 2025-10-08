/**
 * Handler for wit-query-handle-validate tool
 * 
 * Validates a query handle and returns metadata about the stored query results.
 * Useful for checking if a handle is still valid before using it in bulk operations.
 */

import type { ToolConfig, ToolExecutionResult, JSONValue, ToolExecutionData } from "../../../types/index.js";
import type { ADOWorkItem } from "../../../types/ado.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildNotFoundError, buildErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";

interface WorkItemSample {
  id: number;
  title: string;
  type: string;
  state: string;
}

interface ValidateQueryHandleResult {
  valid: boolean;
  query_handle: string;
  item_count: number;
  created_at: string;
  expires_at: string;
  time_remaining_minutes: number;
  original_query: string;
  metadata?: JSONValue;
  sample_items?: WorkItemSample[];
  sample_note?: string;
  sample_items_error?: string;
}

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
      return buildNotFoundError('query-handle', queryHandle, {
        source: 'validate-query-handle',
        hint: 'Query handles expire after 1 hour.'
      });
    }

    logger.info(`Validating query handle: ${queryHandle} (${queryData.workItemIds.length} items)`);

    const result: ValidateQueryHandleResult = {
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
        const sampleItems: WorkItemSample[] = [];

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
      data: result as unknown as ToolExecutionData,
      metadata: { source: "validate-query-handle" },
      errors: [],
      warnings: []
    };

  } catch (error) {
    logger.error(`Error in handleValidateQueryHandle: ${error}`);
    // Auto-categorizes error based on message
    return buildErrorResponse(
      error as Error,
      { source: 'validate-query-handle' }
    );
  }
}
