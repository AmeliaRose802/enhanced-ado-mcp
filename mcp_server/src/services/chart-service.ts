/**
 * Chart Generation Service
 * 
 * Generates burndown, burnup, velocity, and cumulative flow diagrams
 * from Azure DevOps work item data. Supports ASCII art, SVG, and data-only formats.
 */

import { logger, errorToContext } from '../utils/logger.js';
import type { ADOWorkItem } from '../types/ado.js';
import type {
  ChartDataPoint,
  ChartSeries,
  DailySnapshot,
  SprintMetadata,
  ChartCalculation,
  ChartRenderResult,
  BurndownChartOptions,
  BurnupChartOptions,
  VelocityChartOptions,
  CFDOptions,
  ChartFormat,
  WorkUnit,
  VelocityMetric,
  CFDStateData,
  ASCII_CHART_CHARS
} from '../types/charts.js';

/**
 * Calculate working days between two dates (excludes weekends)
 */
function calculateWorkingDays(startDate: Date, endDate: Date, includeWeekends: boolean = false): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Get all dates between start and end (inclusive)
 */
function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse date string (handles multiple formats)
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Get work unit value from work item
 */
function getWorkValue(workItem: ADOWorkItem, workUnit: WorkUnit): number {
  switch (workUnit) {
    case 'story-points':
      return (workItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] as number) || 0;
    case 'hours':
      return (workItem.fields['Microsoft.VSTS.Scheduling.RemainingWork'] as number) || 0;
    case 'count':
      return 1;
    default:
      return 1;
  }
}

/**
 * Calculate daily snapshots from work item history
 */
export async function calculateDailySnapshots(
  workItems: ADOWorkItem[],
  startDate: Date,
  endDate: Date,
  workUnit: WorkUnit = 'story-points'
): Promise<DailySnapshot[]> {
  logger.debug(`[calculateDailySnapshots] Processing ${workItems.length} work items from ${formatDate(startDate)} to ${formatDate(endDate)}`);
  
  const snapshots: DailySnapshot[] = [];
  const dates = getDateRange(startDate, endDate);
  
  for (const date of dates) {
    const dateStr = formatDate(date);
    const snapshot: DailySnapshot = {
      date: dateStr,
      remaining: 0,
      completed: 0,
      scope: 0,
      added: 0,
      removed: 0,
      byState: {}
    };
    
    // Calculate state for each work item on this date
    for (const workItem of workItems) {
      const createdDate = parseDate(workItem.fields['System.CreatedDate'] as string);
      const closedDate = workItem.fields['Microsoft.VSTS.Common.ClosedDate'] 
        ? parseDate(workItem.fields['Microsoft.VSTS.Common.ClosedDate'] as string)
        : null;
      const removedDate = workItem.fields['Microsoft.VSTS.Common.StateChangeDate']
        ? parseDate(workItem.fields['Microsoft.VSTS.Common.StateChangeDate'] as string)
        : null;
      const currentState = workItem.fields['System.State'] as string;
      
      // Check if work item exists on this date
      if (createdDate > date) {
        continue; // Not created yet
      }
      
      const workValue = getWorkValue(workItem, workUnit);
      
      // Check if added on this date
      if (formatDate(createdDate) === dateStr) {
        snapshot.added += workValue;
      }
      
      // Check if removed/cut on this date
      if (currentState === 'Removed' || currentState === 'Cut') {
        if (removedDate && formatDate(removedDate) === dateStr) {
          snapshot.removed += workValue;
        }
        continue; // Don't count in scope
      }
      
      // Add to scope
      snapshot.scope += workValue;
      
      // Check if completed
      if (closedDate && closedDate <= date) {
        snapshot.completed += workValue;
      } else {
        snapshot.remaining += workValue;
      }
      
      // Track by state
      const state = currentState;
      snapshot.byState[state] = (snapshot.byState[state] || 0) + workValue;
    }
    
    snapshots.push(snapshot);
  }
  
  logger.debug(`[calculateDailySnapshots] Generated ${snapshots.length} daily snapshots`);
  return snapshots;
}

/**
 * Calculate ideal burndown line
 */
