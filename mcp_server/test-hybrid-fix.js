#!/usr/bin/env node

/**
 * Quick test to verify the hybrid transport fixes
 */

import { PassThrough } from 'node:stream';
import { HybridStdioServerTransport } from './src/hybridTransport.js';

async function testEmptyLines() {
  console.log('\n=== Testing empty lines in newline mode ===');
  const mockStdin = new PassThrough();
  const mockStdout = new PassThrough();
  const transport = new HybridStdioServerTransport(mockStdin, mockStdout);

  const messages = [];
  transport.onmessage = (msg) => {
    console.log('✓ Received message:', msg);
    messages.push(msg);
  };

  await transport.start();

  const message = { jsonrpc: '2.0', method: 'test' };
  mockStdin.write('\n\n' + JSON.stringify(message) + '\n\n');

  await new Promise(resolve => setTimeout(resolve, 100));

  if (messages.length === 1 && messages[0].method === 'test') {
    console.log('✅ Test 1 PASSED: Empty lines handled correctly');
    return true;
  } else {
    console.log('❌ Test 1 FAILED: Expected 1 message, got', messages.length);
    return false;
  }
}

async function testGarbageData() {
  console.log('\n=== Testing garbage data recovery ===');
  const mockStdin = new PassThrough();
  const mockStdout = new PassThrough();
  const transport = new HybridStdioServerTransport(mockStdin, mockStdout);

  const messages = [];
  const errors = [];

  transport.onmessage = (msg) => {
    console.log('✓ Received message:', msg);
    messages.push(msg);
  };

  transport.onerror = (err) => {
    console.log('✓ Caught error:', err.message);
    errors.push(err);
  };

  await transport.start();

  // Send garbage bytes
  console.log('Sending garbage bytes...');
  mockStdin.write(Buffer.from([0xFF, 0xFE, 0xFD]));

  await new Promise(resolve => setTimeout(resolve, 50));

  // Send valid message
  const validMessage = { jsonrpc: '2.0', method: 'test' };
  const validJson = JSON.stringify(validMessage);
  const validPayload = `Content-Length: ${Buffer.byteLength(validJson, 'utf8')}\r\n\r\n${validJson}`;
  console.log('Sending valid message...');
  mockStdin.write(validPayload);

  await new Promise(resolve => setTimeout(resolve, 100));

  if (messages.length >= 1) {
    console.log('✅ Test 2 PASSED: Recovered from garbage data');
    return true;
  } else {
    console.log('❌ Test 2 FAILED: Expected at least 1 message, got', messages.length);
    return false;
  }
}

async function main() {
  console.log('Testing hybrid transport fixes...\n');
  
  const test1 = await testEmptyLines();
  const test2 = await testGarbageData();

  console.log('\n=== Summary ===');
  console.log('Test 1 (empty lines):', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 2 (garbage data):', test2 ? '✅ PASS' : '❌ FAIL');

  process.exit(test1 && test2 ? 0 : 1);
}

main().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
