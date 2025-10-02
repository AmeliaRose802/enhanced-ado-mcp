/**
 * Handler for wit-get-work-items-by-query-wiql tool
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { validateAzureCLI } from "../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../ado-work-item-service.js";
import { logger } from "../../utils/logger.js";

export async function handleWiqlQuery(config: any, args: any): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      throw new Error(azValidation.error || "Azure CLI validation failed");
    }

    // Parse and validate arguments using the schema
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      throw new Error(`Validation error: ${parsed.error.message}`);
    }

    logger.debug(`Executing WIQL query: ${parsed.data.WiqlQuery}`);
    if (parsed.data.IncludeSubstantiveChange) {
      logger.debug(`Substantive change analysis enabled (history depth: ${parsed.data.SubstantiveChangeHistoryCount || 50})`);
    }
    
    const result = await queryWorkItemsByWiql(parsed.data);
    
    return {
      success: true,
      data: {
        work_items: result.workItems,
        count: result.count,
        query: result.query,
        summary: `Found ${result.count} work item(s) matching the query`,
        ...(parsed.data.IncludeSubstantiveChange && { 
          substantiveChangeIncluded: true 
        })
      },
      raw: { 
        stdout: JSON.stringify({ 
          work_items: result.workItems, 
          count: result.count,
          query: result.query 
        }, null, 2), 
        stderr: "", 
        exitCode: 0 
      },
      metadata: { 
        source: "rest-api-wiql",
        count: result.count,
        maxResults: parsed.data.MaxResults,
        substantiveChangeAnalysis: parsed.data.IncludeSubstantiveChange || false
      },
      errors: [],
      warnings: result.count >= (parsed.data.MaxResults || 200) 
        ? [`Results limited to ${parsed.data.MaxResults || 200} items. Query may have returned more results.`]
        : []
    };
  } catch (error) {
    logger.error('WIQL query handler error:', error);
    return {
      success: false,
      data: null,
      raw: { 
        stdout: "", 
        stderr: error instanceof Error ? error.message : String(error), 
        exitCode: 1 
      },
      metadata: { source: "rest-api-wiql" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
