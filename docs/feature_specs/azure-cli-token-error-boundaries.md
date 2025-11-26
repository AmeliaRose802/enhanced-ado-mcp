# Azure CLI Token Acquisition Error Boundaries

## Overview

Enhanced Azure CLI token acquisition with comprehensive error boundaries, retry logic with exponential backoff, and automatic token refresh before expiration. Provides clear, actionable error messages for common authentication failures to improve developer experience and reliability.

## Version

- **Initial Release**: November 18, 2025
- **Status**: Active

## Problem Statement

The original Azure CLI token acquisition had minimal error handling:
- Generic error messages that didn't guide users toward resolution
- No retry logic for transient network failures
- No token caching or proactive refresh
- Difficult to diagnose authentication issues

## Solution

### 1. Retry Utility (`src/utils/retry.ts`)

Generic retry mechanism with exponential backoff for handling transient failures:

```typescript
interface RetryOptions {
  maxAttempts?: number;          // Default: 3
  initialDelayMs?: number;       // Default: 1000ms
  maxDelayMs?: number;           // Default: 10000ms
  backoffMultiplier?: number;    // Default: 2
  isRetryable?: (error: Error) => boolean;
  operationName?: string;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T>
```

**Features:**
- Exponential backoff with configurable multiplier
- Maximum delay cap to prevent excessive waits
- Custom retry predicate for selective retry
- Automatic detection of transient errors (network, rate limit)
- Special handling for authentication errors

### 2. Azure CLI Token Provider (`src/utils/azure-cli-token.ts`)

Enhanced token provider with error boundaries and caching:

```typescript
class AzureCliTokenProvider {
  async getToken(): Promise<string>
  clearCache(): void
  getTokenInfo(): { isCached: boolean; expiresIn?: number } | null
}
```

**Features:**
- **Token Caching**: Reuses valid tokens to reduce API calls
- **Proactive Refresh**: Refreshes tokens 5 minutes before expiration
- **Retry Logic**: Up to 3 attempts with exponential backoff for transient failures
- **Clear Error Messages**: Detailed, actionable error messages for common failures

## Error Categories

### 1. Not Logged In
**Symptoms:** `not logged in`, `az login`, `no accounts`, `please run`

**Error Message:**
```
Azure CLI authentication required. You are not logged in to Azure CLI.
Action required: Run "az login" in your terminal to authenticate.
After logging in, try the operation again.
```

**Metadata:**
- Category: `AUTHENTICATION`
- Code: `AUTH_NOT_LOGGED_IN`
- Retryable: No

### 2. Token Expired
**Symptoms:** `expired`, `invalid token`, `refresh`

**Error Message:**
```
Azure CLI token has expired or is invalid.
Action required: Run "az login" to refresh your authentication.
If you continue to experience issues, try "az account clear" followed by "az login".
```

**Metadata:**
- Category: `AUTHENTICATION`
- Code: `AUTH_TOKEN_EXPIRED`
- Retryable: No

### 3. Azure CLI Not Installed
**Symptoms:** `not found`, `command not found`, `not recognized`

**Error Message:**
```
Azure CLI is not installed or not available in PATH.
Action required:
  1. Install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
  2. Ensure "az" command is available in your PATH
  3. Run "az login" to authenticate
Alternatively, use a different authentication method (e.g., --authentication interactive).
```

**Metadata:**
- Category: `AUTHENTICATION`
- Code: `AUTH_CLI_NOT_AVAILABLE`
- Retryable: No

### 4. Insufficient Permissions
**Symptoms:** `permission`, `forbidden`, `insufficient`, `access denied`

**Error Message:**
```
Insufficient permissions for Azure CLI authentication.
Action required:
  1. Ensure you are logged in with an account that has access to Azure DevOps
  2. Verify your account has the necessary permissions in your Azure DevOps organization
  3. Try running "az login" with a different account if needed
```

