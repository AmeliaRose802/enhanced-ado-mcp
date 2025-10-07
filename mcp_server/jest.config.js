/** @type {import('jest').Config} */
export default {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Test environment
  testEnvironment: 'node',
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json'
      }
    ]
  },
  
  // Module name mapper to handle .js extensions in imports
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.js$': '$1'
  },
  
  // Test match patterns
  testMatch: [
    '**/test/**/*.test.ts',
    '**/test/**/*.spec.ts',
    '**/__tests__/**/*.ts'
  ],
  
  // Ignore patterns - exclude integration tests that require ADO credentials
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'work-item-rest-api.test.ts',
    'wiql-query.test.ts',
    'configuration-discovery.test.ts',
    'sampling-feature.test.ts',
    'hierarchy-validator-integration.test.ts',
    'ai-assignment-integration.test.ts',
    'ai-assignment-analyzer.test.ts',
    'wiql-full-packages.test.ts',
    'wiql-missing-fields-filter.test.ts'
  ],
  
  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  
  // Timeout for tests
  testTimeout: 30000, // 30 seconds for integration tests
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Error on deprecated APIs
  errorOnDeprecated: true,
  
  // Max workers for parallel execution
  maxWorkers: '50%'
};
