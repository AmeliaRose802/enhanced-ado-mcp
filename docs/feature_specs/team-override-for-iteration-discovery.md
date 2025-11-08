# Team Override for Iteration Path Discovery

**Feature Version:** 1.0  
**Status:** Implemented  
**Category:** Configuration & Auto-Discovery  
**Related Feature:** [Current Iteration Path Discovery](current-iteration-path-discovery.md)

## Overview

Adds support for explicitly specifying the team name used for iteration path discovery via the `--team` CLI flag. This allows the server to work with non-standard area path structures where the team name cannot be reliably extracted from the second segment of the area path.

## Why This Feature Exists

**Problem:**
- The original iteration path discovery assumes standard Azure DevOps area path format: `ProjectName\TeamName\SubArea`
- It extracts the team name from the second segment (`segments[1]`)
- Some organizations use non-standard area path structures where this assumption fails
- Example: Area path `One\Custom\Azure\CY2022H1 - Nickel\12 - December` would incorrectly use "Custom" as the team name instead of "Krypton"

**Solution:**
- Add `--team` CLI parameter to explicitly override team name extraction
- Pass the team override through the configuration system
- Use explicit team name in API calls instead of extracting from area path
- Add helpful error messages when auto-detection might be wrong

## How It Works

### Discovery Process with Team Override

1. **CLI Parameter:** User provides `--team <team-name>` flag when starting server
2. **Configuration:** Team name stored in `config.azureDevOps.team`
3. **Discovery:** When discovering iteration path:
   - If `team` is configured, use it directly
   - Otherwise, extract from area path (second segment)
4. **API Call:** Use the team name in Azure DevOps API URL
5. **Logging:** Clear logging to indicate whether team was provided or extracted

### Comparison: With vs Without Override

**Without Override (Default Behavior):**
```bash
enhanced-ado-mcp myorg --area-path "MyProject\\TeamAlpha\\Component"
# Team extracted: "TeamAlpha" (from segments[1])
# API call: https://dev.azure.com/myorg/MyProject/TeamAlpha/_apis/work/teamsettings/iterations?$timeframe=current
```

**With Override (Non-Standard Structure):**
```bash
enhanced-ado-mcp myorg --area-path "One\\Custom\\Azure\\Path" --team "Krypton"
# Team explicit: "Krypton" (from --team flag)
# API call: https://dev.azure.com/myorg/One/Krypton/_apis/work/teamsettings/iterations?$timeframe=current
```

## Input Parameters

### CLI Arguments

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `--team` | string | No | Team name for iteration path discovery. Overrides auto-extraction from area path. |

### Configuration

```typescript
interface AzureDevOpsConfig {
  // ... other fields
  team?: string;  // Optional team name override
}
```

## Output Format

Same as standard iteration path discovery. The team override only affects how the team name is determined internally.

**Success Response:**
```typescript
"MyProject\\Iteration\\Sprint 42"
```

**Configuration Update:**
```typescript
{
  azureDevOps: {
    organization: "myorg",
    project: "MyProject",
    areaPath: "One\\Custom\\Azure\\Path",
    team: "Krypton",  // Explicit override
    iterationPath: "One\\Krypton",  // Discovered using override
  }
}
```

## Examples

### Example 1: Standard Area Path (No Override Needed)

**Command:**
```bash
enhanced-ado-mcp contoso --area-path "ContosoProject\\WebTeam\\Frontend"
```

**Behavior:**
- Team extracted: "WebTeam" (from area path)
- API query: `/ContosoProject/WebTeam/_apis/work/teamsettings/iterations`
- Result: `ContosoProject\Iteration\Sprint 15`

**Server Log:**
```
[DEBUG] Extracted team name from area path: WebTeam
[DEBUG] Attempting to get current iteration for team: WebTeam
[INFO] Current iteration path discovered: ContosoProject\Iteration\Sprint 15
```

### Example 2: Non-Standard Area Path (Override Required)

**Command:**
```bash
enhanced-ado-mcp myorg --area-path "One\\Custom\\Azure\\CY2022H1 - Nickel\\12 - December" --team "Krypton"
```

**Behavior:**
- Team explicit: "Krypton" (from `--team` flag)
- API query: `/One/Krypton/_apis/work/teamsettings/iterations`
- Result: `One\Krypton`

**Server Log:**
```
[DEBUG] Using explicit team name from configuration: Krypton
[INFO] Current iteration path discovered: One\Krypton
```

### Example 3: Wrong Team Name (Error with Helpful Hint)

**Command:**
```bash
# Forgot to provide --team flag
enhanced-ado-mcp myorg --area-path "One\\Custom\\Azure\\Path"
```

