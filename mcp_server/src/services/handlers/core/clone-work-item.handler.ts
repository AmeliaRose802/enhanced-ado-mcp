/**
 * Handler for wit-clone-work-item tool
 * Clone/duplicate an existing work item with optional modifications
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { createWorkItemRepository } from "../../../repositories/work-item.repository.js";
import { buildSuccessResponse, buildErrorResponse } from "../../../utils/response-builder.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger } from "../../../utils/logger.js";
import { getRequiredConfig } from "../../../config/config.js";
import type { ADOFieldOperation, ADOWorkItem } from "../../../types/index.js";
import { queryHandleService } from "../../query-handle-service.js";

interface CloneWorkItemArgs {
  sourceWorkItemId: number;
  title?: string;
  targetAreaPath?: string;
  targetIterationPath?: string;
  targetProject?: string;
  assignTo?: string;
  includeDescription?: boolean;
  includeAcceptanceCriteria?: boolean;
  includeTags?: boolean;
  includeAttachments?: boolean;
  includeChildren?: boolean;
  linkToSource?: boolean;
  comment?: string;
  organization?: string;
  project?: string;
}

export async function handleCloneWorkItem(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }
    const parsed = validation;

    const requiredConfig = getRequiredConfig();
    const {
      sourceWorkItemId,
      title,
      targetAreaPath,
      targetIterationPath,
      targetProject,
      assignTo,
      includeDescription = true,
      includeAcceptanceCriteria = true,
      includeTags = true,
      includeAttachments = false,
      includeChildren = false,
      linkToSource = true,
      comment,
      organization = requiredConfig.organization,
      project = requiredConfig.project
    } = parsed.data as CloneWorkItemArgs;

    const targetProj = targetProject || project;
    logger.debug(`Cloning work item ${sourceWorkItemId} from ${project} to ${targetProj}`);

    // Get source work item
    const sourceRepo = createWorkItemRepository(organization, project);
    const sourceItem = await sourceRepo.getById(sourceWorkItemId);

    if (!sourceItem || !sourceItem.fields) {
      return buildErrorResponse(
        `Source work item ${sourceWorkItemId} not found`,
        { source: "clone-work-item" }
      );
    }

    // Build new work item fields
    const fields: ADOFieldOperation[] = [];
    
    // Title (required)
    const clonedTitle = title || `[Clone] ${sourceItem.fields['System.Title'] || 'Untitled'}`;
    fields.push({ op: 'add', path: '/fields/System.Title', value: clonedTitle });

    // Description
    if (includeDescription && sourceItem.fields['System.Description']) {
      fields.push({ op: 'add', path: '/fields/System.Description', value: sourceItem.fields['System.Description'] });
    }

    // Acceptance Criteria
    if (includeAcceptanceCriteria && sourceItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria']) {
      fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: sourceItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] });
    }

    // Tags
    if (includeTags && sourceItem.fields['System.Tags']) {
      fields.push({ op: 'add', path: '/fields/System.Tags', value: sourceItem.fields['System.Tags'] });
    }

    // Area Path
    const effectiveAreaPath = targetAreaPath || sourceItem.fields['System.AreaPath'] as string;
    if (effectiveAreaPath) {
      fields.push({ op: 'add', path: '/fields/System.AreaPath', value: effectiveAreaPath });
    }

    // Iteration Path
    const effectiveIterationPath = targetIterationPath || sourceItem.fields['System.IterationPath'] as string;
    if (effectiveIterationPath) {
      fields.push({ op: 'add', path: '/fields/System.IterationPath', value: effectiveIterationPath });
    }

    // Assigned To
    if (assignTo) {
      fields.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignTo });
    }

    // Priority (copy from source)
    if (sourceItem.fields['Microsoft.VSTS.Common.Priority']) {
      fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: sourceItem.fields['Microsoft.VSTS.Common.Priority'] });
    }

    // Story Points (copy from source)
    if (sourceItem.fields['Microsoft.VSTS.Scheduling.StoryPoints']) {
      fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints', value: sourceItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] });
    }

    // Create cloned work item
    const targetRepo = createWorkItemRepository(organization, targetProj);
    const workItemType = sourceItem.fields['System.WorkItemType'] as string;
    const clonedItem = await targetRepo.create(workItemType, fields);

    logger.debug(`Created cloned work item ${clonedItem.id}`);

    // Link back to source if requested
    if (linkToSource) {
      try {
        const linkFields: ADOFieldOperation[] = [{
          op: 'add',
          path: '/relations/-',
          value: {
            rel: 'System.LinkTypes.Related',
            url: `https://dev.azure.com/${organization}/${project}/_apis/wit/workItems/${sourceWorkItemId}`,
            attributes: {
              comment: comment || 'Cloned from source work item'
            }
          }
        }];
        
        await targetRepo.update(clonedItem.id, linkFields);
        logger.debug(`Linked cloned item ${clonedItem.id} to source ${sourceWorkItemId}`);
      } catch (error) {
        logger.warn(`Failed to link cloned item to source: ${error}`);
      }
    }

    // Add comment if provided
    if (comment && !linkToSource) {
      try {
        const commentFields: ADOFieldOperation[] = [{
          op: 'add',
          path: '/fields/System.History',
          value: comment
        }];
        
        await targetRepo.update(clonedItem.id, commentFields);
      } catch (error) {
        logger.warn(`Failed to add comment: ${error}`);
      }
    }

    const warnings: string[] = [];
    
    if (includeAttachments) {
      warnings.push("Attachment cloning is not yet implemented");
    }
    
    if (includeChildren) {
      warnings.push("Child cloning is not yet implemented");
    }

    // Create query handle for the newly cloned work item
    const queryHandle = queryHandleService.storeQuery(
      [clonedItem.id],
      `SELECT [System.Id] FROM WorkItems WHERE [System.Id] = ${clonedItem.id}`,
      {
        project: targetProj,
        queryType: 'single-item'
      },
      undefined, // Use default TTL
      new Map([[clonedItem.id, {
        title: clonedItem.fields['System.Title'] as string,
        state: clonedItem.fields['System.State'] as string,
        type: clonedItem.fields['System.WorkItemType'] as string
      }]])
    );
    
    logger.debug(`Created query handle ${queryHandle} for cloned work item ${clonedItem.id}`);

    const result = buildSuccessResponse(
      {
        clonedWorkItem: {
          id: clonedItem.id,
          title: clonedItem.fields['System.Title'],
          type: clonedItem.fields['System.WorkItemType'],
          state: clonedItem.fields['System.State'],
          url: `https://dev.azure.com/${organization}/${targetProj}/_workitems/edit/${clonedItem.id}`
        },
        sourceWorkItem: {
          id: sourceWorkItemId,
          title: sourceItem.fields['System.Title'],
          url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${sourceWorkItemId}`
        },
        linkedToSource: linkToSource,
        query_handle: queryHandle
      },
      { 
        source: "clone-work-item",
        clonedId: clonedItem.id,
        sourceId: sourceWorkItemId,
        queryHandle
      }
    );
    
    result.warnings = warnings;
    return result;
  } catch (error) {
    logger.error('Clone work item error:', error);
    return buildErrorResponse(
      error as Error,
      { source: "clone-work-item" }
    );
  }
}
