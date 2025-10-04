/**
 * Quick test to verify resources are accessible
 * Run with: node test-resources.js
 */

import { listResources, getResourceContent } from './dist/services/resource-service.js';

console.log('🧪 Testing MCP Resources...\n');

try {
  // Test 1: List resources
  console.log('📋 Listing available resources:');
  const resources = listResources();
  console.log(`   Found ${resources.length} resources\n`);
  
  resources.forEach((resource, index) => {
    console.log(`${index + 1}. ${resource.name}`);
    console.log(`   URI: ${resource.uri}`);
    console.log(`   Description: ${resource.description}`);
    console.log(`   Type: ${resource.mimeType}\n`);
  });
  
  // Test 2: Load a sample resource
  console.log('📖 Testing resource loading (WIQL Quick Reference)...');
  const content = await getResourceContent('ado://docs/wiql-quick-reference');
  console.log(`   ✅ Successfully loaded ${content.uri}`);
  console.log(`   Content length: ${content.text?.length || 0} characters`);
  console.log(`   First 200 chars: ${content.text?.substring(0, 200)}...\n`);
  
  console.log('✅ All tests passed! Resources are working correctly.');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Error testing resources:', error);
  process.exit(1);
}