**Behavior:**
- Team extracted: "Custom" (incorrect, from area path)
- API query fails: `/One/Custom/_apis/work/teamsettings/iterations` (team doesn't exist)
- Discovery fails with helpful error

**Server Log:**
```
[DEBUG] Extracted team name from area path: Custom
[DEBUG] Attempting to get current iteration for team: Custom
[WARN] Failed to discover current iteration path: The controller for path '/One/_apis/Custom/_apis/work/teamsettings/iterations' was not found
[WARN] Hint: If the auto-detected team name is incorrect, use --team <team-name> to explicitly specify the team.
[WARN]       For example: enhanced-ado-mcp myorg --area-path "One\Custom\Azure\Path" --team "CorrectTeamName"
```

## Error Handling

### Enhanced Error Messages

When iteration discovery fails and no team override was provided, the system now logs helpful hints:

```
[WARN] Failed to discover current iteration path: <error message>
[WARN] Hint: If the auto-detected team name is incorrect, use --team <team-name> to explicitly specify the team.
[WARN]       For example: enhanced-ado-mcp myorg --area-path "<your-area-path>" --team "CorrectTeamName"
```

### Error Scenarios

| Scenario | Behavior | Log Message |
|----------|----------|-------------|
| Area path too short (< 2 segments) | Return null | "Area path does not contain team information" + hint about `--team` flag |
| Team not found in Azure DevOps | Return null | "Failed to discover current iteration path" + hint about `--team` flag |
| Team override provided but wrong | Return null | "Failed to discover current iteration path" (no hint since user already specified team) |
| API network error | Return null | "Failed to discover current iteration path" + hint if no override |

## Implementation Details

### Key Changes

1. **CLI Argument (`src/index.ts`)**
   ```typescript
   .option("team", {
     describe: "Azure DevOps team name for iteration path discovery (optional)",
     type: "string"
   })
   ```

2. **Configuration Interface (`src/config/config.ts`)**
   ```typescript
   export interface CLIArguments {
     team?: string;
     // ... other fields
   }
   
   export interface AzureDevOpsConfig {
     team?: string;
     // ... other fields
   }
   ```

3. **Discovery Service (`src/services/ado-discovery-service.ts`)**
   ```typescript
   export async function getCurrentIterationPath(
     organization: string,
     project: string,
     areaPath: string,
     teamOverride?: string  // NEW
   ): Promise<string | null> {
     let teamName: string;
     
     if (teamOverride) {
       teamName = teamOverride;
       logger.debug(`Using explicit team name from configuration: ${teamName}`);
     } else {
       // Extract from area path
       const segments = areaPath.split('\\').filter(s => s.length > 0);
       teamName = segments[1];
       logger.debug(`Extracted team name from area path: ${teamName}`);
     }
     
     // Use teamName in API call
   }
   ```

4. **Configuration Helper (`src/config/config.ts`)**
   ```typescript
   export async function ensureCurrentIterationPath(): Promise<string | null> {
     const config = loadConfiguration();
     const iterationPath = await getCurrentIterationPath(
       config.azureDevOps.organization,
       config.azureDevOps.project,
       primaryAreaPath,
       config.azureDevOps.team  // Pass team override
     );
   }
   ```

### Backward Compatibility

- `--team` parameter is **optional**
- Default behavior unchanged: extract team from area path
- Existing configurations work without modification
- Only needed for non-standard area path structures

## Testing

### Unit Tests

File: `mcp_server/test/unit/current-iteration-discovery.test.ts`

**New Test Coverage:**
- ✅ Use explicit team override when provided
- ✅ Extract team from area path when no override
- ✅ Verify API URL uses correct team name
- ✅ Handle API errors with helpful hints

**Example Test:**
```typescript
it('should use explicit team override when provided', async () => {
  const mockResponse = {
    data: {
      value: [{
        id: 'iter-456',
        name: 'Sprint 15',
        path: 'One\\Krypton',
        attributes: { timeFrame: 'current' }
      }]
    }
  };

  (mockGet as any).mockResolvedValue(mockResponse);

  // Non-standard area path with team override
  const result = await getCurrentIterationPath(
    'myorg',
    'One',
    'One\\Custom\\Azure\\Path',
    'Krypton'  // Team override
  );

  expect(result).toBe('One\\Krypton');
  expect(mockGet).toHaveBeenCalledWith(
    expect.stringContaining('/Krypton/_apis/work/teamsettings/iterations')
  );
});
```

### Manual Testing

1. **Standard area path (no override):**
   ```bash
   enhanced-ado-mcp myorg --area-path "MyProject\\TeamName"
   ```
   - Should extract "TeamName" and discover iteration

2. **Non-standard area path with override:**
   ```bash
   enhanced-ado-mcp myorg --area-path "One\\Custom\\Azure\\Path" --team "Krypton"
   ```
   - Should use "Krypton" and discover iteration

3. **Wrong team name (intentional failure):**
   ```bash
   enhanced-ado-mcp myorg --area-path "One\\Custom\\Azure\\Path" --team "WrongTeam"
   ```
   - Should fail with clear error message

## Integration Points

### Work Item Creation

Work items created after server startup will use the discovered iteration path, regardless of whether the team was explicitly provided or auto-detected.

### Configuration Tool

`wit-get-configuration` displays the team override if configured:

```json
{
  "azureDevOps": {
    "organization": "myorg",
    "project": "One",
    "areaPath": "One\\Custom\\Azure\\Path",
    "team": "Krypton",
    "iterationPath": "One\\Krypton"
  }
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-07 | Initial implementation with `--team` CLI flag |

## Related Features

- [Current Iteration Path Discovery](current-iteration-path-discovery.md) - Base feature
- [Automatic Project Extraction](automatic-project-extraction.md) - Similar configuration pattern

## Future Enhancements

### Potential Improvements

1. **Area Path to Team Mapping:** Configuration file with custom mappings
   ```json
   {
     "teamMappings": {
       "One\\Custom\\Azure\\*": "Krypton",
       "ProjectA\\Complex\\Path\\*": "AlphaTeam"
     }
   }
   ```

2. **Team Auto-Discovery:** Try multiple segments until a valid team is found
3. **Team Validation:** Warn if specified team doesn't exist in the project
4. **Multi-Team Support:** Different team names for different area paths

### Known Limitations

1. **Single Team Assumption:** Only one team override can be specified
   - If you have multiple area paths with different teams, they all use the same team override
   - Workaround: Start separate server instances for each team

2. **Manual Configuration:** No automatic detection of correct team name
   - User must know the correct team name in Azure DevOps
   - Could be improved with team validation/suggestion

---

**Last Updated:** 2025-11-07  
**Author:** Enhanced ADO MCP Server Team
