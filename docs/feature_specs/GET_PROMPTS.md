# Feature Specification: Get Prompts Tool

**Feature**: `wit-get-prompts`  
**Version**: 1.0.0  
**Category**: Utility / Testing  
**Added**: 2025-10-09

---

## Overview

The `wit-get-prompts` tool provides programmatic access to pre-filled prompt templates used by the Enhanced ADO MCP Server. It allows callers to retrieve either a specific prompt by name or list all available prompts, with optional template variable substitution applied.

### Primary Use Cases

1. **Testing & Development**: Verify prompt templates are loading correctly and variables are being substituted properly
2. **Agent Workflows**: Allow agents to access prompt content directly for specialized use cases where they need the full prompt text
3. **Documentation**: Discover available prompts and their required arguments
4. **Debugging**: Inspect the exact prompt text that will be sent to LLMs, including all variable substitutions

---

## Input Parameters

### Schema Definition

```typescript
{
  promptName?: string,      // Optional: Name of specific prompt to retrieve
  includeContent?: boolean, // Optional: Include filled content (default: true)
  args?: Record<string, unknown> // Optional: Template variables to substitute
}
```

### Parameter Details

#### `promptName` (optional)
- **Type**: `string`
- **Description**: Name of a specific prompt to retrieve (e.g., "ai-assignment-analyzer", "query-generator")
- **Default**: If omitted, returns all available prompts
- **Examples**: 
  - `"ai-assignment-analyzer"`
  - `"query-generator"`
  - `"backlog_cleanup"`

#### `includeContent` (optional)
- **Type**: `boolean`
- **Description**: Whether to include the filled prompt content in the response
- **Default**: `true`
- **Use Case**: Set to `false` to get only metadata (name, description, arguments) without loading full content

#### `args` (optional)
- **Type**: `Record<string, unknown>`
- **Description**: Template variables to substitute in prompt content
- **Default**: `{}` (uses config defaults only)
- **Merge Behavior**: User-provided args are merged with config defaults, with user args taking precedence
- **Examples**:
  ```typescript
  {
    workItemId: 12345,
    analysis_period_days: 30,
    area_path: "MyProject\\Team\\Component"
  }
  ```

---

## Output Format

### Single Prompt Response

When `promptName` is specified:

```typescript
{
  success: boolean,
  data: {
    prompt: {
      name: string,                    // Prompt name
      description: string,              // Human-readable description
      arguments: Array<{                // Required/optional arguments
        name: string,
        description?: string,
        required?: boolean
      }>,
      content?: string,                 // Filled prompt content (if includeContent=true)
      templateArgsUsed?: Record<string, unknown> // Args applied to template
    }
  },
  errors: string[],
  warnings: string[],
  metadata: {
    tool: "wit-get-prompts",
    promptName: string,
    contentIncluded: boolean,
    templateArgsProvided: number
  }
}
```

### All Prompts Response

When `promptName` is omitted:

```typescript
{
  success: boolean,
  data: {
    prompts: Array<{                   // Array of all prompts
      name: string,
      description: string,
      arguments: Array<{...}>,
      content?: string,
      templateArgsUsed?: Record<string, unknown>
    }>,
    totalCount: number
  },
  errors: string[],
  warnings: string[],
  metadata: {
    tool: "wit-get-prompts",
    totalPrompts: number,
    contentIncluded: boolean,
    templateArgsProvided: number
  }
}
```

---

## Examples

### Example 1: Get All Prompts (Metadata Only)

**Request**:
```json
{
  "includeContent": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "prompts": [
      {
        "name": "ai-assignment-analyzer",
        "description": "Analyze work item for AI assignment suitability",
        "arguments": [
          {
            "name": "work_item_context",
            "required": true,
            "description": "Full work item context package"
          }
        ]
      },
      {
        "name": "query-generator",
        "description": "Generate WIQL queries from natural language",
        "arguments": [
          {
            "name": "user_intent",
            "required": true,
            "description": "Natural language query description"
          }
        ]
      }
      // ... more prompts
    ],
    "totalCount": 15
  },
  "errors": [],
  "warnings": [],
  "metadata": {
    "tool": "wit-get-prompts",
    "totalPrompts": 15,
    "contentIncluded": false,
    "templateArgsProvided": 0
  }
}
```

### Example 2: Get Specific Prompt With Content

