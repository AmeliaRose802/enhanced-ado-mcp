---
applyTo: "mcp_server/src/{services,config}/**"
---

# Services & Configuration Instructions

This directory contains core business logic, service orchestration, and configuration management.

## Architecture Patterns

### Service Layer Pattern

**Purpose:** Separate business logic from protocol handling

**Structure:**
```
services/
├── tool-service.ts          # Main orchestrator
├── ado-work-item-service.ts # ADO operations
├── ado-discovery-service.ts # Resource discovery
├── sampling-service.ts      # LLM integration
├── prompt-service.ts        # Prompt loading
├── query-handle-service.ts  # Safe bulk ops
├── handlers/                # Tool implementations
└── analyzers/               # AI-powered analysis
```

### Separation of Concerns

- **Services** - Business logic and external API calls
- **Handlers** - Input validation and response formatting
- **Analyzers** - Complex AI-powered analysis
- **Config** - Configuration loading and schemas

## Service Implementation Guidelines

### Standard Service Structure

```typescript
export class MyService {
  private config: ServiceConfig;
  private cache: Map<string, any>;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Main operation with clear JSDoc
   */
  async performOperation(params: Params): Promise<Result> {
    try {
      // Validate input
      this.validateParams(params);
      
      // Check cache if applicable
      const cached = this.cache.get(key);
      if (cached) return cached;
      
      // Perform operation
      const result = await this.doWork(params);
      
      // Cache if applicable
      this.cache.set(key, result);
      
      return result;
    } catch (error) {
      throw this.formatError(error, params);
    }
  }

  private validateParams(params: Params): void {
    // Input validation logic
  }

  private async doWork(params: Params): Promise<Result> {
    // Core business logic
  }

  private formatError(error: unknown, context: any): Error {
    // Contextual error formatting
  }
}
```

### Error Handling in Services

**Pattern 1: Throw with Context**
```typescript
throw new Error(`Failed to fetch work item ${id}: ${error.message}`);
```

**Pattern 2: Return Result Type**
```typescript
interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Choose based on:**
- Throw: Exceptional conditions, handler will catch
- Result: Multiple failure modes, handler needs granular control

### Caching Strategy

**When to Cache:**
- Configuration data (entire session)
- Prompt templates (until modified)
- Discovery results (5 minutes)
- Authentication tokens (until expiration)

**When NOT to Cache:**
- Work item data (frequently changes)
- Query results (user expects fresh data)
- Operation results (must be current)

## Handler Implementation Guidelines

### Standard Handler Structure

```typescript
import { z } from 'zod';
import { myToolSchema } from '../../config/schemas';
import type { ToolExecutionResult } from '../../types';

/**
 * Handler for my-tool operation
 */
