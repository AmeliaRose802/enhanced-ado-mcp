/**
 * Handler for wit-backlog-cleanup-analyzer tool
 * AI-powered backlog analysis for stale, incomplete, or problematic work items
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import type { MCPServer, MCPServerLike } from "../../../types/mcp.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSuccessResponse, buildErrorResponse } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { getRequiredConfig } from "../../../config/config.js";
import { queryHandleService } from "../../query-handle-service.js";
import { escapeAreaPath } from "../../../utils/work-item-parser.js";

interface BacklogCleanupArgs {
  areaPath?: string;
  stalenessThresholdDays?: number;
  includeSubAreas?: boolean;
  includeQualityChecks?: boolean;
  includeMetadataChecks?: boolean;
  maxResults?: number;
  returnQueryHandle?: boolean;
  organization?: string;
  project?: string;
}

interface CleanupIssue {
  workItemId: number;
  title: string;
  type: string;
  state: string;
  issues: string[];
  severity: 'critical' | 'warning' | 'info';
  daysSinceChange?: number;
}

export async function handleBacklogCleanupAnalyzer(
  config: ToolConfig, 
  args: unknown,
  server?: MCPServer | MCPServerLike
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
    const {
      areaPath = requiredConfig.defaultAreaPath,
      stalenessThresholdDays = 180,
      includeSubAreas = true,
      includeQualityChecks = true,
      includeMetadataChecks = true,
      maxResults = 500,
      returnQueryHandle = true,
      organization = requiredConfig.organization,
      project = requiredConfig.project
    } = parsed.data as BacklogCleanupArgs;

    // Validate required configuration
    if (!organization || organization.trim() === '') {
      return buildErrorResponse(
        'Organization is required for backlog cleanup analysis. Provide organization parameter or configure server with organization argument.',
        { source: 'backlog-cleanup-analyzer', hint: 'Usage: enhanced-ado-msp <organization> <project> [options]' }
      );
    }

    if (!project || project.trim() === '') {
      return buildErrorResponse(
        'Project is required for backlog cleanup analysis. Provide project parameter or configure server with project argument.',
        { source: 'backlog-cleanup-analyzer', hint: 'Usage: enhanced-ado-msp <organization> <project> [options]' }
      );
    }

    // Validate area path is provided - backlog cleanup requires scoping to avoid scanning entire project
    if (!areaPath) {
      return buildErrorResponse(
        'Area path is required for backlog cleanup analysis. Provide areaPath parameter or configure server with --area-path flag.',
        { source: 'backlog-cleanup-analyzer', hint: 'Use wit-list-area-paths to discover valid area paths for your project' }
      );
    }

    logger.debug(`Analyzing backlog for cleanup: ${areaPath}`);

    // Build WIQL query for backlog items
    const escapedAreaPath = escapeAreaPath(areaPath);
    const areaClause = includeSubAreas 
      ? `[System.AreaPath] UNDER '${escapedAreaPath}'` 
      : `[System.AreaPath] = '${escapedAreaPath}'`;

    const wiqlQuery = `
      SELECT [System.Id]
      FROM WorkItems
      WHERE ${areaClause}
        AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story', 'Feature', 'Epic', 'Bug')
        AND [System.State] NOT IN ('Removed', 'Closed', 'Done', 'Completed')
      ORDER BY [System.ChangedDate] ASC
    `;

    // Execute query with extra fields for analysis
    const fieldsToInclude = [
      'System.Title',
      'System.State',
      'System.WorkItemType',
      'System.Description',
      'System.AssignedTo',
      'System.IterationPath',
      'Microsoft.VSTS.Common.Priority',
      'System.Tags',
      'System.ChangedDate',
      'System.CreatedDate',
      'Microsoft.VSTS.Common.AcceptanceCriteria',
      'Microsoft.VSTS.Scheduling.StoryPoints'
    ];

    const result = await queryWorkItemsByWiql({
      wiqlQuery,
      organization,
      project,
      includeFields: fieldsToInclude,
      maxResults,
      includeSubstantiveChange: true,
      staleThresholdDays: stalenessThresholdDays
    });

    logger.debug(`Analyzed ${result.workItems.length} work items`);

    // Analyze work items for issues
    const issues: CleanupIssue[] = [];
    const now = new Date();

    for (const item of result.workItems) {
      const itemIssues: string[] = [];
      let severity: 'critical' | 'warning' | 'info' = 'info';

      const changedDate = item.additionalFields?.['System.ChangedDate'] as string | undefined;
      const daysSinceChange = changedDate 
        ? Math.floor((now.getTime() - new Date(changedDate).getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      // Check staleness
      if (daysSinceChange && daysSinceChange > stalenessThresholdDays) {
        itemIssues.push(`Stale: No updates in ${daysSinceChange} days`);
        severity = 'warning';
      }

      // Quality checks
      if (includeQualityChecks) {
        const description = item.additionalFields?.['System.Description'] as string | undefined;
        const acceptanceCriteria = item.additionalFields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string | undefined;
        const storyPoints = item.additionalFields?.['Microsoft.VSTS.Scheduling.StoryPoints'];

        if (!description || description.trim().length === 0) {
          itemIssues.push('Missing description');
          severity = 'warning';
        }

        if (!acceptanceCriteria || acceptanceCriteria.trim().length === 0) {
          if (item.type === 'Product Backlog Item' || item.type === 'User Story') {
            itemIssues.push('Missing acceptance criteria');
            severity = 'warning';
          }
        }

        if (storyPoints === undefined || storyPoints === null) {
          if (item.type === 'Product Backlog Item' || item.type === 'User Story') {
            itemIssues.push('Missing story points');
          }
        }
      }

      // Metadata checks
      if (includeMetadataChecks) {
        const assignedTo = item.additionalFields?.['System.AssignedTo'];
        const iterationPath = item.additionalFields?.['System.IterationPath'] as string | undefined;

        if (!assignedTo) {
          if (item.state === 'Active' || item.state === 'Committed') {
            itemIssues.push('Unassigned despite being active/committed');
            severity = 'critical';
          } else {
            itemIssues.push('Unassigned');
          }
        }

        if (!iterationPath || iterationPath === project) {
          itemIssues.push('Not assigned to specific iteration');
        }

        const actualPriority = item.additionalFields?.['Microsoft.VSTS.Common.Priority'];
        if (actualPriority === undefined || actualPriority === null) {
          itemIssues.push('Missing priority');
        }
      }

      // Add to issues list if any problems found
      if (itemIssues.length > 0) {
        issues.push({
          workItemId: item.id,
          title: item.title,
          type: item.type,
          state: item.state,
          issues: itemIssues,
          severity,
          daysSinceChange
        });
      }
    }

    // Categorize issues by severity
    const categorized = {
      critical: issues.filter(i => i.severity === 'critical'),
      warning: issues.filter(i => i.severity === 'warning'),
      info: issues.filter(i => i.severity === 'info')
    };

    // Generate query handles if requested - one for each category plus one for all items
    let queryHandle: string | undefined;
    const categoryHandles: Record<string, string> = {};
    
    if (returnQueryHandle && result.workItems.length > 0) {
      // Build work item context map for all items
      const workItemContextMap = new Map<number, any>();
      for (const item of result.workItems) {
        workItemContextMap.set(item.id, {
          title: item.title,
          state: item.state,
          type: item.type,
          daysInactive: item.additionalFields?.['daysInactive'] as number | undefined,
          changedDate: item.additionalFields?.['System.ChangedDate'] as string | undefined,
          tags: item.additionalFields?.['System.Tags'] as string
        });
      }

      // Store handle for all items (backward compatibility)
      queryHandle = queryHandleService.storeQuery(
        result.workItems.map(i => i.id),
        wiqlQuery,
        {
          project,
          queryType: 'backlog-cleanup'
        },
        undefined,
        workItemContextMap,
        {
          includeSubstantiveChange: true,
          stalenessThresholdDays,
          analysisTimestamp: new Date().toISOString()
        }
      );

      // Store separate handles for each category with issues
      if (categorized.critical.length > 0) {
        const criticalIds = categorized.critical.map(i => i.workItemId);
        const criticalContextMap = new Map<number, any>();
        criticalIds.forEach(id => {
          const context = workItemContextMap.get(id);
          if (context) criticalContextMap.set(id, context);
        });
        
        categoryHandles.critical = queryHandleService.storeQuery(
          criticalIds,
          wiqlQuery,
          {
            project,
            queryType: 'backlog-cleanup-critical'
          },
          undefined,
          criticalContextMap,
          {
            includeSubstantiveChange: true,
            stalenessThresholdDays,
            analysisTimestamp: new Date().toISOString()
          }
        );
      }

      if (categorized.warning.length > 0) {
        const warningIds = categorized.warning.map(i => i.workItemId);
        const warningContextMap = new Map<number, any>();
        warningIds.forEach(id => {
          const context = workItemContextMap.get(id);
          if (context) warningContextMap.set(id, context);
        });
        
        categoryHandles.warning = queryHandleService.storeQuery(
          warningIds,
          wiqlQuery,
          {
            project,
            queryType: 'backlog-cleanup-warning'
          },
          undefined,
          warningContextMap,
          {
            includeSubstantiveChange: true,
            stalenessThresholdDays,
            analysisTimestamp: new Date().toISOString()
          }
        );
      }

      if (categorized.info.length > 0) {
        const infoIds = categorized.info.map(i => i.workItemId);
        const infoContextMap = new Map<number, any>();
        infoIds.forEach(id => {
          const context = workItemContextMap.get(id);
          if (context) infoContextMap.set(id, context);
        });
        
        categoryHandles.info = queryHandleService.storeQuery(
          infoIds,
          wiqlQuery,
          {
            project,
            queryType: 'backlog-cleanup-info'
          },
          undefined,
          infoContextMap,
          {
            includeSubstantiveChange: true,
            stalenessThresholdDays,
            analysisTimestamp: new Date().toISOString()
          }
        );
      }
    }

    return buildSuccessResponse(
      {
        summary: {
          totalAnalyzed: result.workItems.length,
          totalIssues: issues.length,
          critical: categorized.critical.length,
          warning: categorized.warning.length,
          info: categorized.info.length,
          stalenessThresholdDays,
          areaPath
        },
        issues: categorized,
        queryHandle,
        categoryHandles: Object.keys(categoryHandles).length > 0 ? categoryHandles : undefined,
        recommendations: [
          categorized.critical.length > 0 ? 'Address critical issues immediately (unassigned active items)' : null,
          categorized.warning.length > 0 ? 'Review warning items for potential cleanup or updates' : null,
          issues.filter(i => i.daysSinceChange && i.daysSinceChange > stalenessThresholdDays * 2).length > 0 
            ? 'Consider closing or archiving extremely stale items' : null
        ].filter(Boolean)
      },
      { 
        source: "backlog-cleanup-analyzer",
        issueCount: issues.length,
        queryHandle: queryHandle || null,
        categoryHandleCount: Object.keys(categoryHandles).length
      }
    );

  } catch (error) {
    logger.error('Backlog cleanup analyzer error:', error);
    return buildErrorResponse(
      error as Error,
      { source: "backlog-cleanup-analyzer" }
    );
  }
}
