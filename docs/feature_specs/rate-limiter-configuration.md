# Rate Limiter Configuration

## Overview

The Enhanced ADO MCP Server includes a configurable rate limiter that protects against Azure DevOps API throttling. Rate limits can be customized based on your Azure DevOps subscription tier to optimize performance while preventing rate limit errors.

## Why Rate Limiting?

Azure DevOps enforces rate limits based on your subscription tier:

- **Free tier**: ~200 requests per minute
- **Basic tier**: ~1000 requests per minute  
- **Basic + Test Plans / Enterprise**: Higher limits (varies)

Without rate limiting, bulk operations can trigger 429 errors and cause operations to fail. The rate limiter uses a **token bucket algorithm** to smooth out request bursts while staying within API limits.

## Configuration

### Default Settings (Free Tier)

By default, the server uses conservative settings appropriate for the free tier:

```json
{
  "rateLimiter": {
    "capacity": 200,
    "refillRate": 3.33
  }
}
```

- **capacity**: Maximum burst size (200 requests can be sent immediately)
- **refillRate**: Tokens per second (3.33 tokens/sec ≈ 200 requests/min)

### Customizing Rate Limits

Currently, rate limits are configured via the configuration schema. Future versions will support per-organization configuration through CLI flags or environment variables.

#### For Basic Tier (~1000 req/min)

```typescript
// In config.ts or via future CLI flags
rateLimiter: {
  capacity: 1000,
  refillRate: 16.67  // ~1000 requests per minute
}
```

#### For Enterprise/High-Tier

```typescript
rateLimiter: {
  capacity: 2000,
  refillRate: 50  // ~3000 requests per minute
}
```

### Validation Rules

The configuration schema enforces these bounds:

- **capacity**: min 10, max 2000
- **refillRate**: min 0.1, max 50 tokens/second

These limits prevent misconfiguration while supporting a wide range of subscription tiers.

## Token Bucket Algorithm

The rate limiter uses a token bucket algorithm:

1. **Bucket** starts with `capacity` tokens
2. **Tokens** refill at `refillRate` per second
3. Each **API request** consumes 1 token
4. If bucket is empty, request **waits** until a token is available
5. **Burst traffic** is allowed up to capacity

### Example

With default settings (capacity: 200, refillRate: 3.33):

- **First 200 requests**: Execute immediately (burst)
- **Requests 201+**: Throttled to ~3.33 per second
- **After 60 seconds**: Bucket refills 200 tokens (ready for next burst)

## How It Works

### Initialization

The rate limiter loads configuration lazily on first use:

```typescript
// In rate-limiter.ts
private ensureConfigured(): void {
  if (this.isConfigured) return;
  
  const config = loadConfiguration();
  this.defaultCapacity = config.rateLimiter.capacity;
  this.defaultRefillRate = config.rateLimiter.refillRate;
  this.isConfigured = true;
}
```

### Per-Key Buckets

The rate limiter supports separate buckets per key (e.g., per organization):

```typescript
// Different buckets for different organizations
await rateLimiter.throttle('org1');
await rateLimiter.throttle('org2');
```

Currently, all requests use the 'ado-api' key, but this enables future per-organization limits.

## Choosing the Right Settings

### Free Tier (Default)

Use default settings:
- capacity: 200
- refillRate: 3.33

**When to use**: 
- Personal projects
- Small teams
- < 200 requests/min average load

### Basic Tier

Increase limits moderately:
- capacity: 1000  
- refillRate: 16.67

**When to use**:
- Professional projects
- Medium teams (5-20 people)
- 200-1000 requests/min average load

### Enterprise/High-Tier

Use maximum safe settings:
- capacity: 2000
- refillRate: 50

**When to use**:
- Large organizations
- High automation load
- > 1000 requests/min average load

### Conservative Tuning

**Start conservative** and increase gradually:

1. Start with default (free tier) settings
2. Monitor for rate limit errors in logs
3. Increase by 50% if you see throttling
4. Repeat until you find optimal settings

