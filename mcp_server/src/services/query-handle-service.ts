import { QueryCache, type QueryHandleData, type WorkItemContextData, type ItemContext } from './query/query-cache.js';
import { QueryExecutor, type SelectionCriteria, type ItemSelector } from './query/query-executor.js';
import { QueryValidator } from './query/query-validator.js';

/**
 * Query Handle Service
 * 
 * Orchestrates query handle operations by delegating to specialized services:
 * - QueryCache: Handle storage and retrieval
 * - QueryExecutor: Item selection and execution
 * - QueryValidator: Query and parameter validation
 * 
 * Maintains the same public API for backward compatibility while providing
 * better separation of concerns and improved testability.
 * 
 * Key features:
 * - Generate unique handles for query results
 * - Store work item IDs with expiration (default 1 hour)
 * - Retrieve work item IDs by handle
 * - Automatic cleanup of expired handles
 */

class QueryHandleService {
  private cache: QueryCache;
  private executor: QueryExecutor;
  private validator: QueryValidator;

  constructor() {
    this.cache = new QueryCache();
    this.executor = new QueryExecutor(this.cache);
    this.validator = new QueryValidator();
  }

  /**
   * Store a query result with a handle
   * 
   * @param workItemIds Array of work item IDs from the query
   * @param query Original WIQL query
   * @param metadata Optional metadata about the query
   * @param ttlMs Time-to-live in milliseconds (default: 1 hour)
   * @param workItemContext Optional context data for each work item (staleness, titles, etc.)
   * @param analysisMetadata Optional metadata about analysis performed
   * @returns Query handle string
   */
  storeQuery(
    workItemIds: number[],
    query: string,
    metadata?: QueryHandleData['metadata'],
    ttlMs: number = 60 * 60 * 1000,
    workItemContext?: QueryHandleData['workItemContext'],
    analysisMetadata?: QueryHandleData['analysisMetadata']
  ): string {
    const handle = this.cache.generateHandle();
    this.cache.storeQuery(handle, workItemIds, query, metadata, ttlMs, workItemContext, analysisMetadata);
    return handle;
  }

  /**
   * Retrieve work item IDs by query handle
   * 
   * @param handle Query handle string
   * @returns Array of work item IDs, or null if handle not found/expired
   */
  getWorkItemIds(handle: string): number[] | null {
    return this.cache.getWorkItemIds(handle);
  }

  /**
   * Get full query handle data (including metadata)
   * 
   * @param handle Query handle string
   * @returns Query handle data or null if not found/expired
   */
  getQueryData(handle: string): QueryHandleData | null {
    return this.cache.getQueryData(handle);
  }

  /**
   * Get work item context data for a specific work item from a handle
   * 
   * @param handle Query handle string
   * @param workItemId Work item ID to get context for
   * @returns Work item context or null if not found
   */
  getWorkItemContext(handle: string, workItemId: number): WorkItemContextData | null {
    return this.cache.getWorkItemContext(handle, workItemId);
  }

  /**
   * Get analysis metadata for a query handle
   * 
   * @param handle Query handle string
   * @returns Analysis metadata or null if not found
   */
  getAnalysisMetadata(handle: string): QueryHandleData['analysisMetadata'] | null {
    return this.cache.getAnalysisMetadata(handle);
  }

  /**
   * Selects work items from a query handle using zero-based indices.
   * 
   * This method allows efficient selection of specific work items by their position
   * in the query results. Only valid indices (within range) are processed; invalid
   * indices are silently filtered out.
   * 
   * @param handle - The query handle ID (format: 'qh_' followed by hex string)
   * @param indices - Array of zero-based indices to select from the query results.
   *                  Indices must be >= 0 and < total items in handle.
   * @returns Array of work item IDs for the specified indices, or null if handle not found/expired
   * @throws {Error} Never throws - invalid indices are silently filtered out
   * @example
   * ```typescript
   * // Select first, third, and sixth items from query results
   * const items = queryHandleService.getItemsByIndices('qh_abc123', [0, 2, 5]);
   * // Returns: [12345, 12347, 12350] (actual work item IDs)
   * ```
   * @example
   * ```typescript
   * // Invalid indices are filtered out automatically
   * const items = queryHandleService.getItemsByIndices('qh_abc123', [0, 999]);
   * // Returns only valid IDs: [12345]
   * ```
   * @since 1.4.0
   */
  getItemsByIndices(handle: string, indices: number[]): number[] | null {
    return this.executor.getItemsByIndices(handle, indices);
  }

