/**
 * Azure CLI Token Acquisition with Error Boundaries
 * 
 * Provides robust token acquisition with retry logic, clear error messages,
 * and token refresh handling.
 */

import { AzureCliCredential } from '@azure/identity';
import { AccessToken } from '@azure/identity';
import { logger } from './logger.js';
import { withRetry, isRetryableAuthError } from './retry.js';
import { ErrorCategory, ErrorCode, createErrorMetadata } from '../types/error-categories.js';

/**
 * Token cache entry
 */
interface TokenCacheEntry {
  token: string;
  expiresOnTimestamp: number;
}

/**
 * Azure CLI Token Provider with error boundaries and retry logic
 */
export class AzureCliTokenProvider {
  private credential: AzureCliCredential;
  private scopes: string[];
  private tokenCache: TokenCacheEntry | null = null;
  
  /** Buffer time before expiration to refresh token (5 minutes) */
  private static readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;
  
  /** Maximum retry attempts for token acquisition */
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  
  /** Initial retry delay in milliseconds */
  private static readonly INITIAL_RETRY_DELAY_MS = 1000;
  
  constructor(tenantId?: string, scopes?: string[]) {
    this.credential = new AzureCliCredential(
      tenantId ? { tenantId } : undefined
    );
    this.scopes = scopes || ['499b84ac-1321-427f-aa17-267ca6975798/.default'];
  }
  
