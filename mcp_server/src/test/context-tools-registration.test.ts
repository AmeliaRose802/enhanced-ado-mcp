#!/usr/bin/env node
/**
 * Lightweight registration test for new context tools.
 * Uses simple assertions without a test framework (aligned with existing test harness style).
 */
import { tools } from '../config/tool-configs.js';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error('❌', message);
    process.exitCode = 1;
  } else {
    console.log('✅', message);
  }
}

console.log('🧪 Context Tools Registration Test');
const single = tools.find(t => t.name === 'wit-get-work-item-context-package');
assert(!!single, 'Single context package tool registered');
assert(single?.description?.toLowerCase().includes('context package'), 'Single tool description includes phrase "context package"');

const batch = tools.find(t => t.name === 'wit-get-work-items-context-batch');
assert(!!batch, 'Batch context package tool registered');
assert(batch?.description?.toLowerCase().includes('multiple work items'), 'Batch tool description references multiple work items');

if (process.exitCode === 1) {
  console.error('❌ Context tools registration test failed');
  process.exit(1);
} else {
  console.log('🎉 Context tools registration test passed');
}
