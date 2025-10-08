/**
 * Azure DevOps Token Utility
 * 
 * Centralized token management for Azure DevOps API access
 */

import { execSync } from 'child_process';
import { AZURE_DEVOPS_RESOURCE_ID, loadConfiguration } from '../config/config.js';
import { logger } from './logger.js';

// Token cache to avoid repeated CLI calls
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get Azure DevOps access token using Azure CLI with caching
 * Tokens are cached for 55 minutes (with 5 minute buffer before expiry)
 * @throws Error if Azure CLI is not installed or user is not logged in
 */
export function getAzureDevOpsToken(): string {
  // Check cache first
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  try {
    // Load configuration to check autoLaunchBrowser setting
    let autoLaunchBrowser = false;
    try {
      const config = loadConfiguration();
      autoLaunchBrowser = config.autoLaunchBrowser || false;
    } catch (err) {
      // If config not loaded yet, default to false (no browser launch)
      autoLaunchBrowser = false;
    }

    // Build Azure CLI command
    // Use --only-show-errors to suppress warnings
    // Use --allow-no-subscriptions to prevent browser popup when not opted in
    let azCommand = `az account get-access-token --resource ${AZURE_DEVOPS_RESOURCE_ID} --query accessToken -o tsv --only-show-errors`;
    
    if (!autoLaunchBrowser) {
      // Add --allow-no-subscriptions to prevent browser launch
      azCommand += ' --allow-no-subscriptions';
      
      // Log helpful message when browser launch is skipped
      logger.info('Browser auto-launch is disabled for authentication. To enable, use --auto-launch-browser flag.');
    }

    const result = execSync(azCommand, { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'] 
    });
    const token = result.trim();
    
    // Cache token for 55 minutes (tokens typically valid for 1 hour)
    tokenCache = {
      token,
      expiresAt: now + (55 * 60 * 1000) // 55 minutes
    };
    
    return token;
  } catch (err) {
    throw new Error('Failed to get Azure DevOps token. Ensure you are logged in with az login (non-interactive)');
  }
}

/**
 * Clear the token cache (useful for testing or forcing refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null;
}
