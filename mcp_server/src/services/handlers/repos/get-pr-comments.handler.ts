/**
 * Handler for get-pr-comments tool
 * Fetches pull request comments from Azure DevOps with AI-powered natural language filtering
 */

import { z } from 'zod';
import type { ToolConfig, ToolExecutionResult } from '../../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../../types/mcp.js';
import { getPullRequestCommentsSchema } from '../../../config/schemas.js';
import { loadConfiguration } from '../../../config/config.js';
import { createADOGitService } from '../../ado-git-service.js';
import { logger, errorToContext } from '../../../utils/logger.js';
import { SamplingClient } from '../../../utils/sampling-client.js';
import { buildSamplingUnavailableResponse, buildValidationErrorResponse, buildErrorResponse, buildNetworkError, buildBusinessLogicError } from '../../../utils/response-builder.js';
import type { ADOPullRequest } from '../../../types/ado.js';

/**
 * Generate PR search criteria from natural language description using AI
 */
async function generateSearchCriteria(
  samplingClient: SamplingClient,
  description: string,
  config: {
    organization: string;
    project: string;
    repository?: string;
  }
): Promise<{
  success: boolean;
  mode: 'search' | 'specific';
  repository?: string;
  pullRequestId?: number;
  searchCriteria?: Record<string, any>;
  threadStatusFilter?: string[];
  includeSystemComments?: boolean;
  explanation?: string;
  error?: string;
}> {
  try {
    logger.info(`🤖 Generating PR search criteria from description: "${description}"`);

    // Calculate date constants for template variables
    const today = new Date();
    const date7DaysAgo = new Date(today);
    date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
    const date30DaysAgo = new Date(today);
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const date14DaysAgo = new Date(today);
    date14DaysAgo.setDate(date14DaysAgo.getDate() - 14);

    const userPrompt = `Generate PR search criteria for this request:\n\n${description}${
      config.repository ? `\n\nContext: Repository is "${config.repository}"` : ''
    }`;

    // Request sampling from LLM
    const response = await samplingClient.createMessage({
      systemPromptName: 'pr-query-generator',
      userContent: userPrompt,
      maxTokens: 1000,
      variables: {
        ORGANIZATION: config.organization,
        PROJECT: config.project,
        TODAY: today.toISOString(),
        DATE_7_DAYS_AGO: date7DaysAgo.toISOString(),
        DATE_30_DAYS_AGO: date30DaysAgo.toISOString(),
        START_OF_MONTH: startOfMonth.toISOString(),
        DATE_14_DAYS_AGO: date14DaysAgo.toISOString()
      }
    });

    const responseText = samplingClient.extractResponseText(response);

    // Parse JSON response
    interface AISearchCriteria {
      success: boolean;
      mode?: string;
      pullRequestId?: number;
      repositoryId?: string;
      project?: string;
      [key: string]: unknown;
    }
    
    let parsed: AISearchCriteria;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      parsed = JSON.parse(jsonText.trim());
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON', errorToContext(parseError));
      return {
        success: false,
        mode: 'search',
        error: `AI generated invalid JSON response. Please try rephrasing your query or use direct parameters.`
      };
    }

    logger.info(`✅ Generated search criteria: ${JSON.stringify(parsed, null, 2)}`);

    return {
      ...parsed,
      success: true
    } as any;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate PR search criteria', errorToContext(error));
    // Use buildErrorResponse which will auto-categorize the error
    const errResult = buildErrorResponse(
      `Failed to generate search criteria: ${errorMessage}`,
      { source: 'pr-comments-ai-generation' }
    );
    return {
      success: false,
      mode: 'search' as const,
      error: errResult.errors[0]
    };
  }
}

/**
 * Handle get-pr-comments tool execution
 */
