/**
 * Handler for wit-generate-query tool (Unified Query Generator)
 * Intelligently chooses between WIQL and OData based on query characteristics
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { handleGenerateWiqlQuery } from "./generate-wiql-query.handler.js";
import { handleGenerateODataQuery } from "./generate-odata-query.handler.js";

interface UnifiedQueryGeneratorArgs {
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
  serverInstance?: MCPServer | MCPServerLike;
}

interface FormatDecision {
  format: 'wiql' | 'odata';
  confidence: number;
  reasoning: string[];
}

export async function handleUnifiedQueryGenerator(
  config: ToolConfig,
  args: unknown,
  serverInstance: MCPServer | MCPServerLike
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
      returnQueryHandle = true,
      maxResults = 200,
      includeFields
    } = parsed.data as UnifiedQueryGeneratorArgs;

    logger.info(`Analyzing query to determine optimal format: "${description}"`);

    // Step 1: Use AI to determine the best query format
    const formatDecision = await determineQueryFormat(samplingClient, description);
    
    logger.info(`Format decision: ${formatDecision.format} (confidence: ${formatDecision.confidence.toFixed(2)})`);
    logger.debug(`Reasoning: ${formatDecision.reasoning.join('; ')}`);

    // Step 2: Delegate to the appropriate handler based on the decision
    const delegateArgs = {
      description,
      organization,
      project,
      maxIterations,
      includeExamples,
      testQuery,
      areaPath,
      iterationPath,
      returnQueryHandle,
      maxResults,
      includeFields
    };

    let result: ToolExecutionResult;

    if (formatDecision.format === 'wiql') {
      logger.debug('Delegating to WIQL query generator');
      result = await handleGenerateWiqlQuery(config, delegateArgs, serverInstance);
    } else {
      logger.debug('Delegating to OData query generator');
      result = await handleGenerateODataQuery(config, delegateArgs, serverInstance);
    }

    // Step 3: Enhance the result with format selection metadata
    if (result.success) {
      return {
        ...result,
        data: {
          ...result.data,
          formatDecision: {
            selectedFormat: formatDecision.format,
            confidence: formatDecision.confidence,
            reasoning: formatDecision.reasoning
          }
        },
        metadata: {
          ...result.metadata,
          intelligentRouting: true,
          formatSelected: formatDecision.format,
          selectionConfidence: formatDecision.confidence
        },
        warnings: [
          ...(result.warnings || []),
          `Intelligent routing selected ${formatDecision.format.toUpperCase()} format (confidence: ${(formatDecision.confidence * 100).toFixed(0)}%): ${formatDecision.reasoning[0]}`
        ]
      };
    }

    return result;

  } catch (error) {
    logger.error('Error in unified query generator:', error);
    return {
      success: false,
      data: null,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      metadata: {
        source: 'unified-query-generator',
        error: true
      }
    };
  }
}

/**
 * Use AI to determine the optimal query format (WIQL vs OData)
 */
async function determineQueryFormat(
  samplingClient: SamplingClient,
  description: string
): Promise<FormatDecision> {
  try {
    logger.debug('Requesting AI analysis for format selection');

    const aiResult = await samplingClient.createMessage({
      systemPromptName: 'query-generator',
      userContent: `Analyze this query request and determine the optimal format:\n\n${description}`,
      maxTokens: 500,
      temperature: 0.2 // Low temperature for consistent decisions
    });

    const responseText = samplingClient.extractResponseText(aiResult);
    logger.debug(`AI response: ${responseText.substring(0, 200)}...`);

    // Parse the JSON response
    const decision = parseFormatDecision(responseText);

    // Validate the decision
    if (!decision.format || !['wiql', 'odata'].includes(decision.format)) {
      throw new Error('Invalid format in AI response');
    }

    if (typeof decision.confidence !== 'number' || decision.confidence < 0 || decision.confidence > 1) {
      throw new Error('Invalid confidence score in AI response');
    }

    if (!Array.isArray(decision.reasoning) || decision.reasoning.length === 0) {
      throw new Error('Missing or invalid reasoning in AI response');
    }

    return decision;

  } catch (error) {
    logger.warn('Error determining format with AI, falling back to heuristic:', error);
    // Fallback to simple heuristic-based decision
    return determineQueryFormatHeuristic(description);
  }
}

/**
 * Parse the AI response to extract format decision
 */
function parseFormatDecision(responseText: string): FormatDecision {
  // Try to extract JSON from response
  let jsonText = responseText.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  }

  // Try to find JSON object in text
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      format: parsed.format?.toLowerCase() as 'wiql' | 'odata',
      confidence: Number(parsed.confidence),
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : []
    };
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fallback heuristic-based format selection when AI is unavailable
 */
function determineQueryFormatHeuristic(description: string): FormatDecision {
  const lowerDesc = description.toLowerCase();

  // Strong OData indicators (aggregation/analytics keywords)
  const odataKeywords = [
    'count', 'average', 'sum', 'group by', 'grouped by', 'group', 'metrics',
    'velocity', 'cycle time', 'throughput', 'aggregate', 'total', 'mean',
    'statistics', 'how many', 'number of', 'distribution'
  ];

  // Strong WIQL indicators (hierarchy/relationship keywords)
  const wiqlKeywords = [
    'children', 'child', 'parent', 'hierarchy', 'tree', 'descendants',
    'ancestors', 'linked', 'related', 'dependencies', 'all items under'
  ];

  const odataScore = odataKeywords.filter(kw => lowerDesc.includes(kw)).length;
  const wiqlScore = wiqlKeywords.filter(kw => lowerDesc.includes(kw)).length;

  if (odataScore > wiqlScore) {
    return {
      format: 'odata',
      confidence: Math.min(0.7 + (odataScore * 0.1), 0.9),
      reasoning: [
        'Query contains aggregation or analytics keywords',
        'OData Analytics is optimized for metrics and grouping operations',
        'Heuristic analysis used (AI unavailable)'
      ]
    };
  } else if (wiqlScore > odataScore) {
    return {
      format: 'wiql',
      confidence: Math.min(0.7 + (wiqlScore * 0.1), 0.9),
      reasoning: [
        'Query contains hierarchical or relationship keywords',
        'WIQL is optimized for work item relationships and tree structures',
        'Heuristic analysis used (AI unavailable)'
      ]
    };
  } else {
    // Default to WIQL for simple list queries
    return {
      format: 'wiql',
      confidence: 0.6,
      reasoning: [
        'No clear indicators for OData or WIQL',
        'Defaulting to WIQL for general-purpose queries',
        'Heuristic analysis used (AI unavailable)'
      ]
    };
  }
}
