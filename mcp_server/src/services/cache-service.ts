/**
 * Cache Service
 * 
 * Provides in-memory LRU caching with TTL, size limits, and statistics tracking.
 * Implements cache-aside pattern for Azure DevOps API calls.
 * 
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - Configurable TTL per cache entry
 * - Different TTL defaults per data type
 * - Hit/miss statistics tracking
 * - Memory usage monitoring
 * - Manual invalidation support
 * - Conditional caching (can be disabled for debugging)
 */

import { logger } from '../utils/logger.js';
import { metricsService } from './metrics-service.js';
import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  lastAccessed: number;
  accessCount: number;
  size: number; // Estimated size in bytes
}

interface CacheStats {
  enabled: boolean;
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  totalMemoryBytes: number;
  maxMemoryBytes: number;
  entries: Array<{
    key: string;
    age: number;
    ttl: number;
    accessCount: number;
    size: number;
  }>;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  enabled?: boolean;
  maxSize?: number;
  maxMemoryBytes?: number;
  defaultTTL?: number;
  ttls?: {
    workItemMetadata?: number;
    iterations?: number;
    projectConfig?: number;
    teamMembers?: number;
    workItemContent?: number;
    areaPath?: number;
    repository?: number;
  };
}

/**
 * Data type categories for different TTL strategies
 */
export enum CacheDataType {
  WORK_ITEM_METADATA = 'workItemMetadata',
  ITERATIONS = 'iterations',
  PROJECT_CONFIG = 'projectConfig',
  TEAM_MEMBERS = 'teamMembers',
  WORK_ITEM_CONTENT = 'workItemContent',
  AREA_PATH = 'areaPath',
  REPOSITORY = 'repository',
  FIELD_DEFINITIONS = 'fieldDefinitions',
  WORK_ITEM_TYPES = 'workItemTypes',
  PICKLISTS = 'picklists'
}

/**
 * Default TTL values (in milliseconds)
 */
