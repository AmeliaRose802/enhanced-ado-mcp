/**
 * Export Work Items Handler
 * 
 * Exports work items identified by a query handle to CSV, Excel (XLSX), or TSV format.
 * Supports field selection, relationships, comments, history, and attachments.
 */

import { z } from "zod";
import { ToolConfig, ToolExecutionResult } from "../../../types/index.js";
import { validateAndParse } from "../../../utils/handler-helpers.js";
import { logger } from "../../../utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from "../../../utils/ado-http-client.js";
import { loadConfiguration } from "../../../config/config.js";
import { getTokenProvider } from '../../../utils/token-provider.js';
import { exportWorkItemsSchema } from "../../../config/schemas.js";
import { 
  exportWorkItems, 
  type WorkItemExportData, 
  type ExportOptions 
} from "../../export-service.js";
import type { ADOWorkItem, ADORelation } from "../../../types/ado.js";

export async function handleExportWorkItems(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const validation = validateAndParse(config.schema, args);
    if (!validation.success) {
      return validation.error;
    }

    const {
      queryHandle,
      itemSelector,
      format,
      outputPath,
      fields,
      includeAllFields,
      includeRelationships,
      relationshipDepth,
      includeComments,
      includeHistory,
      includeAttachmentLinks,
      maxHistoryRevisions,
      excelOptions,
      maxItems,
      streamLargeExports,
      organization,
      project
    } = validation.data;

    // Resolve work item IDs from query handle
    const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
    const queryData = queryHandleService.getQueryData(queryHandle);

    if (!selectedWorkItemIds || !queryData) {
      return {
        success: false,
        data: null,
        metadata: { source: "export-work-items" },
        errors: [`Query handle '${queryHandle}' not found or expired. Query handles expire after 24 hours.`],
        warnings: []
      };
    }

    const selectedCount = selectedWorkItemIds.length;
    if (selectedCount === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "export-work-items" },
        errors: ["No work items matched the selection criteria"],
        warnings: []
      };
    }

    logger.info(`Exporting ${selectedCount} work items to ${format.toUpperCase()} format`);

    // Load configuration
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    // Gather work item data with relationships, comments, history
    const workItemsData: WorkItemExportData[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const workItemId of selectedWorkItemIds) {
      try {
        // Fetch base work item
        const workItem = await fetchWorkItem(httpClient, workItemId, org, proj);
        
        const exportData: WorkItemExportData = {
          workItem
        };

        // Fetch relationships if requested
        if (includeRelationships) {
          exportData.relationships = await fetchRelationships(
            httpClient, 
            workItem, 
            relationshipDepth || 1,
            org,
            proj
          );
        }

        // Fetch comments if requested
        if (includeComments) {
          exportData.comments = await fetchComments(httpClient, workItemId, org, proj);
        }

        // Fetch history if requested
        if (includeHistory) {
          exportData.history = await fetchHistory(
            httpClient, 
            workItemId, 
            maxHistoryRevisions || 10,
            org,
            proj
          );
        }

        // Fetch attachments if requested
        if (includeAttachmentLinks) {
          exportData.attachments = await fetchAttachments(httpClient, workItem);
        }

        workItemsData.push(exportData);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error fetching data for work item ${workItemId}: ${errorMsg}`);
        errors.push(`Failed to fetch work item ${workItemId}: ${errorMsg}`);
        
        // Continue with other items
        if (errors.length > 10) {
          warnings.push(`Too many errors (${errors.length}), stopping export`);
          break;
        }
      }
    }

    if (workItemsData.length === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "export-work-items" },
        errors: ["Failed to fetch any work items for export", ...errors],
        warnings
      };
    }

    // Prepare export options
    const exportOpts: ExportOptions = {
      format,
      outputPath,
      fields,
      includeAllFields,
      includeRelationships,
      relationshipDepth,
      includeComments,
      includeHistory,
      includeAttachmentLinks,
      maxHistoryRevisions,
      excelOptions,
      maxItems,
      streamLargeExports
    };

    // Perform export
    const result = await exportWorkItems(workItemsData, exportOpts);

    if (!result.success) {
      return {
        success: false,
        data: null,
        metadata: { source: "export-work-items" },
        errors: ["Export failed"],
        warnings
      };
    }

    // Format file size for display
    const fileSizeKB = (result.fileSize / 1024).toFixed(2);
    const fileSizeMB = result.fileSize > 1024 * 1024 ? ` (${(result.fileSize / (1024 * 1024)).toFixed(2)} MB)` : '';

    return {
      success: true,
      data: {
        filePath: result.filePath,
        itemCount: result.itemCount,
        format: result.format,
        fileSize: `${fileSizeKB} KB${fileSizeMB}`,
        metadata: result.metadata,
        warnings: warnings.length > 0 ? warnings : undefined
      },
      metadata: {
        source: "export-work-items",
        query_handle: queryHandle,
        timestamp: new Date().toISOString()
      },
      errors: errors.length > 0 ? errors : [],
      warnings
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Export work items handler error: ${errorMsg}`);

    return {
      success: false,
      data: null,
      metadata: { source: "export-work-items" },
      errors: [`Export failed: ${errorMsg}`],
      warnings: []
    };
  }
}

/**
 * Fetch a single work item with all fields
 */
async function fetchWorkItem(
  httpClient: ADOHttpClient,
  workItemId: number,
  org: string,
  proj: string
): Promise<ADOWorkItem> {
  const url = `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${workItemId}?$expand=all&api-version=7.1`;
  const response = await httpClient.get<ADOWorkItem>(url);
  return response.data;
}

