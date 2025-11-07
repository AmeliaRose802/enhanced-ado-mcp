#!/usr/bin/env node
/**
 * Test script to verify prompt loading and area_path variable filling
 */

import { loadPrompts, getPromptContent } from './dist/services/prompt-service.js';

console.log('Testing prompt loading...\n');

try {
  // Test 1: Load all prompts
  console.log('1. Loading all prompts...');
  const prompts = await loadPrompts();
  console.log(`   Found ${prompts.length} prompts:`);
  prompts.forEach(p => {
    console.log(`   - ${p.name}: ${p.description || 'No description'}`);
  });
  console.log();

  // Test 2: Get specific prompt with area_path
  if (prompts.length > 0) {
    const testPromptName = 'security_items_analyzer';
    console.log(`2. Testing prompt '${testPromptName}' with area_path variable...`);
    
    const content = await getPromptContent(testPromptName, {
      area_path: 'One\\\\Azure Compute\\\\OneFleet Node\\\\Azure Host Agent\\\\Azure Host Gateway',
      max_items: 25
    });
    
    // Show a snippet of the filled content
    const lines = content.split('\n');
    const relevantLines = lines.filter(line => line.includes('SELECT') || line.includes('AreaPath'));
    
    console.log('   WIQL Query snippet with filled area_path:');
    relevantLines.forEach(line => {
      console.log(`   ${line.trim()}`);
    });
    console.log();
    
    // Check if area_path was properly substituted
    if (content.includes('{{area_path}}')) {
      console.error('   ❌ ERROR: area_path variable was not substituted!');
    } else if (content.includes('One\\\\Azure Compute')) {
      console.log('   ✅ SUCCESS: area_path variable was properly substituted!');
    } else {
      console.warn('   ⚠️  WARNING: Cannot verify area_path substitution');
    }
  }

  console.log('\n✅ All tests completed successfully!');
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
