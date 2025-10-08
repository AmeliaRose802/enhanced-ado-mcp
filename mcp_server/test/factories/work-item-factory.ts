/**
 * Work Item Factory
 * 
 * Provides flexible factory functions to create work items with customizable properties.
 * Uses sensible defaults from fixtures while allowing overrides for specific test cases.
 */

import type { ADOWorkItem, ADOWorkItemFields, ADOIdentity, ADORelation } from '../../src/types/ado.js';
import type { WorkItemContext } from '../../src/types/work-items.js';
import { 
  BASE_WORK_ITEM_FIELDS, 
  TEST_IDENTITY,
  PBI_WORK_ITEM,
  BUG_WORK_ITEM,
  TASK_WORK_ITEM,
  FEATURE_WORK_ITEM,
  EPIC_WORK_ITEM
} from '../fixtures/work-items.js';

/**
 * Options for creating a work item
 */
export interface WorkItemFactoryOptions {
  id?: number;
  rev?: number;
  title?: string;
  type?: string;
  state?: string;
  assignedTo?: ADOIdentity | null;
  description?: string;
  acceptanceCriteria?: string;
  priority?: number;
  storyPoints?: number;
  remainingWork?: number;
  tags?: string;
  areaPath?: string;
  iterationPath?: string;
  createdDate?: string;
  changedDate?: string;
  relations?: ADORelation[];
  fields?: Partial<ADOWorkItemFields>;
}

/**
 * Options for creating work item context
 */
export interface WorkItemContextFactoryOptions {
  title?: string;
  state?: string;
  type?: string;
  assignedTo?: string;
  daysInactive?: number;
  lastSubstantiveChangeDate?: string;
  lastSubstantiveChangeBy?: string;
  tags?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  storyPoints?: number;
  description?: string;
  acceptanceCriteria?: string;
  createdDate?: string;
  changedDate?: string;
}

/**
 * Creates a work item with default values and optional overrides
 * 
 * @example
 * ```typescript
 * // Create a basic task
 * const task = createWorkItem({ type: 'Task', title: 'My Task' });
 * 
 * // Create a PBI with custom story points
 * const pbi = createWorkItem({ 
 *   type: 'Product Backlog Item',
 *   storyPoints: 13
 * });
 * ```
 */
export function createWorkItem(options: WorkItemFactoryOptions = {}): ADOWorkItem {
  const id = options.id ?? 99999;
  const type = options.type ?? 'Task';
  const state = options.state ?? 'New';
  const title = options.title ?? `Test ${type}`;
  
  const fields: ADOWorkItemFields = {
    'System.Id': id,
    'System.Title': title,
    'System.WorkItemType': type,
    'System.State': state,
    ...BASE_WORK_ITEM_FIELDS,
    ...options.fields
  } as ADOWorkItemFields;

  // Add optional fields if provided
  if (options.assignedTo !== undefined) {
    if (options.assignedTo === null) {
      delete fields['System.AssignedTo'];
    } else {
      fields['System.AssignedTo'] = options.assignedTo;
    }
  } else {
    fields['System.AssignedTo'] = TEST_IDENTITY;
  }

  if (options.description !== undefined) {
    fields['System.Description'] = options.description;
  }

  if (options.acceptanceCriteria !== undefined) {
    fields['Microsoft.VSTS.Common.AcceptanceCriteria'] = options.acceptanceCriteria;
  }

  if (options.priority !== undefined) {
    fields['Microsoft.VSTS.Common.Priority'] = options.priority;
  }

  if (options.storyPoints !== undefined) {
    fields['Microsoft.VSTS.Scheduling.StoryPoints'] = options.storyPoints;
  }

  if (options.remainingWork !== undefined) {
    fields['Microsoft.VSTS.Scheduling.RemainingWork'] = options.remainingWork;
  }

  if (options.tags !== undefined) {
    fields['System.Tags'] = options.tags;
  }

  if (options.areaPath !== undefined) {
    fields['System.AreaPath'] = options.areaPath;
  }

  if (options.iterationPath !== undefined) {
    fields['System.IterationPath'] = options.iterationPath;
  }

  if (options.createdDate !== undefined) {
    fields['System.CreatedDate'] = options.createdDate;
  }

  if (options.changedDate !== undefined) {
    fields['System.ChangedDate'] = options.changedDate;
  }

  return {
    id,
    rev: options.rev ?? 1,
    url: `https://dev.azure.com/test-org/test-project/_workitems/edit/${id}`,
    fields,
    relations: options.relations ?? []
  };
}

/**
 * Creates a Product Backlog Item with optional overrides
 */
export function createPBI(options: Partial<WorkItemFactoryOptions> = {}): ADOWorkItem {
  return createWorkItem({
    ...PBI_WORK_ITEM,
    type: 'Product Backlog Item',
    ...options
  });
}

/**
 * Creates a Bug with optional overrides
 */
export function createBug(options: Partial<WorkItemFactoryOptions> = {}): ADOWorkItem {
  return createWorkItem({
    ...BUG_WORK_ITEM,
    type: 'Bug',
    ...options
  });
}

/**
 * Creates a Task with optional overrides
 */