export async function handleMyTool(
  args: z.infer<typeof myToolSchema>,
  services: Services,
  config: ServerConfig
): Promise<ToolExecutionResult> {
  const warnings: string[] = [];
  
  try {
    // 1. Apply configuration defaults
    const effectiveArgs = {
      ...config.defaults.myTool,
      ...args
    };
    
    // 2. Business logic validation
    if (effectiveArgs.someField && effectiveArgs.otherField) {
      warnings.push('Both fields provided, using someField');
    }
    
    // 3. Call service method
    const result = await services.myService.doOperation(effectiveArgs);
    
    // 4. Format response
    return {
      success: true,
      data: {
        result_field: result.value,
        metadata: result.meta
      },
      errors: [],
      warnings,
      metadata: {
        timestamp: new Date().toISOString(),
        tool: 'my-tool'
      }
    };
  } catch (error) {
    // 5. Error handling
    return {
      success: false,
      data: null,
      errors: [formatErrorMessage(error)],
      warnings,
      raw: {
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1
      }
    };
  }
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

### Handler Responsibilities

1. **Merge configuration** - Apply defaults from config
2. **Validate business rules** - Beyond schema validation
3. **Add warnings** - Non-critical issues
4. **Call services** - Delegate business logic
5. **Format response** - Consistent ToolExecutionResult
6. **Handle errors** - Graceful degradation

### Handler Best Practices

✅ **Do:**
- Keep handlers thin (< 100 lines)
- Delegate to services
- Return structured results
- Include metadata for debugging
- Add warnings for edge cases
- **Use response-builder helper functions** (buildSuccessResponse, buildErrorResponse)

❌ **Don't:**
- Put business logic in handlers
- Make direct API calls
- Return unstructured data
- Throw unhandled errors
- Ignore configuration
- **Manually construct error responses** (use helpers instead)

## Standard Error Handling Pattern

### Required Approach: Use Response Builder Helpers

**ALWAYS use the helper functions from `utils/response-builder.ts`:**

```typescript
import { 
  buildSuccessResponse, 
  buildErrorResponse,
  buildValidationErrorResponse,
  buildNotFoundError,
  buildAuthenticationError,
  buildNetworkError,
  buildBusinessLogicError
} from '../../../utils/response-builder.js';

export async function handleMyTool(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    // 1. Validate input with Zod
    const validated = myToolSchema.parse(args);
    
    // 2. Business logic
    const result = await performOperation(validated);
    
    // 3. Return success with helpers
    return buildSuccessResponse(result, {
      source: "my-tool",
      itemCount: result.items.length
    });
    
  } catch (error) {
    // 4. Handle specific error types
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error, "my-tool");
    }
    
    // 5. Use categorized error helpers for known error types
    if (error instanceof Error && error.message.includes('not found')) {
      return buildNotFoundError('work-item', args.workItemId, { source: "my-tool" });
    }
    
    // 6. Generic error fallback (auto-categorizes)
    return buildErrorResponse(error as Error, { source: "my-tool" });
  }
}
```

### Available Response Builder Functions

**Success:**
- `buildSuccessResponse(data, metadata?)` - Standard success response

**Error Helpers (Auto-categorized):**
- `buildErrorResponse(error, metadata?, category?, code?)` - Generic error (auto-categorizes if category omitted)
- `buildValidationErrorResponse(zodError, source)` - Zod validation errors with field details
- `buildNotFoundError(resourceType, resourceId, metadata?)` - Resource not found (work-item, project, etc.)
- `buildAuthenticationError(message, metadata?)` - Auth failures
- `buildNetworkError(message, metadata?)` - Network issues
- `buildBusinessLogicError(message, metadata?)` - Business rule violations
- `buildSamplingUnavailableResponse()` - AI sampling not available

### Error Handling Anti-Patterns

❌ **WRONG - Manual error construction:**
```typescript
catch (error) {
  return {
    success: false,
    data: null,
    metadata: { source: "my-tool" },
    errors: [error instanceof Error ? error.message : String(error)],
    warnings: []
  };
}
```

✅ **CORRECT - Use helper:**
```typescript
catch (error) {
  return buildErrorResponse(error as Error, { source: "my-tool" });
}
```

❌ **WRONG - Manual Zod error formatting:**
```typescript
catch (error) {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      // ...
    };
  }
}
```

✅ **CORRECT - Use validation helper:**
```typescript
catch (error) {
  if (error instanceof z.ZodError) {
    return buildValidationErrorResponse(error, "my-tool");
  }
}
```

### Benefits of Using Response Builders

1. **Consistent error categorization** - Auto-classifies errors (AUTH, NETWORK, NOT_FOUND, etc.)
2. **Error codes** - Standardized error codes for programmatic handling
3. **Metadata** - Proper error context for debugging and telemetry
4. **Future-proof** - Changes to error structure happen in one place
5. **Type safety** - Ensures ToolExecutionResult contract is met
6. **Actionable messages** - Helpers provide better error messages for AI agents

## Configuration System

### Configuration Priority

1. CLI arguments (highest)
2. Built-in defaults and auto-discovery
3. Optional config file (`.ado-mcp-config.json`) - if present
4. Schema defaults (lowest)

**Note:** Configuration file is optional. The server works with just CLI arguments (organization, project, --area-path).

### Adding New Configuration

**1. Define in Schema:**
```typescript
// config/schemas.ts
export const serverConfigSchema = z.object({
  myNewFeature: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().default(30000)
  })
});
```

**2. Add to Config Type:**
```typescript
// config/config.ts
export type ServerConfig = z.infer<typeof serverConfigSchema>;
```

**3. Document in Feature Spec:**
Update `docs/feature_specs/<feature>.md` with configuration options

**4. Add Environment Variable:**
```typescript
// config/config.ts
myNewFeature: {
  enabled: process.env.MY_FEATURE_ENABLED === 'true',
  timeout: Number(process.env.MY_FEATURE_TIMEOUT) || defaults.timeout
}
```

### Configuration File Format

```json
{
  "organization": "my-org",
  "project": "my-project",
  "myNewFeature": {
    "enabled": true,
    "timeout": 30000
  }
}
```

## Analyzer Implementation Guidelines

### AI-Powered Analyzers

Located in `services/analyzers/`, these use LLM sampling for complex analysis.

**Standard Structure:**
```typescript
export class MyAnalyzer {
  constructor(
    private samplingService: SamplingService,
    private promptService: PromptService
  ) {}

  async analyze(input: Input): Promise<AnalysisResult> {
    // 1. Load prompt template
    const promptTemplate = await this.promptService.loadPrompt(
      'my-analysis-prompt'
    );
    
    // 2. Prepare variables
    const variables = {
      inputField: input.value,
      context: JSON.stringify(input.context)
    };
    
    // 3. Render prompt
    const prompt = this.promptService.renderPrompt(
      promptTemplate,
      variables
    );
    
    // 4. Request sampling
    const response = await this.samplingService.sample({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      maxTokens: 2000
    });
    
    // 5. Parse response
    try {
      const parsed = JSON.parse(response);
      return this.validateResult(parsed);
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  private validateResult(parsed: any): AnalysisResult {
    // Validate structure matches expected format
    // Return typed result
  }
}
```

### Analyzer Best Practices

- **Single Responsibility** - One analysis type per analyzer
- **Prompt Templates** - External files, not hardcoded
- **Response Validation** - Always validate LLM output
- **Error Recovery** - Graceful handling of parse failures
- **Timeouts** - Set reasonable maxTokens limits

## Tool Service Orchestration

### Tool Registration

**In appropriate `config/tool-configs/*.ts` file:**
```typescript
// Add to work-item-creation.ts, bulk-operations.ts, etc.
export const categoryTools: ToolConfig[] = [
  {
    name: 'my-tool',
    schema: myToolSchema,
    description: 'What this tool does',
    script: '',
    inputSchema: { /* ... */ }
  }
];
```

**In `services/tool-service.ts`:**
```typescript
async executeTool(name: string, args: unknown): Promise<ToolExecutionResult> {
  // ... validation ...
  
  switch (name) {
    case 'my-tool':
      return handleMyTool(validated, this.services, this.config);
    // ... other tools ...
  }
}
```

### Adding Tool Sampling Support

**1. Mark as requiring sampling:**
```typescript
{
  'my-tool': {
    requiresSampling: true,
    // ...
  }
}
```

**2. Check in handler:**
```typescript
if (!services.samplingService) {
  return {
    success: false,
    errors: ['This tool requires VS Code Language Model API access'],
    // ...
  };
}
```

**3. Use sampling service:**
```typescript
const result = await services.samplingService.sample({
  systemPrompt: prompt.system,
  userPrompt: prompt.user
});
```

## Azure DevOps Integration

### Authentication Pattern

```typescript
private async getAuthToken(): Promise<string> {
  const result = await execAsync(
    'az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798'
  );
  const parsed = JSON.parse(result.stdout);
  return parsed.accessToken;
}
```

### API Call Pattern

```typescript
private async callAdoApi<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const token = await this.getAuthToken();
  
  const response = await fetch(
    `https://dev.azure.com/${this.org}/${this.project}/_apis/${endpoint}?api-version=7.1`,
    {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }
  );
  
  if (!response.ok) {
    throw new Error(`ADO API error: ${response.statusText}`);
  }
  
  return response.json();
}
```

### Error Handling for ADO APIs

```typescript
try {
  const result = await this.callAdoApi(endpoint);
  return result;
} catch (error) {
  if (error.message.includes('404')) {
    throw new Error(`Work item not found: ${id}`);
  } else if (error.message.includes('401')) {
    throw new Error('Authentication failed. Run: az login');
  } else {
    throw new Error(`Failed to fetch work item: ${error.message}`);
  }
}
```

## Testing Services

### Unit Tests for Services

```typescript
describe('MyService', () => {
  let service: MyService;
  let mockConfig: ServiceConfig;

  beforeEach(() => {
    mockConfig = {
      organization: 'test-org',
      project: 'test-project'
    };
    service = new MyService(mockConfig);
  });

  describe('performOperation', () => {
    it('should return result for valid input', async () => {
      const result = await service.performOperation({ id: 123 });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should throw error for invalid input', async () => {
      await expect(service.performOperation({ id: -1 }))
        .rejects
        .toThrow('Invalid ID');
    });
  });
});
```

### Mocking External Dependencies

```typescript
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    callback(null, { stdout: '{"accessToken": "mock-token"}' });
  })
}));
```

## Documentation Requirements

### When Adding/Modifying Services

**REQUIRED:**
1. Create/update feature spec in `docs/feature_specs/`
2. Add JSDoc comments to public methods
3. Document error conditions
4. Update ARCHITECTURE.md if architectural changes

**Feature Spec Should Include:**
- Service purpose and responsibilities
- Public API surface
- Configuration options
- Error handling behavior
- Integration points
- Testing approach

### Code Comments

```typescript
/**
 * Analyzes work item for AI assignment suitability.
 * 
 * @param workItemId - The ID of the work item to analyze
 * @param includeContext - Whether to include related items (default: false)
 * @returns Analysis result with confidence score and recommendations
 * @throws {Error} If work item not found or analysis fails
 */
async analyzeForAI(
  workItemId: number,
  includeContext = false
): Promise<AIAnalysisResult> {
  // Implementation
}
```

---

**Last Updated:** 2025-10-07
