/**
 * Handler for link-workitems tool
 * 
 * Creates relationships between work items identified by two query handles.
 * Supports multiple link types and strategies for efficient bulk relationship creation.
 * This eliminates ID hallucination risk by using stored query results.
 */

import { ToolConfig, ToolExecutionResult, asToolData } from "@/types/index.js";
import type { ADOWorkItem, ADOFieldOperation } from '@/types/index.js';
import { validateAzureCLI } from "../../../utils/azure-cli-validator.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse } from "@/utils/response-builder.js";
import { logger, errorToContext } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from '@/utils/ado-http-client.js';
import { getTokenProvider } from '@/utils/token-provider.js';
import { loadConfiguration } from "@/config/config.js";

/**
 * Map user-friendly link types to ADO internal link type references
 */
const LINK_TYPE_MAP: Record<string, string> = {
  "Parent": "System.LinkTypes.Hierarchy-Reverse",
  "Child": "System.LinkTypes.Hierarchy-Forward",
  "Related": "System.LinkTypes.Related",
  "Predecessor": "System.LinkTypes.Dependency-Reverse",
  "Successor": "System.LinkTypes.Dependency-Forward",
  "Affects": "Microsoft.VSTS.Common.Affects-Forward",
  "Affected By": "Microsoft.VSTS.Common.Affects-Reverse"
};

/**
 * Link types that create hierarchical relationships
 */
const HIERARCHICAL_LINK_TYPES = ["Parent", "Child"];

/**
 * Work item types that can have parent-child relationships
 */
const VALID_PARENT_TYPES = ["Epic", "Feature"];
const VALID_CHILD_TYPES = ["Feature", "Product Backlog Item", "User Story", "Task", "Bug"];

interface LinkOperation {
  sourceId: number;
  targetId: number;
  linkType: string;
}

