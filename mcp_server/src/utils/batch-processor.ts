/**
 * Batch processor for concurrent operations with controlled concurrency
 * 
 * Provides utilities for processing large arrays of items with configurable
 * parallel execution, error handling, and progress tracking.
 * 
 * PERFORMANCE NOTE: Uses Promise.allSettled() for true parallel execution within
 * each concurrency batch, maximizing throughput compared to sequential processing.
 */

export interface BatchProcessorOptions {
  /**
   * Maximum number of concurrent operations (default: 5)
   * Higher values = faster but more API load
   */
  concurrency?: number;
  
  /**
   * Whether to stop processing on first error (default: false)
   * If false, all items are processed and errors collected
   */
  stopOnError?: boolean;
  
  /**
   * Optional progress callback
   */
  onProgress?: (completed: number, total: number, succeeded: number, failed: number) => void;
}

export interface BatchResult<T, R = unknown> {
  /**
   * Successfully processed items
   */
  succeeded: Array<{ item: T; result: R }>;
  
  /**
   * Failed items with error messages
   */
  failed: Array<{ item: T; error: string }>;
  
  /**
   * Total items processed
   */
  total: number;
  
  /**
   * Success count
   */
  successCount: number;
  
  /**
   * Failure count
   */
  failureCount: number;
}

/**
 * Process an array of items with controlled concurrency
 * 
 * @param items Items to process
 * @param processor Async function to process each item
 * @param options Processing options
 * @returns Batch processing results
 * 
 * @example
 * ```typescript
 * const results = await processBatch(
 *   workItemIds,
 *   async (id) => httpClient.patch(`wit/workItems/${id}`, updates),
 *   { concurrency: 5 }
 * );
 * ```
 */
export async function processBatch<T, R = unknown>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchProcessorOptions = {}
): Promise<BatchResult<T, R>> {
  const {
    concurrency = 5,
    stopOnError = false,
    onProgress
  } = options;
  
  const succeeded: Array<{ item: T; result: R }> = [];
  const failed: Array<{ item: T; error: string }> = [];
  let completed = 0;
  
  // OPTIMIZATION 3: Process items in parallel batches for maximum throughput
  // Uses Promise.allSettled() to ensure all operations in a batch run concurrently
  // This provides true parallelism within the concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    
    // Process batch items in parallel
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const result = await processor(item);
          return { success: true, item, result };
        } catch (error) {
          return {
            success: false,
            item,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );
    
    // Collect results
    for (const result of results) {
      completed++;
      
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          succeeded.push({
            item: result.value.item,
            result: result.value.result as R
          });
        } else {
          failed.push({
            item: result.value.item,
            error: result.value.error as string
          });
          
          // Stop on error if requested
          if (stopOnError) {
            // Report progress before stopping
            if (onProgress) {
              onProgress(completed, items.length, succeeded.length, failed.length);
            }
            
            return {
              succeeded,
              failed,
              total: items.length,
              successCount: succeeded.length,
              failureCount: failed.length
            };
          }
        }
      } else {
        // Promise itself rejected (shouldn't happen with try-catch)
        failed.push({
          item: batch[results.indexOf(result)],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
        
        if (stopOnError) {
          if (onProgress) {
            onProgress(completed, items.length, succeeded.length, failed.length);
          }
          
          return {
            succeeded,
            failed,
            total: items.length,
            successCount: succeeded.length,
            failureCount: failed.length
          };
        }
      }
    }
    
    // Report progress
    if (onProgress) {
      onProgress(completed, items.length, succeeded.length, failed.length);
    }
  }
  
  return {
    succeeded,
    failed,
    total: items.length,
    successCount: succeeded.length,
    failureCount: failed.length
  };
}

/**
 * Process an array of items in chunks with a batch operation
 * 
 * Useful when the API supports batch operations (e.g., updating multiple items in one request)
 * 
 * @param items Items to process
 * @param chunkSize Size of each chunk
 * @param processor Async function to process each chunk
 * @returns Batch processing results
 * 
 * @example
 * ```typescript
 * const results = await processInChunks(
 *   workItemIds,
 *   50,
 *   async (ids) => httpClient.post('wit/workitems/batch', { ids })
 * );
 * ```
 */
export async function processInChunks<T, R = unknown>(
  items: T[],
  chunkSize: number,
  processor: (chunk: T[]) => Promise<R>,
  options: BatchProcessorOptions = {}
): Promise<BatchResult<T[], R>> {
  const chunks: T[][] = [];
  
  // Split into chunks
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  
  // Process chunks with concurrency control
  return processBatch(chunks, processor, options);
}
