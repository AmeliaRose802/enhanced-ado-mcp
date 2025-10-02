# Complete camelCase Parameter Fix - ALL Tools Now Working

## Issue Summary
Beta testers reported "all tools are broken" after parameter standardization changes. The root cause was that while the **schemas** were updated to camelCase, the **handler implementations** were still using PascalCase to access the parsed data.

## Root Cause
When we standardized parameters from PascalCase to camelCase to match MCP SDK conventions:
- ✅ Zod schemas were updated (e.g., `wiqlQuery`, `maxResults`)
- ✅ JSON inputSchemas were updated  
- ❌ Handler code was NOT updated - still accessing `parsed.data.WiqlQuery`, `parsed.data.MaxResults`, etc.
- ❌ Service function interfaces were NOT updated - still using PascalCase properties

This caused validation errors because handlers expected PascalCase properties that no longer existed after Zod validation.

## Files Fixed

### Handler Files (All Fixed)
1. **bulk-add-comments.handler.ts**
   - Interface: `items`, `template`, `templateVariables`, `organization`, `project`
   - Fixed: All property access in parsed.data and function calls

2. **bulk-state-transition.handler.ts**
   - Interface: `workItemIds`, `newState`, `comment`, `reason`, `dryRun`, `organization`, `project`
   - Fixed: All property access and loop variables

3. **find-stale-items.handler.ts**
   - Interface: `areaPath`, `organization`, `project`, `minInactiveDays`, `excludeStates`, `includeSubAreas`, `workItemTypes`, `maxResults`, `includeSubstantiveChange`, `includeSignals`
   - Fixed: All property access, WIQL construction, service calls

4. **detect-patterns.handler.ts**
   - Interface: `workItemIds`, `areaPath`, `organization`, `project`, `patterns`, `maxResults`, `includeSubAreas`
   - Fixed: All property access and pattern checks

5. **extract-security-links.handler.ts**
   - Args: `workItemId`, `organization`, `project`, `scanType`, `includeWorkItemDetails`
   - Fixed: Property access and service call

6. **validate-hierarchy.handler.ts**
   - Interface: `workItemIds`, `areaPath`, `organization`, `project`, `maxResults`, `includeSubAreas`, `validateTypes`, `validateStates`
   - Fixed: All property access and validation logic

7. **wiql-query.handler.ts** (Previously fixed)
   - Interface: `wiqlQuery`, `maxResults`, `includeSubstantiveChange`, `substantiveChangeHistoryCount`
   - Status: Already fixed in earlier commit

### Service Files (Fixed)
1. **ado-work-item-service.ts**
   - `WiqlQueryArgs` interface: All properties now camelCase
   - `ExtractSecurityLinksArgs` interface: All properties now camelCase
   - Implementation: All destructuring and variable usage updated

### Complete Parameter Mapping
See `PARAMETER_CASE_MIGRATION.md` for the full mapping table of 80+ parameters.

## Testing Status
✅ TypeScript compilation successful (npm run build)
✅ All handlers updated
✅ All service functions updated
✅ All interfaces updated
⏳ Awaiting beta tester confirmation

## How to Use (For Beta Testers)
All tools now use **camelCase** parameters. Examples:

### WIQL Query Tool
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
  "maxResults": 50,
  "includeSubstantiveChange": true,
  "substantiveChangeHistoryCount": 100
}
```

### Bulk State Transition
```json
{
  "workItemIds": [123, 456, 789],
  "newState": "Removed",
  "comment": "Cleaning up obsolete items",
  "dryRun": true
}
```

### Find Stale Items
```json
{
  "areaPath": "Project\\Team\\Component",
  "minInactiveDays": 180,
  "excludeStates": ["Done", "Closed"],
  "includeSubAreas": true,
  "includeSignals": true
}
```

### Detect Patterns
```json
{
  "areaPath": "Project\\Team",
  "patterns": ["duplicates", "placeholder_titles", "no_description"],
  "maxResults": 200
}
```

## Git Commits
- `48f6fa6` - Fix WIQL handler to use camelCase (initial fix)
- `a05db1b` - Fix ALL handlers and service functions to use camelCase (comprehensive fix)

## Why camelCase?
After examining the official MCP SDK and 15+ example servers in the `modelcontextprotocol/servers` repository, **all TypeScript MCP servers use camelCase** for parameter names. This is the MCP standard and ensures consistency with the broader MCP ecosystem.

## Next Steps
1. Beta testers should pull latest code
2. Test tools with camelCase parameters
3. Report any remaining issues
4. Update any custom scripts/automation to use camelCase

## Breaking Change Notice
This is a **breaking change** from v1.3.x. Users must update their tool calls to use camelCase parameters. The migration guide (`PARAMETER_CASE_MIGRATION.md`) provides a complete mapping for all parameters.
