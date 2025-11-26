# Telemetry and Metrics Collection

## Overview

The Enhanced ADO MCP Server includes a comprehensive, privacy-conscious telemetry and metrics collection system. This system tracks performance, usage patterns, and operational health to help identify bottlenecks and optimization opportunities.

**Version:** 1.0  
**Status:** Production Ready  
**Privacy:** Opt-in, no PII collection

---

## Key Features

### ✅ Privacy-First Design

- **Opt-in by default** - Telemetry is disabled unless explicitly enabled
- **No PII collection** - Work item content, descriptions, and user data are never collected
- **Local storage only** - All data stays on your machine (no external transmission)
- **Aggregate statistics** - Only performance metrics and usage patterns
- **User control** - Full control over export and analysis

### 📊 Collected Metrics

1. **Operation Latency** - Tool execution duration
2. **API Call Counts** - Number of Azure DevOps API calls per operation
3. **Error Rates** - Errors by type and operation
4. **Cache Statistics** - Hit rates, miss rates, evictions
5. **Query Handle Usage** - Creation, reads, expirations
6. **Bulk Operation Sizes** - Items processed per operation
7. **AI Tool Usage** - Sampling requests and success rates

### ⚡ Performance Impact

- **<1% latency overhead** - Minimal impact on operation performance
- **Async event collection** - Non-blocking telemetry recording
- **Memory-bounded** - Configurable event buffer with automatic eviction
- **Batched writes** - Efficient disk I/O for exports

---

## Configuration

### Environment Variables

```bash
# Enable telemetry (opt-in)
export MCP_TELEMETRY_ENABLED=1

# Custom export directory
export MCP_TELEMETRY_EXPORT_DIR=/path/to/telemetry
```

### CLI Flags

```bash
# Enable telemetry at startup
enhanced-ado-mcp myorg --area-path "Project\\Team" --telemetry

# Specify export directory
enhanced-ado-mcp myorg --area-path "Project\\Team" --telemetry --telemetry-export-dir ./my-telemetry
```

### Programmatic Configuration

```typescript
import { telemetryService } from './services/telemetry-service.js';

// Enable telemetry
telemetryService.enable();

// Configure
telemetryService.updateConfig({
  enabled: true,
  maxEventsInMemory: 10000,
  autoExport: true,
  autoExportInterval: 300000, // 5 minutes
  exportDir: './telemetry',
  consoleLogging: false
});
```

---

## Telemetry Event Structure

### Event Schema

```typescript
{
  timestamp: string;           // ISO 8601 timestamp
  category: string;            // 'tool' | 'api' | 'cache' | 'query-handle' | 'bulk-op' | 'ai' | 'error'
  operation: string;           // Operation name
  duration_ms?: number;        // Duration in milliseconds
  api_calls?: number;          // Number of API calls made
  cache_hits?: number;         // Cache hits during operation
  cache_misses?: number;       // Cache misses during operation
  error?: boolean;             // Error occurred
  error_type?: string;         // Error type (not message - no PII)
  metadata?: {                 // Additional non-PII metadata
    success?: boolean;
    item_count?: number;
    status?: number;
    // ...other non-PII fields
  }
}
```

### Example Events

**Tool Execution:**
```json
{
  "timestamp": "2025-11-18T10:30:00.000Z",
  "category": "tool",
  "operation": "query-wiql",
  "duration_ms": 1250,
  "api_calls": 2,
  "cache_hits": 1,
  "cache_misses": 0,
  "error": false,
  "metadata": {
    "success": true,
    "item_count": 45
  }
}
```

**API Call:**
```json
{
  "timestamp": "2025-11-18T10:30:01.500Z",
  "category": "api",
  "operation": "POST wit/workitems",
  "duration_ms": 150,
  "error": false,
  "metadata": {
    "status": 200,
    "method": "POST"
  }
}
```

**Bulk Operation:**
```json
{
  "timestamp": "2025-11-18T10:32:00.000Z",
  "category": "bulk-op",
  "operation": "bulk_comment",
  "duration_ms": 3400,
  "error": false,
  "metadata": {
    "success": true,
    "item_count": 50,
    "bulk_action": "comment"
  }
}
```

---

## Export Formats

### Full Export (JSON)

Contains all events and aggregated statistics:

```bash
# Export manually
telemetryService.exportToFile();

# Result: telemetry/telemetry-2025-11-18T10-30-00.json
```

