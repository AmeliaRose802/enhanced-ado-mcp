# Area Path Escaping Fix

## Problem

Area paths in Azure DevOps can contain special characters like:
- Single quotes (e.g., `Team's Area`)
- Backslashes (e.g., `One\Azure Compute\Team`)

When these area paths were directly interpolated into WIQL queries or OData queries, they would break the query syntax because:
- Single quotes in strings need to be escaped as two single quotes (`''`) in SQL/WIQL/OData
- Unescaped quotes would terminate the string prematurely

## Solution

Added a utility function `escapeAreaPath()` in `src/utils/work-item-parser.ts`:

```typescript
/**
 * Escape area path for use in WIQL and OData queries
 * Handles single quotes by doubling them (SQL/WIQL escaping)
 */
export function escapeAreaPath(areaPath: string): string {
  if (!areaPath) return '';
  // Replace single quotes with two single quotes (SQL/WIQL escaping)
  return areaPath.replace(/'/g, "''");
}
```

## Applied Escaping In

### 1. **OData Analytics Handler** (`src/services/handlers/odata-analytics.handler.ts`)
- Escapes area paths and iteration paths when building OData filter clauses
- Prevents OData query syntax errors

### 2. **Detect Patterns Handler** (`src/services/handlers/detect-patterns.handler.ts`)
- Escapes area paths when building WIQL queries
- Ensures pattern detection works with all area path names

### 3. **Hierarchy Validator Analyzer** (`src/services/analyzers/hierarchy-validator.ts`)
- Escapes area paths when querying work items by area path
- Prevents WIQL query failures during hierarchy validation

### 4. **Validate Hierarchy Handler** (`src/services/handlers/validate-hierarchy.handler.ts`)
- Escapes area paths in WIQL queries for hierarchy validation
- Ensures validation works across all area paths

### 5. **Prompt Service** (`src/services/prompt-service.ts`)
- Escapes area paths when creating template variables
- All prompt templates using `{{area_path}}` now receive properly escaped values
- Prevents query failures in prompts that generate WIQL or OData queries

## Examples

### Before Fix
```typescript
// Area path: "Team's Project"
// Generated WIQL (BROKEN):
WHERE [System.AreaPath] UNDER 'Team's Project'
//                                  ^ String terminates here unexpectedly
```

### After Fix
```typescript
// Area path: "Team's Project"
// Escaped: "Team''s Project"
// Generated WIQL (CORRECT):
WHERE [System.AreaPath] UNDER 'Team''s Project'
//                                  ^^ Properly escaped
```

## Testing

To test with an area path containing special characters:
1. Set your configuration to use an area path with a single quote
2. Run any query-based tool (e.g., detect patterns, hierarchy validator)
3. Verify the queries execute successfully without syntax errors

## Future Considerations

- Backslashes in area paths don't need escaping in WIQL/OData (they're already path separators)
- If other special characters cause issues (unlikely), the `escapeAreaPath()` function can be enhanced
- This same escaping should be applied to any other user-provided strings used in queries
