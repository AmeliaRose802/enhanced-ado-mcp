# Automatic Project Extraction from Area Path

**Status:** Implemented  
**Version:** 1.8.0  
**Related:** Configuration System

## Overview

The project name can be automatically extracted from the area path, eliminating the requirement to provide both parameters explicitly. Azure DevOps area paths follow the format `ProjectName\Area\SubArea`, where the first segment is always the project name.

## Purpose

**Problem Solved:**
- Reduces configuration complexity by eliminating redundant parameter
- Simplifies CLI usage for common scenarios
- Prevents configuration errors from mismatched project/area path values

**Use Cases:**
- Starting the MCP server with just organization and area path
- Simplified configuration for single-project teams
- Backward compatible with explicit project specification

## User-Facing Behavior

### Minimal Configuration
Users can now start the server without specifying project explicitly:

```bash
# Project "MyProject" extracted automatically
enhanced-ado-msp myorg --area-path "MyProject\\Team\\SubArea"
```

### Explicit Project (Still Supported)
Users can still provide project explicitly if desired:

```bash
# Explicit project takes precedence
enhanced-ado-msp myorg myproject --area-path "MyProject\\Team"
```

### Extraction Logic
1. If explicit `project` parameter is provided, use it
2. If no `project` but `area-path` is provided, extract from area path first segment
3. If neither provided, throw configuration error

## Input Parameters

### CLI Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `organization` | Yes | Azure DevOps organization | `myorg` |
| `project` | No* | Project name (optional if area-path provided) | `myproject` |
| `--area-path` | No* | Area path including project name | `MyProject\\Team` |

*Either `project` or `--area-path` must be provided.

### Validation Rules

```bash
# Valid: Explicit project
enhanced-ado-msp myorg myproject

# Valid: Project from area path
enhanced-ado-msp myorg --area-path "MyProject\\Team"

# Valid: Both (explicit takes precedence)
enhanced-ado-msp myorg myproject --area-path "MyProject\\Team"

# Invalid: Neither project nor area path
enhanced-ado-msp myorg
# Error: "Either <project> or --area-path must be provided"
```

## Output Format

### Success - Extracted Project

```
✓ Extracted project name 'MyProject' from area path 'MyProject\Team\Area'
enhanced-ado-msp MCP server starting (stdio)
```

### Success - Explicit Project

```
enhanced-ado-msp MCP server starting (stdio)
```

### Error - Missing Configuration

```
Error: Either <project> or --area-path must be provided
Usage: enhanced-ado-msp <organization> [project] --area-path <path> [options]

Note: Project can be omitted if --area-path is provided (will be extracted automatically)
```

## Examples

### Example 1: Extract from Simple Area Path

**Input:**
```bash
enhanced-ado-msp myorg --area-path "MyProject\\Team"
```

**Behavior:**
- Extracts `MyProject` from area path
- Uses `MyProject` as project name
- Continues with normal startup

### Example 2: Extract from Multi-Level Area Path

**Input:**
```bash
enhanced-ado-msp myorg --area-path "MyProject\\Team\\SubTeam\\Component"
```

**Behavior:**
- Extracts `MyProject` (first segment only)
- Ignores nested segments `Team\\SubTeam\\Component`
- Uses extracted project for Azure DevOps API calls

### Example 3: Explicit Project Takes Precedence

**Input:**
```bash
enhanced-ado-msp myorg ExplicitProject --area-path "AreaProject\\Team"
```

**Behavior:**
- Uses `ExplicitProject` (not `AreaProject`)
- Explicit parameter always wins
- Useful for advanced scenarios

### Example 4: Error Case - Malformed Area Path

**Input:**
```bash
enhanced-ado-msp myorg --area-path ""
```

**Behavior:**
```
Error: Project is required. Provide either:
  1. Project as positional argument: enhanced-ado-msp <organization> <project>
  2. Area path that includes project: --area-path "ProjectName\\Area"
```

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| "Either <project> or --area-path must be provided" | No project or area path | Provide at least one parameter |
| "Project is required. Provide either..." | Empty or invalid area path | Use valid area path format |

### Extraction Edge Cases

| Area Path | Extracted Project | Notes |
|-----------|------------------|-------|
| `Project\\Team` | `Project` | ✅ Standard case |
| `Project` | `Project` | ✅ Single segment |
| `\\Project\\Team` | `Project` | ✅ Leading backslash filtered |
| `Project\\\\Team` | `Project` | ✅ Empty segments filtered |
| `` (empty) | `null` | ❌ Error - invalid |

## Implementation Details

### Key Components

- **Function:** `extractProjectFromAreaPath()` in `src/config/config.ts`
- **CLI Parser:** Modified yargs configuration in `src/index.ts`
- **Config Loader:** Updated `loadConfiguration()` in `src/config/config.ts`
- **Tests:** `test/unit/config-types.test.ts`

### Extraction Algorithm

```typescript
export function extractProjectFromAreaPath(areaPath: string): string | null {
  if (!areaPath || typeof areaPath !== 'string') {
    return null;
  }
  
  // Split on backslash, filter empty segments
  const segments = areaPath.split('\\').filter(s => s.length > 0);
  if (segments.length === 0) {
    return null;
  }
  
  // First segment is always project name in Azure DevOps
  return segments[0];
}
```

### Configuration Priority

1. **Explicit project parameter** (highest)
2. **Extracted from area path** (if project not provided)
3. **Error** (if neither available)

```typescript
let project = cliArgs.project;
if (!project && cliArgs.areaPath) {
  const extractedProject = extractProjectFromAreaPath(cliArgs.areaPath);
  if (extractedProject) {
    project = extractedProject;
    logger.info(`Extracted project '${project}' from area path`);
  }
}
```

## Testing

### Test Files

- Unit tests: `test/unit/config-types.test.ts`

### Test Coverage

- [x] Extract from simple area path
- [x] Extract from multi-level area path
- [x] Handle single segment (project only)
- [x] Return null for empty string
- [x] Return null for null/undefined input
- [x] Handle area paths with spaces
- [x] Filter empty segments from malformed paths
- [x] Prefer explicit project over extracted
- [x] Error when neither provided

### Manual Testing

```bash
# Test extraction
npm run build
node dist/index.js myorg --area-path "TestProject\\Team"

# Should output:
# ✓ Extracted project name 'TestProject' from area path...
```

## Migration Guide

### Existing Configurations

**Old format (still works):**
```json
{
  "command": "npx",
  "args": ["-y", "enhanced-ado-mcp-server", "ORG", "PROJECT", "--area-path", "PROJECT\\TEAM"]
}
```

**New simplified format:**
```json
{
  "command": "npx",
  "args": ["-y", "enhanced-ado-mcp-server", "ORG", "--area-path", "PROJECT\\TEAM"]
}
```

### Benefits of Migration

- ✅ Fewer parameters to configure
- ✅ Reduced risk of project/area-path mismatch
- ✅ Cleaner configuration files
- ✅ Backward compatible (old format still works)

## Related Features

- [Configuration System](../../mcp_server/src/config/config.ts)
- [CLI Argument Parsing](../../mcp_server/src/index.ts)

## Changelog

- **v1.8.0** (2025-10-16) - Initial implementation of automatic project extraction

## References

- Azure DevOps Area Path Format: `ProjectName\AreaPath\SubArea`
- Configuration system refactoring for simplified setup

---

**Last Updated:** 2025-10-16  
**Author:** Enhanced ADO MCP Server Team
