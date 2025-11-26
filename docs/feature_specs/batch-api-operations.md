# Azure DevOps Batch API Operations

**Feature Category:** Performance Optimization  
**Status:** 🚧 In Development  
**Version:** 2.0.0  
**Last Updated:** 2025-11-18  
**Issue:** ADO-Work-Item-MSP-75

## Overview

Implements Azure DevOps Batch API support to send multiple operations in a single HTTP request, reducing network overhead from N requests to 1 request for bulk operations. This feature improves bulk operation performance by 5-10x while reducing rate limiting impact.

## Purpose

Enable high-performance batch operations with:
- Single HTTP request for multiple operations (N→1 reduction)
- Support for mixed operation types (GET, POST, PATCH, DELETE)
- Automatic request batching with configurable limits
- Partial failure handling with per-item error reporting
- Transparent integration with existing bulk operations
- Reduced API rate limiting impact

## Azure DevOps Batch API

### Endpoint
```
POST https://dev.azure.com/{organization}/_apis/wit/$batch?api-version=7.1-preview
```

### Request Format
```json
{
  "requests": [
    {
      "method": "GET",
      "uri": "/_apis/wit/workitems/12345?api-version=7.1",
      "headers": {
        "Accept": "application/json"
      }
    },
    {
      "method": "PATCH",
      "uri": "/_apis/wit/workitems/12346?api-version=7.1",
      "headers": {
        "Content-Type": "application/json-patch+json"
      },
      "body": [
        { "op": "replace", "path": "/fields/System.State", "value": "Resolved" }
      ]
    }
  ]
}
```

### Response Format
```json
{
  "count": 2,
  "value": [
    {
      "code": 200,
      "headers": { "Content-Type": "application/json" },
      "body": { /* work item data */ }
    },
    {
      "code": 200,
      "headers": { "Content-Type": "application/json-patch+json" },
      "body": { /* updated work item data */ }
    }
  ]
}
```

### Limits
- **Max operations per batch:** 200 operations
- **Request timeout:** 30 seconds
- **Individual operation timeout:** Inherits from batch timeout
- **Rate limiting:** Counts as 1 API call instead of N calls

## Architecture

### Components

1. **Batch Request Builder** (`src/utils/batch-request-builder.ts`)
   - Constructs batch API request payloads
   - Validates operation limits
   - Handles URI formatting

2. **Batch Client** (`src/services/batch-client.ts`)
   - Executes batch requests
   - Parses batch responses
   - Maps responses to original requests

3. **Batch Processor** (`src/utils/batch-processor.ts` - enhanced)
   - Auto-batching logic for bulk operations
   - Fallback to sequential requests on error
   - Configuration management

4. **Repository Integration** (`src/repositories/work-item.repository.ts`)
   - Batch GET operations
   - Batch PATCH operations
   - Batch POST operations (creates)

## Implementation

### Batch Request Builder

```typescript
export interface BatchRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  uri: string;
  headers?: Record<string, string>;
  body?: unknown;
  metadata?: {
    workItemId?: number;
    operationType?: string;
  };
}

export interface BatchResponse {
  code: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface BatchResult {
  count: number;
  value: BatchResponse[];
}

export class BatchRequestBuilder {
  private requests: BatchRequest[] = [];
  private maxBatchSize = 200;

  addGetRequest(workItemId: number, fields?: string[]): this;
  addPatchRequest(workItemId: number, operations: ADOFieldOperation[]): this;
  addPostRequest(workItemType: string, operations: ADOFieldOperation[]): this;
  addCommentRequest(workItemId: number, comment: string): this;
  
  build(): { requests: BatchRequest[] };
  canAddMore(): boolean;
  getCount(): number;
}
```

### Batch Client

```typescript
export class BatchClient {
  constructor(
    private httpClient: ADOHttpClient,
    private organization: string,
    private project: string
  ) {}

  async executeBatch(requests: BatchRequest[]): Promise<BatchResult>;
  
  async executeBatchWithRetry(
    requests: BatchRequest[],
    options?: {
      maxRetries?: number;
      retryableStatuses?: number[];
    }
  ): Promise<BatchResult>;
}
```

### Auto-Batching Integration

```typescript
export interface BatchProcessorOptions {
  batchSize?: number;        // Max items per batch (default: 200)
  useBatchAPI?: boolean;      // Enable batch API (default: true)
  fallbackOnError?: boolean;  // Fall back to sequential on batch error (default: true)
  concurrency?: number;       // Parallel batches (default: 5)
}

export async function processBatchWithAPI<T>(
  items: T[],
  operation: (item: T) => BatchRequest,
  options?: BatchProcessorOptions
): Promise<BatchProcessResult>;
```

## Configuration

