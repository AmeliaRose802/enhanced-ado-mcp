import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Query Handle Service
 * 
 * Manages query handles for WIQL queries to enable safe bulk operations
 * without risk of ID hallucination. Query handles store the actual work item IDs
 * returned from Azure DevOps, which can then be used for bulk operations.
 * 
 * Key features:
 * - Generate unique handles for query results
 * - Store work item IDs with configurable expiration (default 24 hours, max 48 hours)
 * - Retrieve work item IDs by handle
 * - Automatic cleanup of expired handles
 * - Expiration warnings when handle is close to expiring
 */

/**
 * Work item context data with extensible fields
 */
interface WorkItemContextData {
  title?: string;
  state?: string;
  type?: string;
  lastSubstantiveChangeDate?: string;
  daysInactive?: number;
  createdDate?: string;
  changedDate?: string;
  assignedTo?: string;
  areaPath?: string;
  tags?: string | string[];
  [key: string]: unknown; // For additional fields - using unknown for type safety
}

interface QueryHandleData {
  workItemIds: number[];
  query: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: {
    project?: string;
    team?: string;
    queryType?: string;
  };
  // Enhanced storage for work item context data
  workItemContext?: Map<number, WorkItemContextData>;
  // NEW: Rich item context for selection
  itemContext: ItemContext[];
  // NEW: Selection metadata
  selectionMetadata: {
    totalItems: number;
    selectableIndices: number[];
    criteriaTags: string[];  // Available for criteria-based selection
  };
  analysisMetadata?: {
    includeSubstantiveChange?: boolean;
    stalenessThresholdDays?: number;
    analysisTimestamp?: string;
    successCount?: number;
    failureCount?: number;
  };
}

// Selection criteria interface
interface SelectionCriteria {
  states?: string[];
  titleContains?: string[];
  tags?: string[];
  daysInactiveMin?: number;
  daysInactiveMax?: number;
}

// Item context interface
interface ItemContext {
  index: number;
  id: number;
  title: string;
  state: string;
  type: string;
  daysInactive?: number;
  lastChange?: string;
  tags?: string[];
}

// Item selection types
type ItemSelector = 
  | 'all'
  | number[]  // Array of indices
  | SelectionCriteria;

// Operation history tracking for undo functionality
interface OperationHistoryItem {
  operation: string;  // e.g., 'bulk-comment', 'bulk-update', 'bulk-assign'
  timestamp: string;
  itemsAffected: Array<{
    workItemId: number;
    changes: Record<string, any>;  // Stores previous values for rollback
  }>;
}

interface OperationHistory {
  queryHandle: string;
  operations: OperationHistoryItem[];
}

class QueryHandleService {
  private handles: Map<string, QueryHandleData> = new Map();
  private operationHistories: Map<string, OperationHistory> = new Map();
  private defaultTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (configurable)
  private maxTTL = 48 * 60 * 60 * 1000; // 48 hours maximum
  private warningThreshold = 30 * 60 * 1000; // Warn when 30 minutes remain
  private cleanupInterval: NodeJS.Timeout | null = null;
  private serverStartTime: Date = new Date();

  constructor() {
    // Start automatic cleanup every 10 minutes
    this.startCleanup();
    logger.info(`Query Handle Service initialized at ${this.serverStartTime.toISOString()}`);
    logger.info(`Query handle expiration: ${this.defaultTTL / 60000} minutes (max: ${this.maxTTL / 60000} minutes)`);
  }

  /**
   * Get the default TTL value
   */
  getDefaultTTL(): number {
    return this.defaultTTL;
  }

