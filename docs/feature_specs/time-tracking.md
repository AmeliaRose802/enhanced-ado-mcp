# Work Item Time Tracking

## Overview

The time tracking feature enables accurate time recording for Azure DevOps work items with automatic and manual time entry, pause/resume functionality, and comprehensive reporting. It integrates with ADO's scheduling fields (`CompletedWork`, `RemainingWork`, `OriginalEstimate`) to provide a complete time management solution.

**Key Benefits:**
- Accurate time tracking with start/stop timers
- Persistent storage survives MCP server restarts
- Automatic calculation of completed work and percentage
- Detailed time reports by person, iteration, or work item
- Time log history in work item comments

## Features

### Time Tracking Operations

#### Start Time Tracking
Begin tracking time on a work item. Creates an active timer that persists across server restarts.

#### Stop Time Tracking
Stop tracking and record time. Automatically:
- Calculates duration (excluding paused time)
- Rounds to nearest 15 minutes (configurable)
- Updates `CompletedWork` field
- Recalculates `RemainingWork`
- Adds time log comment

#### Pause/Resume Tracking
Handle interruptions without stopping the timer. Paused time is not counted toward work duration.

#### Manual Time Entry
Log time retroactively or when automatic tracking wasn't used.

### Time Storage

**Active Timers:** Stored in `%TEMP%/ado-time-tracking.json` (configurable)
- Work item ID
- Start timestamp
- User email
- Description
- Pause history
- Total paused duration

**Time Entries:** Historical record of all time logged
- Entry ID (UUID)
- Work item ID
- Start/end timestamps
- Duration
- User
- Description
- Entry type (automatic/manual)
- Billable flag

### ADO Field Integration

The time tracking system updates these ADO scheduling fields:

- **`Microsoft.VSTS.Scheduling.CompletedWork`**: Total hours logged
- **`Microsoft.VSTS.Scheduling.RemainingWork`**: Hours remaining (recalculated)
- **`Microsoft.VSTS.Scheduling.OriginalEstimate`**: Initial estimate (read-only)
- **Percentage Complete**: `CompletedWork / (CompletedWork + RemainingWork) * 100`

### Time Log Comments

Each time entry adds a comment to the work item:

```
[Time Log] 2025-11-18 09:00-11:30 (2.5h) - Implemented authentication feature - user@example.com
[Time Log] 2025-11-18 --:-- (3.0h) (manual entry) - Code review and testing - user@example.com
```

## MCP Tools

### 1. start-time-tracking

Start time tracking for a work item.

**Parameters:**
- `workItemId` (number, required): Work item to track
- `organization` (string, optional): ADO organization (uses config default)
- `project` (string, optional): ADO project (uses config default)
- `description` (string, optional): Work description
- `billable` (boolean, optional): Mark as billable (default: false)

**Example:**
```json
{
  "workItemId": 12345,
  "description": "Implementing authentication feature"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Started tracking work item 12345: Implement user authentication",
  "data": {
    "workItemId": 12345,
    "startTime": "2025-11-18T09:00:00Z",
    "title": "Implement user authentication"
  }
}
```

### 2. stop-time-tracking

Stop time tracking and record time.

**Parameters:**
- `workItemId` (number, optional): Work item to stop (uses active timer if not provided)
- `organization` (string, optional): ADO organization
- `project` (string, optional): ADO project
- `description` (string, optional): Override start description
- `updateFields` (boolean, optional): Update CompletedWork/RemainingWork (default: true)

**Example:**
```json
{
  "description": "Completed authentication implementation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stopped tracking work item 12345, logged 2.50 hours",
  "data": {
    "workItemId": 12345,
    "duration": 2.5,
    "startTime": "2025-11-18T09:00:00Z",
    "endTime": "2025-11-18T11:30:00Z",
    "completedWork": 10.5,
    "remainingWork": 5.5,
    "percentComplete": 66
  }
}
```

### 3. pause-resume-time-tracking

Pause or resume time tracking.

**Parameters:**
- `action` (string, required): "pause" or "resume"
- `workItemId` (number, optional): Work item (uses active timer if not provided)
- `organization` (string, optional): ADO organization
- `project` (string, optional): ADO project

**Example (Pause):**
```json
{
  "action": "pause"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Paused timer for work item 12345",
  "data": {
    "workItemId": 12345,
    "status": "paused",
    "pausedAt": "2025-11-18T10:15:00Z"
  }
}
```

