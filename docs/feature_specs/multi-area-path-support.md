# Multi-Area Path Support

**Status:** Planned  
**Version:** Future (2.0.0)  
**Related:** Configuration System, Query Generation, Discovery Tools

## Overview

Enable the Enhanced ADO MCP Server to support multiple area paths simultaneously, allowing users to work across multiple teams, projects, or organizational boundaries within a single MCP server instance.

## Purpose

**Problem Solved:**
- Current limitation: Server configured for a single area path at startup
- Users managing work across multiple teams must run separate server instances
- Cross-team queries and bulk operations require manual workarounds
- No unified view of work items spanning multiple areas

**Use Cases:**
- Engineering managers overseeing multiple teams
- Platform teams supporting multiple product areas
- Cross-functional initiatives spanning organizational boundaries
- Portfolio-level planning and analysis
- Shared services teams working across multiple projects

## Proposed User-Facing Behavior

### Multi-Area Path Configuration

#### Option 1: Array-Based Configuration (Recommended)
```bash
# Multiple area paths via repeated CLI argument
enhanced-ado-msp MyOrg --area-path "ProjectA\\TeamAlpha" --area-path "ProjectB\\TeamBeta" --area-path "ProjectA\\TeamGamma"

# Or via configuration file
{
  "azureDevOps": {
    "organization": "MyOrg",
    "areaPaths": [
      "ProjectA\\\\TeamAlpha",
      "ProjectB\\\\TeamBeta",
      "ProjectA\\\\TeamGamma"
    ]
  }
}
```

#### Option 2: Wildcard/Pattern Support
```bash
# Wildcard support for hierarchical selection
enhanced-ado-msp MyOrg --area-path "ProjectA\\*"  # All areas under ProjectA
enhanced-ado-msp MyOrg --area-path "ProjectA\\Team*"  # Pattern matching
```

### Tool Behavior Changes

#### Query Tools
**Current:** Single area path implicitly used in all queries
**Proposed:** 
- Default behavior: Query ALL configured area paths
- Optional parameter: `areaPathFilter` to specify subset
- Query result metadata includes area path per item

**Example:**
```javascript
// Query across all configured area paths
wit-wiql-query({
  query: "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'",
  returnQueryHandle: true
})

// Query specific area paths only
wit-wiql-query({
  query: "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'",
  areaPathFilter: ["ProjectA\\\\TeamAlpha"],
  returnQueryHandle: true
})
```

#### Work Item Creation
**Current:** Uses configured area path by default
**Proposed:**
- Require explicit `areaPath` parameter when multiple paths configured
- Or: Use first configured path as default with warning
- Validate area path is in configured list

**Example:**
```javascript
wit-create-work-item({
  workItemType: "Bug",
  title: "Critical issue",
  areaPath: "ProjectA\\\\TeamAlpha",  // Required when multiple paths configured
  description: "Details..."
})
```

#### Bulk Operations
**Current:** Operate on query handle (already area-agnostic)
**Proposed:** No changes needed - query handles already support cross-area operations

#### Discovery Tools
**Current:** Return resources for single configured area
**Proposed:** Return resources across all configured areas with area grouping

**Example Output:**
```json
{
  "areaPaths": [
    {
      "path": "ProjectA\\\\TeamAlpha",
      "project": "ProjectA",
      "iterations": [...],
      "repositoryLinks": [...]
    },
    {
      "path": "ProjectB\\\\TeamBeta",
      "project": "ProjectB",
      "iterations": [...],
      "repositoryLinks": [...]
    }
  ]
}
```

## Input Parameters

### Configuration Schema Changes

#### CLI Arguments
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--area-path` | string[] | Yes* | One or more area paths (repeatable) |
| `--area-pattern` | string[] | No | Wildcard patterns for area path discovery |

*At least one `--area-path` or `--area-pattern` required

#### Configuration File
```typescript
interface AzureDevOpsConfig {
  organization: string;
  project?: string;  // Optional when area paths specify projects
  
