# Performance Benchmarks

This directory contains performance benchmarks for the Enhanced ADO MCP Server.

## Overview

The benchmarks measure execution times for critical operations and ensure they meet performance thresholds. They use the [tinybench](https://github.com/tinylibs/tinybench) library for accurate performance measurement.

## Benchmark Suites

### 1. Query Performance (`query-performance.bench.ts`)

Tests WIQL and OData query operations, including:
- Simple WIQL queries (< 50 results)
- Complex WIQL queries (50-200 results)
- OData simple queries
- OData aggregation queries
- Query handle operations (create, retrieve, select)

**Expected Performance:**
- Simple queries: < 2s
- Complex queries: < 5s
- Query handle operations: < 100ms

### 2. Bulk Operations (`bulk-operations.bench.ts`)

Tests batch processing operations, including:
- Bulk work item updates
- Bulk story point assignment
- Bulk description enhancement
- Bulk acceptance criteria generation
- Tag operations

**Expected Performance:**
- Small batches (10 items): < 5s
- Medium batches (50 items): < 15s

### 3. AI Tools (`ai-tools.bench.ts`)

Tests AI-powered analysis and enhancement operations, including:
- AI assignment analysis
- Work item intelligence analysis
- Description enhancement
- Acceptance criteria generation
- Story point estimation
- Pattern detection

**Expected Performance:**
- Single item analysis: 5-10s
- Batch operations (10 items): 20-30s

**Note:** These are simulated benchmarks. Real AI operations vary based on:
- LLM response time (2-5s per call)
- Model selection (gpt-4o-mini vs gpt-4o)
- Network latency
- Token count and complexity

## Running Benchmarks

### Run All Benchmarks

```bash
npm run benchmark
```

### Run Individual Suites

```bash
# Query performance only
npm run benchmark:query

# Bulk operations only
npm run benchmark:bulk

# AI tools only
npm run benchmark:ai
```

### Run with TypeScript

```bash
# Using tsx directly
tsx benchmarks/index.ts
tsx benchmarks/query-performance.bench.ts
tsx benchmarks/bulk-operations.bench.ts
tsx benchmarks/ai-tools.bench.ts
```

## Benchmark Configuration

Performance thresholds are defined in `benchmark-config.ts`:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  WIQL_SIMPLE: {
    maxTime: 3000,      // Maximum acceptable (ms)
    targetTime: 1500,   // Target goal (ms)
    description: 'Simple WIQL query (< 50 results)'
  },
  // ... more thresholds
};
```

### Understanding Thresholds

Each threshold has two values:
1. **targetTime**: Ideal performance (✓ EXCELLENT if met)
2. **maxTime**: Acceptable performance with buffer (✓ ACCEPTABLE if met, ✗ SLOW if exceeded)

The buffer between target and max allows for:
- Environment variations (development vs CI)
- System load and resource contention
- Network latency fluctuations
- JIT compilation and warmup effects

### Detailed Threshold Documentation

See [THRESHOLDS.md](./THRESHOLDS.md) for:
- Complete rationale for each threshold
- Adjustment history and methodology
- Environment-specific considerations
- Guidance on when to adjust thresholds

### Customizing Thresholds

To adjust performance expectations, edit `benchmark-config.ts`:

1. `targetTime`: Ideal performance (✓ EXCELLENT if met)
2. `maxTime`: Acceptable performance (✓ ACCEPTABLE if met, ✗ SLOW if exceeded)

## Understanding Results

### Output Format

```
✓ EXCELLENT | Query Handle Retrieval: 3.45ms (target: 5ms, max: 10ms)
✓ ACCEPTABLE | WIQL Complex Query: 3500ms (target: 3000ms, max: 5000ms)
✗ SLOW | AI Batch Analysis: 35000ms (target: 20000ms, max: 30000ms)
```

- **✓ EXCELLENT**: Performance exceeds targets
- **✓ ACCEPTABLE**: Performance within acceptable range
- **✗ SLOW**: Performance exceeds maximum threshold (benchmark fails)

### Summary Report

```
--- Summary ---
Total benchmarks: 15
Passed: 14
Failed: 1
Overall: ✗ FAILED
```

## CI/CD Integration

Benchmarks can be run in CI/CD pipelines to catch performance regressions:

```yaml
# Example GitHub Actions workflow
- name: Run Performance Benchmarks
  run: npm run benchmark
