/**
 * Azure DevOps Identity Service
 * 
 * Provides utility functions for looking up user identities in Azure DevOps
 * 
 * NOTE: This service uses Azure CLI authentication instead of the main OAuth provider
 * because the IdentityPicker API (preview) requires different permissions than
 * the standard Azure DevOps REST APIs.
 */

import { AzureCliCredential } from '@azure/identity';
import { logger } from '../utils/logger.js';
import { createADOHttpClient } from '../utils/ado-http-client.js';

/**
 * Create a token provider specifically for identity operations
 * Uses Azure CLI credentials which have broader permissions for IdentityPicker API
 */
function createIdentityTokenProvider(): () => Promise<string> {
  const credential = new AzureCliCredential();
  const scopes = ['499b84ac-1321-427f-aa17-267ca6975798/.default'];
  
  return async () => {
    try {
      const result = await credential.getToken(scopes);
      if (!result) {
        throw new Error('Failed to obtain token from Azure CLI');
      }
      return result.token;
    } catch (error) {
      logger.error('Azure CLI authentication failed. Please ensure you are logged in with: az login');
      throw error;
    }
  };
}

interface IdentityDescriptor {
  value: string;
  identityType: string;
}

interface Identity {
  entityId: string;
  entityType: string;
  originDirectory: string;
  originId: string;
  localDirectory?: string;
  localId?: string;
  displayName: string;
  scopeName: string;
  active?: boolean;
  mail?: string;
  uniqueName?: string;
  subjectDescriptor?: string;
  descriptor?: IdentityDescriptor;
  providerDisplayName?: string;
  customDisplayName?: string;
  isActive?: boolean;
  properties?: Record<string, any>;
  samAccountName?: string;
  signInAddress?: string;
}

interface IdentitySearchResponse {
  results: Array<{
    queryToken: string;
    identities: Identity[];
    pagingToken?: string;
  }>;
}

/**
 * Search for identities matching a query string
 * @param organization - Azure DevOps organization name
 * @param searchFilter - Search string (e.g., "copilot", "github", email, etc.)
 * @returns Array of matching identities
 */
export async function searchIdentities(
  organization: string,
  searchFilter: string
): Promise<Identity[]> {
  // Use Azure CLI auth for identity operations (has necessary permissions for IdentityPicker API)
  const client = createADOHttpClient(organization, createIdentityTokenProvider());
  
  try {
    // Use the Identity Search API
    // API: https://dev.azure.com/{organization}/_apis/IdentityPicker/Identities?api-version=7.1-preview.1
    // Note: This is a preview API and requires the -preview suffix
    const response = await client.post<IdentitySearchResponse>(
      `IdentityPicker/Identities?api-version=7.1-preview.1`,
      {
        query: searchFilter,
        identityTypes: ['user'],
        operationScopes: ['ims', 'source'],
        options: {
          MinResults: 1,
          MaxResults: 20
        },
        properties: ['DisplayName', 'IsMru', 'ScopeName', 'Mail', 'SignInAddress', 'SamAccountName', 'SubjectDescriptor']
      }
    );
    
    const result = response.data;
    // IdentityPicker API returns results[].identities[] structure
    const identities = result.results?.[0]?.identities || [];
    logger.debug(`Found ${identities.length} identities for query "${searchFilter}"`);
    
    return identities;
  } catch (error) {
    logger.warn('Failed to search identities:', error);
    return []; // Return empty array instead of throwing
  }
}


/**
 * Resolve an identity descriptor to get the full identity details including the correct format for assignments
 * @param organization - Azure DevOps organization name
 * @param subjectDescriptor - The subject descriptor to resolve
 * @returns Identity with all fields populated
 */
