/**
 * Generate Burndown Chart Handler
 * 
 * Generates burndown charts from sprint/iteration data.
 * Supports ASCII art, SVG, and data-only export formats.
 */

import { z } from 'zod';
import { logger } from '../../../utils/logger.js';
import { loadConfiguration } from '../../../config/config.js';
import { createWorkItemRepository } from '../../../repositories/work-item.repository.js';
import { queryHandleService } from '../../../services/query-handle-service.js';
import { generateBurndownChart } from '../../../services/chart-service.js';
import type { ToolExecutionResult } from '../../../types/index.js';
import type { SprintMetadata, ChartFormat, WorkUnit, BurndownChartOptions } from '../../../types/charts.js';

const generateBurndownChartSchema = z.object({
  iterationPath: z.string().optional(),
  queryHandle: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['ascii', 'svg', 'data']).default('ascii'),
  workUnit: z.enum(['story-points', 'hours', 'count']).default('story-points'),
  showIdealLine: z.boolean().default(true),
  showTrendLine: z.boolean().default(true),
  includeWeekends: z.boolean().default(false),
  title: z.string().optional(),
  width: z.number().min(400).max(2000).default(800),
  height: z.number().min(300).max(1500).default(400),
  organization: z.string().optional(),
  project: z.string().optional()
}).refine(
  (data) => data.iterationPath || data.queryHandle || (data.startDate && data.endDate),
  { message: "Must provide either iterationPath, queryHandle, or both startDate and endDate" }
);

