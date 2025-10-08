# WIQL Generator - Automatic Config Integration

## Overview

The `wit-ai-generate-wiql` tool automatically uses the configured area path from your server configuration. You don't need to specify it in every tool call.

## How It Works

### Configuration
When you start the MCP server with an area path:
```bash
enhanced-ado-msp MyOrg MyProject --area-path "MyProject\TeamAlpha"
```

The area path is stored in the server configuration and automatically used by the WIQL generator.

### Automatic Area Path Injection

**Scenario 1: User calls tool without area path**
```typescript
{
  description: "all active bugs"
}
```

**Result**: The Zod schema automatically injects the configured area path:
- `areaPath` becomes `"MyProject\TeamAlpha"` from config
- Generated WIQL includes: `AND [System.AreaPath] UNDER 'MyProject\TeamAlpha'`

**Scenario 2: User overrides with specific area path**
```typescript
{
  description: "all active bugs",
  areaPath: "MyProject\TeamBeta"
}
```

**Result**: User's override is respected:
- `areaPath` uses `"MyProject\TeamBeta"` instead of config default
- Generated WIQL includes: `AND [System.AreaPath] UNDER 'MyProject\TeamBeta'`

**Scenario 3: User explicitly passes empty area path**
```typescript
{
  description: "all active bugs",
  areaPath: ""
}
```

**Result**: No area path filtering:
- `areaPath` is empty string
- AI prompt detects empty value and omits area path filter from WIQL

## Implementation Details

### Schema Definition (`schemas.ts`)
```typescript
export const generateWiqlQuerySchema = z.object({
  description: z.string().describe("Natural language description of the desired query"),
  organization: z.string().optional().default(() => cfg().azureDevOps.organization),
  project: z.string().optional().default(() => cfg().azureDevOps.project),
  areaPath: z.string().optional().default(() => cfg().azureDevOps.areaPath || ''),
  iterationPath: z.string().optional().default(() => cfg().azureDevOps.iterationPath || ''),
  // ... other fields
});
```

The `.default(() => cfg().azureDevOps.areaPath || '')` ensures:
1. If user doesn't provide `areaPath`, use config value
2. If config has no area path, use empty string
3. User can override by explicitly passing a value

### Handler (`generate-wiql-query.handler.ts`)
```typescript
const parsed = config.schema.safeParse(args || {});
// Zod automatically applies defaults during parsing

const { areaPath, iterationPath, ... } = parsed.data;
// areaPath is now either: user value, config value, or empty string

logger.debug(`Using area path for query context: ${areaPath}`);
```

### AI Prompt Variables
```typescript
const variables: Record<string, string> = {
  PROJECT: project,
  AREA_PATH: areaPath || '',      // Direct value, not wrapped in description
  ITERATION_PATH: iterationPath || ''
};
```

The prompt uses these as template variables:
```sql
AND [System.AreaPath] UNDER '{{AREA_PATH}}'
```

## Benefits

1. **Less Verbose**: Users don't need to specify area path in every call
2. **Scoped by Default**: Queries are automatically scoped to the configured area
3. **Still Flexible**: Users can override when needed
4. **Consistent**: Same pattern as other tools (`wit-create-work-item`, etc.)

## Example Usage

**With configured area path**: 
```
User: "Generate a query for all active bugs"
Tool call: { description: "all active bugs" }
Result: Query includes area path filter automatically
```

**Override default**:
```
User: "Generate a query for all tasks in TeamBeta area"
Tool call: { description: "all tasks", areaPath: "MyProject\\TeamBeta" }
Result: Uses TeamBeta instead of configured default
```

**No area filtering**:
```
User: "Generate a query for all work items in the entire project"
Tool call: { description: "all work items", areaPath: "" }
Result: No area path filter in query
```
