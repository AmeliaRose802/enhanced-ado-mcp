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
}

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
   * @returns Query handle string
   */
  storeQuery(
    workItemIds: number[],
    query: string,
    metadata?: QueryHandleData['metadata'],
    ttlMs: number = this.defaultTTL
  ): string {
    const handle = this.generateHandle();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    this.handles.set(handle, {
      workItemIds,
      query,
      createdAt: now,
      expiresAt,
      metadata
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
export { QueryHandleData };
