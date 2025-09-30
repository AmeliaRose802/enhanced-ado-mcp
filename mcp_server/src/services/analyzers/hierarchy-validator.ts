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
} from '../sampling-types.js';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../../utils/logger.js';
import { AZURE_DEVOPS_RESOURCE_ID } from '../../config/defaults.js';
import { SamplingClient } from '../helpers/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../helpers/response-builder.js';
import { extractJSON } from '../helpers/json-parser.js';
import { formatForAI } from '../helpers/sampling-formatters.js';

export class HierarchyValidatorAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
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
      // Fetch work items from Azure DevOps
      const workItems = await this.fetchWorkItems(args);
      
      if (workItems.length === 0) {
        return buildErrorResponse('No work items found to analyze. Please check WorkItemIds or AreaPath parameters.');
      }

      // Perform AI-powered hierarchy analysis
      const validationResult = await this.performAnalysis(workItems, args);

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
      // Get Azure DevOps access token
      const token = this.getAzureDevOpsToken();
      
      let workItemIds: number[] = [];

      // If specific IDs provided, use them and optionally fetch their children
      if (WorkItemIds && WorkItemIds.length > 0) {
        workItemIds = [...WorkItemIds];
        
        // For deep analysis or when analyzing hierarchy, also fetch children
        if (AnalysisDepth === 'deep' || WorkItemIds.length === 1) {
          logger.debug(`Fetching children for provided work item IDs: ${WorkItemIds.join(', ')}`);
          const childIds = await this.fetchChildWorkItems(Organization!, Project!, WorkItemIds, token, MaxItemsToAnalyze);
          workItemIds = [...workItemIds, ...childIds];
          logger.debug(`Total work items including children: ${workItemIds.length}`);
        }
        
        workItemIds = workItemIds.slice(0, MaxItemsToAnalyze || 50);
      } 
      // Otherwise, query by area path
      else if (AreaPath) {
        workItemIds = await this.queryWorkItemsByAreaPath(
          Organization!,
          Project!,
          AreaPath,
          token,
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
      return await this.fetchWorkItemDetails(Organization!, Project!, workItemIds, token);

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
    token: string,
    maxItems?: number
  ): Promise<number[]> {
    const tempFile = join(tmpdir(), `ado-wiql-children-${Date.now()}.json`);
    
    try {
      const allChildIds: Set<number> = new Set();
      
      // Query children for each parent
      for (const parentId of parentIds) {
        const query = `SELECT [System.Id] FROM WorkItemLinks WHERE ([Source].[System.Id] = ${parentId}) AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') ORDER BY [System.Id] MODE (MustContain)`;
        
        const wiqlBody = { query };
        const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.1`;

        // Execute WIQL query
        writeFileSync(tempFile, JSON.stringify(wiqlBody), 'utf8');
        const curlCommand = `curl -s -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d @${tempFile} "${url}"`;
        const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const wiqlResult = JSON.parse(response);

        // Extract target (child) work item IDs from the link results
        if (wiqlResult.workItemRelations) {
          wiqlResult.workItemRelations.forEach((relation: any) => {
            if (relation.target?.id && relation.target.id !== parentId) {
              allChildIds.add(relation.target.id);
            }
          });
        }
        
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
    } finally {
      // Clean up temporary file
      try {
        unlinkSync(tempFile);
      } catch (cleanupError) {
        logger.warn(`Failed to delete temporary WIQL file ${tempFile}`, cleanupError);
      }
    }
  }

  /**
   * Get Azure DevOps PAT token from Azure CLI
   */
  private getAzureDevOpsToken(): string {
    try {
      const result = execSync(
        `az account get-access-token --resource ${AZURE_DEVOPS_RESOURCE_ID} --query accessToken -o tsv`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return result.trim();
    } catch (error) {
      throw new Error('Failed to authenticate with Azure DevOps. Please ensure you are logged in with: az login');
    }
  }

  /**
   * Query work items by area path using WIQL
   */
  private async queryWorkItemsByAreaPath(
    organization: string,
    project: string,
    areaPath: string,
    token: string,
    includeChildAreas?: boolean,
    maxItems?: number,
    filterByType?: string[],
    excludeStates?: string[]
  ): Promise<number[]> {
    const tempFile = join(tmpdir(), `ado-wiql-${Date.now()}.json`);
    
    try {
      // Build WIQL query
      const areaClause = includeChildAreas 
        ? `[System.AreaPath] UNDER '${areaPath}'` 
        : `[System.AreaPath] = '${areaPath}'`;
      
      const typeFilter = filterByType && filterByType.length > 0
        ? ` AND [System.WorkItemType] IN (${filterByType.map(t => `'${t}'`).join(',')})`
        : '';
      
      const stateFilter = excludeStates && excludeStates.length > 0
        ? ` AND [System.State] NOT IN (${excludeStates.map(s => `'${s}'`).join(',')})`
        : '';

      const query = `SELECT [System.Id] FROM WorkItems WHERE ${areaClause}${typeFilter}${stateFilter} ORDER BY [System.Id] DESC`;

      const wiqlBody = { query };
      const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.1`;

      // Execute WIQL query using curl with temporary file to avoid shell escaping issues
      writeFileSync(tempFile, JSON.stringify(wiqlBody), 'utf8');
      const curlCommand = `curl -s -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d @${tempFile} "${url}"`;
      const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const wiqlResult = JSON.parse(response);

      if (!wiqlResult.workItems) {
        return [];
      }

      const ids = wiqlResult.workItems.map((wi: any) => wi.id);
      return ids.slice(0, maxItems || 50);

    } catch (error) {
      logger.error('WIQL query failed', error);
      throw new Error(`Failed to query work items: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up temporary file
      try {
        unlinkSync(tempFile);
      } catch (cleanupError) {
        logger.warn(`Failed to delete temporary WIQL file ${tempFile}`, cleanupError);
      }
    }
  }

  /**
   * Fetch detailed work item information including parent relationships
   */
  private async fetchWorkItemDetails(
    organization: string,
    project: string,
    workItemIds: number[],
    token: string
  ): Promise<WorkItemHierarchyInfo[]> {
    try {
      const ids = workItemIds.join(',');
      const fields = [
        'System.Id',
        'System.Title',
        'System.WorkItemType',
        'System.State',
        'System.AreaPath',
        'System.AssignedTo',
        'System.Description'
      ].join(',');

      const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems?ids=${ids}&fields=${fields}&$expand=relations&api-version=7.1`;

      const curlCommand = `curl -s -H "Authorization: Bearer ${token}" "${url}"`;
      const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const result = JSON.parse(response);

      if (!result.value) {
        return [];
      }

      // Build a map of work item IDs to titles for parent lookups
      const idToTitleMap = new Map<number, string>();
      result.value.forEach((wi: any) => {
        idToTitleMap.set(wi.id, wi.fields['System.Title']);
      });

      return result.value.map((wi: any) => {
        // Find parent relationship
        const parentRelation = wi.relations?.find((rel: any) => 
          rel.rel === 'System.LinkTypes.Hierarchy-Reverse'
        );
        
        const parentId = parentRelation 
          ? parseInt(parentRelation.url.split('/').pop())
          : undefined;

        const parentTitle = parentId ? idToTitleMap.get(parentId) : undefined;

        return {
          id: wi.id,
          title: wi.fields['System.Title'],
          type: wi.fields['System.WorkItemType'],
          state: wi.fields['System.State'],
          currentParentId: parentId,
          currentParentTitle: parentTitle,
          areaPath: wi.fields['System.AreaPath'],
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

    const aiResult = await this.samplingClient.createMessage({
      systemPromptName,
      userContent,
      maxTokens: 2000,
      temperature: 0.3
    });

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
