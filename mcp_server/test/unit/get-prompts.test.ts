/**
 * Unit tests for wit-get-prompts tool schema and configuration
 */

import { describe, it, expect } from '@jest/globals';
import { getPromptsSchema } from '../../src/config/schemas.js';
import { toolConfigs } from '../../src/config/tool-configs.js';

describe('wit-get-prompts Tool Configuration', () => {
  describe('Schema Validation', () => {
    it('should validate correct input with all fields', () => {
      const validInput = {
        promptName: 'test-prompt',
        includeContent: true,
        args: { key: 'value' }
      };
      
      const result = getPromptsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.promptName).toBe('test-prompt');
        expect(result.data.includeContent).toBe(true);
        expect(result.data.args).toEqual({ key: 'value' });
      }
    });

    it('should validate input with only promptName', () => {
      const validInput = {
        promptName: 'test-prompt'
      };
      
      const result = getPromptsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.promptName).toBe('test-prompt');
        // includeContent should default to true
        expect(result.data.includeContent).toBe(true);
      }
    });

    it('should validate empty input (list all prompts)', () => {
      const validInput = {};
      
      const result = getPromptsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.promptName).toBeUndefined();
        expect(result.data.includeContent).toBe(true);
      }
    });

    it('should validate with includeContent false', () => {
      const validInput = {
        includeContent: false
      };
      
      const result = getPromptsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeContent).toBe(false);
      }
    });

    it('should validate with custom args', () => {
      const validInput = {
        promptName: 'query-generator',
        args: {
          user_intent: 'Find all bugs',
          project: 'MyProject',
          max_results: 50
        }
      };
      
      const result = getPromptsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.args).toBeDefined();
        expect(result.data.args?.user_intent).toBe('Find all bugs');
        expect(result.data.args?.max_results).toBe(50);
      }
    });

    it('should reject invalid includeContent type', () => {
      const invalidInput = {
        includeContent: 'true' // Should be boolean, not string
      };
      
      const result = getPromptsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid promptName type', () => {
      const invalidInput = {
        promptName: 12345 // Should be string, not number
      };
      
      const result = getPromptsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('Tool Configuration', () => {
    it('should be registered in tool configs', () => {
      const toolConfig = toolConfigs.find(t => t.name === 'wit-get-prompts');
      expect(toolConfig).toBeDefined();
      
      if (toolConfig) {
        expect(toolConfig.name).toBe('wit-get-prompts');
        expect(toolConfig.description).toContain('prompt');
        expect(toolConfig.schema).toBe(getPromptsSchema);
        expect(toolConfig.inputSchema).toBeDefined();
      }
    });

    it('should have correct input schema properties', () => {
      const toolConfig = toolConfigs.find(t => t.name === 'wit-get-prompts');
      
      if (toolConfig?.inputSchema && typeof toolConfig.inputSchema === 'object' && 'properties' in toolConfig.inputSchema) {
        const properties = toolConfig.inputSchema.properties as Record<string, any>;
        
        expect(properties.promptName).toBeDefined();
        expect(properties.promptName.type).toBe('string');
        
        expect(properties.includeContent).toBeDefined();
        expect(properties.includeContent.type).toBe('boolean');
        
        expect(properties.args).toBeDefined();
        expect(properties.args.type).toBe('object');
      }
    });

    it('should have no required parameters', () => {
      const toolConfig = toolConfigs.find(t => t.name === 'wit-get-prompts');
      
      if (toolConfig?.inputSchema && typeof toolConfig.inputSchema === 'object' && 'required' in toolConfig.inputSchema) {
        const required = toolConfig.inputSchema.required as string[];
        expect(required).toEqual([]);
      }
    });

    it('should not be marked as AI-powered tool', () => {
      // This tool doesn't require sampling/LLM capabilities
      const { isAIPoweredTool } = require('../../src/config/tool-configs.js');
      expect(isAIPoweredTool('wit-get-prompts')).toBe(false);
    });
  });

  describe('Use Case Examples', () => {
    it('should validate test scenario: list all prompts metadata', () => {
      const input = { includeContent: false };
      const result = getPromptsSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      // This would be used to quickly list available prompts without loading content
    });

    it('should validate test scenario: get specific prompt with custom variables', () => {
      const input = {
        promptName: 'backlog_cleanup',
        includeContent: true,
        args: {
          analysis_period_days: 30,
          area_path: 'MyProject\\Team'
        }
      };
      const result = getPromptsSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      // This would be used for testing with specific template variables
    });

    it('should validate test scenario: debugging prompt template', () => {
      const input = {
        promptName: 'ai-assignment-analyzer',
        includeContent: true,
        args: {
          work_item_id: 12345,
          work_item_type: 'Product Backlog Item'
        }
      };
      const result = getPromptsSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      // This would be used to see the exact prompt sent to LLM
    });
  });
});

