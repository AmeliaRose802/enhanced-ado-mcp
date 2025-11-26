# Structured Logging Guide

## Overview

The Enhanced ADO MCP Server uses a structured logging system that is **MCP protocol aware** to prevent stderr pollution and provide consistent, debuggable logs.

## Quick Start

```typescript
import { logger } from '@/utils/logger.js';

// Basic logging
logger.info('Processing work item');
logger.warn('Rate limit approaching');
logger.error('Failed to fetch work item');
logger.debug('Detailed trace information');

// Structured logging with context
logger.info('User authenticated', { userId: 123, method: 'OAuth' });
logger.error('API call failed', { 
  endpoint: '/workitems/12345', 
  statusCode: 404,
  errorMessage: 'Not found'
});
```

## Log Levels

| Level   | When to Use | Visible |
|---------|-------------|---------|
| `debug` | Detailed trace information for debugging | Only when `MCP_DEBUG=1` |
| `info`  | General informational messages | Before MCP connection |
| `warn`  | Warning conditions that should be addressed | Before MCP connection |
| `error` | Error conditions requiring attention | Before MCP connection |

## MCP Protocol Awareness

The logger automatically suppresses stderr output after MCP transport connection to prevent protocol pollution:

```typescript
// Before MCP connection: logs to stderr
logger.info('Server starting...');

// MCP connection happens
server.connect(transport);
logger.markMCPConnected();

// After MCP connection: suppressed from stderr (but still logged to file if configured)
logger.info('Processing tool request'); // Silent in stderr
```

## Structured Context Metadata

Add context objects to make logs more searchable and analyzable:

```typescript
// Good: Structured context
logger.error('Work item fetch failed', {
  workItemId: 12345,
  projectName: 'MyProject',
  errorCode: 'ENOTFOUND',
  retryCount: 3
});

// Avoid: Unstructured concatenation
logger.error(`Work item 12345 fetch failed in MyProject after 3 retries`);
```

## File Logging (Optional)

Enable persistent file logging for debugging production issues:

```bash
# Set environment variable to enable file logging
export MCP_LOG_FILE=/var/log/enhanced-ado-mcp.log

# Start server
enhanced-ado-mcp myorg --area-path "Project\\Team"
```

File logging **always captures logs**, even after MCP connection, making it ideal for debugging production issues.

## Best Practices

### ✅ DO

- Use `logger` instead of `console.log/error/warn`
- Add structured context for errors
- Use appropriate log levels
- Include relevant IDs (work item, request, user)
- Log before expensive operations

```typescript
logger.debug('Starting batch operation', { itemCount: items.length });
const results = await processBatch(items);
logger.info('Batch operation completed', { 
  successCount: results.success, 
  failedCount: results.failed 
});
```

### ❌ DON'T

- Use `console.log/error/warn` directly (breaks MCP protocol)
- Log sensitive information (passwords, tokens)
- Log inside tight loops (performance impact)
- Use logging for control flow

```typescript
// Bad: Console usage
console.log('Processing item'); // ❌

// Bad: Sensitive data
logger.info('Token acquired', { token: 'abc123...' }); // ❌

// Bad: Tight loop
items.forEach(item => {
  logger.debug('Processing item', item); // ❌ Too much output
});

// Good: Batch summary
logger.debug('Processing items', { count: items.length });
const results = processItems(items);
logger.info('Items processed', { successCount: results.length });
```

## Debug Mode

Enable debug logging for development and troubleshooting:

```bash
# Enable debug logs
export MCP_DEBUG=1

# Or with inline flag
MCP_DEBUG=1 enhanced-ado-mcp myorg --area-path "Project\\Team"
```

Debug logs provide detailed trace information for troubleshooting but are suppressed in production.

## Scripts vs Services

**Scripts (CLI tools)** can use `console.log` for user-facing output:
```typescript
// In scripts/generate-openapi.ts
console.log('✓ Generated schema: openapi.json'); // ✅ CLI output
```

**Services/Handlers** must use the logger:
```typescript
// In services/handlers/
logger.info('Processing tool request'); // ✅ Structured logging
```

## Troubleshooting

### No logs appearing

**Before MCP connection:** Logs should appear on stderr  
**After MCP connection:** Logs are suppressed (by design)  
**Solution:** Enable file logging with `MCP_LOG_FILE`

### Too much debug output

**Problem:** Debug logs flooding terminal  
**Solution:** Remove or reduce `MCP_DEBUG=1`, use file logging instead

### Want to see post-connection logs

**Problem:** Need to debug after MCP connects  
**Solution:** Use file logging (`MCP_LOG_FILE`) which always captures logs

## Implementation Details

Located in `mcp_server/src/utils/logger.ts`:
- Singleton instance exported as `logger`
- Timestamps all log entries
- Optional file persistence
- MCP connection state tracking
- Backward compatible with existing code

## Examples

### Service Handler Logging
```typescript
export async function handleCreateWorkItem(args: any) {
  logger.info('Creating work item', { 
    type: args.workItemType,
    project: args.project 
  });
  
  try {
    const result = await createWorkItem(args);
    logger.info('Work item created', { 
      id: result.id,
      url: result.url 
    });
    return result;
  } catch (error) {
    logger.error('Failed to create work item', {
      type: args.workItemType,
      errorMessage: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

### Retry/Backoff Logging
```typescript
async function retryOperation(operation: () => Promise<any>, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug('Attempting operation', { attempt, maxAttempts });
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.error('Operation failed after retries', { 
          attempts: maxAttempts,
          errorMessage: error.message 
        });
        throw error;
      }
      logger.warn('Operation failed, retrying', { 
        attempt, 
        nextAttemptIn: '2s' 
      });
      await sleep(2000);
    }
  }
}
```

## Related

- **Configuration:** See `docs/feature_specs/automatic-project-extraction.md`
- **Error Handling:** See `docs/feature_specs/ERROR_CATEGORIZATION.md`
- **Testing:** See `test/unit/logger.test.ts`
