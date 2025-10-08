# ADO Client Service

**Status:** Implemented  
**Version:** 1.6.0  
**Module:** Services

## Overview

The ADO Client Service provides a clean abstraction layer for all Azure DevOps API interactions with built-in retry logic, rate limiting, and enhanced logging capabilities.

## Purpose

Centralizes HTTP communication with Azure DevOps REST API, providing:
- **Automatic retry logic** with exponential backoff for transient failures
- **Rate limiting** to prevent API throttling
- **Enhanced logging** for debugging in development mode
- **Consistent error handling** across all ADO API calls
- **Future extensibility** for multi-system support (GitHub, Jira, etc.)

## Architecture

The `ADOClientService` wraps the existing `ADOHttpClient` (in `utils/ado-http-client.ts`) and adds resilience features on top:

```
Service Layer (ado-work-item-service.ts)
    ↓
Repository Layer (work-item.repository.ts)
    ↓
ADO Client Service (ado-client.ts) ← New abstraction layer
    ↓
ADO HTTP Client (ado-http-client.ts) ← Existing HTTP wrapper
    ↓
Azure DevOps REST API
```

## Features

### 1. Automatic Retry Logic

**Retries on:**
- Network errors (timeouts, connection failures)
- HTTP 429 (Rate Limit Exceeded)
- HTTP 408 (Request Timeout)
- HTTP 5xx (Server Errors: 500, 502, 503, 504)

