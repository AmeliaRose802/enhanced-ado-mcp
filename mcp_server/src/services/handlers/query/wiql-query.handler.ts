/**
 * Handler for query-wiql tool
 * Unified handler for both direct WIQL execution and AI-powered query generation
 */

import type { ToolConfig, ToolExecutionResult, ToolExecutionMetadata } from '@/types/index.js';
import type { ADOWorkItem } from '@/types/ado.js';
import type { WorkItemContext, WorkItemContextPackage } from '@/types/index.js';
import type { MCPServer, MCPServerLike } from "@/types/mcp.js";
import { asToolData } from "@/types/index.js";
import { validateAndParse } from "@/utils/handler-helpers.js";
import { getRequiredConfig } from "@/config/config.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { logger, errorToContext } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { handleGetWorkItemContextPackage } from "../context/get-work-item-context-package.handler.js";
import { SamplingClient } from "@/utils/sampling-client.js";
import { extractWiqlQuery, cleanWiqlQuery } from "@/utils/wiql-helpers.js";
import { buildSamplingUnavailableResponse } from "@/utils/response-builder.js";
import { cacheService } from "../../cache-service.js";
import crypto from 'crypto';
import { wiqlQuerySchema } from '@/config/schemas.js';
import type { z } from 'zod';

// Type for validated query arguments
type WiqlQueryArgs = z.infer<typeof wiqlQuerySchema>;

