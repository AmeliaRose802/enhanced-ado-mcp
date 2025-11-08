/**
 * Unit tests for debug tools feature flag (get-prompts)
 */

import { updateConfigFromCLI, loadConfiguration } from '../../src/config/config.js';
import { getAvailableToolConfigs } from '../../src/config/tool-configs/index.js';
import { executeTool, setServerInstance } from '../../src/services/tool-service.js';
import type { CLIArguments } from '../../src/config/config.js';

describe('Debug Tools Feature Flag', () => {
  const originalEnv = process.env.MCP_ENABLE_DEBUG_TOOLS;
  
  beforeEach(() => {
    // Reset config before each test
    const mockArgs: CLIArguments = {
      organization: 'test-org',
      areaPaths: ['TestProject\\TestArea'],
      verbose: false,
    };
    updateConfigFromCLI(mockArgs);
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.MCP_ENABLE_DEBUG_TOOLS = originalEnv;
    } else {
      delete process.env.MCP_ENABLE_DEBUG_TOOLS;
    }
  });

  describe('Configuration', () => {
    it('should default enableDebugTools to false', () => {
      delete process.env.MCP_ENABLE_DEBUG_TOOLS;
      const config = loadConfiguration(true);
      expect(config.enableDebugTools).toBe(false);
    });

    it('should enable debug tools when MCP_ENABLE_DEBUG_TOOLS=1', () => {
      process.env.MCP_ENABLE_DEBUG_TOOLS = '1';
      const config = loadConfiguration(true);
      expect(config.enableDebugTools).toBe(true);
    });

    it('should not enable debug tools for other values', () => {
      process.env.MCP_ENABLE_DEBUG_TOOLS = 'true';
      const config = loadConfiguration(true);
      expect(config.enableDebugTools).toBe(false);
    });
  });

  describe('Tool Availability', () => {
    it('should exclude get-prompts when debug tools disabled', () => {
      delete process.env.MCP_ENABLE_DEBUG_TOOLS;
      loadConfiguration(true);
      
      const tools = getAvailableToolConfigs(true, false);
      const promptsTool = tools.find(t => t.name === 'get-prompts');
      
      expect(promptsTool).toBeUndefined();
    });

    it('should include get-prompts when debug tools enabled', () => {
      process.env.MCP_ENABLE_DEBUG_TOOLS = '1';
      const config = loadConfiguration(true);
      
      const tools = getAvailableToolConfigs(true, config.enableDebugTools);
      const promptsTool = tools.find(t => t.name === 'get-prompts');
      
      expect(promptsTool).toBeDefined();
      expect(promptsTool?.name).toBe('get-prompts');
    });

    it('should include get-prompts description with DEBUG ONLY marker', () => {
      const tools = getAvailableToolConfigs(true, true);
      const promptsTool = tools.find(t => t.name === 'get-prompts');
      
      expect(promptsTool?.description).toContain('[DEBUG ONLY]');
      expect(promptsTool?.description).toContain('MCP_ENABLE_DEBUG_TOOLS=1');
    });
  });

  describe('Runtime Enforcement', () => {
    beforeEach(() => {
      // Mock server instance for tool execution
      setServerInstance({
        createMessage: jest.fn().mockResolvedValue({
          role: 'assistant',
          content: { type: 'text', text: 'mock response' },
          model: 'test',
          stopReason: 'endTurn'
        })
      } as any);
    });

    it('should block get-prompts execution when debug tools disabled', async () => {
      delete process.env.MCP_ENABLE_DEBUG_TOOLS;
      loadConfiguration(true);
      
      const result = await executeTool('get-prompts', {});
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('get-prompts tool is only available in debug mode.');
      expect(result.errors).toContain('Set environment variable MCP_ENABLE_DEBUG_TOOLS=1 to enable debug tools.');
      expect(result.errors).toContain('This tool is disabled in production for security reasons.');
    });

    it('should allow get-prompts execution when debug tools enabled', async () => {
      process.env.MCP_ENABLE_DEBUG_TOOLS = '1';
      loadConfiguration(true);
      
      // This should not throw the disabled error
      // Note: Actual execution may fail due to mock setup, but should not be blocked by flag
      const result = await executeTool('get-prompts', {});
      
      // Should not have the debug tools disabled error
      const hasDisabledError = result.errors?.some(e => 
        e.includes('only available in debug mode')
      );
      expect(hasDisabledError).toBeFalsy();
    });
  });

  describe('Security', () => {
    it('should not enable debug tools by default in production-like config', () => {
      delete process.env.MCP_ENABLE_DEBUG_TOOLS;
      delete process.env.MCP_DEBUG;
      
      const mockArgs: CLIArguments = {
        organization: 'production-org',
        areaPaths: ['ProdProject\\ProdArea'],
        verbose: false,
      };
      updateConfigFromCLI(mockArgs);
      
      const config = loadConfiguration(true);
      expect(config.enableDebugTools).toBe(false);
    });

    it('should require explicit opt-in for debug tools', () => {
      // Even with verbose logging, debug tools should be off
      process.env.MCP_DEBUG = '1';
      delete process.env.MCP_ENABLE_DEBUG_TOOLS;
      
      const mockArgs: CLIArguments = {
        organization: 'test-org',
        areaPaths: ['TestProject\\TestArea'],
        verbose: true,
      };
      updateConfigFromCLI(mockArgs);
      
      const config = loadConfiguration(true);
      expect(config.verboseLogging).toBe(true);
      expect(config.enableDebugTools).toBe(false);
    });
  });
});
