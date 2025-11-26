/**
 * Retry Utility Tests
 */

import { describe, it, expect, jest } from '@jest/globals';
import { withRetry, isTransientError, isRetryableAuthError } from '../../src/utils/retry.js';

describe('Retry Utility', () => {
  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const operation = jest.fn<() => Promise<string>>().mockResolvedValue('success');
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        operationName: 'test operation',
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
    
    it('should throw last error when all retries exhausted', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new Error('Persistent failure'));
      
      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });
    
    it('should respect isRetryable function', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValue(new Error('Not retryable'));
      
      const isRetryable = jest.fn<(error: Error) => boolean>().mockReturnValue(false);
      
      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
          isRetryable,
        })
      ).rejects.toThrow('Not retryable');
      
      // Should only be called once since isRetryable returned false
      expect(operation).toHaveBeenCalledTimes(1);
      expect(isRetryable).toHaveBeenCalledWith(expect.any(Error));
    });
    
    it('should use exponential backoff', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      
      await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });
      
      const elapsed = Date.now() - startTime;
      
      // Should wait ~100ms + ~200ms = ~300ms total
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThan(250);
      expect(elapsed).toBeLessThan(500);
    });
    
    it('should respect maxDelayMs', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      
      await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 150,
        backoffMultiplier: 3,
      });
      
      const elapsed = Date.now() - startTime;
      
      // Should wait 100ms + 150ms (capped) = 250ms total
      expect(elapsed).toBeGreaterThan(200);
      expect(elapsed).toBeLessThan(400);
    });
    
    it('should handle non-Error rejections', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValue('String error');
      
      await expect(
        withRetry(operation, {
          maxAttempts: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('String error');
    });
  });
  
  describe('isTransientError', () => {
    it('should identify timeout errors as transient', () => {
      expect(isTransientError(new Error('Request timeout'))).toBe(true);
      expect(isTransientError(new Error('Connection timeout'))).toBe(true);
    });
    
    it('should identify connection errors as transient', () => {
      expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
      expect(isTransientError(new Error('ENOTFOUND'))).toBe(true);
      expect(isTransientError(new Error('socket hang up'))).toBe(true);
    });
    
    it('should identify rate limit errors as transient', () => {
      expect(isTransientError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isTransientError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    });
    
    it('should identify service unavailable errors as transient', () => {
      expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientError(new Error('service unavailable'))).toBe(true);
    });
    
    it('should identify gateway errors as transient', () => {
      expect(isTransientError(new Error('502 Bad Gateway'))).toBe(true);
      expect(isTransientError(new Error('504 Gateway Timeout'))).toBe(true);
    });
    
    it('should not identify auth errors as transient', () => {
      expect(isTransientError(new Error('Not logged in'))).toBe(false);
      expect(isTransientError(new Error('Invalid credentials'))).toBe(false);
      expect(isTransientError(new Error('Token expired'))).toBe(false);
    });
    
    it('should not identify validation errors as transient', () => {
      expect(isTransientError(new Error('Invalid input'))).toBe(false);
      expect(isTransientError(new Error('Validation failed'))).toBe(false);
    });
  });
  
  describe('isRetryableAuthError', () => {
    it('should identify token refresh failures as retryable', () => {
      expect(isRetryableAuthError(new Error('Token refresh failed'))).toBe(true);
      expect(isRetryableAuthError(new Error('Failed to refresh token'))).toBe(true);
    });
    
    it('should identify network errors during auth as retryable', () => {
      expect(isRetryableAuthError(new Error('timeout during authentication'))).toBe(true);
      expect(isRetryableAuthError(new Error('ECONNREFUSED while getting token'))).toBe(true);
    });
    
    it('should not identify "not logged in" as retryable', () => {
      expect(isRetryableAuthError(new Error('Not logged in'))).toBe(false);
      expect(isRetryableAuthError(new Error('Please run az login'))).toBe(false);
    });
    
    it('should not identify expired token as retryable', () => {
      expect(isRetryableAuthError(new Error('Token expired'))).toBe(false);
      expect(isRetryableAuthError(new Error('Token has expired'))).toBe(false);
    });
    
    it('should not identify permission errors as retryable', () => {
      expect(isRetryableAuthError(new Error('Permission denied'))).toBe(false);
      expect(isRetryableAuthError(new Error('Insufficient permissions'))).toBe(false);
    });
  });
});
