/**
 * Handler for get-cache-stats tool
 * Provides cache statistics and configuration information
 */

import type { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { asToolData } from "@/types/index.js";
import { cacheService } from "../../cache-service.js";
import { validateAndParse } from "@/utils/handler-helpers.js";
import { z } from 'zod';

// Schema for cache stats request
const cacheStatsSchema = z.object({
  reset: z.boolean().optional().describe('Reset statistics after retrieving them'),
  detailed: z.boolean().optional().describe('Include detailed entry list (top 20 by access count)')
});

export async function handleGetCacheStats(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const parsed = validation.data;
    const stats = cacheService.getStats();
    
    // Build response
    const summary = {
      enabled: stats.enabled,
      current_size: stats.size,
      max_size: stats.maxSize,
      utilization: `${Math.round((stats.size / stats.maxSize) * 100)}%`,
      memory_usage_mb: Math.round(stats.totalMemoryBytes / 1024 / 1024 * 100) / 100,
      memory_limit_mb: Math.round(stats.maxMemoryBytes / 1024 / 1024),
      memory_utilization: `${Math.round((stats.totalMemoryBytes / stats.maxMemoryBytes) * 100)}%`,
      total_requests: stats.hits + stats.misses,
      cache_hits: stats.hits,
      cache_misses: stats.misses,
      hit_rate: `${Math.round(stats.hitRate * 100)}%`,
      evictions: stats.evictions
    };
    
    const response: Record<string, unknown> = {
      summary,
      recommendations: []
    };
    
    // Add recommendations based on stats
    const recommendations: string[] = [];
    
    if (stats.hitRate < 0.3 && stats.hits + stats.misses > 100) {
      recommendations.push('⚠️ Low hit rate (<30%). Consider increasing cache size or TTLs.');
    }
    
    if (stats.evictions > stats.size * 2) {
      recommendations.push('⚠️ High eviction rate. Consider increasing max cache size.');
    }
    
    if (stats.totalMemoryBytes > stats.maxMemoryBytes * 0.9) {
      recommendations.push('⚠️ Cache memory usage >90%. Approaching memory limit.');
    }
    
    if (stats.hitRate > 0.7 && stats.hits + stats.misses > 100) {
      recommendations.push('✅ Good hit rate (>70%). Cache is effective.');
    }
    
    if (!stats.enabled) {
      recommendations.push('⚠️ Caching is currently DISABLED. Enable it to improve performance.');
    }
    
    response.recommendations = recommendations;
    
    // Add detailed entries if requested
    if (parsed.detailed) {
      response.top_entries = stats.entries;
    }
    
    // Reset stats if requested
    if (parsed.reset) {
      cacheService.resetStats();
      response.message = 'Statistics have been reset';
    }
    
    return {
      success: true,
      data: asToolData(response),
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'cache-stats'
      },
      errors: [],
      warnings: []
    };
    
  } catch (error) {
    return {
      success: false,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'cache-stats'
      },
      errors: [`Failed to get cache statistics: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}
