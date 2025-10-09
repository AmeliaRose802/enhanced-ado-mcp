/**
 * Handler for wit-ai-generate-odata tool
 * Generates OData Analytics queries from natural language using AI sampling with iterative validation
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { asToolData } from "../../../types/index.js";
import type { WorkItemContext } from '../../../types/index.js';
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { getAzureDevOpsToken } from "../../../utils/ado-token.js";
import { queryHandleService } from "../../query-handle-service.js";
import { getRequiredConfig } from "../../../config/config.js";

interface GenerateODataQueryArgs {
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

export async function handleGenerateODataQuery(config: ToolConfig, args: unknown, serverInstance: MCPServer | MCPServerLike): Promise<ToolExecutionResult> {
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

    const requiredConfig = getRequiredConfig();
    const {
      description,
      organization = requiredConfig.organization,
      project = requiredConfig.project,
      maxIterations = 3,
      includeExamples = true,
      testQuery = true,
      areaPath,
      iterationPath,
      returnQueryHandle = true,
      maxResults = 200,
      includeFields = []
    } = parsed.data as GenerateODataQueryArgs;

    logger.info(`Generating OData query from description: "${description}"`);
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
    let cumulativeUsage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null = null;

    // Iterative generation and validation
    for (let attempt = 1; attempt <= maxIterations; attempt++) {
      logger.debug(`Generation attempt ${attempt}/${maxIterations}`);

      // Generate query using AI sampling
      const { query: generatedQuery, usage } = await generateQueryWithAI(
        samplingClient,
        description,
        organization,
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
          const inputTokens = usage.inputTokens as number | undefined;
          const outputTokens = usage.outputTokens as number | undefined;
          const totalTokens = usage.totalTokens as number | undefined;
          
          if (inputTokens) cumulativeUsage.inputTokens = ((cumulativeUsage.inputTokens as number) || 0) + inputTokens;
          if (outputTokens) cumulativeUsage.outputTokens = ((cumulativeUsage.outputTokens as number) || 0) + outputTokens;
          if (totalTokens) cumulativeUsage.totalTokens = ((cumulativeUsage.totalTokens as number) || 0) + totalTokens;
        }
      }

      // Test the query if requested
      if (testQuery) {
        const testResult = await testODataQuery(currentQuery, organization, project);
        
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

    // If returnQueryHandle is true and query is valid, execute and store results
    if (returnQueryHandle && isValid && currentQuery) {
      try {
        logger.info(`Executing OData query to create query handle (maxResults: ${maxResults})...`);
        
        // Execute the query with proper fields selection
        const token = await getAzureDevOpsToken();
        const baseUrl = `https://analytics.dev.azure.com/${organization}/${project}/_odata/v3.0-preview/WorkItems`;
        
        // Build the full query with $top and $select
        const fieldsToSelect = includeFields.length > 0 
          ? includeFields.join(',')
          : 'WorkItemId,Title,State,WorkItemType,CreatedDate,ChangedDate,AssignedTo,AreaPath,IterationPath,Tags';
        
        let fullQuery = currentQuery;
        if (!fullQuery.includes('$select')) {
          fullQuery += (fullQuery.includes('?') ? '&' : '?') + `$select=${fieldsToSelect}`;
        }
        if (!fullQuery.includes('$top')) {
          fullQuery += (fullQuery.includes('?') || fullQuery.includes('$') ? '&' : '?') + `$top=${maxResults}`;
        }
        
        const url = fullQuery.startsWith('http') ? fullQuery : `${baseUrl}?${fullQuery}`;
        
        logger.debug(`Fetching work items from: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          
          // Provide helpful hints for common Analytics API errors
          if (response.status === 401 || response.status === 403 || errorText.includes('TF400813')) {
            throw new Error(
              `Analytics API authorization error: Cannot create query handle.\n` +
              `The user account does not have permission to access Azure DevOps Analytics.\n` +
              `Required permission: "View analytics" at the project level.\n` +
              `Please contact your Azure DevOps administrator to grant Analytics access.`
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
              query: currentQuery,
              isValidated: testQuery && isValid,
              resultCount: 0,
              summary: `Successfully generated OData query but it returned 0 results. No query handle created.`
            }),
            metadata: {
              source: "ai-sampling-odata-generator",
              validated: isValid,
              iterationCount: iterations.length,
              ...(cumulativeUsage && { usage: cumulativeUsage })
            },
            errors: [],
            warnings: ["⚠️ Query is valid but returned 0 results - you may need to adjust the criteria"]
          };
        }
        
        // Extract work item IDs from OData results
        const workItemIds = workItems.map((wi: any) => {
          const wiRecord = wi as Record<string, unknown>;
          return (wiRecord.WorkItemId || wiRecord.workItemId || wiRecord.id) as number;
        });
        
        // Build work item context map for query handle
        const workItemContext = new Map<number, WorkItemContext>();
        for (const wi of workItems) {
          const wiRecord = wi as Record<string, unknown>;
          const id = (wiRecord.WorkItemId || wiRecord.workItemId || wiRecord.id) as number;
          const tags = (wiRecord.Tags || wiRecord.tags || '') as string;
          
          workItemContext.set(id, {
            title: (wiRecord.Title || wiRecord.title || '') as string,
            state: (wiRecord.State || wiRecord.state || '') as string,
            type: (wiRecord.WorkItemType || wiRecord.workItemType || wiRecord.type || '') as string,
            createdDate: wi.CreatedDate || wi.createdDate,
            assignedTo: wi.AssignedTo ? (wi.AssignedTo.UserName || wi.AssignedTo) : undefined,
            areaPath: wi.AreaPath || wi.areaPath,
            iterationPath: wi.IterationPath || wi.iterationPath,
            changedDate: wi.ChangedDate || wi.changedDate,
            tags: typeof tags === 'string' ? tags : ''
          });
        }
        
        // Store in query handle service
        const handle = queryHandleService.storeQuery(
          workItemIds,
          currentQuery,
          {
            project: project,
            queryType: 'odata'
          },
          60 * 60 * 1000, // 1 hour TTL
          workItemContext,
          {
            analysisTimestamp: new Date().toISOString()
          }
        );
        
        logger.info(`Query handle created: ${handle} (${workItemIds.length} work items)`);
        
        return {
          success: true,
          data: asToolData({
            query_handle: handle,
            query: currentQuery,
            work_item_count: workItemIds.length,
            work_items: workItems,
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
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
          }),
          metadata: {
            source: "ai-sampling-odata-generator",
            validated: isValid,
            iterationCount: iterations.length,
            queryHandleMode: true,
            handle,
            count: workItemIds.length,
            ...(cumulativeUsage && { usage: cumulativeUsage })
          },
          errors: [],
          warnings: [
            ...(!testQuery ? ["Query validation was skipped - query may contain syntax errors"] : [])
          ]
        };
        
      } catch (error) {
        logger.error('Failed to create query handle:', error);
        
        // Fall back to returning just the query without handle
        return {
          success: true,
          data: asToolData({
            query: currentQuery,
            isValidated: testQuery && isValid,
            ...(testResults && {
              resultCount: testResults.resultCount,
              sampleResults: testResults.sampleResults
            }),
            summary: `Successfully generated OData query but failed to create query handle: ${error instanceof Error ? error.message : String(error)}`
          }),
          metadata: {
            source: "ai-sampling-odata-generator",
            validated: isValid,
            iterationCount: iterations.length,
            ...(cumulativeUsage && { usage: cumulativeUsage })
          },
          errors: [],
          warnings: [
            `Failed to create query handle: ${error instanceof Error ? error.message : String(error)}`,
            ...(!testQuery ? ["Query validation was skipped - query may contain syntax errors"] : [])
          ]
        };
      }
    }

    const result: ToolExecutionResult = {
      success: isValid,
      data: asToolData({
        query: currentQuery,
        isValidated: testQuery && isValid,
        ...(testResults && {
          resultCount: testResults.resultCount,
          sampleResults: testResults.sampleResults
        }),
        summary: isValid
          ? `Successfully generated OData query${testResults ? ` (found ${testResults.resultCount} results)` : ''}`
          : `Failed to generate valid query. Last error: ${lastError}`
      }),
      metadata: {
        source: "ai-sampling-odata-generator",
        validated: isValid,
        iterationCount: iterations.length,
        ...(cumulativeUsage && { usage: cumulativeUsage })
      },
      errors: isValid ? [] : [lastError || "Failed to generate valid query"],
      warnings: [
        ...(!testQuery ? ["Query validation was skipped - query may contain syntax errors"] : []),
        ...(testResults && testResults.resultCount === 0 ? ["⚠️ Query is valid but returned 0 results - you may need to adjust the criteria"] : [])
      ]
    };

    return result;

  } catch (error) {
    logger.error('OData query generation handler error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "ai-sampling-odata-generator" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Generate OData query using AI sampling
 */
