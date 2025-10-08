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
    console.log('1️⃣  Testing wit-get-config...');
    const configResult = await executeTool('wit-get-config', { Section: 'all' });
    const configData = configResult.data as any;
    console.log('✅ Configuration tool result:', {
      success: configResult.success,
      hasData: !!configResult.data,
      helpTextKeys: configData?.helpText ? Object.keys(configData.helpText) : []
    });
    console.log('   Configuration sections:', Object.keys(configData?.configuration || {}));
    console.log('   Area path guidance:', configData?.helpText?.areaPath);
    console.log();

    // Test 2: Get Azure DevOps section only
    console.log('2️⃣  Testing wit-get-config with azureDevOps section...');
    const adoConfigResult = await executeTool('wit-get-config', { 
      Section: 'azureDevOps', 
      IncludeSensitive: true 
    });
    const adoConfigData = adoConfigResult.data as any;
    console.log('✅ Azure DevOps config result:', {
      success: adoConfigResult.success,
      organization: adoConfigData?.configuration?.azureDevOps?.organization,
      project: adoConfigData?.configuration?.azureDevOps?.project,
      areaPath: adoConfigData?.configuration?.azureDevOps?.areaPath,
      defaultWorkItemType: adoConfigData?.configuration?.azureDevOps?.defaultWorkItemType
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