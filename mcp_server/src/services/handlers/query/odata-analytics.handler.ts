/**
 * Handler for wit-query-analytics-odata tool
 * Queries Azure DevOps Analytics using OData for efficient aggregations and metrics
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { getAzureDevOpsToken } from "../../../utils/ado-token.js";
import { escapeAreaPath } from "../../../utils/work-item-parser.js";

interface ODataAnalyticsArgs {
  queryType: "workItemCount" | "groupByState" | "groupByType" | "groupByAssignee" | "velocityMetrics" | "cycleTimeMetrics" | "customQuery";
  organization: string;
  project: string;
  filters?: Record<string, string | number | boolean>;
  groupBy?: string[];
  select?: string[];
  orderBy?: string;
  customODataQuery?: string;
  dateRangeField?: "CreatedDate" | "ChangedDate" | "CompletedDate" | "ClosedDate";
  dateRangeStart?: string;
  dateRangeEnd?: string;
  areaPath?: string;
  iterationPath?: string;
  top?: number;
  computeCycleTime?: boolean;
  includeMetadata?: boolean;
  includeOdataMetadata?: boolean;
}

interface ODataResponse {
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
  value: any[];
}

/**
 * Clean OData metadata from results to reduce response size
 * Removes all @odata.* fields and filters out null values to minimize context usage
 * @param results - Array of result items from OData response
 * @param stripMetadata - Whether to strip @odata.* fields (default true)
 */
function cleanODataResults(results: any[], stripMetadata: boolean = true): any[] {
  if (!stripMetadata) {
    // Return results as-is when metadata should be included
    return results;
  }
  
  return results.map(item => {
    const cleaned: any = {};
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
          areaPath, iterationPath, top, computeCycleTime, customODataQuery } = args;

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

  // Add $top if specified (not applicable for aggregations with $apply)
  if (top && !query.includes("$apply")) {
    query += `&$top=${top}`;
  } else if (top && queryType === "velocityMetrics") {
    query += `&$top=${top}`;
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

    let queryArgs = parsed.data as ODataAnalyticsArgs;
    
    // Import config to get default area path
    const { loadConfiguration } = await import('../../../config/config.js');
    const serverConfig = loadConfiguration();
    
    // Apply default area path if not provided
    if (!queryArgs.areaPath && serverConfig.azureDevOps.areaPath) {
      queryArgs = { ...queryArgs, areaPath: serverConfig.azureDevOps.areaPath };
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
      throw new Error(`Analytics API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as ODataResponse;
    
    // Determine whether to include OData metadata (default: false)
    const includeOdataMetadata = queryArgs.includeOdataMetadata ?? false;
    
    // Clean OData metadata from results based on parameter
    const cleanedResults = cleanODataResults(data.value, !includeOdataMetadata);
    const resultCount = data["@odata.count"] || cleanedResults.length || 0;
    const summary = generateSummary(queryArgs.queryType, resultCount, cleanedResults);

    // Build concise response - only include what's needed
    const responseData: any = {
      summary: summary,
      count: resultCount,
      results: cleanedResults
    };
    
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

    return {
      success: true,
      data: responseData,
      metadata: { 
        source: "odata-analytics"
      },
      errors: [],
      warnings: []
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
function generateSummary(queryType: string, count: number, results: any[]): string {
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
      const assigneeSummary = results.slice(0, 5).map(r => `${r.AssignedTo?.UserName || 'Unassigned'}: ${r.Count}`).join(", ");
      return `Work items by assignee (top ${Math.min(5, count)}): ${assigneeSummary}`;
    
    case "velocityMetrics":
      return `Found ${count} dates with completed work items`;
    
    case "cycleTimeMetrics":
      const avgCycleTime = results.length > 0 ? (results.reduce((sum, r) => sum + (r.AvgCycleTime || 0), 0) / results.length).toFixed(1) : 0;
      return `Cycle time metrics for ${count} assignees (avg: ${avgCycleTime} days)`;
    
    case "customQuery":
      return `Custom query returned ${count} results`;
    
    default:
      return `Query returned ${count} results`;
  }
}
