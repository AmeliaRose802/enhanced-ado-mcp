# Performance Benchmarks

**Status:** Implemented  
**Version:** 1.5.0  
**Category:** Testing & Quality Assurance

## Overview

Performance benchmarks measure execution times for critical operations in the Enhanced ADO MCP Server and ensure they meet defined performance thresholds. The benchmark suite uses [tinybench](https://github.com/tinylibs/tinybench) for accurate performance measurement and provides comprehensive reporting.

## Purpose

- **Prevent Performance Regressions**: Automatically detect when code changes negatively impact performance
- **Set Performance Expectations**: Define clear performance baselines for different operation types
- **Guide Optimization**: Identify slow operations that need improvement
- **Quality Assurance**: Ensure operations complete within acceptable timeframes

## Benchmark Suites

### 1. Query Performance Benchmarks

Tests WIQL and OData query operations:
- Simple WIQL queries (< 50 results)
- Complex WIQL queries (50-200 results)
- OData simple queries
- OData aggregation queries
- Query handle operations (create, retrieve, select)

**Location:** `mcp_server/benchmarks/query-performance.bench.ts`

### 2. Bulk Operations Benchmarks

Tests batch processing operations:
- Bulk work item updates
- Bulk story point assignment
- Bulk description enhancement
- Bulk acceptance criteria generation
- Tag operations (add/remove)

**Location:** `mcp_server/benchmarks/bulk-operations.bench.ts`

### 3. AI Tools Benchmarks

Tests AI-powered analysis and enhancement operations:
- AI assignment analysis
- Work item intelligence analysis
- Description enhancement
- Acceptance criteria generation
- Story point estimation
- Pattern detection

**Location:** `mcp_server/benchmarks/ai-tools.bench.ts`

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

### Run with TypeScript Directly

```bash
# Using tsx
tsx benchmarks/index.ts
tsx benchmarks/query-performance.bench.ts
tsx benchmarks/bulk-operations.bench.ts
tsx benchmarks/ai-tools.bench.ts
```

## Output Format

### Individual Benchmark Results

```
✓ EXCELLENT | Query Handle Retrieval: 3.45ms (target: 5ms, max: 10ms)
✓ ACCEPTABLE | Query Handle Creation (100 items): 106.81ms (target: 50ms, max: 150ms)
✗ SLOW | AI Batch Analysis: 35000ms (target: 20000ms, max: 30000ms)
```

**Status Indicators:**
- **✓ EXCELLENT**: Performance exceeds target goal
- **✓ ACCEPTABLE**: Performance within acceptable range (between target and max)
- **✗ SLOW**: Performance exceeds maximum threshold (benchmark fails)

### Suite Summary

```
--- Summary ---
Total benchmarks: 10
Passed: 10
Failed: 0
Overall: ✓ PASSED
```

### Overall Report

```
╔════════════════════════════════════════════════════════════════╗
║                    Benchmark Summary                           ║
╚════════════════════════════════════════════════════════════════╝

✓ PASSED | Query Performance
✓ PASSED | Bulk Operations
✓ PASSED | AI Tools

Total time: 98.36s
Suites run: 3
Passed: 3
Failed: 0

Overall Result: ✓ PASSED
```

## Performance Thresholds

Performance thresholds are defined in `benchmarks/benchmark-config.ts`:

### Query Operations

| Operation | Target | Max | Description |
|-----------|--------|-----|-------------|
| WIQL Simple | 1000ms | 2000ms | Simple WIQL query (< 50 results) |
| WIQL Complex | 3000ms | 5000ms | Complex WIQL query (50-200 results) |
| OData Simple | 1000ms | 2000ms | Simple OData analytics query |
| OData Aggregation | 2000ms | 3000ms | OData query with aggregations |
| Query Handle Create | 50ms | 150ms | Create query handle |
| Query Handle Retrieve | 5ms | 10ms | Retrieve by query handle |
| Query Handle Select All | 5ms | 10ms | Select all items from handle |
| Query Handle Select Criteria | 50ms | 100ms | Select items by criteria (100 items) |

### Bulk Operations

| Operation | Target | Max | Description |
|-----------|--------|-----|-------------|
| Bulk Update Small | 3000ms | 5000ms | Bulk update (10 items) |
| Bulk Update Medium | 10000ms | 15000ms | Bulk update (50 items) |
| Bulk Assign Small | 3000ms | 5000ms | Bulk assign story points (10 items) |

### AI-Powered Tools

| Operation | Target | Max | Description |
|-----------|--------|-----|-------------|
| AI Analysis Single | 5000ms | 10000ms | Single work item AI analysis |
| AI Batch Small | 20000ms | 30000ms | AI batch analysis (10 items) |
| AI Enhancement Single | 5000ms | 8000ms | Single work item enhancement |

**Note:** AI tool benchmarks use simulated operations. Real AI operations vary based on:
- LLM response time (typically 2-5s per call)
- Model selection (gpt-4o-mini vs gpt-4o)
- Network latency
- Token count and complexity

## Configuration

### Benchmark Options

```typescript
export const DEFAULT_BENCHMARK_OPTIONS: BenchmarkOptions = {
  iterations: 10,        // Number of iterations to run
  warmupIterations: 2,   // Warmup iterations before measuring
  time: 1000,           // Time to run benchmark in milliseconds
  verbose: true         // Whether to log results
};
```

### Customizing Thresholds

To adjust performance expectations, edit `benchmarks/benchmark-config.ts`:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  MY_OPERATION: {
    maxTime: 5000,      // Maximum acceptable (ms)
    targetTime: 3000,   // Target goal (ms)
    description: 'My operation description'
  }
};
```

## CI/CD Integration

Benchmarks can be integrated into CI/CD pipelines to catch performance regressions:

### GitHub Actions Example

```yaml
- name: Run Performance Benchmarks
  run: |
    cd mcp_server
    npm install
    npm run benchmark
