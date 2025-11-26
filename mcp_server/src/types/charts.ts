/**
 * Chart Type Definitions
 * 
 * Type definitions for burndown, burnup, velocity, and cumulative flow diagrams.
 * Supports ASCII art, SVG, and data-only export formats.
 */

/**
 * Chart export formats
 */
export type ChartFormat = 'ascii' | 'svg' | 'data';

/**
 * Work unit types for charts
 */
export type WorkUnit = 'story-points' | 'hours' | 'count';

/**
 * Chart layout direction
 */
export type ChartDirection = 'horizontal' | 'vertical';

/**
 * Data point for time-series charts
 */
export interface ChartDataPoint {
  /** Date in ISO format (YYYY-MM-DD) */
  date: string;
  /** Value for this data point */
  value: number;
  /** Optional label for this point */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chart series (line on the chart)
 */
export interface ChartSeries {
  /** Series name (e.g., "Ideal", "Actual", "Scope") */
  name: string;
  /** Data points for this series */
  data: ChartDataPoint[];
  /** Line style (solid, dashed, dotted) */
  style?: 'solid' | 'dashed' | 'dotted';
  /** Color for this series (hex or named color) */
  color?: string;
}

/**
 * Chart annotation (for events, milestones, etc.)
 */
export interface ChartAnnotation {
  /** Date of the annotation */
  date: string;
  /** Annotation text */
  text: string;
  /** Annotation type */
  type: 'event' | 'milestone' | 'scope-change';
}

/**
 * Common chart options
 */
export interface ChartOptions {
  /** Chart title */
  title?: string;
  /** X-axis label */
  xLabel?: string;
  /** Y-axis label */
  yLabel?: string;
  /** Show legend */
  showLegend?: boolean;
  /** Show grid lines */
  showGrid?: boolean;
  /** Chart width (for SVG) */
  width?: number;
  /** Chart height (for SVG) */
  height?: number;
  /** Include annotations */
  annotations?: ChartAnnotation[];
}

/**
 * Burndown chart specific options
 */
export interface BurndownChartOptions extends ChartOptions {
  /** Show ideal line */
  showIdealLine?: boolean;
  /** Show trend line */
  showTrendLine?: boolean;
  /** Include weekends in ideal line calculation */
  includeWeekends?: boolean;
}

/**
 * Burnup chart specific options
 */
export interface BurnupChartOptions extends ChartOptions {
  /** Show scope line */
  showScopeLine?: boolean;
  /** Show completed work line */
  showCompletedLine?: boolean;
  /** Show ideal line */
  showIdealLine?: boolean;
  /** Include weekends in ideal line calculation */
  includeWeekends?: boolean;
}

/**
 * Velocity chart specific options
 */
export interface VelocityChartOptions extends ChartOptions {
  /** Show average velocity line */
  showAverageLine?: boolean;
  /** Show trend line */
  showTrendLine?: boolean;
  /** Number of sprints to show */
  sprintCount?: number;
}

/**
 * Cumulative Flow Diagram specific options
 */
export interface CFDOptions extends ChartOptions {
  /** States to include (in order from bottom to top) */
  states?: string[];
  /** Stack type (area chart) */
  stackType?: 'area' | 'line';
}

/**
 * Sprint/Iteration metadata
 */
export interface SprintMetadata {
  /** Sprint name */
  name: string;
  /** Sprint start date */
  startDate: string;
  /** Sprint end date */
  endDate: string;
  /** Iteration path */
  iterationPath: string;
  /** Total capacity (story points or hours) */
  capacity?: number;
  /** Working days (excludes weekends/holidays) */
  workingDays?: number;
}

/**
 * Daily snapshot of work items
 */
export interface DailySnapshot {
  /** Date in ISO format */
  date: string;
  /** Total work remaining */
  remaining: number;
  /** Total work completed */
  completed: number;
  /** Total work in scope */
  scope: number;
  /** Work items added this day */
  added: number;
  /** Work items removed this day */
  removed: number;
  /** Work items by state */
  byState: Record<string, number>;
}

/**
 * Chart calculation result
 */
export interface ChartCalculation {
  /** Daily snapshots */
  snapshots: DailySnapshot[];
  /** Ideal line data points */
  idealLine?: ChartDataPoint[];
  /** Actual line data points */
  actualLine?: ChartDataPoint[];
  /** Trend line data points */
  trendLine?: ChartDataPoint[];
  /** Scope line data points (for burnup) */
  scopeLine?: ChartDataPoint[];
  /** Sprint metadata */
  sprint?: SprintMetadata;
  /** Statistics */
  statistics: {
    /** Starting value */
    startValue: number;
    /** Ending value */
    endValue: number;
    /** Average daily velocity */
    avgDailyVelocity: number;
    /** Projected completion date */
    projectedCompletion?: string;
    /** Scope changes */
    scopeChanges: number;
  };
}

/**
 * Chart rendering result
 */
export interface ChartRenderResult {
  /** Success flag */
  success: boolean;
  /** Rendered chart (ASCII or SVG) */
  chart?: string;
  /** Chart data (for data-only format) */
  data?: ChartCalculation;
  /** Chart metadata */
  metadata?: {
    format: ChartFormat;
    workUnit: WorkUnit;
    generatedAt: string;
  };
  /** Errors */
  errors?: string[];
  /** Warnings */
  warnings?: string[];
}

/**
 * Velocity metrics for a sprint
 */
export interface VelocityMetric {
  /** Sprint name */
  sprint: string;
  /** Story points completed */
  completed: number;
  /** Story points committed */
  committed: number;
  /** Completion rate (0-1) */
  completionRate: number;
  /** Sprint start date */
  startDate: string;
  /** Sprint end date */
  endDate: string;
}

/**
 * CFD state data for a specific date
 */
export interface CFDStateData {
  /** Date in ISO format */
  date: string;
  /** Work item counts by state */
  states: Record<string, number>;
}

/**
 * ASCII chart characters
 */
export const ASCII_CHART_CHARS = {
  // Box drawing characters
  horizontal: '─',
  vertical: '│',
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  cross: '┼',
  tee: '├',
  
  // Line characters
  solidLine: '─',
  dashedLine: '╌',
  dottedLine: '┄',
  
  // Plot characters
  point: '•',
  circle: '○',
  square: '■',
  diamond: '◆',
  
  // Arrow
  rightArrow: '→',
  upArrow: '↑'
} as const;
