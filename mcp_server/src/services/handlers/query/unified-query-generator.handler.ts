/**
 * Handler for wit-generate-query tool
 * Unified query generator that intelligently selects between WIQL and OData based on query characteristics
 */

import type { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import { asToolData } from "../../../types/index.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { getRequiredConfig } from "../../../config/config.js";
import { logger } from "../../../utils/logger.js";
import { SamplingClient } from "../../../utils/sampling-client.js";
import { buildSamplingUnavailableResponse } from "../../../utils/response-builder.js";

// Import the specific handlers
import { handleWiqlQuery } from "./wiql-query.handler.js";
import { handleGenerateODataQuery } from "./generate-odata-query.handler.js";

interface UnifiedQueryGeneratorArgs {
  description: string;
  organization?: string;
  project?: string;
  maxIterations?: number;
  includeExamples?: boolean;
  testQuery?: boolean;
  areaPath?: string;
  iterationPath?: string;
  returnQueryHandle?: boolean;
  maxResults?: number;
  includeFields?: string[];
}

/**
 * Analyze query description to determine if it requires OData (aggregations/analytics)
 * or WIQL (work item lists/hierarchies)
 */
function analyzeQueryIntent(description: string): { 
  queryType: 'odata' | 'wiql';
  confidence: number;
  reasoning: string;
} {
  const lowerDesc = description.toLowerCase();
  
  // Strong indicators for OData (aggregations, analytics, metrics)
  const odataIndicators = [
    /\b(count|sum|average|avg|min|max|total)\b/i,
    /\b(group\s+by|grouped?\s+by)\b/i,
    /\b(aggregate|aggregation)\b/i,
    /\b(metrics?|statistics?|analytics?)\b/i,
    /\b(velocity|burndown|cumulative\s+flow)\b/i,
    /\b(trend|over\s+time|historical)\b/i,
    /\bper\s+(day|week|month|sprint|iteration|person|team|assignee)\b/i,
  ];
  
  // Strong indicators for WIQL (lists, hierarchies, filtering)
  const wiqlIndicators = [
    /\b(list|show|find|get|fetch|retrieve)\b/i,
    /\b(all|every)\b.*\b(bug|task|pbi|feature|epic|story|issue|work\s+item)s?\b/i,
    /\b(parent|child|children|hierarchy|tree)\b/i,
    /\b(linked?\s+to|related\s+to)\b/i,
    /\b(assigned?\s+to|created\s+by|changed\s+by)\b/i,
    /\b(in\s+state|with\s+state|status\s+is)\b/i,
    /\b(title\s+contains?|description\s+contains?)\b/i,
    /\b(tag|label|area\s+path|iteration\s+path)\b/i,
  ];
  
  let odataScore = 0;
  let wiqlScore = 0;
  
  // Check OData indicators
  for (const pattern of odataIndicators) {
    if (pattern.test(description)) {
      odataScore += 1;
    }
  }
  
  // Check WIQL indicators
  for (const pattern of wiqlIndicators) {
    if (pattern.test(description)) {
      wiqlScore += 1;
    }
  }
  
  // Determine query type based on scores
  if (odataScore > wiqlScore) {
    const confidence = Math.min(0.95, 0.6 + (odataScore - wiqlScore) * 0.1);
    return {
      queryType: 'odata',
      confidence,
      reasoning: `Description contains ${odataScore} analytics/aggregation indicator(s) vs ${wiqlScore} list/filter indicator(s). Query requires OData for statistical analysis.`
    };
  } else if (wiqlScore > odataScore) {
    const confidence = Math.min(0.95, 0.6 + (wiqlScore - odataScore) * 0.1);
    return {
      queryType: 'wiql',
      confidence,
      reasoning: `Description contains ${wiqlScore} list/filter indicator(s) vs ${odataScore} analytics/aggregation indicator(s). Query requires WIQL for work item listing.`
    };
  } else if (odataScore === 0 && wiqlScore === 0) {
    // No clear indicators - default to WIQL for simple queries
    return {
      queryType: 'wiql',
      confidence: 0.5,
      reasoning: `No specific indicators detected. Defaulting to WIQL for general work item queries.`
    };
  } else {
    // Equal scores but both present - prefer WIQL for mixed queries
    return {
      queryType: 'wiql',
      confidence: 0.6,
      reasoning: `Query has both analytics and listing characteristics (${odataScore} vs ${wiqlScore}). Using WIQL as it can handle most mixed scenarios.`
    };
  }
}

/**
 * Handle unified query generation
 */
export async function handleUnifiedQueryGenerator(
  config: ToolConfig,
  args: unknown,
  serverInstance: MCPServer | MCPServerLike
): Promise<ToolExecutionResult> {
  try {
    // Validate arguments
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const parsed = validation.data as UnifiedQueryGeneratorArgs;
    const requiredConfig = getRequiredConfig();
    
    // Check sampling support
    const samplingClient = new SamplingClient(serverInstance);
    if (!samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    // Analyze query intent
    const analysis = analyzeQueryIntent(parsed.description);
    
    logger.info(`🔍 Query Intent Analysis: ${analysis.queryType.toUpperCase()} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
    logger.debug(`Reasoning: ${analysis.reasoning}`);

    // Prepare arguments for the delegated handler
    const delegatedArgs = {
      description: parsed.description,
      organization: parsed.organization || requiredConfig.organization,
      project: parsed.project || requiredConfig.project,
      areaPath: parsed.areaPath || requiredConfig.defaultAreaPath,
      iterationPath: parsed.iterationPath || requiredConfig.defaultIterationPath,
      maxIterations: parsed.maxIterations || 3,
      includeExamples: parsed.includeExamples !== false,
      testQuery: parsed.testQuery !== false,
      returnQueryHandle: parsed.returnQueryHandle !== false, // Default to true for safety
      maxResults: parsed.maxResults || 200,
      includeFields: parsed.includeFields || []
    };

    let result: ToolExecutionResult;
    
    // Delegate to the appropriate handler
    if (analysis.queryType === 'odata') {
      logger.info(`📊 Delegating to OData Analytics query generator...`);
      result = await handleGenerateODataQuery(config, delegatedArgs, serverInstance);
    } else {
      logger.info(`📋 Delegating to WIQL query generator...`);
      result = await handleWiqlQuery(config, delegatedArgs, serverInstance);
    }

    // Enhance result with query type selection metadata
    return {
      ...result,
      metadata: {
        ...result.metadata,
        unifiedQueryGenerator: true,
        selectedQueryType: analysis.queryType,
        selectionConfidence: analysis.confidence,
        selectionReasoning: analysis.reasoning
      },
      warnings: [
        ...result.warnings,
        `🤖 Unified Query Generator selected ${analysis.queryType.toUpperCase()} format (${(analysis.confidence * 100).toFixed(0)}% confidence)`
      ]
    };

  } catch (error) {
    logger.error('Unified query generator error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "unified-query-generator" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