export function calculateIdealLine(
  startDate: Date,
  endDate: Date,
  startValue: number,
  includeWeekends: boolean = false
): ChartDataPoint[] {
  const workingDays = calculateWorkingDays(startDate, endDate, includeWeekends);
  const dailyBurnRate = startValue / workingDays;
  
  const idealLine: ChartDataPoint[] = [];
  const dates = getDateRange(startDate, endDate);
  let currentValue = startValue;
  
  for (const date of dates) {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    idealLine.push({
      date: formatDate(date),
      value: Math.max(0, Math.round(currentValue))
    });
    
    // Burn down only on working days
    if (includeWeekends || !isWeekend) {
      currentValue -= dailyBurnRate;
    }
  }
  
  return idealLine;
}

/**
 * Calculate trend line from actual data
 */
export function calculateTrendLine(
  actualData: ChartDataPoint[],
  projectionDays: number = 0
): ChartDataPoint[] {
  if (actualData.length < 2) {
    return actualData;
  }
  
  // Linear regression
  const n = actualData.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  actualData.forEach((point, index) => {
    sumX += index;
    sumY += point.value;
    sumXY += index * point.value;
    sumX2 += index * index;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Generate trend line
  const trendLine: ChartDataPoint[] = [];
  
  for (let i = 0; i < actualData.length + projectionDays; i++) {
    const value = slope * i + intercept;
    const dateIndex = Math.min(i, actualData.length - 1);
    
    // For projection, add days to last date
    let date: string;
    if (i < actualData.length) {
      date = actualData[i].date;
    } else {
      const lastDate = parseDate(actualData[actualData.length - 1].date);
      const projDate = new Date(lastDate);
      projDate.setDate(projDate.getDate() + (i - actualData.length + 1));
      date = formatDate(projDate);
    }
    
    trendLine.push({
      date,
      value: Math.max(0, Math.round(value))
    });
  }
  
  return trendLine;
}

/**
 * Generate burndown chart calculation
 */
export async function generateBurndownCalculation(
  workItems: ADOWorkItem[],
  sprint: SprintMetadata,
  workUnit: WorkUnit = 'story-points',
  options: BurndownChartOptions = {}
): Promise<ChartCalculation> {
  logger.debug(`[generateBurndownCalculation] Generating burndown for sprint: ${sprint.name}`);
  
  const startDate = parseDate(sprint.startDate);
  const endDate = parseDate(sprint.endDate);
  
  // Calculate daily snapshots
  const snapshots = await calculateDailySnapshots(workItems, startDate, endDate, workUnit);
  
  // Calculate actual line (remaining work)
  const actualLine: ChartDataPoint[] = snapshots.map(s => ({
    date: s.date,
    value: s.remaining
  }));
  
  // Calculate ideal line
  const startValue = snapshots[0]?.scope || 0;
  const idealLine = options.showIdealLine !== false
    ? calculateIdealLine(startDate, endDate, startValue, options.includeWeekends)
    : undefined;
  
  // Calculate trend line
  const trendLine = options.showTrendLine
    ? calculateTrendLine(actualLine, 5) // Project 5 days ahead
    : undefined;
  
  // Calculate statistics
  const endValue = actualLine[actualLine.length - 1]?.value || 0;
  const totalDays = snapshots.length;
  const avgDailyVelocity = totalDays > 0 ? (startValue - endValue) / totalDays : 0;
  
  // Project completion date
  let projectedCompletion: string | undefined;
  if (trendLine && avgDailyVelocity > 0) {
    const daysToCompletion = Math.ceil(endValue / avgDailyVelocity);
    const completionDate = new Date(endDate);
    completionDate.setDate(completionDate.getDate() + daysToCompletion);
    projectedCompletion = formatDate(completionDate);
  }
  
  // Calculate scope changes
  const scopeChanges = snapshots.reduce((sum, s) => sum + s.added + s.removed, 0);
  
  return {
    snapshots,
    idealLine,
    actualLine,
    trendLine,
    sprint,
    statistics: {
      startValue,
      endValue,
      avgDailyVelocity,
      projectedCompletion,
      scopeChanges
    }
  };
}

/**
 * Generate burnup chart calculation
 */
export async function generateBurnupCalculation(
  workItems: ADOWorkItem[],
  sprint: SprintMetadata,
  workUnit: WorkUnit = 'story-points',
  options: BurnupChartOptions = {}
): Promise<ChartCalculation> {
  logger.debug(`[generateBurnupCalculation] Generating burnup for sprint: ${sprint.name}`);
  
  const startDate = parseDate(sprint.startDate);
  const endDate = parseDate(sprint.endDate);
  
  // Calculate daily snapshots
  const snapshots = await calculateDailySnapshots(workItems, startDate, endDate, workUnit);
  
  // Calculate actual line (completed work)
  const actualLine: ChartDataPoint[] = snapshots.map(s => ({
    date: s.date,
    value: s.completed
  }));
  
  // Calculate scope line
  const scopeLine: ChartDataPoint[] = snapshots.map(s => ({
    date: s.date,
    value: s.scope
  }));
  
  // Calculate ideal line (based on final scope)
  const startValue = 0;
  const endValue = snapshots[snapshots.length - 1]?.scope || 0;
  const idealLine = options.showIdealLine !== false
    ? calculateIdealLine(startDate, endDate, endValue, options.includeWeekends).map(p => ({
        date: p.date,
        value: endValue - p.value // Invert for burnup
      }))
    : undefined;
  
  // Calculate statistics
  const completedValue = actualLine[actualLine.length - 1]?.value || 0;
  const totalDays = snapshots.length;
  const avgDailyVelocity = totalDays > 0 ? completedValue / totalDays : 0;
  
  // Calculate scope changes
  const scopeChanges = snapshots.reduce((sum, s) => sum + s.added + s.removed, 0);
  
  return {
    snapshots,
    idealLine,
    actualLine,
    scopeLine,
    sprint,
    statistics: {
      startValue,
      endValue: completedValue,
      avgDailyVelocity,
      scopeChanges
    }
  };
}

/**
 * Render chart as ASCII art
 */
export function renderASCIIChart(
  series: ChartSeries[],
  options: BurndownChartOptions | BurnupChartOptions = {}
): string {
  const title = options.title || 'Chart';
  const yLabel = options.yLabel || 'Value';
  const width = 60;
  const height = 10;
  
  // Find min/max values
  let maxValue = 0;
  series.forEach(s => {
    s.data.forEach(point => {
      maxValue = Math.max(maxValue, point.value);
    });
  });
  
  // Build chart lines
  const lines: string[] = [];
  
  // Title
  lines.push(title);
  lines.push('');
  
  // Y-axis and data
  const yStep = maxValue / height;
  
  for (let y = height; y >= 0; y--) {
    const yValue = Math.round(y * yStep);
    const yValueStr = yValue.toString().padStart(4);
    
    let line = `${yValueStr} │`;
    
    // Plot points for each series
    for (let x = 0; x < width; x++) {
      const dataIndex = Math.floor((x / width) * (series[0]?.data.length || 1));
      let plotChar = ' ';
      
      // Check each series for a point at this position
      for (const s of series) {
        if (dataIndex < s.data.length) {
          const point = s.data[dataIndex];
          const pointY = Math.round(point.value / yStep);
          
          if (pointY === y) {
            // Different characters for different series
            if (s.name.includes('Ideal')) {
              plotChar = '─';
            } else if (s.name.includes('Actual')) {
              plotChar = '•';
            } else if (s.name.includes('Scope')) {
              plotChar = '─';
            } else {
              plotChar = '•';
            }
            break;
          }
        }
      }
      
      line += plotChar;
    }
    
    lines.push(line);
  }
  
  // X-axis
  lines.push(`   0 │${'─'.repeat(width)}`);
  lines.push(`     ├${'┬'.repeat(width / 10).padEnd(width, '─')}→`);
  
  // X-axis labels (show start, middle, end dates)
  if (series.length > 0 && series[0].data.length > 0) {
    const startDate = series[0].data[0].date.slice(5); // MM-DD
    const midDate = series[0].data[Math.floor(series[0].data.length / 2)]?.date.slice(5) || '';
    const endDate = series[0].data[series[0].data.length - 1].date.slice(5);
    
    lines.push(`     ${startDate.padEnd(20)}${midDate.padEnd(20)}${endDate}`);
  }
  
  // Legend
  if (options.showLegend !== false) {
    lines.push('');
    series.forEach(s => {
      const symbol = s.name.includes('Ideal') ? '─────' : '•••••';
      lines.push(`  ${symbol} ${s.name}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Render chart as SVG
 */
export function renderSVGChart(
  series: ChartSeries[],
  options: BurndownChartOptions | BurnupChartOptions = {}
): string {
  const width = options.width || 800;
  const height = options.height || 400;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  
  const title = options.title || 'Chart';
  const yLabel = options.yLabel || 'Value';
  const xLabel = options.xLabel || 'Date';
  
  // Find min/max values
  let maxValue = 0;
  let dataLength = 0;
  series.forEach(s => {
    dataLength = Math.max(dataLength, s.data.length);
    s.data.forEach(point => {
      maxValue = Math.max(maxValue, point.value);
    });
  });
  
  // Scale functions
  const xScale = (index: number) => padding.left + (index / (dataLength - 1)) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  
  // Build SVG
  const svg: string[] = [];
  svg.push(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);
  svg.push(`  <style>`);
  svg.push(`    .axis { stroke: #333; stroke-width: 2; }`);
  svg.push(`    .grid { stroke: #ddd; stroke-width: 1; stroke-dasharray: 2,2; }`);
  svg.push(`    .label { font-family: Arial; font-size: 12px; fill: #333; }`);
  svg.push(`    .title { font-family: Arial; font-size: 16px; font-weight: bold; fill: #000; }`);
  svg.push(`    .line-ideal { stroke: #999; stroke-width: 2; stroke-dasharray: 5,5; fill: none; }`);
  svg.push(`    .line-actual { stroke: #2196F3; stroke-width: 3; fill: none; }`);
  svg.push(`    .line-scope { stroke: #FF9800; stroke-width: 2; fill: none; }`);
  svg.push(`  </style>`);
  
  // Title
  svg.push(`  <text x="${width / 2}" y="25" text-anchor="middle" class="title">${title}</text>`);
  
  // Grid lines
  if (options.showGrid !== false) {
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * plotHeight;
      svg.push(`  <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid" />`);
    }
  }
  
  // Axes
  svg.push(`  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="axis" />`);
  svg.push(`  <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis" />`);
  
  // Y-axis labels
  for (let i = 0; i <= 5; i++) {
    const value = Math.round((maxValue / 5) * (5 - i));
    const y = padding.top + (i / 5) * plotHeight;
    svg.push(`  <text x="${padding.left - 10}" y="${y + 5}" text-anchor="end" class="label">${value}</text>`);
  }
  
  // Y-axis label
  svg.push(`  <text x="20" y="${height / 2}" text-anchor="middle" transform="rotate(-90 20 ${height / 2})" class="label">${yLabel}</text>`);
  
  // X-axis label
  svg.push(`  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="label">${xLabel}</text>`);
  
  // Plot series
  series.forEach(s => {
    const className = s.name.includes('Ideal') ? 'line-ideal' : 
                     s.name.includes('Actual') ? 'line-actual' : 
                     s.name.includes('Scope') ? 'line-scope' : 'line-actual';
    
    const points = s.data.map((point, index) => 
      `${xScale(index)},${yScale(point.value)}`
    ).join(' ');
    
    svg.push(`  <polyline points="${points}" class="${className}" />`);
  });
  
  // Legend
  if (options.showLegend !== false) {
    const legendY = height - padding.bottom + 40;
    let legendX = padding.left;
    
    series.forEach(s => {
      const className = s.name.includes('Ideal') ? 'line-ideal' : 
                       s.name.includes('Actual') ? 'line-actual' : 
                       s.name.includes('Scope') ? 'line-scope' : 'line-actual';
      
      svg.push(`  <line x1="${legendX}" y1="${legendY}" x2="${legendX + 30}" y2="${legendY}" class="${className}" />`);
      svg.push(`  <text x="${legendX + 35}" y="${legendY + 5}" class="label">${s.name}</text>`);
      
      legendX += 150;
    });
  }
  
  svg.push(`</svg>`);
  
  return svg.join('\n');
}

/**
 * Generate burndown chart
 */
export async function generateBurndownChart(
  workItems: ADOWorkItem[],
  sprint: SprintMetadata,
  format: ChartFormat = 'ascii',
  workUnit: WorkUnit = 'story-points',
  options: BurndownChartOptions = {}
): Promise<ChartRenderResult> {
  try {
    logger.debug(`[generateBurndownChart] Generating ${format} burndown chart for ${workItems.length} work items`);
    
    // Calculate chart data
    const calculation = await generateBurndownCalculation(workItems, sprint, workUnit, options);
    
    // Return data-only format
    if (format === 'data') {
      return {
        success: true,
        data: calculation,
        metadata: {
          format,
          workUnit,
          generatedAt: new Date().toISOString()
        }
      };
    }
    
    // Build series
    const series: ChartSeries[] = [];
    
    if (calculation.actualLine) {
      series.push({
        name: 'Actual',
        data: calculation.actualLine,
        style: 'solid',
        color: '#2196F3'
      });
    }
    
    if (calculation.idealLine) {
      series.push({
        name: 'Ideal',
        data: calculation.idealLine,
        style: 'dashed',
        color: '#999'
      });
    }
    
    if (calculation.trendLine) {
      series.push({
        name: 'Trend',
        data: calculation.trendLine,
        style: 'dotted',
        color: '#FF5722'
      });
    }
    
    // Set default options
    const chartOptions: BurndownChartOptions = {
      title: options.title || `Sprint Burndown (${workUnit})`,
      yLabel: options.yLabel || workUnit === 'story-points' ? 'Story Points' : 
              workUnit === 'hours' ? 'Hours' : 'Work Items',
      xLabel: options.xLabel || 'Date',
      showLegend: options.showLegend !== false,
      showGrid: options.showGrid !== false,
      ...options
    };
    
    // Render chart
    const chart = format === 'ascii' 
      ? renderASCIIChart(series, chartOptions)
      : renderSVGChart(series, chartOptions);
    
    return {
      success: true,
      chart,
      data: calculation,
      metadata: {
        format,
        workUnit,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('[generateBurndownChart] Error:', errorToContext(error));
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * Generate burnup chart
 */
export async function generateBurnupChart(
  workItems: ADOWorkItem[],
  sprint: SprintMetadata,
  format: ChartFormat = 'ascii',
  workUnit: WorkUnit = 'story-points',
  options: BurnupChartOptions = {}
): Promise<ChartRenderResult> {
  try {
    logger.debug(`[generateBurnupChart] Generating ${format} burnup chart for ${workItems.length} work items`);
    
    // Calculate chart data
    const calculation = await generateBurnupCalculation(workItems, sprint, workUnit, options);
    
    // Return data-only format
    if (format === 'data') {
      return {
        success: true,
        data: calculation,
        metadata: {
          format,
          workUnit,
          generatedAt: new Date().toISOString()
        }
      };
    }
    
    // Build series
    const series: ChartSeries[] = [];
    
    if (calculation.actualLine) {
      series.push({
        name: 'Completed',
        data: calculation.actualLine,
        style: 'solid',
        color: '#4CAF50'
      });
    }
    
    if (calculation.scopeLine) {
      series.push({
        name: 'Scope',
        data: calculation.scopeLine,
        style: 'solid',
        color: '#FF9800'
      });
    }
    
    if (calculation.idealLine) {
      series.push({
        name: 'Ideal',
        data: calculation.idealLine,
        style: 'dashed',
        color: '#999'
      });
    }
    
    // Set default options
    const chartOptions: BurnupChartOptions = {
      title: options.title || `Sprint Burnup (${workUnit})`,
      yLabel: options.yLabel || workUnit === 'story-points' ? 'Story Points' : 
              workUnit === 'hours' ? 'Hours' : 'Work Items',
      xLabel: options.xLabel || 'Date',
      showLegend: options.showLegend !== false,
      showGrid: options.showGrid !== false,
      ...options
    };
    
    // Render chart
    const chart = format === 'ascii' 
      ? renderASCIIChart(series, chartOptions)
      : renderSVGChart(series, chartOptions);
    
    return {
      success: true,
      chart,
      data: calculation,
      metadata: {
        format,
        workUnit,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('[generateBurnupChart] Error:', errorToContext(error));
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}