async function resolveIdentityDescriptor(
  organization: string,
  subjectDescriptor: string
): Promise<any> {
  // Use Azure CLI auth for identity operations
  const client = createADOHttpClient(organization, createIdentityTokenProvider());
  
  try {
    // Use Graph API's subject lookup which returns the correct identity format
    const lookupKeys = JSON.stringify([{ descriptor: subjectDescriptor }]);
    const response = await client.get<any>(
      `graph/subjectlookup?lookupKeys=${encodeURIComponent(lookupKeys)}&api-version=7.1-preview.1`
    );
    
    return response.data?.value?.[subjectDescriptor];
  } catch (error) {
    logger.debug(`Failed to resolve descriptor via Graph API: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Find GitHub Copilot user GUID automatically by searching for identities
 * containing "copilot" in their display name
 * @param organization - Azure DevOps organization name
 * @returns GitHub Copilot identity in the format "localId@originId" or null if not found
 */
export async function findGitHubCopilotGuid(organization: string): Promise<string | null> {
  try {
    // Search for "github copilot" first (most specific)
    let identities = await searchIdentities(organization, 'github copilot');
    
    // If no results, try just "github" and filter
    if (identities.length === 0) {
      identities = await searchIdentities(organization, 'github');
      identities = identities.filter(id => id.displayName.toLowerCase().includes('copilot'));
    }
    
    // If still no results, try searching for "bot" and filter
    if (identities.length === 0) {
      identities = await searchIdentities(organization, 'bot');
      identities = identities.filter(id => {
        const displayName = id.displayName.toLowerCase();
        return displayName.includes('github') || displayName.includes('copilot');
      });
    }
    
    if (identities.length === 0) {
      logger.warn('No GitHub Copilot identity found.');
      logger.warn('Please manually specify the GUID with --copilot-guid flag');
      return null;
    }
    
    // If multiple results, try to find the most likely one
    let copilotIdentity = identities[0];
    
    if (identities.length > 1) {
      // Prefer active identities
      const activeIdentities = identities.filter(id => id.active);
      if (activeIdentities.length > 0) {
        identities = activeIdentities;
      }
      
      // Prefer exact matches for "GitHub Copilot"
      const exactMatch = identities.find(id => 
        id.displayName.toLowerCase() === 'github copilot'
      );
      
      copilotIdentity = exactMatch || identities[0];
    }
    
    // Check for the correct identity format in samAccountName or signInAddress
    const identityValue = copilotIdentity.samAccountName || copilotIdentity.signInAddress;
    
    if (!identityValue) {
      logger.warn(`Found GitHub Copilot identity but missing samAccountName/signInAddress fields`);
      logger.warn('Please manually specify the GUID with --copilot-guid flag');
      logger.debug(`Available fields: ${JSON.stringify(copilotIdentity, null, 2)}`);
      return null;
    }
    
    // Validate format (should be userId@directoryGuid)
    if (!identityValue.includes('@')) {
      logger.warn(`Identity value "${identityValue}" is not in expected format (userId@directoryGuid)`);
      logger.warn('Please manually specify the GUID with --copilot-guid flag');
      return null;
    }
    
    logger.info(`✓ Found GitHub Copilot identity: "${copilotIdentity.displayName}" (${identityValue})`);
    return identityValue;
  } catch (error) {
    logger.warn('Failed to find GitHub Copilot GUID:', error);
    logger.warn('Please manually specify the GUID with --copilot-guid flag');
    return null;
  }
}


/**
 * Get identity details by ID
 * @param organization - Azure DevOps organization name
 * @param identityId - Identity GUID
 * @returns Identity details or null if not found
 */
export async function getIdentityById(
  organization: string,
  identityId: string
): Promise<Identity | null> {
  // Use Azure CLI auth for identity operations
  const client = createADOHttpClient(organization, createIdentityTokenProvider());
  
  try {
    logger.debug(`Getting identity details for: ${identityId}`);
    
    // Identity Read API - uses standard version
    const response = await client.get<Identity>(
      `identities/${identityId}?api-version=7.1`
    );
    
    return response.data;
  } catch (error) {
    logger.error(`Failed to get identity ${identityId}`, error);
    return null;
  }
}