/**
 * Fetch relationships for a work item
 */
async function fetchRelationships(
  httpClient: ADOHttpClient,
  workItem: ADOWorkItem,
  depth: number,
  org: string,
  proj: string
): Promise<Array<{
  type: string;
  targetId: number;
  targetTitle?: string;
  targetType?: string;
  url?: string;
}>> {
  const relationships: Array<{
    type: string;
    targetId: number;
    targetTitle?: string;
    targetType?: string;
    url?: string;
  }> = [];

  if (!workItem.relations || workItem.relations.length === 0) {
    return relationships;
  }

  // Filter for work item relations (exclude attachments, hyperlinks, etc.)
  const workItemRelations = workItem.relations.filter((rel: ADORelation) => 
    rel.rel && 
    rel.url && 
    (rel.rel.includes('Child') || 
     rel.rel.includes('Parent') || 
     rel.rel.includes('Related') ||
     rel.rel.includes('Predecessor') ||
     rel.rel.includes('Successor'))
  );

  for (const relation of workItemRelations) {
    try {
      // Extract work item ID from URL
      const idMatch = relation.url.match(/workitems\/(\d+)/);
      if (!idMatch) continue;

      const targetId = parseInt(idMatch[1], 10);

      // Fetch target work item details
      const targetWorkItem = await fetchWorkItem(httpClient, targetId, org, proj);

      relationships.push({
        type: relation.rel || 'Unknown',
        targetId,
        targetTitle: targetWorkItem.fields['System.Title'] as string,
        targetType: targetWorkItem.fields['System.WorkItemType'] as string,
        url: relation.url
      });

    } catch (error) {
      logger.warn(`Failed to fetch relationship details: ${error}`);
      // Add basic relationship info even if fetch failed
      const idMatch = relation.url.match(/workitems\/(\d+)/);
      if (idMatch) {
        relationships.push({
          type: relation.rel || 'Unknown',
          targetId: parseInt(idMatch[1], 10),
          url: relation.url
        });
      }
    }
  }

  return relationships;
}

/**
 * Fetch comments for a work item
 */
async function fetchComments(
  httpClient: ADOHttpClient,
  workItemId: number,
  org: string,
  proj: string
): Promise<Array<{
  id: number;
  text: string;
  createdBy: string;
  createdDate: string;
}>> {
  try {
    const url = `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${workItemId}/comments?api-version=7.1`;
    interface CommentsResponse {
      comments: Array<{ 
        id: number; 
        text: string; 
        createdBy: { displayName: string }; 
        createdDate: string;
      }>;
    }
    const response = await httpClient.get<CommentsResponse>(url);

    return (response.data.comments || []).map((comment: { id: number; text: string; createdBy: { displayName: string }; createdDate: string }) => ({
      id: comment.id,
      text: comment.text,
      createdBy: comment.createdBy?.displayName || 'Unknown',
      createdDate: comment.createdDate
    }));
  } catch (error) {
    logger.warn(`Failed to fetch comments for work item ${workItemId}: ${error}`);
    return [];
  }
}

/**
 * Fetch revision history for a work item
 */
async function fetchHistory(
  httpClient: ADOHttpClient,
  workItemId: number,
  maxRevisions: number,
  org: string,
  proj: string
): Promise<Array<{
  rev: number;
  changedDate: string;
  changedBy: string;
  changes: string;
}>> {
  try {
    const url = `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${workItemId}/revisions?$top=${maxRevisions}&api-version=7.1`;
    interface RevisionsResponse {
      value: Array<{ 
        rev: number; 
        fields: { 
          'System.ChangedDate': string; 
          'System.ChangedBy': string | { displayName: string };
        };
      }>;
    }
    const response = await httpClient.get<RevisionsResponse>(url);

    return (response.data.value || []).map((revision: { rev: number; fields: { 'System.ChangedDate': string; 'System.ChangedBy': string | { displayName: string } } }) => {
      const changedBy = revision.fields['System.ChangedBy'];
      return {
        rev: revision.rev,
        changedDate: revision.fields['System.ChangedDate'],
        changedBy: typeof changedBy === 'string' ? changedBy : (changedBy?.displayName || 'Unknown'),
        changes: `Revision ${revision.rev}` // Simplified - detailed diff would require more API calls
      };
    });
  } catch (error) {
    logger.warn(`Failed to fetch history for work item ${workItemId}: ${error}`);
    return [];
  }
}

/**
 * Fetch attachments for a work item
 */
async function fetchAttachments(
  httpClient: ADOHttpClient,
  workItem: ADOWorkItem
): Promise<Array<{
  id: number;
  name: string;
  url: string;
  size: number;
}>> {
  const attachments: Array<{
    id: number;
    name: string;
    url: string;
    size: number;
  }> = [];

  if (!workItem.relations || workItem.relations.length === 0) {
    return attachments;
  }

  // Filter for attachment relations
  const attachmentRelations = workItem.relations.filter((rel: ADORelation) => 
    rel.rel === 'AttachedFile'
  );

  for (const relation of attachmentRelations) {
    const attributes = relation.attributes || {};
    const idMatch = relation.url.match(/\/(\d+)$/);
    
    attachments.push({
      id: idMatch ? parseInt(idMatch[1], 10) : 0,
      name: (attributes.name as string) || 'Unknown',
      url: relation.url,
      size: attributes.resourceSize ? (typeof attributes.resourceSize === 'number' ? attributes.resourceSize : parseInt(attributes.resourceSize as string, 10)) : 0
    });
  }

  return attachments;
}
