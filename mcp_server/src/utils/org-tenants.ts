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

async function loadCache(): Promise<OrgTenantCache> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function trySavingCache(cache: OrgTenantCache): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.warn('Failed to save organization tenant cache:', error);
  }
}

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

function isCacheEntryExpired(entry: OrgTenantCacheEntry): boolean {
  return Date.now() - entry.refreshedOn > CACHE_TTL_MS;
}

export async function getOrgTenant(orgName: string): Promise<string | undefined> {
  const cache = await loadCache();

  const cachedEntry = cache[orgName];
  if (cachedEntry && !isCacheEntryExpired(cachedEntry)) {
    logger.debug(`Using cached tenant ID for organization '${orgName}'`);
    return cachedEntry.tenantId;
  }

  try {
    const tenantId = await fetchTenantFromApi(orgName);

    cache[orgName] = {
      tenantId,
      refreshedOn: Date.now()
    };
    await trySavingCache(cache);

    logger.info(`Discovered tenant ID for organization '${orgName}': ${tenantId}`);
    return tenantId;
  } catch (error) {
    if (cachedEntry) {
      logger.warn(`Failed to fetch fresh tenant, using expired cache entry: ${error}`);
      return cachedEntry.tenantId;
    }

    logger.warn(`Unable to discover tenant for organization '${orgName}': ${error}`);
    return undefined;
  }
}