**Request**:
```json
{
  "promptName": "ai-assignment-analyzer",
  "includeContent": true,
  "args": {
    "work_item_id": 12345,
    "work_item_type": "Product Backlog Item"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "prompt": {
      "name": "ai-assignment-analyzer",
      "description": "Analyze work item for AI assignment suitability",
      "arguments": [
        {
          "name": "work_item_context",
          "required": true,
          "description": "Full work item context package"
        }
      ],
      "content": "You are analyzing work item 12345 (Product Backlog Item)...\n\n[Full prompt text with variables substituted]",
      "templateArgsUsed": {
        "work_item_id": 12345,
        "work_item_type": "Product Backlog Item",
        "project": "MyProject",
        "area_path": "MyProject\\Team\\Component"
      }
    }
  },
  "errors": [],
  "warnings": [],
  "metadata": {
    "tool": "wit-get-prompts",
    "promptName": "ai-assignment-analyzer",
    "contentIncluded": true,
    "templateArgsProvided": 2
  }
}
```

### Example 3: Testing Template Variable Substitution

**Request**:
```json
{
  "promptName": "backlog_cleanup",
  "includeContent": true,
  "args": {
    "analysis_period_days": 60,
    "area_path": "One\\Azure Compute\\OneFleet"
  }
}
```

**Use Case**: Verify that custom analysis period and area path are correctly substituted into the prompt template.

---

## Error Handling

### Error Scenarios

#### Prompt Not Found
```json
{
  "success": false,
  "data": null,
  "errors": [
    "Prompt 'invalid-name' not found. Use wit-get-prompts without promptName to see available prompts."
  ],
  "warnings": [],
  "metadata": {
    "tool": "wit-get-prompts",
    "promptName": "invalid-name",
    "found": false
  }
}
```

#### Content Loading Failure (Partial Success)
When metadata loads but content fails for a specific prompt:
```json
{
  "success": true,
  "data": {
    "prompt": {
      "name": "my-prompt",
      "description": "...",
      "arguments": [...],
      "content": undefined
    }
  },
  "errors": [
    "Failed to load prompt content: File not found"
  ],
  "warnings": [],
  "metadata": {
    "tool": "wit-get-prompts",
    "promptName": "my-prompt",
    "contentIncluded": false,
    "templateArgsProvided": 0
  }
}
```

#### Multiple Prompt Loading Failures
When listing all prompts and some fail to load:
```json
{
  "success": true,
  "data": {
    "prompts": [
      // Successful prompts
    ],
    "totalCount": 10
  },
  "errors": [],
  "warnings": [
    "Failed to load content for prompt 'broken-prompt': Parse error"
  ],
  "metadata": {
    "tool": "wit-get-prompts",
    "totalPrompts": 10,
    "contentIncluded": true,
    "templateArgsProvided": 0
  }
}
```

---

## Implementation Details

### Template Variable Resolution

The tool uses a **three-layer variable resolution strategy**:

1. **Configuration Defaults**: Loaded from `.ado-mcp-config.json`
   - `project`, `area_path`, `organization`, etc.
   - Auto-calculated date ranges
   - Environment-specific values

2. **Prompt-Defined Defaults**: From prompt YAML frontmatter
   - Can reference config variables using `{{variable}}` syntax
   - Example: `default: "{{project}}\\{{area_path}}"`

3. **User-Provided Args**: From the `args` parameter
   - **Highest priority** - overrides all defaults
   - Merged on top of config and prompt defaults

**Resolution Order**: `User Args > Prompt Defaults > Config Defaults`

### Prompt Directory Structure

Prompts are loaded from two locations:

```
mcp_server/
├── prompts/                    # User-facing prompt templates
│   ├── backlog_cleanup.md
│   ├── parallel_fit_planner.md
│   └── ...
└── prompts/system/             # System prompts for AI analysis
    ├── ai-assignment-analyzer.md
    ├── query-generator.md
    └── ...
```

### Performance Considerations

- **Caching**: Prompts are cached after first load to avoid repeated file reads
- **Parallel Loading**: When loading all prompts, content is loaded in parallel using `Promise.all()`
- **Lazy Content Loading**: Setting `includeContent: false` skips expensive content loading and variable substitution

---

## Integration Points

### Related Services

1. **`prompt-service.ts`**: Core prompt loading and variable substitution logic
   - `loadPrompts()`: Returns metadata for all prompts
   - `getPromptContent()`: Returns filled prompt content with variables