const DEFAULT_TTLS = {
  [CacheDataType.WORK_ITEM_METADATA]: 15 * 60 * 1000,  // 15 minutes
  [CacheDataType.ITERATIONS]: 30 * 60 * 1000,           // 30 minutes
  [CacheDataType.PROJECT_CONFIG]: 60 * 60 * 1000,       // 60 minutes
  [CacheDataType.TEAM_MEMBERS]: 30 * 60 * 1000,         // 30 minutes
  [CacheDataType.WORK_ITEM_CONTENT]: 5 * 60 * 1000,     // 5 minutes
  [CacheDataType.AREA_PATH]: 30 * 60 * 1000,            // 30 minutes
  [CacheDataType.REPOSITORY]: 30 * 60 * 1000,           // 30 minutes
  [CacheDataType.FIELD_DEFINITIONS]: 60 * 60 * 1000,    // 60 minutes (fields change infrequently)
  [CacheDataType.WORK_ITEM_TYPES]: 60 * 60 * 1000,      // 60 minutes (types change infrequently)
  [CacheDataType.PICKLISTS]: 60 * 60 * 1000             // 60 minutes (picklists change infrequently)
};

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private maxMemoryBytes: number;
  private defaultTTL: number;
  private enabled: boolean;
  private ttls: Record<string, number>;
  
  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private totalMemoryBytes = 0;

  constructor(config: CacheConfig = {}) {
    this.enabled = config.enabled !== false; // Default to enabled
    this.maxSize = config.maxSize || 1000;
    this.maxMemoryBytes = config.maxMemoryBytes || 50 * 1024 * 1024; // 50MB default
    this.defaultTTL = config.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    
    // Merge default TTLs with custom TTLs
    this.ttls = {
      ...DEFAULT_TTLS,
      ...(config.ttls || {})
    };
    
    logger.debug(`[Cache] Initialized: enabled=${this.enabled}, maxSize=${this.maxSize}, maxMemory=${Math.round(this.maxMemoryBytes / 1024 / 1024)}MB`);
  }

  /**
   * Generate a cache key from components
   */
  static generateKey(prefix: string, ...parts: (string | number | boolean | undefined)[]): string {
    const cleanParts = parts.filter(p => p !== undefined && p !== null);
    const key = `${prefix}:${cleanParts.join(':')}`;
    // Hash long keys to keep cache keys manageable
    if (key.length > 200) {
      const hash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
      return `${prefix}:hash:${hash}`;
    }
    return key;
  }

  /**
   * Get TTL for a specific data type
   */
  getTTLForType(dataType: CacheDataType): number {
    return this.ttls[dataType] || this.defaultTTL;
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    if (!this.enabled) {
      return null;
    }
    
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.misses++;
      metricsService.increment('cache_miss', 1);
      return null;
    }
    
    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.totalMemoryBytes -= entry.size;
      this.misses++;
      metricsService.increment('cache_miss', 1);
      return null;
    }
    
    // Update access tracking (LRU)
    entry.lastAccessed = now;
    entry.accessCount++;
    this.hits++;
    metricsService.increment('cache_hit', 1);
    
    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, data: T, ttl?: number, dataType?: CacheDataType): void {
    if (!this.enabled) {
      return;
    }
    
    // Determine TTL
    const effectiveTTL = ttl || (dataType ? this.getTTLForType(dataType) : this.defaultTTL);
    
    // Estimate size (rough approximation)
    const size = this.estimateSize(data);
    
    // Check if we need to evict
    if (this.cache.size >= this.maxSize || this.totalMemoryBytes + size > this.maxMemoryBytes) {
      this.evictLRU(size);
    }
    
    // Remove old entry if exists (to update memory tracking)
    const existingEntry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (existingEntry) {
      this.totalMemoryBytes -= existingEntry.size;
    }
    
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: effectiveTTL,
      lastAccessed: now,
      accessCount: 0,
      size
    });
    
    this.totalMemoryBytes += size;
    metricsService.increment('cache_set', 1);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    if (!this.enabled) {
      return false;
    }
    
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.totalMemoryBytes -= entry.size;
      return false;
    }
    
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalMemoryBytes -= entry.size;
    }
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string | RegExp): number {
    let deleted = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }
    
    logger.debug(`[Cache] Deleted ${deleted} entries matching pattern: ${pattern}`);
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.totalMemoryBytes = 0;
    logger.debug('[Cache] Cleared all entries');
  }

  /**
   * Enable caching
   */
  enable(): void {
    this.enabled = true;
    logger.info('[Cache] Caching enabled');
  }

  /**
   * Disable caching
   */
  disable(): void {
    this.enabled = false;
    this.clear();
    logger.info('[Cache] Caching disabled');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.length > 50 ? key.substring(0, 50) + '...' : key,
      age: Math.round((now - entry.timestamp) / 1000),
      ttl: Math.round(entry.ttl / 1000),
      accessCount: entry.accessCount,
      size: entry.size
    }));
    
    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: this.evictions,
      totalMemoryBytes: this.totalMemoryBytes,
      maxMemoryBytes: this.maxMemoryBytes,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount).slice(0, 20) // Top 20 by access count
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    logger.debug('[Cache] Statistics reset');
  }

  /**
   * Evict entries using LRU policy until we have enough space
   */
  private evictLRU(requiredSpace: number): void {
    // Get all entries sorted by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedSpace = 0;
    let evicted = 0;
    
    for (const [key, entry] of entries) {
      // Stop if we have enough space
      if (this.cache.size < this.maxSize && 
          this.totalMemoryBytes + requiredSpace - freedSpace <= this.maxMemoryBytes) {
        break;
      }
      
      this.cache.delete(key);
      freedSpace += entry.size;
      evicted++;
      this.evictions++;
      metricsService.increment('cache_eviction', 1);
    }
    
    this.totalMemoryBytes -= freedSpace;
    
    if (evicted > 0) {
      logger.debug(`[Cache] Evicted ${evicted} LRU entries, freed ${Math.round(freedSpace / 1024)}KB`);
    }
  }

  /**
   * Estimate size of data (rough approximation)
   */
  private estimateSize(data: unknown): number {
    try {
      const str = JSON.stringify(data);
      // Rough estimate: 2 bytes per character for UTF-16
      return str.length * 2;
    } catch {
      // Fallback for non-serializable data
      return 1024; // 1KB default
    }
  }

  /**
   * Clean up expired entries (maintenance task)
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.totalMemoryBytes -= entry.size;
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`[Cache] Cleaned ${cleaned} expired entries`);
    }
    
    return cleaned;
  }
}

// Singleton instance with default configuration
export const cacheService = new CacheService();

// Start periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cacheService.cleanExpired();
  }, 5 * 60 * 1000);
}
