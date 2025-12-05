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
  'Microsoft.VSTS.Scheduling.Effort'?: number;  // Story points field used in Scrum/Agile templates
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
 * Note: relations field is optional and only included when $expand=relations is specified
 */
export interface ADOWorkItemRevision {
  id: number;
  rev: number;
  fields: ADOWorkItemFields;
  url: string;
  relations?: ADORelation[];  // Optional - only present with $expand=relations
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

/**
 * ADO Pull Request Iteration
 * Represents a single iteration of a pull request
 */
export interface ADOPullRequestIteration {
  id: number;
  description?: string;
  author: ADOIdentity;
  createdDate: string;
  updatedDate: string;
  sourceRefCommit: {
    commitId: string;
    url: string;
  };
  targetRefCommit: {
    commitId: string;
    url: string;
  };
  commonRefCommit?: {
    commitId: string;
    url: string;
  };
}

/**
 * ADO Pull Request Iterations Response
 */
export interface ADOPullRequestIterationsResponse {
  count: number;
  value: ADOPullRequestIteration[];
}

/**
 * ADO Git Item Change
 * Represents a single file change in a pull request
 */
export interface ADOGitItemChange {
  changeType: 'add' | 'edit' | 'delete' | 'rename' | 'sourceRename';
  item: {
    objectId: string;
    originalObjectId?: string;
    gitObjectType: 'blob' | 'tree' | 'commit' | 'tag';
    commitId: string;
    path: string;
    isFolder: boolean;
    url: string;
  };
  sourceServerItem?: string;
}

/**
 * ADO Pull Request Changes Response
 * Contains the list of changed files in a PR iteration
 */
export interface ADOPullRequestChangesResponse {
  changeEntries: ADOGitItemChange[];
  changeCounts?: {
    [changeType: string]: number;
  };
}

/**
 * ADO Pull Request
 * Represents a pull request in Azure DevOps
 */
export interface ADOPullRequest {
  pullRequestId: number;
  codeReviewId?: number;
  status: 'active' | 'abandoned' | 'completed' | 'notSet';
  createdBy: ADOIdentity;
  creationDate: string;
  closedDate?: string;
  title: string;
  description?: string;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: 'succeeded' | 'failed' | 'conflicts' | 'queued' | 'rejectedByPolicy' | 'notSet';
  isDraft?: boolean;
  mergeId?: string;
  lastMergeSourceCommit?: {
    commitId: string;
    url: string;
  };
  lastMergeTargetCommit?: {
    commitId: string;
    url: string;
  };
  reviewers?: Array<{
    reviewerUrl: string;
    vote: number;
    displayName: string;
    uniqueName: string;
    id: string;
    imageUrl: string;
  }>;
  url: string;
  repository?: {
    id: string;
    name: string;
    url: string;
    project: {
      id: string;
      name: string;
    };
  };
  completionOptions?: {
    mergeCommitMessage?: string;
    deleteSourceBranch?: boolean;
    squashMerge?: boolean;
    mergeStrategy?: string;
  };
  supportsIterations?: boolean;
  artifactId?: string;
}

/**
 * ADO Pull Requests Search Response
 */
export interface ADOPullRequestsResponse {
  value: ADOPullRequest[];
  count: number;
}

/**
 * ADO Pull Request Thread Comment
 * Represents a single comment in a thread
 */
export interface ADOPullRequestComment {
  id: number;
  parentCommentId?: number;
  author: ADOIdentity;
  content: string;
  publishedDate: string;
  lastUpdatedDate?: string;
  lastContentUpdatedDate?: string;
  commentType: 'unknown' | 'text' | 'codeChange' | 'system';
  usersLiked?: ADOIdentity[];
  _links?: {
    self: { href: string };
    repository: { href: string };
    threads: { href: string };
    pullRequests: { href: string };
  };
}

/**
 * ADO Pull Request Thread Context
 * Optional context for where a thread is located in the code
 */
export interface ADOPullRequestThreadContext {
  filePath?: string;
  leftFileStart?: { line: number; offset: number };
  leftFileEnd?: { line: number; offset: number };
  rightFileStart?: { line: number; offset: number };
  rightFileEnd?: { line: number; offset: number };
}

/**
 * ADO Pull Request Thread
 * Represents a discussion thread in a pull request
 */
export interface ADOPullRequestThread {
  id: number;
  publishedDate: string;
  lastUpdatedDate?: string;
  comments: ADOPullRequestComment[];
  status: 'unknown' | 'active' | 'fixed' | 'wontFix' | 'closed' | 'byDesign' | 'pending';
  threadContext?: ADOPullRequestThreadContext;
  properties?: {
    [key: string]: unknown;
  };
  identities?: {
    [id: string]: ADOIdentity;
  };
  isDeleted?: boolean;
  _links?: {
    self: { href: string };
    repository: { href: string };
  };
  pullRequestThreadContext?: {
    iterationContext?: {
      firstComparingIteration: number;
      secondComparingIteration: number;
    };
    changeTrackingId?: number;
    trackingCriteria?: {
      firstComparingIteration?: number;
      secondComparingIteration?: number;
      origLeftFileStart?: number;
      origLeftFileEnd?: number;
      origRightFileStart?: number;
      origRightFileEnd?: number;
    };
  };
}

/**
 * ADO Pull Request Threads Response
 */
export interface ADOPullRequestThreadsResponse {
  value: ADOPullRequestThread[];
  count: number;
}