### .ado-mcp-config.json
```json
{
  "batchAPI": {
    "enabled": true,
    "maxBatchSize": 200,
    "timeout": 30000,
    "fallbackOnError": true,
    "autoDetectSupport": true
  }
}
```

### Environment Variables
```bash
ADO_BATCH_API_ENABLED=true
ADO_BATCH_SIZE=200
ADO_BATCH_TIMEOUT=30000
```

## Supported Operations

### 1. Batch GET (Read Work Items)
- Replace multiple `GET /wit/workitems/{id}` calls
- Used in: `getBatch()`, context fetching, pre-fetch for updates
- **Before:** N API calls
- **After:** ⌈N/200⌉ API calls

### 2. Batch PATCH (Update Work Items)
- Replace multiple `PATCH /wit/workitems/{id}` calls  
- Used in: bulk updates, bulk comments, state transitions
- **Before:** N API calls
- **After:** ⌈N/200⌉ API calls

### 3. Batch POST (Create Work Items)
- Replace multiple `POST /wit/workitems/$type` calls
- Used in: bulk work item creation
- **Before:** N API calls
- **After:** ⌈N/200⌉ API calls

### 4. Batch Comments
- Replace multiple comment POST calls
- Used in: bulk comment operations
- **Before:** N API calls
- **After:** ⌈N/200⌉ API calls

### 5. Mixed Operations
- Combine different operation types in single batch
- Example: Fetch items + Update items
- **Before:** 2N API calls
- **After:** ⌈2N/200⌉ API calls

## Error Handling

### Partial Success
```json
{
  "count": 3,
  "value": [
    {
      "code": 200,
      "body": { "id": 12345, "success": true }
    },
    {
      "code": 400,
      "body": { "message": "Invalid state transition" }
    },
    {
      "code": 200,
      "body": { "id": 12347, "success": true }
    }
  ]
}
```

### Error Recovery
1. **Per-Item Errors:** Map batch response index to original item
2. **Batch Failure:** Fall back to sequential requests
3. **Retry Logic:** Retry failed items individually
4. **Timeout Handling:** Split large batches into smaller chunks

### Error Response Format
```typescript
interface BatchOperationResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  results: Array<{
    index: number;
    workItemId?: number;
    success: boolean;
    statusCode: number;
    data?: unknown;
    error?: string;
  }>;
}
```

## Performance Improvements

### Benchmarks

| Operation | Items | Before (N calls) | After (Batch) | Improvement |
|-----------|-------|------------------|---------------|-------------|
| Bulk Update | 100 | 100 API calls | 1 API call | **100x** |
| Bulk Update | 500 | 500 API calls | 3 API calls | **167x** |
| Fetch + Update | 100 | 200 API calls | 2 API calls | **100x** |
| Bulk Comments | 50 | 50 API calls | 1 API call | **50x** |

### Expected Impact
- **API Calls:** Reduced by 50-100x (depending on batch size)
- **Latency:** Reduced by 5-10x (network roundtrip elimination)
- **Rate Limiting:** 50-100x better headroom
- **Throughput:** Process 1000s of items in seconds vs minutes

### Rate Limiting Impact
- **Before:** 200 req/min limit = max 200 items/min
- **After:** 200 req/min limit = max 40,000 items/min (200 batches × 200 items)

## Integration Points

### Updated Components

1. **work-item.repository.ts**
   - `getBatch()` → Use batch GET
   - `update()` → Support batch PATCH
   - New: `updateBatch()`, `getBatchWithAPI()`

2. **unified-bulk-operations.handler.ts**
   - Auto-batch comment operations
   - Auto-batch update operations
   - Auto-batch state transitions

3. **batch-processor.ts**
   - New: `processBatchWithAPI()`
   - Automatic batching logic
   - Fallback to sequential

## Usage Examples

### Example 1: Batch Update with Auto-Batching
```typescript
// Transparent batching - no code changes required
await callTool("execute-bulk-operations", {
  queryHandle: "qh_abc123",
  actions: [
    {
      type: "update",
      updates: [
        { op: "replace", path: "/fields/System.Priority", value: 1 }
      ]
    }
  ],
  dryRun: false
});

// Internally uses batch API automatically for 500 items
// Before: 500 API calls
// After: 3 API calls (500/200 = 2.5 → 3 batches)
```

### Example 2: Manual Batch API Usage
```typescript
import { BatchClient, BatchRequestBuilder } from '@/services/batch-client';

const builder = new BatchRequestBuilder();

// Add multiple operations
for (const id of workItemIds) {
  builder.addPatchRequest(id, [
    { op: "replace", path: "/fields/System.State", value: "Resolved" }
  ]);
}

const batchClient = new BatchClient(httpClient, org, project);
const result = await batchClient.executeBatch(builder.build().requests);

// Process results
for (let i = 0; i < result.value.length; i++) {
  const response = result.value[i];
  if (response.code === 200) {
    console.log(`Item ${i} updated successfully`);
  } else {
    console.error(`Item ${i} failed: ${response.body}`);
  }
}
```

