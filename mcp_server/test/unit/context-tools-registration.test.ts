/**
 * Lightweight registration test for new context tools.
 */
import { tools } from '../../src/config/tool-configs.js';

describe('Context Tools Registration', () => {
  it('should register single context package tool', () => {
    const single = tools.find(t => t.name === 'wit-get-work-item-context-package');
    expect(single).toBeDefined();
    expect(single?.description?.toLowerCase()).toContain('context package');
  });

  it('should register batch context package tool', () => {
    const batch = tools.find(t => t.name === 'wit-get-work-items-context-batch');
    expect(batch).toBeDefined();
    expect(batch?.description?.toLowerCase()).toContain('multiple work items');
  });
});

