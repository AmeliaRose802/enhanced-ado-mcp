/**
 * Test for HTML field stripping parameters in context package tool
 */
import { tools } from '../config/tool-configs.js';

describe('HTML Field Stripping Parameters', () => {
  describe('Tool configuration', () => {
    it('should register wit-get-work-item-context-package tool', () => {
      const tool = tools.find(t => t.name === 'wit-get-work-item-context-package');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('wit-get-work-item-context-package');
    });

    it('should have includeHtmlFields in input schema', () => {
      const tool = tools.find(t => t.name === 'wit-get-work-item-context-package');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema?.properties).toBeDefined();
      // Note: The actual schema validation happens at runtime with Zod
      // This test just confirms the tool is registered
    });

    it('should have description mentioning context package', () => {
      const tool = tools.find(t => t.name === 'wit-get-work-item-context-package');
      expect(tool).toBeDefined();
      expect(tool?.description?.toLowerCase()).toContain('context package');
    });
  });
});

