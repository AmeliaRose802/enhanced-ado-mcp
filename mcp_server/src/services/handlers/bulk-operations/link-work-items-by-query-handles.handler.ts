/**
 * Handler for wit-link-work-items-by-query-handles tool
 * Create relationships between work items using query handles to prevent ID hallucination
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "../../../types/index.js";
import { validateAzureCLI } from "../../ado-discovery-service.js";
import { createWorkItemRepository } from "../../../repositories/work-item.repository.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSuccessResponse, buildErrorResponse, buildNotFoundError } from "../../../utils/response-builder.js";
import { logger } from "../../../utils/logger.js";
import { getRequiredConfig } from "../../../config/config.js";
import { queryHandleService } from "../../query-handle-service.js";
import type { ADOFieldOperation } from "../../../types/index.js";

interface LinkWorkItemsArgs {
  sourceQueryHandle: string;
  targetQueryHandle: string;
  linkType: "Related" | "Parent" | "Child" | "Predecessor" | "Successor" | "Affects" | "Affected By";
  sourceItemSelector?: any;
  targetItemSelector?: any;
  linkStrategy?: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  comment?: string;
  skipExistingLinks?: boolean;
  dryRun?: boolean;
  maxPreviewItems?: number;
  organization?: string;
  project?: string;
}

// Map link types to ADO relationship names
const LINK_TYPE_MAP: Record<string, string> = {
  'Related': 'System.LinkTypes.Related',
  'Parent': 'System.LinkTypes.Hierarchy-Reverse',
  'Child': 'System.LinkTypes.Hierarchy-Forward',
  'Predecessor': 'System.LinkTypes.Dependency-Reverse',
  'Successor': 'System.LinkTypes.Dependency-Forward',
  'Affects': 'Microsoft.VSTS.Common.Affects-Forward',
  'Affected By': 'Microsoft.VSTS.Common.Affects-Reverse'
};

export async function handleLinkWorkItemsByQueryHandles(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const requiredConfig = getRequiredConfig();
    const {
      sourceQueryHandle,
      targetQueryHandle,
      linkType,
      sourceItemSelector = "all",
      targetItemSelector = "all",
      linkStrategy = "one-to-one",
      comment,
      skipExistingLinks = true,
      dryRun = true,
      maxPreviewItems = 10,
      organization = requiredConfig.organization,
      project = requiredConfig.project
    } = parsed.data as LinkWorkItemsArgs;

    logger.debug(`Linking work items: ${sourceQueryHandle} -> ${targetQueryHandle} (${linkType})`);

    // Resolve source and target work items using query handle service
    const sourceIds = queryHandleService.resolveItemSelector(sourceQueryHandle, sourceItemSelector);
    const targetIds = queryHandleService.resolveItemSelector(targetQueryHandle, targetItemSelector);
    const sourceData = queryHandleService.getQueryData(sourceQueryHandle);
    const targetData = queryHandleService.getQueryData(targetQueryHandle);

    if (!sourceIds || !sourceData) {
      return buildNotFoundError('query-handle', sourceQueryHandle, { source: 'link-work-items' });
    }

    if (!targetIds || !targetData) {
      return buildNotFoundError('query-handle', targetQueryHandle, { source: 'link-work-items' });
    }

    if (sourceIds.length === 0) {
      return buildErrorResponse(
        'No source items matched the selector criteria',
        { source: 'link-work-items', sourceQueryHandle }
      );
    }

    if (targetIds.length === 0) {
      return buildErrorResponse(
        'No target items matched the selector criteria',
        { source: 'link-work-items', targetQueryHandle }
      );
    }

    // Generate link pairs based on strategy
    const linkPairs: Array<{source: number, target: number}> = [];
    
    switch (linkStrategy) {
      case 'one-to-one':
        // Pair items 1:1 up to the minimum length
        const minLength = Math.min(sourceIds.length, targetIds.length);
        for (let i = 0; i < minLength; i++) {
          linkPairs.push({ source: sourceIds[i], target: targetIds[i] });
        }
        break;
        
      case 'one-to-many':
        // One source item links to all target items
        if (sourceIds.length !== 1) {
          return buildErrorResponse(
            `one-to-many strategy requires exactly 1 source item, got ${sourceIds.length}`,
            { source: 'link-work-items' }
          );
        }
        targetIds.forEach((target: number) => {
          linkPairs.push({ source: sourceIds[0], target: target });
        });
        break;
        
      case 'many-to-one':
        // All source items link to one target item
        if (targetIds.length !== 1) {
          return buildErrorResponse(
            `many-to-one strategy requires exactly 1 target item, got ${targetIds.length}`,
            { source: 'link-work-items' }
          );
        }
        sourceIds.forEach((source: number) => {
          linkPairs.push({ source: source, target: targetIds[0] });
        });
        break;
        
      case 'many-to-many':
        // All source items link to all target items (Cartesian product)
        sourceIds.forEach((source: number) => {
          targetIds.forEach((target: number) => {
            linkPairs.push({ source: source, target: target });
          });
        });
        break;
    }

    logger.debug(`Generated ${linkPairs.length} link pairs`);

    const preview = linkPairs.slice(0, maxPreviewItems).map(pair => {
      const sourceItem = sourceData.itemContext.find((i: any) => i.id === pair.source);
      const targetItem = targetData.itemContext.find((i: any) => i.id === pair.target);
      
      return {
        sourceId: pair.source,
        sourceTitle: sourceItem?.title || 'Unknown',
        targetId: pair.target,
        targetTitle: targetItem?.title || 'Unknown',
        linkType
      };
    });

    // If dry run, just return preview
    if (dryRun) {
      return buildSuccessResponse(
        {
          dryRun: true,
          preview,
          totalLinksToCreate: linkPairs.length,
          sourceItemsCount: sourceIds.length,
          targetItemsCount: targetIds.length,
          linkStrategy,
          message: "This is a dry run. No changes were made. Set dryRun=false to execute."
        },
        { 
          source: "link-work-items",
          dryRun: true,
          linkCount: linkPairs.length
        }
      );
    }

    // Execute actual linking
    const repository = createWorkItemRepository(organization, project);
    const results = {
      successful: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    };

    const adoLinkType = LINK_TYPE_MAP[linkType];
    if (!adoLinkType) {
      return buildErrorResponse(
        `Unknown link type: ${linkType}`,
        { source: 'link-work-items' }
      );
    }

    for (const pair of linkPairs) {
      try {
        // Check if link already exists if skipExistingLinks is true
        if (skipExistingLinks) {
          const sourceItem = await repository.getById(pair.source);
          const existingLinks = sourceItem.relations || [];
          
          const alreadyLinked = existingLinks.some((rel: any) => 
            rel.rel === adoLinkType && 
            rel.url && 
            rel.url.includes(`/${pair.target}`)
          );
          
          if (alreadyLinked) {
            results.skipped++;
            continue;
          }
        }

        // Create link
        const linkFields: ADOFieldOperation[] = [{
          op: 'add',
          path: '/relations/-',
          value: {
            rel: adoLinkType,
            url: `https://dev.azure.com/${organization}/${project}/_apis/wit/workItems/${pair.target}`,
            attributes: comment ? { comment } : {}
          }
        }];

        await repository.update(pair.source, linkFields);
        results.successful++;
        
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to link ${pair.source} -> ${pair.target}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return buildSuccessResponse(
      {
        summary: {
          totalAttempted: linkPairs.length,
          successful: results.successful,
          skipped: results.skipped,
          failed: results.failed
        },
        preview,
        errors: results.errors.length > 0 ? results.errors : undefined
      },
      { 
        source: "link-work-items",
        successful: results.successful,
        failed: results.failed
      }
    );

  } catch (error) {
    logger.error('Link work items error:', error);
    return buildErrorResponse(
      error as Error,
      { source: "link-work-items" }
    );
  }
}