**Warning**: Setting limits too high can trigger 429 errors from Azure DevOps, causing operations to fail.

## Implementation Details

### File Structure

- **Configuration**: `mcp_server/src/config/config.ts`
  - `RateLimiterConfig` interface
  - `rateLimiterConfigSchema` Zod schema
  - Default values in schema
  
- **Rate Limiter**: `mcp_server/src/services/rate-limiter.ts`
  - `RateLimiter` class with token bucket
  - Lazy configuration loading
  - Per-key bucket support

- **HTTP Client**: `mcp_server/src/utils/ado-http-client.ts`
  - `await rateLimiter.throttle('ado-api')` before each request

### Configuration Schema

```typescript
export const rateLimiterConfigSchema = z.object({
  capacity: z.number().int().min(10).max(2000).default(200),
  refillRate: z.number().min(0.1).max(50).default(3.33),
});
```

### Token Bucket Implementation

```typescript
interface TokenBucket {
  tokens: number;        // Current tokens available
  lastRefill: number;    // Timestamp of last refill
  capacity: number;      // Maximum burst size
  refillRate: number;    // Tokens added per second
}
```

## Testing

### Unit Tests

Located in `mcp_server/test/unit/rate-limiter.test.ts`:

- ✅ Basic throttling behavior
- ✅ Token refill over time  
- ✅ Per-key bucket isolation
- ✅ Custom capacity and refill rate
- ✅ Configuration validation

### Manual Testing

Test with different configurations:

```bash
# Free tier (default)
npm run dev

# Basic tier
# (Future: --rate-limit-capacity 1000 --rate-limit-refill-rate 16.67)

# Monitor for throttling in logs
# Look for: "Rate limit approaching" warnings
```

## Error Handling

The rate limiter is designed to fail safely:

1. **Config unavailable**: Falls back to default values
2. **Invalid config**: Caught by Zod schema validation
3. **Network errors**: Transparent (doesn't affect rate limiting)

Rate limit errors from Azure DevOps (429) are detected and logged but not automatically retried by the rate limiter itself. The retry logic is handled by the error handler.

## Future Enhancements

### CLI Flags

Add command-line configuration:

```bash
enhanced-ado-mcp MyOrg \
  --area-path "Project\Team" \
  --rate-limit-capacity 1000 \
  --rate-limit-refill-rate 16.67
```

### Environment Variables

Support environment-based config:

```bash
export ADO_RATE_LIMIT_CAPACITY=1000
export ADO_RATE_LIMIT_REFILL_RATE=16.67
```

### Per-Organization Configuration

Allow different limits per organization:

```json
{
  "rateLimiter": {
    "organizations": {
      "myorg": { "capacity": 200, "refillRate": 3.33 },
      "enterprise-org": { "capacity": 2000, "refillRate": 50 }
    }
  }
}
```

### Auto-Detection

Automatically detect tier from API responses:

- Monitor `X-RateLimit-*` headers
- Adjust limits dynamically
- Learn optimal settings over time

### Metrics & Monitoring

Track rate limiter effectiveness:

- Tokens consumed per minute
- Wait time distribution  
- Rate limit hit rate
- Optimal capacity recommendations

## References

- **Azure DevOps Rate Limits**: [Rate limits and throttling patterns](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits)
- **Token Bucket Algorithm**: [Wikipedia](https://en.wikipedia.org/wiki/Token_bucket)
- **Configuration Schema**: `mcp_server/src/config/config.ts`
- **Implementation**: `mcp_server/src/services/rate-limiter.ts`

## Changelog

### 2025-11-18 - Initial Implementation
- Added `RateLimiterConfig` interface
- Added Zod schema with validation
- Updated `RateLimiter` to load from config
- Added configuration tests
- Created feature specification

---

**Status**: ✅ Implemented  
**Version**: 1.0.0  
**Author**: Enhanced ADO MCP Team