  /**
   * Generate a unique query handle
   */
  private generateHandle(): string {
    return `qh_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Store a query result with a handle
   * 
   * @param workItemIds Array of work item IDs from the query
   * @param query Original WIQL query
   * @param metadata Optional metadata about the query
   * @param ttlMs Time-to-live in milliseconds (default: 24 hours)
   * @param workItemContext Optional context data for each work item (staleness, titles, etc.)
   * @param analysisMetadata Optional metadata about analysis performed
   * @returns Query handle string
   */
  storeQuery(
    workItemIds: number[],
    query: string,
    metadata?: QueryHandleData['metadata'],
    ttlMs: number = this.defaultTTL,
    workItemContext?: QueryHandleData['workItemContext'],
    analysisMetadata?: QueryHandleData['analysisMetadata']
  ): string {
    const handle = this.generateHandle();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Build itemContext array from workItemContext Map
    const itemContext = workItemIds.map((id, index) => {
      const context = workItemContext?.get(id);
      return {
        index,
        id,
        title: context?.title || `Work Item ${id}`,
        state: context?.state || 'Unknown',
        type: context?.type || 'Unknown',
        daysInactive: context?.daysInactive,
        lastChange: context?.lastSubstantiveChangeDate || context?.changedDate,
        tags: context?.tags 
          ? (Array.isArray(context.tags) 
              ? context.tags 
              : context.tags.split(';').map((t: string) => t.trim()).filter((t: string) => t))
          : undefined
      };
    });

    // Build selection metadata
    const selectionMetadata = {
      totalItems: workItemIds.length,
      selectableIndices: workItemIds.map((_, index) => index),
      criteriaTags: [...new Set(itemContext.flatMap(item => item.tags || []))]
    };

    this.handles.set(handle, {
      workItemIds,
      query,
      createdAt: now,
      expiresAt,
      metadata,
      workItemContext,
      itemContext,
      selectionMetadata,
      analysisMetadata
    });

    return handle;
  }

  /**
   * Retrieve work item IDs by query handle
   * 
   * @param handle Query handle string
   * @returns Array of work item IDs, or null if handle not found/expired
   */
  getWorkItemIds(handle: string): number[] | null {
    const data = this.handles.get(handle);
    
    if (!data) {
      logger.warn(`Query handle '${handle}' not found. Server started at ${this.serverStartTime.toISOString()}. ` +
                  `Currently tracking ${this.handles.size} active handles. ` +
                  `Note: Handles are lost if MCP server restarts.`);
      return null;
    }

    // Check if expired
    const now = new Date();
    if (now > data.expiresAt) {
      const ageMinutes = Math.floor((now.getTime() - data.createdAt.getTime()) / (1000 * 60));
      logger.warn(`Query handle '${handle}' expired. Created at ${data.createdAt.toISOString()}, ` +
                  `expired at ${data.expiresAt.toISOString()}, age: ${ageMinutes} minutes`);
      this.handles.delete(handle);
      return null;
    }

    // Warn if expiring soon
    const timeUntilExpiry = data.expiresAt.getTime() - now.getTime();
    if (timeUntilExpiry < this.warningThreshold) {
      const minutesRemaining = Math.floor(timeUntilExpiry / (1000 * 60));
      logger.warn(`Query handle '${handle}' will expire in ${minutesRemaining} minute(s). Consider refreshing if needed for longer workflows.`);
    }

    return data.workItemIds;
  }

  /**
   * Get full query handle data (including metadata)
   * 
   * @param handle Query handle string
   * @returns Query handle data or null if not found/expired
   */
  getQueryData(handle: string): QueryHandleData | null {
    const data = this.handles.get(handle);
    
    if (!data) {
      return null;
    }

    // Check if expired
    if (new Date() > data.expiresAt) {
      this.handles.delete(handle);
      return null;
    }

    return data;
  }

  /**
   * Get work item context data for a specific work item from a handle
   * 
   * @param handle Query handle string
   * @param workItemId Work item ID to get context for
   * @returns Work item context or null if not found
   */
  getWorkItemContext(handle: string, workItemId: number): WorkItemContextData | null {
    const data = this.getQueryData(handle);
    if (!data?.workItemContext) {
      return null;
    }
    return data.workItemContext.get(workItemId) || null;
  }

  /**
   * Refresh/extend the expiration of a query handle
   * Useful for long-running workflows that need to keep the handle active
   * 
   * @param handle Query handle to refresh
   * @param extensionMinutes Minutes to extend (default: 30, max: 120)
   * @returns True if refreshed, false if handle not found or already expired
   */
  refreshHandle(handle: string, extensionMinutes: number = 30): boolean {
    const data = this.handles.get(handle);
    
    if (!data) {
      logger.warn(`Cannot refresh query handle '${handle}' - not found`);
      return false;
    }

    const now = new Date();
    if (now > data.expiresAt) {
      logger.warn(`Cannot refresh query handle '${handle}' - already expired`);
      this.handles.delete(handle);
      return false;
    }

    // Calculate new expiration (max 2 hours from now)
    const extensionMs = Math.min(extensionMinutes * 60 * 1000, this.maxTTL);
    const newExpiry = new Date(now.getTime() + extensionMs);
    
    data.expiresAt = newExpiry;
    logger.info(`Query handle '${handle}' refreshed. New expiration: ${newExpiry.toISOString()}`);
    
    return true;
  }

  /**
   * Get analysis metadata for a query handle
   * 
   * @param handle Query handle string
   * @returns Analysis metadata or null if not found
   */
  getAnalysisMetadata(handle: string): QueryHandleData['analysisMetadata'] | null {
    const data = this.getQueryData(handle);
    return data?.analysisMetadata || null;
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
    const data = this.getQueryData(handle);
    if (!data) return null;

    const validIndices = indices.filter(index => 
      index >= 0 && index < data.workItemIds.length
    );

    return validIndices.map(index => data.workItemIds[index]);
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
    const data = this.getQueryData(handle);
    if (!data) return null;

    const matchingItems = data.itemContext.filter(item => {
      // State filter
      if (criteria.states && !criteria.states.includes(item.state)) {
        return false;
      }

      // Title contains filter
      if (criteria.titleContains) {
        const titleLower = item.title.toLowerCase();
        const hasMatch = criteria.titleContains.some(term => 
          titleLower.includes(term.toLowerCase())
        );
        if (!hasMatch) return false;
      }

      // Tags filter
      if (criteria.tags && item.tags) {
        const hasMatch = criteria.tags.some(tag => 
          item.tags!.some(itemTag => itemTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      // Days inactive range filter
      if (item.daysInactive !== undefined) {
        if (criteria.daysInactiveMin !== undefined && item.daysInactive < criteria.daysInactiveMin) {
          return false;
        }
        if (criteria.daysInactiveMax !== undefined && item.daysInactive > criteria.daysInactiveMax) {
          return false;
        }
      }

      return true;
    });

    return matchingItems.map(item => item.id);
  }

  /**
   * Get selectable indices for a query handle
   * 
   * @param handle Query handle string
   * @returns Array of selectable indices, or null if handle not found
   */
  getSelectableIndices(handle: string): number[] | null {
    const data = this.getQueryData(handle);
    return data?.selectionMetadata.selectableIndices || null;
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
    const data = this.getQueryData(handle);
    if (!data) return null;

    // Validate index is in range
    if (index < 0 || index >= data.itemContext.length) {
      return null;
    }

    return data.itemContext[index];
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
    const data = this.getQueryData(handle);
    if (!data) return null;

    if (selector === 'all') {
      return data.workItemIds;
    }

    if (Array.isArray(selector)) {
      return this.getItemsByIndices(handle, selector);
    }

    // Validate selector is an object before treating as criteria
    if (selector && typeof selector === 'object') {
      return this.getItemsByCriteria(handle, selector);
    }

    // Invalid selector type
    return null;
  }

  /**
   * Delete a query handle manually
   * 
   * @param handle Query handle string
   * @returns true if deleted, false if not found
   */
  deleteHandle(handle: string): boolean {
    return this.handles.delete(handle);
  }

  /**
   * Get statistics about stored handles
   */
  getStats(): {
    totalHandles: number;
    activeHandles: number;
    expiredHandles: number;
  } {
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;

    for (const data of this.handles.values()) {
      if (now > data.expiresAt) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    return {
      totalHandles: this.handles.size,
      activeHandles: activeCount,
      expiredHandles: expiredCount
    };
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
      expires_in_hours: number;
      expires_in_minutes: number;
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
    const now = new Date();
    const allHandles: Array<{
      id: string;
      created_at: string;
      expires_at: string;
      expires_in_hours: number;
      expires_in_minutes: number;
      item_count: number;
      has_context: boolean;
    }> = [];

    for (const [handle, data] of this.handles.entries()) {
      const isExpired = now > data.expiresAt;
      
      if (!includeExpired && isExpired) {
        continue;
      }

      const expiresInMs = data.expiresAt.getTime() - now.getTime();
      const expiresInMinutes = Math.max(0, Math.floor(expiresInMs / (1000 * 60)));
      const expiresInHours = Math.max(0, Math.floor(expiresInMs / (1000 * 60 * 60)));

      allHandles.push({
        id: handle,
        created_at: data.createdAt.toISOString(),
        expires_at: data.expiresAt.toISOString(),
        expires_in_hours: expiresInHours,
        expires_in_minutes: expiresInMinutes,
        item_count: data.workItemIds.length,
        has_context: data.itemContext && data.itemContext.length > 0
      });
    }

    // Apply pagination
    const total = allHandles.length;
    const paginatedHandles = allHandles.slice(skip, skip + top);
    const returned = paginatedHandles.length;
    const hasMore = (skip + returned) < total;

    return {
      handles: paginatedHandles,
      pagination: {
        total,
        skip,
        top,
        returned,
        hasMore,
        ...(hasMore && { nextSkip: skip + returned })
      }
    };
  }

  /**
   * Clean up expired handles
   */
  cleanup(): number {
    const now = new Date();
    let deletedCount = 0;

    for (const [handle, data] of this.handles.entries()) {
      if (now > data.expiresAt) {
        this.handles.delete(handle);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        const deleted = this.cleanup();
        if (deleted > 0) {
          logger.debug(`Cleaned up ${deleted} expired query handles`);
        }
      }, 5 * 60 * 1000); // Run every 5 minutes
    }
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all handles (useful for testing)
   */
  clearAll(): void {
    this.handles.clear();
    this.operationHistories.clear();
  }

  /**
   * Record a bulk operation for undo tracking
   * 
   * @param queryHandle Query handle the operation was performed on
   * @param operation Operation type (e.g., 'bulk-comment', 'bulk-update')
   * @param itemsAffected Array of work items and their previous values
   */
  recordOperation(
    queryHandle: string,
    operation: string,
    itemsAffected: Array<{ workItemId: number; changes: Record<string, any> }>
  ): void {
    let history = this.operationHistories.get(queryHandle);
    
    if (!history) {
      history = {
        queryHandle,
        operations: []
      };
      this.operationHistories.set(queryHandle, history);
    }

    history.operations.push({
      operation,
      timestamp: new Date().toISOString(),
      itemsAffected
    });

    logger.debug(`Recorded ${operation} operation on ${itemsAffected.length} items for handle ${queryHandle}`);
  }

  /**
   * Get operation history for a query handle
   * 
   * @param queryHandle Query handle to get history for
   * @returns Array of operations performed, or null if handle not found
   */
  getOperationHistory(queryHandle: string): OperationHistoryItem[] | null {
    const history = this.operationHistories.get(queryHandle);
    return history ? history.operations : null;
  }

  /**
   * Remove the last operation from history (called after successful undo)
   * 
   * @param queryHandle Query handle to remove operation from
   * @returns true if operation removed, false if no history found
   */
  removeLastOperation(queryHandle: string): boolean {
    const history = this.operationHistories.get(queryHandle);
    
    if (!history || history.operations.length === 0) {
      return false;
    }

    history.operations.pop();
    logger.debug(`Removed last operation from history for handle ${queryHandle}`);
    
    // Clean up empty history
    if (history.operations.length === 0) {
      this.operationHistories.delete(queryHandle);
    }
    
    return true;
  }

  /**
   * Clear operation history for a query handle
   * 
   * @param queryHandle Query handle to clear history for
   */
  clearOperationHistory(queryHandle: string): void {
    this.operationHistories.delete(queryHandle);
  }
}

// Export singleton instance
export const queryHandleService = new QueryHandleService();
export { QueryHandleData, SelectionCriteria, ItemContext, WorkItemContextData, OperationHistoryItem };
