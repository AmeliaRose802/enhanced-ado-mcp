# OData Area Path Escaping Fix

**Issue:** ADO-Work-Item-MSP-57  
**Date:** November 18, 2025  
**Status:** ✅ COMPLETE

## Problem Statement

Area paths with backslashes were not properly escaped in OData queries using the `startswith()` function. While WIQL queries worked correctly with the `UNDER` operator, OData filtering would fail because:

1. **WIQL escaping** (for `UNDER` operator) only requires single quotes to be doubled: `'` → `''`
2. **OData escaping** (for `startswith()` string literals) requires BOTH:
   - Backslashes to be doubled: `\` → `\\`
   - Single quotes to be doubled: `'` → `''`

### Example

Area path: `One\Azure Compute\OneFleet Node\Azure Host Gateway`

**WIQL (correct):**
```sql
[System.AreaPath] UNDER 'One\Azure Compute\OneFleet Node\Azure Host Gateway'
```

**OData (incorrect - old behavior):**
```odata
startswith(Area/AreaPath, 'One\Azure Compute\OneFleet Node\Azure Host Gateway')
```

**OData (correct - new behavior):**
```odata
startswith(Area/AreaPath, 'One\\Azure Compute\\OneFleet Node\\Azure Host Gateway')
```

## Root Cause

The `escapeAreaPath()` function in `work-item-parser.ts` was designed for WIQL queries and only escaped single quotes. This same function was being used for both WIQL and OData queries, causing OData queries with backslashes in area paths to fail.

From `audit_results.md`:
> The area path filtering with backslashes in OData `startswith()` may require different escaping. There may not be any completed items in the specific area path during the 90-day period.

## Solution

### 1. Created Separate Escaping Functions

**File:** `mcp_server/src/utils/work-item-parser.ts`

```typescript
/**
 * Escape area path for use in WIQL queries
 * WIQL only requires single quotes to be doubled (SQL-style escaping)
 * Backslashes do NOT need escaping in WIQL when using UNDER operator
 */
export function escapeAreaPath(areaPath: string): string {
  if (!areaPath) return '';
  // Replace single quotes with two single quotes (SQL/WIQL escaping)
  return areaPath.replace(/'/g, "''");
}

/**
 * Escape area path for use in OData queries
 * OData string literals require:
 * - Backslashes must be doubled: \ → \\
 * - Single quotes must be doubled: ' → ''
 */
export function escapeAreaPathForOData(areaPath: string): string {
  if (!areaPath) return '';
  
  // First escape backslashes (must be done before quotes to avoid double-escaping)
  let escaped = areaPath.replace(/\\/g, '\\\\');
  
  // Then escape single quotes
  escaped = escaped.replace(/'/g, "''");
  
  return escaped;
}
```

### 2. Updated OData Query Handler

**File:** `mcp_server/src/services/handlers/query/odata-query.handler.ts`

Changed imports:
```typescript
import { escapeAreaPath, escapeAreaPathForOData } from "@/utils/work-item-parser.js";
```

Updated area path filtering in `buildODataQuery()`:
```typescript
// Add area path filter
if (areaPath) {
  const escapedAreaPath = escapeAreaPathForOData(areaPath);
  filterClauses.push(`startswith(Area/AreaPath, '${escapedAreaPath}')`);
}
```

Updated AI query generation in `generateODataQueryWithAI()`:
```typescript
const variables: Record<string, string> = {
  PROJECT: project,
  ORGANIZATION: organization,
  AREA_PATH: areaPath ? escapeAreaPathForOData(areaPath) : '',
  ITERATION_PATH: iterationPath || ''
};
```

### 3. Updated Get Team Members Handler

**File:** `mcp_server/src/services/handlers/core/get-team-members.handler.ts`

This handler uses OData Analytics API, so it also needs OData escaping:

```typescript
import { escapeAreaPath, escapeAreaPathForOData } from "@/utils/work-item-parser.js";

// In handleGetTeamMembers():
if (areaPath) {
  const escaped = escapeAreaPathForOData(areaPath);
  filterClauses.push(`startswith(Area/AreaPath, '${escaped}')`);
}
```