  /**
   * Get an access token with retry logic and caching
   * 
   * @returns Access token string
   * @throws Error with clear, actionable message if token acquisition fails
   */
  async getToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache && this.isTokenValid(this.tokenCache)) {
        logger.debug('Using cached Azure CLI token');
        return this.tokenCache.token;
      }
      
      // Token expired or not cached, acquire new token with retry
      logger.debug('Acquiring new Azure CLI token...');
      
      const result = await withRetry(
        () => this.acquireToken(),
        {
          maxAttempts: AzureCliTokenProvider.MAX_RETRY_ATTEMPTS,
          initialDelayMs: AzureCliTokenProvider.INITIAL_RETRY_DELAY_MS,
          isRetryable: isRetryableAuthError,
          operationName: 'Azure CLI token acquisition',
        }
      );
      
      // Cache the token
      this.tokenCache = {
        token: result.token,
        expiresOnTimestamp: result.expiresOnTimestamp,
      };
      
      const expiresIn = Math.round((result.expiresOnTimestamp - Date.now()) / 1000 / 60);
      logger.debug(`Azure CLI token acquired successfully (expires in ${expiresIn} minutes)`);
      
      return result.token;
    } catch (error) {
      throw this.createDetailedError(error);
    }
  }
  
  /**
   * Acquire token from Azure CLI credential
   */
  private async acquireToken(): Promise<AccessToken> {
    const result = await this.credential.getToken(this.scopes);
    
    if (!result) {
      throw new Error('Azure CLI credential returned null token');
    }
    
    return result;
  }
  
  /**
   * Check if cached token is still valid
   * Returns false if token will expire within REFRESH_BUFFER_MS
   */
  private isTokenValid(cache: TokenCacheEntry): boolean {
    const now = Date.now();
    const timeUntilExpiry = cache.expiresOnTimestamp - now;
    
    if (timeUntilExpiry <= 0) {
      logger.debug('Cached token has expired');
      return false;
    }
    
    if (timeUntilExpiry <= AzureCliTokenProvider.REFRESH_BUFFER_MS) {
      logger.debug(`Cached token expires soon (${Math.round(timeUntilExpiry / 1000)}s), refreshing...`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Create a detailed, actionable error message from token acquisition failure
   */
  private createDetailedError(error: unknown): Error {
    const originalError = error instanceof Error ? error : new Error(String(error));
    const errorMessage = originalError.message.toLowerCase();
    
    // Not logged in to Azure CLI
    if (
      errorMessage.includes('not logged in') ||
      errorMessage.includes('az login') ||
      errorMessage.includes('no accounts') ||
      errorMessage.includes('please run')
    ) {
      const detailedError = new Error(
        'Azure CLI authentication required. You are not logged in to Azure CLI.\n' +
        'Action required: Run "az login" in your terminal to authenticate.\n' +
        'After logging in, try the operation again.'
      );
      
      (detailedError as any).metadata = createErrorMetadata(
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_NOT_LOGGED_IN,
        {
          operation: 'Azure CLI token acquisition',
          originalError: originalError.message,
        }
      );
      
      logger.error('Azure CLI authentication required - user not logged in');
      return detailedError;
    }
    
    // Token expired or refresh needed
    if (
      errorMessage.includes('expired') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('refresh')
    ) {
      const detailedError = new Error(
        'Azure CLI token has expired or is invalid.\n' +
        'Action required: Run "az login" to refresh your authentication.\n' +
        'If you continue to experience issues, try "az account clear" followed by "az login".'
      );
      
      (detailedError as any).metadata = createErrorMetadata(
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_TOKEN_EXPIRED,
        {
          operation: 'Azure CLI token acquisition',
          originalError: originalError.message,
        }
      );
      
      logger.error('Azure CLI token expired or invalid');
      return detailedError;
    }
    
    // Azure CLI not installed or not in PATH
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('command not found') ||
      errorMessage.includes('not recognized') ||
      errorMessage.includes('not available')
    ) {
      const detailedError = new Error(
        'Azure CLI is not installed or not available in PATH.\n' +
        'Action required:\n' +
        '  1. Install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli\n' +
        '  2. Ensure "az" command is available in your PATH\n' +
        '  3. Run "az login" to authenticate\n' +
        'Alternatively, use a different authentication method (e.g., --authentication interactive).'
      );
      
      (detailedError as any).metadata = createErrorMetadata(
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_CLI_NOT_AVAILABLE,
        {
          operation: 'Azure CLI token acquisition',
          originalError: originalError.message,
        }
      );
      
      logger.error('Azure CLI not found or not available');
      return detailedError;
    }
    
    // Permission/scope issues
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('insufficient') ||
      errorMessage.includes('access denied')
    ) {
      const detailedError = new Error(
        'Insufficient permissions for Azure CLI authentication.\n' +
        'Action required:\n' +
        '  1. Ensure you are logged in with an account that has access to Azure DevOps\n' +
        '  2. Verify your account has the necessary permissions in your Azure DevOps organization\n' +
        '  3. Try running "az login" with a different account if needed'
      );
      
      (detailedError as any).metadata = createErrorMetadata(
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
        {
          operation: 'Azure CLI token acquisition',
          originalError: originalError.message,
        }
      );
      
      logger.error('Insufficient permissions for Azure CLI authentication');
      return detailedError;
    }
    
    // Network/transient errors (after retries exhausted)
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused')
    ) {
      const detailedError = new Error(
        'Network error during Azure CLI token acquisition (after 3 retry attempts).\n' +
        'Possible causes:\n' +
        '  - Temporary network connectivity issues\n' +
        '  - Azure authentication service unavailable\n' +
        '  - Firewall or proxy blocking connection\n' +
        'Action required:\n' +
        '  1. Check your internet connection\n' +
        '  2. Verify you can access Azure services (https://portal.azure.com)\n' +
        '  3. If using a proxy, ensure Azure CLI is configured correctly\n' +
        '  4. Try again in a few moments'
      );
      
      (detailedError as any).metadata = createErrorMetadata(
        ErrorCategory.NETWORK,
        ErrorCode.NETWORK_TIMEOUT,
        {
          operation: 'Azure CLI token acquisition',
          originalError: originalError.message,
          retriesExhausted: true,
        }
      );
      
      logger.error('Network error during Azure CLI token acquisition (retries exhausted)');
      return detailedError;
    }
    
    // Unknown error - provide generic guidance
    const detailedError = new Error(
      `Azure CLI token acquisition failed: ${originalError.message}\n\n` +
      'Troubleshooting steps:\n' +
      '  1. Verify Azure CLI is installed: az --version\n' +
      '  2. Check you are logged in: az account show\n' +
      '  3. Try re-authenticating: az login\n' +
      '  4. If issues persist, try: az account clear && az login\n' +
      '  5. Consider using alternative authentication (--authentication interactive)\n\n' +
      `Original error: ${originalError.message}`
    );
    
    (detailedError as any).metadata = createErrorMetadata(
      ErrorCategory.AUTHENTICATION,
      ErrorCode.UNKNOWN_ERROR,
      {
        operation: 'Azure CLI token acquisition',
        originalError: originalError.message,
      }
    );
    
    logger.error(`Unknown error during Azure CLI token acquisition: ${originalError.message}`);
    return detailedError;
  }
  
  /**
   * Clear the token cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.tokenCache = null;
    logger.debug('Azure CLI token cache cleared');
  }
  
  /**
   * Get token expiration info (for debugging/monitoring)
   */
  getTokenInfo(): { isCached: boolean; expiresIn?: number } | null {
    if (!this.tokenCache) {
      return null;
    }
    
    const expiresIn = Math.max(0, this.tokenCache.expiresOnTimestamp - Date.now());
    
    return {
      isCached: true,
      expiresIn: Math.round(expiresIn / 1000), // seconds
    };
  }
}

/**
 * Create a token provider function for Azure CLI authentication
 * 
 * @param tenantId - Optional tenant ID for multi-tenant scenarios
 * @param scopes - Optional custom scopes (defaults to Azure DevOps scope)
 * @returns Function that returns a Promise resolving to an access token
 * 
 * @example
 * const tokenProvider = createAzureCliTokenProvider();
 * const token = await tokenProvider();
 */
export function createAzureCliTokenProvider(
  tenantId?: string,
  scopes?: string[]
): () => Promise<string> {
  const provider = new AzureCliTokenProvider(tenantId, scopes);
  return () => provider.getToken();
}