export function createTask(options: Partial<WorkItemFactoryOptions> = {}): ADOWorkItem {
  return createWorkItem({
    ...TASK_WORK_ITEM,
    type: 'Task',
    ...options
  });
}

/**
 * Creates a Feature with optional overrides
 */
export function createFeature(options: Partial<WorkItemFactoryOptions> = {}): ADOWorkItem {
  return createWorkItem({
    ...FEATURE_WORK_ITEM,
    type: 'Feature',
    ...options
  });
}

/**
 * Creates an Epic with optional overrides
 */
export function createEpic(options: Partial<WorkItemFactoryOptions> = {}): ADOWorkItem {
  return createWorkItem({
    ...EPIC_WORK_ITEM,
    type: 'Epic',
    ...options
  });
}

/**
 * Creates work item context with default values and optional overrides
 * 
 * @example
 * ```typescript
 * const context = createWorkItemContext({
 *   title: 'My Task',
 *   state: 'Active',
 *   daysInactive: 5
 * });
 * ```
 */
export function createWorkItemContext(options: WorkItemContextFactoryOptions = {}): WorkItemContext {
  return {
    title: options.title ?? 'Test Work Item',
    state: options.state ?? 'New',
    type: options.type ?? 'Task',
    assignedTo: options.assignedTo ?? 'Test User',
    daysInactive: options.daysInactive ?? 0,
    lastSubstantiveChangeDate: options.lastSubstantiveChangeDate,
    lastSubstantiveChangeBy: options.lastSubstantiveChangeBy,
    tags: options.tags ?? 'test',
    areaPath: options.areaPath ?? 'TestProject\\TestArea',
    iterationPath: options.iterationPath ?? 'TestProject\\Sprint 1',
    priority: options.priority,
    storyPoints: options.storyPoints,
    description: options.description,
    acceptanceCriteria: options.acceptanceCriteria,
    createdDate: options.createdDate ?? '2024-01-01T10:00:00Z',
    changedDate: options.changedDate ?? '2024-01-15T14:30:00Z'
  };
}

/**
 * Creates a parent-child relationship between two work items
 * 
 * @example
 * ```typescript
 * const parent = createPBI({ id: 1000 });
 * const child = createTask({ id: 2000 });
 * const [parentWithChild, childWithParent] = createParentChildRelation(parent, child);
 * ```
 */
export function createParentChildRelation(
  parent: ADOWorkItem,
  child: ADOWorkItem
): [ADOWorkItem, ADOWorkItem] {
  const parentRelation: ADORelation = {
    rel: 'System.LinkTypes.Hierarchy-Reverse',
    url: `https://dev.azure.com/test-org/test-project/_apis/wit/workItems/${parent.id}`,
    attributes: { name: 'Parent' }
  };

  const childRelation: ADORelation = {
    rel: 'System.LinkTypes.Hierarchy-Forward',
    url: `https://dev.azure.com/test-org/test-project/_apis/wit/workItems/${child.id}`,
    attributes: { name: 'Child' }
  };

  return [
    { ...parent, relations: [...(parent.relations ?? []), childRelation] },
    { ...child, relations: [...(child.relations ?? []), parentRelation] }
  ];
}

/**
 * Creates multiple work items of the same type
 * 
 * @example
 * ```typescript
 * const tasks = createMultipleWorkItems('Task', 5, { state: 'Active' });
 * // Creates 5 tasks with IDs 10000-10004, all in Active state
 * ```
 */
export function createMultipleWorkItems(
  type: string,
  count: number,
  baseOptions: WorkItemFactoryOptions = {}
): ADOWorkItem[] {
  return Array.from({ length: count }, (_, i) => 
    createWorkItem({
      ...baseOptions,
      id: (baseOptions.id ?? 10000) + i,
      title: baseOptions.title ?? `${type} ${i + 1}`,
      type
    })
  );
}

/**
 * Creates a Map of work item contexts for query handle testing
 * 
 * @example
 * ```typescript
 * const workItems = createMultipleWorkItems('Task', 3);
 * const contextMap = createContextMap(workItems);
 * ```
 */
export function createContextMap(workItems: ADOWorkItem[]): Map<number, WorkItemContext> {
  const map = new Map<number, WorkItemContext>();
  
  workItems.forEach(item => {
    const context = createWorkItemContext({
      title: item.fields['System.Title'],
      state: item.fields['System.State'],
      type: item.fields['System.WorkItemType'],
      assignedTo: item.fields['System.AssignedTo']?.displayName,
      tags: item.fields['System.Tags'],
      areaPath: item.fields['System.AreaPath'],
      iterationPath: item.fields['System.IterationPath'],
      priority: item.fields['Microsoft.VSTS.Common.Priority'],
      storyPoints: item.fields['Microsoft.VSTS.Scheduling.StoryPoints'],
      description: item.fields['System.Description'],
      acceptanceCriteria: item.fields['Microsoft.VSTS.Common.AcceptanceCriteria'],
      createdDate: item.fields['System.CreatedDate'],
      changedDate: item.fields['System.ChangedDate']
    });
    
    map.set(item.id, context);
  });
  
  return map;
}
