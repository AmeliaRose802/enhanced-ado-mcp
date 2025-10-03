/**
 * Azure DevOps API Type Definitions
 * Provides type safety for ADO REST API responses and structures
 */

/**
 * ADO Identity Reference (user/group)
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
  [key: string]: unknown; // Allow additional custom fields
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
 */
export interface ADOFieldOperation {
  op: 'add' | 'replace' | 'remove' | 'test';
  path: string;
  value?: unknown;
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
 */
export interface ADOErrorResponse {
  $id?: string;
  innerException?: unknown;
  message: string;
  typeName?: string;
  typeKey?: string;
  errorCode?: number;
  eventId?: number;
}

/**
 * ADO API Response Wrapper
 */
export interface ADOApiResponse<T> {
  value?: T;
  count?: number;
}