**Does NOT retry on:**
- HTTP 401 (Unauthorized - needs login)
- HTTP 404 (Not Found - resource doesn't exist)
- HTTP 400 (Bad Request - invalid input)
- Validation errors

**Configuration:**
```typescript
{
  maxRetries: 3,           // Maximum retry attempts
  baseDelayMs: 1000,       // Initial delay (1 second)
  maxDelayMs: 32000        // Maximum delay (32 seconds)
}
```

**Backoff Strategy:**
- Exponential backoff: delay = baseDelay × 2^attempt
- Jitter: Random 0-200ms added to prevent thundering herd
- Example delays: 1s, 2s, 4s (with jitter)

### 2. Rate Limiting

Uses **token bucket algorithm** to prevent exceeding Azure DevOps API rate limits.

**Default Configuration:**
```typescript
{
  maxRequests: 100,     // Max requests per window
  windowMs: 60000       // Window duration (1 minute)
}
```

**Behavior:**
- Requests consume tokens from bucket
- Bucket refills over time
- When bucket is empty, requests wait for next refill
- Prevents HTTP 429 errors from Azure DevOps

### 3. Enhanced Logging

**Debug Mode:**
Set `DEBUG=true` environment variable or:
```typescript
{
  enableDebugLogging: true
}
```

**Logs Include:**
- Request method and endpoint
- Retry attempt numbers
- Response status and duration
- Rate limit wait times
- Error details with context

### 4. Token Management

Integrates with existing `ado-token.ts`:
- Automatic token refresh on 401 errors (handled by ADOHttpClient)
- Token caching (55-minute TTL)
- Uses Azure CLI for authentication

## Usage

### Basic Usage

```typescript
import { createADOClient } from './services/ado-client';

const client = createADOClient({
  organization: 'my-org',
  project: 'my-project'
});

// GET request
const response = await client.get('wit/workitems/12345');

// POST request
const created = await client.post('wit/workitems/$Task', {
  op: 'add',
  path: '/fields/System.Title',
  value: 'My Task'
});

// PATCH request
const updated = await client.patch('wit/workitems/12345', [
  { op: 'add', path: '/fields/System.State', value: 'Active' }
]);
```

### Custom Configuration

```typescript
const client = createADOClient({
  organization: 'my-org',
  project: 'my-project',
  
  // Retry configuration
  enableRetry: true,
  retryConfig: {
    maxRetries: 5,
    baseDelayMs: 2000,
    maxDelayMs: 60000
  },
  
  // Rate limiting
  enableRateLimit: true,
  rateLimitConfig: {
    maxRequests: 50,
    windowMs: 60000
  },
  
  // Debug logging
  enableDebugLogging: process.env.DEBUG === 'true'
});
```

### Disable Features

```typescript
const client = createADOClient({
  organization: 'my-org',
  enableRetry: false,        // Disable retry logic
  enableRateLimit: false,    // Disable rate limiting
  enableDebugLogging: false  // Disable debug logs
});
```

## Integration

### Repository Pattern

The `WorkItemRepository` uses `ADOClientService` for all HTTP operations:

```typescript
export class WorkItemRepository {
  private httpClient: ADOClientService;

  constructor(organization: string, project: string) {
    this.httpClient = createADOClient({
      organization,
      project,
      enableRetry: true,
      enableRateLimit: true,
      enableDebugLogging: process.env.DEBUG === 'true'
    });
  }

  async getById(workItemId: number): Promise<ADOWorkItem> {
    const response = await this.httpClient.get(
      `wit/workitems/${workItemId}`
    );
    return response.data;
  }
}
```

### Service Layer

Services create clients directly for operations not in repositories:

```typescript
const httpClient = createADOClient({
  organization,
  project,
  enableRetry: true,
  enableRateLimit: true
});

const response = await httpClient.get(
  `wit/workItems/${workItemId}/revisions`
);
```

## Error Handling

### Retryable Errors

Automatically retried with exponential backoff:
```typescript
try {
  const result = await client.get('/endpoint');
} catch (error) {
  // Only thrown after all retries exhausted
  // or if error is non-retryable
}
```

### Non-Retryable Errors

Thrown immediately without retry:
```typescript
try {
  const result = await client.get('/nonexistent');
} catch (error) {
  // ADOHttpError with status 404
  // Not retried - resource doesn't exist
}
```

### Error Types

All errors are `ADOHttpError` instances:
```typescript
class ADOHttpError extends Error {
  status: number;           // HTTP status code
  statusText: string;       // Status text
  response?: ADOErrorResponse;  // ADO error details
}
```

## Testing

### Test Coverage

14 tests covering:
- ✅ Retry on network errors
- ✅ Retry on HTTP 500, 502, 503, 504
- ✅ Retry on HTTP 429 (rate limit)
- ✅ No retry on HTTP 404, 401
- ✅ Max retry limit respected
- ✅ Retry disabled flag
- ✅ All HTTP methods (GET, POST, PATCH, PUT, DELETE)
- ✅ Rate limiting within limits
- ✅ Rate limiting throttling
- ✅ Factory function

### Running Tests

```bash
npm test -- ado-client.test.ts
```

### Test File

`mcp_server/src/test/ado-client.test.ts`

## Performance Considerations

### Retry Delays

Total time for max retries (3 attempts):
- Attempt 1: Immediate
- Attempt 2: ~1s delay
- Attempt 3: ~2s delay
- Attempt 4: ~4s delay
- **Total:** ~7 seconds maximum

### Rate Limiting Overhead

- Minimal overhead when within limits (<1ms)
- Automatic throttling when limit approached
- Prevents cascade failures from rate limit errors

### Memory Usage

- Minimal: Only stores rate limit state
- No request queuing
- No response caching (handled by services if needed)

## Configuration Recommendations

### Production

```typescript
{
  enableRetry: true,
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 32000
  },
  enableRateLimit: true,
  rateLimitConfig: {
    maxRequests: 100,
    windowMs: 60000
  },
  enableDebugLogging: false
}
```

### Development

```typescript
{
  enableRetry: true,
  retryConfig: {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 5000
  },
  enableRateLimit: false,  // Easier debugging
  enableDebugLogging: true  // Detailed logs
}
```

### Testing

```typescript
{
  enableRetry: false,       // Faster tests
  enableRateLimit: false,   // No delays
  enableDebugLogging: false
}
```

## Future Enhancements

### Multi-System Support

The service boundary makes it easy to add support for other systems:

```typescript
// Future: GitHub client
const githubClient = createGitHubClient(config);

// Future: Jira client
const jiraClient = createJiraClient(config);

// Same interface, different implementations
```

### Circuit Breaker

Add circuit breaker pattern for failing endpoints:
- Open circuit after X consecutive failures
- Half-open after timeout
- Close circuit on success

### Request Caching

Add optional response caching:
```typescript
{
  enableCaching: true,
  cacheTTL: 300000  // 5 minutes
}
```

### Metrics Collection

Track request metrics:
- Request count by endpoint
- Success/failure rates
- Average latency
- Retry statistics

## Implementation Details

### Key Components

- **Service:** `src/services/ado-client.ts`
- **HTTP Client:** `src/utils/ado-http-client.ts` (existing)
- **Token Management:** `src/utils/ado-token.ts` (existing)
- **Tests:** `src/test/ado-client.test.ts`

### Class Structure

```typescript
export class ADOClientService {
  private httpClient: ADOHttpClient;
  private rateLimiter?: RateLimiter;
  private retryConfig: RetryConfig;
  
  // HTTP methods
  async get<T>(endpoint, options): Promise<HttpResponse<T>>
  async post<T>(endpoint, body, options): Promise<HttpResponse<T>>
  async patch<T>(endpoint, body, options): Promise<HttpResponse<T>>
  async put<T>(endpoint, body, options): Promise<HttpResponse<T>>
  async delete<T>(endpoint, options): Promise<HttpResponse<T>>
  
  // Internal
  private async requestWithRetry<T>(...): Promise<HttpResponse<T>>
  private shouldRetry(error, attempt): boolean
  private calculateBackoffDelay(attempt): number
}

class RateLimiter {
  private tryAcquire(): boolean
  private refill(): void
  getWaitTime(): number
}
```

## Related Features

- [Error Categorization](./ERROR_CATEGORIZATION.md)
- [Work Item Repository](./work-item-repository.md)
- [Token Management](./token-management.md)

## Changelog

- **v1.6.0** (2025-10-08) - Initial implementation
  - Added retry logic with exponential backoff
  - Added rate limiting with token bucket algorithm
  - Added debug logging support
  - Created comprehensive test suite
  - Updated WorkItemRepository to use new client

---

**Last Updated:** 2025-10-08  
**Author:** GitHub Copilot
