# Error Recovery Integration Tests

## Overview

This document describes the error recovery integration tests in `error-recovery.test.ts`. These tests verify that the system properly handles various error scenarios including network failures, API timeouts, authentication errors, rate limiting, and ensures proper cleanup and recovery.

## Test Coverage (34 tests)

### 1. Network Failure Recovery (4 tests)

Tests handling of common network errors with retry logic:

- **Connection failure with retry**: Simulates `ECONNREFUSED` errors and verifies retry behavior
- **DNS resolution failure**: Tests `ENOTFOUND` error handling
- **Socket hang up**: Verifies recovery from socket disconnections
- **Persistent network errors**: Confirms eventual failure after max retries

**Key Behaviors Tested:**
- Automatic retry on transient network errors
- Exponential backoff between retries
- Proper error propagation after exhausting retries

### 2. API Timeout Recovery (3 tests)

Tests timeout handling and graceful degradation:

- **AbortError handling**: Verifies proper response to request timeouts
- **Timeout with retry**: Tests successful retry after timeout
- **TimeoutError handling**: Validates different timeout error types

**Key Behaviors Tested:**
- Request timeout detection (30s default)
- Retry logic for timed-out requests
- User-friendly timeout error messages

### 3. Authentication Error Recovery (4 tests)

Tests authentication error handling and token refresh:

- **401 Unauthorized**: Validates proper error categorization and messaging
- **Token refresh and retry**: Tests automatic token refresh on expiration
- **Non-retryable auth errors**: Confirms immediate failure for user action required
- **Non-JSON auth responses**: Handles HTML error pages from auth failures

**Key Behaviors Tested:**
- Authentication error categorization
- Token refresh workflow
- Distinction between retryable and non-retryable auth errors
- Helpful error messages guiding users to `az login`

### 4. Rate Limiting Recovery (3 tests)

Tests rate limiter behavior and 429 handling:

- **429 rate limit error**: Tests retry behavior with exponential backoff
- **Rate limiter throttling**: Validates token bucket algorithm
- **Rate limiter stats**: Tests token tracking and capacity management

**Key Behaviors Tested:**
- Automatic retry on 429 responses
- Token bucket rate limiting (configurable capacity and refill rate)
- Proper throttling of concurrent requests
- Rate limiter state management

### 5. 500 Internal Server Error Recovery (4 tests)

Tests handling of server-side errors:

- **500 Internal Server Error**: Validates retry on transient server errors
- **503 Service Unavailable**: Tests retry logic for temporary unavailability
- **502 Bad Gateway**: Validates retry for gateway errors
- **504 Gateway Timeout**: Tests handling of upstream timeouts

**Key Behaviors Tested:**
- Classification of 5xx errors as retryable
- Automatic retry with backoff
- Error message clarity

### 6. Permission Denied Errors (2 tests)

Tests 403 Forbidden error handling:

- **403 error with helpful message**: Validates descriptive error output
- **No retry for permission errors**: Confirms immediate failure (user action required)

**Key Behaviors Tested:**
- Permission errors are NOT retryable
- Clear error messages indicating missing permissions
- Proper error categorization

### 7. Error Message Quality (3 tests)

Tests that error messages are helpful and descriptive:

- **Network failure messages**: Validates ECONNREFUSED error clarity
- **DNS failure messages**: Tests ENOTFOUND error messaging
- **Error categorization**: Validates correct error category assignment

**Key Behaviors Tested:**
- Error messages contain actionable information
- Errors are properly categorized for user guidance
- Technical details are preserved for debugging

### 8. Cleanup After Failures (3 tests)

Tests resource cleanup and state management:

- **Rate limiter cleanup**: Validates proper state reset
- **No resource leaks**: Confirms no leaked resources after repeated failures
- **Concurrent operations**: Tests state consistency with parallel operations

**Key Behaviors Tested:**
- Rate limiter buckets can be reset
- No memory leaks or resource leaks
- Thread-safe operation handling

### 9. Exponential Backoff (2 tests)

Tests retry timing and backoff behavior:

- **Exponential backoff**: Validates increasing delays (100ms, 200ms, 400ms)
- **Max delay cap**: Confirms delays respect maximum limit

**Key Behaviors Tested:**
- Exponential backoff calculation (default 2x multiplier)
- Configurable initial delay (default 1000ms)
- Maximum delay cap (default 10000ms)
- Backoff helps avoid overwhelming failed services

### 10. Bulk Operations Error Recovery (2 tests)

Tests error handling in batch operations:

- **Partial failures**: Validates individual operation failure handling
- **Transient failures in sequence**: Tests recovery from intermittent errors

**Key Behaviors Tested:**
- Bulk operations handle partial failures
- Individual operation errors don't prevent others
- Transient errors are retried in sequence

### 11. Error Classification (4 tests)

Tests error type detection for retry decisions:

- **Transient error identification**: Validates detection of retryable errors
- **Non-transient error identification**: Tests detection of permanent errors
- **Retryable auth errors**: Validates token refresh scenarios
- **Non-retryable auth errors**: Tests user action required scenarios