export async function handleGenerateBurndownChart(args: unknown): Promise<ToolExecutionResult> {
  logger.debug('[handleGenerateBurndownChart] Starting burndown chart generation');
  
  try {
    const input = generateBurndownChartSchema.parse(args);
    
    // Get configuration
    const config = loadConfiguration();
    const organization = input.organization || config.azureDevOps.organization;
    const project = input.project || config.azureDevOps.project;
    
    if (!organization || !project) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'generate-burndown-chart',
          timestamp: new Date().toISOString()
        },
        errors: ['Organization and project must be configured or provided'],
        warnings: []
      };
    }
    
    // Get work items
    let workItems: any[];
    let sprint: SprintMetadata;
    
    if (input.queryHandle) {
      // Get work items from query handle
      logger.debug(`[handleGenerateBurndownChart] Using query handle: ${input.queryHandle}`);
      
      const workItemIds = queryHandleService.getWorkItemIds(input.queryHandle);
      if (!workItemIds) {
        return {
          success: false,
          data: null,
          metadata: {
            tool: 'generate-burndown-chart',
            timestamp: new Date().toISOString()
          },
          errors: [`Query handle not found or expired: ${input.queryHandle}`],
          warnings: []
        };
      }
      
      // Fetch full work items
      const qhRepository = createWorkItemRepository(organization, project);
      workItems = await Promise.all(
        workItemIds.map(id => qhRepository.getById(id, [
          'System.Id',
          'System.Title',
          'System.State',
          'System.WorkItemType',
          'System.IterationPath',
          'System.CreatedDate',
          'Microsoft.VSTS.Common.ClosedDate',
          'Microsoft.VSTS.Common.StateChangeDate',
          'Microsoft.VSTS.Scheduling.StoryPoints',
          'Microsoft.VSTS.Scheduling.RemainingWork'
        ]))
      );
      
      // Extract sprint metadata from work items
      const iterationPath = input.iterationPath || 
        workItems[0]?.fields?.['System.IterationPath'] as string;
      
      if (!iterationPath) {
        return {
          success: false,
          data: null,
          metadata: {
            tool: 'generate-burndown-chart',
            timestamp: new Date().toISOString()
          },
          errors: ['Could not determine iteration path from work items. Please provide iterationPath parameter.'],
          warnings: []
        };
      }
      
      // Get iteration dates
      const startDate = input.startDate || findEarliestDate(workItems);
      const endDate = input.endDate || findLatestDate(workItems);
      
      sprint = {
        name: iterationPath.split('\\').pop() || iterationPath,
        startDate,
        endDate,
        iterationPath
      };
    } else if (input.iterationPath) {
      // Query work items by iteration path
      logger.debug(`[handleGenerateBurndownChart] Querying iteration: ${input.iterationPath}`);
      
      const ipRepository = createWorkItemRepository(organization, project);
      const wiqlQuery = `
        SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], 
               [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Scheduling.RemainingWork],
               [System.CreatedDate], [Microsoft.VSTS.Common.ClosedDate], [Microsoft.VSTS.Common.StateChangeDate]
        FROM WorkItems 
        WHERE [System.IterationPath] UNDER '${input.iterationPath}'
        ORDER BY [System.CreatedDate] ASC
      `;
      
      const result = await ipRepository.executeWiql(wiqlQuery);
      
      if (!result.workItems || result.workItems.length === 0) {
        return {
          success: false,
          data: null,
          metadata: {
            tool: 'generate-burndown-chart',
            timestamp: new Date().toISOString()
          },
          errors: [`No work items found for iteration: ${input.iterationPath}`],
          warnings: []
        };
      }
      
      // Fetch full work items
      const workItemIds = result.workItems.map((wi: any) => wi.id);
      workItems = await Promise.all(
        workItemIds.map((id: number) => ipRepository.getById(id, [
          'System.Id',
          'System.Title',
          'System.State',
          'System.WorkItemType',
          'System.CreatedDate',
          'Microsoft.VSTS.Common.ClosedDate',
          'Microsoft.VSTS.Common.StateChangeDate',
          'Microsoft.VSTS.Scheduling.StoryPoints',
          'Microsoft.VSTS.Scheduling.RemainingWork'
        ]))
      );
      
      // Get iteration metadata
      const startDate = input.startDate || findEarliestDate(workItems);
      const endDate = input.endDate || new Date().toISOString().split('T')[0];
      
      sprint = {
        name: input.iterationPath.split('\\').pop() || input.iterationPath,
        startDate,
        endDate,
        iterationPath: input.iterationPath
      };
    } else {
      // Use date range
      logger.debug(`[handleGenerateBurndownChart] Using date range: ${input.startDate} to ${input.endDate}`);
      
      const drRepository = createWorkItemRepository(organization, project);
      const wiqlQuery = `
        SELECT [System.Id]
        FROM WorkItems 
        WHERE [System.CreatedDate] <= '${input.endDate}'
        ORDER BY [System.CreatedDate] ASC
      `;
      
      const result = await drRepository.executeWiql(wiqlQuery);
      
      if (!result.workItems || result.workItems.length === 0) {
        return {
          success: false,
          data: null,
          metadata: {
            tool: 'generate-burndown-chart',
            timestamp: new Date().toISOString()
          },
          errors: ['No work items found for the specified date range'],
          warnings: []
        };
      }
      
      // Fetch full work items
      const workItemIds = result.workItems.map((wi: any) => wi.id);
      workItems = await Promise.all(
        workItemIds.map((id: number) => drRepository.getById(id, [
          'System.Id',
          'System.Title',
          'System.State',
          'System.WorkItemType',
          'System.CreatedDate',
          'Microsoft.VSTS.Common.ClosedDate',
          'Microsoft.VSTS.Common.StateChangeDate',
          'Microsoft.VSTS.Scheduling.StoryPoints',
          'Microsoft.VSTS.Scheduling.RemainingWork'
        ]))
      );
      
      sprint = {
        name: 'Custom Range',
        startDate: input.startDate!,
        endDate: input.endDate!,
        iterationPath: ''
      };
    }
    
    // Generate burndown chart
    const options: BurndownChartOptions = {
      showIdealLine: input.showIdealLine,
      showTrendLine: input.showTrendLine,
      includeWeekends: input.includeWeekends,
      title: input.title,
      width: input.width,
      height: input.height
    };
    
    const result = await generateBurndownChart(
      workItems,
      sprint,
      input.format as ChartFormat,
      input.workUnit as WorkUnit,
      options
    );
    
    if (!result.success) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'generate-burndown-chart',
          timestamp: new Date().toISOString()
        },
        errors: result.errors || ['Failed to generate burndown chart'],
        warnings: result.warnings || []
      };
    }
    
    logger.debug(`[handleGenerateBurndownChart] Successfully generated ${input.format} burndown chart`);
    
    return {
      success: true,
      data: {
        chart: result.chart,
        calculation: result.data,
        metadata: result.metadata,
        sprint: {
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          iterationPath: sprint.iterationPath,
          workItemCount: workItems.length
        },
        instructions: input.format === 'ascii' 
          ? 'ASCII chart rendered. Best viewed in monospace font.'
          : input.format === 'svg'
          ? 'SVG chart generated. Save to .svg file to view in browser or image viewer.'
          : 'Chart data returned in JSON format. Use for custom rendering or analysis.'
      },
      metadata: {
        tool: 'generate-burndown-chart',
        timestamp: new Date().toISOString(),
        format: input.format,
        workUnit: input.workUnit
      },
      errors: [],
      warnings: result.warnings || []
    };
  } catch (error) {
    logger.error('[handleGenerateBurndownChart] Error:', 
      error instanceof Error ? { message: error.message } : { error: String(error) });
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'generate-burndown-chart',
          timestamp: new Date().toISOString()
        },
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: []
      };
    }
    
    return {
      success: false,
      data: null,
      metadata: {
        tool: 'generate-burndown-chart',
        timestamp: new Date().toISOString()
      },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Find earliest created date from work items
 */
function findEarliestDate(workItems: any[]): string {
  const dates = workItems
    .map(wi => wi.fields?.['System.CreatedDate'] as string)
    .filter(Boolean)
    .sort();
  
  return dates[0] ? dates[0].split('T')[0] : new Date().toISOString().split('T')[0];
}

/**
 * Find latest date from work items (closed or current date)
 */
function findLatestDate(workItems: any[]): string {
  const closedDates = workItems
    .map(wi => wi.fields?.['Microsoft.VSTS.Common.ClosedDate'] as string)
    .filter(Boolean)
    .sort()
    .reverse();
  
  return closedDates[0] ? closedDates[0].split('T')[0] : new Date().toISOString().split('T')[0];
}
