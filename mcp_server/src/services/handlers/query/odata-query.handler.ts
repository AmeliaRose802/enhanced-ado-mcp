/**
 * Handler for wit-odata-query tool
 * Supports both direct OData execution and AI-powered query generation
 */

import type { ToolConfig, ToolExecutionResult, ToolExecutionData, ToolExecutionMetadata, JSONValue, ODataAnalyticsArgs, ODataResponse } from "@/types/index.js";
import type { MCPServer, MCPServerLike } from "@/types/mcp.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { getRequiredConfig } from "@/config/config.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { getTokenProvider } from '@/utils/token-provider.js';
import { escapeAreaPath } from "@/utils/work-item-parser.js";
import { cacheService } from "../../cache-service.js";
import { SamplingClient } from "@/utils/sampling-client.js";
import { queryHandleService } from "../../query-handle-service.js";
import { asToolData } from "@/types/index.js";
import crypto from 'crypto';

/**
 * Main OData query handler
 * Supports both AI-powered query generation and direct OData execution
 */
export async function handleODataQuery(
  config: ToolConfig,
  args: unknown,
  serverInstance?: MCPServer | MCPServerLike
): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const requiredConfig = getRequiredConfig();
    
    // Determine if this is AI generation or direct execution
    const isAIGeneration = !!parsed.data.description && !parsed.data.queryType && !parsed.data.customODataQuery;
    
    const queryArgs = {
      ...parsed.data,
      organization: parsed.data.organization || requiredConfig.organization,
      project: parsed.data.project || requiredConfig.project,
      areaPath: parsed.data.areaPath || requiredConfig.defaultAreaPath,
      iterationPath: parsed.data.iterationPath || requiredConfig.defaultIterationPath
    } as any;

    // Apply default area path if not provided
    if (!queryArgs.areaPath && requiredConfig.defaultAreaPath) {
      queryArgs.areaPath = requiredConfig.defaultAreaPath;
      logger.debug(`Applied default area path: ${requiredConfig.defaultAreaPath}`);
    }

    let finalQuery: string;
    let aiGenerationMetadata: Record<string, unknown> = {};
    let isAggregationQuery = false;

    // AI-powered query generation path
    if (isAIGeneration) {
      if (!serverInstance) {
        return {
          success: false,
          data: null,
          metadata: { source: "odata-query" },
          errors: ["AI generation requires sampling support. Provide a direct OData query instead, or enable VS Code Language Model API."],
          warnings: []
        };
      }

      const samplingClient = new SamplingClient(serverInstance);
      if (!samplingClient.hasSamplingSupport()) {
        return buildSamplingUnavailableResponse();
      }

      logger.info(`🤖 Generating OData query from description: "${queryArgs.description}"`);

      const generationResult = await generateAndValidateODataQuery(
        samplingClient,
        queryArgs.description!,
        queryArgs,
        queryArgs.maxIterations || 3,
        queryArgs.includeExamples !== false,
        queryArgs.testQuery !== false
      );

      if (!generationResult.success) {
        return {
          success: false,
          data: asToolData({
            query: generationResult.query || null,
            isValidated: false,
            summary: `Failed to generate valid query. Last error: ${generationResult.error}`
          }),
          metadata: {
            source: "odata-query",
            mode: "ai-generation",
            validated: false,
            iterationCount: generationResult.iterationCount
          },
          errors: [generationResult.error || "Failed to generate valid query"],
          warnings: []
        };
      }

      finalQuery = generationResult.query!;
      isAggregationQuery = generationResult.isAggregation || false;
      aiGenerationMetadata = {
        aiGenerated: true,
        iterationCount: generationResult.iterationCount,
        validated: generationResult.validated,
        ...(generationResult.usage && { usage: generationResult.usage })
      };

      logger.info(`✅ Generated valid query in ${generationResult.iterationCount} iteration(s)`);

      // If AI generation was used but returnQueryHandle is false or it's an aggregation query, return just the query
      if (!queryArgs.returnQueryHandle || isAggregationQuery) {
        const warnings: string[] = [];
        if (isAggregationQuery) {
          warnings.push("⚠️ Query handles not available for aggregated queries - results are statistical summaries, not work item lists");
          warnings.push("Use this query directly with wit-odata-query to get aggregated results");
        }

        return {
          success: true,
          data: asToolData({
            query: finalQuery,
            isValidated: generationResult.validated,
            message: isAggregationQuery
              ? '✅ Query generated successfully. This is an aggregation query - execute it to get statistical results.'
              : '✅ Query generated successfully. Set returnQueryHandle=true to execute it and get results.'
          }),
          metadata: {
            source: "odata-query",
            mode: "ai-generation-only",
            queryType: isAggregationQuery ? 'aggregation' : 'itemList',
            ...aiGenerationMetadata
          },
          errors: [],
          warnings
        };
      }

      // For non-aggregation AI-generated queries with returnQueryHandle=true, execute the query
      logger.info(`Executing AI-generated OData query to create query handle (maxResults: ${queryArgs.maxResults || 200})...`);
      
      return await executeODataQueryForHandle(
        finalQuery,
        queryArgs,
        aiGenerationMetadata
      );
    }

    // Direct OData execution path
    if (queryArgs.customODataQuery) {
      logger.debug(`Executing custom OData query: ${queryArgs.customODataQuery}`);
      finalQuery = queryArgs.customODataQuery;
      isAggregationQuery = finalQuery.includes('$apply') || finalQuery.includes('aggregate');
    } else if (queryArgs.queryType) {
      logger.debug(`Executing OData query type: ${queryArgs.queryType}`);
      finalQuery = buildODataQuery(queryArgs as ODataAnalyticsArgs);
      isAggregationQuery = queryArgs.queryType !== 'velocityMetrics' && finalQuery.includes('$apply');
    } else {
      return {
        success: false,
        data: null,
        metadata: { source: "odata-query" },
        errors: ["Must provide either 'description' (for AI generation), 'queryType', or 'customODataQuery'"],
        warnings: []
      };
    }

    // For aggregation queries or when returnQueryHandle=false, execute via Analytics API
    if (isAggregationQuery || !queryArgs.returnQueryHandle) {
      return await executeODataAnalytics(finalQuery, queryArgs as ODataAnalyticsArgs, {});
    }

    // For non-aggregation queries with returnQueryHandle=true, execute and create handle
    return await executeODataQueryForHandle(
      finalQuery,
      queryArgs,
      {}
    );

  } catch (error) {
    logger.error('OData query handler error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "odata-query" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Execute OData query for analytics/aggregations (no query handle)
 */
async function executeODataAnalytics(
  odataQuery: string,
  queryArgs: ODataAnalyticsArgs,
  aiMetadata: Record<string, unknown>
): Promise<ToolExecutionResult> {
  // Validate required parameters before constructing URL
  if (!queryArgs.organization || !queryArgs.project) {
    return {
      success: false,
      data: null,
      metadata: { source: "odata-query" },
      errors: [
        `Missing required parameters: ${!queryArgs.organization ? 'organization' : ''} ${!queryArgs.project ? 'project' : ''}`.trim() +
        `\n\nThis is likely a configuration issue. Ensure the MCP server is started with proper CLI arguments:\n` +
        `enhanced-ado-mcp <organization> --area-path "ProjectName\\\\TeamName"`
      ],
      warnings: []
    };
  }
  
  const baseUrl = `https://analytics.dev.azure.com/${queryArgs.organization}/${queryArgs.project}/_odata/v4.0-preview`;
  const fullUrl = `${baseUrl}/WorkItems?${odataQuery}`;
  
  const cacheKey = generateODataCacheKey(fullUrl);
  
  // Check cache first
  const cached = cacheService.get(cacheKey);
  let data: ODataResponse;
  
  if (cached) {
    logger.debug(`Cache hit for OData query: ${cacheKey.substring(0, 32)}...`);
    data = cached as ODataResponse;
  } else {
    logger.debug(`Cache miss for OData query, executing: ${cacheKey.substring(0, 32)}...`);
    
    const token = await getTokenProvider()();
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-TFS-FedAuthRedirect': 'Suppress'  // Suppress federated auth redirects - required for proper authentication
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`OData Analytics query failed: ${response.status} ${response.statusText} - ${errorText}`);
      
      if (response.status === 401 || response.status === 403 || errorText.includes('TF400813')) {
        throw new Error(
          `Analytics API authorization error: ${response.status} ${response.statusText}\n\n` +
          `The user account does not have permission to access Azure DevOps Analytics.\n\n` +
          `REQUIRED PERMISSION: "View analytics" at the project level\n` +
          `This permission is required to use OData queries for aggregations and analytics.\n\n` +
          `HOW TO FIX:\n` +
          `1. Contact your Azure DevOps administrator to grant "View analytics" permission\n` +
          `2. Or use WIQL queries instead (wit-wiql-query tool) for non-aggregation queries\n\n` +
          `MORE INFO: https://learn.microsoft.com/en-us/azure/devops/report/powerbi/analytics-security\n\n` +
          `Technical details: ${errorText}`
        );
      }
      
      throw new Error(`Analytics API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    data = await response.json() as ODataResponse;
    
    // Cache the result for 5 minutes
    cacheService.set(cacheKey, data, 5 * 60 * 1000);
  }
  
  const includeOdataMetadata = queryArgs.includeOdataMetadata ?? false;
  const cleanedResults = cleanODataResults(data.value, !includeOdataMetadata);
  const resultCount = data["@odata.count"] || cleanedResults.length || 0;
  const summary = generateSummary(queryArgs.queryType || 'custom', resultCount, cleanedResults);

  const top = queryArgs.top || 1000;
  const skip = queryArgs.skip || 0;
  const returned = cleanedResults.length;
  const hasNextLink = !!data["@odata.nextLink"];
  
  const responseData: Record<string, unknown> = {
    summary: summary,
    count: resultCount,
    results: cleanedResults
  };
  
  const isPaginationSupported = !odataQuery.includes("$apply") || queryArgs.queryType === "velocityMetrics";
  if (isPaginationSupported && (returned >= top || hasNextLink || skip > 0)) {
    const pagination: Record<string, unknown> = {
      skip,
      top,
      returned,
      hasMore: hasNextLink || returned >= top
    };
    
    if (hasNextLink || returned >= top) {
      pagination.nextSkip = skip + returned;
    }
    
    responseData.pagination = pagination;
  }
  
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
  
  if (queryArgs.includeMetadata) {
    responseData.query = odataQuery;
    responseData.analyticsUrl = fullUrl;
  }

  const warnings: string[] = [];
  const pagination = responseData.pagination as Record<string, unknown> | undefined;
  if (pagination?.hasMore) {
    warnings.push(`More results available. Use skip=${pagination.nextSkip} to get the next page.`);
  }

  return {
    success: true,
    data: responseData as unknown as ToolExecutionData,
    metadata: { 
      source: "odata-query",
      mode: "analytics",
      ...aiMetadata,
      ...(pagination ? { pagination: pagination as Record<string, JSONValue> } : {})
    } as ToolExecutionMetadata,
    errors: [],
    warnings
  };
}

/**
 * Execute OData query and create query handle for non-aggregation queries
 */
async function executeODataQueryForHandle(
  odataQuery: string,
  queryArgs: any,
  aiMetadata: Record<string, unknown>
): Promise<ToolExecutionResult> {
  // Validate required parameters before constructing URL
  if (!queryArgs.organization || !queryArgs.project) {
    return {
      success: false,
      data: null,
      metadata: { source: "odata-query" },
      errors: [
        `Missing required parameters: ${!queryArgs.organization ? 'organization' : ''} ${!queryArgs.project ? 'project' : ''}`.trim() +
        `\n\nThis is likely a configuration issue. Ensure the MCP server is started with proper CLI arguments:\n` +
        `enhanced-ado-mcp <organization> --area-path "ProjectName\\\\TeamName"`
      ],
      warnings: []
    };
  }
  
  const token = await getTokenProvider()();
  const baseUrl = `https://analytics.dev.azure.com/${queryArgs.organization}/${queryArgs.project}/_odata/v3.0-preview/WorkItems`;
  
  const fieldsToSelect = queryArgs.includeFields?.length > 0 
    ? queryArgs.includeFields.join(',')
    : 'WorkItemId,Title,State,WorkItemType,CreatedDate,ChangedDate,AssignedTo,AreaPath,IterationPath,Tags';
  
  let fullQuery = odataQuery;
  if (!fullQuery.includes('$select')) {
    fullQuery += (fullQuery.includes('?') ? '&' : '?') + `$select=${fieldsToSelect}`;
  }
  if (!fullQuery.includes('$top')) {
    fullQuery += (fullQuery.includes('?') || fullQuery.includes('$') ? '&' : '?') + `$top=${queryArgs.maxResults || 200}`;
  }
  
  const url = fullQuery.startsWith('http') ? fullQuery : `${baseUrl}?${fullQuery}`;
  
  logger.debug(`Fetching work items from: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-TFS-FedAuthRedirect': 'Suppress'  // Suppress federated auth redirects - required for proper authentication
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 401 || response.status === 403 || errorText.includes('TF400813')) {
      throw new Error(
        `Analytics API authorization error: Cannot create query handle.\n\n` +
        `The user account does not have permission to access Azure DevOps Analytics.\n\n` +
        `REQUIRED PERMISSION: "View analytics" at the project level\n` +
        `This permission is required to use OData queries with query handles.\n\n` +
        `HOW TO FIX:\n` +
        `1. Contact your Azure DevOps administrator to grant "View analytics" permission\n` +
        `2. Or use WIQL queries with returnQueryHandle=true for non-aggregation queries\n\n` +
        `MORE INFO: https://learn.microsoft.com/en-us/azure/devops/report/powerbi/analytics-security\n\n` +
        `Technical details: ${errorText}`
      );
    }
    
    throw new Error(`Failed to execute OData query: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  const workItems = data.value || [];
  
  if (workItems.length === 0) {
    logger.warn(`OData query returned 0 results - cannot create query handle`);
    
    return {
      success: true,
      data: asToolData({
        query: odataQuery,
        isValidated: !!aiMetadata.validated,
        resultCount: 0,
        summary: `Successfully generated OData query but it returned 0 results. No query handle created.`
      }),
      metadata: {
        source: "odata-query",
        mode: "query-handle",
        ...aiMetadata
      },
      errors: [],
      warnings: ['⚠️ Query returned 0 results - you may need to adjust the criteria']
    };
  }
  
  const workItemIds = workItems.map((wi: any) => wi.WorkItemId);
  const workItemContext = new Map<number, any>();
  
  for (const wi of workItems) {
    workItemContext.set(wi.WorkItemId, {
      title: wi.Title,
      state: wi.State,
      type: wi.WorkItemType,
      createdDate: wi.CreatedDate,
      changedDate: wi.ChangedDate,
      assignedTo: wi.AssignedTo?.displayName || wi.AssignedTo,
      areaPath: wi.AreaPath,
      iterationPath: wi.IterationPath,
      tags: wi.Tags || ''
    });
  }
  
  const handle = queryHandleService.storeQuery(
    workItemIds,
    odataQuery,
    {
      project: queryArgs.project,
      queryType: 'odata'
    },
    60 * 60 * 1000, // 1 hour TTL
    workItemContext
  );

  logger.info(`Query handle created: ${handle} (${workItemIds.length} work items)`);

  return {
    success: true,
    data: asToolData({
      query_handle: handle,
      work_item_count: workItemIds.length,
      query: odataQuery,
      summary: `Query handle created for ${workItemIds.length} work item(s). Use the handle with bulk operation tools. Handle expires in 1 hour.`,
      work_items: workItems.map((wi: any) => ({
        id: wi.WorkItemId,
        title: wi.Title,
        state: wi.State,
        type: wi.WorkItemType,
        areaPath: wi.AreaPath,
        iterationPath: wi.IterationPath,
        assignedTo: wi.AssignedTo?.displayName || wi.AssignedTo
      })),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }),
    metadata: {
      source: "odata-query",
      mode: "query-handle",
      ...aiMetadata,
      queryHandleMode: true,
      handle,
      count: workItemIds.length
    },
    errors: [],
    warnings: []
  };
}

/**
 * Generate and validate OData query using AI
 */
async function generateAndValidateODataQuery(
  samplingClient: SamplingClient,
  description: string,
  queryArgs: any,
  maxIterations: number,
  includeExamples: boolean,
  testQuery: boolean
): Promise<{
  success: boolean;
  query?: string;
  error?: string;
  iterationCount: number;
  validated: boolean;
  isAggregation?: boolean;
  usage?: Record<string, unknown>;
}> {
  let currentQuery: string | null = null;
  let lastError: string | null = null;
  let isValid = false;
  let isAggregation = false;
  let cumulativeUsage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null = null;

  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    logger.debug(`Generation attempt ${attempt}/${maxIterations}`);

    const { query: generatedQuery, usage } = await generateODataQueryWithAI(
      samplingClient,
      description,
      queryArgs.organization!,
      queryArgs.project!,
      queryArgs.areaPath,
      queryArgs.iterationPath,
      includeExamples,
      attempt > 1 ? { previousQuery: currentQuery, error: lastError } : undefined
    );

    currentQuery = generatedQuery;
    isAggregation = generatedQuery.includes('$apply') || generatedQuery.includes('aggregate');

    // Accumulate usage
    if (usage) {
      if (!cumulativeUsage) {
        cumulativeUsage = {
          inputTokens: typeof usage.inputTokens === 'number' ? usage.inputTokens : undefined,
          outputTokens: typeof usage.outputTokens === 'number' ? usage.outputTokens : undefined,
          totalTokens: typeof usage.totalTokens === 'number' ? usage.totalTokens : undefined
        };
      } else {
        if (typeof usage.inputTokens === 'number') {
          cumulativeUsage.inputTokens = (cumulativeUsage.inputTokens || 0) + usage.inputTokens;
        }
        if (typeof usage.outputTokens === 'number') {
          cumulativeUsage.outputTokens = (cumulativeUsage.outputTokens || 0) + usage.outputTokens;
        }
        if (typeof usage.totalTokens === 'number') {
          cumulativeUsage.totalTokens = (cumulativeUsage.totalTokens || 0) + usage.totalTokens;
        }
      }
    }

    if (testQuery) {
      const testResult = await testODataQuery(currentQuery, queryArgs.organization!, queryArgs.project!);
      
      if (testResult.success) {
        isValid = true;
        logger.info(`✅ Query validated successfully on attempt ${attempt}`);
        break;
      } else {
        lastError = testResult.error || "Unknown validation error";
        logger.warn(`❌ Query validation failed on attempt ${attempt}: ${lastError}`);
        
        if (attempt === maxIterations) {
          return {
            success: false,
            query: currentQuery || undefined,
            error: lastError,
            iterationCount: attempt,
            validated: false,
            isAggregation,
            usage: cumulativeUsage || undefined
          };
        }
      }
    } else {
      isValid = true;
      logger.info(`Query generated (validation skipped)`);
      break;
    }
  }

  return {
    success: isValid,
    query: currentQuery || undefined,
    error: isValid ? undefined : lastError || undefined,
    iterationCount: maxIterations,
    validated: testQuery && isValid,
    isAggregation,
    usage: cumulativeUsage || undefined
  };
}

/**
 * Generate OData query using AI sampling
 */
async function generateODataQueryWithAI(
  samplingClient: SamplingClient,
  description: string,
  organization: string,
  project: string,
  areaPath: string | undefined,
  iterationPath: string | undefined,
  includeExamples: boolean,
  feedback?: { previousQuery: string | null; error: string | null }
): Promise<{ query: string; usage?: Record<string, unknown> }> {
  const variables: Record<string, string> = {
    PROJECT: project,
    ORGANIZATION: organization,
    AREA_PATH: areaPath || '',
    ITERATION_PATH: iterationPath || ''
  };
  
  let userContent = `Generate an OData Analytics query for the following request:\n\n${description}`;
  
  if (feedback?.previousQuery && feedback?.error) {
    userContent += `\n\n---\n\n**PREVIOUS ATTEMPT FAILED**\n\nPrevious Query:\n\`\`\`\n${feedback.previousQuery}\n\`\`\`\n\nError:\n${feedback.error}\n\nPlease fix the query to address this error.`;
  }

  const aiResult = await samplingClient.createMessage({
    systemPromptName: "odata-query-generator",
    userContent,
    variables,
    maxTokens: 1000,
    temperature: 0.3
  });

  const responseText = samplingClient.extractResponseText(aiResult);
  const query = extractODataQuery(responseText);
  
  if (!query) {
    throw new Error("Failed to extract OData query from AI response");
  }

  const usage = (aiResult as Record<string, unknown>).usage as Record<string, unknown> | undefined;

  return {
    query: cleanODataQuery(query),
    usage
  };
}

/**
 * Test an OData query by executing it
 */
async function testODataQuery(
  query: string,
  organization: string,
  project: string
): Promise<{ success: boolean; error?: string; resultCount?: number; sampleResults?: Array<Record<string, unknown>> }> {
  // Validate required parameters
  if (!organization || !project) {
    return {
      success: false,
      error: `Missing required parameters: ${!organization ? 'organization' : ''} ${!project ? 'project' : ''}`.trim()
    };
  }
  
  try {
    const token = await getTokenProvider()();
    const baseUrl = `https://analytics.dev.azure.com/${organization}/${project}/_odata/v3.0-preview/WorkItems`;
    const url = `${baseUrl}?${query}${query.includes('$top') ? '' : '&$top=5'}`;

    logger.debug(`Testing OData query: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'X-TFS-FedAuthRedirect': 'Suppress'  // Suppress federated auth redirects - required for proper authentication
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`OData test failed: ${response.status} ${errorText}`);
      
      if (response.status === 401 || response.status === 403 || errorText.includes('TF400813')) {
        return {
          success: false,
          error: `Analytics API authorization error: ${response.status}. User lacks "View analytics" permission. Contact your Azure DevOps administrator to grant access, or use WIQL queries instead. More info: https://learn.microsoft.com/en-us/azure/devops/report/powerbi/analytics-security`
        };
      }
      
      return {
        success: false,
        error: `Analytics API error: ${response.status} ${response.statusText} - ${errorText}`
      };
    }

    const data = await response.json();
    const results = data.value || [];
    const count = data['@odata.count'] !== undefined ? data['@odata.count'] : results.length;

    return {
      success: true,
      resultCount: count,
      sampleResults: results.slice(0, 3)
    };
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    let parsedError = errorMessage;
    if (errorMessage.includes("syntax")) {
      parsedError = `OData syntax error: ${errorMessage}. Check field names and operators.`;
    } else if (errorMessage.includes("Property")) {
      parsedError = `Field not found: ${errorMessage}. Ensure field names are correct for Analytics API.`;
    }

    return {
      success: false,
      error: parsedError
    };
  }
}

