# Current Iteration Path Discovery - Implementation Summary

## Overview
Re-enabled automatic discovery of current iteration paths from Azure DevOps team settings. This feature was previously implemented but temporarily disabled. It has now been restored with improved error handling and comprehensive testing.

## What Was Implemented

### 1. Discovery Service (`ado-discovery-service.ts`)
Created a new service module with two main functions:

#### `getCurrentIterationPath()`
- Extracts team name from area path (second segment) or uses explicit team override
- Queries Azure DevOps Team Settings API: `GET /work/teamsettings/iterations?$timeframe=current`
- Returns the path of the active iteration
- Handles errors gracefully (returns null)

#### `getTeamIterations()`
- Helper function to fetch all iterations for a team
- Useful for debugging and future enhancements

### 2. Configuration Integration (`config.ts`)
Updated `ensureCurrentIterationPath()` to:
- Check for explicit CLI configuration first (`--iteration-path`)
- Attempt auto-discovery if not configured
- Cache discovered path in memory for the session
- Handle errors gracefully and continue server startup

### 3. Server Startup (`index.ts`)
- Calls `ensureCurrentIterationPath()` during initialization
- Runs after token provider setup and GitHub Copilot GUID discovery
- Discovery happens automatically on every server restart

### 4. Comprehensive Tests (`current-iteration-discovery.test.ts`)
Test coverage includes:
- Team name extraction from area paths
- Explicit team override support
- Current iteration discovery
- Error handling (404, network errors, invalid paths)
- Fallback behavior when no current iteration exists
- Integration with configuration system

## How It Works

### Standard Flow
```
1. Server starts
2. Token provider initialized
3. ensureCurrentIterationPath() called
4. Extract team from area path (e.g., "Project\TeamAlpha\Component" → "TeamAlpha")
5. Query: https://dev.azure.com/{org}/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current
6. Cache discovered iteration in config
7. Work items use discovered iteration as default
```

### With Team Override
```
1. User starts: enhanced-ado-mcp myorg --area-path "One\Custom\Path" --team "Krypton"
2. Discovery uses "Krypton" instead of extracting from area path
3. Handles non-standard area path structures
```

## Configuration Precedence for Work Item Creation

When creating work items, iteration path is determined by:
1. **Explicit parameter** (highest priority) - User provides `iterationPath` in tool call
2. **Discovered current iteration** - Auto-discovered from team settings
3. **Parent work item** - Inherited from parent (if `inheritParentPaths=true`)
4. **No iteration** (fallback) - Item created without iteration path

## API Endpoint

**URL Pattern:**
```
https://dev.azure.com/{organization}/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1
```

**Response Example:**
```json
{
  "count": 1,
  "value": [
    {
      "id": "abc-123",
      "name": "Sprint 15",
      "path": "MyProject\\Iteration\\Sprint 15",
      "attributes": {
        "startDate": "2025-11-04T00:00:00Z",
        "finishDate": "2025-11-17T23:59:59Z",
        "timeFrame": "current"
      }
    }
  ]
}
```

## Error Handling

All errors are handled gracefully:
- **Invalid area path** (< 2 segments) - Log warning, suggest `--team` flag
- **Team not found** (404) - Log warning, suggest `--team` flag
- **No current iteration** - Log debug message, continue without default
- **Network errors** - Log warning, continue without default
- **Permission errors** - Log warning, continue without default

The server always continues startup even if discovery fails.

## Testing

### Run Unit Tests
```bash
cd mcp_server
npm test -- current-iteration-discovery.test.ts
```

### Manual Testing
```bash
# Standard area path
enhanced-ado-mcp myorg --area-path "MyProject\\TeamName\\Area"

# Check logs for:
# [INFO] Attempting to auto-discover current iteration path...
# [INFO] Current iteration path discovered: MyProject\Iteration\Sprint X

# Non-standard with team override
enhanced-ado-mcp myorg --area-path "One\\Custom\\Path" --team "Krypton"

# Verify with configuration tool
# Call: get-config
# Check: iterationPath field in response
```

## Integration Points

### Work Item Creation Tools
These tools automatically use the discovered iteration:
- `create-workitem` - Creates new work items
- `assign-copilot` - Assigns existing items to Copilot

### Configuration Tool
`get-config` displays the discovered iteration path:
```json
{
  "azureDevOps": {
    "iterationPath": "MyProject\\Iteration\\Sprint 42"
  },
  "helpText": {
    "iterationPath": "Default iteration path is configured as: MyProject\\Iteration\\Sprint 42."
  }
}
```

## Files Changed

### New Files
- `mcp_server/src/services/ado-discovery-service.ts` - Discovery service implementation
- `mcp_server/test/unit/current-iteration-discovery.test.ts` - Comprehensive unit tests

### Modified Files
- `mcp_server/src/config/config.ts` - Re-enabled auto-discovery in `ensureCurrentIterationPath()`
- `mcp_server/src/index.ts` - Added discovery call during server startup
- `docs/feature_specs/current-iteration-path-discovery.md` - Updated status and version

## Benefits

1. **No Manual Configuration** - Iteration path auto-discovered on startup
2. **Always Current** - Updates automatically when server restarts (new sprint)
3. **Graceful Degradation** - Errors don't prevent server startup
4. **Team Override Support** - Handles non-standard area path structures
5. **Consistent Defaults** - New work items automatically go to active sprint

## Future Enhancements

Potential improvements identified:
1. Periodic refresh (re-discover without restart)
2. Multi-team support (discover for each configured area path)
3. Fallback to most recent iteration if no current
4. Team Context API usage (simpler than Team Settings API)

## Related Features

- **Team Override** (`team-override-for-iteration-discovery.md`) - Explicit team specification
- **Automatic Project Extraction** (`automatic-project-extraction.md`) - Similar auto-discovery pattern
- **Multi-Area Path Support** (`multi-area-path-support.md`) - Works with multiple configured areas
