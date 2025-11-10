# Current Iteration Path Discovery

**Feature Version:** 1.0  
**Status:** Implemented  
**Category:** Configuration & Auto-Discovery

## Overview

Automatically discovers and caches the current active iteration path for a team on server startup. When work items are created without specifying an iteration path, the discovered current iteration is used as the default. This ensures new work items are automatically assigned to the active sprint without manual configuration.

## Why This Feature Exists

**Problem:**
- Iteration paths change frequently (every sprint)
- Hardcoding iteration paths in configuration requires manual updates
- Users forget to specify iteration paths when creating work items
- New work items end up in the wrong iteration or without any iteration

**Solution:**
- Query Azure DevOps team settings API to find the current active iteration
- Cache the discovered iteration path in server configuration
- Use as default for new work items when no iteration is specified
- Refresh on every server restart to stay current

## How It Works

### Discovery Process

1. **Team Extraction:** Extract team name from configured area path
   - Area path format: `ProjectName\TeamName\OptionalSubArea`
   - Team name is the second segment (after project name)

2. **API Query:** Call Azure DevOps team settings API
   - Endpoint: `GET https://dev.azure.com/{org}/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current`
   - Filter: `$timeframe=current` returns only the active iteration

3. **Caching:** Store discovered iteration path in configuration
   - Cached in memory for the server session
   - Automatically refreshed on server restart

4. **Fallback:** If discovery fails, continue without default iteration
   - Iteration path is optional
   - Users can still specify explicitly when creating work items

### Server Startup Integration

```typescript
// After token provider initialization
setTokenProvider(tokenProvider);

// Auto-discover GitHub Copilot GUID
await ensureGitHubCopilotGuid();

// Auto-discover current iteration path (NEW)
await ensureCurrentIterationPath();
```

## Input Parameters

### Discovery Function: `getCurrentIterationPath()`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organization` | string | Yes | Azure DevOps organization name |
| `project` | string | Yes | Azure DevOps project name |
| `areaPath` | string | Yes | Area path containing team information (format: `Project\Team\...`) |

### Configuration Function: `ensureCurrentIterationPath()`

No parameters required. Uses existing server configuration:
- `organization` from config
- `project` extracted from area path
- `areaPaths[0]` used to determine team

## Output Format

### Success Response

Returns the discovered iteration path as a string:

```typescript
"MyProject\\Iteration\\Sprint 42"
```

### No Current Iteration

Returns `null` if:
- Area path doesn't contain team information (< 2 segments)
- No current iteration configured for the team
- API call fails (network error, authentication, permissions)

### Configuration Update

After successful discovery, config is updated:

```typescript
{
  azureDevOps: {
    organization: "myorg",
    project: "MyProject",
    areaPath: "MyProject\\TeamAlpha\\Component",
    iterationPath: "MyProject\\Iteration\\Sprint 42", // Auto-discovered
    // ... other fields
  }
}
```

## Examples

### Example 1: Successful Discovery

**Input Configuration:**
```typescript
organization: "contoso"
areaPaths: ["ContosoProject\\WebTeam\\Frontend"]
```

**API Response:**
```json
{
  "value": [
    {
      "id": "abc-123",
      "name": "Sprint 15",
      "path": "ContosoProject\\Iteration\\Sprint 15",
      "attributes": {
        "startDate": "2025-11-04T00:00:00Z",
        "finishDate": "2025-11-17T23:59:59Z",
        "timeFrame": "current"
      }
    }
  ]
}
```

**Result:**
```typescript
// Config updated with discovered iteration
config.azureDevOps.iterationPath = "ContosoProject\\Iteration\\Sprint 15"
```

**Server Log:**
```
[INFO] Attempting to auto-discover current iteration path...
[DEBUG] Attempting to get current iteration for team: WebTeam
[DEBUG] Found current iteration: ContosoProject\Iteration\Sprint 15
[INFO] Current iteration path discovered: ContosoProject\Iteration\Sprint 15
```

### Example 2: No Current Iteration

**Input Configuration:**
```typescript
organization: "fabrikam"
areaPaths: ["FabrikamProject\\DevOpsTeam"]
```

**API Response:**
```json
{
  "value": []
}
```

**Result:**
```typescript
// No iteration path set
config.azureDevOps.iterationPath = undefined
```

**Server Log:**
```
[INFO] Attempting to auto-discover current iteration path...
[DEBUG] Attempting to get current iteration for team: DevOpsTeam
[DEBUG] No current iteration found for team: DevOpsTeam
[DEBUG] Current iteration path not found via auto-discovery.
```

### Example 3: Invalid Area Path

**Input Configuration:**
```typescript
organization: "northwind"
areaPaths: ["NorthwindProject"] // Missing team segment
```

**Result:**
```typescript
// No discovery attempted
config.azureDevOps.iterationPath = undefined
```

