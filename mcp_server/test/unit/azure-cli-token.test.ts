/**
 * Azure CLI Token Provider Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AzureCliTokenProvider } from '../../src/utils/azure-cli-token.js';
import { AzureCliCredential } from '@azure/identity';
import { ErrorCategory, ErrorCode } from '../../src/types/error-categories.js';

// Mock the Azure identity module
jest.mock('@azure/identity');

describe('AzureCliTokenProvider', () => {
  let mockCredential: jest.Mocked<AzureCliCredential>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock credential
    mockCredential = {
      getToken: jest.fn<() => Promise<any>>(),
    } as any;
    
    (AzureCliCredential as jest.MockedClass<typeof AzureCliCredential>).mockImplementation(() => mockCredential);
  });
  
  describe('Token acquisition', () => {
    it('should acquire token successfully', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      mockCredential.getToken.mockResolvedValueOnce({
        token: 'test-token',
        expiresOnTimestamp: expiresOn,
      });
      
      const provider = new AzureCliTokenProvider();
      const token = await provider.getToken();
      
      expect(token).toBe('test-token');
      expect(mockCredential.getToken).toHaveBeenCalledWith(['499b84ac-1321-427f-aa17-267ca6975798/.default']);
    });
    
    it('should cache token and reuse if valid', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      mockCredential.getToken.mockResolvedValueOnce({
        token: 'test-token',
        expiresOnTimestamp: expiresOn,
      });
      
      const provider = new AzureCliTokenProvider();
      
      // First call - should acquire
      const token1 = await provider.getToken();
      expect(token1).toBe('test-token');
      
      // Second call - should use cache
      const token2 = await provider.getToken();
      expect(token2).toBe('test-token');
      
      // Should only call getToken once
      expect(mockCredential.getToken).toHaveBeenCalledTimes(1);
    });
    
    it('should refresh token before expiration', async () => {
      // Token expires in 4 minutes (less than 5 minute buffer)
      const expiresOn = Date.now() + 4 * 60 * 1000;
      mockCredential.getToken
        .mockResolvedValueOnce({
          token: 'old-token',
          expiresOnTimestamp: expiresOn,
        })
        .mockResolvedValueOnce({
          token: 'new-token',
          expiresOnTimestamp: Date.now() + 3600 * 1000,
        });
      
      const provider = new AzureCliTokenProvider();
      
      // First call
      const token1 = await provider.getToken();
      expect(token1).toBe('old-token');
      
      // Second call - should refresh because expires soon
      const token2 = await provider.getToken();
      expect(token2).toBe('new-token');
      
      expect(mockCredential.getToken).toHaveBeenCalledTimes(2);
    });
    
    it('should not cache expired token', async () => {
      // Token already expired
      const expiresOn = Date.now() - 1000;
      mockCredential.getToken
        .mockResolvedValueOnce({
          token: 'expired-token',
          expiresOnTimestamp: expiresOn,
        })
        .mockResolvedValueOnce({
          token: 'new-token',
          expiresOnTimestamp: Date.now() + 3600 * 1000,
        });
      
      const provider = new AzureCliTokenProvider();
      
      // First call
      const token1 = await provider.getToken();
      expect(token1).toBe('expired-token');
      
      // Second call - should acquire new token
      const token2 = await provider.getToken();
      expect(token2).toBe('new-token');
      
      expect(mockCredential.getToken).toHaveBeenCalledTimes(2);
    });
    
    it('should support custom tenant ID', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      mockCredential.getToken.mockResolvedValueOnce({
        token: 'test-token',
        expiresOnTimestamp: expiresOn,
      });
      
      const provider = new AzureCliTokenProvider('custom-tenant-id');
      await provider.getToken();
      
      expect(AzureCliCredential).toHaveBeenCalledWith({ tenantId: 'custom-tenant-id' });
    });
    
    it('should support custom scopes', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      mockCredential.getToken.mockResolvedValueOnce({
        token: 'test-token',
        expiresOnTimestamp: expiresOn,
      });
      
      const customScopes = ['custom-scope/.default'];
      const provider = new AzureCliTokenProvider(undefined, customScopes);
      await provider.getToken();
      
      expect(mockCredential.getToken).toHaveBeenCalledWith(customScopes);
    });
  });
  
  describe('Error handling', () => {
    it('should provide actionable error for not logged in', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Please run az login to setup account.')
      );
      
      const provider = new AzureCliTokenProvider();
      
      try {
        await provider.getToken();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Azure CLI authentication required');
        expect(error.message).toContain('az login');
        expect(error.metadata.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(error.metadata.code).toBe(ErrorCode.AUTH_NOT_LOGGED_IN);
      }
    });
    
    it('should provide actionable error for expired token', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Token has expired')
      );
      
      const provider = new AzureCliTokenProvider();
      
      try {
        await provider.getToken();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('token has expired');
        expect(error.message).toContain('az login');
        expect(error.metadata.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(error.metadata.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
      }
    });
    
    it('should provide actionable error for Azure CLI not installed', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Command not found: az')
      );
      
      const provider = new AzureCliTokenProvider();
      
      try {
        await provider.getToken();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Azure CLI is not installed');
        expect(error.message).toContain('Install Azure CLI');
        expect(error.metadata.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(error.metadata.code).toBe(ErrorCode.AUTH_CLI_NOT_AVAILABLE);
      }
    });
    
    it('should provide actionable error for permission issues', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Insufficient permissions')
      );
      
      const provider = new AzureCliTokenProvider();
      
      try {
        await provider.getToken();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Insufficient permissions');
        expect(error.message).toContain('necessary permissions');
        expect(error.metadata.category).toBe(ErrorCategory.AUTHENTICATION);
        expect(error.metadata.code).toBe(ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS);
      }
    });
    
    it('should provide actionable error for network issues', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Connection timeout')
      );
      
      const provider = new AzureCliTokenProvider();
      
      try {
        await provider.getToken();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Network error');
        expect(error.message).toContain('retry attempts');
        expect(error.metadata.category).toBe(ErrorCategory.NETWORK);
        expect(error.metadata.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      }
    });
    
    it('should handle null token from credential', async () => {
      mockCredential.getToken.mockResolvedValue(null as any);
      
      const provider = new AzureCliTokenProvider();
      
      await expect(provider.getToken()).rejects.toThrow('null token');
    });
  });
  
  describe('Retry logic', () => {
    it('should retry on transient network errors', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      
      mockCredential.getToken
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          token: 'test-token',
          expiresOnTimestamp: expiresOn,
        });
      
      const provider = new AzureCliTokenProvider();
      const token = await provider.getToken();
      
      expect(token).toBe('test-token');
      expect(mockCredential.getToken).toHaveBeenCalledTimes(3);
    });
    
    it('should not retry on non-retryable auth errors', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Please run az login')
      );
      
      const provider = new AzureCliTokenProvider();
      
      await expect(provider.getToken()).rejects.toThrow('Azure CLI authentication required');
      
      // Should only try once for non-retryable error
      expect(mockCredential.getToken).toHaveBeenCalledTimes(1);
    });
    
    it('should exhaust retries on persistent transient errors', async () => {
      mockCredential.getToken.mockRejectedValue(
        new Error('Connection timeout')
      );
      
      const provider = new AzureCliTokenProvider();
      
      await expect(provider.getToken()).rejects.toThrow('Network error');
      
      // Should retry 3 times
      expect(mockCredential.getToken).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('Cache management', () => {
    it('should clear cache manually', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      mockCredential.getToken.mockResolvedValue({
        token: 'test-token',
        expiresOnTimestamp: expiresOn,
      });
      
      const provider = new AzureCliTokenProvider();
      
      // First call
      await provider.getToken();
      expect(mockCredential.getToken).toHaveBeenCalledTimes(1);
      
      // Clear cache
      provider.clearCache();
      
      // Next call should acquire new token
      await provider.getToken();
      expect(mockCredential.getToken).toHaveBeenCalledTimes(2);
    });
    
    it('should return token info when cached', async () => {
      const expiresOn = Date.now() + 3600 * 1000;
      mockCredential.getToken.mockResolvedValue({
        token: 'test-token',
        expiresOnTimestamp: expiresOn,
      });
      
      const provider = new AzureCliTokenProvider();
      
      // Before acquiring token
      expect(provider.getTokenInfo()).toBeNull();
      
      // After acquiring token
      await provider.getToken();
      const info = provider.getTokenInfo();
      
      expect(info).not.toBeNull();
      expect(info?.isCached).toBe(true);
      expect(info?.expiresIn).toBeGreaterThan(3500);
    });
  });
});
