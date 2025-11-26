/**
 * Jest Setup File
 * 
 * Global test configuration and utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MCP_DEBUG = '0'; // Disable debug logging in tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise (optional)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress expected error messages in tests
  console.error = jest.fn((...args) => {
    // Only suppress specific expected errors
    const message = args[0]?.toString() || '';
    if (
      message.includes('Expected error') ||
      message.includes('Test error')
    ) {
      return;
    }
    originalConsoleError(...args);
  });
  
  console.warn = jest.fn((...args) => {
    // Suppress warnings in tests
    const message = args[0]?.toString() || '';
    if (message.includes('Warning:')) {
      return;
    }
    originalConsoleWarn(...args);
  });
});

afterAll(async () => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Clean up any global services to prevent worker process hanging
  try {
    const { queryHandleService } = await import('../src/services/query-handle-service.js');
    queryHandleService.stopCleanup();
  } catch (error) {
    // Ignore if queryHandleService is not available
  }
});

// Global test utilities
(global as any).testUtils = {
  // Wait for async operations
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate test data
  generateMockWorkItem: (overrides = {}) => ({
    id: 12345,
    title: 'Test Work Item',
    type: 'Task',
    state: 'New',
    url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/12345',
    ...overrides
  }),
  
  // Mock Azure CLI responses
  mockAzCliSuccess: (data: any) => JSON.stringify(data),
  mockAzCliError: (message: string) => {
    throw new Error(message);
  }
};

// Add custom matchers if needed
expect.extend({
  toBeValidWorkItem(received: any) {
    const pass = 
      typeof received === 'object' &&
      typeof received.id === 'number' &&
      typeof received.title === 'string' &&
      typeof received.type === 'string';
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid work item`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid work item with id, title, and type`,
        pass: false
      };
    }
  }
});

// Type definitions for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidWorkItem(): R;
    }
  }
  
  namespace NodeJS {
    interface Global {
      testUtils: {
        sleep: (ms: number) => Promise<void>;
        generateMockWorkItem: (overrides?: any) => any;
        mockAzCliSuccess: (data: any) => string;
        mockAzCliError: (message: string) => never;
      };
    }
  }
}

export {};