**Key Behaviors Tested:**
- Accurate error classification
- Correct retry/no-retry decisions
- Auth error special handling

## Test Scenarios Covered

### Network Errors
- ✅ Connection lost during API call (ECONNREFUSED, ECONNRESET)
- ✅ DNS resolution failure (ENOTFOUND)
- ✅ Socket hang up
- ✅ Request timeout
- ✅ Network timeouts

### API Errors
- ✅ 429 Rate limit exceeded
- ✅ 401 Authentication error
- ✅ 403 Permission denied
- ✅ 500 Internal server error
- ✅ 502 Bad Gateway
- ✅ 503 Service Unavailable
- ✅ 504 Gateway Timeout

### Authentication Scenarios
- ✅ Token expiration mid-operation
- ✅ Token refresh and retry
- ✅ User not logged in (non-retryable)
- ✅ Invalid credentials (non-retryable)
- ✅ HTML error pages instead of JSON

### Recovery Behaviors
- ✅ Retry with exponential backoff
- ✅ Rate limiting with token bucket
- ✅ Error categorization
- ✅ Helpful error messages
- ✅ Resource cleanup after failures
- ✅ Concurrent operation safety

## Implementation Details

### Mocking Strategy

Tests use Jest mocking to simulate errors without making real API calls:

```typescript
// Mock global fetch for HTTP errors
global.fetch = jest.fn() as any;
(global.fetch as jest.Mock).mockImplementation(() => {
  // Return mock responses or throw errors
});
```

### Key Components Tested

1. **`ADOHttpClient`** (`src/utils/ado-http-client.ts`)
   - HTTP request/response handling
   - Error detection and categorization
   - Timeout handling

2. **`withRetry`** (`src/utils/retry.ts`)
   - Retry logic with exponential backoff
   - Retryable error detection
   - Operation naming for logging

3. **`RateLimiter`** (`src/services/rate-limiter.ts`)
   - Token bucket algorithm
   - Request throttling
   - State management

4. **Error Categorization** (`src/types/error-categories.ts`)
   - Error classification
   - Retryable vs non-retryable
   - Error metadata

### Test Performance

- **Total Runtime**: ~6 seconds
- **Fast Execution**: Uses mocks instead of real API calls
- **Isolated**: Each test has independent state
- **Deterministic**: Backoff delays use small values for speed

### Configuration

Tests use the following configurations:

```typescript
// Retry configuration for fast testing
{
  maxAttempts: 3,
  initialDelayMs: 10,      // Fast for testing (default: 1000ms)
  maxDelayMs: 1000,        // Reduced for speed (default: 10000ms)
  backoffMultiplier: 2
}

// Rate limiter configuration
{
  capacity: 3-5 tokens,    // Small for testing
  refillRate: 5-10/sec     // Fast for testing
}
```

## Maintenance

### Adding New Test Scenarios

When adding new error scenarios:

1. **Create a new describe block** for the error category
2. **Mock the error condition** using fetch or function mocks
3. **Verify retry behavior** (should retry or should not retry)
4. **Check error messages** are helpful and actionable
5. **Validate cleanup** (no resource leaks)

Example:

```typescript
it('should handle new error type', async () => {
  // Setup: Mock the error
  (global.fetch as jest.Mock).mockImplementation(() => {
    return Promise.reject(new Error('New error type'));
  });

  // Execute: Call the operation
  await expect(
    httpClient.get('/endpoint')
  ).rejects.toThrow('New error type');

  // Verify: Check categorization
  const error = new Error('New error type');
  expect(isTransientError(error)).toBe(expectedResult);
});
```

### Updating for New Error Categories

If new error categories are added to `ErrorCategory` enum:

1. Add tests in **Error Classification** section
2. Add tests in **Error Message Quality** section
3. Update **Error Categorization** system tests
4. Verify retry behavior is appropriate

### Performance Considerations

Keep tests fast by:

- Using small delay values (10-100ms instead of 1000ms+)
- Using fast rate limiter settings (5-10 tokens/sec)
- Minimizing actual async delays
- Using mocks instead of real API calls

## Related Files

- **Test File**: `test/integration/error-recovery.test.ts`
- **Retry Logic**: `src/utils/retry.ts`
- **HTTP Client**: `src/utils/ado-http-client.ts`
- **Rate Limiter**: `src/services/rate-limiter.ts`
- **Error Categories**: `src/types/error-categories.ts`
- **Error Categorization Tests**: `test/unit/error-categorization.test.ts`

## Success Criteria

All tests should:

- ✅ Pass consistently
- ✅ Complete in < 10 seconds
- ✅ Not make real API calls
- ✅ Clean up resources properly
- ✅ Test both success and failure paths
- ✅ Verify error messages are helpful

## Future Enhancements

Potential areas for additional testing:

- Circuit breaker pattern implementation
- Retry budget exhaustion
- Distributed rate limiting
- Error aggregation and reporting
- Correlation ID tracking across retries
- Metrics collection during errors