**Server Log:**
```
[INFO] Attempting to auto-discover current iteration path...
[WARN] Area path "NorthwindProject" does not contain team information. Cannot determine current iteration.
[DEBUG] Current iteration path not found via auto-discovery.
```

## Error Handling

### Graceful Degradation

All errors are handled gracefully:
- Logged as warnings, not errors
- Server continues to start normally
- Work items can still be created (without default iteration)

### Common Error Scenarios

| Error | Cause | Behavior |
|-------|-------|----------|
| Area path too short | Area path format invalid | Log warning, return null |
| Team not found | Team name doesn't exist | Log API error, return null |
| Permission denied | User lacks team settings read access | Log API error, return null |
| Network timeout | API unreachable | Log API error, return null |
| Already configured | Iteration path already set in config | Skip discovery, return existing value |

### Error Log Example

```
[WARN] Failed to discover current iteration path: The controller for path '/MyProject/_apis/MyTeam/_apis/work/teamsettings/iterations' was not found
```

## Implementation Details

### Key Components

1. **`ado-discovery-service.ts`**
   - `getCurrentIterationPath()` - Query API for current iteration
   - `getTeamIterations()` - Get all iterations (debugging helper)

2. **`config.ts`**
   - `ensureCurrentIterationPath()` - Main discovery orchestrator
   - Caches result in `config.azureDevOps.iterationPath`

3. **`index.ts`**
   - Calls `ensureCurrentIterationPath()` during startup
   - Runs after token provider initialization

### API Endpoint Details

**URL Pattern:**
```
https://dev.azure.com/{organization}/{project}/{team}/_apis/work/teamsettings/iterations
```

**Query Parameters:**
- `$timeframe=current` - Filter to active iteration only
- `api-version=7.1` - API version (auto-added)

**Special Handling:**
- Uses absolute URL (not relative to base URL)
- Team name must be inserted before `/_apis` in path
- Standard HTTP client auto-adds auth headers

### Team Name Extraction

Area path segments:
1. **Project name** (first segment)
2. **Team name** (second segment) ← Used for API call
3. **Sub-areas** (optional additional segments)

Example: `ContosoProject\WebTeam\Frontend\Components`
- Project: `ContosoProject`
- Team: `WebTeam` ← Used in API URL
- Sub-area: `Frontend\Components` (ignored for iteration discovery)

## Testing

### Unit Tests

File: `mcp_server/test/unit/current-iteration-discovery.test.ts`

**Test Coverage:**
- ✅ Extract team name from area path
- ✅ Query current iteration successfully
- ✅ Handle insufficient area path segments
- ✅ Handle empty API response (no current iteration)
- ✅ Handle API errors gracefully
- ✅ Fetch all team iterations
- ✅ Return cached value if already configured

### Manual Testing

1. Start server with valid area path:
   ```bash
   enhanced-ado-mcp myorg --area-path "MyProject\\TeamName"
   ```

2. Check logs for discovery message:
   ```
   [INFO] Current iteration path discovered: MyProject\Iteration\Sprint X
   ```

3. Create work item without iteration - should use discovered iteration

4. Call `get-config` to verify cached value

## Integration Points

### Work Item Creation

Tools that create work items automatically use discovered iteration:
- `create-workitem`
- `assign-copilot`
- `clone-workitem`

**Precedence:**
1. User-provided `iterationPath` parameter (highest priority)
2. Discovered current iteration (auto-filled)
3. Parent work item iteration (if `inheritParentPaths=true`)
4. No iteration (fallback)

### Configuration Tool

`get-config` displays discovered iteration:

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

## Version History

### Version 1.0 (2025-11-07)
- Initial implementation
- Automatic discovery on server startup
- Team name extraction from area path
- Graceful error handling
- Comprehensive unit tests
- Integration with work item creation tools

## Related Features

- **Automatic Project Extraction** - `docs/feature_specs/automatic-project-extraction.md`
- **Multi-Area Path Support** - `docs/feature_specs/multi-area-path-support.md`
- **GitHub Copilot GUID Discovery** - Similar auto-discovery pattern

## Future Enhancements

### Potential Improvements

1. **Periodic Refresh:** Re-discover on schedule (not just startup)
2. **Multi-Team Support:** Discover iteration for each configured area path
3. **Fallback Strategy:** Use most recent iteration if no "current" found
4. **Configuration Override:** CLI flag to force specific iteration
5. **Team Context API:** Use team context instead of team settings (simpler)

### Known Limitations

1. **Single Team Assumption:** Uses first area path's team for all work items
2. **Restart Required:** Changes to current iteration not detected until restart
3. **Team Name Assumption:** Assumes second segment of area path is team name
   - Works for standard Azure DevOps setups
   - May not work for unusual area path hierarchies
