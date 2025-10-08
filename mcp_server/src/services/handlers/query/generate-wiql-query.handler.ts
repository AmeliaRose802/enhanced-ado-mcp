/**
 * Handler for wit-ai-generate-wiql tool
 * Generates WIQL queries from natural language using AI sampling with iterative validation
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import type { WorkItemContext } from "../../../types/work-items.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { extractWiqlQuery, cleanWiqlQuery } from "../../../utils/wiql-helpers.js";
import { queryHandleService } from "../../query-handle-service.js";

interface GenerateWiqlQueryArgs {
  description: string;
  organization: string;
  project: string;
  maxIterations?: number;
  includeExamples?: boolean;
  testQuery?: boolean;
  areaPath?: string;
  iterationPath?: string;
  returnQueryHandle?: boolean;
  maxResults?: number;
  includeFields?: string[];
  serverInstance?: MCPServer | MCPServerLike; // Server instance for sampling
}

export async function handleGenerateWiqlQuery(config: ToolConfig, args: unknown, serverInstance: MCPServer | MCPServerLike): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const samplingClient = new SamplingClient(serverInstance);
    if (!samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    const {
      description,
      organization,
      project,
      maxIterations = 3,
      includeExamples = true,
      testQuery = true,
      areaPath,
      iterationPath,
      returnQueryHandle = false,
      maxResults = 200,
      includeFields
    } = parsed.data as GenerateWiqlQueryArgs;

    logger.info(`Generating WIQL query from description: "${description}"`);
    if (areaPath) {
      logger.debug(`Using area path for query context: ${areaPath}`);
    }
    if (iterationPath) {
      logger.debug(`Using iteration path for query context: ${iterationPath}`);
    }

    const iterations: Array<Record<string, unknown>> = [];
    let currentQuery: string | null = null;
    let lastError: string | null = null;
    let isValid = false;
    let testResults: Record<string, unknown> | null = null;
    let cumulativeUsage: Record<string, unknown> | null = null;

    // Iterative generation and validation
    for (let attempt = 1; attempt <= maxIterations; attempt++) {
      logger.debug(`Generation attempt ${attempt}/${maxIterations}`);

      // Generate query using AI sampling
      const { query: generatedQuery, usage } = await generateQueryWithAI(
        samplingClient,
        description,
        project,
        areaPath,
        iterationPath,
        includeExamples,
        attempt > 1 ? { previousQuery: currentQuery, error: lastError } : undefined
      );

      currentQuery = generatedQuery;
      iterations.push({
        attempt,
        query: currentQuery,
        timestamp: new Date().toISOString()
      });

      // Accumulate usage information for metadata
      if (usage) {
        if (!cumulativeUsage) {
          cumulativeUsage = { ...usage };
        } else {
          // Sum up token counts if present
          if (usage.inputTokens) cumulativeUsage.inputTokens = (cumulativeUsage.inputTokens || 0) + usage.inputTokens;
          if (usage.outputTokens) cumulativeUsage.outputTokens = (cumulativeUsage.outputTokens || 0) + usage.outputTokens;
          if (usage.totalTokens) cumulativeUsage.totalTokens = (cumulativeUsage.totalTokens || 0) + usage.totalTokens;
        }
      }

      // Test the query if requested
      if (testQuery) {
        const testResult = await testWiqlQuery(currentQuery, organization, project);
        
        if (testResult.success) {
          isValid = true;
          testResults = {
            resultCount: testResult.resultCount,
            sampleResults: testResult.sampleResults
          };
          logger.info(`✅ Query validated successfully on attempt ${attempt} (${testResult.resultCount} results)`);
          break;
        } else {
          lastError = testResult.error || "Unknown validation error";
          iterations[iterations.length - 1].error = lastError;
          logger.warn(`❌ Query validation failed on attempt ${attempt}: ${lastError}`);
          
          // If this is the last iteration, we'll return the best effort
          if (attempt === maxIterations) {
            logger.warn(`Max iterations reached. Returning last generated query despite validation failure.`);
          }
        }
      } else {
        // Skip validation if not requested
        isValid = true;
        logger.info(`Query generated (validation skipped as requested)`);
        break;
      }
    }

    // If returnQueryHandle is true and query is valid, execute it and create handle
    if (returnQueryHandle && isValid && currentQuery) {
      try {
        logger.info(`Executing query to create handle with maxResults=${maxResults}`);
        
        // Execute the query with full results
        const queryResult = await queryWorkItemsByWiql({
          wiqlQuery: currentQuery,
          organization,
          project,
          top: maxResults,
          includeFields: includeFields || ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.CreatedDate', 'System.ChangedDate', 'System.AssignedTo', 'System.AreaPath', 'System.IterationPath', 'System.Tags']
        });

        // Only create handle if we have results
        if (queryResult.workItems && queryResult.workItems.length > 0) {
          const workItemIds = queryResult.workItems.map((wi) => wi.id);
          
          // Build work item context map
          const workItemContext = new Map<number, WorkItemContext>();
          for (const wi of queryResult.workItems) {
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
              tags: tagsString,
              ...(wi.additionalFields && wi.additionalFields)
            });
          }

          // Build analysis metadata
          const analysisMetadata = {
            generatedFromDescription: description,
            analysisTimestamp: new Date().toISOString(),
            resultCount: queryResult.count,
            totalCount: queryResult.totalCount
          };
          
          const handle = queryHandleService.storeQuery(
            workItemIds,
            currentQuery,
            {
              project,
              queryType: 'wiql-generated'
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
              query: currentQuery,
              work_items: queryResult.workItems,
              work_item_count: workItemIds.length,
              total_count: queryResult.totalCount,
              isValidated: testQuery && isValid,
              summary: `Query handle created for ${workItemIds.length} work item(s). Use the handle with bulk operation tools (wit-bulk-*-by-query-handle) to perform safe operations. Handle expires in 1 hour.`,
              next_steps: [
                "Review the work_items array to see what will be affected",
                "Use wit-bulk-comment to add comments to all items",
                "Use wit-bulk-update to update fields on all items",
                "Use wit-bulk-assign to assign all items to a user",
                "Use wit-bulk-remove to remove all items",
                "Always use dryRun: true first to preview changes before applying them"
              ],
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              ...((queryResult.totalCount > queryResult.top) && {
                pagination: {
                  skip: queryResult.skip,
                  top: queryResult.top,
                  totalCount: queryResult.totalCount,
                  hasMore: queryResult.hasMore,
                  ...(queryResult.hasMore && { nextSkip: queryResult.skip + queryResult.top })
                }
              })
            },
            metadata: {
              source: "ai-sampling-wiql-generator",
              validated: isValid,
              iterationCount: iterations.length,
              queryHandleMode: true,
              handle,
              count: workItemIds.length,
              totalCount: queryResult.totalCount,
              ...(cumulativeUsage && { usage: cumulativeUsage })
            },
            errors: [],
            warnings: [
              ...(queryResult.hasMore
                ? [`Query returned ${queryResult.totalCount} total results. Handle contains first ${workItemIds.length} items. Use pagination if you need all results.`]
                : []),
              ...(queryResult.totalCount > 1000 ? [`⚠️ Query returned ${queryResult.totalCount} results - consider adding more specific filters`] : [])
            ]
          };
        } else {
          // Query returned no results - return query-only response
          logger.warn(`Query returned 0 results, skipping handle creation`);
          return {
            success: true,
            data: {
              query: currentQuery,
              isValidated: testQuery && isValid,
              resultCount: 0,
              sampleResults: [],
              summary: `Successfully generated WIQL query (found 0 matching work items)`
            },
            metadata: {
              source: "ai-sampling-wiql-generator",
              validated: isValid,
              iterationCount: iterations.length,
              ...(cumulativeUsage && { usage: cumulativeUsage })
            },
            errors: [],
            warnings: [
              "⚠️ Query is valid but returned 0 results - you may need to adjust the criteria"
            ]
          };
        }
      } catch (handleError) {
        // If handle creation fails, fallback to query-only response
        logger.error('Failed to create query handle:', handleError);
        return {
          success: true,
          data: {
            query: currentQuery,
            isValidated: testQuery && isValid,
            ...(testResults && {
              resultCount: testResults.resultCount,
              sampleResults: testResults.sampleResults
            }),
            summary: isValid
              ? `Successfully generated WIQL query${testResults ? ` (found ${testResults.resultCount} matching work items)` : ''}`
              : `Failed to generate valid query. Last error: ${lastError}`
          },
          metadata: {
            source: "ai-sampling-wiql-generator",
            validated: isValid,
            iterationCount: iterations.length,
            ...(cumulativeUsage && { usage: cumulativeUsage })
          },
          errors: [],
          warnings: [
            `Failed to create query handle: ${handleError instanceof Error ? handleError.message : String(handleError)}`,
            ...(!testQuery ? ["Query validation was skipped - query may contain syntax errors"] : []),
            ...(testResults && testResults.resultCount === 0 ? ["⚠️ Query is valid but returned 0 results - you may need to adjust the criteria"] : []),
            ...(testResults && testResults.resultCount > 1000 ? [`⚠️ Query returned ${testResults.resultCount} results - consider adding more specific filters`] : [])
          ]
        };
      }
    }

    const result: ToolExecutionResult = {
      success: isValid,
      data: {
        query: currentQuery,
        isValidated: testQuery && isValid,
        ...(testResults && {
          resultCount: testResults.resultCount,
          sampleResults: testResults.sampleResults
        }),
        summary: isValid
          ? `Successfully generated WIQL query${testResults ? ` (found ${testResults.resultCount} matching work items)` : ''}`
          : `Failed to generate valid query. Last error: ${lastError}`
      },
      metadata: {
        source: "ai-sampling-wiql-generator",
        validated: isValid,
        iterationCount: iterations.length,
        ...(cumulativeUsage && { usage: cumulativeUsage })
      },
      errors: isValid ? [] : [lastError || "Failed to generate valid query"],
      warnings: [
        ...(!testQuery ? ["Query validation was skipped - query may contain syntax errors"] : []),
        ...(testResults && testResults.resultCount === 0 ? ["⚠️ Query is valid but returned 0 results - you may need to adjust the criteria"] : []),
        ...(testResults && testResults.resultCount > 1000 ? [`⚠️ Query returned ${testResults.resultCount} results - consider adding more specific filters`] : [])
      ]
    };

    return result;

  } catch (error) {
    logger.error('WIQL query generation handler error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "ai-sampling-wiql-generator" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
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
  
  // Build variables for the system prompt
  const variables: Record<string, string> = {
    PROJECT: project,
    AREA_PATH: areaPath || '',
    ITERATION_PATH: iterationPath || ''
  }
  
  let userContent = `Generate a WIQL query for the following request:\n\n${description}`;
  
  if (feedback?.previousQuery && feedback?.error) {
    userContent += `\n\n---\n\n**PREVIOUS ATTEMPT FAILED**\n\nPrevious Query:\n\`\`\`sql\n${feedback.previousQuery}\n\`\`\`\n\nError:\n${feedback.error}\n\nPlease fix the query to address this error.`;
  }

  const aiResult = await samplingClient.createMessage({
    systemPromptName: "wiql-query-generator",
    userContent,
    variables,
    maxTokens: 800,
    temperature: 0.3 // Low temperature for precise syntax
  });

  const responseText = samplingClient.extractResponseText(aiResult);
  const query = extractWiqlQuery(responseText);
  
  if (!query) {
    throw new Error("Failed to extract WIQL query from AI response");
  }

  // Extract usage information from aiResult if present
  const usage = (aiResult as Record<string, unknown>).usage as Record<string, unknown> | undefined;

  return {
    query: cleanWiqlQuery(query),
    usage
  };
}

/**
 * Test a WIQL query by executing it and checking for errors
 */
