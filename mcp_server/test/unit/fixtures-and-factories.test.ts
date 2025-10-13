// @ts-nocheck
/**
 * Test Fixtures and Factories Usage Examples
 * 
 * This test file demonstrates how to use the test fixtures and factories.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createWorkItem,
  createTask,
  createPBI,
  createBug,
  createFeature,
  createEpic,
  createWorkItemContext,
  createParentChildRelation,
  createMultipleWorkItems,
  createContextMap
} from '../factories/work-item-factory.js';
import {
  createQueryHandle,
  createWiqlResult,
  createWiqlQuery,
  createODataQuery,
  cleanupQueryHandles
} from '../factories/query-factory.js';
import {
  createSuccessResult,
  createErrorResult,
  createToolExecutionResult,
  createWorkItemsBatch,
  createBulkOperationResult
} from '../factories/response-factory.js';
import {
  PBI_WORK_ITEM,
  BUG_WORK_ITEM,
  TASK_WORK_ITEM,
  TEST_IDENTITY
} from '../fixtures/work-items.js';
import {
  BASIC_WIQL_QUERY,
  FLAT_WIQL_RESULT
} from '../fixtures/queries.js';

describe('Test Fixtures and Factories', () => {
  afterEach(() => {
    cleanupQueryHandles();
  });

  describe('Work Item Fixtures', () => {
    it('should provide pre-configured work items', () => {
      expect(PBI_WORK_ITEM.id).toBe(1001);
      expect(PBI_WORK_ITEM.fields['System.WorkItemType']).toBe('Product Backlog Item');
      expect(BUG_WORK_ITEM.fields['System.WorkItemType']).toBe('Bug');
      expect(TASK_WORK_ITEM.fields['System.WorkItemType']).toBe('Task');
    });

    it('should provide test identity', () => {
      expect(TEST_IDENTITY.displayName).toBe('Test User');
      expect(TEST_IDENTITY.uniqueName).toBe('testuser@example.com');
    });
  });

  describe('Work Item Factory', () => {
    it('should create work item with defaults', () => {
      const item = createWorkItem();
      
      expect(item.id).toBeDefined();
      expect(item.fields['System.Title']).toBeDefined();
      expect(item.fields['System.WorkItemType']).toBe('Task');
      expect(item.fields['System.State']).toBe('New');
    });

    it('should create work item with overrides', () => {
      const item = createWorkItem({
        id: 5000,
        title: 'Custom Task',
        type: 'Bug',
        state: 'Active',
        storyPoints: 5
      });

      expect(item.id).toBe(5000);
      expect(item.fields['System.Title']).toBe('Custom Task');
      expect(item.fields['System.WorkItemType']).toBe('Bug');
      expect(item.fields['System.State']).toBe('Active');
      expect(item.fields['Microsoft.VSTS.Scheduling.StoryPoints']).toBe(5);
    });

    it('should create specific work item types', () => {
      const task = createTask({ id: 1000 });
      const pbi = createPBI({ id: 2000 });
      const bug = createBug({ id: 3000 });
      const feature = createFeature({ id: 4000 });
      const epic = createEpic({ id: 5000 });

      expect(task.fields['System.WorkItemType']).toBe('Task');
      expect(pbi.fields['System.WorkItemType']).toBe('Product Backlog Item');
      expect(bug.fields['System.WorkItemType']).toBe('Bug');
      expect(feature.fields['System.WorkItemType']).toBe('Feature');
      expect(epic.fields['System.WorkItemType']).toBe('Epic');
    });

    it('should create parent-child relationships', () => {
      const parent = createPBI({ id: 1000 });
      const child = createTask({ id: 2000 });
      
      const [parentWithChild, childWithParent] = createParentChildRelation(parent, child);

      expect(parentWithChild.relations).toHaveLength(1);
      expect(parentWithChild.relations![0].rel).toBe('System.LinkTypes.Hierarchy-Forward');
      expect(childWithParent.relations).toHaveLength(1);
      expect(childWithParent.relations![0].rel).toBe('System.LinkTypes.Hierarchy-Reverse');
    });

    it('should create multiple work items', () => {
      const items = createMultipleWorkItems('Task', 5, { state: 'Active' });

      expect(items).toHaveLength(5);
      items.forEach((item, index) => {
        expect(item.fields['System.WorkItemType']).toBe('Task');
        expect(item.fields['System.State']).toBe('Active');
        expect(item.id).toBe(10000 + index);
      });
    });

    it('should create context map from work items', () => {
      const items = createMultipleWorkItems('Task', 3);
      const contextMap = createContextMap(items);

      expect(contextMap.size).toBe(3);
      items.forEach(item => {
        const context = contextMap.get(item.id);
        expect(context).toBeDefined();
        expect(context!.title).toBe(item.fields['System.Title']);
      });
    });

    it('should create work item context', () => {
      const context = createWorkItemContext({
        title: 'Test Context',
        state: 'Active',
        daysInactive: 5
      });

      expect(context.title).toBe('Test Context');
      expect(context.state).toBe('Active');
      expect(context.daysInactive).toBe(5);
    });
  });

  describe('Query Fixtures', () => {
    it('should provide WIQL query strings', () => {
      expect(BASIC_WIQL_QUERY).toContain('SELECT');
      expect(BASIC_WIQL_QUERY).toContain('FROM WorkItems');
    });

    it('should provide WIQL query results', () => {
      expect(FLAT_WIQL_RESULT.queryType).toBe('flat');
      expect(FLAT_WIQL_RESULT.workItems).toHaveLength(3);
    });
  });

  describe('Query Factory', () => {
    it('should create query handle', () => {
      const handle = createQueryHandle({
        workItemIds: [1001, 2001, 3001]
      });

      expect(handle).toBeDefined();
      expect(typeof handle).toBe('string');
    });

    it('should create WIQL result', () => {
      const result = createWiqlResult({
        workItemIds: [101, 102, 103],
        queryType: 'flat'
      });

      expect(result.queryType).toBe('flat');
      expect(result.workItems).toHaveLength(3);
      expect(result.workItems[0].id).toBe(101);
    });

    it('should create WIQL query string', () => {
      const query = createWiqlQuery({
        workItemType: 'Task',
        state: 'Active'
      });

      expect(query).toContain('Task');
      expect(query).toContain('Active');
      expect(query).toContain('WHERE');
    });

    it('should create OData query string', () => {
      const query = createODataQuery({
        select: ['WorkItemId', 'Title'],
        filter: "WorkItemType eq 'Task'",
        top: 10
      });

      expect(query).toContain('$select=WorkItemId,Title');
      expect(query).toContain("$filter=WorkItemType eq 'Task'");
      expect(query).toContain('$top=10');
    });
  });

  describe('Response Factory', () => {
    it('should create success result', () => {
      const result = createSuccessResult({ workItemId: 1001 });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should create error result', () => {
      const result = createErrorResult('Item not found');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Item not found');
    });

    it('should create custom tool execution result', () => {
      const result = createToolExecutionResult({
        success: true,
        data: { count: 5 },
        warnings: ['Some items skipped'],
        metadata: { tool: 'test-tool' }
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect((result.metadata as any).tool).toBe('test-tool');
    });

    it('should create work items batch', () => {
      const items = createMultipleWorkItems('Task', 3);
      const batch = createWorkItemsBatch(items);

      expect(batch.count).toBe(3);
      expect(batch.value).toHaveLength(3);
    });

    it('should create bulk operation result', () => {
      const result = createBulkOperationResult({
        totalItems: 10,
        successCount: 8
      });

      expect(result).toHaveProperty('totalItems', 10);
      expect(result).toHaveProperty('successCount', 8);
      expect(result).toHaveProperty('failureCount', 2);
    });
  });
});


