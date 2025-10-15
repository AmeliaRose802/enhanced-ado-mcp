/**
 * Test script to diagnose GitHub Copilot identity search
 * 
 * Usage: tsx scripts/test-copilot-search.ts [organization]
 */

import { searchIdentities, findGitHubCopilotGuid } from '../src/services/ado-identity-service.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: tsx scripts/test-copilot-search.ts <organization>');
    console.error('Example: tsx scripts/test-copilot-search.ts myorg');
    process.exit(1);
  }
  
  const organization = args[0];
  
  console.log('='.repeat(80));
  console.log('GitHub Copilot Identity Search Test');
  console.log('='.repeat(80));
  console.log(`Organization: ${organization}`);
  console.log('');
  
  try {
    // Test 1: Direct search for "copilot"
    console.log('Test 1: Searching for "copilot"...');
    const copilotResults = await searchIdentities(organization, 'copilot');
    console.log(`Found ${copilotResults.length} results`);
    console.log('');
    
    // Test 2: Search for "github"
    console.log('Test 2: Searching for "github"...');
    const githubResults = await searchIdentities(organization, 'github');
    console.log(`Found ${githubResults.length} results`);
    console.log('');
    
    // Test 3: Search for "bot"
    console.log('Test 3: Searching for "bot"...');
    const botResults = await searchIdentities(organization, 'bot');
    console.log(`Found ${botResults.length} results`);
    console.log('');
    
    // Test 4: Run the full auto-discovery
    console.log('Test 4: Running full auto-discovery...');
    console.log('');
    const guid = await findGitHubCopilotGuid(organization);
    
    console.log('');
    console.log('='.repeat(80));
    if (guid) {
      console.log(`✓ SUCCESS: Found GitHub Copilot GUID: ${guid}`);
    } else {
      console.log(`✗ FAILED: Could not find GitHub Copilot GUID`);
      console.log('');
      console.log('Debugging tips:');
      console.log('1. Check the logs above to see what identities were found');
      console.log('2. Verify the GitHub Copilot user exists in your ADO organization');
      console.log('3. Check the exact spelling/name of the Copilot user in ADO');
      console.log('4. You can manually specify the GUID with --copilot-guid flag');
    }
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

main();
