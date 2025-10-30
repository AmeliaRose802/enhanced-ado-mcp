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
    // Mock paths module first to avoid import.meta issues
    '^.*\\/utils\\/paths\\.js$': '<rootDir>/test/mocks/paths.mock.ts',
    // Mock the .mjs file that Jest can't parse
    '^.*\\/utils\\/module-dir\\.mjs$': '<rootDir>/test/mocks/paths.mock.ts',
    // Mock marked library to avoid ES module issues
    '^marked$': '<rootDir>/test/mocks/marked.mock.ts',
    // Then handle .js extensions
    '^(\\.\\.?\\/.+)\\.js$': '$1'
  },
  
  // Transform ES modules from node_modules (e.g., marked)
  transformIgnorePatterns: [
    'node_modules/(?!(marked)/)'
  ],
  
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
    // Integration tests that require real ADO credentials
    'work-item-rest-api.test.ts',
    'configuration-discovery.test.ts',
    'hierarchy-validator-integration.test.ts',
    'ai-assignment-integration.test.ts',
    // Tests with import.meta issues (Jest limitation with ES modules)
    'ai-assignment-analyzer.test.ts',
    'sampling-feature.test.ts',
    'wiql-full-packages.test.ts',
    'wiql-missing-fields-filter.test.ts',
    'wiql-query.test.ts'
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