interface LinkResult {
  sourceId: number;
  targetId: number;
  success: boolean;
  linkType: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Validate if link type is appropriate for work item types
 */
function validateLinkTypeForWorkItems(
  sourceType: string,
  targetType: string,
  linkType: string
): { valid: boolean; reason?: string } {
  if (!HIERARCHICAL_LINK_TYPES.includes(linkType)) {
    // Non-hierarchical links are always valid
    return { valid: true };
  }

  if (linkType === "Parent") {
    // Source becomes child, target becomes parent
    if (!VALID_PARENT_TYPES.includes(targetType)) {
      return {
        valid: false,
        reason: `Target work item type '${targetType}' cannot be a parent (valid parent types: ${VALID_PARENT_TYPES.join(", ")})`
      };
    }
    if (!VALID_CHILD_TYPES.includes(sourceType)) {
      return {
        valid: false,
        reason: `Source work item type '${sourceType}' cannot be a child (valid child types: ${VALID_CHILD_TYPES.join(", ")})`
      };
    }
  } else if (linkType === "Child") {
    // Source becomes parent, target becomes child
    if (!VALID_PARENT_TYPES.includes(sourceType)) {
      return {
        valid: false,
        reason: `Source work item type '${sourceType}' cannot be a parent (valid parent types: ${VALID_PARENT_TYPES.join(", ")})`
      };
    }
    if (!VALID_CHILD_TYPES.includes(targetType)) {
      return {
        valid: false,
        reason: `Target work item type '${targetType}' cannot be a child (valid child types: ${VALID_CHILD_TYPES.join(", ")})`
      };
    }
  }

  return { valid: true };
}

/**
 * Check if a link already exists between two work items
 * NOTE: This is a legacy function kept for fallback. Use batchCheckExistingLinks for better performance.
 */
async function checkExistingLink(
  httpClient: ADOHttpClient,
  sourceId: number,
  targetId: number,
  linkTypeRef: string
): Promise<boolean> {
  try {
    const response = await httpClient.get<ADOWorkItem>(`wit/workitems/${sourceId}?$expand=relations`);
    const workItem = response.data;

    if (!workItem.relations) {
      return false;
    }

    // Check if link already exists
    return workItem.relations.some((rel) => {
      if (rel.rel !== linkTypeRef) {
        return false;
      }
      // Extract target ID from URL
      const urlMatch = rel.url?.match(/workItems\/(\d+)$/);
      if (!urlMatch) {
        return false;
      }
      const linkedId = parseInt(urlMatch[1], 10);
      return linkedId === targetId;
    });
  } catch (error) {
    logger.warn(`Failed to check existing link for work item ${sourceId}:`, errorToContext(error));
    return false;
  }
}

/**
 * Batch check for existing links between work items
 * OPTIMIZATION: Fetch all work items with relations in batches instead of individual calls
 * Reduces API calls from N to ceil(N/200) for link validation
 */
async function batchCheckExistingLinks(
  httpClient: ADOHttpClient,
  operations: LinkOperation[],
  linkTypeRef: string
): Promise<Map<string, boolean>> {
  const existingLinks = new Map<string, boolean>();
  
  // Get unique source IDs
  const uniqueSourceIds = Array.from(new Set(operations.map(op => op.sourceId)));
  
  logger.info(`Batch checking existing links for ${uniqueSourceIds.length} source work items`);
  
  try {
    // ADO supports up to 200 IDs per request
    const BATCH_SIZE = 200;
    const workItemsById = new Map<number, ADOWorkItem>();
    
    for (let i = 0; i < uniqueSourceIds.length; i += BATCH_SIZE) {
      const batchIds = uniqueSourceIds.slice(i, i + BATCH_SIZE);
      const idsParam = batchIds.join(',');
      
      const response = await httpClient.get<{ value: ADOWorkItem[] }>(
        `wit/workitems?ids=${idsParam}&$expand=relations&api-version=7.1`
      );
      
      for (const item of response.data.value) {
        workItemsById.set(item.id, item);
      }
    }
    
    logger.info(`Successfully fetched relations for ${workItemsById.size} work items`);
    
    // Check each operation against cached work items
    for (const op of operations) {
      const key = `${op.sourceId}-${op.targetId}`;
      const workItem = workItemsById.get(op.sourceId);
      
      if (!workItem || !workItem.relations) {
        existingLinks.set(key, false);
        continue;
      }
      
      // Check if link exists in relations
      const linkExists = workItem.relations.some((rel) => {
        if (rel.rel !== linkTypeRef) {
          return false;
        }
        const urlMatch = rel.url?.match(/workItems\/(\d+)$/);
        if (!urlMatch) {
          return false;
        }
        const linkedId = parseInt(urlMatch[1], 10);
        return linkedId === op.targetId;
      });
      
      existingLinks.set(key, linkExists);
    }
    
    return existingLinks;
  } catch (error) {
    logger.error('Batch check existing links failed:', errorToContext(error));
    // Return empty map to fall back to individual checks
    return new Map();
  }
}

/**
 * Generate link operations based on strategy
 */
function generateLinkOperations(
  sourceIds: number[],
  targetIds: number[],
  linkType: string,
  linkStrategy: string
): LinkOperation[] {
  const operations: LinkOperation[] = [];

  switch (linkStrategy) {
    case "one-to-one":
      // Pair items by index position
      const pairCount = Math.min(sourceIds.length, targetIds.length);
      for (let i = 0; i < pairCount; i++) {
        operations.push({
          sourceId: sourceIds[i],
          targetId: targetIds[i],
          linkType
        });
      }
      break;

    case "one-to-many":
      // Link first source to all targets
      if (sourceIds.length > 0) {
        const sourceId = sourceIds[0];
        for (const targetId of targetIds) {
          operations.push({ sourceId, targetId, linkType });
        }
      }
      break;

    case "many-to-one":
      // Link all sources to first target
      if (targetIds.length > 0) {
        const targetId = targetIds[0];
        for (const sourceId of sourceIds) {
          operations.push({ sourceId, targetId, linkType });
        }
      }
      break;

    case "many-to-many":
      // Link all sources to all targets
      for (const sourceId of sourceIds) {
        for (const targetId of targetIds) {
          operations.push({ sourceId, targetId, linkType });
        }
      }
      break;

    default:
      throw new Error(`Invalid link strategy: ${linkStrategy}`);
  }

  return operations;
}

/**
 * Detect circular dependencies in link operations
 */
function detectCircularDependencies(operations: LinkOperation[]): LinkOperation[] {
  const circular: LinkOperation[] = [];
  const seen = new Set<string>();

  for (const op of operations) {
    // Check for self-links
    if (op.sourceId === op.targetId) {
      circular.push(op);
      continue;
    }

    // Create a normalized key for the pair (order matters for directional links)
    const forwardKey = `${op.sourceId}->${op.targetId}:${op.linkType}`;
    const reverseKey = `${op.targetId}->${op.sourceId}:${op.linkType}`;

    // Check if reverse link already seen
    if (seen.has(reverseKey)) {
      circular.push(op);
      continue;
    }

    seen.add(forwardKey);
  }

  return circular;
}

/**
 * Create a link between two work items
 */
async function createLink(
  httpClient: ADOHttpClient,
  operation: LinkOperation,
  organization: string,
  project: string,
  comment?: string
): Promise<void> {
  const linkTypeRef = LINK_TYPE_MAP[operation.linkType];
  if (!linkTypeRef) {
    throw new Error(`Unknown link type: ${operation.linkType}`);
  }

  const linkFields: ADOFieldOperation[] = [
    {
      op: "add",
      path: "/relations/-",
      value: {
        rel: linkTypeRef,
        url: `https://dev.azure.com/${organization}/${project}/_apis/wit/workItems/${operation.targetId}`,
        attributes: comment ? { comment } : undefined
      }
    }
  ];

  await httpClient.patch(`wit/workitems/${operation.sourceId}`, linkFields);
}

export async function handleBulkLinkByQueryHandles(
  config: ToolConfig,
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const {
      sourceQueryHandle,
      targetQueryHandle,
      linkType,
      sourceItemSelector,
      targetItemSelector,
      linkStrategy,
      comment,
      skipExistingLinks,
      dryRun,
      maxPreviewItems,
      organization,
      project
    } = parsed.data;

    // Resolve source and target work items
    const sourceIds = queryHandleService.resolveItemSelector(sourceQueryHandle, sourceItemSelector);
    const targetIds = queryHandleService.resolveItemSelector(targetQueryHandle, targetItemSelector);
    const sourceData = queryHandleService.getQueryData(sourceQueryHandle);
    const targetData = queryHandleService.getQueryData(targetQueryHandle);

    if (!sourceIds || !sourceData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-link-by-query-handles" },
        errors: [
          `Source query handle '${sourceQueryHandle}' not found or expired. Query handles expire after 24 hours.`
        ],
        warnings: []
      };
    }

