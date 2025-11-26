// @ts-nocheck
/**
 * Test for the REST API-based work item creation
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { executeTool } from "../../src/services/tool-service.js";
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { logger } from "../../src/utils/logger.js";

async function testCreateWorkItemBasic() {
  console.log("\n🧪 Testing basic work item creation with REST API...");
  
  try {
    const result = await executeTool('wit-create-item', {
      Title: 'Test Work Item - REST API Implementation',
      WorkItemType: 'Task',
      Description: 'This is a test work item created using the new REST API implementation instead of PowerShell.',
      Priority: 2,
      Tags: 'test,rest-api,automated'
    });
    
    if (result.success) {
      console.log("✅ Basic work item creation succeeded");
      console.log(`   Work Item ID: ${(result.data as any)?.work_item?.id}`);
      console.log(`   Title: ${(result.data as any)?.work_item?.title}`);
      console.log(`   Type: ${(result.data as any)?.work_item?.type}`);
      console.log(`   State: ${(result.data as any)?.work_item?.state}`);
      console.log(`   URL: ${(result.data as any)?.work_item?.url}`);
      console.log(`   Metadata source: ${result.metadata?.source}`);
    } else {
      console.log("❌ Basic work item creation failed");
      console.log(`   Errors: ${result.errors?.join(', ')}`);
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during basic work item creation:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testCreateWorkItemWithParent() {
  console.log("\n🧪 Testing work item creation with parent linking...");
  
  try {
    // First create a parent work item
    const parentResult = await executeTool('create-workitem', {
      Title: 'Parent Work Item - REST API Test',
      WorkItemType: 'Product Backlog Item',
      Description: 'Parent work item for testing REST API parent linking',
      Tags: 'test,rest-api,parent'
    });
    
    if (!parentResult.success) {
      console.log("❌ Failed to create parent work item");
      return false;
    }
    
    const parentId = parentResult.data?.work_item?.id;
    console.log(`   Created parent work item: ${parentId}`);
    
    // Now create a child work item
    const childResult = await executeTool('create-workitem', {
      Title: 'Child Work Item - REST API Test',
      WorkItemType: 'Task',
      Description: 'Child work item linked to parent',
      ParentWorkItemId: parentId,
      InheritParentPaths: true,
      Tags: 'test,rest-api,child'
    });
    
    if (childResult.success) {
      console.log("✅ Child work item creation with parent linking succeeded");
      console.log(`   Work Item ID: ${(childResult.data as any)?.work_item?.id}`);
      console.log(`   Parent Linked: ${(childResult.data as any)?.work_item?.parent_linked}`);
      console.log(`   Metadata source: ${childResult.metadata?.source}`);
    } else {
      console.log("❌ Child work item creation failed");
      console.log(`   Errors: ${childResult.errors?.join(', ')}`);
    }
    
    return childResult.success && (childResult.data as any)?.work_item?.parent_linked;
  } catch (error) {
    console.log("❌ Exception during parent/child work item creation:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testCreateWorkItemWithAssignment() {
  console.log("\n🧪 Testing work item creation with @me assignment...");
  
  try {
    const result = await executeTool('wit-create-item', {
      Title: 'Test Work Item - @me Assignment',
      WorkItemType: 'Task',
      Description: 'Testing @me assignment resolution in REST API implementation',
      AssignedTo: '@me',
      Priority: 1,
      Tags: 'test,rest-api,assignment'
    });
    
    if (result.success) {
      console.log("✅ Work item creation with @me assignment succeeded");
      console.log(`   Work Item ID: ${(result.data as any)?.work_item?.id}`);
      console.log(`   URL: ${(result.data as any)?.work_item?.url}`);
    } else {
      console.log("❌ Work item creation with @me assignment failed");
      console.log(`   Errors: ${result.errors?.join(', ')}`);
    }
    
    return result.success;
  } catch (error) {
    console.log("❌ Exception during work item creation with assignment:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testMetadataSourceValidation() {
  console.log("\n🧪 Testing metadata source is 'rest-api'...");
  
  try {
    const result = await executeTool('wit-create-item', {
      Title: 'Test Work Item - Metadata Validation',
      WorkItemType: 'Task',
      Description: 'Validating that the new REST API implementation is being used',
      Tags: 'test,rest-api,metadata'
    });
    
    if (result.success && result.metadata?.source === 'rest-api') {
      console.log("✅ Metadata source validation succeeded");
      console.log(`   Source: ${(result.metadata as any).source} (expected: rest-api)`);
    } else {
      console.log("❌ Metadata source validation failed");
      console.log(`   Expected: rest-api, Got: ${result.metadata?.source}`);
    }
    
    return result.success && result.metadata?.source === 'rest-api';
  } catch (error) {
    console.log("❌ Exception during metadata validation:");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Run all tests
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Testing REST API Work Item Creation Implementation  ");
  console.log("═══════════════════════════════════════════════════════");
  
  const results = {
    basic: false,
    parent: false,
    assignment: false,
    metadata: false
  };
  
  try {
    results.basic = await testCreateWorkItemBasic();
    results.parent = await testCreateWorkItemWithParent();
    results.assignment = await testCreateWorkItemWithAssignment();
    results.metadata = await testMetadataSourceValidation();
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Test Results Summary  ");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`Basic creation:        ${results.basic ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Parent linking:        ${results.parent ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`@me assignment:        ${results.assignment ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Metadata validation:   ${results.metadata ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
      console.log("\n🎉 All REST API work item creation tests passed!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests failed. Review the output above for details.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Test suite failed with exception:", error);
    process.exit(1);
  }
}