async function generateQueryWithAI(
  samplingClient: SamplingClient,
  description: string,
  organization: string,
  project: string,
  areaPath: string | undefined,
  iterationPath: string | undefined,
  includeExamples: boolean,
  feedback?: { previousQuery: string | null; error: string | null }
): Promise<{ query: string; usage?: Record<string, unknown> }> {
  
  // Build variables for the system prompt
  const variables: Record<string, string> = {
    PROJECT: project,
    ORGANIZATION: organization,
    AREA_PATH: areaPath || '',
    ITERATION_PATH: iterationPath || ''
  };
  
  let userContent = `Generate an OData Analytics query for the following request:\n\n${description}`;
  
  if (feedback?.previousQuery && feedback?.error) {
    userContent += `\n\n---\n\n**PREVIOUS ATTEMPT FAILED**\n\nPrevious Query:\n${feedback.previousQuery}\n\nError:\n${feedback.error}\n\nPlease fix the query to address this error.`;
  }

  const aiResult = await samplingClient.createMessage({
    systemPromptName: "odata-query-generator",
    userContent,
    variables,
    maxTokens: 800,
    temperature: 0.3 // Low temperature for precise syntax
  });

  const responseText = samplingClient.extractResponseText(aiResult);
  const query = extractODataQuery(responseText);
  
  if (!query) {
    throw new Error("Failed to extract OData query from AI response");
  }

  // Extract usage information from aiResult if present
  const usage = (aiResult as Record<string, unknown>).usage as Record<string, unknown> | undefined;

  return {
    query: cleanODataQuery(query),
    usage
  };
}

