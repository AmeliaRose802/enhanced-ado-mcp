import crypto from 'crypto';

/**
 * Query Handle Service
 * 
 * Manages query handles for WIQL queries to enable safe bulk operations
 * without risk of ID hallucination. Query handles store the actual work item IDs
 * returned from Azure DevOps, which can then be used for bulk operations.
 * 
 * Key features:
 * - Generate unique handles for query results
 * - Store work item IDs with expiration (default 1 hour)
 * - Retrieve work item IDs by handle
 * - Automatic cleanup of expired handles
 */

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
  workItemContext?: Map<number, {
    title?: string;
    state?: string;
    type?: string;
    lastSubstantiveChangeDate?: string;
    daysInactive?: number;
    createdDate?: string;
    changedDate?: string;
    assignedTo?: string;
    areaPath?: string;
    [key: string]: any; // For additional fields
  }>;
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

class QueryHandleService {
  private handles: Map<string, QueryHandleData> = new Map();
  private defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start automatic cleanup every 5 minutes
    this.startCleanup();
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
   * @param ttlMs Time-to-live in milliseconds (default: 1 hour)
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
      return null;
    }

    // Check if expired
    if (new Date() > data.expiresAt) {
      this.handles.delete(handle);
      return null;
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
  getWorkItemContext(handle: string, workItemId: number): any {
    const data = this.getQueryData(handle);
    if (!data?.workItemContext) {
      return null;
    }
    return data.workItemContext.get(workItemId) || null;
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
   * Get work item IDs by indices from a query handle
   * 
   * @param handle Query handle string
   * @param indices Array of zero-based indices to select
   * @returns Array of work item IDs for the specified indices, or null if handle not found
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
   * Get work item IDs by criteria from a query handle
   * 
   * @param handle Query handle string
   * @param criteria Selection criteria object
   * @returns Array of work item IDs matching the criteria, or null if handle not found
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
   * Get item context for a specific index from a query handle
   * 
   * @param handle Query handle string
   * @param index Zero-based index of the item
   * @returns Item context or null if not found
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
   * Resolve ItemSelector to work item IDs
   * 
   * @param handle Query handle string
   * @param selector Item selector (all, indices array, or criteria object)
   * @returns Array of work item IDs, or null if handle not found or invalid selector
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
          console.log(`[QueryHandleService] Cleaned up ${deleted} expired handles`);
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
  }
}

// Export singleton instance
export const queryHandleService = new QueryHandleService();
export { QueryHandleData, SelectionCriteria, ItemContext };