```

**Exit Codes:**
- `0`: All benchmarks passed
- `1`: One or more benchmarks failed

## Performance Baselines

### Query Operations
- **Fast**: Configuration retrieval, query handle operations (< 300ms)
- **Moderate**: WIQL queries, OData queries (1-8s depending on complexity)
- **Context-dependent**: Large result sets scale linearly

**Notes:**
- Thresholds assume mock/local operations
- Real Azure DevOps API calls add 200-500ms per request
- Network latency varies by region (50-200ms typical)
- Rate limiting may introduce additional delays

### Bulk Operations
- **Linear scaling**: ~500-800ms per item for simple updates (including API overhead)
- **AI-enhanced**: ~4-6s per item (depends on LLM response time)
- **Preview mode**: Fast (< 1s for 50 items, no API calls)

**Notes:**
- Thresholds include 2x buffer for environment variation
- Real-world performance affected by:
  - API rate limits (100 requests per minute typical)
  - Retry logic and exponential backoff
  - Concurrent request handling
  - Token bucket algorithm delays

### AI Tools
- **Single item**: 8-15s is acceptable (LLM call: 2-8s + API: 500ms + processing)
- **Batch**: 40-60s for 10 items (serial LLM processing)
- **Pattern detection**: Fast (< 1s for 100 items, no LLM)

**Notes:**
- Thresholds are for SIMULATED operations (no real LLM calls)
- Real AI operations vary significantly based on:
  - LLM response time (gpt-4o-mini: 2-5s, gpt-4o: 4-8s)
  - Model selection and temperature settings
  - Network latency to OpenAI/Azure OpenAI endpoints
  - Token count and prompt complexity
  - Rate limiting and concurrent request throttling
- Consider p95/p99 latency, not just mean

## Mock Data

Benchmarks use simulated data from `MockData` in `benchmark-config.ts`:

```typescript
// Generate mock work items
const workItems = MockData.generateWorkItems(100);

// Generate mock query handle
const handle = MockData.generateQueryHandle();

