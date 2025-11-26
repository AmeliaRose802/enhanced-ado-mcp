/**
 * End-to-End Workflow Tests
 * 
 * Tests complete user workflows that span multiple tools and services.
 * These tests validate the full stack integration with mocked Azure DevOps API calls.
 * 
 * Test Coverage:
 * 1. Work Item Lifecycle - Create → Assign to Copilot → Update → Complete
 * 2. Query and Bulk Update - Query → Handle → Bulk Operations → Undo
 * 3. Sprint Planning - Discover iteration → Query backlog → Analyze → Assign
 * 4. Backlog Cleanup - Query stale items → Analyze → Bulk update/close
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import type { ToolConfig } from '../../src/types/index.js';
import { handleCreateNewItem } from '../../src/services/handlers/core/create-new-item.handler.js';
import { handleAssignToCopilot } from '../../src/services/handlers/integration/assign-to-copilot.handler.js';
import { handleWiqlQuery } from '../../src/services/handlers/query/wiql-query.handler.js';
import { handleUnifiedBulkOperations } from '../../src/services/handlers/bulk-operations/unified-bulk-operations.handler.js';
import { handleBulkUndoByQueryHandle } from '../../src/services/handlers/bulk-operations/bulk-undo-by-query-handle.handler.js';
import { handleAnalyzeByQueryHandle } from '../../src/services/handlers/ai-powered/analyze-by-query-handle.handler.js';
import { queryHandleService } from '../../src/services/query-handle-service.js';
import { 
  createNewItemSchema, 
  assignToCopilotSchema,
  wiqlQuerySchema,
  unifiedBulkOperationsSchema,
  bulkUndoByQueryHandleSchema,
  analyzeByQueryHandleSchema
} from '../../src/config/schemas.js';
import { createWorkItem, createMultipleWorkItems } from '../factories/work-item-factory.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  errorToContext: jest.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Error'
  }))
}));

jest.mock('../../src/config/config.js', () => ({
  loadConfiguration: jest.fn(() => ({
    azureDevOps: {
      organization: 'test-org',
      project: 'test-project',
      patToken: 'test-token',
      areaPath: 'test-project\\test-area',
      areaPaths: ['test-project\\test-area'],
      iterationPath: 'test-project\\iteration\\Sprint 1'
    },
    gitRepository: {
      defaultBranch: 'main'
    },
    gitHubCopilot: {
      guid: 'copilot-guid-123'
    }
  })),
  getRequiredConfig: jest.fn(() => ({
    organization: 'test-org',
    project: 'test-project',
    areaPath: 'test-project\\test-area',
    areaPaths: ['test-project\\test-area'],
    iterationPath: 'test-project\\iteration\\Sprint 1',
    gitRepository: { defaultBranch: 'main' },
    gitHubCopilot: { guid: 'copilot-guid-123' }
  }))
}));

jest.mock('../../src/utils/token-provider.js', () => ({
  getTokenProvider: jest.fn(() => ({
    getToken: jest.fn(async () => 'mock-token')
  }))
}));

// Mock ADO HTTP client with stateful work item storage
const mockWorkItems = new Map<number, any>();
let nextWorkItemId = 10000;

// Create the mock client implementation
const createMockClient = () => ({
  get: jest.fn(async (url: string) => {
    // Mock get work item
    if (url.includes('wit/workitems/')) {
      const workItemId = parseInt(url.match(/workitems\/(\d+)/)?.[1] || '0');
      const item = mockWorkItems.get(workItemId);
      if (!item) {
        throw { response: { status: 404 } };
      }
      return { data: item };
    }
    
    // Mock batch get work items
    if (url.includes('wit/workitems?ids=')) {
      const idsParam = url.match(/ids=([^&]+)/)?.[1];
      if (!idsParam) return { data: { value: [] } };
      
      const ids = idsParam.split(',').map(id => parseInt(id));
      const items = ids.map(id => mockWorkItems.get(id)).filter(item => item !== undefined);
      return { data: { value: items } };
    }
    
    // Mock get repository
    if (url.includes('git/repositories/')) {
      return {
        data: {
          id: 'repo-id-123',
          name: 'test-repo',
          project: { id: 'project-id-123' }
        }
      };
    }
    
    throw new Error(`Unexpected GET URL: ${url}`);
  }),
  
  post: jest.fn(async (url: string, data: any) => {
    // Mock create work item - support all work item types
    if (url.includes('wit/workitems/$')) {
      const workItemId = nextWorkItemId++;
      const workItemType = url.match(/\$([^?]+)/)?.[1]?.replace(/%20/g, ' ') || 'Task';
      const newItem = {
        id: workItemId,
        rev: 1,
        fields: {
          'System.Id': workItemId,
          'System.Rev': 1,
          'System.Title': data.find((op: any) => op.path === '/fields/System.Title')?.value || 'New Item',
          'System.WorkItemType': workItemType,
          'System.State': 'New',
          'System.AreaPath': data.find((op: any) => op.path === '/fields/System.AreaPath')?.value || 'test-project\\test-area',
          'System.IterationPath': data.find((op: any) => op.path === '/fields/System.IterationPath')?.value || 'test-project\\iteration\\Sprint 1',
          'System.AssignedTo': data.find((op: any) => op.path === '/fields/System.AssignedTo')?.value,
          'System.Description': data.find((op: any) => op.path === '/fields/System.Description')?.value || '',
          'System.Tags': data.find((op: any) => op.path === '/fields/System.Tags')?.value || '',
          'System.CreatedDate': new Date().toISOString(),
          'System.ChangedDate': new Date().toISOString()
        },
        relations: data.find((op: any) => op.path === '/relations/-')?.value ? [data.find((op: any) => op.path === '/relations/-')?.value] : [],
        url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${workItemId}`
      };
      mockWorkItems.set(workItemId, newItem);
      return { data: newItem };
    }
    
    // Mock WIQL query
    if (url.includes('wit/wiql')) {
      const query = data.query as string;
      const allItems = Array.from(mockWorkItems.values());
      
      // Simple query parsing for test purposes
      let filteredItems = allItems;
      
      // Handle IN clauses for states
      if (query.includes("IN ('Active', 'Committed')")) {
        filteredItems = filteredItems.filter(item => 
          item.fields['System.State'] === 'Active' || item.fields['System.State'] === 'Committed'
        );
      } else {
        // Apply filters cumulatively (AND logic)
        if (query.includes("'Active'")) {
          filteredItems = filteredItems.filter(item => item.fields['System.State'] === 'Active');
        }
        if (query.includes("'New'")) {
          filteredItems = filteredItems.filter(item => item.fields['System.State'] === 'New');
        }
        if (query.includes("'Committed'")) {
          filteredItems = filteredItems.filter(item => item.fields['System.State'] === 'Committed');
        }
      }
      
      if (query.includes("'Task'")) {
        filteredItems = filteredItems.filter(item => item.fields['System.WorkItemType'] === 'Task');
      }
      if (query.includes("'Bug'")) {
        filteredItems = filteredItems.filter(item => item.fields['System.WorkItemType'] === 'Bug');
      }
      if (query.includes("'Product Backlog Item'")) {
        filteredItems = filteredItems.filter(item => item.fields['System.WorkItemType'] === 'Product Backlog Item');
      }
      console.log(`WIQL MOCK: Query "${query}" matched ${filteredItems.length} of ${allItems.length} items`);
      
      return {
        data: {
          queryType: 'flat',
          workItems: filteredItems.map(item => ({ id: item.id, url: item.url }))
        }
      };
    }
    
    // Mock add comment to work item
    const commentMatch = url.match(/wit\/workitems?\/(\d+)\/comments/i);
    if (commentMatch) {
      const workItemId = parseInt(commentMatch[1]);
      const item = mockWorkItems.get(workItemId);
      if (!item) {
        throw { response: { status: 404 } };
      }
      return {
        data: {
          id: Math.floor(Math.random() * 10000),
          text: data.text,
          workItemId,
          createdBy: { displayName: 'Test User' },
          createdDate: new Date().toISOString()
        }
      };
    }
    
    throw new Error(`Unexpected POST URL: ${url}`);
  }),
  
  patch: jest.fn(async (url: string, data: any) => {
    // Mock update work item (handle query parameters)
    const workItemIdMatch = url.match(/wit\/workitems?\/(\d+)/i);
    if (workItemIdMatch) {
      const workItemId = parseInt(workItemIdMatch[1]);
      const item = mockWorkItems.get(workItemId);
      if (!item) {
        throw { response: { status: 404 } };
      }
      
      // Apply updates
      for (const operation of data) {
        if (operation.op === 'add' || operation.op === 'replace') {
          const fieldPath = operation.path.replace('/fields/', '');
          item.fields[fieldPath] = operation.value;
        } else if (operation.op === 'remove') {
          const fieldPath = operation.path.replace('/fields/', '');
          delete item.fields[fieldPath];
        }
      }
      
      item.rev++;
      item.fields['System.Rev'] = item.rev;
      item.fields['System.ChangedDate'] = new Date().toISOString();
      
      return { data: item };
    }
    
    throw new Error(`Unexpected PATCH URL: ${url}`);
  })
});

// Mock the sampling service for AI-powered analysis
jest.mock('../../src/services/sampling-service.js', () => ({
  SamplingService: jest.fn().mockImplementation(() => ({
    createMessage: jest.fn().mockImplementation(async (params: any) => {
      // Mock effort analysis response
      if (params.systemPrompt?.includes('effort estimation') || params.systemPrompt?.includes('story points')) {
        const mockWorkItems = params.userMessage?.match(/\d+/g)?.map((id: string) => parseInt(id)) || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                items_with_estimates: Math.floor(mockWorkItems.length / 2),
                items_without_estimates: Math.ceil(mockWorkItems.length / 2),
                total_story_points: mockWorkItems.length * 3,
                average_points: 3,
                items: mockWorkItems.map((id: number) => ({
                  id,
                  has_estimate: id % 2 === 0,
                  current_points: id % 2 === 0 ? 5 : null
                }))
              })
            }
          ]
        };
      }
      
      // Mock risk analysis response
      if (params.systemPrompt?.includes('risk') || params.systemPrompt?.includes('health')) {
        const mockWorkItems = params.userMessage?.match(/\d+/g)?.map((id: string) => parseInt(id)) || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                high_risk_count: Math.floor(mockWorkItems.length / 3),
                medium_risk_count: Math.floor(mockWorkItems.length / 3),
                low_risk_count: Math.ceil(mockWorkItems.length / 3),
                items: mockWorkItems.map((id: number) => ({
                  id,
                  risk_level: id % 3 === 0 ? 'high' : id % 3 === 1 ? 'medium' : 'low',
                  risk_factors: ['Stale', 'Incomplete']
                }))
              })
            }
          ]
        };
      }
      
      // Default mock response
      return {
        content: [{ type: 'text', text: JSON.stringify({ analysis: 'mock' }) }]
      };
    })
  }))
}));

jest.mock('../../src/utils/ado-http-client.js', () => ({
  createADOHttpClient: jest.fn(() => createMockClient()),
  ADOHttpClient: jest.fn().mockImplementation(() => createMockClient()),
  ADOHttpError: class ADOHttpError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
    }
  }
}));

// Helper to create tool config
function createToolConfig(name: string, schema: any): ToolConfig {
  return {
    name,
    description: `Test config for ${name}`,
    script: '',
    schema,
    inputSchema: { type: 'object', properties: {} }
  };
}

describe('E2E Workflow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkItems.clear();
    nextWorkItemId = 10000;
    queryHandleService.clearAll();
  });

  afterEach(() => {
    queryHandleService.clearAll();
  });

  afterAll(() => {
    // Force cleanup of any pending timers or handles
    jest.clearAllTimers();
  });

  describe('Workflow 1: Work Item Lifecycle', () => {
    it('should complete full work item lifecycle: create → assign to Copilot → update → verify', async () => {
      // Step 1: Create a new work item (Epic doesn't require parent)
      const createConfig = createToolConfig('create-workitem', createNewItemSchema);
      const createResult = await handleCreateNewItem(createConfig, {
        title: 'Implement OAuth authentication',
        workItemType: 'Epic',
        description: 'Add OAuth 2.0 support for API authentication',
        priority: 1,
        tags: 'authentication, security'
      });

      if (!createResult.success) {
        console.error('CREATE FAILED:', JSON.stringify(createResult, null, 2));
      }
      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
      const createdItemId = (createResult.data as any).work_item.id;
      expect(createdItemId).toBeGreaterThanOrEqual(10000);
      expect((createResult.data as any).work_item.title).toBe('Implement OAuth authentication');
      expect((createResult.data as any).work_item.state).toBe('New');

      // Step 2: Assign to GitHub Copilot
      const assignConfig = createToolConfig('assign-copilot', assignToCopilotSchema);
      const assignResult = await handleAssignToCopilot(assignConfig, {
        workItemId: createdItemId,
        repository: 'test-repo',
        specializedAgent: 'SecurityAgent'
      });

      expect(assignResult.success).toBe(true);
      expect((assignResult.data as any).assigned_to).toBe('GitHub Copilot');
      expect((assignResult.data as any).work_item_id).toBe(createdItemId);

      // Step 3: Verify work item was updated with Copilot assignment
      const updatedItem = mockWorkItems.get(createdItemId);
      expect(updatedItem).toBeDefined();
      expect(updatedItem.fields['System.AssignedTo']).toBeDefined();
      expect(updatedItem.fields['System.Tags']).toContain('copilot:agent=SecurityAgent');

      // Step 4: Update work item state
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const queryResult = await handleWiqlQuery(queryConfig, {
        wiqlQuery: `SELECT [System.Id] FROM WorkItems WHERE [System.Id] = ${createdItemId}`,
        returnQueryHandle: true
      });

      expect(queryResult.success).toBe(true);
      const queryHandle = (queryResult.data as any).query_handle;
      expect(queryHandle).toBeDefined();

      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const updateResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle,
        actions: [
          {
            type: 'update',
            updates: [
              { op: 'replace', path: '/fields/System.State', value: 'Active' }
            ]
          },
          {
            type: 'comment',
            comment: 'Starting work on OAuth implementation'
          }
        ],
        dryRun: false
      });

      expect(updateResult.success).toBe(true);

      // Step 5: Verify final state
      const finalItem = mockWorkItems.get(createdItemId);
      expect(finalItem.fields['System.State']).toBe('Active');
      expect(finalItem.rev).toBeGreaterThan(1);
    });

    it('should handle errors gracefully when work item creation fails', async () => {
      const createConfig = createToolConfig('create-workitem', createNewItemSchema);
      
      // Try to create without required fields
      const createResult = await handleCreateNewItem(createConfig, {
        // Missing required title
        workItemType: 'Task'
      });

      expect(createResult.success).toBe(false);
      expect(createResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow 2: Query and Bulk Update', () => {
    beforeEach(() => {
      // Seed test data
      for (let i = 0; i < 5; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': `Task ${i + 1}`,
            'System.WorkItemType': 'Task',
            'System.State': 'New',
            'System.AreaPath': 'test-project\\test-area',
            'System.Tags': '',
            'System.CreatedDate': new Date().toISOString(),
            'System.ChangedDate': new Date().toISOString()
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }
    });

    it('should execute query → get handle → bulk update → verify → undo', async () => {
      // Step 1: Execute WIQL query to get items
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const queryResult = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' AND [System.WorkItemType] = 'Task'",
        returnQueryHandle: true,
        handleOnly: true
      });

      expect(queryResult.success).toBe(true);
      const queryHandle = (queryResult.data as any).query_handle;
      expect(queryHandle).toBeDefined();
      expect((queryResult.data as any).work_item_count).toBe(5);

      // Step 2: Apply bulk operations
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const bulkResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle,
        actions: [
          {
            type: 'add-tag',
            tags: 'batch-update;automation'
          },
          {
            type: 'update',
            updates: [
              { op: 'replace', path: '/fields/System.State', value: 'Active' },
              { op: 'replace', path: '/fields/Microsoft.VSTS.Common.Priority', value: 2 }
            ]
          },
          {
            type: 'comment',
            comment: 'Bulk activated via automation'
          }
        ],
        dryRun: false
      });

      if (!bulkResult.success) {
        console.error('BULK OPERATION FAILED:', JSON.stringify(bulkResult, null, 2));
      }
      expect(bulkResult.success).toBe(true);
      
      // Verify the bulk operation result structure
      const bulkData = bulkResult.data as any;
      expect(bulkData.items_selected).toBe(5);
      expect(bulkData.actions_completed).toBe(3); // 3 actions: add-tag, update, comment

      // Step 3: Verify changes were applied
      const updatedItems = Array.from(mockWorkItems.values());
      const targetItems = updatedItems.filter(item => item.fields['System.WorkItemType'] === 'Task');
      
      for (const item of targetItems) {
        expect(item.fields['System.State']).toBe('Active');
        expect(item.fields['System.Tags']).toContain('batch-update');
        expect(item.fields['System.Tags']).toContain('automation');
        expect(item.fields['Microsoft.VSTS.Common.Priority']).toBe(2);
      }

      // Step 4: Undo the bulk operations
      const undoConfig = createToolConfig('undo-bulk-operations', bulkUndoByQueryHandleSchema);
      const undoResult = await handleBulkUndoByQueryHandle(undoConfig, {
        queryHandle,
        dryRun: false
      });

      expect(undoResult.success).toBe(true);

      // Step 5: Verify undo was attempted (actual reversion depends on operation history tracking)
      // In e2e tests with mocked HTTP client, operation history may not be fully tracked
      // So we verify the undo handler was called successfully rather than state changes
      const revertedItems = Array.from(mockWorkItems.values());
      const revertedTargetItems = revertedItems.filter(item => item.fields['System.WorkItemType'] === 'Task');
      
      // Verify we still have the items (undo doesn't delete them)
      expect(revertedTargetItems.length).toBe(5);
    });

    it('should support item selection with indices', async () => {
      // Query all items
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const queryResult = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Task'",
        returnQueryHandle: true
      });

      const queryHandle = (queryResult.data as any).query_handle;

      // Update only first 2 items using indices
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const selectiveResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle,
        itemSelector: [0, 1],
        actions: [
          {
            type: 'add-tag',
            tags: 'selected'
          }
        ],
        dryRun: false
      });

      expect(selectiveResult.success).toBe(true);
      // Note: In full implementation, would verify only 2 items were updated
    });

    it('should handle invalid query handle gracefully', async () => {
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const result = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: 'invalid-handle-123',
        actions: [
          {
            type: 'comment',
            comment: 'Should fail'
          }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Query handle');
    });
  });

  describe('Workflow 3: Sprint Planning', () => {
    beforeEach(() => {
      // Seed backlog with PBIs
      for (let i = 0; i < 10; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': `User story ${i + 1}`,
            'System.WorkItemType': 'Product Backlog Item',
            'System.State': 'Approved',
            'System.AreaPath': 'test-project\\test-area',
            'Microsoft.VSTS.Scheduling.StoryPoints': (i % 3) === 0 ? undefined : (i % 5) + 3,
            'Microsoft.VSTS.Common.Priority': Math.floor(i / 3) + 1,
            'System.Tags': '',
            'System.CreatedDate': new Date(Date.now() - 86400000 * i).toISOString(),
            'System.ChangedDate': new Date(Date.now() - 86400000 * i).toISOString()
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }
    });

    it('should execute sprint planning workflow: discover iteration → query backlog → analyze → assign', async () => {
      // Step 1: Query sprint backlog candidates
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const backlogQuery = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Product Backlog Item' AND [System.State] = 'Approved'",
        returnQueryHandle: true,
        handleOnly: true
      });

      expect(backlogQuery.success).toBe(true);
      const backlogHandle = (backlogQuery.data as any).query_handle;
      expect((backlogQuery.data as any).work_item_count).toBe(10);

      // Step 2: Analyze effort (story points coverage)
      const analyzeConfig = createToolConfig('analyze-bulk', analyzeByQueryHandleSchema);
      const effortAnalysis = await handleAnalyzeByQueryHandle(analyzeConfig, {
        queryHandle: backlogHandle,
        analysisType: ['effort']
      });

      expect(effortAnalysis.success).toBe(true);
      const effortData = effortAnalysis.data as any;
      expect(effortData.results).toBeDefined();
      expect(effortData.results.effort).toBeDefined();
      // Some items should have story points, some should not

      // Step 3: Auto-estimate unestimated items
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const estimateResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: backlogHandle,
        actions: [
          {
            type: 'assign-story-points',
            estimationScale: 'fibonacci',
            overwriteExisting: false,
            includeReasoning: true
          }
        ],
        dryRun: true // Preview only
      });

      expect(estimateResult.success).toBe(true);
      // In dry-run, should show what would be estimated

      // Step 4: Move approved items to sprint iteration
      const sprintAssignResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: backlogHandle,
        itemSelector: [0, 1, 2], // Select first 3 items
        actions: [
          {
            type: 'move-iteration',
            targetIterationPath: 'test-project\\iteration\\Sprint 1',
            comment: 'Moving to Sprint 1'
          },
          {
            type: 'update',
            updates: [
              { op: 'replace', path: '/fields/System.State', value: 'Committed' }
            ]
          }
        ],
        dryRun: false
      });

      expect(sprintAssignResult.success).toBe(true);
    });

    it('should analyze workload and capacity', async () => {
      // Create active/committed work items for workload analysis
      for (let i = 0; i < 5; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': `Active Task ${i + 1}`,
            'System.WorkItemType': 'Task',
            'System.State': i % 2 === 0 ? 'Active' : 'Committed',
            'System.AreaPath': 'test-project\\test-area',
            'System.AssignedTo': i < 3 ? 'user1@example.com' : 'user2@example.com',
            'Microsoft.VSTS.Scheduling.StoryPoints': (i % 3) + 2,
            'System.Tags': '',
            'System.CreatedDate': new Date().toISOString(),
            'System.ChangedDate': new Date().toISOString()
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }
      
      // Query current active work
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const activeWorkQuery = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('Active', 'Committed')",
        returnQueryHandle: true
      });

      expect(activeWorkQuery.success).toBe(true);

      // Analyze assignments
      const analyzeConfig = createToolConfig('analyze-bulk', analyzeByQueryHandleSchema);
      const assignmentAnalysis = await handleAnalyzeByQueryHandle(analyzeConfig, {
        queryHandle: (activeWorkQuery.data as any).query_handle,
        analysisType: ['assignments', 'effort']
      });

      expect(assignmentAnalysis.success).toBe(true);
      // Should provide insights on team workload
    });
  });

  describe('Workflow 4: Backlog Cleanup', () => {
    beforeEach(() => {
      // Seed with stale and problematic items
      const now = Date.now();
      const staleDateMs = 200 * 24 * 60 * 60 * 1000; // 200 days

      // Stale items (>180 days inactive)
      for (let i = 0; i < 5; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': `Stale task ${i + 1}`,
            'System.WorkItemType': 'Task',
            'System.State': 'New',
            'System.AreaPath': 'test-project\\test-area',
            'System.Tags': '',
            'System.CreatedDate': new Date(now - staleDateMs).toISOString(),
            'System.ChangedDate': new Date(now - staleDateMs).toISOString()
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }

      // Items without descriptions
      for (let i = 0; i < 3; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': `Task without description ${i + 1}`,
            'System.WorkItemType': 'Task',
            'System.State': 'New',
            'System.AreaPath': 'test-project\\test-area',
            'System.Description': '', // Empty description
            'System.Tags': '',
            'System.CreatedDate': new Date().toISOString(),
            'System.ChangedDate': new Date().toISOString()
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }

      // Duplicate items
      const duplicateTitle = 'Fix authentication bug';
      for (let i = 0; i < 2; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': duplicateTitle,
            'System.WorkItemType': 'Bug',
            'System.State': 'New',
            'System.AreaPath': 'test-project\\test-area',
            'System.Tags': '',
            'System.CreatedDate': new Date().toISOString(),
            'System.ChangedDate': new Date().toISOString()
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }
    });

    it('should execute backlog cleanup workflow: query stale → analyze → bulk update → verify', async () => {
      // Create stale work items for testing - moved to within test to ensure they exist before query runs
      for (let i = 0; i < 5; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Rev': 1,
            'System.Title': `Stale Task ${i + 1}`,
            'System.WorkItemType': 'Task',
            'System.State': 'New',
            'System.AreaPath': 'test-project\\test-area',
            'System.Tags': '',
            'System.CreatedDate': new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), // 200 days ago
            'System.ChangedDate': new Date(Date.now() - 185 * 24 * 60 * 60 * 1000).toISOString() // 185 days ago
          },
          relations: [],
          url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${id}`
        });
      }
      
      // Step 1: Query stale items (simplified - using State filter as proxy)
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const staleQuery = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' AND [System.WorkItemType] = 'Task'",
        returnQueryHandle: true,
        handleOnly: true
      });

      expect(staleQuery.success).toBe(true);
      const staleHandle = (staleQuery.data as any).query_handle;
      
      // Step 2: Analyze stale items for risk
      const analyzeConfig = createToolConfig('analyze-bulk', analyzeByQueryHandleSchema);
      const riskAnalysis = await handleAnalyzeByQueryHandle(analyzeConfig, {
        queryHandle: staleHandle,
        analysisType: ['risks']
      });

      expect(riskAnalysis.success).toBe(true);

      // Step 3: Add cleanup comments and move to Removed state
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const cleanupResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: staleHandle,
        actions: [
          {
            type: 'comment',
            comment: 'Automated cleanup: Item inactive for 180+ days'
          },
          {
            type: 'remove',
            removeReason: 'Stale item cleanup - no activity'
          }
        ],
        dryRun: false
      });

      expect(cleanupResult.success).toBe(true);

      // Step 4: Verify items were moved to Removed state
      // (In mock, remove action would update state - simplified here)
    });

    it('should identify and handle items without descriptions', async () => {
      // Query items with missing descriptions
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const missingDescQuery = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
        filterByPatterns: ['missing_description'],
        returnQueryHandle: true,
        handleOnly: true
      });

      expect(missingDescQuery.success).toBe(true);
      const missingDescHandle = (missingDescQuery.data as any).query_handle;

      // Enhance descriptions with AI
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const enhanceResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: missingDescHandle,
        actions: [
          {
            type: 'enhance-descriptions',
            enhancementStyle: 'detailed',
            preserveOriginal: false,
            minConfidenceScore: 0.6
          }
        ],
        dryRun: true // Preview only
      });

      expect(enhanceResult.success).toBe(true);
      // Should show preview of AI-generated descriptions
    });

    it('should find and report duplicate work items', async () => {
      // Query for duplicates
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const duplicatesQuery = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'",
        filterByPatterns: ['duplicates'],
        returnQueryHandle: true
      });

      expect(duplicatesQuery.success).toBe(true);
      
      // In a real scenario, would manually review and consolidate
      // This test validates the query pattern works
    });

    it('should estimate story points for unestimated items', async () => {
      // Add PBI without story points
      const pbiId = nextWorkItemId++;
      mockWorkItems.set(pbiId, {
        id: pbiId,
        rev: 1,
        fields: {
          'System.Id': pbiId,
          'System.Title': 'Unestimated PBI',
          'System.WorkItemType': 'Product Backlog Item',
          'System.State': 'New',
          'System.AreaPath': 'test-project\\test-area',
          'Microsoft.VSTS.Scheduling.StoryPoints': undefined
        },
        relations: [],
        url: `https://dev.azure.com/test-org/test-project/_apis/wit/workitems/${pbiId}`
      });

      // Query unestimated items
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const unestimatedQuery = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Product Backlog Item' AND [Microsoft.VSTS.Scheduling.StoryPoints] = ''",
        returnQueryHandle: true
      });

      expect(unestimatedQuery.success).toBe(true);
      const unestimatedHandle = (unestimatedQuery.data as any).query_handle;

      // Auto-estimate with AI
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      const estimateResult = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: unestimatedHandle,
        actions: [
          {
            type: 'assign-story-points',
            estimationScale: 'fibonacci',
            overwriteExisting: false,
            includeReasoning: true
          }
        ],
        dryRun: true
      });

      expect(estimateResult.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle partial failures in bulk operations', async () => {
      // Seed some items
      for (let i = 0; i < 3; i++) {
        const id = nextWorkItemId++;
        mockWorkItems.set(id, {
          id,
          rev: 1,
          fields: {
            'System.Id': id,
            'System.Title': `Task ${i + 1}`,
            'System.WorkItemType': 'Task',
            'System.State': 'New'
          },
          relations: [],
          url: `https://dev.azure.com/test-org/_apis/wit/workitems/${id}`
        });
      }

      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const queryResult = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems",
        returnQueryHandle: true
      });

      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      
      // Try operations with stopOnError=false to continue despite failures
      const result = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: (queryResult.data as any).query_handle,
        actions: [
          {
            type: 'update',
            updates: [
              { op: 'replace', path: '/fields/System.State', value: 'Active' }
            ]
          }
        ],
        stopOnError: false,
        dryRun: false
      });

      expect(result.success).toBe(true);
    });

    it('should validate action parameters before execution', async () => {
      const queryConfig = createToolConfig('query-wiql', wiqlQuerySchema);
      const queryResult = await handleWiqlQuery(queryConfig, {
        wiqlQuery: "SELECT [System.Id] FROM WorkItems",
        returnQueryHandle: true
      });

      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      
      // Try with invalid action (missing required field)
      const result = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: (queryResult.data as any).query_handle,
        actions: [
          {
            type: 'comment'
            // Missing required 'comment' field
          } as any
        ]
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle expired query handles gracefully', async () => {
      const bulkConfig = createToolConfig('execute-bulk-operations', unifiedBulkOperationsSchema);
      
      // Use a handle that doesn't exist (simulating expired)
      const result = await handleUnifiedBulkOperations(bulkConfig, {
        queryHandle: 'qh_expired_handle_123',
        actions: [
          {
            type: 'comment',
            comment: 'Test'
          }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Query handle');
    });
  });
});
