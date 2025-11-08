/**
 * AI Query Analyzer
 * 
 * Performs intelligent AI-powered analysis on work items from a query handle
 * using natural language intent. Retrieves full context packages and provides
 * concise, actionable insights.
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { queryHandleService } from '../query-handle-service.js';
import { ADOHttpClient } from '@/utils/ado-http-client.js';
import { getTokenProvider } from '@/utils/token-provider.js';
import type { ADOWorkItem, ADOApiResponse } from '@/types/index.js';

export interface AIQueryAnalysisArgs {
  queryHandle: string;
  intent: string;
  itemSelector?: 'all' | number[] | Record<string, any>;
  maxItemsToAnalyze?: number;
  includeContextPackages?: boolean;
  contextDepth?: 'basic' | 'standard' | 'deep';
  outputFormat?: 'concise' | 'detailed' | 'json';
  confidenceThreshold?: number;
  temperature?: number;
  organization?: string;
  project?: string;
}

export class AIQueryAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: AIQueryAnalysisArgs): Promise<ToolExecutionResult> {
    logger.debug(`Starting AI query analysis with intent: ${args.intent.substring(0, 100)}...`);

    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      // Retrieve query handle data
      const queryData = queryHandleService.getQueryData(args.queryHandle);
      if (!queryData) {
        return buildErrorResponse(
          `Query handle '${args.queryHandle}' not found or expired. Query handles expire after 1 hour.`,
          { source: 'ai-query-analyzer' }
        );
      }

      const maxItems = Math.min(args.maxItemsToAnalyze || 50, 100);
      const itemsToAnalyze = queryData.workItemIds.slice(0, maxItems);

      if (itemsToAnalyze.length === 0) {
        return buildErrorResponse(
          'No work items found in query handle',
          { source: 'ai-query-analyzer' }
        );
      }

      logger.info(`Analyzing ${itemsToAnalyze.length} work items with AI (intent: ${args.intent})`);

      // Fetch work item data
      const workItemsData = await this.fetchWorkItems(
        itemsToAnalyze,
        args.organization,
        args.project,
        args.contextDepth || 'standard'
      );

      // Perform AI analysis
      const analysisResult = await this.performAIAnalysis(
        workItemsData,
        args.intent,
        args.outputFormat || 'concise',
        args.temperature || 0.3
      );

      // Filter by confidence if needed
      const filtered = args.confidenceThreshold && args.confidenceThreshold > 0
        ? this.filterByConfidence(analysisResult, args.confidenceThreshold)
        : analysisResult;

      return buildSuccessResponse(filtered, {
        source: 'ai-query-analyzer',
        queryHandle: args.queryHandle,
        itemsAnalyzed: itemsToAnalyze.length,
        intent: args.intent,
        outputFormat: args.outputFormat || 'concise'
      });

    } catch (error) {
      logger.error(`AI query analysis failed: ${error}`);
      return buildErrorResponse(
        `AI query analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { source: 'ai-query-analyzer' }
      );
    }
  }

  private async fetchWorkItems(
    workItemIds: number[],
    organization?: string,
    project?: string,
    contextDepth: 'basic' | 'standard' | 'deep' = 'standard'
  ): Promise<ADOWorkItem[]> {
    const { loadConfiguration } = await import('@/config/config.js');
    const config = loadConfiguration();
    const org = organization || config.azureDevOps.organization;
    const proj = project || config.azureDevOps.project;

    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    // Define fields based on context depth
    const basicFields = [
      'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
      'System.AssignedTo', 'System.Tags', 'System.Description',
      'Microsoft.VSTS.Common.Priority', 'Microsoft.VSTS.Scheduling.StoryPoints',
      'System.CreatedDate', 'System.ChangedDate'
    ];

    const standardFields = [...basicFields, 'System.AreaPath', 'System.IterationPath'];
    const deepFields = [...standardFields, 'System.History', 'System.CommentCount'];

    const fields = contextDepth === 'basic' ? basicFields
      : contextDepth === 'deep' ? deepFields
      : standardFields;

    const workItems: ADOWorkItem[] = [];
    const batchSize = 50;

    for (let i = 0; i < workItemIds.length; i += batchSize) {
      const batch = workItemIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      try {
        const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
          `wit/workitems?ids=${idsParam}&fields=${fields.join(',')}`
        );

        if (response.data?.value) {
          workItems.push(...response.data.value);
        }
      } catch (error) {
        logger.error(`Failed to fetch work items batch: ${error}`);
        throw new Error(`Failed to fetch work items: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return workItems;
  }

  private async performAIAnalysis(
    workItems: ADOWorkItem[],
    intent: string,
    outputFormat: 'concise' | 'detailed' | 'json',
    temperature: number
  ): Promise<any> {
    // Format work items for AI
    const formattedItems = workItems.map(wi => ({
      id: wi.id,
      title: wi.fields?.['System.Title'],
      type: wi.fields?.['System.WorkItemType'],
      state: wi.fields?.['System.State'],
      assignedTo: wi.fields?.['System.AssignedTo'],
      priority: wi.fields?.['Microsoft.VSTS.Common.Priority'],
      storyPoints: wi.fields?.['Microsoft.VSTS.Scheduling.StoryPoints'],
      tags: wi.fields?.['System.Tags'],
      description: wi.fields?.['System.Description'],
      createdDate: wi.fields?.['System.CreatedDate'],
      changedDate: wi.fields?.['System.ChangedDate']
    }));

    const userContent = formatForAI({
      intent,
      workItems: formattedItems,
      totalItems: workItems.length,
      outputFormat
    });

    // Timeout protection
    const timeoutMs = 120000; // 2 minutes
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName: 'ai-query-analyzer',
      userContent,
      maxTokens: outputFormat === 'concise' ? 800 : outputFormat === 'json' ? 1500 : 1200,
      temperature
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `AI query analysis exceeded ${timeoutMs/1000} second timeout. ` +
          'The AI model may be overloaded. Try again with fewer items or simpler intent.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);
    const responseText = this.samplingClient.extractResponseText(aiResult as { content: { text: string } });

    // Parse response
    if (outputFormat === 'json') {
      const jsonData = extractJSON(responseText);
      if (!jsonData) {
        throw new Error('Failed to parse AI response as JSON');
      }
      return jsonData;
    }

    return { analysis: responseText, format: outputFormat };
  }

  private filterByConfidence(analysisResult: any, threshold: number): any {
    // If result has recommendations with confidence scores, filter them
    if (analysisResult.recommendations && Array.isArray(analysisResult.recommendations)) {
      analysisResult.recommendations = analysisResult.recommendations.filter(
        (rec: any) => !rec.confidence || rec.confidence >= threshold
      );
    }

    return analysisResult;
  }
}
