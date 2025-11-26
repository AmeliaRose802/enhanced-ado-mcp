# Bulk Operations Performance Optimization Plan

## Issue: ADO-Work-Item-MSP-38
**Goal:** Reduce API calls in bulk operations by 30-50%

## Current State Analysis

### Identified Problems

1. **Tag Operations Fetch Individual Items** (`bulk-add-tag`, `bulk-remove-tag`)
   - Currently: N GET calls to fetch each item's tags
   - Each tag operation: `N (fetch) + N (update) = 2N API calls`
   - Impact: HIGH (100% overhead)

2. **Link Validation Fetches Individual Items** (`bulk-link`)
   - Currently: N GET calls to check existing links (when `skipExisting=true`)
   - Could batch fetch all work items with relations in 1-2 calls
   - Impact: MEDIUM-HIGH (up to N unnecessary calls)

3. **Pre-fetch Inefficiency**
   - Several operations fetch work items individually before operating
   - Azure DevOps supports fetching up to 200 work items in one call via `GET wit/workitems?ids=1,2,3...`
   - Impact: MEDIUM

4. **No Caching Within Operation**
   - Work item data is fetched multiple times within same operation
   - Example: `bulk-assign` fetches items, then updates, then fetches again for undo tracking
   - Impact: LOW-MEDIUM

## Optimization Strategy

### Phase 1: Tag Operations (HIGHEST IMPACT) ✅
- **Change:** Batch fetch all work items with tags in 1-2 API calls
- **Before:** 2N calls (N fetch + N update)
- **After:** 1 + N calls (1 batch fetch + N update)
- **Reduction:** 50% for small batches, more for larger ones
- **Files to modify:**
  - `unified-bulk-operations.handler.ts` - `executeAddTagAction`, `executeRemoveTagAction`

### Phase 2: Link Validation Batching (HIGH IMPACT) ✅
- **Change:** Batch fetch work items with relations
- **Before:** N calls to check existing links + N calls to create links = 2N
- **After:** ceil(N/200) batch fetches + N create calls
- **Reduction:** Up to 50% for link operations with skipExisting=true
- **Files to modify:**
  - `bulk-link-handler.ts` - `checkExistingLink` function

### Phase 3: Pre-fetch Batching (MEDIUM IMPACT) ✅
- **Change:** Use batch GET for all pre-fetch operations
- **Already partially implemented** via `processBatch` utility
- **Verify and optimize batch sizes**
- **Files:** All bulk operation handlers

### Phase 4: Operation-scoped Caching (LOW-MEDIUM IMPACT)
- **Change:** Cache work item data within operation execution
- **Benefit:** Eliminate redundant fetches for undo tracking
- **Implementation:** Add in-memory cache to operation context
- **Impact:** 10-20% reduction in specific scenarios

## Implementation Order

1. ✅ **Create benchmark** to measure current API calls
2. **Optimize tag operations** (executeAddTagAction, executeRemoveTagAction)
3. **Optimize link validation** (bulk-link-handler.ts)
4. **Add metrics/logging** to track API call count
5. **Run tests** to ensure functionality preserved
6. **Measure improvement** against benchmark
7. **Document** performance gains

## Expected Results

| Operation | Items | Current Calls | Optimized Calls | Reduction |
|-----------|-------|---------------|-----------------|-----------|
| bulk-add-tag | 50 | 100 | 51 | 49% |
| bulk-add-tag | 200 | 400 | 201 | 50% |
| bulk-link (skipExisting) | 50 | 100 | 51 | 49% |
| bulk-link (skipExisting) | 200 | 400 | 202 | 49.5% |
| bulk-update | 50 | 51 | 51 | 0% (already optimized) |
| bulk-assign | 50 | 51 | 51 | 0% (already optimized) |

**Overall Average Reduction: 30-40% across all bulk operations**

## Testing Strategy

1. Run existing unit tests to ensure no regressions
2. Add performance benchmarks
3. Test with different batch sizes (10, 50, 100, 200 items)
4. Verify rate limiting still works correctly
5. Test with real ADO instance (integration tests)

## Risk Assessment

- **Low Risk:** Tag operations and link validation are isolated changes
- **Medium Risk:** Caching could introduce stale data issues if not scoped correctly
- **Mitigation:** Thorough testing, cache only within single operation execution

## Metrics to Track

- Total API calls per operation type
- Average response time
- Rate limit hits (should not increase)
- Error rate (should not change)
- Memory usage (cache should be minimal)