export async function handleWiqlQuery(
  config: ToolConfig, 
  args: unknown,
  serverInstance?: MCPServer | MCPServerLike
): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const parsed = validation.data;
    const requiredConfig = getRequiredConfig();
    
    // Collect warnings for unnecessary parameters
    const parameterWarnings: string[] = [];
    
    // Warn about handleOnly usage
    if (parsed.handleOnly === false && parsed.returnQueryHandle === true) {
      parameterWarnings.push('⚠️ handleOnly=false fetches all work item data immediately. For better efficiency with large result sets, use handleOnly=true and then call inspect-handle to retrieve data as needed.');
    }
    
    // Warn about includeFields when using handleOnly
    if (parsed.includeFields && parsed.handleOnly === true) {
      parameterWarnings.push('⚠️ includeFields parameter is ignored when handleOnly=true. The handle stores default fields only. Use inspect-handle or get-context-bulk to retrieve specific fields.');
    }
    
    // Warn about maxResults when using handleOnly
    if (parsed.maxResults && parsed.handleOnly === true && parsed.maxResults !== 200) {
      parameterWarnings.push('⚠️ maxResults parameter has no effect when handleOnly=true. The handle contains all matching items. Use inspect-handle with itemSelector to filter results.');
    }
    
    // Warn about includeSubstantiveChange when using handleOnly  
    if (parsed.includeSubstantiveChange && parsed.handleOnly === true) {
      parameterWarnings.push('⚠️ includeSubstantiveChange parameter is ignored when handleOnly=true. Substantive change data must be calculated separately. Use wit-get-last-substantive-change for individual items.');
    }
    
    // Warn about unnecessary areaPath parameter when already in description
    if (parsed.areaPath && parsed.description && parsed.description.includes(parsed.areaPath)) {
      parameterWarnings.push('⚠️ areaPath parameter is redundant when already specified in the description. The AI will extract it from the natural language query.');
    }
    
    // Determine if this is AI generation or direct execution
    const isAIGeneration = !!parsed.description && !parsed.wiqlQuery;
    
    // Resolve area path filter with new useDefaultAreaPaths flag
    // Priority: explicit areaPathFilter > default paths (if useDefaultAreaPaths=true) > none
    const defaultAreaPaths = requiredConfig.defaultAreaPaths || [];
    const useDefaultAreaPaths = parsed.useDefaultAreaPaths !== false; // Default to true for backward compatibility
    
    let areaPathFilter: string[] | undefined;
    if (parsed.areaPathFilter) {
      // Explicit filter provided - always use it
      areaPathFilter = parsed.areaPathFilter;
    } else if (useDefaultAreaPaths && defaultAreaPaths.length > 0) {
      // Use default area paths if flag is true (default behavior)
      areaPathFilter = defaultAreaPaths;
    } else {
      // No filtering - query entire project
      areaPathFilter = undefined;
    }
    
    const queryArgs = {
      ...parsed,
      organization: parsed.organization || requiredConfig.organization,
      project: parsed.project || requiredConfig.project,
      areaPath: parsed.areaPath || requiredConfig.defaultAreaPath,
      areaPathFilter,
      iterationPath: parsed.iterationPath || requiredConfig.defaultIterationPath
    };

    let finalQuery: string;
    let aiGenerationMetadata: Record<string, unknown> = {};
    
    // AI-powered query generation path
    if (isAIGeneration) {
      if (!serverInstance) {
        return {
          success: false,
          data: null,
          metadata: { source: "unified-wiql-query" },
          errors: ["AI generation requires sampling support. Provide a direct WIQL query instead, or enable VS Code Language Model API."],
          warnings: []
        };
      }
      
      const samplingClient = new SamplingClient(serverInstance);
      if (!samplingClient.hasSamplingSupport()) {
        return buildSamplingUnavailableResponse();
      }

      logger.info(`🤖 Generating WIQL query from description: "${parsed.description}"`);
      
      const generationResult = await generateAndValidateQuery(
        samplingClient,
        parsed.description!,
        queryArgs,
        parsed.maxIterations || 3,
        parsed.includeExamples !== false,
        parsed.testQuery !== false
      );
      
      if (!generationResult.success) {
        return {
          success: false,
          data: null,
          metadata: { source: "unified-wiql-query", mode: "ai-generation" },
          errors: [generationResult.error || "Failed to generate valid query"],
          warnings: []
        };
      }
      
      finalQuery = generationResult.query!;
      aiGenerationMetadata = {
        aiGenerated: true,
        iterationCount: generationResult.iterationCount,
        validated: generationResult.validated,
        ...(generationResult.usage && { usage: generationResult.usage })
      };
      
      logger.info(`✅ Generated valid query in ${generationResult.iterationCount} iteration(s)`);
      
      // If AI generation was used but returnQueryHandle is false, return just the query
      if (!queryArgs.returnQueryHandle) {
        logger.debug('Returning generated query without execution (returnQueryHandle=false)');
        return {
          success: true,
          data: {
            query: finalQuery,
            message: '✅ Query generated successfully. Set returnQueryHandle=true to execute it and get results.'
          },
          metadata: {
            source: "unified-wiql-query",
            mode: "ai-generation-only",
            ...aiGenerationMetadata
          },
          errors: [],
          warnings: []
        };
      }
    } else {
      // Direct WIQL execution path
      finalQuery = parsed.wiqlQuery!;
      logger.debug(`Executing provided WIQL query: ${finalQuery}`);
    }

    // Update queryArgs with the final query
    queryArgs.wiqlQuery = finalQuery;

    logger.debug(`Executing WIQL query: ${queryArgs.wiqlQuery}`);
    if (queryArgs.includeSubstantiveChange) {
      logger.debug(`Substantive change analysis enabled (history depth: ${queryArgs.substantiveChangeHistoryCount || 50})`);
    }
    if (queryArgs.fetchFullPackages) {
      logger.debug(`Full context packages will be fetched for each work item`);
    }
    if (queryArgs.handleOnly && queryArgs.returnQueryHandle) {
      logger.debug(`Handle-only mode: will fetch full data for handle context but return minimal response`);
    }
    
    // Generate cache key based on query parameters
    // Note: Always fetch full data to populate handle context, handleOnly only affects the response
    const cacheKey = generateQueryCacheKey(queryArgs, true);
    
    let result: {
      workItems: ADOWorkItem[];
      count: number;
      query: string;
      totalCount: number;
      skip: number;
      top: number;
      hasMore: boolean;
    };
    
    try {
      // Check cache first
      const cached = cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for WIQL query: ${cacheKey.substring(0, 32)}...`);
        result = cached as typeof result;
      } else {
        logger.debug(`Cache miss for WIQL query, executing: ${cacheKey.substring(0, 32)}...`);
        // Always fetch full data to populate handle context, even in handleOnly mode
        result = await queryWorkItemsByWiql(queryArgs) as any;
        
        // Cache the result for 5 minutes
        cacheService.set(cacheKey, result, 5 * 60 * 1000);
      }
    } catch (error) {
      // If we're in AI generation mode with returnQueryHandle and execution fails,
      // fall back to returning just the generated query with a warning
      if (isAIGeneration && queryArgs.returnQueryHandle) {
        logger.warn('Query execution failed after validation, returning query-only response', errorToContext(error));
        return {
          success: true,
          data: {
            generated_query: finalQuery,
            query: finalQuery,
            message: '⚠️ Query generated and validated, but execution failed. The query syntax is correct but there may be a temporary issue.'
          },
          metadata: {
            source: "unified-wiql-query",
            mode: "ai-generation",
            ...aiGenerationMetadata
          },
          errors: [],
          warnings: [`Failed to create query handle: ${error instanceof Error ? error.message : String(error)}`]
        };
      }
      // Otherwise, re-throw the error to be caught by the outer try-catch
      throw error;
    }
    
    const pageSize = queryArgs.top ?? queryArgs.maxResults ?? 200;

    // If fetchFullPackages is enabled, fetch full context packages for each work item
    let fullPackages: WorkItemContextPackage[] | undefined = undefined;
    if (queryArgs.fetchFullPackages) {
      logger.info(`Fetching full context packages for ${result.workItems.length} work items...`);
      const packagePromises = result.workItems.map(async (wi) => {
        try {
          const packageResult = await handleGetWorkItemContextPackage({
            workItemId: wi.id,
            organization: queryArgs.organization,
            project: queryArgs.project,
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
          logger.error(`Error fetching context package for work item ${wi.id}:`, errorToContext(error));
          return null;
        }
      });
      
      const packages = await Promise.all(packagePromises);
      fullPackages = packages.filter((p): p is WorkItemContextPackage => p !== null);
      logger.info(`Successfully fetched ${fullPackages?.length ?? 0} of ${result.workItems.length} context packages`);
    }

    // If returnQueryHandle is true, store results and return handle along with work items
    if (queryArgs.returnQueryHandle) {
      // Don't create handle for empty results
      if (result.workItems.length === 0) {
        logger.info('Query returned 0 results - returning query-only response instead of creating empty handle');
        return {
          success: true,
          data: {
            ...(isAIGeneration && { generated_query: finalQuery }),
            query: queryArgs.wiqlQuery,
            resultCount: 0,
            message: '⚠️ Query is valid but returned 0 results - no query handle created for empty result set'
          },
          metadata: {
            source: "unified-wiql-query",
            mode: isAIGeneration ? "ai-generation" : "direct-query",
            ...aiGenerationMetadata
          },
          errors: [],
          warnings: ['⚠️ Query is valid but returned 0 results - you may need to adjust the criteria']
        };
      }
      
      const workItemIds = result.workItems.map((wi) => wi.id);
      
      // Always build work item context map for the handle (needed for later retrieval)
      const workItemContext = new Map<number, WorkItemContext>();
      for (const wi of result.workItems as any[]) {
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
        includeSubstantiveChange: queryArgs.includeSubstantiveChange || false,
        stalenessThresholdDays: queryArgs.staleThresholdDays,
        analysisTimestamp: new Date().toISOString(),
        successCount: (result.workItems as any[]).filter((wi) => wi.lastSubstantiveChangeDate !== undefined).length,
        failureCount: result.workItems.length - (result.workItems as any[]).filter((wi) => wi.lastSubstantiveChangeDate !== undefined).length
      };
      
      const handle = queryHandleService.storeQuery(
        workItemIds,
        queryArgs.wiqlQuery,
        {
          project: queryArgs.project,
          queryType: 'wiql'
        },
        queryHandleService.getDefaultTTL(),
        workItemContext,
        analysisMetadata
      );

      logger.info(`Query handle created: ${handle} (${workItemIds.length} work items)`);

      // Handle-only mode: return minimal response with just the handle and count
      if (queryArgs.handleOnly) {
        return {
          success: true,
          data: {
            query_handle: handle,
            ...(isAIGeneration && { generated_query: finalQuery }),
            work_item_count: workItemIds.length,
            total_count: result.totalCount,
            query: result.query,
            summary: `Query handle created for ${workItemIds.length} work item(s). Handle-only mode: work item details not fetched for efficiency. Use the handle with bulk operation tools or wit-query-handle-get-items to retrieve items. Handle expires in 24 hours.`,
            next_steps: [
              "Use wit-query-handle-get-items to retrieve work item details if needed",
              "Use wit-bulk-comment to add comments to all items",
              "Use wit-bulk-update to update fields on all items",
              "Use wit-bulk-assign to assign all items to a user",
              "Use wit-bulk-remove to remove all items",
              "Always use dryRun: true first to preview changes before applying them"
            ],
            expires_at: new Date(Date.now() + queryHandleService.getDefaultTTL()).toISOString(),
            expires_in_hours: 24,
            expires_in_minutes: 1440,
            ...((result.totalCount > result.top || queryArgs.includePaginationDetails) && {
              pagination: {
                skip: result.skip,
                top: result.top,
                totalCount: result.totalCount,
                hasMore: result.hasMore,
                ...(result.hasMore && { nextSkip: result.skip + result.top })
              }
            })
          },
          metadata: {
            source: "rest-api-wiql",
            queryHandleMode: true,
            handleOnlyMode: true,
            handle,
            count: workItemIds.length,
            totalCount: result.totalCount
          },
          errors: [],
          warnings: [
            ...(result.hasMore
              ? [`Query returned ${result.totalCount} total results. Handle contains first ${workItemIds.length} items. Use pagination if you need all results.`]
              : [])
          ]
        };
      }

      // Standard mode with full work item details
      return {
        success: true,
        data: {
          query_handle: handle,
          ...(isAIGeneration && { generated_query: finalQuery }),
          work_items: result.workItems,
          ...(fullPackages && { full_packages: fullPackages }),
          work_item_count: workItemIds.length,
          total_count: result.totalCount,
          query: result.query,
          summary: fullPackages 
            ? `Query handle created for ${workItemIds.length} work item(s) with full context packages. Use the handle with bulk operation tools (wit-bulk-*-by-query-handle) to perform safe operations. Handle expires in 24 hours.`
            : `Query handle created for ${workItemIds.length} work item(s) along with full work item details. Use the handle with bulk operation tools (wit-bulk-*-by-query-handle) to perform safe operations. Handle expires in 24 hours.`,
          next_steps: [
            "Review the work_items array to see what will be affected",
            ...(fullPackages ? ["Review the full_packages array for detailed context including descriptions, comments, relations, and history"] : []),
            "Use wit-bulk-comment to add comments to all items",
            "Use wit-bulk-update to update fields on all items",
            "Use wit-bulk-assign to assign all items to a user",
            "Use wit-bulk-remove to remove all items",
            "Always use dryRun: true first to preview changes before applying them"
          ],
          expires_at: new Date(Date.now() + queryHandleService.getDefaultTTL()).toISOString(),
          expires_in_hours: 24,
          expires_in_minutes: 1440,
          ...((result.totalCount > result.top || queryArgs.includePaginationDetails) && {
            pagination: {
              skip: result.skip,
              top: result.top,
              totalCount: result.totalCount,
              hasMore: result.hasMore,
              ...(result.hasMore && { nextSkip: result.skip + result.top })
            }
          }),
          ...(queryArgs.includeSubstantiveChange && { 
            substantiveChangeIncluded: true 
          }),
          ...(fullPackages && {
            fullPackagesIncluded: true,
            fullPackagesCount: fullPackages.length
          })
        },
        metadata: {
          source: "unified-wiql-query",
          ...aiGenerationMetadata,
          queryHandleMode: true,
          handle,
          count: workItemIds.length,
          totalCount: result.totalCount,
          substantiveChangeAnalysis: queryArgs.includeSubstantiveChange || false,
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
          ...(queryArgs.fetchFullPackages && workItemIds.length > 50
            ? [`⚠️ Fetching full packages for ${workItemIds.length} items made ${workItemIds.length * 2} API calls. Consider using pagination or filtering for smaller result sets.`]
            : [])
        ]
      };
    }
    
    // Standard response with full work item details
    return {
      success: true,
      data: {
        ...(isAIGeneration && { generated_query: finalQuery }),
        work_items: result.workItems,
        ...(fullPackages && { full_packages: fullPackages }),
        count: result.count,
        query: result.query,
        summary: fullPackages
          ? `Found ${result.count} work item(s) with full context packages matching the query (showing ${result.skip + 1}-${result.skip + result.count} of ${result.totalCount} total)`
          : `Found ${result.count} work item(s) matching the query (showing ${result.skip + 1}-${result.skip + result.count} of ${result.totalCount} total)`,
        ...((result.totalCount > result.top || queryArgs.includePaginationDetails) && {
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
        ...(queryArgs.includeSubstantiveChange && { 
          substantiveChangeIncluded: true 
        }),
        ...(fullPackages && {
          fullPackagesIncluded: true,
          fullPackagesCount: fullPackages.length
        })
      },
      metadata: { 
        source: "unified-wiql-query",
        ...aiGenerationMetadata,
        count: result.count,
        totalCount: result.totalCount,
        skip: result.skip,
        top: result.top,
        hasMore: result.hasMore,
        maxResults: pageSize,
        substantiveChangeAnalysis: queryArgs.includeSubstantiveChange || false,
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
        ...(queryArgs.fetchFullPackages && result.count > 50
          ? [`⚠️ Fetching full packages for ${result.count} items made ${result.count * 2} API calls. Consider using pagination or filtering for smaller result sets.`]
          : [])
      ]
    };
  } catch (error) {
    logger.error('Unified WIQL query handler error:', errorToContext(error));
    return {
      success: false,
      data: null,
      metadata: { source: "unified-wiql-query" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Generate and validate WIQL query using AI
 */
async function generateAndValidateQuery(
  samplingClient: SamplingClient,
  description: string,
  queryArgs: WiqlQueryArgs,
  maxIterations: number,
  includeExamples: boolean,
  testQuery: boolean
): Promise<{
  success: boolean;
  query?: string;
  error?: string;
  iterationCount: number;
  validated: boolean;
  usage?: Record<string, unknown>;
}> {
  let currentQuery: string | null = null;
  let lastError: string | null = null;
  let isValid = false;
  let cumulativeUsage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null = null;

  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    logger.debug(`Generation attempt ${attempt}/${maxIterations}`);

    // Generate query using AI
    const { query: generatedQuery, usage } = await generateQueryWithAI(
      samplingClient,
      description,
      queryArgs.project!,
      queryArgs.areaPath,
      queryArgs.iterationPath,
      includeExamples,
      attempt > 1 ? { previousQuery: currentQuery, error: lastError } : undefined
    );

    currentQuery = generatedQuery;

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

    // Test the query if requested
    if (testQuery) {
      const testResult = await testWiqlQuery(currentQuery, queryArgs.organization!, queryArgs.project!);
      
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
            error: lastError,
            iterationCount: attempt,
            validated: false,
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
    usage: cumulativeUsage || undefined
  };
}

/**
 * Generate WIQL query using AI sampling
 */
async function generateQueryWithAI(
  samplingClient: SamplingClient,
  description: string,
  project: string,
  areaPath: string | undefined,
  iterationPath: string | undefined,
  includeExamples: boolean,
  feedback?: { previousQuery: string | null; error: string | null }
): Promise<{ query: string; usage?: Record<string, unknown> }> {
  const variables: Record<string, string> = {
    PROJECT: project,
    AREA_PATH: areaPath || '',
    ITERATION_PATH: iterationPath || ''
  };
  
  let userContent = `Generate a WIQL query for the following request:\n\n${description}`;
  
  if (feedback?.previousQuery && feedback?.error) {
    userContent += `\n\n---\n\n**PREVIOUS ATTEMPT FAILED**\n\nPrevious Query:\n\`\`\`sql\n${feedback.previousQuery}\n\`\`\`\n\nError:\n${feedback.error}\n\nPlease fix the query to address this error.`;
  }

  const aiResult = await samplingClient.createMessage({
    systemPromptName: "wiql-query-generator",
    userContent,
    variables,
    maxTokens: 800,
    temperature: 0.3
  });

  const responseText = samplingClient.extractResponseText(aiResult);
  const query = extractWiqlQuery(responseText);
  
  if (!query) {
    throw new Error("Failed to extract WIQL query from AI response");
  }

  const usage = (aiResult as Record<string, unknown>).usage as Record<string, unknown> | undefined;

  return {
    query: cleanWiqlQuery(query),
    usage
  };
}

