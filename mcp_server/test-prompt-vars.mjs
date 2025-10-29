import { loadPrompts, getPromptContent } from './dist/services/prompt-service.js';

async function testPromptVariables() {
  console.log('Testing prompt template variable substitution...\n');
  
  const testArgs = {
    analysis_period_days: 30,
    lookback_days: 14,
    staleness_threshold_days: 60
  };
  
  const prompts = await loadPrompts();
  console.log(`Found ${prompts.length} prompts\n`);
  
  let allPassed = true;
  
  for (const prompt of prompts) {
    try {
      const content = await getPromptContent(prompt.name, testArgs);
      const unfilled = content.match(/\{\{(\w+)\}\}/g);
      
      if (unfilled && unfilled.length > 0) {
        console.log(`❌ ${prompt.name}: Unfilled variables ${[...new Set(unfilled)].join(', ')}`);
        allPassed = false;
      } else {
        console.log(`✅ ${prompt.name}: All variables filled`);
      }
    } catch (error) {
      console.log(`❌ ${prompt.name}: Error - ${error.message}`);
      allPassed = false;
    }
  }
  
  console.log(allPassed ? '\n✅ All prompts passed!' : '\n❌ Some prompts failed!');
  process.exit(allPassed ? 0 : 1);
}

testPromptVariables();