  /**
   * Selects work items from a query handle using criteria-based filtering.
   * 
   * Filters work items based on state, title keywords, tags, or inactivity period.
   * All criteria are combined using AND logic - items must match ALL provided criteria.
   * String matching is case-insensitive. If a work item lacks a field (e.g., daysInactive),
   * it will not match criteria requiring that field.
   * 
   * @param handle - The query handle ID (format: 'qh_' followed by hex string)
   * @param criteria - Selection criteria object with the following optional properties:
   *   - states: Array of state names to match (e.g., ['Active', 'New'])
   *   - titleContains: Array of keywords - item title must contain at least one (OR logic)
   *   - tags: Array of tag patterns - item must have at least one matching tag (OR logic)
   *   - daysInactiveMin: Minimum days of inactivity (inclusive) - requires staleness analysis
   *   - daysInactiveMax: Maximum days of inactivity (inclusive) - requires staleness analysis
   * @returns Array of work item IDs matching all criteria, or null if handle not found/expired.
   *          Returns empty array if no items match criteria.
   * @throws {Error} Never throws - invalid criteria are safely handled
   * @example
   * ```typescript
   * // Select all Active items
   * const items = queryHandleService.getItemsByCriteria('qh_abc123', {
   *   states: ['Active']
   * });
   * ```
   * @example
   * ```typescript
   * // Select items with 'bug' or 'fix' in title AND tagged critical/security
   * const items = queryHandleService.getItemsByCriteria('qh_abc123', {
   *   titleContains: ['bug', 'fix'],
   *   tags: ['critical', 'security']
   * });
   * ```
   * @example
   * ```typescript
   * // Select stale Active items (inactive 7+ days)
   * const items = queryHandleService.getItemsByCriteria('qh_abc123', {
   *   states: ['Active'],
   *   daysInactiveMin: 7
   * });
   * ```
   * @example
   * ```typescript
   * // Select items inactive between 3-14 days
   * const items = queryHandleService.getItemsByCriteria('qh_abc123', {
   *   daysInactiveMin: 3,
   *   daysInactiveMax: 14
   * });
   * ```
   * @since 1.4.0
   */
  getItemsByCriteria(handle: string, criteria: SelectionCriteria): number[] | null {
    return this.executor.getItemsByCriteria(handle, criteria);
  }

  /**
   * Get selectable indices for a query handle
   * 
   * @param handle Query handle string
   * @returns Array of selectable indices, or null if handle not found
   */
  getSelectableIndices(handle: string): number[] | null {
    return this.executor.getSelectableIndices(handle);
  }

  /**
   * Retrieves detailed context for a work item at a specific index position.
   * 
   * Returns an ItemContext object containing essential metadata about the work item,
   * including its position in the query results, ID, title, state, type, and optional
   * staleness information. This is useful for understanding item details without
   * fetching the full work item from Azure DevOps.
   * 
   * @param handle - The query handle ID (format: 'qh_' followed by hex string)
   * @param index - Zero-based index of the item in the query results (must be >= 0 and < total items)
   * @returns ItemContext object with the following properties:
   *   - index: number - Zero-based position in query results
   *   - id: number - Azure DevOps work item ID
   *   - title: string - Work item title
   *   - state: string - Current state (e.g., 'Active', 'Closed')
   *   - type: string - Work item type (e.g., 'Bug', 'Task', 'User Story')
   *   - daysInactive?: number - Days since last substantive change (if staleness analysis performed)
   *   - lastChange?: string - ISO date of last change
   *   - tags?: string[] - Array of tags associated with the work item
   * 
   *   Returns null if:
   *   - Handle not found or expired
   *   - Index is out of range (< 0 or >= total items)
   * @throws {Error} Never throws - invalid indices return null
   * @example
   * ```typescript
   * // Get context for the first item in query results
   * const context = queryHandleService.getItemContext('qh_abc123', 0);
   * // Returns: { index: 0, id: 12345, title: 'Fix login bug', state: 'Active', 
   * //            type: 'Bug', daysInactive: 5, tags: ['critical', 'security'] }
   * ```
   * @example
   * ```typescript
   * // Check if item is stale before taking action
   * const context = queryHandleService.getItemContext('qh_abc123', 2);
   * if (context && context.daysInactive && context.daysInactive > 30) {
   *   console.log(`Item ${context.id} has been inactive for ${context.daysInactive} days`);
   * }
   * ```
   * @since 1.4.0
   */
  getItemContext(handle: string, index: number): ItemContext | null {
    return this.executor.getItemContext(handle, index);
  }

