/**
 * Work Item Test Fixtures
 * 
 * Provides standardized test data for work items of various types.
 * These fixtures can be used directly or passed to factories for customization.
 */

import type { ADOWorkItem, ADOWorkItemFields, ADOIdentity, ADORelation } from '../../src/types/ado.js';
import type { WorkItemContext } from '../../src/types/work-items.js';

/**
 * Standard test identity for assignees
 */
export const TEST_IDENTITY: ADOIdentity = {
  displayName: 'Test User',
  uniqueName: 'testuser@example.com',
  id: 'test-user-id-123'
};

/**
 * Base work item fields that are common across all types
 */
export const BASE_WORK_ITEM_FIELDS: Partial<ADOWorkItemFields> = {
  'System.CreatedDate': '2024-01-01T10:00:00Z',
  'System.ChangedDate': '2024-01-15T14:30:00Z',
  'System.CreatedBy': TEST_IDENTITY,
  'System.ChangedBy': TEST_IDENTITY,
  'System.AreaPath': 'TestProject\\TestArea',
  'System.IterationPath': 'TestProject\\Sprint 1',
  'System.Tags': 'test; automation'
};

/**
 * Product Backlog Item (PBI) fixture
 */
export const PBI_WORK_ITEM: ADOWorkItem = {
  id: 1001,
  rev: 3,
  url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/1001',
  fields: {
    'System.Id': 1001,
    'System.Title': 'Implement user authentication',
    'System.WorkItemType': 'Product Backlog Item',
    'System.State': 'Active',
    'System.AssignedTo': TEST_IDENTITY,
    'System.Description': '<div>User authentication is needed to secure the application.</div>',
    'Microsoft.VSTS.Common.AcceptanceCriteria': '<div>Users can log in and log out successfully.</div>',
    'Microsoft.VSTS.Common.Priority': 1,
    'Microsoft.VSTS.Scheduling.StoryPoints': 8,
    ...BASE_WORK_ITEM_FIELDS
  } as ADOWorkItemFields,
  relations: []
};

/**
 * Bug work item fixture
 */
export const BUG_WORK_ITEM: ADOWorkItem = {
  id: 2001,
  rev: 2,
  url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/2001',
  fields: {
    'System.Id': 2001,
    'System.Title': 'Login button not responding',
    'System.WorkItemType': 'Bug',
    'System.State': 'New',
    'System.AssignedTo': TEST_IDENTITY,
    'System.Description': '<div>The login button does not respond when clicked.</div>',
    'Microsoft.VSTS.Common.Priority': 2,
    'Microsoft.VSTS.Scheduling.RemainingWork': 4,
    ...BASE_WORK_ITEM_FIELDS
  } as ADOWorkItemFields,
  relations: []
};

/**
 * Task work item fixture
 */
export const TASK_WORK_ITEM: ADOWorkItem = {
  id: 3001,
  rev: 1,
  url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/3001',
  fields: {
    'System.Id': 3001,
    'System.Title': 'Write unit tests for authentication',
    'System.WorkItemType': 'Task',
    'System.State': 'In Progress',
    'System.AssignedTo': TEST_IDENTITY,
    'System.Description': '<div>Create comprehensive unit tests for the authentication module.</div>',
    'Microsoft.VSTS.Common.Priority': 2,
    'Microsoft.VSTS.Scheduling.RemainingWork': 6,
    ...BASE_WORK_ITEM_FIELDS
  } as ADOWorkItemFields,
  relations: []
};

/**
 * Feature work item fixture
 */
export const FEATURE_WORK_ITEM: ADOWorkItem = {
  id: 4001,
  rev: 5,
  url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/4001',
  fields: {
    'System.Id': 4001,
    'System.Title': 'User Management System',
    'System.WorkItemType': 'Feature',
    'System.State': 'Active',
    'System.AssignedTo': TEST_IDENTITY,
    'System.Description': '<div>Complete user management functionality including CRUD operations.</div>',
    'Microsoft.VSTS.Common.AcceptanceCriteria': '<div>All user management features are implemented and tested.</div>',
    'Microsoft.VSTS.Common.Priority': 1,
    'Microsoft.VSTS.Scheduling.StoryPoints': 20,
    ...BASE_WORK_ITEM_FIELDS
  } as ADOWorkItemFields,
  relations: []
};

