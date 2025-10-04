/**
 * Test new configuration and discovery tools
 */

import { executeTool } from '../services/tool-service.js';
import { loadConfiguration, updateConfigFromCLI } from '../config/config.js';

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