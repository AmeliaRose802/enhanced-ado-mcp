import { randomBytes } from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Work item context data with extensible fields
 */
export interface WorkItemContextData {
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

export interface QueryHandleData {
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
  // Rich item context for selection
  itemContext: ItemContext[];
  // Selection metadata
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

// Item context interface
export interface ItemContext {
  index: number;
  id: number;
  title: string;
  state: string;
  type: string;
  daysInactive?: number;
  lastChange?: string;
  tags?: string[];
}

/**
 * Query Cache Service
 * 
 * Manages in-memory storage and retrieval of query handles.
 * Responsibilities:
 * - Generate unique query handles
 * - Store query results with expiration
 * - Retrieve query data by handle
 * - Automatic cleanup of expired handles
 * - Handle lifecycle management
 */
export class QueryCache {
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
  generateHandle(): string {
    return `qh_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Store a query result with a handle
   */
  storeQuery(
    handle: string,
    workItemIds: number[],
    query: string,
    metadata?: QueryHandleData['metadata'],
    ttlMs: number = this.defaultTTL,
    workItemContext?: QueryHandleData['workItemContext'],
    analysisMetadata?: QueryHandleData['analysisMetadata']
  ): void {
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
      criteriaTags: Array.from(new Set(itemContext.flatMap(item => item.tags || [])))
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
  }

  /**
   * Retrieve work item IDs by query handle
   */
  getWorkItemIds(handle: string): number[] | null {
    const data = this.getQueryData(handle);
    return data?.workItemIds || null;
  }

  /**
   * Get full query handle data (including metadata)
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
   */
  getWorkItemContext(handle: string, workItemId: number): WorkItemContextData | null {
    const data = this.getQueryData(handle);
    if (!data?.workItemContext) {
      return null;
    }
    return data.workItemContext.get(workItemId) || null;
  }

  /**
   * Get analysis metadata for a query handle
   */
  getAnalysisMetadata(handle: string): QueryHandleData['analysisMetadata'] | null {
    const data = this.getQueryData(handle);
    return data?.analysisMetadata || null;
  }

  /**
   * Delete a query handle manually
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

    for (const data of Array.from(this.handles.values())) {
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
    const now = new Date();
    const allHandles: Array<{
      id: string;
      created_at: string;
      expires_at: string;
      item_count: number;
      has_context: boolean;
    }> = [];

    for (const [handle, data] of Array.from(this.handles.entries())) {
      const isExpired = now > data.expiresAt;
      
      if (!includeExpired && isExpired) {
        continue;
      }

      allHandles.push({
        id: handle,
        created_at: data.createdAt.toISOString(),
        expires_at: data.expiresAt.toISOString(),
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

    for (const [handle, data] of Array.from(this.handles.entries())) {
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
  }
}