/**
 * Epic work item fixture
 */
export const EPIC_WORK_ITEM: ADOWorkItem = {
  id: 5001,
  rev: 8,
  url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/5001',
  fields: {
    'System.Id': 5001,
    'System.Title': 'Platform Modernization',
    'System.WorkItemType': 'Epic',
    'System.State': 'In Progress',
    'System.AssignedTo': TEST_IDENTITY,
    'System.Description': '<div>Modernize the entire platform architecture.</div>',
    'Microsoft.VSTS.Common.Priority': 1,
    ...BASE_WORK_ITEM_FIELDS
  } as ADOWorkItemFields,
  relations: []
};

/**
 * Unassigned work item fixture
 */
export const UNASSIGNED_WORK_ITEM: ADOWorkItem = {
  id: 6001,
  rev: 1,
  url: 'https://dev.azure.com/test-org/test-project/_workitems/edit/6001',
  fields: {
    'System.Id': 6001,
    'System.Title': 'Unassigned task',
    'System.WorkItemType': 'Task',
    'System.State': 'New',
    'System.Description': '<div>This task has not been assigned yet.</div>',
    ...BASE_WORK_ITEM_FIELDS
  } as ADOWorkItemFields,
  relations: []
};

/**
 * Parent relation for testing hierarchies
 */
export const PARENT_RELATION: ADORelation = {
  rel: 'System.LinkTypes.Hierarchy-Reverse',
  url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/1001',
  attributes: {
    name: 'Parent'
  }
};

/**
 * Child relation for testing hierarchies
 */
export const CHILD_RELATION: ADORelation = {
  rel: 'System.LinkTypes.Hierarchy-Forward',
  url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/3001',
  attributes: {
    name: 'Child'
  }
};

/**
 * Work item context for PBI
 */
export const PBI_CONTEXT: WorkItemContext = {
  title: 'Implement user authentication',
  state: 'Active',
  type: 'Product Backlog Item',
  assignedTo: 'Test User',
  daysInactive: 5,
  tags: 'test; automation',
  areaPath: 'TestProject\\TestArea',
  iterationPath: 'TestProject\\Sprint 1',
  priority: 1,
  storyPoints: 8,
  description: 'User authentication is needed to secure the application.',
  acceptanceCriteria: 'Users can log in and log out successfully.',
  createdDate: '2024-01-01T10:00:00Z',
  changedDate: '2024-01-15T14:30:00Z'
};

/**
 * Work item context for Bug
 */
export const BUG_CONTEXT: WorkItemContext = {
  title: 'Login button not responding',
  state: 'New',
  type: 'Bug',
  assignedTo: 'Test User',
  daysInactive: 2,
  tags: 'test; automation',
  areaPath: 'TestProject\\TestArea',
  iterationPath: 'TestProject\\Sprint 1',
  priority: 2,
  description: 'The login button does not respond when clicked.',
  createdDate: '2024-01-01T10:00:00Z',
  changedDate: '2024-01-15T14:30:00Z'
};

/**
 * Work item context for Task
 */
export const TASK_CONTEXT: WorkItemContext = {
  title: 'Write unit tests for authentication',
  state: 'In Progress',
  type: 'Task',
  assignedTo: 'Test User',
  daysInactive: 1,
  tags: 'test; automation',
  areaPath: 'TestProject\\TestArea',
  iterationPath: 'TestProject\\Sprint 1',
  priority: 2,
  description: 'Create comprehensive unit tests for the authentication module.',
  createdDate: '2024-01-01T10:00:00Z',
  changedDate: '2024-01-15T14:30:00Z'
};

/**
 * Array of all work item fixtures for bulk operations testing
 */
export const ALL_WORK_ITEMS: ADOWorkItem[] = [
  PBI_WORK_ITEM,
  BUG_WORK_ITEM,
  TASK_WORK_ITEM,
  FEATURE_WORK_ITEM,
  EPIC_WORK_ITEM,
  UNASSIGNED_WORK_ITEM
];

/**
 * Map of work item contexts for query handle testing
 */
export const ALL_CONTEXTS: Map<number, WorkItemContext> = new Map([
  [1001, PBI_CONTEXT],
  [2001, BUG_CONTEXT],
  [3001, TASK_CONTEXT]
]);