    if (!targetIds || !targetData) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-link-by-query-handles" },
        errors: [
          `Target query handle '${targetQueryHandle}' not found or expired. Query handles expire after 24 hours.`
        ],
        warnings: []
      };
    }

    if (sourceIds.length === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-link-by-query-handles" },
        errors: [
          "No source items selected after applying filters"
        ],
        warnings: []
      };
    }

    if (targetIds.length === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-link-by-query-handles" },
        errors: [
          "No target items selected after applying filters"
        ],
        warnings: []
      };
    }

    logger.info(
      `Bulk link operation: ${sourceIds.length} source(s) × ${targetIds.length} target(s) using ${linkStrategy} strategy`
    );

    // Generate link operations based on strategy
    const operations = generateLinkOperations(sourceIds, targetIds, linkType, linkStrategy);

    if (operations.length === 0) {
      return {
        success: false,
        data: null,
        metadata: { source: "bulk-link-by-query-handles" },
        errors: ["No link operations generated. Check that both source and target have items."],
        warnings: []
      };
    }

    // Validate link types for work item types
    const warnings: string[] = [];
    
    // Check for count mismatch in one-to-one strategy
    if (linkStrategy === "one-to-one" && sourceIds.length !== targetIds.length) {
      const unpaired = Math.abs(sourceIds.length - targetIds.length);
      warnings.push(
        `⚠️ Count mismatch in one-to-one strategy: ${unpaired} item(s) will be unpaired`
      );
    }
    const validOperations: LinkOperation[] = [];
    const invalidOperations: Array<{ operation: LinkOperation; reason: string }> = [];

    for (const op of operations) {
      const sourceContext = sourceData.itemContext.find(item => item.id === op.sourceId);
      const targetContext = targetData.itemContext.find(item => item.id === op.targetId);

      if (!sourceContext || !targetContext) {
        invalidOperations.push({
          operation: op,
          reason: "Missing work item context"
        });
        continue;
      }

      const validation = validateLinkTypeForWorkItems(
        sourceContext.type,
        targetContext.type,
        linkType
      );

      if (!validation.valid) {
        const reason = validation.reason || "Invalid link type for work item types";
        invalidOperations.push({
          operation: op,
          reason
        });
        // Add specific validation warning
        if (!warnings.some(w => w.includes(reason))) {
          warnings.push(`⚠️ ${reason}`);
        }
      } else {
        validOperations.push(op);
      }
    }

    // Detect circular dependencies
    const circularOps = detectCircularDependencies(validOperations);
    if (circularOps.length > 0) {
      warnings.push(
        `⚠️ Detected ${circularOps.length} potential circular dependencies that will be skipped`
      );
    }

    // Remove circular dependencies from valid operations
    const finalOperations = validOperations.filter(
      op => !circularOps.some(circ => circ.sourceId === op.sourceId && circ.targetId === op.targetId)
    );

    if (dryRun) {
      // Preview mode
      const previewLimit = maxPreviewItems || 10;
      const previewOperations = finalOperations.slice(0, previewLimit).map(op => {
        const sourceContext = sourceData.itemContext.find(item => item.id === op.sourceId);
        const targetContext = targetData.itemContext.find(item => item.id === op.targetId);

        return {
          source: {
            id: op.sourceId,
            title: sourceContext?.title || "Unknown",
            type: sourceContext?.type || "Unknown"
          },
          target: {
            id: op.targetId,
            title: targetContext?.title || "Unknown",
            type: targetContext?.type || "Unknown"
          },
          linkType: op.linkType,
          linkTypeReference: LINK_TYPE_MAP[op.linkType]
        };
      });

      const previewWarnings = [...warnings, "Dry run mode - no links created"];
      if (invalidOperations.length > 0) {
        previewWarnings.push(
          `⚠️ ${invalidOperations.length} operations invalid and will be skipped`
        );
      }
      if (finalOperations.length > previewLimit) {
        previewWarnings.push(
          `Showing ${previewLimit} of ${finalOperations.length} operations in preview`
        );
      }

      return {
        success: true,
        data: {
          dry_run: true,
          source_query_handle: sourceQueryHandle,
          target_query_handle: targetQueryHandle,
          link_type: linkType,
          link_type_ref: LINK_TYPE_MAP[linkType],
          link_strategy: linkStrategy,
          source_items_count: sourceIds.length,
          target_items_count: targetIds.length,
          source_items_selected: sourceIds.length,
          target_items_selected: targetIds.length,
          link_operations_count: finalOperations.length,
          total_operations_generated: operations.length,
          valid_operations: finalOperations.length,
          invalid_operations: invalidOperations.length,
          circular_dependencies_detected: circularOps.length,
          preview: previewOperations,
          preview_operations: previewOperations,
          invalid_operation_samples: invalidOperations.slice(0, 5).map(inv => ({
            source_id: inv.operation.sourceId,
            target_id: inv.operation.targetId,
            reason: inv.reason
          })),
          summary: `DRY RUN: Would create ${finalOperations.length} links using ${linkStrategy} strategy`
        },
        metadata: {
          source: "bulk-link-by-query-handles",
          dryRun: true,
          linkStrategy
        },
        errors: [],
        warnings: previewWarnings
      };
    }

    // Execute link creation
    const cfg = loadConfiguration();
    const org = organization || cfg.azureDevOps.organization;
    const proj = project || cfg.azureDevOps.project;
    const httpClient = new ADOHttpClient(org, getTokenProvider(), proj);

    const results: LinkResult[] = [];
    
    // OPTIMIZATION: Batch check existing links if skipExistingLinks is enabled
    // This reduces API calls from N to ceil(N/200) for link validation
    let existingLinksCache: Map<string, boolean> | undefined;
    
    if (skipExistingLinks && finalOperations.length > 0) {
      logger.info(`Batch checking for existing links before creation`);
      const linkTypeRef = LINK_TYPE_MAP[linkType];
      existingLinksCache = await batchCheckExistingLinks(httpClient, finalOperations, linkTypeRef);
      
      if (existingLinksCache.size > 0) {
        logger.info(`Batch check found ${Array.from(existingLinksCache.values()).filter(v => v).length} existing links`);
      } else {
        logger.warn(`Batch check failed or returned no results, will fall back to individual checks`);
        existingLinksCache = undefined;
      }
    }

    for (const op of finalOperations) {
      try {
        // Check for existing link if skipExistingLinks is true
        if (skipExistingLinks) {
          const linkTypeRef = LINK_TYPE_MAP[op.linkType];
          const cacheKey = `${op.sourceId}-${op.targetId}`;
          
          // Use batch result if available, otherwise fall back to individual check
          let exists = false;
          if (existingLinksCache && existingLinksCache.has(cacheKey)) {
            exists = existingLinksCache.get(cacheKey)!;
          } else {
            // Fallback to individual check if batch failed
            exists = await checkExistingLink(httpClient, op.sourceId, op.targetId, linkTypeRef);
          }

          if (exists) {
            results.push({
              sourceId: op.sourceId,
              targetId: op.targetId,
              linkType: op.linkType,
              success: true,
              skipped: true,
              skipReason: "Link already exists"
            });
            logger.debug(`Skipped existing link: ${op.sourceId} -> ${op.targetId}`);
            continue;
          }
        }

        // Create the link
        await createLink(httpClient, op, org, proj, comment);

        results.push({
          sourceId: op.sourceId,
          targetId: op.targetId,
          linkType: op.linkType,
          success: true
        });

        logger.debug(`Created link: ${op.sourceId} -> ${op.targetId} (${op.linkType})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          sourceId: op.sourceId,
          targetId: op.targetId,
          linkType: op.linkType,
          success: false,
          error: errorMsg
        });
        logger.error(`Failed to create link ${op.sourceId} -> ${op.targetId}:`, errorToContext(error));
      }
    }

    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failureCount = results.filter(r => !r.success).length;

    // Add summary warnings
    if (invalidOperations.length > 0) {
      warnings.push(
        `⚠️ Skipped ${invalidOperations.length} invalid operations (incompatible work item types)`
      );
    }
    if (skippedCount > 0) {
      warnings.push(`ℹ️ Skipped ${skippedCount} links that already exist`);
    }

    return {
      success: true, // Return success even with partial failures
      data: asToolData({
        source_query_handle: sourceQueryHandle,
        target_query_handle: targetQueryHandle,
        link_type: linkType,
        link_type_ref: LINK_TYPE_MAP[linkType],
        link_strategy: linkStrategy,
        source_items: sourceIds.length,
        target_items: targetIds.length,
        source_items_count: sourceIds.length,
        target_items_count: targetIds.length,
        source_items_selected: sourceIds.length,
        target_items_selected: targetIds.length,
        link_operations_count: finalOperations.length,
        operations_attempted: finalOperations.length,
        links_created: successCount,
        links_succeeded: successCount,
        links_skipped: skippedCount,
        links_failed: failureCount,
        invalid_operations: invalidOperations.length,
        results: results.slice(0, maxPreviewItems || 10),
        summary: `Successfully created ${successCount} links${
          skippedCount > 0 ? ` (${skippedCount} already existed)` : ""
        }${failureCount > 0 ? ` (${failureCount} failed)` : ""}${
          invalidOperations.length > 0
            ? ` (${invalidOperations.length} invalid operations skipped)`
            : ""
        }`
      }),
      metadata: {
        source: "bulk-link-by-query-handles",
        linkStrategy
      },
      errors:
        failureCount > 0
          ? results
              .filter(r => !r.success)
              .slice(0, 10)
              .map(r => `Link ${r.sourceId} -> ${r.targetId}: ${r.error}`)
          : [],
      warnings
    };
  } catch (error) {
    logger.error("Bulk link by query handles error:", errorToContext(error));
    return {
      success: false,
      data: null,
      metadata: { source: "bulk-link-by-query-handles" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
