/**
 * Cached Work Item Repository
 * 
 * Wraps WorkItemRepository with intelligent caching for frequently accessed data.
 * 
 * Cached Operations:
 * - getById (work item content - 5 min TTL)
 * - getFields (work item metadata - 15 min TTL)
 * - Project configurations
 * 
 * Non-Cached Operations:
 * - create, update, delete (mutations)
 * - WIQL queries (results vary frequently)
 */

import { WorkItemRepository } from './work-item.repository.js';
import { cacheService, CacheDataType, CacheService } from '../services/cache-service.js';
import { logger } from '../utils/logger.js';
import type { 
  ADOWorkItem, 
  ADOWorkItemRevision, 
  ADOFieldOperation,
  ADOWiqlResult,
  ADOApiResponse
} from '../types/index.js';

/**
 * Cached Work Item Repository
 * Adds caching layer on top of WorkItemRepository
 */
export class CachedWorkItemRepository extends WorkItemRepository {
  
  /**
   * Get a single work item by ID (with caching)
   */
  async getById(workItemId: number, fields?: string[]): Promise<ADOWorkItem> {
    const cacheKey = CacheService.generateKey('workitem', workItemId, fields?.join(','));
    
    // Check cache
    const cached = cacheService.get<ADOWorkItem>(cacheKey);
    if (cached) {
      logger.debug(`[Cache] HIT: Work item ${workItemId}`);
      return cached;
    }
    
    logger.debug(`[Cache] MISS: Work item ${workItemId}`);
    
    // Fetch from API
    const workItem = await super.getById(workItemId, fields);
    
    // Cache with appropriate TTL based on whether we're getting full content or just metadata
    const dataType = fields ? CacheDataType.WORK_ITEM_METADATA : CacheDataType.WORK_ITEM_CONTENT;
    cacheService.set(cacheKey, workItem, undefined, dataType);
    
    return workItem;
  }

  /**
   * Get multiple work items by IDs (with caching)
   * Uses individual cache entries for each work item to maximize cache hits
   */
  async getBatch(workItemIds: number[], fields?: string[]): Promise<ADOWorkItem[]> {
    const fieldsKey = fields?.join(',') || '';
    
    // Check which items are cached
    const cachedItems: ADOWorkItem[] = [];
    const uncachedIds: number[] = [];
    
    for (const id of workItemIds) {
      const cacheKey = CacheService.generateKey('workitem', id, fieldsKey);
      const cached = cacheService.get<ADOWorkItem>(cacheKey);
      
      if (cached) {
        cachedItems.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }
    
    logger.debug(`[Cache] Batch: ${cachedItems.length} hits, ${uncachedIds.length} misses (total: ${workItemIds.length})`);
    
    // Fetch uncached items
    let fetchedItems: ADOWorkItem[] = [];
    if (uncachedIds.length > 0) {
      fetchedItems = await super.getBatch(uncachedIds, fields);
      
      // Cache newly fetched items
      const dataType = fields ? CacheDataType.WORK_ITEM_METADATA : CacheDataType.WORK_ITEM_CONTENT;
      for (const item of fetchedItems) {
        const cacheKey = CacheService.generateKey('workitem', item.id, fieldsKey);
        cacheService.set(cacheKey, item, undefined, dataType);
      }
    }
    
    // Combine cached and fetched items, maintaining original order
    const resultMap = new Map<number, ADOWorkItem>();
    for (const item of [...cachedItems, ...fetchedItems]) {
      resultMap.set(item.id, item);
    }
    
    return workItemIds.map(id => resultMap.get(id)).filter((item): item is ADOWorkItem => item !== undefined);
  }

  /**
   * Create a new work item (invalidates caches)
   */
  async create(workItemType: string, fields: ADOFieldOperation[]): Promise<ADOWorkItem> {
    const workItem = await super.create(workItemType, fields);
    
    // No need to invalidate since it's a new item, but we can proactively cache it
    const cacheKey = CacheService.generateKey('workitem', workItem.id);
    cacheService.set(cacheKey, workItem, undefined, CacheDataType.WORK_ITEM_CONTENT);
    
    return workItem;
  }

  /**
   * Update a work item (invalidates cache for that item)
   */
  async update(workItemId: number, fields: ADOFieldOperation[]): Promise<ADOWorkItem> {
    const workItem = await super.update(workItemId, fields);
    
    // Invalidate all cached versions of this work item
    cacheService.deletePattern(`workitem:${workItemId}`);
    
    // Cache the updated version
    const cacheKey = CacheService.generateKey('workitem', workItemId);
    cacheService.set(cacheKey, workItem, undefined, CacheDataType.WORK_ITEM_CONTENT);
    
    return workItem;
  }

  /**
   * Delete a work item (invalidates cache)
   */
  async delete(workItemId: number, hardDelete = false): Promise<void> {
    await super.delete(workItemId, hardDelete);
    
    // Invalidate all cached versions of this work item
    cacheService.deletePattern(`workitem:${workItemId}`);
  }

  /**
   * Link a work item to a parent (invalidates both work items)
   */
  async linkToParent(workItemId: number, parentWorkItemId: number): Promise<void> {
    await super.linkToParent(workItemId, parentWorkItemId);
    
    // Invalidate both work items since relations changed
    cacheService.deletePattern(`workitem:${workItemId}`);
    cacheService.deletePattern(`workitem:${parentWorkItemId}`);
  }

  /**
   * Get work item revisions (with caching)
   */
  async getRevisions(workItemId: number): Promise<ADOWorkItemRevision[]> {
    const cacheKey = CacheService.generateKey('workitem-revisions', workItemId);
    
    // Check cache
    const cached = cacheService.get<ADOWorkItemRevision[]>(cacheKey);
    if (cached) {
      logger.debug(`[Cache] HIT: Work item ${workItemId} revisions`);
      return cached;
    }
    
    logger.debug(`[Cache] MISS: Work item ${workItemId} revisions`);
    
    // Fetch from API
    const revisions = await super.getRevisions(workItemId);
    
    // Cache with metadata TTL (revisions don't change once created)
    cacheService.set(cacheKey, revisions, undefined, CacheDataType.WORK_ITEM_METADATA);
    
    return revisions;
  }

  /**
   * Execute a WIQL query (NOT cached - results too dynamic)
   */
  async executeWiql(wiqlQuery: string): Promise<ADOWiqlResult> {
    // WIQL results are too dynamic to cache effectively
    return super.executeWiql(wiqlQuery);
  }
}

/**
 * Create a cached work item repository
 */
export function createCachedWorkItemRepository(
  organization: string,
  project: string
): CachedWorkItemRepository {
  return new CachedWorkItemRepository(organization, project);
}
