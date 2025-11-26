/**
 * Handler for cache-control tool
 * Allows enabling/disabling cache and manual invalidation
 */

import type { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { asToolData } from "@/types/index.js";
import { cacheService } from "../../cache-service.js";
import { validateAndParse } from "@/utils/handler-helpers.js";
import { z } from 'zod';

// Schema for cache control request
const cacheControlSchema = z.object({
  action: z.enum(['enable', 'disable', 'clear', 'invalidate']).describe(
    'Action to perform: enable (turn on caching), disable (turn off caching), clear (remove all entries), invalidate (remove entries matching pattern)'
  ),
  pattern: z.string().optional().describe(
    'Pattern to match for invalidation (regex string). Example: "workitem:123" or "iterations:.*"'
  )
});

export async function handleCacheControl(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const parsed = validation.data;
    let message = '';
    let deletedCount = 0;
    
    switch (parsed.action) {
      case 'enable':
        cacheService.enable();
        message = 'Caching has been enabled';
        break;
        
      case 'disable':
        cacheService.disable();
        message = 'Caching has been disabled and all entries cleared';
        break;
        
      case 'clear':
        cacheService.clear();
        message = 'All cache entries have been cleared';
        break;
        
      case 'invalidate':
        if (!parsed.pattern) {
          return {
            success: false,
            metadata: {
              timestamp: new Date().toISOString(),
              source: 'cache-control'
            },
            errors: ['Pattern is required for invalidate action'],
            warnings: []
          };
        }
        deletedCount = cacheService.deletePattern(parsed.pattern);
        message = `Invalidated ${deletedCount} cache entries matching pattern: ${parsed.pattern}`;
        break;
    }
    
    const stats = cacheService.getStats();
    
    return {
      success: true,
      data: asToolData({
        action: parsed.action,
        message,
        deleted_count: deletedCount,
        current_status: {
          enabled: stats.enabled,
          size: stats.size,
          memory_mb: Math.round(stats.totalMemoryBytes / 1024 / 1024 * 100) / 100
        }
      }),
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'cache-control'
      },
      errors: [],
      warnings: []
    };
    
  } catch (error) {
    return {
      success: false,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'cache-control'
      },
      errors: [`Failed to control cache: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}
