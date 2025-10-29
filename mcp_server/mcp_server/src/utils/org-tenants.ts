/**
 * Organization Tenant Discovery
 * 
 * Discovers and caches Azure tenant IDs for Azure DevOps organizations.
 * Based on Microsoft's Azure DevOps MCP server implementation.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { logger } from './logger.js';

interface OrgTenantCacheEntry {
  tenantId: string;
  refreshedOn: number;
}

interface OrgTenantCache {
  [orgName: string]: OrgTenantCacheEntry;
}

const CACHE_FILE = path.join(os.homedir(), '.ado_orgs.cache');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * Load the organization tenant cache from disk
 */
async function loadCache(): Promise<OrgTenantCache> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save the organization tenant cache to disk
 */
async function trySavingCache(cache: OrgTenantCache): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.warn('Failed to save organization tenant cache:', error);
  }
}

/**
 * Fetch tenant ID from Azure DevOps API
 * Uses a HEAD request to get tenant ID from response headers
 */
async function fetchTenantFromApi(orgName: string): Promise<string> {
  const url = `https://vssps.dev.azure.com/${orgName}`;

  try {
    const response = await fetch(url, { method: 'HEAD' });

    if (response.status !== 404) {
      throw new Error(`Expected status 404, got ${response.status}`);
    }

    const tenantId = response.headers.get('x-vss-resourcetenant');
    if (!tenantId) {
      throw new Error('x-vss-resourcetenant header not found in response');
    }

    return tenantId;
  } catch (error) {
    throw new Error(`Failed to fetch tenant for organization ${orgName}: ${error}`);
  }
}

/**
 * Check if a cache entry has expired
 */
function isCacheEntryExpired(entry: OrgTenantCacheEntry): boolean {
  return Date.now() - entry.refreshedOn > CACHE_TTL_MS;
}

/**
 * Get tenant ID for an Azure DevOps organization
 * Uses caching to avoid repeated API calls
 */
export async function getOrgTenant(orgName: string): Promise<string | undefined> {
  const cache = await loadCache();

  // Check if tenant is cached and not expired
  const cachedEntry = cache[orgName];
  if (cachedEntry && !isCacheEntryExpired(cachedEntry)) {
    logger.debug(`Using cached tenant ID for organization '${orgName}'`);
    return cachedEntry.tenantId;
  }

  // Try to fetch fresh tenant from API
  try {
    const tenantId = await fetchTenantFromApi(orgName);

    // Cache the result
    cache[orgName] = {
      tenantId,
      refreshedOn: Date.now()
    };
    await trySavingCache(cache);

    logger.info(`Discovered tenant ID for organization '${orgName}': ${tenantId}`);
    return tenantId;
  } catch (error) {
    // If we have an expired cache entry, return it as fallback
    if (cachedEntry) {
      logger.warn(`Failed to fetch fresh tenant, using expired cache entry: ${error}`);
      return cachedEntry.tenantId;
    }

    // No cache entry available, log and return undefined
    logger.warn(`Unable to discover tenant for organization '${orgName}': ${error}`);
    return undefined;
  }
}
