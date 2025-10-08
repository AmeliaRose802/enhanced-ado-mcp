/**
 * Azure DevOps API Type Definitions
 * Provides type safety for ADO REST API responses and structures
 */

import type { JSONValue } from './index.js';

/**
 * ADO Identity Reference (user/group)
 * Represents a user or group identity in Azure DevOps
 */
export interface ADOIdentity {
  displayName: string;
  uniqueName: string;
  id: string;
  imageUrl?: string;
}

/**
 * ADO Work Item Relation
 */
export interface ADORelation {
  rel: string;
  url: string;
  attributes?: Record<string, string>;
}

/**
 * ADO Work Item Fields
 * Common system fields - can be extended with custom fields
 * Custom fields use the pattern: 'Custom.FieldName' or 'Namespace.FieldName'
 */
export interface ADOWorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.WorkItemType': string;
  'System.State': string;
  'System.AreaPath'?: string;
  'System.IterationPath'?: string;
  'System.AssignedTo'?: ADOIdentity;
  'System.CreatedDate'?: string;
  'System.ChangedDate'?: string;
  'System.CreatedBy'?: ADOIdentity;
  'System.ChangedBy'?: ADOIdentity;
  'System.Description'?: string;
  'System.Tags'?: string;
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
  'Microsoft.VSTS.Common.Priority'?: number;
  'Microsoft.VSTS.Scheduling.StoryPoints'?: number;
  'Microsoft.VSTS.Scheduling.RemainingWork'?: number;
  /** 
   * Allow additional custom fields
   * Note: Custom fields can be complex objects (like ADOIdentity) or primitive JSON values
   */
  [key: string]: string | number | boolean | ADOIdentity | null | undefined;
}

/**
 * ADO Work Item (full structure)
 */
export interface ADOWorkItem {
  id: number;
  rev: number;
  fields: ADOWorkItemFields;
  relations?: ADORelation[];
  url?: string;
  _links?: Record<string, { href: string }>;
}

/**
 * ADO Work Item Update Field Operation
 * JSON Patch operation for updating work item fields
 */
export interface ADOFieldOperation {
  /** Operation type */
  op: 'add' | 'replace' | 'remove' | 'test';
  /** Field path (e.g., '/fields/System.Title') */
  path: string;
  /** 
   * New value for add/replace operations
   * Can be any JSON-serializable value or Azure DevOps-specific structures
   * Use unknown for flexibility as ADO API accepts various formats
   */
  value?: unknown;
  /** Source path for copy/move operations */
  from?: string;
}

/**
 * ADO WIQL Query Result
 */
export interface ADOWiqlResult {
  queryType: 'flat' | 'tree' | 'oneHop';
  queryResultType: 'workItem' | 'workItemLink';
  asOf: string;
  columns: Array<{ referenceName: string; name: string }>;
  sortColumns?: Array<{ field: { referenceName: string; name: string }; descending: boolean }>;
  workItems: Array<{ id: number; url: string }>;
  workItemRelations?: Array<{
    rel?: string;
    source?: { id: number; url: string };
    target: { id: number; url: string };
  }>;
}

/**
 * ADO Work Items Batch Response
 */
export interface ADOWorkItemsBatch {
  count: number;
  value: ADOWorkItem[];
}

/**
 * ADO Repository
 */
export interface ADORepository {
  id: string;
  name: string;
  url: string;
  project: {
    id: string;
    name: string;
  };
  defaultBranch?: string;
  remoteUrl?: string;
}

/**
 * ADO Comment
 */
export interface ADOComment {
  id: number;
  text: string;
  createdBy: ADOIdentity;
  createdDate: string;
  modifiedBy?: ADOIdentity;
  modifiedDate?: string;
}

/**
 * ADO Comments Response
 */
export interface ADOCommentsResponse {
  totalCount: number;
  count: number;
  comments: ADOComment[];
}

/**
 * ADO Work Item Revision
 */
export interface ADOWorkItemRevision {
  id: number;
  rev: number;
  fields: ADOWorkItemFields;
  url: string;
}

/**
 * ADO Revisions Response
 */
export interface ADORevisionsResponse {
  count: number;
  value: ADOWorkItemRevision[];
}

/**
 * ADO Error Response
 * Standard error structure from Azure DevOps REST API
 */
export interface ADOErrorResponse {
  /** Error identifier */
  $id?: string;
  /** Nested inner exception details */
  innerException?: JSONValue;
  /** Error message */
  message: string;
  /** Exception type name */
  typeName?: string;
  /** Exception type key */
  typeKey?: string;
  /** Numeric error code */
  errorCode?: number;
  /** Event identifier */
  eventId?: number;
}

/**
 * ADO API Response Wrapper
 */
export interface ADOApiResponse<T> {
  value?: T;
  count?: number;
}
