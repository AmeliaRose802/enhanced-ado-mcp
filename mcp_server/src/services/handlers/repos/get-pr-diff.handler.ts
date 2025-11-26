/**
 * Handler for get-pr-diff tool
 * Fetches pull request diff from Azure DevOps
 */

import { z } from 'zod';
import type { ToolConfig, ToolExecutionResult } from '../../../types/index.js';
import { getPullRequestDiffSchema } from '../../../config/schemas.js';
import { loadConfiguration } from '../../../config/config.js';
import { createADOGitService } from '../../ado-git-service.js';
import { logger, errorToContext } from '../../../utils/logger.js';

/**
 * Handle get-pr-diff tool execution
 */
export async function handleGetPullRequestDiff(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  const warnings: string[] = [];
  
  try {
    // Validate and parse arguments
    const validated = getPullRequestDiffSchema.parse(args);
    
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

    // Create ADO Git service
    const gitService = createADOGitService(organization, project);

    // Log operation
    logger.info(
      `Getting PR diff: PR ${validated.pullRequestId} in repository ${validated.repository}` +
      (validated.iterationId ? ` (iteration ${validated.iterationId})` : ' (latest iteration)')
    );

    // Fetch PR diff
    const result = await gitService.getPullRequestDiff({
      organization,
      project,
      repository: validated.repository,
      pullRequestId: validated.pullRequestId,
      iterationId: validated.iterationId,
      includeContentMetadata: validated.includeContentMetadata,
      includeDiffs: validated.includeDiffs,
      diffFormat: validated.diffFormat,
      contextLines: validated.contextLines,
      maxDiffLines: validated.maxDiffLines,
      pathFilter: validated.pathFilter,
      top: validated.top,
      skip: validated.skip
    });

    // Add warnings for pagination
    if (result.metadata.pagination.hasMore) {
      warnings.push(
        `More changes available. Use skip=${validated.skip + validated.top} ` +
        `to fetch the next batch. Total changes: ${result.totalChanges}`
      );
    }

    // Add info about iteration
    if (!validated.iterationId) {
      warnings.push(
        `Showing latest iteration (${result.iterationId}). ` +
        `Specify iterationId to fetch a specific iteration.`
      );
    }

    // Add warnings for diff features
    if (validated.includeDiffs) {
      if (result.metadata.diffs && result.metadata.diffs.truncatedFiles.length > 0) {
        warnings.push(
          `${result.metadata.diffs.truncatedFiles.length} file(s) had truncated diffs exceeding maxDiffLines (${validated.maxDiffLines}). ` +
          `Consider increasing maxDiffLines or reviewing these files individually: ${result.metadata.diffs.truncatedFiles.slice(0, 5).join(', ')}` +
          (result.metadata.diffs.truncatedFiles.length > 5 ? '...' : '')
        );
      }

      if (validated.pathFilter && validated.pathFilter.length > 0) {
        warnings.push(
          `Diffs filtered by path patterns: ${validated.pathFilter.join(', ')}. ` +
          `Remove pathFilter to include all files.`
        );
      }
    }

    // Format change summary
    const changeSummary = Object.entries(result.changeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    // Return successful result
    return {
      success: true,
      data: {
        pullRequestId: result.pullRequestId,
        iterationId: result.iterationId,
        summary: {
          totalChanges: result.totalChanges,
          changesByType: result.changeCounts,
          changeSummary: changeSummary || `${result.totalChanges} changes`
        },
        iteration: result.metadata.iteration,
        changes: result.changes,
        pagination: {
          showing: `${result.metadata.pagination.skip + 1}-${result.metadata.pagination.skip + result.changes.length}`,
          total: result.totalChanges,
          hasMore: result.metadata.pagination.hasMore,
          nextSkip: result.metadata.pagination.hasMore 
            ? result.metadata.pagination.skip + result.metadata.pagination.top
            : null
        }
      },
      metadata: {
        tool: 'get-pr-diff',
        timestamp: new Date().toISOString(),
        organization,
        project,
        repository: validated.repository
      },
      errors: [],
      warnings
    };
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'get-pr-diff',
          timestamp: new Date().toISOString()
        },
        errors: [
          'Validation failed:',
          ...error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`)
        ],
        warnings
      };
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get PR diff', errorToContext(error));

    return {
      success: false,
      data: null,
      metadata: {
        tool: 'get-pr-diff',
        timestamp: new Date().toISOString()
      },
      errors: [
        'Failed to fetch pull request diff:',
        errorMessage
      ],
      warnings,
      raw: {
        stderr: errorMessage,
        exitCode: 1
      }
    };
  }
}