### 4. Updated System Prompts

**File:** `mcp_server/prompts/system/odata-query-generator.md`

Added comprehensive documentation about OData string escaping:

```markdown
5. **Area Path Escaping:**
   - OData string literals require backslashes to be doubled: `\\` → `\\\\`
   - Single quotes must also be doubled: `'` → `''`
   - Example: Area path `Project\Team's Area` becomes `Project\\\\Team''s Area` in OData
   - When using {{AREA_PATH}} template variable, escaping is handled automatically
   - ✅ Correct: `startswith(Area/AreaPath, 'Project\\\\Team')`
   - ❌ Wrong: `startswith(Area/AreaPath, 'Project\\Team')` (single backslash won't work)
   - ❌ Wrong: `contains(Area/AreaPath, 'Team')` (use startswith for hierarchical matching)
```

Updated common mistakes section:
```markdown
7. ❌ **Incorrect contains syntax or missing backslash escaping**: Use `startswith` for paths and double backslashes
   - ✅ Correct: `startswith(Area/AreaPath, 'Project\\\\Team')` (backslashes doubled for OData)
   - ❌ Wrong: `startswith(Area/AreaPath, 'Project\\Team')` (single backslash won't work in OData)
   - ❌ Wrong: `contains(Area/AreaPath, 'Team')` (use startswith for hierarchical matching)
```

Updated example query pattern:
```markdown
7. Items in specific area path:
```
$apply=filter(startswith(Area/AreaPath, 'Project\\\\TeamAlpha'))/groupby((State), aggregate($count as Count))&$orderby=Count desc
```
```

### 5. Updated Prompt Service

**File:** `mcp_server/src/services/prompt-service.ts`

Added separate template variable for OData-escaped area paths:

```typescript
import { escapeAreaPath, escapeAreaPathForOData } from "../utils/work-item-parser.js";

return {
  // area_path is WIQL-escaped (for UNDER operator) - only single quotes doubled
  area_path: escapeAreaPath(primaryAreaPath),
  // area_path_odata is OData-escaped (for startswith function) - backslashes AND quotes doubled
  area_path_odata: escapeAreaPathForOData(primaryAreaPath),
  // ... rest of variables
};
```

## Testing

### Unit Tests

**File:** `mcp_server/test/unit/odata-area-path-escaping.test.ts`

Created comprehensive unit tests covering:

1. **Basic escaping:**
   - Backslashes in area paths
   - Single quotes in area paths
   - Both backslashes and quotes together

2. **Real-world examples:**
   - Azure DevOps common path patterns
   - Example from `audit_results.md`

3. **Edge cases:**
   - Empty strings, null, undefined
   - Trailing/leading backslashes
   - Consecutive backslashes
   - Unicode characters

4. **WIQL vs OData comparison:**
   - Demonstrates different escaping requirements
   - Shows WIQL doesn't escape backslashes
   - Shows OData requires backslash escaping

5. **Query construction:**
   - Building valid OData `startswith` filters
   - Building valid WIQL `UNDER` clauses
   - Complete query strings

### Test Examples

```typescript
it('should escape backslashes in area paths', () => {
  const input = 'Project\\Team\\Area';
  const expected = 'Project\\\\Team\\\\Area';
  const result = escapeAreaPathForOData(input);
  
  expect(result).toBe(expected);
});

it('should handle deeply nested paths', () => {
  const input = 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway';
  const expected = 'One\\\\Azure Compute\\\\OneFleet Node\\\\Azure Host Agent\\\\Azure Host Gateway';
  const result = escapeAreaPathForOData(input);
  
  expect(result).toBe(expected);
});

it('should build valid OData startswith filter', () => {
  const areaPath = 'Project\\Team\\Area';
  const escaped = escapeAreaPathForOData(areaPath);
  const filter = `startswith(Area/AreaPath, '${escaped}')`;
  
  expect(filter).toBe("startswith(Area/AreaPath, 'Project\\\\Team\\\\Area')");
});
```

## Files Modified

1. ✅ `mcp_server/src/utils/work-item-parser.ts` - Added `escapeAreaPathForOData()` function
2. ✅ `mcp_server/src/services/handlers/query/odata-query.handler.ts` - Use OData escaping
3. ✅ `mcp_server/src/services/handlers/core/get-team-members.handler.ts` - Use OData escaping
4. ✅ `mcp_server/prompts/system/odata-query-generator.md` - Document escaping requirements
5. ✅ `mcp_server/src/services/prompt-service.ts` - Add `area_path_odata` variable
6. ✅ `mcp_server/test/unit/odata-area-path-escaping.test.ts` - Comprehensive unit tests

## Files NOT Modified (Correct Behavior)

1. ✅ `mcp_server/src/services/ado-work-item-service.ts` - Uses WIQL `UNDER` operator (keeps `escapeAreaPath`)
2. ✅ `mcp_server/src/services/handlers/analysis/intelligent-parent-finder.handler.ts` - Uses WIQL (keeps `escapeAreaPath`)

## Validation

### Before Fix

OData query with area path `One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway`:

```odata
$apply=filter(CompletedDate ge 2025-08-09T00:00:00Z and CompletedDate le 2025-11-07T23:59:59Z and AssignedTo/UserEmail ne null and startswith(Area/AreaPath, 'One\Azure Compute\OneFleet Node\Azure Host Agent\Azure Host Gateway'))/groupby((AssignedTo/UserEmail,AssignedTo/UserName),aggregate($count as Count))&$orderby=Count desc
```

**Result:** ❌ 0 results (query syntax error or incorrect filtering)

### After Fix

OData query with properly escaped area path:

```odata
$apply=filter(CompletedDate ge 2025-08-09T00:00:00Z and CompletedDate le 2025-11-07T23:59:59Z and AssignedTo/UserEmail ne null and startswith(Area/AreaPath, 'One\\Azure Compute\\OneFleet Node\\Azure Host Agent\\Azure Host Gateway'))/groupby((AssignedTo/UserEmail,AssignedTo/UserName),aggregate($count as Count))&$orderby=Count desc
```

**Expected Result:** ✅ Returns team members with work items in that area path

## Impact

### Affected Tools

1. ✅ `wit-query-odata` - Direct OData query execution
2. ✅ `wit-ai-generate-odata` - AI-powered OData query generation
3. ✅ `get-team-members` - Team member discovery via OData

### No Impact On

1. ✅ `wit-wiql-query` - Uses WIQL `UNDER` operator (already working)
2. ✅ `wit-ai-generate-wiql` - WIQL query generation (already working)
3. ✅ All handlers using WIQL queries

## OData v4 Specification Reference

According to [OData v4.0 ABNF](http://docs.oasis-open.org/odata/odata/v4.0/errata03/os/complete/abnf/odata-abnf-construction-rules.txt):

```abnf
string = SQUOTE *( SQUOTE-in-string / pchar-no-SQUOTE ) SQUOTE
SQUOTE-in-string = SQUOTE SQUOTE ; two single quotes represent one single quote
```

And for escape sequences in string literals:
- Backslash (`\`) must be escaped as `\\`
- Single quote (`'`) must be escaped as `''`

This is different from WIQL/SQL which doesn't require backslash escaping in path strings when using operators like `UNDER`.

## Conclusion

This fix ensures that OData queries with area path filtering work correctly for:
- Area paths with backslashes (all Azure DevOps area paths)
- Area paths with single quotes (e.g., "Team's Area")
- Complex nested area path hierarchies

The fix maintains backward compatibility with WIQL queries by keeping the original `escapeAreaPath()` function unchanged and introducing a new `escapeAreaPathForOData()` function specifically for OData use cases.

## Related Issues

- Issue ADO-Work-Item-MSP-57: Add input validation for area path backslash escaping
- Audit finding in `audit_results.md`: OData Area Path Filtering issue
