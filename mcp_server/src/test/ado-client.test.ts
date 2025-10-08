/**
 * Tests for ADO Client Service
 * Validates retry logic, rate limiting, and error handling
 */

import { ADOClientService, createADOClient } from '../services/ado-client';
import { ADOHttpClient, ADOHttpError } from '../utils/ado-http-client';

// Mock the ADOHttpClient
jest.mock('../utils/ado-http-client', () => {
  const originalModule = jest.requireActual('../utils/ado-http-client');
  return {
    ...originalModule,
    ADOHttpClient: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    }))
  };
});

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ADOClientService', () => {
  let mockHttpClient: jest.Mocked<ADOHttpClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked constructor
    const MockedHttpClient = ADOHttpClient as jest.MockedClass<typeof ADOHttpClient>;
    // Create a new instance and get it
    const client = new ADOClientService({
      organization: 'test-org',
      project: 'test-project',
      enableRetry: true,
      enableRateLimit: false, // Disable for most tests
      enableDebugLogging: false
    });
    // Access the mocked instance
    mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
  });

  describe('Retry Logic', () => {
    it('should retry on network errors', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: true,
        enableRateLimit: false,
        retryConfig: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      // First call fails with network error, second succeeds
      mockHttpClient.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: { id: 123 },
          status: 200,
          statusText: 'OK',
          headers: {}
        });

      const result = await client.get('/test');
      
      expect(result.data).toEqual({ id: 123 });
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 server errors', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: true,
        enableRateLimit: false,
        retryConfig: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      // First call fails with 500, second succeeds
      mockHttpClient.get
        .mockRejectedValueOnce(new ADOHttpError('Server error', 500, 'Internal Server Error'))
        .mockResolvedValueOnce({
          data: { id: 123 },
          status: 200,
          statusText: 'OK',
          headers: {}
        });

      const result = await client.get('/test');
      
      expect(result.data).toEqual({ id: 123 });
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limit errors', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: true,
        enableRateLimit: false,
        retryConfig: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get
        .mockRejectedValueOnce(new ADOHttpError('Rate limit exceeded', 429, 'Too Many Requests'))
        .mockResolvedValueOnce({
          data: { id: 123 },
          status: 200,
          statusText: 'OK',
          headers: {}
        });

      const result = await client.get('/test');
      
      expect(result.data).toEqual({ id: 123 });
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 404 errors', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: true,
        enableRateLimit: false,
        retryConfig: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockRejectedValue(
        new ADOHttpError('Not found', 404, 'Not Found')
      );

      await expect(client.get('/test')).rejects.toThrow('Not found');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 errors', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: true,
        enableRateLimit: false,
        retryConfig: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockRejectedValue(
        new ADOHttpError('Unauthorized', 401, 'Unauthorized')
      );

      await expect(client.get('/test')).rejects.toThrow('Unauthorized');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should stop retrying after max retries', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: true,
        enableRateLimit: false,
        retryConfig: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockRejectedValue(
        new ADOHttpError('Server error', 500, 'Internal Server Error')
      );

      await expect(client.get('/test')).rejects.toThrow('Server error');
      // Initial attempt + 2 retries = 3 total calls
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);
    });

    it('should respect retry disabled flag', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: false
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockRejectedValue(
        new ADOHttpError('Server error', 500, 'Internal Server Error')
      );

      await expect(client.get('/test')).rejects.toThrow('Server error');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP Methods', () => {
    it('should support GET requests', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: false
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockResolvedValue({
        data: { id: 123 },
        status: 200,
        statusText: 'OK',
        headers: {}
      });

      const result = await client.get('/test');
      
      expect(result.data).toEqual({ id: 123 });
      expect(mockHttpClient.get).toHaveBeenCalledWith('/test', undefined);
    });

    it('should support POST requests', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: false
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.post.mockResolvedValue({
        data: { id: 123 },
        status: 201,
        statusText: 'Created',
        headers: {}
      });

      const body = { name: 'test' };
      const result = await client.post('/test', body);
      
      expect(result.data).toEqual({ id: 123 });
      expect(mockHttpClient.post).toHaveBeenCalledWith('/test', body, undefined);
    });

    it('should support PATCH requests', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: false
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.patch.mockResolvedValue({
        data: { id: 123 },
        status: 200,
        statusText: 'OK',
        headers: {}
      });

      const body = { name: 'updated' };
      const result = await client.patch('/test', body);
      
      expect(result.data).toEqual({ id: 123 });
      expect(mockHttpClient.patch).toHaveBeenCalledWith('/test', body, undefined);
    });

    it('should support DELETE requests', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: false
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.delete.mockResolvedValue({
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {}
      });

      const result = await client.delete('/test');
      
      expect(result.status).toBe(204);
      expect(mockHttpClient.delete).toHaveBeenCalledWith('/test', undefined);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: true,
        rateLimitConfig: { maxRequests: 5, windowMs: 1000 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockResolvedValue({
        data: { id: 123 },
        status: 200,
        statusText: 'OK',
        headers: {}
      });

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        await client.get('/test');
      }
      
      expect(mockHttpClient.get).toHaveBeenCalledTimes(5);
    });

    it('should throttle requests exceeding rate limit', async () => {
      const client = new ADOClientService({
        organization: 'test-org',
        enableRetry: false,
        enableRateLimit: true,
        rateLimitConfig: { maxRequests: 2, windowMs: 100 }
      });
      
      const mockHttpClient = (client as any).httpClient as jest.Mocked<ADOHttpClient>;
      
      mockHttpClient.get.mockResolvedValue({
        data: { id: 123 },
        status: 200,
        statusText: 'OK',
        headers: {}
      });

      const startTime = Date.now();
      
      // Make 3 requests (1 over limit)
      await Promise.all([
        client.get('/test1'),
        client.get('/test2'),
        client.get('/test3')
      ]);
      
      const duration = Date.now() - startTime;
      
      // Third request should have been delayed
      expect(duration).toBeGreaterThanOrEqual(80); // Allow some margin
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('Factory Function', () => {
    it('should create client with createADOClient', () => {
      const client = createADOClient({
        organization: 'test-org',
        project: 'test-project'
      });
      
      expect(client).toBeInstanceOf(ADOClientService);
    });
  });
});
