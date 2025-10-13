/**
 * Hierarchy Validator Analyzer
 * 
 * Analyzes Azure DevOps work item hierarchies to identify parenting issues,
 * orphaned items, and incorrect relationships.
 */

import type { ToolExecutionResult } from '../../types/index.js';
import type { 
  HierarchyValidatorArgs, 
  HierarchyValidationResult,
  WorkItemHierarchyInfo
} from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import type { ADOWiqlResult, ADOApiResponse, ADOWorkItem } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { getRequiredConfig } from '../../config/config.js';
import { escapeAreaPath } from '../../utils/work-item-parser.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { createADOHttpClient } from '../../utils/ado-http-client.js';

export class HierarchyValidatorAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
  }

  /**
   * Main entry point for hierarchy validation
   */
  async analyze(args: HierarchyValidatorArgs): Promise<ToolExecutionResult> {
    logger.debug('Starting hierarchy validation analysis');

    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      // Merge args with config defaults
      const config = getRequiredConfig();
      const mergedArgs: HierarchyValidatorArgs = {
        ...args,
        Organization: args.Organization || config.organization,
        Project: args.Project || config.project
      };

      // Fetch work items from Azure DevOps
      const workItems = await this.fetchWorkItems(mergedArgs);
      
      if (workItems.length === 0) {
        return buildErrorResponse('No work items found to analyze. Please check WorkItemIds or AreaPath parameters.');
      }

      // Perform AI-powered hierarchy analysis
      const validationResult = await this.performAnalysis(workItems, mergedArgs);

      return buildSuccessResponse(validationResult, { 
        source: 'ai-sampling', 
        analysisType: 'hierarchy-validation',
        itemsAnalyzed: workItems.length
      });

    } catch (error) {
      return buildErrorResponse(`Hierarchy validation failed: ${error instanceof Error ? error.message : String(error)}`, { source: 'ai-sampling-failed' });
    }
  }

  /**
   * Fetch work items from Azure DevOps REST API
   */
  private async fetchWorkItems(args: HierarchyValidatorArgs): Promise<WorkItemHierarchyInfo[]> {
    const { WorkItemIds, AreaPath, Organization, Project, IncludeChildAreas, MaxItemsToAnalyze, FilterByWorkItemType, ExcludeStates, AnalysisDepth } = args;

    try {
      let workItemIds: number[] = [];

      // If specific IDs provided, use them and optionally fetch their children
      if (WorkItemIds && WorkItemIds.length > 0) {
        workItemIds = [...WorkItemIds];
        
        // For deep analysis or when analyzing hierarchy, fetch descendants recursively
        if (AnalysisDepth === 'deep' || WorkItemIds.length === 1) {
          logger.debug(`Fetching descendants for provided work item IDs: ${WorkItemIds.join(', ')}`);
          const descendantIds = await this.fetchDescendantsRecursively(Organization!, Project!, WorkItemIds, MaxItemsToAnalyze);
          workItemIds = [...workItemIds, ...descendantIds];
          logger.debug(`Total work items including descendants: ${workItemIds.length}`);
        }
        
        workItemIds = workItemIds.slice(0, MaxItemsToAnalyze || 50);
      } 
      // Otherwise, query by area path
      else if (AreaPath) {
        workItemIds = await this.queryWorkItemsByAreaPath(
          Organization!,
          Project!,
          AreaPath,
          IncludeChildAreas,
          MaxItemsToAnalyze,
          FilterByWorkItemType,
          ExcludeStates
        );
      } else {
        throw new Error('Either WorkItemIds or AreaPath must be provided');
      }

      if (workItemIds.length === 0) {
        return [];
      }

      // Fetch detailed work item information
      return await this.fetchWorkItemDetails(Organization!, Project!, workItemIds);

    } catch (error) {
      logger.error('Failed to fetch work items from Azure DevOps', error);
      throw new Error(`Failed to fetch work items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch child work items for given parent IDs using WIQL
   */
  private async fetchChildWorkItems(
    organization: string,
    project: string,
    parentIds: number[],
    maxItems?: number
  ): Promise<number[]> {
    try {
      const httpClient = createADOHttpClient(organization, project);
      const allChildIds: Set<number> = new Set();
      
      // Query children for each parent
      for (const parentId of parentIds) {
        const query = `SELECT [System.Id] FROM WorkItemLinks WHERE ([Source].[System.Id] = ${parentId}) AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') ORDER BY [System.Id] MODE (MustContain)`;
        
        const wiqlBody = { query };

        // Execute WIQL query using HTTP client
        const response = await httpClient.post<ADOWiqlResult>('wit/wiql?api-version=7.1', wiqlBody);
        const wiqlResult = response.data;

        // Check for API errors
        if (!wiqlResult || !wiqlResult.workItemRelations) {
          logger.warn(`WIQL query returned no results for parent ${parentId}`);
          continue;
        }

        // Extract target (child) work item IDs from the link results
        wiqlResult.workItemRelations.forEach((relation) => {
          if (relation.target?.id && relation.target.id !== parentId) {
            allChildIds.add(relation.target.id);
          }
        });
        
        // Stop if we've reached the max
        if (maxItems && allChildIds.size >= maxItems) {
          break;
        }
      }

      const childIds = Array.from(allChildIds);
      logger.debug(`Found ${childIds.length} child work items`);
      return childIds.slice(0, maxItems);

    } catch (error) {
      logger.warn('Failed to fetch child work items, continuing with parent items only', error);
      return [];
    }
  }

  /**
   * Recursively fetch all descendants (children, grandchildren, etc.) for given parent IDs
   */
  private async fetchDescendantsRecursively(
    organization: string,
    project: string,
    parentIds: number[],
    maxItems?: number
  ): Promise<number[]> {
    const allDescendants: Set<number> = new Set();
    const visited: Set<number> = new Set();
    const queue: number[] = [...parentIds];

    logger.debug(`Starting recursive descendant fetch for ${parentIds.length} parent(s)`);

    while (queue.length > 0 && (!maxItems || allDescendants.size < maxItems)) {
      const currentId = queue.shift()!;
      
      // Skip if already visited (prevent infinite loops in case of circular refs)
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      // Fetch immediate children for this work item
      const children = await this.fetchChildWorkItems(organization, project, [currentId], maxItems);
      
      for (const childId of children) {
        if (!allDescendants.has(childId) && !parentIds.includes(childId)) {
          allDescendants.add(childId);
          queue.push(childId); // Add to queue to fetch its children
          
          // Stop if we've reached max items
          if (maxItems && allDescendants.size >= maxItems) {
            break;
          }
        }
      }
    }

    const descendantIds = Array.from(allDescendants);
    logger.debug(`Found ${descendantIds.length} total descendants across ${visited.size} levels`);
    return descendantIds;
  }

  /**
   * Query work items by area path using WIQL
   */
  private async queryWorkItemsByAreaPath(
    organization: string,
    project: string,
    areaPath: string,
    includeChildAreas?: boolean,
    maxItems?: number,
    filterByType?: string[],
    excludeStates?: string[]
  ): Promise<number[]> {
    try {
      const httpClient = createADOHttpClient(organization, project);
      
      // Build WIQL query (escape area path for WIQL)
      const escapedAreaPath = escapeAreaPath(areaPath);
      const areaClause = includeChildAreas 
        ? `[System.AreaPath] UNDER '${escapedAreaPath}'` 
        : `[System.AreaPath] = '${escapedAreaPath}'`;
      
      const typeFilter = filterByType && filterByType.length > 0
        ? ` AND [System.WorkItemType] IN (${filterByType.map(t => `'${t}'`).join(',')})`
        : '';
      
      const stateFilter = excludeStates && excludeStates.length > 0
        ? ` AND [System.State] NOT IN (${excludeStates.map(s => `'${s}'`).join(',')})`
        : '';

      const query = `SELECT [System.Id] FROM WorkItems WHERE ${areaClause}${typeFilter}${stateFilter} ORDER BY [System.Id] DESC`;

      const wiqlBody = { query };

      // Execute WIQL query using HTTP client
      const response = await httpClient.post<ADOWiqlResult>('wit/wiql?api-version=7.1', wiqlBody);
      const wiqlResult = response.data;

      // Check for valid response
      if (!wiqlResult || !wiqlResult.workItems) {
        logger.warn(`WIQL query returned no workItems array. Query: ${query}`);
        return [];
      }

      const ids = wiqlResult.workItems.map((wi) => wi.id);
      return ids.slice(0, maxItems || 50);

    } catch (error) {
      logger.error('WIQL query failed', error);
      throw new Error(`Failed to query work items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch detailed work item information including parent relationships
   */
  private async fetchWorkItemDetails(
    organization: string,
    project: string,
    workItemIds: number[]
  ): Promise<WorkItemHierarchyInfo[]> {
    try {
      const httpClient = createADOHttpClient(organization, project);
      const ids = workItemIds.join(',');
      
      // Note: Cannot use fields parameter with $expand=relations, so we get all fields
      const response = await httpClient.get<ADOApiResponse<ADOWorkItem[]>>(
        `wit/workitems?ids=${ids}&$expand=relations&api-version=7.1`
      );
      const result = response.data;

      // Check for valid response
      if (!result.value) {
        logger.warn(`Work items API returned no value array. IDs: ${workItemIds.join(',')}`);
        return [];
      }

      // Build a map of work item IDs to titles for parent lookups
      const idToTitleMap = new Map<number, string>();
      result.value.forEach((wi) => {
        idToTitleMap.set(wi.id, wi.fields['System.Title']);
      });

      return result.value.map((wi) => {
        // Find parent relationship
        const parentRelation = wi.relations?.find((rel) => 
          rel.rel === 'System.LinkTypes.Hierarchy-Reverse'
        );
        
        const parentId = parentRelation 
          ? parseInt(parentRelation.url.split('/').pop() || '0')
          : undefined;

        const parentTitle = parentId ? idToTitleMap.get(parentId) : undefined;

        return {
          id: wi.id,
          title: wi.fields['System.Title'] || '',
          type: wi.fields['System.WorkItemType'] || '',
          state: wi.fields['System.State'] || '',
          currentParentId: parentId,
          currentParentTitle: parentTitle,
          areaPath: wi.fields['System.AreaPath'] || '',
          assignedTo: wi.fields['System.AssignedTo']?.displayName,
          description: wi.fields['System.Description']
        };
      });

    } catch (error) {
      logger.error('Failed to fetch work item details', error);
      throw new Error(`Failed to fetch work item details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform AI-powered hierarchy analysis
   */
  private async performAnalysis(
    workItems: WorkItemHierarchyInfo[], 
    args: HierarchyValidatorArgs
  ): Promise<HierarchyValidationResult> {
    logger.debug(`Analyzing ${workItems.length} work items for hierarchy issues`);

    const systemPromptName = 'hierarchy-validator';
    const userContent = formatForAI({ workItems, ...args });

    // Add timeout wrapper to prevent hanging - use shorter timeout for better UX
    const timeoutMs = 60000; // 60 seconds (1 minute)
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName,
      userContent,
      maxTokens: 1500,  // Reduced from 2000 for better sampling efficiency
      temperature: 0.3
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Hierarchy validation exceeded 60 second timeout while analyzing ${workItems.length} items. ` +
          'Try reducing MaxItemsToAnalyze or use validate-hierarchy-fast for large datasets.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);

    return this.parseHierarchyResponse(aiResult, workItems, args);
  }

  /**
   * Parse AI response into HierarchyValidationResult
   * Uses 3-level fallback: direct JSON, code block extraction, object regex match
   */
  private parseHierarchyResponse(
    aiResult: any,
    workItems: WorkItemHierarchyInfo[],
    args: HierarchyValidatorArgs
  ): HierarchyValidationResult {
    const responseText = this.samplingClient.extractResponseText(aiResult);
    const parsed = extractJSON(responseText);
    if (!parsed) {
      logger.error('Failed to parse hierarchy validation response', { responseText });
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate and normalize the response
    return this.normalizeHierarchyResult(parsed, workItems, args);
  }

  /**
   * Normalize parsed JSON into typed HierarchyValidationResult
   */
  private normalizeHierarchyResult(
    parsed: any,
    workItems: WorkItemHierarchyInfo[],
    args: HierarchyValidatorArgs
  ): HierarchyValidationResult {
    const now = new Date().toISOString();

    return {
      analysisContext: {
        analyzedItemCount: parsed.analysisContext?.analyzedItemCount || workItems.length,
        areaPath: parsed.analysisContext?.areaPath || args.AreaPath,
        analysisDepth: parsed.analysisContext?.analysisDepth || args.AnalysisDepth || 'shallow',
        timestamp: parsed.analysisContext?.timestamp || now
      },
      workItemsAnalyzed: workItems,
      issuesFound: (parsed.issuesFound || []).map((issue: any) => ({
        workItemId: issue.workItemId,
        workItemTitle: issue.workItemTitle,
        issues: (issue.issues || []).map((i: any) => ({
          issueType: this.normalizeIssueType(i.issueType),
          severity: this.normalizeSeverity(i.severity),
          description: i.description || 'No description provided',
          recommendations: i.recommendations || []
        })),
        parentingSuggestions: (issue.parentingSuggestions || []).map((s: any) => ({
          suggestedParentId: s.suggestedParentId,
          suggestedParentTitle: s.suggestedParentTitle || `Work Item ${s.suggestedParentId}`,
          suggestedParentType: s.suggestedParentType || 'Unknown',
          confidence: s.confidence || 0.5,
          reasoning: s.reasoning || 'No reasoning provided',
          benefits: s.benefits || [],
          potentialIssues: s.potentialIssues || []
        }))
      })),
      healthySummary: {
        totalAnalyzed: parsed.healthySummary?.totalAnalyzed || workItems.length,
        itemsWithIssues: parsed.healthySummary?.itemsWithIssues || 0,
        itemsWellParented: parsed.healthySummary?.itemsWellParented || workItems.length,
        orphanedItems: parsed.healthySummary?.orphanedItems || 0,
        incorrectlyParented: parsed.healthySummary?.incorrectlyParented || 0
      },
      recommendations: {
        highPriorityActions: parsed.recommendations?.highPriorityActions || [],
        improvementSuggestions: parsed.recommendations?.improvementSuggestions || [],
        bestPractices: parsed.recommendations?.bestPractices || []
      }
    };
  }

  /**
   * Normalize issue type to valid enum value
   */
  private normalizeIssueType(type: string): "misparented" | "orphaned" | "incorrect_level" | "circular_dependency" | "type_mismatch" {
    const normalized = type?.toLowerCase().replace(/[_\s-]/g, '_');
    if (['misparented', 'orphaned', 'incorrect_level', 'circular_dependency', 'type_mismatch'].includes(normalized)) {
      return normalized as any;
    }
    return 'misparented';
  }

  /**
   * Normalize severity to valid enum value
   */
  private normalizeSeverity(severity: string): "low" | "medium" | "high" | "critical" {
    const normalized = severity?.toLowerCase();
    if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
      return normalized as any;
    }
    return 'medium';
  }
}