**Example (Resume):**
```json
{
  "action": "resume"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Resumed timer for work item 12345",
  "data": {
    "workItemId": 12345,
    "status": "active",
    "pausedDuration": 0.25
  }
}
```

### 4. log-work-time

Manually log work time.

**Parameters:**
- `workItemId` (number, required): Work item to log time for
- `hours` (number, required): Hours to log (must be > 0)
- `organization` (string, optional): ADO organization
- `project` (string, optional): ADO project
- `date` (string, optional): Date for entry (ISO format YYYY-MM-DD, defaults to today)
- `description` (string, optional): Work description
- `billable` (boolean, optional): Mark as billable (default: false)
- `updateFields` (boolean, optional): Update CompletedWork/RemainingWork (default: true)

**Example:**
```json
{
  "workItemId": 12345,
  "hours": 3.0,
  "date": "2025-11-17",
  "description": "Code review and testing"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged 3.00 hours for work item 12345",
  "data": {
    "workItemId": 12345,
    "duration": 3.0,
    "completedWork": 13.5,
    "remainingWork": 2.5,
    "percentComplete": 84
  }
}
```

### 5. get-time-report

Generate time tracking report.

**Parameters:**
- `reportType` (string, required): "person", "iteration", "workitem", or "project"
- `reportValue` (string, required): Person email, iteration path, work item ID, or project name
- `organization` (string, optional): ADO organization
- `project` (string, optional): ADO project
- `startDate` (string, optional): Start date (ISO format YYYY-MM-DD, defaults to 30 days ago)
- `endDate` (string, optional): End date (ISO format YYYY-MM-DD, defaults to today)
- `format` (string, optional): "json", "summary", or "csv" (default: "summary")
- `includeDetails` (boolean, optional): Include detailed entry info (default: false)

**Example:**
```json
{
  "reportType": "person",
  "reportValue": "user@example.com",
  "startDate": "2025-11-01",
  "endDate": "2025-11-18"
}
```

**Response (Summary Format):**
```
Time Report: person - user@example.com
Date Range: 2025-11-01 to 2025-11-18
Total Hours: 42.50
Work Items: 8
Time Entries: 15

By Work Item:
  12345: Implement user authentication - 10.50h (5 entries)
  12346: Fix login bug - 5.00h (2 entries)
  12347: Update documentation - 3.00h (1 entries)
  ...

By Day:
  2025-11-18: 5.50h (2 entries)
  2025-11-17: 7.00h (3 entries)
  ...
```

### 6. get-active-timers

Get list of currently active timers.

**Parameters:**
- `user` (string, optional): Filter by user email (defaults to current user)