export async function handleGetPullRequestComments(
  config: ToolConfig,
  args: unknown,
  serverInstance?: MCPServer | MCPServerLike
): Promise<ToolExecutionResult> {
  const warnings: string[] = [];

  try {
    // Validate and parse arguments
    const validated = getPullRequestCommentsSchema.parse(args);

    // Get configuration for defaults
    const cfg = loadConfiguration();
    const organization = validated.organization || cfg.azureDevOps.organization;
    const project = validated.project || cfg.azureDevOps.project;

    if (!organization) {
      throw new Error('Organization is required. Provide via organization parameter or configuration.');
    }

    if (!project) {
      throw new Error('Project is required. Provide via project parameter or configuration.');
    }

    // Determine if this is AI generation or direct execution
    const isAIGeneration = !!validated.description && !validated.pullRequestId;

    let finalParams: {
      mode: 'search' | 'specific';
      repository?: string;
      pullRequestId?: number;
      searchCriteria?: Record<string, any>;
      threadStatusFilter?: string[];
      includeSystemComments?: boolean;
    };

    let aiGenerationMetadata: Record<string, unknown> = {};

    // AI-powered search criteria generation
    if (isAIGeneration) {
      if (!serverInstance) {
        return {
          success: false,
          data: null,
          metadata: { tool: 'get-pr-comments', mode: 'ai-generation' },
          errors: [
            'AI generation requires sampling support. Provide direct parameters instead, or enable VS Code Language Model API.'
          ],
          warnings: []
        };
      }

      const samplingClient = new SamplingClient(serverInstance);
      if (!samplingClient.hasSamplingSupport()) {
        return buildSamplingUnavailableResponse();
      }

      const generationResult = await generateSearchCriteria(
        samplingClient,
        validated.description!,
        {
          organization,
          project,
          repository: validated.repository
        }
      );

      if (!generationResult.success) {
        return {
          success: false,
          data: null,
          metadata: { tool: 'get-pr-comments', mode: 'ai-generation' },
          errors: [generationResult.error || 'Failed to generate search criteria'],
          warnings
        };
      }

      finalParams = {
        mode: generationResult.mode,
        repository: generationResult.repository || validated.repository,
        pullRequestId: generationResult.pullRequestId,
        searchCriteria: generationResult.searchCriteria,
        threadStatusFilter: generationResult.threadStatusFilter,
        includeSystemComments: generationResult.includeSystemComments ?? validated.includeSystemComments
      };

      aiGenerationMetadata = {
        aiGenerated: true,
        generatedQuery: generationResult,
        explanation: generationResult.explanation
      };

      if (generationResult.explanation) {
        warnings.push(`AI Analysis: ${generationResult.explanation}`);
      }
    } else {
      // Direct execution mode
      finalParams = {
        mode: validated.pullRequestId ? 'specific' : 'search',
        repository: validated.repository,
        pullRequestId: validated.pullRequestId,
        searchCriteria: {
          status: validated.status,
          creatorId: validated.creatorId,
          reviewerId: validated.reviewerId,
          sourceRefName: validated.sourceRefName,
          targetRefName: validated.targetRefName,
          minTime: validated.minTime,
          maxTime: validated.maxTime
        },
        threadStatusFilter: validated.threadStatusFilter,
        includeSystemComments: validated.includeSystemComments
      };
    }

    // Validate repository requirement
    if (finalParams.mode === 'specific' && !finalParams.repository) {
      throw new Error('Repository is required when fetching comments for a specific PR.');
    }

    // Create ADO Git service
    const gitService = createADOGitService(organization, project);

    // Execute based on mode
    if (finalParams.mode === 'specific' && finalParams.pullRequestId) {
      // Specific PR mode
      logger.info(
        `Getting comments for PR ${finalParams.pullRequestId} in repository ${finalParams.repository}`
      );

      const result = await gitService.getPullRequestComments({
        repository: finalParams.repository!,
        pullRequestId: finalParams.pullRequestId,
        threadStatusFilter: finalParams.threadStatusFilter as any,
        includeSystemComments: finalParams.includeSystemComments,
        includeDeleted: validated.includeDeleted
      });

      // Format threads for output
      const formattedThreads = result.threads.map(thread => ({
        threadId: thread.id,
        status: thread.status,
        publishedDate: thread.publishedDate,
        lastUpdatedDate: thread.lastUpdatedDate,
        commentCount: thread.comments.length,
        filePath: thread.threadContext?.filePath,
        comments: thread.comments.map(comment => ({
          id: comment.id,
          author: comment.author.displayName,
          authorEmail: comment.author.uniqueName,
          content: comment.content,
          publishedDate: comment.publishedDate,
          commentType: comment.commentType
        }))
      }));

      return {
        success: true,
        data: {
          mode: 'specific',
          pullRequestId: finalParams.pullRequestId,
          repository: finalParams.repository,
          summary: {
            totalThreads: result.threads.length,
            totalComments: result.totalComments,
            commentsByStatus: result.commentsByStatus
          },
          threads: formattedThreads,
          ...aiGenerationMetadata
        },
        metadata: {
          tool: 'get-pr-comments',
          timestamp: new Date().toISOString(),
          organization,
          project
        },
        errors: [],
        warnings
      };
    } else {
      // Search mode - find PRs matching criteria
      logger.info(
        `Searching for PRs with criteria: ${JSON.stringify(finalParams.searchCriteria)}`
      );

      if (!finalParams.repository && !isAIGeneration) {
        warnings.push(
          'No repository specified. Searching across all repositories in the project. ' +
          'This may be slow. Consider specifying a repository for better performance.'
        );
      }

      const searchResult = await gitService.searchPullRequests({
        repository: finalParams.repository,
        ...(finalParams.searchCriteria || {}),
        top: validated.top,
        skip: validated.skip
      });

      if (searchResult.pullRequests.length === 0) {
        return {
          success: true,
          data: {
            mode: 'search',
            summary: {
              totalPRs: 0,
              totalThreads: 0,
              totalComments: 0
            },
            pullRequests: [],
            searchCriteria: finalParams.searchCriteria,
            ...aiGenerationMetadata
          },
          metadata: {
            tool: 'get-pr-comments',
            timestamp: new Date().toISOString(),
            organization,
            project
          },
          errors: [],
          warnings: [...warnings, 'No pull requests found matching the search criteria.']
        };
      }

      // Limit PRs to fetch
      const maxPRs = Math.min(validated.maxPRsToFetch || 10, searchResult.pullRequests.length);
      const prsToFetch = searchResult.pullRequests.slice(0, maxPRs);

      if (searchResult.pullRequests.length > maxPRs) {
        warnings.push(
          `Found ${searchResult.pullRequests.length} PRs but only fetching comments from first ${maxPRs}. ` +
          `Use maxPRsToFetch parameter to retrieve more.`
        );
      }

      // Fetch comments for each PR
      interface FormattedThread {
        threadId: number;
        status: string;
        publishedDate: string;
        lastUpdatedDate?: string;
        commentCount: number;
        filePath?: string;
        comments: Array<{
          id: number;
          author: string;
          authorEmail: string;
          content: string;
          publishedDate: string;
          commentType: string;
        }>;
      }
      
      const pullRequestsWithComments: Array<{
        pullRequestId: number;
        title: string;
        status: string;
        repository: string;
        createdBy: string;
        creationDate: string;
        sourceRefName: string;
        targetRefName: string;
        summary: {
          totalThreads: number;
          totalComments: number;
          commentsByStatus: Record<string, number>;
        };
        threads: FormattedThread[];
      }> = [];

      let totalThreads = 0;
      let totalComments = 0;

      for (const pr of prsToFetch) {
        try {
          const repo = pr.repository?.name || finalParams.repository!;
          const commentsResult = await gitService.getPullRequestComments({
            repository: repo,
            pullRequestId: pr.pullRequestId,
            threadStatusFilter: finalParams.threadStatusFilter as any,
            includeSystemComments: finalParams.includeSystemComments,
            includeDeleted: validated.includeDeleted
          });

          const formattedThreads = commentsResult.threads.map(thread => ({
            threadId: thread.id,
            status: thread.status,
            publishedDate: thread.publishedDate,
            lastUpdatedDate: thread.lastUpdatedDate,
            commentCount: thread.comments.length,
            filePath: thread.threadContext?.filePath,
            comments: thread.comments.map(comment => ({
              id: comment.id,
              author: comment.author.displayName,
              authorEmail: comment.author.uniqueName,
              content: comment.content,
              publishedDate: comment.publishedDate,
              commentType: comment.commentType
            }))
          }));

          pullRequestsWithComments.push({
            pullRequestId: pr.pullRequestId,
            title: pr.title,
            status: pr.status,
            repository: repo,
            createdBy: pr.createdBy.displayName,
            creationDate: pr.creationDate,
            sourceRefName: pr.sourceRefName,
            targetRefName: pr.targetRefName,
            summary: {
              totalThreads: commentsResult.threads.length,
              totalComments: commentsResult.totalComments,
              commentsByStatus: commentsResult.commentsByStatus
            },
            threads: formattedThreads
          });

          totalThreads += commentsResult.threads.length;
          totalComments += commentsResult.totalComments;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          warnings.push(`Failed to fetch comments for PR ${pr.pullRequestId}: ${errorMsg}`);
        }
      }

      return {
        success: true,
        data: {
          mode: 'search',
          summary: {
            totalPRs: pullRequestsWithComments.length,
            totalThreads,
            totalComments
          },
          pullRequests: pullRequestsWithComments,
          searchCriteria: finalParams.searchCriteria,
          ...aiGenerationMetadata
        },
        metadata: {
          tool: 'get-pr-comments',
          timestamp: new Date().toISOString(),
          organization,
          project
        },
        errors: [],
        warnings
      };
    }
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error, 'get-pr-comments');
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get PR comments', errorToContext(error));

    const errResult = buildErrorResponse(
      errorMessage,
      { source: 'get-pr-comments', tool: 'get-pr-comments' }
    );
    errResult.warnings = warnings;
    return errResult;
  }
}