### Example 3: Mixed Operations Batch
```typescript
const builder = new BatchRequestBuilder();

// Fetch items
builder.addGetRequest(12345);
builder.addGetRequest(12346);

// Update items
builder.addPatchRequest(12345, [
  { op: "replace", path: "/fields/System.State", value: "Active" }
]);

// Add comment
builder.addCommentRequest(12346, "Updated via batch API");

const result = await batchClient.executeBatch(builder.build().requests);
```

## Feature Flags

### Gradual Rollout
```typescript
// Configuration-based toggle
const config = loadConfiguration();
if (config.batchAPI?.enabled) {
  // Use batch API
  await processBatchWithAPI(items, operation);
} else {
  // Use sequential processing
  await processBatch(items, operation);
}
```

### Auto-Detection
```typescript
// Detect batch API support
const supportsBatchAPI = await detectBatchAPISupport(httpClient);
if (supportsBatchAPI) {
  logger.info('Batch API detected, enabling optimizations');
}
```

## Testing

### Unit Tests
- `batch-request-builder.test.ts` - Builder functionality
- `batch-client.test.ts` - Batch execution logic
- `batch-processor.test.ts` - Auto-batching logic

### Integration Tests
- `batch-operations-integration.test.ts` - Real API calls
- Error scenarios (partial failure, timeout, rate limiting)
- Fallback behavior

### Performance Tests
- Benchmark batch vs sequential
- Large batch processing (1000+ items)
- Rate limiting impact

### Test Scenarios
```typescript
describe('Batch API Operations', () => {
  it('should batch 100 updates into 1 API call', async () => {
    const result = await batchUpdate(items);
    expect(apiCallCount).toBe(1);
  });

  it('should handle partial failures', async () => {
    // Mock 50% failure rate
    const result = await batchUpdate(items);
    expect(result.successfulRequests).toBe(50);
    expect(result.failedRequests).toBe(50);
  });

  it('should fall back to sequential on batch error', async () => {
    // Mock batch API unavailable
    const result = await processBatchWithAPI(items, operation, {
      fallbackOnError: true
    });
    expect(result.usedFallback).toBe(true);
  });
});
```

## Migration Guide

### Existing Code Changes
**No code changes required!** Batching is automatic when enabled.

### Opt-In Migration
```typescript
// Before
await processBatch(items, async (item) => {
  await httpClient.patch(`wit/workitems/${item.id}`, updates);
});

// After (explicit)
await processBatchWithAPI(items, (item) => ({
  method: 'PATCH',
  uri: `/_apis/wit/workitems/${item.id}`,
  body: updates
}));
```

## Monitoring

### Metrics
- `batch_api_requests_total` - Total batch API calls
- `batch_api_operations_total` - Total operations in batches
- `batch_api_failures_total` - Batch API failures
- `batch_api_fallback_total` - Fallback to sequential
- `batch_api_duration_ms` - Batch request duration

### Logging
```typescript
logger.info('Batch API request', {
  operations: 150,
  batches: 1,
  estimatedTime: '500ms'
});

logger.info('Batch API response', {
  successful: 148,
  failed: 2,
  duration: 487
});
```

## Troubleshooting

### Issue: Batch API not enabled
**Cause:** Configuration disabled or API version not supported  
**Resolution:** Enable in config or upgrade ADO instance

### Issue: Batch timeouts
**Cause:** Too many operations in single batch  
**Resolution:** Reduce `maxBatchSize` to 100 or 50

### Issue: All operations failing in batch
**Cause:** Invalid auth token or permissions  
**Resolution:** Check token and permissions

### Issue: Partial failures
**Cause:** Individual operation errors (invalid state, etc.)  
**Resolution:** Review per-item error messages in response

## Future Enhancements

1. **Smart Batching:** Analyze operation types and optimize batch composition
2. **Priority Batching:** High-priority items in separate smaller batches
3. **Compression:** Compress large batch payloads
4. **Caching:** Cache batch responses for repeated queries
5. **Streaming:** Stream large batch results
6. **Batch OData:** Support OData queries in batch requests

## References

- [Azure DevOps Batch API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/batch)
- [HTTP Batch Processing](https://datatracker.ietf.org/doc/html/rfc7234#section-5.2)
- [JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902)

---

**Status:** 🚧 In Development  
**Issue:** ADO-Work-Item-MSP-75  
**Author:** Enhanced ADO MCP Team
