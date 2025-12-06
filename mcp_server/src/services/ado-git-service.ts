/**
 * Azure DevOps Git Service
 * Handles Git repository operations including pull request diff retrieval
 */

import { logger, errorToContext } from '../utils/logger.js';
import { createADOHttpClient, ADOHttpError } from '../utils/ado-http-client.js';
import { getTokenProvider } from '../utils/token-provider.js';
import type {
  ADOPullRequestIteration,
  ADOPullRequestIterationsResponse,
  ADOPullRequestChangesResponse,
  ADOGitItemChange,
  ADOPullRequest,
  ADOPullRequestsResponse,
  ADOPullRequestThread,
  ADOPullRequestThreadsResponse
} from '../types/ado.js';

/**
 * Get Pull Request Diff parameters
 */
export interface GetPullRequestDiffParams {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: number;
  iterationId?: number;
  includeContentMetadata?: boolean;
  includeDiffs?: boolean;
  diffFormat?: 'unified' | 'sideBySide';
  contextLines?: number;
  maxDiffLines?: number;
  pathFilter?: string[];
  top?: number;
  skip?: number;
}

/**
 * Pull Request Diff Result
 */
export interface PullRequestDiffResult {
  pullRequestId: number;
  iterationId: number;
  totalChanges: number;
  changeCounts: Record<string, number>;
  changes: Array<{
    changeType: string;
    path: string;
    objectId: string;
    originalObjectId?: string;
    url: string;
    diff?: {
      format: 'unified' | 'sideBySide';
      content: string;
      additions: number;
      deletions: number;
      isTruncated: boolean;
      truncatedAt?: number;
    };
  }>;
  metadata: {
    iteration: {
      id: number;
      author: string;
      createdDate: string;
      sourceCommit: string;
      targetCommit: string;
    };
    pagination: {
      top: number;
      skip: number;
      hasMore: boolean;
    };
    diffs?: {
      included: boolean;
      totalFilesWithDiffs: number;
      totalAdditions: number;
      totalDeletions: number;
      truncatedFiles: string[];
    };
  };
}

/**
 * ADO Git Service
 * Provides Git repository operations using Azure DevOps REST API
 */
export class ADOGitService {
  private organization: string;
  private project: string;

  constructor(organization: string, project: string) {
    this.organization = organization;
    this.project = project;
  }

