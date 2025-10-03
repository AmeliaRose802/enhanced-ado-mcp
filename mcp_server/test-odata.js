/**
 * Quick test script for OData Analytics tool
 */

import { executeTool } from './dist/services/tool-service.js';

async function testODataAnalytics() {
  console.log('=== Testing OData Analytics Tool ===\n');

  // Get org and project from environment variables
  const organization = process.env.ADO_ORGANIZATION || 'YourOrganization';
  const project = process.env.ADO_PROJECT || 'YourProject';

  if (!process.env.ADO_PAT) {
    console.error('ERROR: ADO_PAT environment variable not set');
    console.error('Please set ADO_PAT with your Azure DevOps Personal Access Token');
    return;
  }

  console.log(`Using organization: ${organization}`);
  console.log(`Using project: ${project}\n`);

  try {
    // Test 1: Work Item Count
    console.log('Test 1: Work Item Count');
    console.log('------------------------');
    const countResult = await executeTool("wit-query-analytics-odata", {
      queryType: "workItemCount",
      organization,
      project
    });
    console.log('Success:', countResult.success);
    console.log('Summary:', countResult.data?.summary);
    console.log('Results:', JSON.stringify(countResult.data?.results, null, 2));
    console.log('\n');

    // Test 2: Group By State
    console.log('Test 2: Group By State');
    console.log('----------------------');
    const stateResult = await executeTool("wit-query-analytics-odata", {
      queryType: "groupByState",
      organization,
      project
    });
    console.log('Success:', stateResult.success);
    console.log('Summary:', stateResult.data?.summary);
    console.log('Results:', JSON.stringify(stateResult.data?.results?.slice(0, 5), null, 2));
    console.log('\n');

    // Test 3: Group By Type
    console.log('Test 3: Group By Work Item Type');
    console.log('--------------------------------');
    const typeResult = await executeTool("wit-query-analytics-odata", {
      queryType: "groupByType",
      organization,
      project
    });
    console.log('Success:', typeResult.success);
    console.log('Summary:', typeResult.data?.summary);
    console.log('Results:', JSON.stringify(typeResult.data?.results?.slice(0, 5), null, 2));
    console.log('\n');

    // Test 4: Group By Assignee (Active items)
    console.log('Test 4: Group By Assignee (Active Items)');
    console.log('-----------------------------------------');
    const assigneeResult = await executeTool("wit-query-analytics-odata", {
      queryType: "groupByAssignee",
      filters: { State: "Active" },
      organization,
      project
    });
    console.log('Success:', assigneeResult.success);
    console.log('Summary:', assigneeResult.data?.summary);
    console.log('Results:', JSON.stringify(assigneeResult.data?.results?.slice(0, 5), null, 2));
    console.log('\n');

    // Test 5: Velocity Metrics (last 30 days)
    console.log('Test 5: Velocity Metrics (Last 30 Days)');
    console.log('----------------------------------------');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const velocityResult = await executeTool("wit-query-analytics-odata", {
      queryType: "velocityMetrics",
      dateRangeField: "CompletedDate",
      dateRangeStart: dateStr,
      top: 10,
      organization,
      project
    });
    console.log('Success:', velocityResult.success);
    console.log('Summary:', velocityResult.data?.summary);
    console.log('Results (top 10 days):', JSON.stringify(velocityResult.data?.results?.slice(0, 10), null, 2));
    console.log('\n');

    // Test 6: Custom Query - Count Active Bugs
    console.log('Test 6: Custom Query - Active Bugs Count');
    console.log('-----------------------------------------');
    const customResult = await executeTool("wit-query-analytics-odata", {
      queryType: "customQuery",
      customODataQuery: "$apply=filter(State eq 'Active' and WorkItemType eq 'Bug')/aggregate($count as Count)",
      organization,
      project
    });
    console.log('Success:', customResult.success);
    console.log('Summary:', customResult.data?.summary);
    console.log('Results:', JSON.stringify(customResult.data?.results, null, 2));
    console.log('\n');

    console.log('=== All Tests Complete ===');
  } catch (error) {
    console.error('Error during testing:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testODataAnalytics();
