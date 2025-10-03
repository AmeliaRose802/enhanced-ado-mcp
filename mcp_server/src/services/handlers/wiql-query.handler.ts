/**
 * Handler for wit-get-work-items-by-query-wiql tool
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../ado-work-item-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../utils/response-builder.js";
import { logger } from "../../utils/logger.js";

export async function handleWiqlQuery(config: any, args: any): Promise<ToolExecutionResult> {
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
    
    return {
      success: true,
      data: {
        work_items: result.workItems,
        count: result.count,
        query: result.query,
        summary: `Found ${result.count} work item(s) matching the query`,
        ...(parsed.data.includeSubstantiveChange && { 
          substantiveChangeIncluded: true 
        })
      },
      metadata: { 
        source: "rest-api-wiql",
        count: result.count,
        maxResults: parsed.data.maxResults,
        substantiveChangeAnalysis: parsed.data.includeSubstantiveChange || false
      },
      errors: [],
      warnings: result.count >= (parsed.data.maxResults || 200) 
        ? [`Results limited to ${parsed.data.maxResults || 200} items. Query may have returned more results.`]
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