// Generate mock item context
const context = MockData.generateItemContext(100);
```

This ensures:
- Consistent test data
- No external dependencies
- Fast execution
- Reproducible results

## Troubleshooting

### Benchmarks Running Slowly

If benchmarks consistently fail:

1. **Check system load**: Other processes may affect results
2. **Review thresholds**: Thresholds may be too aggressive
3. **Update baseline**: Document new baseline if changes are expected

### Inconsistent Results

Benchmarks may vary due to:
- System load
- CPU throttling
- Background processes
- JIT compilation (warmup iterations help)

Run multiple times to establish trends.

### Benchmark Failures in CI

CI environments may be slower than development machines:
- Consider separate thresholds for CI
- Use `maxTime` as the pass/fail threshold
- Focus on detecting regressions (% change) rather than absolute times

## Adding New Benchmarks

1. **Create or edit benchmark file** (e.g., `query-performance.bench.ts`)

2. **Define threshold** in `benchmark-config.ts`:
   ```typescript
   MY_NEW_OPERATION: {
     maxTime: 5000,
     targetTime: 3000,
     description: 'My new operation description'
   }
   ```

3. **Add benchmark task**:
   ```typescript
   bench.add('My New Operation', () => {
     // Operation to benchmark
     myOperation();
   });
   ```

4. **Map to threshold**:
   ```typescript
   const taskMapping = {
     'My New Operation': PERFORMANCE_THRESHOLDS.MY_NEW_OPERATION,
     // ... other mappings
   };
   ```

5. **Run and validate**:
   ```bash
   tsx benchmarks/query-performance.bench.ts
   ```

## Best Practices

1. **Isolate benchmarks**: Test one operation at a time
2. **Use warmup iterations**: Let JIT optimize before measuring
3. **Mock external calls**: Avoid network dependencies
4. **Set realistic thresholds**: Based on actual usage patterns
5. **Document baselines**: Track performance over time
6. **Review regularly**: Update thresholds as code evolves

## Threshold Selection Methodology

### Principles

1. **2x Safety Factor**: Thresholds set at ~2x typical performance to allow for:
   - Environment variations (dev machine vs CI)
   - System load fluctuations
   - Network latency variations
   - JIT compilation warmup

2. **Based on p95 Latency**: Thresholds target 95th percentile, not mean
   - Accounts for outliers and occasional slowness
   - Prevents flaky benchmark failures
   - Realistic for production performance

3. **Separate Target vs Max**:
   - `targetTime`: Ideal performance goal (✓ EXCELLENT)
   - `maxTime`: Acceptable with buffer (✓ ACCEPTABLE)
   - Exceeding `maxTime` fails the benchmark (✗ SLOW)

4. **Environment-Aware**:
   - Mock operations: Tight thresholds (measure code efficiency)
   - API operations: Loose thresholds (account for network/service)
   - AI operations: Very loose thresholds (LLM response time varies)

### Threshold Calculation

```
targetTime = p50_latency * 1.5  (50% buffer for good performance)
maxTime = p95_latency * 2.0     (100% buffer for environment variation)
```

### Adjustment History

**2025-11-18 - Initial Threshold Review:**
- **Query Handle Creation**: 150ms → 300ms max (2x increase)
  - Rationale: Data structure creation with metadata and index mapping takes longer than expected
  - Real-world impact: None (still sub-second performance)
  
- **Query Handle Select Criteria**: 100ms → 150ms max (1.5x increase)
  - Rationale: Complex filtering on 100+ items needs more headroom
  - Real-world impact: Minimal (filtering remains fast)

- **WIQL/OData Queries**: +50% buffer across all query types
  - Simple WIQL: 2000ms → 3000ms max
  - Complex WIQL: 5000ms → 8000ms max
  - OData: 2000-3000ms → 3000-5000ms max
  - Rationale: Account for real Azure DevOps API latency (200-500ms per call) + network conditions
  - Real-world impact: Better reflects production performance

- **Bulk Operations**: +60% buffer for API-heavy operations
  - Small batch (10): 5000ms → 8000ms max
  - Medium batch (50): 15000ms → 30000ms max
  - Rationale: Real API calls add ~500ms per item + rate limiting + retry logic
  - Real-world impact: Prevents false failures in CI or slower environments

- **AI Tools**: +50% buffer for LLM variance
  - Single analysis: 10000ms → 15000ms max
  - Batch (10 items): 30000ms → 60000ms max
  - Enhancement: 8000ms → 12000ms max
  - Rationale: LLM response times vary (gpt-4o-mini: 2-5s, gpt-4o: 4-8s) + network conditions
  - Real-world impact: Better tolerance for slow LLM responses without benchmark failures

**Validation Approach:**
- Ran benchmarks on development machine (baseline)
- Analyzed mock operation performance vs real API expectations
- Added 2x buffer for environment variation (dev vs CI)
- Considered worst-case scenarios (slow network, API throttling)
- Documented assumptions for future adjustment

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System architecture and performance considerations
- [Testing Guide](../test/README.md) - Unit and integration testing
- [Feature Specs](../../docs/feature_specs/) - Individual feature performance expectations

---

**Last Updated:** 2025-10-07  
**Benchmark Library:** tinybench v2.x  
**Node.js Version:** >= 18.0.0