/**
 * Extract OData query from AI response
 */
function extractODataQuery(response: string): string | null {
  // Try to find query in code blocks
  const codeBlockMatch = response.match(/```(?:odata)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find query starting with $
  const dollarMatch = response.match(/(\$[^\n]+(?:\n(?!\n)[^\n]+)*)/);
  if (dollarMatch) {
    return dollarMatch[1].trim();
  }

  // If response is already a query (starts with $), use it directly
  if (response.trim().startsWith('$')) {
    return response.trim();
  }

  return null;
}

/**
 * Clean OData query string
 */
function cleanODataQuery(query: string): string {
  return query
    .trim()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    filterClauses.push(`${dateRangeField} ge ${dateRangeStart}T00:00:00Z`);
  }
  if (dateRangeField && dateRangeEnd) {
    filterClauses.push(`${dateRangeField} le ${dateRangeEnd}T23:59:59Z`);
  }

  // Add area path filter
  if (areaPath) {
    const escapedAreaPath = escapeAreaPath(areaPath);
    filterClauses.push(`startswith(Area/AreaPath, '${escapedAreaPath}')`);
  }

  // Add iteration path filter
  if (iterationPath) {
    filterClauses.push(`Iteration/IterationPath eq '${iterationPath}'`);
  }

  // Build query based on type
  if (customODataQuery) {
    return customODataQuery;
  }

  switch (queryType) {
    case "workItemCount":
      query = "$apply=aggregate($count as Count)";
      if (filterClauses.length > 0) {
        query = `$apply=filter(${filterClauses.join(' and ')})/aggregate($count as Count)`;
      }
      break;

    case "groupByState":
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
      query = "$filter=State eq 'Closed' or State eq 'Done'";
      if (filterClauses.length > 0) {
        query += ` and ${filterClauses.join(' and ')}`;
      }
      query += "&$select=WorkItemId,State,CompletedDate,StoryPoints";
      break;

    case "cycleTimeMetrics":
      if (computeCycleTime) {
        query = "$apply=filter(State eq 'Closed' or State eq 'Done')";
        if (filterClauses.length > 0) {
          query += ` and ${filterClauses.join(' and ')}`;
        }
        query += "/groupby((WorkItemId,CreatedDate,CompletedDate))";
      } else {
        query = "$filter=State eq 'Closed' or State eq 'Done'";
        if (filterClauses.length > 0) {
          query += ` and ${filterClauses.join(' and ')}`;
        }
        query += "&$select=WorkItemId,CreatedDate,CompletedDate";
      }
      break;

    case "customQuery":
      if (groupBy && groupBy.length > 0) {
        query = `$apply=groupby((${groupBy.join(',')}), aggregate($count as Count))`;
        if (filterClauses.length > 0) {
          query = `$apply=filter(${filterClauses.join(' and ')})/groupby((${groupBy.join(',')}), aggregate($count as Count))`;
        }
        if (orderBy) {
          query += `&$orderby=${orderBy}`;
        }
      } else {
        if (filterClauses.length > 0) {
          query = `$filter=${filterClauses.join(' and ')}`;
        }
        if (select && select.length > 0) {
          query += `${query ? '&' : ''}$select=${select.join(',')}`;
        }
        if (orderBy) {
          query += `${query ? '&' : ''}$orderby=${orderBy}`;
        }
      }
      break;

    default:
      throw new Error(`Unknown query type: ${queryType}`);
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
 * Clean OData metadata from results
 */
function cleanODataResults(results: Record<string, unknown>[], stripMetadata: boolean = true): Record<string, unknown>[] {
  if (!stripMetadata) {
    return results;
  }

  return results.map(item => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('@odata.') && value !== null) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  });
}

/**
 * Generate a human-readable summary
 */
function generateSummary(queryType: string, count: number, results: Record<string, unknown>[]): string {
  switch (queryType) {
    case "workItemCount":
      return `Total work items: ${count}`;
    case "groupByState":
      return `Work items grouped by state (${results.length} states, ${count} total items)`;
    case "groupByType":
      return `Work items grouped by type (${results.length} types, ${count} total items)`;
    case "groupByAssignee":
      return `Work items grouped by assignee (${results.length} assignees, ${count} total items)`;
    case "velocityMetrics":
      return `Velocity metrics for ${count} completed work items`;
    case "cycleTimeMetrics":
      return `Cycle time metrics for ${count} completed work items`;
    case "customQuery":
      return `Custom query returned ${count} results`;
    default:
      return `Query returned ${count} results`;
  }
}

/**
 * Generate a cache key for an OData query
 */
function generateODataCacheKey(fullUrl: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(fullUrl)
    .digest('hex');
  
  return `odata:${hash}`;
}
