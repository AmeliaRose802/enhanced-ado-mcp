/**
 * Handler for wit-generate-odata-query tool
 * Generates OData Analytics queries from natural language using AI sampling with iterative validation
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { getAzureDevOpsToken } from "../../../utils/ado-token.js";

interface GenerateODataQueryArgs {
  description: string;
  organization: string;
  project: string;
  maxIterations?: number;
  includeExamples?: boolean;
  testQuery?: boolean;
  areaPath?: string;
  iterationPath?: string;
  serverInstance?: any; // Server instance for sampling
}

export async function handleGenerateODataQuery(config: ToolConfig, args: unknown, serverInstance: any): Promise<ToolExecutionResult> {
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
      iterationPath
    } = parsed.data as GenerateODataQueryArgs;

    logger.info(`Generating OData query from description: "${description}"`);
    if (areaPath) {
      logger.debug(`Using area path for query context: ${areaPath}`);
    }
    if (iterationPath) {
      logger.debug(`Using iteration path for query context: ${iterationPath}`);
    }

    const iterations: any[] = [];
    let currentQuery: string | null = null;
    let lastError: string | null = null;
    let isValid = false;
    let testResults: any = null;

    // Iterative generation and validation
    for (let attempt = 1; attempt <= maxIterations; attempt++) {
      logger.debug(`Generation attempt ${attempt}/${maxIterations}`);

      // Generate query using AI sampling
      const generatedQuery = await generateQueryWithAI(
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
          ? `Successfully generated OData query${testResults ? ` (found ${testResults.resultCount} results)` : ''}`
          : `Failed to generate valid query. Last error: ${lastError}`
      },
      metadata: {
        source: "ai-sampling-odata-generator",
        validated: isValid,
        iterationCount: iterations.length
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
): Promise<string> {
  
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

  return cleanODataQuery(query);
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
): Promise<{ success: boolean; error?: string; resultCount?: number; sampleResults?: any[] }> {
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