  /**
   * Resolves an ItemSelector to work item IDs, supporting multiple selection patterns.
   * 
   * This is the primary method for selecting work items from a query handle. It accepts
   * three selector types and delegates to the appropriate specialized method:
   * - String 'all': Returns all work items in the handle
   * - Array of numbers: Treats as indices and calls getItemsByIndices()
   * - Object: Treats as criteria and calls getItemsByCriteria()
   * 
   * @param handle - The query handle ID (format: 'qh_' followed by hex string)
   * @param selector - One of three selection patterns:
   *   1. 'all': Select all work items in the query handle
   *   2. number[]: Array of zero-based indices (e.g., [0, 2, 5])
   *   3. SelectionCriteria: Object with states, titleContains, tags, or daysInactive filters
   * @returns Array of work item IDs matching the selector, or null if:
   *   - Handle not found or expired
   *   - Selector type is invalid (not string, array, or object)
   *   - Selector is null or undefined
   * @throws {Error} Never throws - all error conditions return null
   * @example
   * ```typescript
   * // Select all items
   * const allItems = queryHandleService.resolveItemSelector('qh_abc123', 'all');
   * // Returns: [12345, 12346, 12347, ...]
   * ```
   * @example
   * ```typescript
   * // Select by index position
   * const selectedItems = queryHandleService.resolveItemSelector('qh_abc123', [0, 2, 5]);
   * // Returns: [12345, 12347, 12350]
   * ```
   * @example
   * ```typescript
   * // Select by criteria
   * const filteredItems = queryHandleService.resolveItemSelector('qh_abc123', {
   *   states: ['Active', 'In Progress'],
   *   daysInactiveMin: 7
   * });
   * // Returns: [12346, 12349] (IDs of stale active items)
   * ```
   * @example
   * ```typescript
   * // Invalid selector returns null
   * const invalid = queryHandleService.resolveItemSelector('qh_abc123', 123);
   * // Returns: null
   * ```
   * @since 1.4.0
   */
  resolveItemSelector(handle: string, selector: ItemSelector): number[] | null {
    return this.executor.resolveItemSelector(handle, selector);
  }

  /**
   * Delete a query handle manually
   * 
   * @param handle Query handle string
   * @returns true if deleted, false if not found
   */
  deleteHandle(handle: string): boolean {
    return this.cache.deleteHandle(handle);
  }

  /**
   * Get statistics about stored handles
   */
  getStats(): {
    totalHandles: number;
    activeHandles: number;
    expiredHandles: number;
  } {
    return this.cache.getStats();
  }

  /**
   * Get all handles with their details
   * 
   * @param includeExpired Whether to include expired handles (default: false)
   * @param top Maximum number of handles to return (default: 50)
   * @param skip Number of handles to skip for pagination (default: 0)
   * @returns Object containing paginated handles and metadata
   */
  getAllHandles(includeExpired: boolean = false, top: number = 50, skip: number = 0): {
    handles: Array<{
      id: string;
      created_at: string;
      expires_at: string;
      item_count: number;
      has_context: boolean;
    }>;
    pagination: {
      total: number;
      skip: number;
      top: number;
      returned: number;
      hasMore: boolean;
      nextSkip?: number;
    };
  } {
    return this.cache.getAllHandles(includeExpired, top, skip);
  }

  /**
   * Clean up expired handles
   */
  cleanup(): number {
    return this.cache.cleanup();
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanup(): void {
    this.cache.stopCleanup();
  }

  /**
   * Clear all handles (useful for testing)
   */
  clearAll(): void {
    this.cache.clearAll();
  }
}

// Export singleton instance
export const queryHandleService = new QueryHandleService();
export { QueryHandleData, SelectionCriteria, ItemContext, WorkItemContextData };