  // NEW: Support both single and multiple area paths
  areaPath?: string;  // Deprecated, maintained for backward compatibility
  areaPaths?: string[];  // New: Array of area paths
  areaPatterns?: string[];  // New: Wildcard patterns
}
```

### Tool Parameter Changes

#### Query Tools
Add optional parameter to all query tools:
```typescript
areaPathFilter?: string[];  // Subset of configured area paths to query
```

#### Work Item Creation Tools
Behavior change when multiple area paths configured:
```typescript
areaPath: string;  // Becomes REQUIRED (not optional) when multiple configured
```

## Output Format

### Query Results
Add area path metadata to all query results:

**Before:**
```json
{
  "items": [
    { "id": 12345, "title": "Fix bug", "state": "Active" }
  ]
}
```

**After:**
```json
{
  "items": [
    { 
      "id": 12345, 
      "title": "Fix bug", 
      "state": "Active",
      "areaPath": "ProjectA\\\\TeamAlpha",  // NEW
      "project": "ProjectA"  // NEW
    }
  ],
  "areaPathSummary": {  // NEW: Aggregate statistics
    "ProjectA\\\\TeamAlpha": { "count": 15, "stateCounts": { "Active": 5, "New": 10 } },
    "ProjectB\\\\TeamBeta": { "count": 8, "stateCounts": { "Active": 3, "New": 5 } }
  }
}
```

### Discovery Tools
Group discovered resources by area path:

```json
{
  "organization": "MyOrg",
  "configuredAreaPaths": [
    "ProjectA\\\\TeamAlpha",
    "ProjectB\\\\TeamBeta"
  ],
  "resources": {
    "ProjectA\\\\TeamAlpha": {
      "iterations": [...],
      "workItemTypes": [...],
      "states": {...},
      "repositories": [...]
    },
    "ProjectB\\\\TeamBeta": {
      "iterations": [...],
      "workItemTypes": [...],
      "states": {...},
      "repositories": [...]
    }
  }
}
```

## Error Handling

### Configuration Errors

| Error Condition | Error Message | Resolution |
|----------------|---------------|------------|
| No area paths provided | "At least one area path must be configured" | Provide `--area-path` or `--area-pattern` |
| Empty area path in list | "Area path cannot be empty: index 2" | Remove empty entries |
| Conflicting project names | "Multiple projects detected: ProjectA, ProjectB. Explicit project parameter required." | Add `--project` parameter or use single-project area paths |
| Invalid area path format | "Invalid area path format: 'InvalidPath'. Must contain backslashes." | Use correct format: "Project\\Area\\SubArea" |
| Area path not in config | "Area path 'ProjectC\\\\TeamGamma' not in configured paths" | Add to configuration or use configured path |

### Runtime Errors

| Error Condition | Error Message | Resolution |
|----------------|---------------|------------|
| Area path required for creation | "areaPath is required when multiple area paths are configured" | Specify explicit areaPath parameter |
| Area path filter invalid | "areaPathFilter contains invalid path: 'ProjectX'" | Use only configured area paths |
| Discovery timeout | "Failed to discover resources for 2 of 5 configured area paths" | Check network connectivity and permissions |

## Implementation Details

### Key Components

#### 1. Configuration Loading (`config/config.ts`)
**Changes:**
- Support `areaPaths` array in addition to single `areaPath`
- Validate area path format and uniqueness
- Extract projects from all area paths
- Handle backward compatibility with single `areaPath`

```typescript
export interface EnhancedConfig {
  azureDevOps: {
    organization: string;
    project?: string;
    areaPath?: string;  // Deprecated
    areaPaths?: string[];  // New
    areaPatterns?: string[];  // New
  };
}

function loadConfiguration(): Config {
  // Normalize single areaPath to areaPaths array
  const areaPaths = cliArgs.areaPaths || (cliArgs.areaPath ? [cliArgs.areaPath] : []);
  
  // Extract projects from all area paths
  const projects = new Set(areaPaths.map(extractProjectFromAreaPath));
  
  // Validate single project or require explicit project parameter
  if (projects.size > 1 && !cliArgs.project) {
    throw new Error("Multiple projects detected, explicit project parameter required");
  }
  
  return {
    azureDevOps: {
      organization: cliArgs.organization,
      project: cliArgs.project || Array.from(projects)[0],
      areaPaths: areaPaths
    }
  };
}
```

#### 2. Query Service Enhancement (`services/ado-work-item-service.ts`)
**Changes:**
- Accept optional `areaPathFilter` parameter
- Generate composite WIQL with multiple `UNDER` clauses
- Add area path metadata to results

```typescript
async function executeWiqlQuery(
  query: string, 
  options: { 
    areaPathFilter?: string[];  // NEW
    returnQueryHandle?: boolean;
    // ... other options
  }
): Promise<QueryResult> {
  const config = loadConfiguration();
  const areaPaths = options.areaPathFilter || config.azureDevOps.areaPaths;
  
  // Inject area path filtering into query if not already present
  const enhancedQuery = injectAreaPathFilter(query, areaPaths);
  
  // Execute query and add area path metadata
  const results = await executeQuery(enhancedQuery);
  return addAreaPathMetadata(results, areaPaths);
}