2. **`config/config.ts`**: Provides default values for template variables
   - Organization, project, area path defaults
   - Date range calculations
   - Environment-specific overrides

3. **AI-Powered Tools**: Consumers of prompts
   - `wit-intelligence-analyzer`
   - `wit-ai-assignment-analyzer`
   - `wit-generate-wiql-query`
   - All tools that use the sampling service

### File Dependencies

- **Schema**: `mcp_server/src/config/schemas.ts` (`getPromptsSchema`)
- **Handler**: `mcp_server/src/services/handlers/core/get-prompts.handler.ts`
- **Tool Config**: `mcp_server/src/config/tool-configs.ts`
- **Routing**: `mcp_server/src/services/tool-service.ts`

---

## Testing

### Manual Testing

**Test 1: List All Prompts**
```bash
# Via MCP inspector or client
mcp_enhanced-ado-_wit-get-prompts --includeContent false
```

**Expected**: Returns list of all prompts with metadata only, no errors.

**Test 2: Get Specific Prompt With Defaults**
```bash
mcp_enhanced-ado-_wit-get-prompts --promptName "query-generator"
```

**Expected**: Returns prompt with content using config defaults.

**Test 3: Get Prompt With Custom Variables**
```bash
mcp_enhanced-ado-_wit-get-prompts \
  --promptName "backlog_cleanup" \
  --args '{"analysis_period_days": 30, "area_path": "Custom\\Path"}'
```

**Expected**: Returns prompt with custom values substituted.

### Automated Testing

#### Unit Tests

```typescript
describe('handleGetPrompts', () => {
  it('should list all prompts without content', async () => {
    const result = await handleGetPrompts({ 
      includeContent: false 
    });
    
    expect(result.success).toBe(true);
    expect(result.data.prompts).toBeDefined();
    expect(result.data.prompts.length).toBeGreaterThan(0);
    expect(result.data.prompts[0].content).toBeUndefined();
  });

  it('should get specific prompt with content', async () => {
    const result = await handleGetPrompts({
      promptName: 'query-generator',
      includeContent: true,
      args: { user_intent: 'Find all bugs' }
    });
    
    expect(result.success).toBe(true);
    expect(result.data.prompt.name).toBe('query-generator');
    expect(result.data.prompt.content).toBeDefined();
  });

  it('should handle non-existent prompt', async () => {
    const result = await handleGetPrompts({
      promptName: 'does-not-exist'
    });
    
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('should merge args with config defaults', async () => {
    const result = await handleGetPrompts({
      promptName: 'backlog_cleanup',
      args: { analysis_period_days: 30 }
    });
    
    expect(result.data.prompt.templateArgsUsed.analysis_period_days).toBe(30);
    expect(result.data.prompt.templateArgsUsed.project).toBeDefined(); // From config
  });
});
```

---

## Version History

### v1.0.0 (2025-10-09)
- Initial implementation
- Support for listing all prompts
- Support for retrieving specific prompt by name
- Template variable substitution
- Metadata-only mode for efficiency

---

## Future Enhancements

### Potential Improvements

1. **Filtering**: Add filter parameters to list only prompts matching criteria
   - By category (system, user)
   - By required arguments
   - By usage frequency

2. **Validation**: Add validation mode to check prompt syntax without loading content
   - Verify YAML frontmatter
   - Check template variable references
   - Validate argument definitions

3. **Caching Control**: Add cache control parameters
   - Force refresh from disk
   - Clear cache for specific prompt
   - Cache statistics

4. **Batch Operations**: Allow retrieving multiple specific prompts in one call
   - `promptNames: string[]` instead of single `promptName`
   - More efficient than multiple calls

---

## Related Documentation

- **Prompt Service**: `mcp_server/src/services/prompt-service.ts` - Core prompt loading logic
- **Configuration Guide**: `docs/guides/WIQL_GENERATOR_CONFIG_USAGE.md` - Template variable system
- **AI-Powered Features**: `docs/feature_specs/AI_POWERED_FEATURES.md` - Consumers of prompts
- **System Prompts**: `mcp_server/prompts/system/` - Available system prompt templates
- **User Prompts**: `mcp_server/prompts/` - Available user-facing prompt templates

---

**Maintained By**: Enhanced ADO MCP Development Team  
**Last Updated**: 2025-10-09
