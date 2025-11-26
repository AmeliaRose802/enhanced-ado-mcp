# Performance Benchmark Thresholds

This document provides detailed rationale for each performance threshold in the benchmark suite.

## Overview

Thresholds are set using the following formula:
- **Target Time**: `p50_latency * 1.5` - Ideal performance goal
- **Max Time**: `p95_latency * 2.0` - Maximum acceptable with environment buffer

## Query Operations

### WIQL Simple Query (< 50 results)
- **Target**: 1500ms
- **Max**: 3000ms
- **Rationale**: 
  - Mock operation: ~5-10ms
  - Real API overhead: +200-500ms per call
  - Network latency: +50-200ms
  - Query processing: +500-1000ms for ADO backend
  - 2x buffer for environment variation
- **Typical Real-World**: 1000-2000ms

### WIQL Complex Query (50-200 results)
- **Target**: 5000ms  
- **Max**: 8000ms
- **Rationale**:
  - Complex filtering (AND/OR conditions)
  - Larger result set to transfer
  - ADO backend processing time
  - Multiple field expansions
- **Typical Real-World**: 3000-6000ms

### OData Simple Query
- **Target**: 1500ms
- **Max**: 3000ms
- **Rationale**:
  - Analytics endpoint (separate from work item API)
  - Similar to WIQL but analytics-specific processing
  - May involve aggregation on backend
- **Typical Real-World**: 1000-2000ms

### OData Aggregation Query
- **Target**: 3000ms
- **Max**: 5000ms
- **Rationale**:
  - Group-by and aggregation operations
  - Computationally expensive on backend
  - Larger datasets to process
- **Typical Real-World**: 2000-4000ms

## Query Handle Operations

### Create Query Handle (100 items)
- **Target**: 150ms
- **Max**: 300ms
- **Rationale**:
  - In-memory data structure creation
  - Index mapping and metadata generation
  - Selection metadata calculation
  - No external calls (pure computation)
  - Adjusted from 150ms after observing 162ms in testing
- **Typical Real-World**: 100-200ms

### Retrieve by Query Handle
- **Target**: 5ms
- **Max**: 10ms
- **Rationale**:
  - Simple Map.get() operation
  - No computation required
  - Should be near-instant
- **Typical Real-World**: 1-5ms

### Select All Items from Handle
- **Target**: 5ms
- **Max**: 10ms
- **Rationale**:
  - Array copy operation
  - No filtering or computation
  - Should be near-instant
- **Typical Real-World**: 1-5ms

### Select Items by Criteria (100 items)
- **Target**: 75ms
- **Max**: 150ms
- **Rationale**:
  - Array filtering operations
  - Multiple criteria evaluation
  - Tag/state/title matching
  - Scales with item count
  - Adjusted from 100ms for complex criteria
- **Typical Real-World**: 50-120ms

## Bulk Operations

### Bulk Update - Small (10 items)
- **Target**: 5000ms
- **Max**: 8000ms
- **Rationale**:
  - 10 items * 500ms API overhead = 5000ms
  - Rate limiting may introduce delays
  - Retry logic and error handling
  - Validation and pre-processing
- **Typical Real-World**: 4000-7000ms

### Bulk Update - Medium (50 items)
- **Target**: 20000ms (20s)
- **Max**: 30000ms (30s)
- **Rationale**:
  - 50 items * 500ms API overhead = 25000ms
  - Rate limiting (100 req/min = 600ms per req)
  - Sequential processing (not parallelized)
  - Error handling and retry logic
- **Typical Real-World**: 15000-28000ms

### Bulk Assign Story Points - Small (10 items)
- **Target**: 5000ms
- **Max**: 8000ms
- **Rationale**:
  - Same as bulk update (API-heavy)
  - Includes estimation logic
  - Field validation
- **Typical Real-World**: 4000-7000ms

## AI-Powered Tools

**IMPORTANT**: These thresholds are for SIMULATED operations. Real LLM calls add significant latency.

### Single Work Item AI Analysis
- **Target**: 8000ms
- **Max**: 15000ms
- **Rationale**:
  - LLM call: 2-8s (gpt-4o-mini: 2-5s, gpt-4o: 4-8s)
  - API overhead: 500ms
  - Token counting and prompt formatting: 200-500ms
  - Response parsing: 100-300ms
  - Network latency: 100-500ms
  - 2x buffer for slow LLM responses
- **Typical Real-World**: 5000-12000ms

### AI Batch Analysis (10 items)
- **Target**: 40000ms (40s)
- **Max**: 60000ms (60s)
- **Rationale**:
  - Serial LLM processing (not parallelized yet)
  - 10 items * 5s per LLM call = 50s
  - Overhead per item: ~1s
  - May include rate limiting
- **Typical Real-World**: 30000-55000ms
- **Future**: Could be improved with parallel LLM calls

### Single Work Item Enhancement
- **Target**: 7000ms
- **Max**: 12000ms
- **Rationale**:
  - Description generation (longer text)
  - May require multiple LLM calls
  - Token generation cost increases with output length
- **Typical Real-World**: 6000-10000ms

## Validation Operations

### Fast Hierarchy Validation (100 items)
- **Target**: 500ms
- **Max**: 1000ms
- **Rationale**:
  - Parent-child type checking
  - State progression validation
  - In-memory operations (no API calls)
  - Scales linearly with item count
- **Typical Real-World**: 300-800ms

## Environment Considerations

### Development Machine
- Fast CPU, low latency network
- Thresholds should mostly pass with "EXCELLENT"
- Use as baseline for threshold adjustment

### CI/CD Environment
- Shared resources, variable network
- Expect 30-50% slower than development
- May see more "ACCEPTABLE" results
- Should not fail unless significant regression

### Production Monitoring
- Real Azure DevOps API
- Network latency varies by region
- Consider p95/p99 instead of mean
- Alert on trends, not individual slow calls

## When to Adjust Thresholds

### Increase Thresholds If:
1. Benchmarks fail consistently (>10% failure rate)
2. Real-world performance doesn't match expectations
3. New features add necessary overhead
4. Azure DevOps API becomes slower (service degradation)

### Decrease Thresholds If:
1. Code optimizations significantly improve performance
2. Azure DevOps API becomes faster (service improvement)
3. Thresholds are too lenient (>99% pass rate with excellent)
4. Want to detect smaller regressions

### Review Schedule:
- **Monthly**: Check benchmark trends
- **Quarterly**: Adjust thresholds based on real-world data
- **After Major Changes**: Re-baseline after significant refactoring
- **After Azure DevOps Updates**: Account for API performance changes

## Related Documentation

- [benchmark-config.ts](./benchmark-config.ts) - Threshold definitions
- [README.md](./README.md) - Benchmark overview and usage
- [Feature Specs](../../docs/feature_specs/PERFORMANCE_BENCHMARKS.md) - Performance requirements

---

**Last Updated**: 2025-11-18  
**Reviewed By**: Performance benchmark threshold review (Issue ADO-Work-Item-MSP-45)  
**Next Review**: 2025-12-18
