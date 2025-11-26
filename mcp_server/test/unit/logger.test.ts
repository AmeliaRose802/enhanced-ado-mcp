/**
 * Logger utility tests
 */

import { Logger } from '../../src/utils/logger';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('Logger', () => {
  let logger: Logger;
  const testLogFile = join(__dirname, 'test-logger.log');

  beforeEach(() => {
    // Clean up any existing test log file
    if (existsSync(testLogFile)) {
      unlinkSync(testLogFile);
    }
  });

  afterEach(() => {
    // Clean up test log file
    if (existsSync(testLogFile)) {
      unlinkSync(testLogFile);
    }
  });

  describe('Basic logging', () => {
    beforeEach(() => {
      logger = new Logger();
    });

    it('should create logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should log messages without errors', () => {
      expect(() => {
        logger.info('Test info message');
        logger.warn('Test warning message');
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should support context metadata', () => {
      expect(() => {
        logger.info('Test with context', { userId: 123, action: 'test' });
        logger.error('Error with context', { errorCode: 'TEST_ERROR', stack: 'test stack' });
      }).not.toThrow();
    });

    it('should handle debug messages when MCP_DEBUG is not set', () => {
      const originalDebug = process.env.MCP_DEBUG;
      delete process.env.MCP_DEBUG;
      
      expect(() => {
        logger.debug('Debug message - should not throw');
      }).not.toThrow();
      
      if (originalDebug !== undefined) {
        process.env.MCP_DEBUG = originalDebug;
      }
    });

    it('should handle debug messages when MCP_DEBUG is set', () => {
      const originalDebug = process.env.MCP_DEBUG;
      process.env.MCP_DEBUG = '1';
      
      expect(() => {
        logger.debug('Debug message with MCP_DEBUG=1');
      }).not.toThrow();
      
      if (originalDebug !== undefined) {
        process.env.MCP_DEBUG = originalDebug;
      } else {
        delete process.env.MCP_DEBUG;
      }
    });
  });

  describe('MCP connection awareness', () => {
    beforeEach(() => {
      logger = new Logger();
    });

    it('should mark MCP as connected', () => {
      expect(() => {
        logger.markMCPConnected();
      }).not.toThrow();
    });

    it('should continue to accept log calls after MCP connected', () => {
      logger.markMCPConnected();
      
      expect(() => {
        logger.info('Info after MCP connected');
        logger.warn('Warning after MCP connected');
        logger.error('Error after MCP connected');
      }).not.toThrow();
    });
  });

  describe('File logging', () => {
    it('should support file logging when MCP_LOG_FILE is set', () => {
      const originalLogFile = process.env.MCP_LOG_FILE;
      process.env.MCP_LOG_FILE = testLogFile;
      
      logger = new Logger();
      logger.info('Test file logging');
      logger.warn('Test warning to file');
      logger.error('Test error to file', { errorCode: 'TEST' });
      
      // Verify log file was created (file logging initializes but we don't verify content)
      expect(logger.getLogFilePath()).toBe(testLogFile);
      
      if (originalLogFile !== undefined) {
        process.env.MCP_LOG_FILE = originalLogFile;
      } else {
        delete process.env.MCP_LOG_FILE;
      }
    });

    it('should handle missing log file gracefully', () => {
      const originalLogFile = process.env.MCP_LOG_FILE;
      process.env.MCP_LOG_FILE = '/invalid/path/that/does/not/exist/test.log';
      
      expect(() => {
        logger = new Logger();
        logger.info('Test with invalid log file path');
      }).not.toThrow();
      
      if (originalLogFile !== undefined) {
        process.env.MCP_LOG_FILE = originalLogFile;
      } else {
        delete process.env.MCP_LOG_FILE;
      }
    });
  });

  describe('Backward compatibility', () => {
    beforeEach(() => {
      logger = new Logger();
    });

    it('should work with existing single-argument calls', () => {
      expect(() => {
        logger.info('Simple message');
        logger.warn('Warning message');
        logger.error('Error message');
        logger.debug('Debug message');
      }).not.toThrow();
    });

    it('should work with context as optional second parameter', () => {
      expect(() => {
        logger.info('Message with context', { key: 'value' });
        logger.warn('Warning with context', { code: 123 });
        logger.error('Error with context', { stack: 'test' });
      }).not.toThrow();
    });
  });
});
