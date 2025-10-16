import { executeTool } from '../dist/services/tool-service.js';
import { loadConfiguration } from '../dist/config/config.js';

/**
 * Debug script to investigate work item 35202849 that was incorrectly
 * identified as missing a description when it actually has one.
 */
async function debugWorkItem35202849() {
  console.log('🔍 Debugging work item 35202849 description filter issue...');
  
  try {
    // First, get the specific work item without any filtering
    console.log('\n📋 Step 1: Getting work item 35202849 without filtering...');
    const directResult = await executeTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 35202849",
      includeFields: ['System.Description', 'System.Title', 'System.WorkItemType']
    });
    
    if (!directResult.success) {
      console.log('❌ Failed to get work item directly:', directResult.errors);
      return;
    }
    
    const directData = directResult.data;
    if (!directData?.work_items || directData.work_items.length === 0) {
      console.log('❌ Work item 35202849 not found');
      return;
    }
    
    const workItem = directData.work_items[0];
    console.log(`✅ Found work item: #${workItem.id} - "${workItem.title}"`);
    console.log(`   Type: ${workItem.type}`);
    
    // Examine the description field in detail
    const desc = workItem.additionalFields?.['System.Description'];
    console.log(`\n🔬 Description analysis:`);
    console.log(`   Raw type: ${typeof desc}`);
    console.log(`   Raw value: ${JSON.stringify(desc)}`);
    
    if (desc === undefined) {
      console.log('   ⚠️  Description is undefined');
    } else if (desc === null) {
      console.log('   ⚠️  Description is null');
    } else if (desc === '') {
      console.log('   ⚠️  Description is empty string');
    } else {
      const descStr = String(desc);
      console.log(`   String length: ${descStr.length} characters`);
      
      // Apply the same HTML stripping logic as the filter
      const strippedDesc = descStr.replace(/<[^>]*>/g, '').trim();
      console.log(`   After HTML stripping: ${strippedDesc.length} characters`);
      console.log(`   Stripped preview: "${strippedDesc.substring(0, 100)}${strippedDesc.length > 100 ? '...' : ''}"`); 
      
      // Check what the filter logic would return
      const wouldBeFiltered = strippedDesc.length < 10;
      console.log(`   Would be filtered (< 10 chars): ${wouldBeFiltered}`);
      
      if (wouldBeFiltered && strippedDesc.length > 0) {
        console.log('   🔍 This is the issue! Description exists but is very short.');
      } else if (!wouldBeFiltered) {
        console.log('   ❓ This should NOT be filtered - there may be a bug.');
      }
    }
    
    // Now test with the missing description filter
    console.log('\n🎯 Step 2: Testing with missing description filter...');
    const filteredResult = await executeTool('wit-wiql-query', {
      wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 35202849",
      filterByPatterns: ['missing_description'],
      includeFields: ['System.Description', 'System.Title', 'System.WorkItemType']
    });
    
    if (!filteredResult.success) {
      console.log('❌ Failed to run filtered query:', filteredResult.errors);
      return;
    }
    
    const filteredData = filteredResult.data;
    const wasFiltered = filteredData?.work_items && filteredData.work_items.length > 0;
    
    console.log(`Filter result: ${wasFiltered ? 'INCLUDED' : 'EXCLUDED'} in missing description results`);
    
    if (wasFiltered) {
      console.log('\n🚨 BUG CONFIRMED: Work item was incorrectly identified as missing description!');
      
      const filteredItem = filteredData.work_items[0];
      const filteredDesc = filteredItem.additionalFields?.['System.Description'];
      
      console.log('\n🔬 Filtered result description analysis:');
      console.log(`   Filtered raw type: ${typeof filteredDesc}`);
      console.log(`   Filtered raw value: ${JSON.stringify(filteredDesc)}`);
      
      // Check if there's a difference between direct and filtered results
      if (JSON.stringify(desc) !== JSON.stringify(filteredDesc)) {
        console.log('\n⚠️  FIELD PROCESSING ISSUE: Description differs between direct and filtered results!');
        console.log(`   Direct result: ${JSON.stringify(desc)}`);
        console.log(`   Filtered result: ${JSON.stringify(filteredDesc)}`);
      }
    } else {
      console.log('\n✅ Filter working correctly - item was not included in missing description results');
    }
    
    // Additional debugging: Check the broader context
    console.log('\n🌐 Step 3: Checking similar items for pattern...');
    const contextResult = await executeTool('wit-wiql-query', {
      wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (35202849, 35202848, 35202850) ORDER BY [System.Id]`,
      filterByPatterns: ['missing_description'],
      includeFields: ['System.Description']
    });
    
    if (contextResult.success && contextResult.data?.work_items) {
      console.log(`Found ${contextResult.data.work_items.length} items with missing descriptions in nearby range:`);
      contextResult.data.work_items.forEach(wi => {
        const desc = wi.additionalFields?.['System.Description'];
        const strippedDesc = String(desc || '').replace(/<[^>]*>/g, '').trim();
        console.log(`   #${wi.id}: "${wi.title}" (desc length: ${strippedDesc.length})`);
      });
    }
    
  } catch (error) {
    console.error('💥 Debug failed with error:', error);
  }
}

// Run the debug
debugWorkItem35202849();