**Example:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "summary": "Active Timers: 1\nTotal Elapsed: 2.50 hours\n\nWork Item 12345: 2.50h (active)\n  Started: 2025-11-18T09:00:00Z\n  User: user@example.com",
  "data": {
    "activeCount": 1,
    "timers": [
      {
        "workItemId": 12345,
        "title": "Work Item 12345",
        "user": "user@example.com",
        "startTime": "2025-11-18T09:00:00Z",
        "elapsedHours": 2.5,
        "status": "active"
      }
    ],
    "totalElapsedHours": 2.5
  }
}
```

## Configuration

Time tracking behavior can be configured:

```typescript
{
  autoPauseAfterMinutes: 30,    // Auto-pause after inactive time
  roundToMinutes: 15,            // Round duration to nearest 15/30/60 minutes
  minimumDurationMinutes: 1,     // Minimum trackable duration
  enableBillableTracking: true,  // Enable billable flag
  storageFile: "%TEMP%/ado-time-tracking.json" // Storage location
}
```

## Storage Format

**Storage File:** `%TEMP%/ado-time-tracking.json`

```json
{
  "activeTimers": {
    "12345:user@example.com": {
      "workItemId": 12345,
      "startTime": "2025-11-18T09:00:00Z",
      "user": "user@example.com",
      "description": "Implementing feature",
      "status": "active",
      "totalPausedDuration": 0
    }
  },
  "timeEntries": {
    "uuid-1234": {
      "id": "uuid-1234",
      "workItemId": 12345,
      "startTime": "2025-11-17T09:00:00Z",
      "endTime": "2025-11-17T11:30:00Z",
      "duration": 2.5,
      "user": "user@example.com",
      "description": "Code review",
      "entryType": "automatic",
      "status": "completed",
      "createdAt": "2025-11-17T09:00:00Z",
      "updatedAt": "2025-11-17T11:30:00Z"
    }
  },
  "sessions": {},
  "savedAt": "2025-11-18T11:30:00Z"
}
```

## Error Handling

Common errors:

- **ALREADY_TRACKING**: Timer already running for this work item
- **NO_ACTIVE_TIMER**: No timer found to stop/pause
- **DURATION_TOO_SHORT**: Duration below minimum threshold
- **INVALID_HOURS**: Hours must be greater than 0
- **NOT_PAUSED**: Attempting to resume non-paused timer
- **ALREADY_PAUSED**: Attempting to pause already-paused timer

## Implementation Details

### Key Components

**Service:** `time-tracking-service.ts`
- Manages timers and entries
- Handles storage persistence
- Updates ADO fields
- Generates reports

**Tool Configs:** `time-tracking.ts`
- MCP tool definitions
- Input validation
- Handler implementations

**Types:** `time-tracking.ts`
- Type definitions for timers, entries, reports
- Configuration interfaces

### Storage Persistence

- **Auto-save:** After each operation (create, update, delete)
- **Auto-load:** On first operation after server start
- **Format:** JSON with human-readable structure
- **Location:** Configurable via `storageFile` setting

### Duration Calculation

1. Calculate elapsed time: `endTime - startTime`
2. Subtract paused duration
3. Round to nearest interval (default: 15 minutes)
4. Check minimum duration (default: 1 minute)

### Field Updates

When `updateFields: true` (default):
1. Get current `CompletedWork` and `RemainingWork`
2. Add duration to `CompletedWork`
3. Subtract duration from `RemainingWork` (if set)
4. Update work item via PATCH operation
5. Add time log comment to `System.History`

## Best Practices

### For Users

1. **Start tracking when beginning work**
   ```json
   { "workItemId": 12345, "description": "Implementing feature X" }
   ```

2. **Pause during interruptions**
   ```json
   { "action": "pause" }
   ```

3. **Resume after interruption**
   ```json
   { "action": "resume" }
   ```

4. **Stop when done**
   ```json
   { "description": "Feature X completed and tested" }
   ```

5. **Use manual entry for forgotten time**
   ```json
   { "workItemId": 12345, "hours": 2.5, "date": "2025-11-17" }
   ```

### For Developers

1. **Check for active timers** before starting new timer
2. **Validate work item exists** before creating timer
3. **Handle MCP server restarts** - timers persist
4. **Round durations** for cleaner reporting
5. **Add descriptive comments** in time logs

## Changelog

### Version 1.0.0 (2025-11-18)
- Initial implementation
- Start/stop/pause/resume tracking
- Manual time entry
- Time reports by person/iteration/workitem
- ADO field integration
- Persistent storage
- Time log comments

## Testing

### Manual Testing Steps

1. **Start tracking:**
   ```
   Use start-time-tracking tool with workItemId
   Verify timer created in storage
   ```

2. **Pause tracking:**
   ```
   Use pause-resume-time-tracking with action: "pause"
   Verify timer status updated
   ```

3. **Resume tracking:**
   ```
   Use pause-resume-time-tracking with action: "resume"
   Verify paused duration tracked
   ```

4. **Stop tracking:**
   ```
   Use stop-time-tracking
   Verify CompletedWork updated
   Verify time log comment added
   ```

5. **Manual entry:**
   ```
   Use log-work-time with hours and date
   Verify CompletedWork updated
   Verify comment added
   ```

6. **Generate report:**
   ```
   Use get-time-report with reportType and reportValue
   Verify totals calculated correctly
   ```

7. **Check active timers:**
   ```
   Use get-active-timers
   Verify elapsed time calculated
   ```

### Test Cases

- ✅ Start tracking on new work item
- ✅ Prevent duplicate timers
- ✅ Pause and resume tracking
- ✅ Stop tracking and calculate duration
- ✅ Round duration to nearest interval
- ✅ Update CompletedWork field
- ✅ Recalculate RemainingWork
- ✅ Add time log comment
- ✅ Manual time entry
- ✅ Generate person report
- ✅ Generate work item report
- ✅ Storage persistence across restarts
- ✅ Handle missing work items
- ✅ Handle minimum duration
- ✅ Track paused time

## Future Enhancements

Potential future features (not implemented yet):

1. **Auto-pause detection** based on inactivity
2. **Multiple concurrent timers** (switch between work items)
3. **Billable vs non-billable** time tracking
4. **CSV export** for time reports
5. **Burndown chart integration**
6. **Team time tracking dashboard**
7. **Time estimation vs actual** analysis
8. **Integration with calendar/meetings**
9. **Mobile app sync** (via storage file)
10. **Time approval workflow**