function injectAreaPathFilter(query: string, areaPaths: string[]): string {
  if (query.includes('[System.AreaPath]')) {
    // Query already has area path filtering, don't modify
    return query;
  }
  
  // Add area path filtering to WHERE clause
  const areaPathConditions = areaPaths
    .map(path => `[System.AreaPath] UNDER '${path}'`)
    .join(' OR ');
  
  return query.replace(/WHERE/, `WHERE (${areaPathConditions}) AND`);
}
```

#### 3. Discovery Service Enhancement (`services/ado-discovery-service.ts`)
**Changes:**
- Discover resources for each configured area path
- Group results by area path
- Parallelize discovery calls

```typescript
async function discoverAllResources(): Promise<MultiAreaDiscoveryResult> {
  const config = loadConfiguration();
  const areaPaths = config.azureDevOps.areaPaths;
  
  // Discover resources for each area path in parallel
  const discoveries = await Promise.allSettled(
    areaPaths.map(async (areaPath) => ({
      areaPath,
      resources: await discoverResourcesForAreaPath(areaPath)
    }))
  );
  
  // Aggregate successful discoveries
  return {
    organization: config.azureDevOps.organization,
    configuredAreaPaths: areaPaths,
    resources: Object.fromEntries(
      discoveries
        .filter(d => d.status === 'fulfilled')
        .map(d => [d.value.areaPath, d.value.resources])
    ),
    errors: discoveries
      .filter(d => d.status === 'rejected')
      .map(d => d.reason)
  };
}
```

#### 4. Work Item Creation Validation
**Changes:**
- Validate area path is in configured list
- Require area path when multiple configured

```typescript
async function createWorkItem(args: CreateWorkItemArgs): Promise<WorkItem> {
  const config = loadConfiguration();
  const areaPaths = config.azureDevOps.areaPaths;
  
  // Require area path when multiple configured
  if (areaPaths.length > 1 && !args.areaPath) {
    throw new Error(
      `areaPath is required when multiple area paths are configured. ` +
      `Available: ${areaPaths.join(', ')}`
    );
  }
  
  // Validate area path is in configured list
  const areaPath = args.areaPath || areaPaths[0];
  if (!areaPaths.includes(areaPath)) {
    throw new Error(
      `Area path '${areaPath}' not in configured paths: ${areaPaths.join(', ')}`
    );
  }
  
  // Create work item with validated area path
  return await adoClient.createWorkItem(areaPath, args);
}
```

### Integration Points

| Component | Changes Required | Complexity |
|-----------|-----------------|------------|
| Configuration loading | Support array of area paths, backward compatibility | Medium |
| Query service | Multi-area WIQL generation, result metadata | High |
| Discovery service | Parallel resource discovery, grouping | Medium |
| Work item creation | Area path validation, required parameter | Low |
| Query handle service | No changes (already area-agnostic) | None |
| Bulk operations | No changes (operate on query handles) | None |
| Prompt templates | Update context variables, multi-area examples | Low |

## Testing

### Unit Tests
- Configuration loading with multiple area paths
- Area path validation (empty, duplicates, invalid format)
- WIQL injection with multiple `UNDER` clauses
- Area path metadata addition to results
- Backward compatibility with single area path

### Integration Tests
- Query execution across multiple area paths
- Work item creation with explicit area path
- Discovery service with multiple areas
- Cross-project queries (when supported)
- Error handling for invalid area path references

### Manual Testing
- Configure server with 3+ area paths across 2 projects
- Execute queries without area path filter (should query all)
- Execute queries with area path filter (should query subset)
- Create work items in different configured areas
- Verify discovery returns grouped resources
- Test backward compatibility with single area path config

## Migration Path

### Phase 1: Backward Compatible (v1.9.0)
- Support both `areaPath` (string) and `areaPaths` (array)
- Single area path behaves identically to current version
- Add `areaPathFilter` parameter to query tools (optional)
- Add deprecation warning for single `areaPath`

### Phase 2: Multi-Area Default (v2.0.0)
- Make `areaPath` parameter required for work item creation when multiple configured
- Enable cross-area queries by default
- Add area path metadata to all query results
- Update documentation and examples

### Phase 3: Pattern Support (v2.1.0)
- Implement wildcard pattern matching for area paths
- Auto-discovery of area paths matching patterns
- Dynamic area path list updates

## Open Questions

1. **Cross-Project Operations:**
   - Should we support area paths from different organizations?
   - How do we handle different project-level configurations (work item types, states)?
   
2. **Performance Considerations:**
   - What is the maximum recommended number of configured area paths?
   - Should we implement pagination for multi-area discovery?
   - Do we need caching for discovered resources?

3. **Query Generation:**
   - Should AI query generators automatically include all area paths?
   - How do we communicate multi-area context to LLMs?

4. **Default Behavior:**
   - When creating work items with multiple areas, should we prompt user for area selection?
   - Should first configured area be default, or should we error?

5. **Prompt Templates:**
   - How do we update prompt variables (`{{area_path}}`) for multi-area support?
   - Should prompts loop over all areas or use aggregate queries?

## Success Criteria

- [ ] Users can configure multiple area paths via CLI or config file
- [ ] Query tools respect `areaPathFilter` parameter
- [ ] Work item creation validates area path against configured list
- [ ] Discovery returns resources grouped by area path
- [ ] Query results include area path metadata
- [ ] Backward compatibility maintained for single area path
- [ ] Documentation updated with multi-area examples
- [ ] Integration tests pass for 3+ area paths
- [ ] Performance acceptable with 10+ configured area paths

## Future Enhancements

- **Dynamic Area Path Management:** Add/remove area paths without restarting server
- **Area Path Groups:** Define named groups of area paths for common query scenarios
- **Hierarchical Rollup:** Aggregate metrics across area path hierarchies
- **Area Path Permissions:** Respect user's area path permissions from ADO
- **Smart Defaults:** Auto-select area path based on conversation context
