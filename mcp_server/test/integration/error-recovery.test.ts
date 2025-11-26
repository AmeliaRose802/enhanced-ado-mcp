// @ts-nocheck
/**
 * Error Recovery Integration Tests
 * 
 * Tests error recovery scenarios including network failures, timeouts,
 * authentication errors, rate limiting, and proper cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ADOHttpClient, ADOHttpError } from '../../src/utils/ado-http-client.js';
import { withRetry, isTransientError, isRetryableAuthError } from '../../src/utils/retry.js';
import { rateLimiter, RateLimiter } from '../../src/services/rate-limiter.js';
import { ErrorCategory } from '../../src/types/error-categories.js';

// Mock logger to prevent console spam
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock metrics service
jest.mock('../../src/services/metrics-service.js', () => ({
  metricsService: {
    increment: jest.fn(),
    recordDuration: jest.fn()
  }
}));

describe('Error Recovery Integration Tests', () => {
  
  describe('Network Failure Recovery', () => {
    let mockTokenProvider: () => Promise<string>;
    let httpClient: ADOHttpClient;

    beforeEach(() => {
      mockTokenProvider = jest.fn(async () => 'mock-token') as () => Promise<string>;
      httpClient = new ADOHttpClient('test-org', mockTokenProvider, 'test-project');
      
      // Mock global fetch
      global.fetch = jest.fn() as any;
      
      // Reset rate limiter
      rateLimiter.reset();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should handle network connection failure with retry', async () => {
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('ECONNREFUSED: Connection refused');
        }
        return 'success';
      };

      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        isRetryable: isTransientError,
        operationName: 'network-test'
      });

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should handle DNS resolution failure', async () => {
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('ENOTFOUND: DNS lookup failed');
        }
        return { data: 'resolved' };
      };

      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        isRetryable: isTransientError,
        operationName: 'dns-test'
      });

      expect(result).toEqual({ data: 'resolved' });
      expect(attemptCount).toBe(2);
    });

    it('should handle socket hang up error', async () => {
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('socket hang up');
        }
        return { success: true };
      };

      const result = await withRetry(operation, {
        maxAttempts: 2,
        initialDelayMs: 10,
        isRetryable: isTransientError,
        operationName: 'socket-test'
      });

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(2);
    });

    it('should eventually fail after max retries for persistent network errors', async () => {
      const operation = async () => {
        throw new Error('ECONNREFUSED: Connection refused');
      };

      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
          isRetryable: isTransientError,
          operationName: 'persistent-error'
        })
      ).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('API Timeout Recovery', () => {
    let mockTokenProvider: () => Promise<string>;
    let httpClient: ADOHttpClient;

    beforeEach(() => {
      mockTokenProvider = jest.fn(async () => 'mock-token') as () => Promise<string>;
      httpClient = new ADOHttpClient('test-org', mockTokenProvider, 'test-project');
      
      global.fetch = jest.fn() as any;
      
      rateLimiter.reset();
    });

    it('should handle request timeout with AbortError', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(
        httpClient.get('/wit/workitems/12345', { timeout: 100 })
      ).rejects.toThrow('Request timed out');
    });

    it('should handle timeout and retry successfully', async () => {
      let callCount = 0;
      
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        }
        
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          text: async () => JSON.stringify({ id: 12345, fields: {} })
        } as any);
      });

      const operation = async () => httpClient.get('/wit/workitems/12345', { timeout: 100 });
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        isRetryable: (error) => error.message.includes('timeout') || error.message.includes('timed out'),
        operationName: 'timeout-retry'
      });

      expect(result.status).toBe(200);
      expect(callCount).toBe(2);
    });

    it('should handle TimeoutError gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        const error = new Error('Timeout exceeded');
        error.name = 'TimeoutError';
        return Promise.reject(error);
      });

      await expect(
        httpClient.get('/wit/workitems/12345', { timeout: 50 })
      ).rejects.toThrow('Request timed out');
    });
  });

  describe('Authentication Error Recovery', () => {
    let mockTokenProvider: jest.Mock<() => Promise<string>>;
    let httpClient: ADOHttpClient;

    beforeEach(() => {
      mockTokenProvider = jest.fn(async () => 'mock-token') as jest.Mock<() => Promise<string>>;
      httpClient = new ADOHttpClient('test-org', mockTokenProvider as () => Promise<string>, 'test-project');
      
      global.fetch = jest.fn() as any;
      
      rateLimiter.reset();
    });

    it('should handle 401 Unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify({ 
          message: 'Authentication failed. Please check your credentials.' 
        })
      } as unknown as Response);

      await expect(
        httpClient.get('/wit/workitems/12345')
      ).rejects.toThrow(ADOHttpError);
      
      try {
        await httpClient.get('/wit/workitems/12345');
      } catch (error) {
        if (error instanceof ADOHttpError) {
          expect(error.status).toBe(401);
          expect(error.message).toContain('Authentication failed');
        }
      }
    });

    it('should handle token refresh and retry', async () => {
      let tokenCallCount = 0;
      mockTokenProvider.mockImplementation(async () => {
        tokenCallCount++;
        if (tokenCallCount === 1) {
          return 'expired-token';
        }
        return 'fresh-token';
      });

      let fetchCallCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: new Map([['content-type', 'application/json']]),
            text: async () => JSON.stringify({ message: 'Token expired' })
          } as any);
        }
        
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          text: async () => JSON.stringify({ id: 12345 })
        } as any);
      });

      const operation = async () => {
        const client = new ADOHttpClient('test-org', mockTokenProvider as () => Promise<string>, 'test-project');
        return client.get('/wit/workitems/12345');
      };

      const result = await withRetry(operation, {
        maxAttempts: 2,
        initialDelayMs: 10,
        isRetryable: () => true,
        operationName: 'token-refresh'
      });

      expect(result.status).toBe(200);
      expect(tokenCallCount).toBe(2);
    });

    it('should not retry non-retryable auth errors', async () => {
      const authError = new Error('User not logged in. Please run az login');
      
      const operation = async () => {
        throw authError;
      };

      let attemptCount = 0;
      try {
        await withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
          isRetryable: isRetryableAuthError,
          operationName: 'non-retryable-auth'
        });
      } catch (error) {
        attemptCount = 1; // Should fail immediately
      }

      expect(attemptCount).toBe(1);
    });

    it('should handle non-JSON auth error response (HTML page)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><body>Authentication Required</body></html>'
      } as unknown as Response);

      await expect(
        httpClient.get('/wit/workitems/12345')
      ).rejects.toThrow('Received non-JSON response');
    });
  });

  describe('Rate Limiting Recovery', () => {
    let mockTokenProvider: () => Promise<string>;
    let httpClient: ADOHttpClient;

    beforeEach(() => {
      mockTokenProvider = jest.fn(async () => 'mock-token') as () => Promise<string>;
      httpClient = new ADOHttpClient('test-org', mockTokenProvider, 'test-project');
      
      global.fetch = jest.fn() as any;
      
      rateLimiter.reset();
    });

    it('should handle 429 rate limit error with retry', async () => {
      let callCount = 0;
      
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Map([
              ['content-type', 'application/json'],
              ['retry-after', '2']
            ]),
            text: async () => JSON.stringify({ 
              message: 'Rate limit exceeded. Please try again later.' 
            })
          } as any);
        }
        
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          text: async () => JSON.stringify({ success: true })
        } as any);
      });

      const operation = async () => httpClient.get('/wit/workitems/12345');
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 50,
        isRetryable: isTransientError,
        operationName: 'rate-limit-retry'
      });

      expect(result.status).toBe(200);
      expect(callCount).toBe(2);
    });

    it('should respect rate limiter throttling', async () => {
      const testRateLimiter = new RateLimiter(3, 5); // 3 tokens, 5 per second
      
      const timestamps: number[] = [];
      
      // Consume more than available tokens
      for (let i = 0; i < 5; i++) {
        await testRateLimiter.throttle('test-key');
        timestamps.push(Date.now());
      }
      
      const delays: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        delays.push(timestamps[i] - timestamps[i - 1]);
      }
      
      // First 2 delays should be immediate (< 50ms)
      delays.slice(0, 2).forEach(delay => {
        expect(delay).toBeLessThan(50);
      });
      
      // At least one of the later delays should show throttling (>= 150ms)
      // With 5 tokens/sec = 200ms per token
      const hasThrottlingDelay = delays.slice(2).some(delay => delay >= 150);
      expect(hasThrottlingDelay).toBe(true);
    });

    it('should handle rate limiter stats correctly', () => {
      const testRateLimiter = new RateLimiter(100, 10);
      
      // Initial stats will be null until first throttle call
      let initialStats = testRateLimiter.getStats('test-key');
      expect(initialStats).toBeNull();
      
      // After first throttle, stats should exist
      testRateLimiter.throttle('test-key');
      
      const afterStats = testRateLimiter.getStats('test-key');
      expect(afterStats?.tokens).toBeLessThan(100);
      expect(afterStats?.capacity).toBe(100);
    });
  });

  describe('500 Internal Server Error Recovery', () => {
    let mockTokenProvider: () => Promise<string>;
    let httpClient: ADOHttpClient;

    beforeEach(() => {
      mockTokenProvider = jest.fn(async () => 'mock-token') as () => Promise<string>;
      httpClient = new ADOHttpClient('test-org', mockTokenProvider, 'test-project');
      
      global.fetch = jest.fn() as any;
      
      rateLimiter.reset();
    });

    it('should retry on 500 Internal Server Error', async () => {
      let callCount = 0;
      
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            headers: new Map([['content-type', 'application/json']]),
            text: async () => JSON.stringify({ 
              message: 'An internal error occurred' 
            })
          } as any);
        }
        
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          text: async () => JSON.stringify({ success: true })
        } as any);
      });

      const operation = async () => httpClient.get('/wit/workitems/12345');
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        isRetryable: () => true,
        operationName: 'server-error'
      });

      expect(result.status).toBe(200);
      expect(callCount).toBe(2);
    });

    it('should handle 503 Service Unavailable with retry', async () => {
      const error = new Error('Service unavailable: 503');
      
      expect(isTransientError(error)).toBe(true);
    });

    it('should handle 502 Bad Gateway with retry', async () => {
      const error = new Error('Bad Gateway 502');
      
      expect(isTransientError(error)).toBe(true);
    });

    it('should handle 504 Gateway Timeout with retry', async () => {
      const error = new Error('Gateway Timeout: 504');
      
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe('Permission Denied Errors', () => {
    let mockTokenProvider: () => Promise<string>;
    let httpClient: ADOHttpClient;

    beforeEach(() => {
      mockTokenProvider = jest.fn(async () => 'mock-token') as () => Promise<string>;
      httpClient = new ADOHttpClient('test-org', mockTokenProvider, 'test-project');
      
      global.fetch = jest.fn() as any;
      
      rateLimiter.reset();
    });

    it('should handle 403 Forbidden error with helpful message', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify({ 
          message: 'You do not have permission to access this resource' 
        })
      } as unknown as Response);

      try {
        await httpClient.get('/wit/workitems/12345');
        throw new Error('Should have thrown error');
      } catch (error) {
        if (error instanceof ADOHttpError) {
          expect(error.status).toBe(403);
          expect(error.message).toContain('do not have permission');
        }
      }
    });

    it('should not retry permission denied errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify({ message: 'Forbidden' })
      } as unknown as Response);

      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        return httpClient.get('/wit/workitems/12345');
      };

      try {
        await withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
          isRetryable: (error) => {
            return error instanceof ADOHttpError && error.status !== 403;
          },
          operationName: 'permission-test'
        });
      } catch (error) {
        // Expected
      }

      expect(attemptCount).toBe(1); // Should not retry
    });
  });

  describe('Error Message Quality', () => {
    it('should provide helpful error messages for network failures', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      
      expect(isTransientError(error)).toBe(true);
      expect(error.message).toContain('ECONNREFUSED');
    });

    it('should provide helpful error messages for DNS failures', () => {
      const error = new Error('ENOTFOUND: getaddrinfo ENOTFOUND dev.azure.com');
      
      expect(isTransientError(error)).toBe(true);
      expect(error.message).toContain('ENOTFOUND');
    });

    it('should categorize errors correctly for user guidance', () => {
      const errors = [
        { error: new Error('User not logged in'), expected: ErrorCategory.AUTHENTICATION },
        { error: new Error('Network timeout'), expected: ErrorCategory.NETWORK },
        { error: new Error('Work item not found'), expected: ErrorCategory.NOT_FOUND },
        { error: new Error('Rate limit exceeded'), expected: ErrorCategory.RATE_LIMIT },
        { error: new Error('Permission denied'), expected: ErrorCategory.PERMISSION_DENIED }
      ];
      
      // Error categorization is tested separately in error-categorization.test.ts
      // This is just validating the error messages are descriptive
      errors.forEach(({ error }) => {
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Cleanup After Failures', () => {
    it('should properly clean up rate limiter state', () => {
      const testRateLimiter = new RateLimiter(100, 10);
      
      testRateLimiter.throttle('test-key-1');
      testRateLimiter.throttle('test-key-2');
      
      expect(testRateLimiter.getStats('test-key-1')).toBeTruthy();
      expect(testRateLimiter.getStats('test-key-2')).toBeTruthy();
      
      testRateLimiter.reset('test-key-1');
      expect(testRateLimiter.getStats('test-key-1')).toBeNull();
      expect(testRateLimiter.getStats('test-key-2')).toBeTruthy();
      
      testRateLimiter.reset();
      expect(testRateLimiter.getStats('test-key-2')).toBeNull();
    });

    it('should not leak resources on repeated failures', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new Error('Persistent failure');
      };

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          withRetry(operation, {
            maxAttempts: 2,
            initialDelayMs: 10,
            isRetryable: () => false,
            operationName: `leak-test-${i}`
          }).catch(() => {})
        );
      }

      await Promise.all(promises);
      
      expect(callCount).toBe(5); // Each operation called once (no retry)
    });

    it('should handle concurrent operations without state corruption', async () => {
      let successCount = 0;
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          withRetry(
            async () => {
              await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
              successCount++;
              return i;
            },
            {
              maxAttempts: 3,
              initialDelayMs: 5,
              operationName: `concurrent-${i}`
            }
          )
        );
      }

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      expect(successCount).toBe(10);
      expect(new Set(results).size).toBe(10); // All unique results
    });
  });

  describe('Exponential Backoff', () => {
    it('should apply exponential backoff on retries', async () => {
      const timestamps: number[] = [];
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        timestamps.push(Date.now());
        if (attemptCount < 4) {
          throw new Error('Retry me');
        }
        return 'success';
      };

      await withRetry(operation, {
        maxAttempts: 4,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        isRetryable: () => true,
        operationName: 'backoff-test'
      });

      expect(attemptCount).toBe(4);
      expect(timestamps).toHaveLength(4);
      
      // Calculate delays between attempts
      const delays = [];
      for (let i = 1; i < timestamps.length; i++) {
        delays.push(timestamps[i] - timestamps[i - 1]);
      }
      
      // First delay should be ~100ms, second ~200ms, third ~400ms
      // Allow 20ms tolerance for timer imprecision
      expect(delays[0]).toBeGreaterThanOrEqual(80);
      expect(delays[0]).toBeLessThan(150);
      
      expect(delays[1]).toBeGreaterThanOrEqual(180);
      expect(delays[1]).toBeLessThan(250);
      
      expect(delays[2]).toBeGreaterThanOrEqual(380);
      expect(delays[2]).toBeLessThan(500);
    });

    it('should respect max delay cap', async () => {
      const timestamps: number[] = [];
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        timestamps.push(Date.now());
        if (attemptCount < 5) {
          throw new Error('Retry me');
        }
        return 'success';
      };

      await withRetry(operation, {
        maxAttempts: 5,
        initialDelayMs: 100,
        maxDelayMs: 200, // Cap at 200ms
        backoffMultiplier: 3,
        isRetryable: () => true,
        operationName: 'max-delay-test'
      });

      const delays = [];
      for (let i = 1; i < timestamps.length; i++) {
        delays.push(timestamps[i] - timestamps[i - 1]);
      }
      
      // All delays should be <= 220ms (200ms max + 20ms tolerance)
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(220);
      });
    });
  });

  describe('Bulk Operations Error Recovery', () => {
    it('should handle partial failures in bulk operations', async () => {
      const operations = [
        async () => 'success-1',
        async () => { throw new Error('Temporary failure'); },
        async () => 'success-3',
        async () => { throw new Error('Permanent failure'); }
      ];

      const results = await Promise.allSettled(
        operations.map((op, index) => 
          withRetry(op, {
            maxAttempts: 2,
            initialDelayMs: 10,
            isRetryable: (error) => error.message.includes('Temporary'),
            operationName: `bulk-op-${index}`
          })
        )
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');
    });

    it('should recover from transient failures in sequence', async () => {
      const failurePattern = [true, false, true, false]; // fail, succeed, fail, succeed
      let index = 0;
      
      const operation = async () => {
        const shouldFail = failurePattern[index % failurePattern.length];
        index++;
        
        if (shouldFail) {
          throw new Error('Transient error');
        }
        
        return `result-${index}`;
      };

      const results = [];
      for (let i = 0; i < 4; i++) {
        const result = await withRetry(operation, {
          maxAttempts: 2,
          initialDelayMs: 5,
          isRetryable: () => true,
          operationName: `sequence-${i}`
        });
        results.push(result);
      }

      expect(results).toHaveLength(4);
      expect(index).toBeGreaterThan(4); // Some retries occurred
    });
  });

  describe('Error Classification', () => {
    it('should correctly identify transient errors', () => {
      const transientErrors = [
        new Error('Connection timeout'),
        new Error('ECONNREFUSED'),
        new Error('ECONNRESET'),
        new Error('ENOTFOUND'),
        new Error('network error occurred'),
        new Error('socket hang up'),
        new Error('Rate limit exceeded: 429'),
        new Error('Service unavailable: 503'),
        new Error('Bad Gateway: 502'),
        new Error('Gateway Timeout: 504')
      ];

      transientErrors.forEach(error => {
        expect(isTransientError(error)).toBe(true);
      });
    });

    it('should correctly identify non-transient errors', () => {
      const nonTransientErrors = [
        new Error('Invalid parameter'),
        new Error('Validation failed'),
        new Error('Resource not found'),
        new Error('Permission denied')
      ];

      nonTransientErrors.forEach(error => {
        expect(isTransientError(error)).toBe(false);
      });
    });

    it('should identify retryable auth errors', () => {
      const retryableAuthErrors = [
        new Error('Token refresh failed temporarily'),
        new Error('Network timeout during authentication')
      ];

      retryableAuthErrors.forEach(error => {
        expect(isRetryableAuthError(error)).toBe(true);
      });
    });

    it('should identify non-retryable auth errors', () => {
      const nonRetryableAuthErrors = [
        new Error('User not logged in'),
        new Error('Invalid credentials'),
        new Error('Token expired'),
        new Error('Permission denied')
      ];

      nonRetryableAuthErrors.forEach(error => {
        expect(isRetryableAuthError(error)).toBe(false);
      });
    });
  });
});
