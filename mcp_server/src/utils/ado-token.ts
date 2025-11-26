/**
 * Azure DevOps Authentication
 * 
 * Multi-mode authentication supporting OAuth (interactive), Azure CLI, and environment credentials.
 * Based on Microsoft's Azure DevOps MCP server authentication approach.
 * Implementation synchronized with https://github.com/microsoft/azure-devops-mcp/blob/main/src/auth.ts
 */

import {
  ChainedTokenCredential,
  DefaultAzureCredential,
  TokenCredential
} from '@azure/identity';
import {
  AccountInfo,
  AuthenticationResult,
  PublicClientApplication
} from '@azure/msal-node';
import open from 'open';
import { logger } from './logger.js';
import { createAzureCliTokenProvider } from './azure-cli-token.js';

// Azure DevOps OAuth scope - must match Microsoft's implementation exactly
const scopes = ['499b84ac-1321-427f-aa17-267ca6975798/.default'];

/**
 * Authentication type
 */
export type AuthenticationType = 'interactive' | 'azcli' | 'env';

/**
 * OAuth Authenticator using MSAL
 * Provides interactive browser-based authentication
 * 
 * Implementation matches microsoft/azure-devops-mcp exactly to ensure compatibility
 */
class OAuthAuthenticator {
  static clientId = '0d50963b-7bb9-4fe7-94c7-a99af00b5136';
  static defaultAuthority = 'https://login.microsoftonline.com/common';
  static zeroTenantId = '00000000-0000-0000-0000-000000000000';

  private accountId: AccountInfo | null;
  private publicClientApp: PublicClientApplication;

  constructor(tenantId?: string) {
    this.accountId = null;

    let authority = OAuthAuthenticator.defaultAuthority;
    if (tenantId && tenantId !== OAuthAuthenticator.zeroTenantId) {
      authority = `https://login.microsoftonline.com/${tenantId}`;
    }

    this.publicClientApp = new PublicClientApplication({
      auth: {
        clientId: OAuthAuthenticator.clientId,
        authority
      }
    });
  }

  public async getToken(): Promise<string> {
    let authResult: AuthenticationResult | null = null;

    // Try silent authentication first if we have an account
    if (this.accountId) {
      try {
        authResult = await this.publicClientApp.acquireTokenSilent({
          scopes,
          account: this.accountId
        });
      } catch (error) {
        authResult = null;
      }
    }

    // Interactive authentication if silent failed or no account
    if (!authResult) {
      authResult = await this.publicClientApp.acquireTokenInteractive({
        scopes,
        openBrowser: async (url) => {
          open(url);
        }
      });
      this.accountId = authResult.account;
    }

    if (!authResult.accessToken) {
      throw new Error('Failed to obtain Azure DevOps OAuth token.');
    }

    return authResult.accessToken;
  }
}

/**
 * Create an authenticator function based on authentication type
 * 
 * Matches microsoft/azure-devops-mcp implementation exactly
 * 
 * @param type - Authentication type: 'interactive', 'azcli', or 'env'
 * @param tenantId - Optional tenant ID for multi-tenant scenarios
 * @returns Function that returns a Promise resolving to an access token
 */
export function createAuthenticator(
  type: AuthenticationType,
  tenantId?: string
): () => Promise<string> {
  logger.info(`Creating authenticator: type=${type}, tenantId=${tenantId || 'none'}`);

  switch (type) {
    case 'azcli': {
      // Use enhanced Azure CLI token provider with error boundaries and retry logic
      logger.info('Using enhanced Azure CLI authentication with retry logic');
      return createAzureCliTokenProvider(tenantId, scopes);
    }
    
    case 'env': {
      // Set environment variable to prefer environment credentials
      process.env.AZURE_TOKEN_CREDENTIALS = 'dev';

      let credential: TokenCredential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS

      // For multi-tenant scenarios, chain credentials
      if (tenantId) {
        // Use enhanced Azure CLI provider in chain
        const azCliProvider = createAzureCliTokenProvider(tenantId, scopes);
        
        // Wrap in a compatible credential object
        const azCliCredential = {
          getToken: async () => {
            const token = await azCliProvider();
            // Return token in AccessToken format
            return {
              token,
              expiresOnTimestamp: Date.now() + 3600 * 1000, // 1 hour default
            };
          }
        } as TokenCredential;
        
        credential = new ChainedTokenCredential(azCliCredential, credential);
      }

      return async () => {
        const result = await credential.getToken(scopes);
        if (!result) {
          throw new Error(
            'Failed to obtain Azure DevOps token. Ensure you have Azure CLI logged or use interactive type of authentication.'
          );
        }
        return result.token;
      };
    }

    case 'interactive':
    default: {
      const authenticator = new OAuthAuthenticator(tenantId);
      return () => {
        return authenticator.getToken();
      };
    }
  }
}

/**
 * Detect if running in GitHub Codespaces
 * In Codespaces, default to Azure CLI authentication
 */
export function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === 'true';
}

/**
 * Get default authentication type based on environment
 */
export function getDefaultAuthType(): AuthenticationType {
  return isGitHubCodespaceEnv() ? 'azcli' : 'interactive';
}
