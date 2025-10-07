# Error Categorization System

**Status:** Implemented  
**Version:** 1.6.0  
**Module:** Error Handling

## Overview

The error categorization system provides structured classification of errors for better debugging, monitoring, and error handling across the Enhanced ADO MCP Server. It assigns category labels, error codes, and metadata to all errors, making it easier to identify issues, implement appropriate retry logic, and provide actionable feedback to users.

## Purpose

Before error categorization, all errors were treated uniformly, making it difficult to:
- Determine if an error is retryable (network issues vs. validation errors)
- Monitor specific error types in production
- Provide category-specific guidance to users
- Implement intelligent error recovery strategies

With error categorization:
- Every error has a category (validation, authentication, network, etc.)
- Errors have structured codes (ERR_VALIDATION_001, ERR_AUTH_100, etc.)
- Metadata includes retryability hints and context
- Consistent error structure across all tools
- Backwards compatible with existing error handling

## Error Categories

### Available Categories

| Category | Description | Retryable | Use When |
|----------|-------------|-----------|----------|
| `validation` | Input validation errors | ❌ No | Schema violations, invalid parameters, required fields missing |
| `authentication` | Auth/login errors | ❌ No | Not logged in, invalid token, expired credentials |
| `network` | Network-related errors | ✅ Yes | Timeouts, connection failures, DNS issues |
| `business-logic` | Business rule violations | ❌ No | Invalid state transitions, constraint violations |
| `not-found` | Resource not found | ❌ No | Work item, project, repository, query handle not found |
| `rate-limit` | API throttling | ✅ Yes | Rate limit exceeded, quota exceeded |
| `permission-denied` | Access denied | ❌ No | Insufficient permissions, forbidden operations |
| `unknown` | Uncategorized errors | ❌ No | Fallback for unrecognized errors |

## Error Codes

Error codes follow the format: `ERR_<CATEGORY>_<NUMBER>`

### Validation Errors (001-099)
- `ERR_VALIDATION_001` - Schema validation failure
- `ERR_VALIDATION_002` - Required field missing
- `ERR_VALIDATION_003` - Invalid format
- `ERR_VALIDATION_004` - Value out of range
- `ERR_VALIDATION_005` - Invalid type

### Authentication Errors (100-199)
- `ERR_AUTH_100` - Not logged in
- `ERR_AUTH_101` - Invalid token
- `ERR_AUTH_102` - Token expired
- `ERR_AUTH_103` - Azure CLI not available
- `ERR_AUTH_104` - Insufficient permissions

### Network Errors (200-299)
- `ERR_NETWORK_200` - Timeout
- `ERR_NETWORK_201` - Connection failed
- `ERR_NETWORK_202` - DNS failure
- `ERR_NETWORK_203` - Network unreachable

### Business Logic Errors (300-399)
- `ERR_BUSINESS_300` - Invalid state
- `ERR_BUSINESS_301` - Constraint violation
- `ERR_BUSINESS_302` - Operation failed
- `ERR_BUSINESS_303` - Invalid operation

### Not Found Errors (400-499)
- `ERR_NOT_FOUND_400` - Work item not found
- `ERR_NOT_FOUND_401` - Project not found
- `ERR_NOT_FOUND_402` - Repository not found
- `ERR_NOT_FOUND_403` - Query handle not found
- `ERR_NOT_FOUND_404` - Resource not found

### Rate Limit Errors (500-599)
- `ERR_RATE_LIMIT_500` - Rate limit exceeded
- `ERR_RATE_LIMIT_501` - Quota exceeded

### Permission Errors (600-699)
- `ERR_PERMISSION_600` - Permission denied
- `ERR_PERMISSION_601` - Insufficient access

### Unknown Errors (900-999)
- `ERR_UNKNOWN_900` - Unknown error

## Error Metadata Structure

Every categorized error includes structured metadata:

```typescript
interface ErrorMetadata {
  category: ErrorCategory;        // Error category
  code?: ErrorCodeType;           // Specific error code
  originalError?: string;         // Original error if wrapped
  context?: Record<string, any>;  // Additional context
  timestamp?: string;             // ISO 8601 timestamp
  retryable?: boolean;            // Whether error is retryable
  httpStatus?: number;            // HTTP status if applicable
}
```

## Usage Examples

### Basic Error Response (Auto-Categorization)

When you don't specify a category, the system automatically categorizes based on the error message:

```typescript
import { buildErrorResponse } from '../utils/response-builder.js';

// Auto-categorizes as NOT_FOUND
const result = buildErrorResponse('Work item 12345 not found');
```

**Response:**
```json
{
  "success": false,
  "data": null,
  "errors": ["Work item 12345 not found"],
  "warnings": [],
  "metadata": {
    "errorCategory": "not-found",
    "errorMetadata": {
      "category": "not-found",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "retryable": false
    }
  }
}
```

### Explicit Categorization

Specify category and code for precise control:

```typescript
import { buildErrorResponse, ErrorCategory, ErrorCode } from '../utils/response-builder.js';

const result = buildErrorResponse(
  'Azure CLI not available',
  { source: 'azure-cli-check' },
  ErrorCategory.BUSINESS_LOGIC,
  ErrorCode.AUTH_CLI_NOT_AVAILABLE
);
```

### Helper Functions

Use category-specific helper functions for common error types:

#### Authentication Error
```typescript
import { buildAuthenticationError } from '../utils/response-builder.js';

return buildAuthenticationError('User not logged in. Run: az login');
```

#### Network Error
```typescript
import { buildNetworkError } from '../utils/response-builder.js';

return buildNetworkError('Connection timeout after 30 seconds');
```

#### Not Found Error
```typescript
import { buildNotFoundError } from '../utils/response-builder.js';

// Specific resource types map to specific error codes
return buildNotFoundError('work-item', 12345);
// -> ERR_NOT_FOUND_400

return buildNotFoundError('project', 'MyProject');
// -> ERR_NOT_FOUND_401

return buildNotFoundError('query-handle', 'qh_abc123');
// -> ERR_NOT_FOUND_403
```

#### Business Logic Error
```typescript
import { buildBusinessLogicError } from '../utils/response-builder.js';

return buildBusinessLogicError('Cannot transition from Done to Active');
```

#### Rate Limit Error
```typescript
import { buildRateLimitError } from '../utils/response-builder.js';

// Default message
return buildRateLimitError();

// Custom message
return buildRateLimitError('API quota exceeded. Retry after 60 seconds.');
```

#### Permission Error
```typescript
import { buildPermissionError } from '../utils/response-builder.js';

return buildPermissionError('Insufficient permissions to delete work item');
```

### In Handler Functions

Example handler using error categorization:

```typescript
import { buildErrorResponse, buildNotFoundError, ErrorCategory } from '../utils/response-builder.js';

export async function handleGetWorkItem(args: any): Promise<ToolExecutionResult> {
  try {
    const workItem = await fetchWorkItem(args.workItemId);
    
    if (!workItem) {
      return buildNotFoundError('work-item', args.workItemId);
    }
    
    return buildSuccessResponse(workItem);
    
  } catch (error) {
    // Auto-categorizes or use explicit category
    return buildErrorResponse(
      error as Error,
      { tool: 'get-work-item' }
    );
  }
}
```

## Validation Errors

Validation errors are automatically categorized when using `buildValidationErrorResponse`:

```typescript
import { buildValidationErrorResponse } from '../utils/response-builder.js';

const parsed = schema.safeParse(args);
if (!parsed.success) {
  return buildValidationErrorResponse(parsed.error);
  // Automatically categorized as VALIDATION with code ERR_VALIDATION_001
}
```

## Azure CLI Errors

Azure CLI errors are automatically categorized:

```typescript
import { buildAzureCliErrorResponse } from '../utils/response-builder.js';

const validation = validateAzureCLI();
if (!validation.isAvailable || !validation.isLoggedIn) {
  return buildAzureCliErrorResponse(validation);
  // Categorizes as BUSINESS_LOGIC if CLI not available
  // Categorizes as AUTHENTICATION if not logged in
}
```

## Auto-Categorization Logic

When category is not explicitly provided, the system analyzes the error message:

| Error Message Contains | Category |
|------------------------|----------|
| "not logged in", "authentication", "unauthorized", "az login" | `authentication` |
| "not found", "does not exist" | `not-found` |
| "permission denied", "access denied", "forbidden", "insufficient" | `permission-denied` |
| "timeout", "network", "connection", "ECONNREFUSED", "ENOTFOUND" | `network` |
| "rate limit", "throttle", "quota exceeded" | `rate-limit` |
| "validation", "invalid", "required", "must be" | `validation` |
| Any other error | `unknown` |

## Retryability

The system automatically sets the `retryable` flag based on category:

**Retryable (true):**
- Network errors (transient connection issues)
- Rate limit errors (wait and retry)