  /**
   * Get the latest iteration ID for a pull request
   */
  private async getLatestIterationId(
    repository: string,
    pullRequestId: number
  ): Promise<number> {
    const tokenProvider = getTokenProvider();
    const client = createADOHttpClient(this.organization, tokenProvider, this.project);

    const endpoint = `git/repositories/${repository}/pullRequests/${pullRequestId}/iterations`;

    try {
      logger.debug(`Fetching PR iterations: ${endpoint}`);
      const response = await client.get<ADOPullRequestIterationsResponse>(endpoint);

      if (!response.data.value || response.data.value.length === 0) {
        throw new Error(`No iterations found for pull request ${pullRequestId}`);
      }

      // Get the latest iteration (last in the array)
      const latestIteration = response.data.value[response.data.value.length - 1];
      logger.debug(`Latest iteration ID: ${latestIteration.id}`);

      return latestIteration.id;
    } catch (error) {
      if (error instanceof ADOHttpError) {
        if (error.status === 404) {
          throw new Error(
            `Pull request ${pullRequestId} not found in repository ${repository}. ` +
            `Verify the PR ID and repository name are correct.`
          );
        }
        throw new Error(`Failed to fetch PR iterations: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get iteration details
   */
  private async getIterationDetails(
    repository: string,
    pullRequestId: number,
    iterationId: number
  ): Promise<ADOPullRequestIteration> {
    const tokenProvider = getTokenProvider();
    const client = createADOHttpClient(this.organization, tokenProvider, this.project);

    const endpoint = `git/repositories/${repository}/pullRequests/${pullRequestId}/iterations/${iterationId}`;

    try {
      const response = await client.get<ADOPullRequestIteration>(endpoint);
      return response.data;
    } catch (error) {
      if (error instanceof ADOHttpError) {
        if (error.status === 404) {
          throw new Error(
            `Iteration ${iterationId} not found for pull request ${pullRequestId}. ` +
            `Use get-pr-diff without iterationId to fetch the latest iteration.`
          );
        }
        throw new Error(`Failed to fetch iteration details: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get file content at a specific commit
   * 
   * Note: Using download=true parameter instead of includeContent=true
   * because includeContent returns metadata object {objectId, gitObjectType, commitId, path}
   * instead of actual file content.
   */
  private async getFileContentAtCommit(
    repository: string,
    path: string,
    commitId: string
  ): Promise<string | null> {
    const tokenProvider = getTokenProvider();
    
    // Build URL with download=true to get actual file content
    const url = `https://dev.azure.com/${this.organization}/${this.project}/_apis/git/repositories/${encodeURIComponent(repository)}/items?path=${encodeURIComponent(path)}&versionType=commit&version=${commitId}&download=true&api-version=7.1-preview.1`;

    try {
      const token = await tokenProvider();
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/plain, application/octet-stream, */*',
          'X-TFS-FedAuthRedirect': 'Suppress'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // File doesn't exist at this commit (e.g., newly added or deleted)
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      return content || '';
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        // File doesn't exist at this commit (e.g., newly added or deleted)
        return null;
      }
      throw error;
    }
  }

  /**
   * Generate unified diff between two file contents
   */
  private generateUnifiedDiff(
    path: string,
    oldContent: string | null,
    newContent: string | null,
    contextLines: number = 3,
    maxLines: number = 1000
  ): { content: string; additions: number; deletions: number; isTruncated: boolean; truncatedAt?: number } {
    const oldLines = oldContent ? oldContent.split('\n') : [];
    const newLines = newContent ? newContent.split('\n') : [];

    let diffLines: string[] = [];
    let additions = 0;
    let deletions = 0;
    let isTruncated = false;
    let truncatedAt: number | undefined;

    // Simple diff algorithm (line-by-line comparison)
    // For production, consider using a library like 'diff' or 'diff-match-patch'
    const maxLength = Math.max(oldLines.length, newLines.length);
    
    diffLines.push(`--- a${path}`);
    diffLines.push(`+++ b${path}`);
    diffLines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);

    for (let i = 0; i < maxLength; i++) {
      if (diffLines.length >= maxLines) {
        isTruncated = true;
        truncatedAt = i;
        diffLines.push(`... (diff truncated at ${maxLines} lines, ${maxLength - i} lines remaining)`);
        break;
      }

      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        // Line added
        diffLines.push(`+${newLine}`);
        additions++;
      } else if (newLine === undefined) {
        // Line deleted
        diffLines.push(`-${oldLine}`);
        deletions++;
      } else if (oldLine !== newLine) {
        // Line changed
        diffLines.push(`-${oldLine}`);
        diffLines.push(`+${newLine}`);
        deletions++;
        additions++;
      } else {
        // Line unchanged (context)
        diffLines.push(` ${oldLine}`);
      }
    }

    return {
      content: diffLines.join('\n'),
      additions,
      deletions,
      isTruncated,
      truncatedAt
    };
  }

  /**
   * Generate side-by-side diff between two file contents
   */
  private generateSideBySideDiff(
    oldContent: string | null,
    newContent: string | null,
    maxLines: number = 1000
  ): { content: string; additions: number; deletions: number; isTruncated: boolean; truncatedAt?: number } {
    const oldLines = oldContent ? oldContent.split('\n') : [];
    const newLines = newContent ? newContent.split('\n') : [];

    let diffLines: string[] = [];
    let additions = 0;
    let deletions = 0;
    let isTruncated = false;
    let truncatedAt: number | undefined;

    const maxLength = Math.max(oldLines.length, newLines.length);

    // Header
    diffLines.push('OLD                                          | NEW');
    diffLines.push('---------------------------------------------|---------------------------------------------');

    for (let i = 0; i < maxLength; i++) {
      if (diffLines.length >= maxLines) {
        isTruncated = true;
        truncatedAt = i;
        diffLines.push(`... (diff truncated at ${maxLines} lines, ${maxLength - i} lines remaining)`);
        break;
      }

      const oldLine = (oldLines[i] || '').padEnd(45);
      const newLine = newLines[i] || '';

      if (oldLines[i] === undefined) {
        additions++;
        diffLines.push(`${' '.repeat(45)}| + ${newLine}`);
      } else if (newLines[i] === undefined) {
        deletions++;
        diffLines.push(`- ${oldLine}|`);
      } else if (oldLines[i] !== newLines[i]) {
        deletions++;
        additions++;
        diffLines.push(`- ${oldLine}| + ${newLine}`);
      } else {
        diffLines.push(`  ${oldLine}|   ${newLine}`);
      }
    }

    return {
      content: diffLines.join('\n'),
      additions,
      deletions,
      isTruncated,
      truncatedAt
    };
  }

  /**
   * Check if path matches any of the filters
   */
  private matchesPathFilter(path: string, filters?: string[]): boolean {
    if (!filters || filters.length === 0) {
      return true;
    }

    // Simple glob matching (supports ** and *)
    for (const filter of filters) {
      const pattern = filter
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get pull request diff for a specific iteration
   */
  async getPullRequestDiff(params: GetPullRequestDiffParams): Promise<PullRequestDiffResult> {
    const {
      repository,
      pullRequestId,
      iterationId: requestedIterationId,
      includeContentMetadata = false,
      includeDiffs = true,
      diffFormat = 'unified',
      contextLines = 3,
      maxDiffLines = 1000,
      pathFilter,
      top = 100,
      skip = 0
    } = params;

    logger.info(
      `Fetching PR diff: PR ${pullRequestId} in ${repository} ` +
      `(org: ${this.organization}, project: ${this.project}, includeDiffs: ${includeDiffs})`
    );

    // Get iteration ID (use provided or fetch latest)
    const iterationId = requestedIterationId !== undefined
      ? requestedIterationId
      : await this.getLatestIterationId(repository, pullRequestId);

    logger.debug(`Using iteration ID: ${iterationId}`);

    // Get iteration details for metadata
    const iterationDetails = await this.getIterationDetails(
      repository,
      pullRequestId,
      iterationId
    );

    // Get changes for the iteration
    const tokenProvider = getTokenProvider();
    const client = createADOHttpClient(this.organization, tokenProvider, this.project);

    const endpoint = `git/repositories/${repository}/pullRequests/${pullRequestId}/iterations/${iterationId}/changes`;
    const queryParams = new URLSearchParams();
    if (top) queryParams.append('$top', String(top));
    if (skip) queryParams.append('$skip', String(skip));

    const fullEndpoint = `${endpoint}?${queryParams.toString()}`;

    try {
      logger.debug(`Fetching PR changes: ${fullEndpoint}`);
      const response = await client.get<ADOPullRequestChangesResponse>(fullEndpoint);

      const changes = response.data.changeEntries || [];
      const changeCounts = response.data.changeCounts || {};

      // Diff metadata tracking
      let totalFilesWithDiffs = 0;
      let totalAdditions = 0;
      let totalDeletions = 0;
      const truncatedFiles: string[] = [];

      // Transform changes to simpler format
      const transformedChanges = await Promise.all(
        changes.map(async (change: ADOGitItemChange) => {
          const baseChange = {
            changeType: change.changeType,
            path: change.item.path,
            objectId: change.item.objectId,
            originalObjectId: change.item.originalObjectId,
            url: change.item.url,
            ...(includeContentMetadata && {
              gitObjectType: change.item.gitObjectType,
              commitId: change.item.commitId,
              isFolder: change.item.isFolder
            })
          };

          // Fetch diffs if requested and path matches filter
          // Check: includeDiffs is true, item is not a folder, and matches path filter
          const isFile = change.item.gitObjectType === 'blob' || 
                        (change.item.gitObjectType === undefined && !change.item.isFolder);
          
          if (includeDiffs && isFile && this.matchesPathFilter(change.item.path, pathFilter)) {
            try {
              logger.debug(`Generating diff for: ${change.item.path} (type: ${change.changeType})`);
              
              // Get file content at source and target commits
              const sourceCommit = iterationDetails.sourceRefCommit.commitId;
              const targetCommit = iterationDetails.targetRefCommit.commitId;

              let oldContent: string | null = null;
              let newContent: string | null = null;

              // For edits and deletes, get old content
              if (change.changeType === 'edit' || change.changeType === 'delete' || change.changeType === 'rename') {
                logger.debug(`Fetching old content from target commit: ${targetCommit}`);
                oldContent = await this.getFileContentAtCommit(repository, change.item.path, targetCommit);
              }

              // For edits and adds, get new content
              if (change.changeType === 'edit' || change.changeType === 'add' || change.changeType === 'rename') {
                logger.debug(`Fetching new content from source commit: ${sourceCommit}`);
                newContent = await this.getFileContentAtCommit(repository, change.item.path, sourceCommit);
              }

              // Generate diff based on format
              const diffResult = diffFormat === 'unified'
                ? this.generateUnifiedDiff(change.item.path, oldContent, newContent, contextLines, maxDiffLines)
                : this.generateSideBySideDiff(oldContent, newContent, maxDiffLines);

              totalFilesWithDiffs++;
              totalAdditions += diffResult.additions;
              totalDeletions += diffResult.deletions;

              if (diffResult.isTruncated) {
                truncatedFiles.push(change.item.path);
              }

              logger.debug(`Generated diff for ${change.item.path}: +${diffResult.additions}/-${diffResult.deletions}`);

              return {
                ...baseChange,
                diff: {
                  format: diffFormat,
                  content: diffResult.content,
                  additions: diffResult.additions,
                  deletions: diffResult.deletions,
                  isTruncated: diffResult.isTruncated,
                  truncatedAt: diffResult.truncatedAt
                }
              };
            } catch (error) {
              logger.error(`Failed to fetch diff for ${change.item.path}:`, errorToContext(error));
              return {
                ...baseChange,
                diff: {
                  format: diffFormat,
                  content: `Error fetching diff: ${error instanceof Error ? error.message : String(error)}`,
                  additions: 0,
                  deletions: 0,
                  isTruncated: false
                }
              };
            }
          } else {
            logger.debug(
              `Skipping diff for ${change.item.path}: ` +
              `includeDiffs=${includeDiffs}, isFile=${isFile}, ` +
              `gitObjectType=${change.item.gitObjectType}, isFolder=${change.item.isFolder}, ` +
              `matchesFilter=${this.matchesPathFilter(change.item.path, pathFilter)}`
            );
          }

          return baseChange;
        })
      );

      // Calculate total changes
      const totalChanges = Object.values(changeCounts).reduce(
        (sum: number, count) => sum + (typeof count === 'number' ? count : 0),
        0
      ) || changes.length;

      const hasMore = changes.length === top;

      logger.info(
        `Retrieved ${changes.length} changes for PR ${pullRequestId} ` +
        `(iteration ${iterationId}, total changes: ${totalChanges}` +
        (includeDiffs ? `, diffs: ${totalFilesWithDiffs} files, +${totalAdditions}/-${totalDeletions}` : '') +
        ')'
      );

      return {
        pullRequestId,
        iterationId,
        totalChanges,
        changeCounts,
        changes: transformedChanges,
        metadata: {
          iteration: {
            id: iterationDetails.id,
            author: iterationDetails.author.displayName,
            createdDate: iterationDetails.createdDate,
            sourceCommit: iterationDetails.sourceRefCommit.commitId,
            targetCommit: iterationDetails.targetRefCommit.commitId
          },
          pagination: {
            top,
            skip,
            hasMore
          },
          ...(includeDiffs && {
            diffs: {
              included: true,
              totalFilesWithDiffs,
              totalAdditions,
              totalDeletions,
              truncatedFiles
            }
          })
        }
      };
    } catch (error) {
      if (error instanceof ADOHttpError) {
        if (error.status === 404) {
          throw new Error(
            `Changes not found for PR ${pullRequestId} iteration ${iterationId}. ` +
            `The iteration may not exist or the PR may have been deleted.`
          );
        }
        throw new Error(`Failed to fetch PR changes: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search for pull requests matching criteria
   */
  async searchPullRequests(params: {
    repository?: string;
    status?: 'active' | 'abandoned' | 'completed' | 'notSet' | 'all';
    creatorId?: string;
    reviewerId?: string;
    sourceRefName?: string;
    targetRefName?: string;
    minTime?: string;
    maxTime?: string;
    top?: number;
    skip?: number;
  }): Promise<{ pullRequests: ADOPullRequest[]; totalCount: number }> {
    const {
      repository,
      status = 'active',
      creatorId,
      reviewerId,
      sourceRefName,
      targetRefName,
      minTime,
      maxTime,
      top = 100,
      skip = 0
    } = params;

    const tokenProvider = getTokenProvider();
    const client = createADOHttpClient(this.organization, tokenProvider, this.project);

    // Build endpoint
    const baseEndpoint = repository
      ? `git/repositories/${encodeURIComponent(repository)}/pullrequests`
      : `git/pullrequests`;

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('api-version', '7.1');
    
    if (status && status !== 'all') {
      queryParams.append('searchCriteria.status', status);
    }
    if (creatorId) {
      queryParams.append('searchCriteria.creatorId', creatorId);
    }
    if (reviewerId) {
      queryParams.append('searchCriteria.reviewerId', reviewerId);
    }
    if (sourceRefName) {
      queryParams.append('searchCriteria.sourceRefName', sourceRefName);
    }
    if (targetRefName) {
      queryParams.append('searchCriteria.targetRefName', targetRefName);
    }
    if (minTime) {
      queryParams.append('searchCriteria.minTime', minTime);
    }
    if (maxTime) {
      queryParams.append('searchCriteria.maxTime', maxTime);
    }
    queryParams.append('$top', String(top));
    queryParams.append('$skip', String(skip));

    const endpoint = `${baseEndpoint}?${queryParams.toString()}`;

    try {
      logger.debug(`Searching pull requests: ${endpoint}`);
      const response = await client.get<ADOPullRequestsResponse>(endpoint);
      
      const pullRequests = response.data.value || [];
      const totalCount = response.data.count || pullRequests.length;

      logger.info(
        `Found ${pullRequests.length} pull requests ` +
        `(status: ${status}, repository: ${repository || 'all'})`
      );

      return { pullRequests, totalCount };
    } catch (error) {
      if (error instanceof ADOHttpError) {
        if (error.status === 404) {
          throw new Error(
            repository
              ? `Repository '${repository}' not found. Verify the repository name is correct.`
              : `Project '${this.project}' not found or no access.`
          );
        }
        throw new Error(`Failed to search pull requests: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get discussion threads for a pull request
   */
  async getPullRequestThreads(params: {
    repository: string;
    pullRequestId: number;
    includeDeleted?: boolean;
  }): Promise<ADOPullRequestThread[]> {
    const { repository, pullRequestId, includeDeleted = false } = params;

    const tokenProvider = getTokenProvider();
    const client = createADOHttpClient(this.organization, tokenProvider, this.project);

    const endpoint = `git/repositories/${encodeURIComponent(repository)}/pullRequests/${pullRequestId}/threads`;

    try {
      logger.debug(`Fetching PR threads: ${endpoint}`);
      const response = await client.get<ADOPullRequestThreadsResponse>(endpoint);

      let threads = response.data.value || [];

      // Filter out deleted threads if requested
      if (!includeDeleted) {
        threads = threads.filter(thread => !thread.isDeleted);
      }

      logger.info(
        `Retrieved ${threads.length} threads for PR ${pullRequestId} ` +
        `in repository ${repository}`
      );

      return threads;
    } catch (error) {
      if (error instanceof ADOHttpError) {
        if (error.status === 404) {
          throw new Error(
            `Pull request ${pullRequestId} not found in repository ${repository}. ` +
            `Verify the PR ID and repository name are correct.`
          );
        }
        throw new Error(`Failed to fetch PR threads: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get comments for all threads in a pull request with optional filtering
   */
  async getPullRequestComments(params: {
    repository: string;
    pullRequestId: number;
    threadStatusFilter?: Array<'unknown' | 'active' | 'fixed' | 'wontFix' | 'closed' | 'byDesign' | 'pending'>;
    includeSystemComments?: boolean;
    includeDeleted?: boolean;
  }): Promise<{
    threads: ADOPullRequestThread[];
    totalComments: number;
    commentsByStatus: Record<string, number>;
  }> {
    const {
      repository,
      pullRequestId,
      threadStatusFilter,
      includeSystemComments = false,
      includeDeleted = false
    } = params;

    // Fetch all threads
    let threads = await this.getPullRequestThreads({
      repository,
      pullRequestId,
      includeDeleted
    });

    // Filter threads by status if specified
    if (threadStatusFilter && threadStatusFilter.length > 0) {
      threads = threads.filter(thread => 
        threadStatusFilter.includes(thread.status)
      );
    }

    // Filter system comments if requested
    if (!includeSystemComments) {
      threads = threads.map(thread => ({
        ...thread,
        comments: thread.comments.filter(
          comment => comment.commentType !== 'system'
        )
      }));
    }

    // Calculate statistics
    let totalComments = 0;
    const commentsByStatus: Record<string, number> = {};

    for (const thread of threads) {
      totalComments += thread.comments.length;
      const status = thread.status || 'unknown';
      commentsByStatus[status] = (commentsByStatus[status] || 0) + thread.comments.length;
    }

    logger.info(
      `Retrieved ${totalComments} comments from ${threads.length} threads ` +
      `for PR ${pullRequestId} in repository ${repository}`
    );

    return {
      threads,
      totalComments,
      commentsByStatus
    };
  }

  /**
   * Create a new thread (comment) on a pull request
   * Supports general PR comments and line-specific comments
   */
  async createPullRequestThread(params: {
    repository: string;
    pullRequestId: number;
    comment: string;
    threadContext?: {
      filePath?: string;
      rightFileStart?: { line: number; offset?: number };
      rightFileEnd?: { line: number; offset?: number };
    };
  }): Promise<ADOPullRequestThread> {
    const { repository, pullRequestId, comment, threadContext } = params;

    const tokenProvider = getTokenProvider();
    const client = createADOHttpClient(this.organization, tokenProvider, this.project);

    const endpoint = `git/repositories/${encodeURIComponent(repository)}/pullRequests/${pullRequestId}/threads`;

    // Build thread request body
    interface ThreadRequest {
      comments: Array<{
        parentCommentId: number;
        content: string;
        commentType: string;
      }>;
      status: string;
      threadContext?: {
        filePath: string;
        rightFileStart?: { line: number; offset: number };
        rightFileEnd?: { line: number; offset: number };
      };
    }
    
    const threadRequest: ThreadRequest = {
      comments: [
        {
          parentCommentId: 0,
          content: comment,
          commentType: 'text'
        }
      ],
      status: 'active'
    };

    // Add thread context if provided (for line-specific comments)
    if (threadContext?.filePath) {
      threadRequest.threadContext = {
        filePath: threadContext.filePath,
        ...(threadContext.rightFileStart && { 
          rightFileStart: {
            line: threadContext.rightFileStart.line,
            offset: threadContext.rightFileStart.offset ?? 0
          }
        }),
        ...(threadContext.rightFileEnd && { 
          rightFileEnd: {
            line: threadContext.rightFileEnd.line,
            offset: threadContext.rightFileEnd.offset ?? 0
          }
        })
      };
    }

    try {
      logger.debug(`Creating PR thread: ${endpoint}`);
      logger.debug(`Thread request: ${JSON.stringify(threadRequest, null, 2)}`);
      
      const response = await client.post<ADOPullRequestThread>(endpoint, threadRequest);

      logger.info(
        `Created thread ${response.data.id} on PR ${pullRequestId} ` +
        `in repository ${repository}`
      );

      return response.data;
    } catch (error) {
      if (error instanceof ADOHttpError) {
        if (error.status === 404) {
          throw new Error(
            `Pull request ${pullRequestId} not found in repository ${repository}. ` +
            `Verify the PR ID and repository name are correct.`
          );
        }
        if (error.status === 400) {
          throw new Error(
            `Invalid thread context or comment format: ${error.message}`
          );
        }
        throw new Error(`Failed to create PR thread: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Factory function to create ADO Git Service
 */
export function createADOGitService(organization: string, project: string): ADOGitService {
  return new ADOGitService(organization, project);
}
