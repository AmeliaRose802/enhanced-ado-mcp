#!/usr/bin/env node
/**
 * Test new configuration and discovery tools
 */

import { executeTool } from '../services/tool-service.js';
import { loadConfiguration, updateConfigFromCLI } from '../config/config-manager.js';

async function testConfigurationTools() {
  console.log('🧪 Testing Configuration and Discovery Tools\n');

  // Set up test configuration with dummy values
  updateConfigFromCLI({
    organization: 'test-org',
    project: 'test-project',
    areaPath: 'TestProject\\TestTeam\\TestComponent'
  });

  try {
    // Test 1: Get configuration
    console.log('1️⃣  Testing wit-get-configuration...');
    const configResult = await executeTool('wit-get-configuration', { Section: 'all' });
    console.log('✅ Configuration tool result:', {
      success: configResult.success,
      hasData: !!configResult.data,
      helpTextKeys: configResult.data?.helpText ? Object.keys(configResult.data.helpText) : []
    });
    console.log('   Configuration sections:', Object.keys(configResult.data?.configuration || {}));
    console.log('   Area path guidance:', configResult.data?.helpText?.areaPath);
    console.log();

    // Test 2: Get Azure DevOps section only
    console.log('2️⃣  Testing wit-get-configuration with azureDevOps section...');
    const adoConfigResult = await executeTool('wit-get-configuration', { 
      Section: 'azureDevOps', 
      IncludeSensitive: true 
    });
    console.log('✅ Azure DevOps config result:', {
      success: adoConfigResult.success,
      organization: adoConfigResult.data?.configuration?.azureDevOps?.organization,
      project: adoConfigResult.data?.configuration?.azureDevOps?.project,
      areaPath: adoConfigResult.data?.configuration?.azureDevOps?.areaPath,
      defaultWorkItemType: adoConfigResult.data?.configuration?.azureDevOps?.defaultWorkItemType
    });
    console.log();

    // Test 3: Try to discover area paths (this will fail if not logged into Azure CLI)
    console.log('3️⃣  Testing wit-discover-area-paths...');
    try {
      const areaPathResult = await executeTool('wit-discover-area-paths', {});
      if (areaPathResult.success) {
        console.log('✅ Area paths discovery succeeded:', {
          totalCount: areaPathResult.data?.totalCount,
          samplePaths: areaPathResult.data?.areaPaths?.slice(0, 3).map((ap: any) => ap.path)
        });
      } else {
        console.log('⚠️  Area paths discovery failed (expected if not logged into Azure CLI):', areaPathResult.errors?.[0]);
      }
    } catch (error) {
      console.log('⚠️  Area paths discovery failed (expected if not logged into Azure CLI):', error instanceof Error ? error.message : String(error));
    }
    console.log();

    // Test 4: Try to discover repositories (this will also fail if not logged into Azure CLI)
    console.log('4️⃣  Testing wit-discover-repositories...');
    try {
      const repoResult = await executeTool('wit-discover-repositories', { MaxRepositories: 5 });
      if (repoResult.success) {
        console.log('✅ Repository discovery succeeded:', {
          totalCount: repoResult.data?.totalCount,
          sampleRepos: repoResult.data?.repositories?.slice(0, 2).map((repo: any) => ({ 
            name: repo.name, 
            defaultBranch: repo.defaultBranch,
            branchCount: repo.branches?.length 
          }))
        });
      } else {
        console.log('⚠️  Repository discovery failed (expected if not logged into Azure CLI):', repoResult.errors?.[0]);
      }
    } catch (error) {
      console.log('⚠️  Repository discovery failed (expected if not logged into Azure CLI):', error instanceof Error ? error.message : String(error));
    }
    console.log();

    // Test 5: Try to discover work item types
    console.log('5️⃣  Testing wit-discover-work-item-types...');
    try {
      const witResult = await executeTool('wit-discover-work-item-types', { IncludeStates: true });
      if (witResult.success) {
        console.log('✅ Work item types discovery succeeded:', {
          totalCount: witResult.data?.totalCount,
          sampleTypes: witResult.data?.workItemTypes?.slice(0, 3).map((wit: any) => ({ 
            name: wit.name,
            stateCount: wit.states?.length 
          }))
        });
      } else {
        console.log('⚠️  Work item types discovery failed (expected if not logged into Azure CLI):', witResult.errors?.[0]);
      }
    } catch (error) {
      console.log('⚠️  Work item types discovery failed (expected if not logged into Azure CLI):', error instanceof Error ? error.message : String(error));
    }
    console.log();

    console.log('🎉 Configuration and discovery tools test completed!');
    console.log('💡 Note: Discovery tools require Azure CLI login (az login) to access live Azure DevOps data.');
    console.log('📋 The configuration tools provide all the needed defaults and guidance for agents.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConfigurationTools().catch(console.error);