**Metadata:**
- Category: `AUTHENTICATION`
- Code: `AUTH_INSUFFICIENT_PERMISSIONS`
- Retryable: No

### 5. Network Errors (Transient)
**Symptoms:** `timeout`, `network`, `connection`, `ECONNREFUSED`

**Error Message:**
```
Network error during Azure CLI token acquisition (after 3 retry attempts).
Possible causes:
  - Temporary network connectivity issues
  - Azure authentication service unavailable
  - Firewall or proxy blocking connection
Action required:
  1. Check your internet connection
  2. Verify you can access Azure services (https://portal.azure.com)
  3. If using a proxy, ensure Azure CLI is configured correctly
  4. Try again in a few moments
```

**Metadata:**
- Category: `NETWORK`
- Code: `NETWORK_TIMEOUT`
- Retryable: Yes (automatically retried 3 times)

## Token Caching & Refresh

### Cache Behavior

1. **First Request**: Acquires token from Azure CLI and caches it
2. **Subsequent Requests**: Returns cached token if valid
3. **Expiration Buffer**: 5 minutes before expiration, proactively refreshes token
4. **Expired Token**: Automatically acquires new token

### Cache Management

```typescript
const provider = new AzureCliTokenProvider();

// Get token (uses cache if available)
const token = await provider.getToken();

// Clear cache (forces refresh on next call)
provider.clearCache();

// Get cache info for monitoring
const info = provider.getTokenInfo();
// { isCached: true, expiresIn: 3540 } (seconds)
```

## Retry Logic

### Retry Strategy

- **Max Attempts**: 3
- **Initial Delay**: 1000ms (1 second)
- **Backoff Multiplier**: 2 (exponential)
- **Max Delay**: 10000ms (10 seconds)

### Retry Timeline Example

For transient network failure:
1. **Attempt 1**: Immediate failure
2. **Wait**: 1000ms
3. **Attempt 2**: Failure
4. **Wait**: 2000ms (exponential backoff)
5. **Attempt 3**: Success or final failure

### Retryable Errors

**Always Retried:**
- Network timeouts (`timeout`, `ECONNREFUSED`, `ECONNRESET`)
- DNS failures (`ENOTFOUND`)
- Rate limiting (`429`, `rate limit`)
- Service unavailable (`503`)
- Gateway errors (`502`, `504`)

**Never Retried:**
- Not logged in (user action required)
- Invalid credentials (user action required)
- Permission denied (user action required)
- Token expired (user action required)

## Integration Points

### Updated Services

1. **`ado-identity-service.ts`**: Uses enhanced token provider for identity operations
2. **`ado-token.ts`**: Uses enhanced token provider for `azcli` authentication mode

### Before (Old Code)
```typescript
function createIdentityTokenProvider(): () => Promise<string> {
  const credential = new AzureCliCredential();
  const scopes = ['499b84ac-1321-427f-aa17-267ca6975798/.default'];
  
  return async () => {
    try {
      const result = await credential.getToken(scopes);
      if (!result) {
        throw new Error('Failed to obtain token from Azure CLI');
      }
      return result.token;
    } catch (error) {
      logger.error('Azure CLI authentication failed. Please ensure you are logged in with: az login');
      throw error;
    }
  };
}
```

### After (New Code)
```typescript
function createIdentityTokenProvider(): () => Promise<string> {
  const scopes = ['499b84ac-1321-427f-aa17-267ca6975798/.default'];
  return createAzureCliTokenProvider(undefined, scopes);
}
```

**Benefits:**
- Automatic retry logic with exponential backoff
- Token caching and proactive refresh
- Clear, actionable error messages
- Error categorization with metadata

## Testing

### Unit Tests

**`test/unit/retry.test.ts`**: Retry utility tests
- Successful operation on first attempt
- Retry on failure and eventual success
- Retry exhaustion
- Custom retry predicate
- Exponential backoff timing
- Max delay enforcement
- Non-Error rejection handling
- Transient error detection
- Retryable auth error detection