/**
 * Test a WIQL query by executing it
 */
async function testWiqlQuery(
  query: string,
  organization: string,
  project: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await queryWorkItemsByWiql({
      wiqlQuery: query,
      organization,
      project,
      top: 10,
      includeFields: ['System.Id']
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    let parsedError = errorMessage;
    if (errorMessage.includes("ORDER BY")) {
      parsedError = "ORDER BY clause is not supported in WorkItemLinks queries. Use WorkItems query instead or remove ORDER BY.";
    } else if (errorMessage.includes("syntax error") || errorMessage.includes("VS402337")) {
      parsedError = `WIQL syntax error: ${errorMessage}. Check field names, brackets, and operators.`;
    } else if (errorMessage.includes("field")) {
      parsedError = `Invalid field name: ${errorMessage}. Ensure field names are in brackets.`;
    }

    return {
      success: false,
      error: parsedError
    };
  }
}

/**
 * Generate a cache key for a WIQL query based on all relevant parameters
 */
function generateQueryCacheKey(queryArgs: WiqlQueryArgs, shouldFetchFullData: boolean): string {
  // Create a stable object with all cache-relevant parameters
  const cacheObject = {
    query: queryArgs.wiqlQuery,
    organization: queryArgs.organization,
    project: queryArgs.project,
    top: queryArgs.top,
    skip: queryArgs.skip,
    includeFields: queryArgs.includeFields,
    includeSubstantiveChange: queryArgs.includeSubstantiveChange,
    substantiveChangeHistoryCount: queryArgs.substantiveChangeHistoryCount,
    shouldFetchFullData
  };
  
  // Generate SHA256 hash of the JSON representation
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(cacheObject))
    .digest('hex');
  
  return `wiql:${hash}`;
}