**Non-Retryable (false):**
- Validation errors (fix input first)
- Authentication errors (login required)
- Not found errors (resource doesn't exist)
- Permission errors (access not granted)
- Business logic errors (invalid operation)
- Unknown errors (unpredictable)

## Backwards Compatibility

The system is fully backwards compatible:

### Existing Code Works Unchanged

```typescript
// Old code without categories still works
const result = buildErrorResponse('Some error', { source: 'legacy' });
// Auto-categorizes and adds metadata
```

### Existing Metadata Preserved

```typescript
// Custom metadata is preserved
const result = buildErrorResponse('Error', {
  tool: 'my-tool',
  timestamp: '2025-01-01',
  customField: 123
});
// All fields maintained + error category added
```

### Optional Parameters

All category and code parameters are optional:

```typescript
// No breaking changes to function signatures
buildErrorResponse(error);                           // ✅ Works
buildErrorResponse(error, metadata);                 // ✅ Works
buildErrorResponse(error, metadata, category);       // ✅ Works
buildErrorResponse(error, metadata, category, code); // ✅ Works
```

## Monitoring and Debugging

### Filtering Errors by Category

```typescript
// Get all authentication errors
const authErrors = results.filter(r => 
  !r.success && r.metadata.errorCategory === 'authentication'
);

// Get all retryable errors
const retryableErrors = results.filter(r =>
  !r.success && r.metadata.errorMetadata?.retryable === true
);
```

### Error Metrics

Track error distribution:

```typescript
const errorCounts = new Map<string, number>();

results.forEach(result => {
  if (!result.success) {
    const category = result.metadata.errorCategory || 'unknown';
    errorCounts.set(category, (errorCounts.get(category) || 0) + 1);
  }
});

console.log('Error distribution:', Object.fromEntries(errorCounts));
// { validation: 5, authentication: 2, network: 1 }
```

## Best Practices

### 1. Use Helper Functions

Prefer helper functions over manual categorization:

```typescript
// ✅ Good - Clear intent, correct code
return buildNotFoundError('work-item', id);

// ❌ Less ideal - Manual categorization
return buildErrorResponse(
  `Work item ${id} not found`,
  {},
  ErrorCategory.NOT_FOUND,
  ErrorCode.NOT_FOUND_WORK_ITEM
);
```

### 2. Let Auto-Categorization Work

For generic errors, let the system auto-categorize:

```typescript
// ✅ Good - Auto-categorizes correctly
return buildErrorResponse('Connection timeout');
// -> category: network

// ❌ Unnecessary - Manual when auto works
return buildErrorResponse('Connection timeout', {}, ErrorCategory.NETWORK);
```

### 3. Add Context to Errors

Include useful context in metadata:

```typescript
return buildNotFoundError('work-item', workItemId, {
  project: 'MyProject',
  organization: 'MyOrg',
  attemptedOperation: 'update'
});
```

### 4. Preserve Original Errors

When wrapping errors, preserve the original:

```typescript
try {
  await operation();
} catch (error) {
  return buildErrorResponse(
    `Operation failed: ${error.message}`,
    { originalError: error.toString() }
  );
}
```

## Implementation Details

### Key Components

- **Types:** `src/types/error-categories.ts`
  - `ErrorCategory` enum
  - `ErrorCode` constants
  - `ErrorMetadata` interface
  - Helper functions

- **Response Builder:** `src/utils/response-builder.ts`
  - `buildErrorResponse()` - Core function with categorization
  - `buildValidationErrorResponse()` - Validation-specific
  - `buildAzureCliErrorResponse()` - Azure CLI-specific
  - Helper functions for each category

- **Tests:** `src/test/error-categorization.test.ts`
  - 44 comprehensive tests
  - Category validation
  - Code validation
  - Helper function tests
  - Backwards compatibility tests

### Integration Points

- Used by all tool handlers
- Consumed by MCP client applications
- Logged for monitoring and debugging
- Informs retry logic in client code

## Testing

Run error categorization tests:

```bash
cd mcp_server
npm test -- error-categorization.test.ts
```

All 44 tests validate:
- Category definitions
- Error code definitions
- Metadata creation
- Auto-categorization logic
- Helper functions
- Backwards compatibility
- Integration with ToolExecutionResult

## Migration Guide

### For New Code

Use helper functions when adding new handlers:

```typescript
import {
  buildAuthenticationError,
  buildNetworkError,
  buildNotFoundError,
  buildBusinessLogicError,
  buildRateLimitError,
  buildPermissionError
} from '../utils/response-builder.js';

// Use appropriate helper based on error type
if (!isLoggedIn) {
  return buildAuthenticationError('Login required');
}

if (networkFailed) {
  return buildNetworkError('Connection failed');
}

if (!resource) {
  return buildNotFoundError('work-item', id);
}
```

### For Existing Code

No changes required! The system is backwards compatible. However, you can optionally enhance error handling:

**Before:**
```typescript
return buildErrorResponse('Work item not found');
```

**After (optional):**
```typescript
return buildNotFoundError('work-item', workItemId);
```

## Related Features

- [Error Handling Strategy](../../ARCHITECTURE.md#error-handling-strategy)
- [Response Format](../../ARCHITECTURE.md#error-response-format)
- [Validation Errors](./VALIDATION_ERRORS.md)

## Future Enhancements

Potential future improvements:
- HTTP status code mapping for REST clients
- Error recovery suggestions per category
- Automatic retry logic for retryable errors
- Error aggregation and reporting
- Custom error codes for domain-specific errors

## Changelog

- **v1.6.0** (2025-01-15) - Initial implementation
  - Added 8 error categories
  - Added 20+ error codes
  - Added auto-categorization logic
  - Added 6 helper functions
  - Added comprehensive tests
  - Maintained full backwards compatibility

---

**Last Updated:** 2025-01-15  
**Author:** Enhanced ADO MCP Team