/**
 * Extract OData query from AI response
 */
function extractODataQuery(responseText: string): string | null {
  // Try to find query in code blocks first
  const codeBlockMatch = responseText.match(/```(?:odata|sql|text)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find query starting with $apply or $filter
  const queryMatch = responseText.match(/(\$(?:apply|filter|orderby|top)=[\s\S]*?)(?:\n\n|\n[A-Z]|$)/);
  if (queryMatch) {
    return queryMatch[1].trim();
  }

  // If no match, return the whole response (might be just the query)
  const cleaned = responseText.trim();
  if (cleaned.startsWith('$')) {
    return cleaned;
  }

  return null;
}

/**
 * Clean OData query string
 */
function cleanODataQuery(query: string): string {
  return query
    .replace(/^\s*```(?:odata|sql|text)?\s*/gm, '') // Remove code block starts
    .replace(/\s*```\s*$/gm, '') // Remove code block ends
    .trim();
}

/**
 * Test an OData query by executing it and checking for errors
 */
async function testODataQuery(
  query: string,
  organization: string,
  project: string
): Promise<{ success: boolean; error?: string; resultCount?: number; sampleResults?: Array<Record<string, unknown>> }> {
  try {
    const token = await getAzureDevOpsToken();
    const baseUrl = `https://analytics.dev.azure.com/${organization}/${project}/_odata/v3.0-preview/WorkItems`;
    const url = `${baseUrl}?${query}${query.includes('$top') ? '' : '&$top=5'}`;

    logger.debug(`Testing OData query: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`OData test failed: ${response.status} ${errorText}`);
      
      // Provide helpful hints for Analytics API authorization errors
      if (response.status === 401 || response.status === 403 || errorText.includes('TF400813')) {
        return {
          success: false,
          error: `Analytics API authorization error: ${response.status}. User lacks "View analytics" permission. Please contact your Azure DevOps administrator.`
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
      sampleResults: results.slice(0, 3) // Return max 3 samples
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Parse common OData errors for better feedback
    let parsedError = errorMessage;
    
    if (errorMessage.includes("400")) {
      parsedError = `OData syntax error: ${errorMessage}. Check field names, quotes, and operators.`;
    } else if (errorMessage.includes("not valid")) {
      parsedError = `Invalid OData query: ${errorMessage}. Check field names and navigation properties.`;
    } else if (errorMessage.includes("Property")) {
      parsedError = `Field not found: ${errorMessage}. Ensure field names are correct for Analytics API.`;
    }

    return {
      success: false,
      error: parsedError
    };
  }
}
