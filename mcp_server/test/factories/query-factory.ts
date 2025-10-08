/**
 * Query Factory
 * 
 * Provides flexible factory functions to create query handles, WIQL results, and query-related data.
 */

import type { ADOWiqlResult } from '../../src/types/ado.js';
import type { WorkItemContext } from '../../src/types/work-items.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import {
  BASIC_WIQL_QUERY,
  FLAT_WIQL_RESULT,
  QUERY_METADATA
} from '../fixtures/queries.js';

/**
 * Options for creating a query handle
 */
export interface QueryHandleFactoryOptions {
  workItemIds?: number[];
  wiqlQuery?: string;
  project?: string;
  organization?: string;
  ttlMs?: number;
  workItemContext?: Map<number, WorkItemContext>;
  queryType?: string;
}

/**
 * Options for creating WIQL query results
 */
export interface WiqlResultFactoryOptions {
  queryType?: 'flat' | 'tree' | 'oneHop';
  queryResultType?: 'workItem' | 'workItemLink';
  workItemIds?: number[];
  asOf?: string;
  includeRelations?: boolean;
}

/**
 * Creates a query handle with optional overrides
 * 
 * @example
 * ```typescript
 * const handle = createQueryHandle({
 *   workItemIds: [1001, 2001, 3001],
 *   project: 'MyProject'
 * });
 * ```
 */
export function createQueryHandle(options: QueryHandleFactoryOptions = {}): string {
  const workItemIds = options.workItemIds ?? [1001, 2001, 3001];
  const wiqlQuery = options.wiqlQuery ?? BASIC_WIQL_QUERY;
  const project = options.project ?? 'test-project';
  const ttlMs = options.ttlMs ?? 60000; // 1 minute default
  const workItemContext = options.workItemContext ?? new Map();
  const queryType = options.queryType ?? 'wiql';

  return queryHandleService.storeQuery(
    workItemIds,
    wiqlQuery,
    { project, queryType },
    ttlMs,
    workItemContext
  );
}

/**
 * Creates a WIQL query result with optional overrides
 * 
 * @example
 * ```typescript
 * const result = createWiqlResult({
 *   workItemIds: [101, 102, 103],
 *   queryType: 'flat'
 * });
 * ```
 */
export function createWiqlResult(options: WiqlResultFactoryOptions = {}): ADOWiqlResult {
  const queryType = options.queryType ?? 'flat';
  const queryResultType = options.queryResultType ?? 'workItem';
  const workItemIds = options.workItemIds ?? [1001, 2001, 3001];
  const asOf = options.asOf ?? new Date().toISOString();

  const result: ADOWiqlResult = {
    queryType,
    queryResultType,
    asOf,
    columns: [
      { referenceName: 'System.Id', name: 'ID' },
      { referenceName: 'System.Title', name: 'Title' },
      { referenceName: 'System.State', name: 'State' }
    ],
    workItems: workItemIds.map(id => ({
      id,
      url: `https://dev.azure.com/test-org/_apis/wit/workItems/${id}`
    }))
  };

  if (options.includeRelations && queryType !== 'flat') {
    result.workItemRelations = [];
    for (let i = 0; i < workItemIds.length - 1; i++) {
      result.workItemRelations.push({
        source: { 
          id: workItemIds[i], 
          url: `https://dev.azure.com/test-org/_apis/wit/workItems/${workItemIds[i]}`
        },
        target: { 
          id: workItemIds[i + 1], 
          url: `https://dev.azure.com/test-org/_apis/wit/workItems/${workItemIds[i + 1]}`
        },
        rel: 'System.LinkTypes.Hierarchy-Forward'
      });
    }
  }

  return result;
}

/**
 * Creates a query handle with work item context
 * 
 * @example
 * ```typescript
 * const handle = createQueryHandleWithContext(
 *   [1001, 2001],
 *   contextMap,
 *   { project: 'MyProject' }
 * );
 * ```
 */
export function createQueryHandleWithContext(
  workItemIds: number[],
  contextMap: Map<number, WorkItemContext>,
  options: Partial<QueryHandleFactoryOptions> = {}
): string {
  return createQueryHandle({
    workItemIds,
    workItemContext: contextMap,
    ...options
  });
}

/**
 * Creates multiple query handles for testing
 * 
 * @example
 * ```typescript
 * const handles = createMultipleQueryHandles(3, { project: 'MyProject' });
 * // Creates 3 query handles with sequential IDs
 * ```
 */
export function createMultipleQueryHandles(
  count: number,
  baseOptions: QueryHandleFactoryOptions = {}
): string[] {
  return Array.from({ length: count }, (_, i) => {
    const startId = (baseOptions.workItemIds?.[0] ?? 10000) + (i * 100);
    return createQueryHandle({
      ...baseOptions,
      workItemIds: [startId, startId + 1, startId + 2]
    });
  });
}

/**
 * Creates a WIQL query string with custom conditions
 * 
 * @example
 * ```typescript
 * const query = createWiqlQuery({
 *   workItemType: 'Task',
 *   state: 'Active',
 *   areaPath: 'MyProject\\MyArea'
 * });
 * ```
 */
export function createWiqlQuery(options: {
  workItemType?: string;
  state?: string;
  areaPath?: string;
  assignedTo?: string;
  fields?: string[];
}): string {
  const fields = options.fields ?? ['System.Id', 'System.Title', 'System.State'];
  const fieldList = fields.map(f => `[${f}]`).join(', ');
  
  const conditions: string[] = [];
  
  if (options.workItemType) {
    conditions.push(`[System.WorkItemType] = '${options.workItemType}'`);
  }
  
  if (options.state) {
    conditions.push(`[System.State] = '${options.state}'`);
  }
  
  if (options.areaPath) {
    conditions.push(`[System.AreaPath] UNDER '${options.areaPath}'`);
  }
  
  if (options.assignedTo) {
    conditions.push(`[System.AssignedTo] = '${options.assignedTo}'`);
  }
  
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}`
    : '';
  
  return `SELECT ${fieldList} FROM WorkItems ${whereClause}`.trim();
}

/**
 * Creates an OData query string with custom parameters
 * 
 * @example
 * ```typescript
 * const query = createODataQuery({
 *   select: ['WorkItemId', 'Title', 'State'],
 *   filter: "WorkItemType eq 'Task'",
 *   orderBy: 'ChangedDate desc'
 * });
 * ```
 */
export function createODataQuery(options: {
  select?: string[];
  filter?: string;
  orderBy?: string;
  top?: number;
  skip?: number;
}): string {
  const parts: string[] = [];
  
  if (options.select && options.select.length > 0) {
    parts.push(`$select=${options.select.join(',')}`);
  }
  
  if (options.filter) {
    parts.push(`$filter=${options.filter}`);
  }
  
  if (options.orderBy) {
    parts.push(`$orderby=${options.orderBy}`);
  }
  
  if (options.top !== undefined) {
    parts.push(`$top=${options.top}`);
  }
  
  if (options.skip !== undefined) {
    parts.push(`$skip=${options.skip}`);
  }
  
  return `/WorkItems?${parts.join('&')}`;
}

/**
 * Cleans up all query handles created during tests
 * Should be called in afterEach or afterAll hooks
 */
export function cleanupQueryHandles(): void {
  queryHandleService.clearAll();
}
