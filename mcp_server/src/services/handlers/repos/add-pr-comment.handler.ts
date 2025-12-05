/**
 * Handler for add-pr-comment tool
 * Creates PR threads with optional GitHub Copilot @mentions
 */

import { z } from 'zod';
import type { ToolConfig, ToolExecutionResult } from '../../../types/index.js';
import { addPullRequestCommentSchema } from '../../../config/schemas.js';
import { loadConfiguration } from '../../../config/config.js';
import { createADOGitService } from '../../ado-git-service.js';
import { findGitHubCopilotGuid } from '../../ado-identity-service.js';
import { logger, errorToContext } from '../../../utils/logger.js';
import { buildValidationErrorResponse, buildErrorResponse } from '../../../utils/response-builder.js';

/**
 * Format comment with GitHub Copilot mention
 * Uses Azure DevOps plain text mention format: @<GUID>
 * The GUID should be just the localId portion (uppercase)
 */
function formatCommentWithMention(
  comment: string,
  copilotGuid: string,
  displayName: string = 'GitHub Copilot'
): string {
  // Extract localId from the full GUID (format is "localId@originId")
  const localId = copilotGuid.includes('@') 
    ? copilotGuid.split('@')[0] 
    : copilotGuid;
  
  // Azure DevOps mention format: @<GUID> (uppercase)
  const mentionTag = `@<${localId.toUpperCase()}>`;
  
  // Prepend mention to comment
  return `${mentionTag} ${comment}`;
}

/**
 * Handle add-pr-comment tool execution
 */
export async function handleAddPullRequestComment(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  const warnings: string[] = [];

  try {
    // Validate and parse arguments
    const validated = addPullRequestCommentSchema.parse(args);

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

    // Handle Copilot mention if requested
    let finalComment = validated.comment;
    if (validated.mentionCopilot) {
      let copilotGuid = validated.copilotGuid || null;

      // Auto-discover Copilot GUID if not provided
      if (!copilotGuid) {
        logger.info('Auto-discovering GitHub Copilot GUID...');
        copilotGuid = await findGitHubCopilotGuid(organization);
        
        if (!copilotGuid) {
          return {
            success: false,
            data: null,
            metadata: {},
            errors: [
              'GitHub Copilot GUID not found. Either:',
              '1. Provide copilotGuid parameter explicitly, or',
              '2. Configure with --copilot-guid flag, or',
              '3. Ensure GitHub Copilot user exists in Azure DevOps organization'
            ],
            warnings: []
          };
        }
        
        warnings.push(`Auto-discovered GitHub Copilot GUID: ${copilotGuid}`);
      }

      // Format comment with mention
      const displayName = validated.copilotDisplayName || 'GitHub Copilot';
      finalComment = formatCommentWithMention(validated.comment, copilotGuid, displayName);
      
      logger.debug(`Formatted comment with mention: ${finalComment}`);
    }

    // Create ADO Git service
    const gitService = createADOGitService(organization, project);

    // Log operation
    logger.info(
      `Adding comment to PR ${validated.pullRequestId} in repository ${validated.repository}` +
      (validated.mentionCopilot ? ' (with Copilot mention)' : '') +
      (validated.threadContext?.filePath ? ` on file ${validated.threadContext.filePath}` : '')
    );

    // Create the thread
    const thread = await gitService.createPullRequestThread({
      repository: validated.repository,
      pullRequestId: validated.pullRequestId,
      comment: finalComment,
      threadContext: validated.threadContext
    });

    return {
      success: true,
      data: {
        threadId: thread.id,
        pullRequestId: validated.pullRequestId,
        repository: validated.repository,
        commentId: thread.comments[0]?.id,
        publishedDate: thread.publishedDate,
        status: thread.status,
        threadContext: thread.threadContext || null,
        url: thread._links?.self?.href || null,
        mentionedCopilot: validated.mentionCopilot || false
      },
      metadata: {},
      errors: [],
      warnings
    };
  } catch (error: unknown) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    // Handle other errors
    return buildErrorResponse(error);
  }
}