**File Structure:**
```json
{
  "exported_at": "2025-11-18T11:00:00.000Z",
  "config": {
    "enabled": true,
    "period_start": "2025-11-18T10:00:00.000Z"
  },
  "stats": {
    "total_events": 1234,
    "by_category": { "tool": 450, "api": 600, ... },
    "top_operations": [...],
    "error_rate": 2.5,
    "cache_hit_rate": 67.8,
    ...
  },
  "events": [...]
}
```

### Statistics Only Export

Contains only aggregated stats (no raw events):

```bash
telemetryService.exportStatsToFile();

# Result: telemetry/telemetry-stats-2025-11-18T11-00-00.json
```

### Streaming Export (JSONL)

Auto-exported in batches during operation:

```
telemetry/telemetry-stream-2025-11-18T10-30-00.jsonl
```

Each line is a separate JSON event (JSON Lines format).

---

## Analysis Tools

### Telemetry Analysis Script

Analyze exported telemetry data to identify:
- Performance bottlenecks
- API usage patterns
- Cache effectiveness
- Error hotspots
- Query handle efficiency

**Usage:**

```bash
# Analyze a telemetry file
ts-node scripts/analyze-telemetry.ts telemetry/telemetry-2025-11-18T10-30-00.json

# Export analysis results
ts-node scripts/analyze-telemetry.ts telemetry/telemetry-2025-11-18T10-30-00.json --export
```

**Output:**

```
=== TELEMETRY ANALYSIS REPORT ===

📊 SUMMARY
  Total Events: 1234
  Date Range: 2025-11-18T10:00:00.000Z to 2025-11-18T11:00:00.000Z
  Duration: 1.0 hours

⚡ PERFORMANCE
  Slowest Operations:
    query-wiql: 1250ms avg (p95: 2100ms, count: 45)
    analyze-bulk: 3400ms avg (p95: 5200ms, count: 12)
  API-Heavy Operations:
    execute-bulk-operations: 8.5 API calls avg (count: 20)

❌ ERRORS
  Total Errors: 15 (1.2%)
  By Type:
    ValidationError: 10
    NetworkError: 5

💾 CACHE
  Total Hits: 234
  Total Misses: 112
  Hit Rate: 67.6%

🌐 API USAGE
  Total Calls: 567
  Rate: 567 calls/hour

🔗 QUERY HANDLES
  Created: 45
  Read: 120
  Expired: 3
  Avg Items per Handle: 28

📦 BULK OPERATIONS
  Total Operations: 20
  Total Items Processed: 450
  Avg Items per Operation: 22

💡 RECOMMENDATIONS
  • Excellent cache hit rate (67.6%)!
  • No issues detected. Performance looks good!
```

---

## Programmatic API

### Record Events

```typescript
import { telemetryService } from './services/telemetry-service.js';

// Record tool execution
telemetryService.recordToolExecution(
  'query-wiql',
  1250,     // duration ms
  true,     // success
  2,        // api calls
  undefined // no error
);

// Record API call
telemetryService.recordAPICall(
  'POST',
  'wit/workitems',
  150,      // duration ms
  200,      // status
  false     // no error
);

// Record bulk operation
telemetryService.recordBulkOperation(
  'comment',
  50,       // item count
  3400,     // duration ms
  true      // success
);

// Record cache operation
telemetryService.recordCacheOperation('hit', 'workItem:12345');

// Record query handle operation
telemetryService.recordQueryHandleOperation(
  'create',
  'qh_abc123',
  45        // item count
);

// Record AI operation
telemetryService.recordAIOperation(
  'analyze-workload',
  5200,     // duration ms
  true,     // success
  'gpt-4',  // model
  2500      // tokens used (optional)
);
```

### Query Statistics

```typescript
// Get aggregated statistics
const stats = telemetryService.getStats();

// Get raw events
const events = telemetryService.getEvents();

// Get current config
const config = telemetryService.getConfig();

// Check if enabled
if (telemetryService.isEnabled()) {
  // ...
}
```

### Export Data

```typescript
// Export full telemetry
const filepath = await telemetryService.exportToFile();
// Returns: telemetry/telemetry-2025-11-18T10-30-00.json

// Export statistics only
const statsPath = await telemetryService.exportStatsToFile();
// Returns: telemetry/telemetry-stats-2025-11-18T11-00-00.json

// Clear events
telemetryService.clear();
```

---

## Integration Points

