# Parameter Case Migration Guide

## Summary

**All tool parameters now use camelCase consistently.** This aligns with the Model Context Protocol specification and official MCP server examples.

## What Changed

### Before (v1.3.x and earlier)
```json
{
  "Title": "My work item",
  "WorkItemId": 12345,
  "AreaPath": "Project\\Area"
}
```

### After (v1.4.0+)
```json
{
  "title": "My work item",
  "workItemId": 12345,
  "areaPath": "Project\\Area"
}
```

## Why This Change Was Made

1. **MCP Standard Compliance**: The Model Context Protocol specification and all official MCP servers use camelCase for parameters
2. **Internal Consistency**: Our Zod validation schemas already used camelCase
3. **Developer Expectations**: camelCase is the JavaScript/TypeScript standard for parameter names

## Migration Required

If you have existing scripts, prompts, or automation that calls these tools, you MUST update parameter names from PascalCase to camelCase.

## Complete Parameter Mapping

| Old (PascalCase) | New (camelCase) |
|-----------------|-----------------|
| `Title` | `title` |
| `WorkItemId` | `workItemId` |
| `WorkItemIds` | `workItemIds` |
| `ParentWorkItemId` | `parentWorkItemId` |
| `Description` | `description` |
| `Tags` | `tags` |
| `WorkItemType` | `workItemType` |
| `AreaPath` | `areaPath` |
| `IterationPath` | `iterationPath` |
| `AssignedTo` | `assignedTo` |
| `Priority` | `priority` |
| `Repository` | `repository` |
| `Branch` | `branch` |
| `GitHubCopilotGuid` | `gitHubCopilotGuid` |
| `IncludeHistory` | `includeHistory` |
| `IncludeComments` | `includeComments` |
| `IncludeRelations` | `includeRelations` |
| `IncludeChildren` | `includeChildren` |
| `IncludeParent` | `includeParent` |
| `IncludeExtendedFields` | `includeExtendedFields` |
| `IncludeFields` | `includeFields` |
| `IncludeTags` | `includeTags` |
| `MaxResults` | `maxResults` |
| `MaxChildDepth` | `maxChildDepth` |
| `WiqlQuery` | `wiqlQuery` |
| `Organization` | `organization` |
| `Project` | `project` |
| `NewState` | `newState` |
| `DryRun` | `dryRun` |
| `Comment` | `comment` |
| `Reason` | `reason` |
| `Items` | `items` |
| `Template` | `template` |
| `TemplateVariables` | `templateVariables` |
| `MinInactiveDays` | `minInactiveDays` |
| `ExcludeStates` | `excludeStates` |
| `IncludeSubAreas` | `includeSubAreas` |
| `IncludeSignals` | `includeSignals` |
| `IncludeSubstantiveChange` | `includeSubstantiveChange` |
| `Patterns` | `patterns` |
| `AnalysisType` | `analysisType` |
| `ContextInfo` | `contextInfo` |
| `AcceptanceCriteria` | `acceptanceCriteria` |
| `EnhanceDescription` | `enhanceDescription` |
| `CreateInADO` | `createInADO` |
| `ScanType` | `scanType` |
| `IncludeWorkItemDetails` | `includeWorkItemDetails` |
| `ExtractFromComments` | `extractFromComments` |
| `HistoryCount` | `historyCount` |
| `AutomatedPatterns` | `automatedPatterns` |
| `AnalysisDepth` | `analysisDepth` |
| `SuggestAlternatives` | `suggestAlternatives` |
| `IncludeConfidenceScores` | `includeConfidenceScores` |
| `FilterByWorkItemType` | `filterByWorkItemType` |
| `MaxItemsToAnalyze` | `maxItemsToAnalyze` |
| `IncludeChildAreas` | `includeChildAreas` |
| `ValidateTypes` | `validateTypes` |
| `ValidateStates` | `validateStates` |
| `IncludeSensitive` | `includeSensitive` |
| `Section` | `section` |
| `ReturnFormat` | `returnFormat` |
| `IncludeStateCounts` | `includeStateCounts` |
| `IncludeStoryPointAggregation` | `includeStoryPointAggregation` |
| `IncludeRiskScoring` | `includeRiskScoring` |
| `IncludeAIAssignmentHeuristic` | `includeAIAssignmentHeuristic` |
| `IncludeParentOutsideSet` | `includeParentOutsideSet` |
| `IncludeChildrenOutsideSet` | `includeChildrenOutsideSet` |
| `MaxOutsideReferences` | `maxOutsideReferences` |
| `OutputFormat` | `outputFormat` |

## Example Updates

### Creating a Work Item

**Old:**
```typescript
{
  "Title": "Implement feature X",
  "Description": "Add new functionality",
  "WorkItemType": "Task",
  "Priority": 1
}
```

**New:**
```typescript
{
  "title": "Implement feature X",
  "description": "Add new functionality",
  "workItemType": "Task",
  "priority": 1
}
```

### WIQL Query

**Old:**
```typescript
{
  "WiqlQuery": "SELECT [System.Id] FROM WorkItems",
  "MaxResults": 100
}
```

**New:**
```typescript
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems",
  "maxResults": 100
}
```

### Bulk Operations

**Old:**
```typescript
{
  "WorkItemIds": [1, 2, 3],
  "NewState": "Removed",
  "DryRun": true
}
```

**New:**
```typescript
{
  "workItemIds": [1, 2, 3],
  "newState": "Removed",
  "dryRun": true
}
```

## Verifying Your Updates

After updating your code, you can verify the correct parameter names by:

1. **Checking the tool schema**: Use `wit-get-configuration` to see current available tools
2. **Reviewing error messages**: The server will provide clear validation errors if you use incorrect parameter casing
3. **Testing incrementally**: Update one tool call at a time and verify it works before proceeding

## Beta Tester Note

If you encountered errors stating that tools require both PascalCase AND camelCase simultaneously, this was confusion from testing during the transition. The current version (v1.4.0+) only accepts and validates camelCase parameters.

## Support

If you encounter issues after migration:

1. Verify you're running the latest built version: `cd mcp_server && npm run build`
2. Check that your MCP client has refreshed the tool schemas
3. Ensure all parameter names match the camelCase format exactly
4. Review the error messages - they will indicate which parameters are incorrectly named

## Technical Background

**Why We Had PascalCase Before**: The original implementation mimicked PowerShell script parameters, which use PascalCase by convention.

**Why We Changed to camelCase**: 
- MCP specification uses camelCase (see modelcontextprotocol/servers repository)
- JavaScript/TypeScript conventions use camelCase
- Our internal Zod schemas already used camelCase
- Alignment with industry standards improves interoperability