async function testWiqlQuery(
  query: string,
  organization: string,
  project: string
): Promise<{ success: boolean; error?: string; resultCount?: number; sampleResults?: Array<Record<string, unknown>> }> {
  try {
    // Execute with a limit to avoid large result sets during testing
    const result = await queryWorkItemsByWiql({
      wiqlQuery: query,
      organization,
      project,
      top: 10, // Only fetch first 10 for validation
      includeFields: ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State']
    });

    return {
      success: true,
      resultCount: result.totalCount || result.count,
      sampleResults: result.workItems.slice(0, 5).map((wi) => ({
        id: wi.id,
        title: wi.title,
        type: wi.type,
        state: wi.state
      }))
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Parse common WIQL errors for better feedback
    let parsedError = errorMessage;
    
    if (errorMessage.includes("ORDER BY")) {
      parsedError = "ORDER BY clause is not supported in WorkItemLinks queries. Use WorkItems query instead or remove ORDER BY.";
    } else if (errorMessage.includes("syntax error") || errorMessage.includes("VS402337")) {
      parsedError = `WIQL syntax error: ${errorMessage}. Check field names, brackets, and operators.`;
    } else if (errorMessage.includes("field")) {
      parsedError = `Invalid field name: ${errorMessage}. Ensure field names are in brackets and use proper system names.`;
    }

    return {
      success: false,
      error: parsedError
    };
  }
}