Telemetry is automatically integrated throughout the MCP server:

### Tool Service

Tracks tool execution with:
- Duration
- Success/failure
- API calls made during execution
- Cache usage
- Error details (type only, no messages)

### HTTP Client

Tracks all Azure DevOps API calls:
- Request method and endpoint
- Response time
- Status code
- Error status

### Cache Service

Tracks cache operations:
- Hits and misses
- Set operations
- Evictions
- Hit rate per operation

### Query Handle Service

Tracks handle lifecycle:
- Creation with item count
- Reads
- Expirations
- Cleanup operations

---

## Privacy Guarantees

### ❌ Never Collected

- Work item titles, descriptions, or content
- User names, emails, or personal information
- Passwords, tokens, or credentials
- IP addresses or network information
- System paths containing usernames
- Any PII or sensitive business data

### ✅ Collected

- Operation names (e.g., 'query-wiql', 'create-workitem')
- Duration and performance metrics
- API call counts and response codes
- Cache statistics (hit/miss rates)
- Error types (not messages)
- Aggregate item counts
- Timestamps (for time-series analysis)

---

## Use Cases

### Performance Optimization

Identify slow operations and optimize them:

```bash
# Find slowest operations
ts-node scripts/analyze-telemetry.ts telemetry/telemetry.json | grep "Slowest"

# Check API usage patterns
ts-node scripts/analyze-telemetry.ts telemetry/telemetry.json | grep "API-Heavy"
```

### Cache Tuning

Adjust cache configuration based on hit rates:

```typescript
const stats = telemetryService.getStats();
if (stats.cache_hit_rate < 50) {
  // Increase cache TTL or size
  cacheService.updateConfig({ maxSize: 2000 });
}
```

### Error Analysis

Identify recurring errors and fix them:

```bash
# Find error patterns
ts-node scripts/analyze-telemetry.ts telemetry/telemetry.json | grep -A 5 "ERRORS"
```

### Capacity Planning

Monitor API usage to avoid rate limits:

```typescript
const stats = telemetryService.getStats();
const callsPerMinute = stats.total_api_calls / (stats.duration_hours * 60);

if (callsPerMinute > 150) {
  console.warn('Approaching rate limit (200/min)');
}
```

---

## Troubleshooting

### Telemetry Not Recording

1. **Check if enabled:**
   ```typescript
   console.log(telemetryService.isEnabled()); // Should be true
   ```

2. **Enable explicitly:**
   ```typescript
   telemetryService.enable();
   ```

3. **Check config:**
   ```typescript
   console.log(telemetryService.getConfig());
   ```

### Export Failures

1. **Check export directory permissions:**
   ```bash
   ls -la telemetry/
   ```

2. **Verify disk space:**
   ```bash
   df -h
   ```

3. **Check write permissions:**
   ```typescript
   telemetryService.updateConfig({ exportDir: '/path/with/write/access' });
   ```

### High Memory Usage

1. **Reduce event buffer:**
   ```typescript
   telemetryService.updateConfig({ maxEventsInMemory: 5000 });
   ```

2. **Enable auto-export:**
   ```typescript
   telemetryService.updateConfig({
     autoExport: true,
     autoExportInterval: 300000 // 5 minutes
   });
   ```

3. **Clear events periodically:**
   ```typescript
   setInterval(() => {
     telemetryService.exportToFile();
     telemetryService.clear();
   }, 600000); // Every 10 minutes
   ```

---

## Best Practices

1. **Enable in Production** - Telemetry helps identify real-world issues
2. **Export Regularly** - Don't let events accumulate indefinitely
3. **Analyze Periodically** - Review telemetry weekly to catch trends
4. **Share Insights** - Use analysis to guide optimization efforts
5. **Respect Privacy** - Never add PII to telemetry events

---

## Changelog

### v1.0 (2025-11-18)

- Initial release
- Privacy-conscious design (opt-in, no PII)
- Tool execution tracking
- API call monitoring
- Cache statistics
- Query handle lifecycle tracking
- Bulk operation metrics
- AI operation tracking
- Automated analysis script
- JSON/JSONL export formats

---

## See Also

- [Performance Benchmarks](./PERFORMANCE_BENCHMARKS.md)
- [Caching Strategy](./request-caching-layer.md)
- [Rate Limiting](./rate-limiter-configuration.md)
- [Query Handle Pattern](./QUERY_HANDLE_OPERATIONS.md)
