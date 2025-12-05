/**
 * Time Tracking Type Definitions
 * 
 * Type definitions for work item time tracking functionality.
 * Supports start/stop tracking, manual time entry, and reporting.
 */

/**
 * Time Entry - Individual time log entry
 */
export interface TimeEntry {
  /** Unique identifier for the time entry */
  id: string;
  /** Work item ID */
  workItemId: number;
  /** Start timestamp (ISO 8601) */
  startTime: string;
  /** End timestamp (ISO 8601), null if tracking is active */
  endTime: string | null;
  /** Duration in hours (calculated from start/end or manually entered) */
  duration: number | null;
  /** User who logged the time */
  user: string;
  /** Optional description of work performed */
  description?: string;
  /** Entry type */
  entryType: 'automatic' | 'manual';
  /** Whether this time is billable */
  billable?: boolean;
  /** Current status */
  status: 'active' | 'paused' | 'completed';
  /** Pause/resume history */
  pauseHistory?: Array<{
    pausedAt: string;
    resumedAt: string | null;
    duration: number;
  }>;
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Active Timer - Currently running time tracker
 */
export interface ActiveTimer {
  workItemId: number;
  startTime: string;
  user: string;
  description?: string;
  status: 'active' | 'paused';
  pausedAt?: string;
  totalPausedDuration: number; // in hours
}

/**
 * Time Report - Aggregated time tracking data
 */
export interface TimeReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Report scope */
  scope: {
    type: 'person' | 'iteration' | 'workitem' | 'project';
    value: string;
  };
  /** Date range */
  dateRange: {
    start: string;
    end: string;
  };
  /** Total hours logged */
  totalHours: number;
  /** Number of work items */
  workItemCount: number;
  /** Number of time entries */
  entryCount: number;
  /** Breakdown by work item */
  byWorkItem: Record<number, {
    workItemId: number;
    title: string;
    type: string;
    totalHours: number;
    completedWork: number;
    remainingWork: number;
    percentComplete: number;
    entryCount: number;
  }>;
  /** Breakdown by person (for iteration/project reports) */
  byPerson?: Record<string, {
    totalHours: number;
    workItemCount: number;
    entryCount: number;
  }>;
  /** Breakdown by day */
  byDay: Record<string, {
    date: string;
    hours: number;
    entryCount: number;
  }>;
}

/**
 * Time Tracking Session - Complete tracking session with metadata
 */
export interface TimeTrackingSession {
  sessionId: string;
  workItemId: number;
  user: string;
  startTime: string;
  endTime: string | null;
  status: 'active' | 'paused' | 'completed';
  entries: TimeEntry[];
  totalDuration: number; // in hours
  activeDuration: number; // excluding pauses
  pausedDuration: number;
}

/**
 * Work Item Time Summary - Time tracking summary for a work item
 */
export interface WorkItemTimeSummary {
  workItemId: number;
  title: string;
  type: string;
  state: string;
  /** Current values from ADO fields */
  scheduling: {
    originalEstimate: number | null;
    completedWork: number;
    remainingWork: number | null;
    percentComplete: number;
  };
  /** Time tracking data */
  timeTracking: {
    totalLoggedHours: number;
    entryCount: number;
    uniqueUsers: string[];
    firstEntry: string | null;
    lastEntry: string | null;
    activeTimers: number;
  };
  /** Recent entries (last 10) */
  recentEntries: Array<{
    date: string;
    user: string;
    hours: number;
    description?: string;
  }>;
}

/**
 * Time Log Format - Comment format for time entries
 */
export interface TimeLogComment {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  user: string;
  description?: string;
  entryType: 'automatic' | 'manual';
}

/**
 * Time Tracking Configuration
 */
export interface TimeTrackingConfig {
  /** Auto-pause after inactive minutes */
  autoPauseAfterMinutes: number;
  /** Round to nearest minutes */
  roundToMinutes: 15 | 30 | 60;
  /** Minimum trackable duration in minutes */
  minimumDurationMinutes: number;
  /** Enable billable tracking */
  enableBillableTracking: boolean;
  /** Storage location for active timers */
  storageFile: string;
}

/**
 * Start Tracking Arguments
 */
export interface StartTrackingArgs {
  workItemId: number;
  organization: string;
  project: string;
  description?: string;
  billable?: boolean;
}

/**
 * Stop Tracking Arguments
 */
export interface StopTrackingArgs {
  workItemId?: number; // Optional - stops current active timer if not provided
  organization: string;
  project: string;
  description?: string;
  updateFields?: boolean; // Update CompletedWork/RemainingWork fields
}

/**
 * Manual Time Entry Arguments
 */
export interface LogWorkTimeArgs {
  workItemId: number;
  organization: string;
  project: string;
  hours: number;
  date?: string; // ISO date, defaults to today
  description?: string;
  billable?: boolean;
  updateFields?: boolean; // Update CompletedWork/RemainingWork fields
}

/**
 * Time Report Arguments
 */
export interface GetTimeReportArgs {
  organization: string;
  project: string;
  reportType: 'person' | 'iteration' | 'workitem' | 'project';
  reportValue: string; // person email, iteration path, work item ID, or project name
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  format?: 'json' | 'summary' | 'csv';
  includeDetails?: boolean;
}

/**
 * Pause/Resume Arguments
 */
export interface PauseResumeTrackingArgs {
  workItemId?: number; // Optional - applies to current active timer if not provided
  organization: string;
  project: string;
  action: 'pause' | 'resume';
}

/**
 * Time Tracking Result - Generic operation result
 */
export interface TimeTrackingResult {
  success: boolean;
  message: string;
  data?: {
    workItemId?: number;
    duration?: number;
    startTime?: string;
    endTime?: string;
    completedWork?: number;
    remainingWork?: number;
    percentComplete?: number;
    [key: string]: unknown;
  };
  error?: string;
}

/**
 * Active Timers Summary
 */
export interface ActiveTimersSummary {
  activeCount: number;
  timers: Array<{
    workItemId: number;
    title: string;
    user: string;
    startTime: string;
    elapsedHours: number;
    status: 'active' | 'paused';
  }>;
  totalElapsedHours: number;
}

/**
 * Type Guards
 */

export function isTimeEntry(value: unknown): value is TimeEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'workItemId' in value &&
    'startTime' in value &&
    'user' in value
  );
}

export function isActiveTimer(value: unknown): value is ActiveTimer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'workItemId' in value &&
    'startTime' in value &&
    'status' in value &&
    ('active' === (value as ActiveTimer).status || 'paused' === (value as ActiveTimer).status)
  );
}

export function isTimeReport(value: unknown): value is TimeReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'generatedAt' in value &&
    'scope' in value &&
    'totalHours' in value
  );
}