**`test/unit/azure-cli-token.test.ts`**: Token provider tests
- Successful token acquisition
- Token caching and reuse
- Proactive refresh before expiration
- Custom tenant ID support
- Custom scopes support
- Error categorization (not logged in, expired, not installed, etc.)
- Retry on transient errors
- No retry on non-retryable errors
- Cache management

### Manual Testing

Test different error scenarios:

```bash
# Test not logged in
az logout
# Run MCP server with azcli auth - should get clear error

# Test expired token (simulate)
# - Let token expire naturally
# - Should auto-refresh before actual expiration

# Test network issues (simulate)
# - Disconnect network temporarily during token acquisition
# - Should retry and provide clear error after exhaustion

# Test insufficient permissions
# - Use account without Azure DevOps access
# - Should get clear permission error
```

## Performance Impact

### Before Enhancement
- No caching: Every request acquired new token
- No retry: Transient failures immediately failed
- Average token acquisition: ~500-1000ms per request

### After Enhancement
- Token caching: First request ~500-1000ms, subsequent <1ms (cache hit)
- Proactive refresh: Token never expires during use
- Retry logic: Transient failures succeed after retry (~1-3 seconds total)

**Expected Improvement:**
- 99% reduction in token acquisition time for cached tokens
- 80-90% reduction in transient failure errors
- Better user experience with actionable error messages

## Configuration

No configuration required - uses sensible defaults:

```typescript
// Default retry options
{
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

// Default token refresh buffer
5 minutes before expiration
```

## Migration Guide

### For Existing Code

**No breaking changes** - existing code continues to work:

```typescript
// Old usage (still works)
import { createAuthenticator } from './utils/ado-token.js';
const getToken = createAuthenticator('azcli');
const token = await getToken();

// New usage (direct access to enhanced provider)
import { createAzureCliTokenProvider } from './utils/azure-cli-token.js';
const getToken = createAzureCliTokenProvider();
const token = await getToken();
```

### For New Code

Recommended to use enhanced provider directly for better control:

```typescript
import { AzureCliTokenProvider } from './utils/azure-cli-token.js';

const provider = new AzureCliTokenProvider();

// Get token with automatic caching and retry
const token = await provider.getToken();

// Monitor token status
const info = provider.getTokenInfo();
console.log(`Token expires in ${info?.expiresIn}s`);

// Force refresh if needed
provider.clearCache();
```

## Error Monitoring

All errors include structured metadata for logging and monitoring:

```typescript
try {
  const token = await provider.getToken();
} catch (error) {
  console.error('Token acquisition failed:', {
    message: error.message,
    category: error.metadata.category,
    code: error.metadata.code,
    retryable: error.metadata.retryable,
    context: error.metadata.context,
  });
}
```

## Future Enhancements

Possible future improvements:
1. **Configurable Retry Settings**: Allow users to customize retry behavior
2. **Metrics Collection**: Track token acquisition success/failure rates
3. **Token Expiration Warnings**: Proactive warnings before expiration
4. **Multi-tenant Token Management**: Support multiple tenant tokens simultaneously
5. **Background Token Refresh**: Refresh tokens in background before they're needed

## Troubleshooting

### Token Caching Issues

**Problem**: Token not refreshing when it should
**Solution**: Clear cache manually
```typescript
provider.clearCache();
```

### Excessive Retries

**Problem**: Retry logic causing delays
**Solution**: Check error type - non-retryable errors should fail immediately

### Permission Errors

**Problem**: Insufficient permissions despite being logged in
**Solution**: 
1. Verify account has Azure DevOps access
2. Check organization membership
3. Try different account with `az login --tenant <tenant-id>`

## References

- [Azure CLI Documentation](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Identity SDK](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity)
- [Exponential Backoff Pattern](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Error Categories Documentation](../../src/types/error-categories.ts)
