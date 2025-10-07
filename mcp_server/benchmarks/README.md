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
    maxTime: 2000,      // Maximum acceptable (ms)
    targetTime: 1000,   // Target goal (ms)
    description: 'Simple WIQL query (< 50 results)'
  },
  // ... more thresholds
};
```

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
- **Fast**: Configuration retrieval, query handle operations (< 100ms)
- **Moderate**: WIQL queries, OData queries (1-5s)
- **Context-dependent**: Large result sets scale linearly

### Bulk Operations
- **Linear scaling**: ~0.5s per item for simple updates
- **AI-enhanced**: ~2-5s per item (depends on LLM)
- **Preview mode**: Fast (< 1s for 50 items)

### AI Tools
- **Single item**: 5-10s (LLM call overhead)
- **Batch**: 2-5s per item (can be parallelized in future)
- **Pattern detection**: Fast (< 1s for 100 items, no LLM)

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

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System architecture and performance considerations
- [Testing Guide](../test/README.md) - Unit and integration testing
- [Feature Specs](../../docs/feature_specs/) - Individual feature performance expectations

---

**Last Updated:** 2025-10-07  
**Benchmark Library:** tinybench v2.x  
**Node.js Version:** >= 18.0.0