```

**Exit Codes:**
- `0`: All benchmarks passed
- `1`: One or more benchmarks failed

### Using in PR Checks

Add benchmarks as a required check:

```yaml
name: Performance Benchmarks

on: [pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd mcp_server && npm install
      - run: cd mcp_server && npm run benchmark
```

## Mock Data

Benchmarks use simulated data from `MockData` utilities:

```typescript
// Generate mock work items
const workItems = MockData.generateWorkItems(100);

// Generate mock query handle
const handle = MockData.generateQueryHandle();

// Generate mock item context
const context = MockData.generateItemContext(100);
```

This ensures:
- **Consistent test data**: Same data across runs
- **No external dependencies**: No real Azure DevOps calls
- **Fast execution**: No network overhead
- **Reproducible results**: Consistent benchmarking

## Error Handling

### Benchmark Failures

If benchmarks fail:

1. **Review the output**: Check which specific benchmarks failed
2. **Check system load**: Other processes may affect results
3. **Review recent changes**: Identify potential performance regressions
4. **Consider threshold adjustments**: Thresholds may need updating

### Memory Issues

If benchmarks fail with memory errors:

1. **Reduce benchmark time**: Lower `time` in `DEFAULT_BENCHMARK_OPTIONS`
2. **Reduce iterations**: Lower `iterations` count
3. **Run individual suites**: Use `npm run benchmark:query` instead of `npm run benchmark`

## Best Practices

1. **Run regularly**: Include in CI/CD to catch regressions early
2. **Review trends**: Track performance over time, not just pass/fail
3. **Set realistic thresholds**: Based on actual usage patterns
4. **Document baselines**: Keep record of expected performance
5. **Isolate tests**: Ensure no interference from other processes
6. **Use warmup iterations**: Let JIT optimize before measuring

## Limitations

### Simulated Operations

Benchmarks use simulated operations, not real:
- Azure DevOps API calls
- LLM/AI model calls
- Network operations
- Authentication flows

**Real-world performance will vary** based on:
- Network latency
- Azure DevOps response times
- LLM response times
- System load

### Platform Differences

Performance varies by platform:
- CI/CD environments may be slower
- Different CPU/memory configurations
- Background processes

Consider **relative performance** (% change) rather than absolute times for cross-platform comparisons.

## Adding New Benchmarks

### 1. Define Threshold

In `benchmarks/benchmark-config.ts`:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  MY_NEW_OPERATION: {
    maxTime: 5000,
    targetTime: 3000,
    description: 'My new operation description'
  }
};
```

### 2. Add Benchmark Task

In appropriate benchmark file (e.g., `query-performance.bench.ts`):

```typescript
bench.add('My New Operation', () => {
  // Operation to benchmark
  myOperation();
});
```

### 3. Map to Threshold

```typescript
const taskMapping = {
  'My New Operation': PERFORMANCE_THRESHOLDS.MY_NEW_OPERATION,
  // ... other mappings
};
```

### 4. Run and Validate

```bash
tsx benchmarks/query-performance.bench.ts
```

## Related Documentation

- [Benchmarks README](../../mcp_server/benchmarks/README.md) - Detailed benchmark usage guide
- [Architecture](./ARCHITECTURE.md) - System architecture and performance considerations
- [Testing Guide](../../mcp_server/test/README.md) - Unit and integration testing

## Changelog

- **v1.5.0** (2025-10-07) - Initial implementation
  - Added query performance benchmarks
  - Added bulk operations benchmarks
  - Added AI tools benchmarks
  - Integrated tinybench library
  - Created comprehensive documentation

---

**Last Updated:** 2025-10-07  
**Benchmark Library:** tinybench v2.x  
**Node.js Version:** >= 18.0.0
