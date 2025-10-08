/**
 * Query Test Fixtures
 * 
 * Provides standardized test data for WIQL queries, OData queries, and query results.
 */

import type { ADOWiqlResult } from '../../src/types/ado.js';

/**
 * Basic WIQL query string
 */
export const BASIC_WIQL_QUERY = 
  'SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = "Task"';

/**
 * Complex WIQL query with multiple conditions
 */
export const COMPLEX_WIQL_QUERY = 
  `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
   FROM WorkItems
   WHERE [System.WorkItemType] IN ('Task', 'Bug')
   AND [System.State] <> 'Closed'
   AND [System.AreaPath] UNDER 'TestProject'
   ORDER BY [System.ChangedDate] DESC`;

/**
 * WIQL query for hierarchy
 */
export const HIERARCHY_WIQL_QUERY = 
  `SELECT [System.Id], [System.Title], [System.WorkItemType]
   FROM WorkItemLinks
   WHERE ([Source].[System.WorkItemType] = 'Feature')
   AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward')
   MODE (Recursive)`;

/**
 * Basic OData query string
 */
export const BASIC_ODATA_QUERY = 
  '/WorkItems?$select=WorkItemId,Title,State&$filter=WorkItemType eq "Task"';

/**
 * Complex OData query with aggregation
 */
export const COMPLEX_ODATA_QUERY = 
  `/WorkItems?$select=WorkItemId,Title,State,AssignedTo&$filter=WorkItemType in ('Task','Bug') and State ne 'Closed'&$orderby=ChangedDate desc`;

/**
 * WIQL query result fixture - flat query
 */
export const FLAT_WIQL_RESULT: ADOWiqlResult = {
  queryType: 'flat',
  queryResultType: 'workItem',
  asOf: '2024-01-15T14:30:00Z',
  columns: [
    { referenceName: 'System.Id', name: 'ID' },
    { referenceName: 'System.Title', name: 'Title' },
    { referenceName: 'System.State', name: 'State' }
  ],
  sortColumns: [
    {
      field: { referenceName: 'System.ChangedDate', name: 'Changed Date' },
      descending: true
    }
  ],
  workItems: [
    { id: 1001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/1001' },
    { id: 2001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/2001' },
    { id: 3001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/3001' }
  ]
};

/**
 * WIQL query result fixture - tree query
 */
export const TREE_WIQL_RESULT: ADOWiqlResult = {
  queryType: 'tree',
  queryResultType: 'workItemLink',
  asOf: '2024-01-15T14:30:00Z',
  columns: [
    { referenceName: 'System.Id', name: 'ID' },
    { referenceName: 'System.Title', name: 'Title' },
    { referenceName: 'System.WorkItemType', name: 'Work Item Type' }
  ],
  workItems: [
    { id: 4001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/4001' }
  ],
  workItemRelations: [
    {
      source: { id: 4001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/4001' },
      target: { id: 1001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/1001' },
      rel: 'System.LinkTypes.Hierarchy-Forward'
    },
    {
      source: { id: 1001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/1001' },
      target: { id: 3001, url: 'https://dev.azure.com/test-org/_apis/wit/workItems/3001' },
      rel: 'System.LinkTypes.Hierarchy-Forward'
    }
  ]
};

/**
 * Empty WIQL query result
 */
export const EMPTY_WIQL_RESULT: ADOWiqlResult = {
  queryType: 'flat',
  queryResultType: 'workItem',
  asOf: '2024-01-15T14:30:00Z',
  columns: [
    { referenceName: 'System.Id', name: 'ID' },
    { referenceName: 'System.Title', name: 'Title' }
  ],
  workItems: []
};

/**
 * Query metadata for query handles
 */
export const QUERY_METADATA = {
  organization: 'test-org',
  project: 'test-project',
  wiqlQuery: BASIC_WIQL_QUERY,
  totalResults: 3
};

/**
 * Work item IDs from basic query
 */
export const BASIC_QUERY_IDS = [1001, 2001, 3001];

/**
 * Work item IDs from hierarchy query
 */
export const HIERARCHY_QUERY_IDS = [4001, 1001, 3001];

/**
 * Large set of work item IDs for performance testing
 */
export const LARGE_QUERY_IDS = Array.from({ length: 1000 }, (_, i) => 10000 + i);
