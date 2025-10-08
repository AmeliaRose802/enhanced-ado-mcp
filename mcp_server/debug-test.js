const { handleBulkLinkByQueryHandles } = require('./dist/services/handlers/bulk-operations/bulk-link-handler.js');
const { queryHandleService } = require('./dist/services/query-handle-service.js');

async function testManyToMany() {
  console.log('\n=== Testing many-to-many ===');
  const sourceIds = [101, 102];
  const targetIds = [201, 202];

  const sourceContext = new Map(
    sourceIds.map(id => [id, { title: `Bug ${id}`, state: 'Active', type: 'Bug' }])
  );
  const targetContext = new Map(
    targetIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
  );

  const sourceHandle = queryHandleService.storeQuery(
    sourceIds,
    'SELECT [System.Id] FROM WorkItems',
    { project: 'TestProject', queryType: 'wiql' },
    60000,
    sourceContext
  );

  const targetHandle = queryHandleService.storeQuery(
    targetIds,
    'SELECT [System.Id] FROM WorkItems',
    { project: 'TestProject', queryType: 'wiql' },
    60000,
    targetContext
  );

  const result = await handleBulkLinkByQueryHandles(
    { schema: { safeParse: (args) => ({ success: true, data: args }) } },
    {
      sourceQueryHandle: sourceHandle,
      targetQueryHandle: targetHandle,
      linkType: 'Related',
      linkStrategy: 'many-to-many',
      dryRun: true
    }
  );

  console.log('Result success:', result.success);
  console.log('Result errors:', result.errors);
  console.log('Result data:', JSON.stringify(result.data, null, 2));
}

async function testIndexBased() {
  console.log('\n=== Testing index-based selectors ===');
  const sourceIds = [101, 102, 103];
  const targetIds = [201, 202, 203];

  const sourceContext = new Map(
    sourceIds.map(id => [id, { title: `Task ${id}`, state: 'Active', type: 'Task' }])
  );
  const targetContext = new Map(
    targetIds.map(id => [id, { title: `Feature ${id}`, state: 'Active', type: 'Feature' }])
  );

  const sourceHandle = queryHandleService.storeQuery(sourceIds, 'query', {}, 60000, sourceContext);
  const targetHandle = queryHandleService.storeQuery(targetIds, 'query', {}, 60000, targetContext);

  const result = await handleBulkLinkByQueryHandles(
    { schema: { safeParse: (args) => ({ success: true, data: args }) } },
    {
      sourceQueryHandle: sourceHandle,
      targetQueryHandle: targetHandle,
      linkType: 'Parent',
      linkStrategy: 'one-to-one',
      sourceItemSelector: [0, 2], // Select 1st and 3rd items
      targetItemSelector: [1, 2], // Select 2nd and 3rd items
      dryRun: true
    }
  );

  console.log('Result success:', result.success);
  console.log('Result errors:', result.errors);
  console.log('Result data:', JSON.stringify(result.data, null, 2));
}

testManyToMany().then(() => testIndexBased()).catch(console.error);
