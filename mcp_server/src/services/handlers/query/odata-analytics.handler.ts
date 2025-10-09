/**
 * Handler for wit-query-odata tool
 * Queries Azure DevOps Analytics using OData for efficient aggregations and metrics
 */

import type { ToolConfig, ToolExecutionResult, ToolExecutionData, ToolExecutionMetadata, JSONValue, ODataAnalyticsArgs, ODataResponse } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { getRequiredConfig } from "../../../config/config.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { getAzureDevOpsToken } from "../../../utils/ado-token.js";
import { escapeAreaPath } from "../../../utils/work-item-parser.js";

/**
 * Clean OData metadata from results to reduce response size
 * Removes all @odata.* fields and filters out null values to minimize context usage
 * @param results - Array of result items from OData response
 * @param stripMetadata - Whether to strip @odata.* fields (default true)
 */
function cleanODataResults(results: Record<string, unknown>[], stripMetadata: boolean = true): Record<string, unknown>[] {
  if (!stripMetadata) {
    // Return results as-is when metadata should be included
    return results;
  }
  
  return results.map(item => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      // Skip OData metadata fields and null values
      if (!key.startsWith('@odata') && value !== null) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  });
}

/**
 * Build OData query based on query type and parameters
 */
function buildODataQuery(args: ODataAnalyticsArgs): string {
  const { queryType, filters, groupBy, select, orderBy, dateRangeField, dateRangeStart, dateRangeEnd, 
          areaPath, iterationPath, top, skip, computeCycleTime, customODataQuery } = args;

  let query = "";
  const filterClauses: string[] = [];

  // Build filter clauses
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string') {
        filterClauses.push(`${key} eq '${value}'`);
      } else if (typeof value === 'number') {
        filterClauses.push(`${key} eq ${value}`);
      } else if (typeof value === 'boolean') {
        filterClauses.push(`${key} eq ${value}`);
      }
    }
  }

  // Add date range filter
  if (dateRangeField && dateRangeStart) {
    filterClauses.push(`${dateRangeField} ge ${dateRangeStart}Z`);
  }
  if (dateRangeField && dateRangeEnd) {
    filterClauses.push(`${dateRangeField} le ${dateRangeEnd}Z`);
  }

  // Add area path filter - use 'startswith' for hierarchical filtering
  // Analytics API uses Area/AreaPath navigation property
  if (areaPath) {
    filterClauses.push(`startswith(Area/AreaPath, '${escapeAreaPath(areaPath)}')`);
  }

  // Add iteration path filter - use 'startswith' for hierarchical filtering  
  // Analytics API uses Iteration/IterationPath navigation property
  if (iterationPath) {
    filterClauses.push(`startswith(Iteration/IterationPath, '${escapeAreaPath(iterationPath)}')`);
  }

  switch (queryType) {
    case "workItemCount":
      // Simple count of work items
      query = "$apply=aggregate($count as Count)";
      if (filterClauses.length > 0) {
        query = `$apply=filter(${filterClauses.join(' and ')})/aggregate($count as Count)`;
      }
      break;

    case "groupByState":
      // Group by state with counts
      query = "$apply=groupby((State), aggregate($count as Count))";
      if (filterClauses.length > 0) {
        query = `$apply=filter(${filterClauses.join(' and ')})/groupby((State), aggregate($count as Count))`;
      }
      if (orderBy) {
        query += `&$orderby=${orderBy}`;
      } else {
        query += "&$orderby=Count desc";
      }
      break;

    case "groupByType":
      // Group by work item type with counts
      query = "$apply=groupby((WorkItemType), aggregate($count as Count))";
      if (filterClauses.length > 0) {
        query = `$apply=filter(${filterClauses.join(' and ')})/groupby((WorkItemType), aggregate($count as Count))`;
      }
      if (orderBy) {
        query += `&$orderby=${orderBy}`;
      } else {
        query += "&$orderby=Count desc";
      }
      break;

    case "groupByAssignee":
      // Group by assignee with counts
      query = "$apply=groupby((AssignedTo/UserName), aggregate($count as Count))";
      if (filterClauses.length > 0) {
        query = `$apply=filter(${filterClauses.join(' and ')})/groupby((AssignedTo/UserName), aggregate($count as Count))`;
      }
      if (orderBy) {
        query += `&$orderby=${orderBy}`;
      } else {
        query += "&$orderby=Count desc";
      }
      break;

    case "velocityMetrics":
      // Velocity metrics - completed items grouped by date
      const velocityDateField = dateRangeField || "CompletedDate";
      let velocityFilter = filterClauses.slice();
      velocityFilter.push(`${velocityDateField} ne null`);
      
      query = `$apply=filter(${velocityFilter.join(' and ')})/groupby((${velocityDateField}), aggregate($count as Count))`;
      if (orderBy) {
        query += `&$orderby=${orderBy}`;
      } else {
        query += `&$orderby=${velocityDateField} desc`;
      }
      break;

    case "cycleTimeMetrics":
      // Cycle time metrics - average time from created to completed
      let cycleTimeFilter = filterClauses.slice();
      cycleTimeFilter.push("CompletedDate ne null");
      cycleTimeFilter.push("CreatedDate ne null");
      
      if (computeCycleTime) {
        // Compute cycle time in days using totaloffsetminutes to convert Duration to numeric
        // totaloffsetminutes returns the duration in minutes, divide by 1440 to get days
        query = `$apply=filter(${cycleTimeFilter.join(' and ')})/compute(totaloffsetminutes(CompletedDate sub CreatedDate) div 1440 as CycleTimeDays)/groupby((AssignedTo/UserName), aggregate(CycleTimeDays with average as AvgCycleTime, CycleTimeDays with max as MaxCycleTime, $count as CompletedCount))`;
        
        // Order by the computed aggregation field
        if (orderBy) {
          query += `&$orderby=${orderBy}`;
        } else {
          query += "&$orderby=AvgCycleTime asc";
        }
      } else {
        // Just count completed items by assignee without cycle time computation
        query = `$apply=filter(${cycleTimeFilter.join(' and ')})/groupby((AssignedTo/UserName), aggregate($count as CompletedCount))`;
        
        // Order by count
        if (orderBy) {
          query += `&$orderby=${orderBy}`;
        } else {
          query += "&$orderby=CompletedCount desc";
        }
      }
      break;

    case "customQuery":
      // Custom OData query provided by user
      if (!customODataQuery) {
        throw new Error("customODataQuery is required when queryType is 'customQuery'");
      }
      query = customODataQuery;
      break;

    default:
      throw new Error(`Unsupported query type: ${queryType}`);
  }

  // Add $top and $skip for pagination (not applicable for aggregations with $apply, except velocityMetrics)
  const isPaginationSupported = !query.includes("$apply") || queryType === "velocityMetrics";
  if (isPaginationSupported) {
    if (top) {
      query += `&$top=${top}`;
    }
    if (skip && skip > 0) {
      query += `&$skip=${skip}`;
    }
  }

  // Add select clause if provided
  if (select && select.length > 0 && !query.includes("$apply")) {
    query += `&$select=${select.join(',')}`;
  }

  return query;
}

/**
 * Execute OData Analytics query
 */
export async function handleODataAnalytics(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    // Get default configuration values for organization/project
    const requiredConfig = getRequiredConfig();
    const queryArgs = {
      ...parsed.data,
      organization: parsed.data.organization || requiredConfig.organization,
      project: parsed.data.project || requiredConfig.project
    } as ODataAnalyticsArgs;
    
    // Import config to get default area path
    const { loadConfiguration } = await import('../../../config/config.js');
    const serverConfig = loadConfiguration();
    
    // Apply default area path if not provided
    if (!queryArgs.areaPath && serverConfig.azureDevOps.areaPath) {
      queryArgs.areaPath = serverConfig.azureDevOps.areaPath;
      logger.debug(`Applied default area path: ${serverConfig.azureDevOps.areaPath}`);
    }
    
    logger.debug(`Executing OData Analytics query: ${queryArgs.queryType}`);
    
    // Build the OData query
    const odataQuery = buildODataQuery(queryArgs);
    logger.debug(`OData query string: ${odataQuery}`);

    // Construct the Analytics API URL
    const baseUrl = `https://analytics.dev.azure.com/${queryArgs.organization}/${queryArgs.project}/_odata/v4.0-preview`;
    const fullUrl = `${baseUrl}/WorkItems?${odataQuery}`;
    
    // Get Azure DevOps token - Analytics API uses Bearer token auth
    const token = getAzureDevOpsToken();
    
    // Execute the query with direct fetch - Analytics API doesn't use api-version parameter
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`OData Analytics query failed: ${response.status} ${response.statusText} - ${errorText}`);
      
      // Provide helpful hints for common Analytics API errors
      if (response.status === 401 || response.status === 403 || errorText.includes('TF400813')) {
        throw new Error(
          `Analytics API authorization error: ${response.status} ${response.statusText}\n` +
          `The user account does not have permission to access Azure DevOps Analytics.\n` +
          `Required permission: "View analytics" at the project level.\n` +
          `Please contact your Azure DevOps administrator to grant Analytics access.\n` +
          `Details: ${errorText}`
        );
      }
      
      throw new Error(`Analytics API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as ODataResponse;
    
    // Determine whether to include OData metadata (default: false)
    const includeOdataMetadata = queryArgs.includeOdataMetadata ?? false;
    
    // Clean OData metadata from results based on parameter
    const cleanedResults = cleanODataResults(data.value, !includeOdataMetadata);
    const resultCount = data["@odata.count"] || cleanedResults.length || 0;
    const summary = generateSummary(queryArgs.queryType, resultCount, cleanedResults);

    // Calculate pagination metadata
    const top = queryArgs.top || 100;
    const skip = queryArgs.skip || 0;
    const returned = cleanedResults.length;
    const hasNextLink = !!data["@odata.nextLink"];
    
    // Build concise response - only include what's needed
    const responseData: Record<string, unknown> = {
      summary: summary,
      count: resultCount,
      results: cleanedResults
    };
    
    // Add pagination metadata when applicable
    const isPaginationSupported = !odataQuery.includes("$apply") || queryArgs.queryType === "velocityMetrics";
    if (isPaginationSupported && (returned >= top || hasNextLink || skip > 0)) {
      const pagination: Record<string, unknown> = {
        skip,
        top,
        returned,
        hasMore: hasNextLink || returned >= top
      };
      
      // Add nextSkip only if there are more results
      if (hasNextLink || returned >= top) {
        pagination.nextSkip = skip + returned;
      }
      
      responseData.pagination = pagination;
    }
    
    // Include top-level OData metadata if requested
    if (includeOdataMetadata) {
      if (data["@odata.context"]) {
        responseData["@odata.context"] = data["@odata.context"];
      }
      if (data["@odata.count"] !== undefined) {
        responseData["@odata.count"] = data["@odata.count"];
      }
      if (data["@odata.nextLink"]) {
        responseData["@odata.nextLink"] = data["@odata.nextLink"];
      }
    }
    
    // Only include full metadata if explicitly requested
    if (queryArgs.includeMetadata) {
      responseData.query = odataQuery;
      responseData.analyticsUrl = fullUrl;
    }

    // Add warnings if pagination available
    const warnings: string[] = [];
    const pagination = responseData.pagination as Record<string, unknown> | undefined;
    if (pagination?.hasMore) {
      warnings.push(`More results available. Use skip=${pagination.nextSkip} to get the next page.`);
    }

    return {
      success: true,
      data: responseData as unknown as ToolExecutionData,
      metadata: { 
        source: "odata-analytics",
        ...(pagination ? { pagination: pagination as Record<string, JSONValue> } : {})
      } as ToolExecutionMetadata,
      errors: [],
      warnings
    };
  } catch (error) {
    logger.error('OData Analytics handler error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "odata-analytics" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Generate a human-readable summary based on query type and results
 */
function generateSummary(queryType: string, count: number, results: Record<string, unknown>[]): string {
  switch (queryType) {
    case "workItemCount":
      return `Total work items: ${results[0]?.Count || 0}`;
    
    case "groupByState":
      const statesSummary = results.slice(0, 5).map(r => `${r.State}: ${r.Count}`).join(", ");
      return `Work items by state (top ${Math.min(5, count)}): ${statesSummary}`;
    
    case "groupByType":
      const typesSummary = results.slice(0, 5).map(r => `${r.WorkItemType}: ${r.Count}`).join(", ");
      return `Work items by type (top ${Math.min(5, count)}): ${typesSummary}`;
    
    case "groupByAssignee":
      const assigneeSummary = results.slice(0, 5).map(r => {
        const assignedTo = r.AssignedTo as Record<string, unknown> | undefined;
        const userName = assignedTo?.UserName as string | undefined;
        return `${userName || 'Unassigned'}: ${r.Count}`;
      }).join(", ");
      return `Work items by assignee (top ${Math.min(5, count)}): ${assigneeSummary}`;
    
    case "velocityMetrics":
      return `Found ${count} dates with completed work items`;
    
    case "cycleTimeMetrics":
      const avgCycleTime = results.length > 0 ? (results.reduce((sum, r) => {
        const cycleTime = r.AvgCycleTime as number | undefined;
        return sum + (cycleTime || 0);
      }, 0) / results.length).toFixed(1) : 0;
      return `Cycle time metrics for ${count} assignees (avg: ${avgCycleTime} days)`;
    
    case "customQuery":
      return `Custom query returned ${count} results`;
    
    default:
      return `Query returned ${count} results`;
  }
}
