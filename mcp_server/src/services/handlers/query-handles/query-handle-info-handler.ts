/**
 * Unified handler for inspect-handle tool
 * Combines functionality from validate, inspect, and select handlers
 * 
 * Default behavior: Returns basic inspection data
 * With detailed=true: Includes validation and selection analysis capabilities
 */

import type { ToolConfig, ToolExecutionResult, JSONValue, ToolExecutionData } from "@/types/index.js";
import type { ADOWorkItem } from '@/types/index.js';
import { validateAzureCLI } from "../../../utils/azure-cli-validator.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildNotFoundError } from "@/utils/response-builder.js";
import { logger } from "@/utils/logger.js";
import { queryHandleService } from "../../query-handle-service.js";
import { ADOHttpClient } from '@/utils/ado-http-client.js';
import { getTokenProvider } from '@/utils/token-provider.js';
import { loadConfiguration } from "@/config/config.js";
import { asToolData } from "@/types/index.js";

interface PreviewItem {
  index: number;
  id: number;
  title: string;
  state: string;
  type: string;
  days_inactive?: number;
  last_substantive_change?: string;
  assigned_to?: string;
  tags?: string[];
}

interface WorkItemSample {
  id: number;
  title: string;
  type: string;
  state: string;
}

interface SelectionAnalysis {
  selection_type: 'index-based' | 'all' | 'criteria-based';
  total_items_in_handle: number;
  selected_items_count: number;
  selection_percentage: string;
  showing_preview: string;
  criteria_used?: string[];
}

export async function handleQueryHandleInfo(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error);
    }

    const { 
      queryHandle, 
      detailed = false,
      includePreview = true, 
      includeStats = true, 
      includeExamples = false,
      itemSelector,
      previewCount = 10,
      includeSampleItems = false,
      organization,
      project
    } = parsed.data;

    const queryData = queryHandleService.getQueryData(queryHandle);
    if (!queryData) {
      return buildNotFoundError('query-handle', queryHandle, {
        source: 'query-handle-info',
        hint: 'Query handles expire after 24 hours.'
      });
    }

    logger.info(`Getting info for query handle: ${queryHandle} (${queryData.workItemIds.length} items, detailed=${detailed})`);

    // Build base response (always included)
    const now = new Date();
    const expiresInMs = queryData.expiresAt.getTime() - now.getTime();
    const expiresInMinutes = Math.max(0, Math.floor(expiresInMs / (1000 * 60)));
    const expiresInHours = Math.max(0, Math.floor(expiresInMs / (1000 * 60 * 60)));
    
    const response: Record<string, JSONValue> = {
      query_handle: queryHandle,
      work_item_count: queryData.workItemIds.length,
      created_at: queryData.createdAt.toISOString(),
      expires_at: queryData.expiresAt.toISOString(),
      expires_in_hours: expiresInHours,
      expires_in_minutes: expiresInMinutes,
      query: queryData.query,
      metadata: queryData.metadata || {},
      has_item_context: !!queryData.itemContext,
      selection_enabled: true
    };

    // Include analysis metadata if available and requested
    if (queryData.analysisMetadata && includeStats) {
      response.analysis = {
        staleness_analysis_included: queryData.analysisMetadata.includeSubstantiveChange || false,
        staleness_threshold_days: queryData.analysisMetadata.stalenessThresholdDays,
        analysis_timestamp: queryData.analysisMetadata.analysisTimestamp,
        staleness_success_count: queryData.analysisMetadata.successCount || 0,
        staleness_failure_count: queryData.analysisMetadata.failureCount || 0,
        staleness_coverage: queryData.analysisMetadata.successCount ? 
          ((queryData.analysisMetadata.successCount / queryData.workItemIds.length) * 100).toFixed(1) + '%' : 
          'N/A'
      } as JSONValue;
    }

    // Include preview of work items with indices and selection hints
    if (includePreview) {
      const previewItems: PreviewItem[] = queryData.itemContext.slice(0, 10).map(item => {
        const context = queryData.workItemContext?.get(item.id);
        
        const previewItem: PreviewItem = {
          index: item.index,
          id: item.id,
          title: item.title,
          state: item.state,
          type: item.type
        };

        if (item.daysInactive !== undefined) {
          previewItem.days_inactive = item.daysInactive;
        }

        if (item.lastChange) {
          previewItem.last_substantive_change = item.lastChange;
        }

        if (context?.assignedTo) {
          previewItem.assigned_to = context.assignedTo;
        }

        if (item.tags && item.tags.length > 0) {
          previewItem.tags = item.tags;
        }

        return previewItem;
      });

      // Calculate statistics for selection criteria
      const stateStats: Record<string, number> = {};
      const typeStats: Record<string, number> = {};
      const tagStats: Record<string, number> = {};

      queryData.itemContext.forEach(item => {
        stateStats[item.state] = (stateStats[item.state] || 0) + 1;
        typeStats[item.type] = (typeStats[item.type] || 0) + 1;
        if (item.tags) {
          item.tags.forEach(tag => {
            tagStats[tag] = (tagStats[tag] || 0) + 1;
          });
        }
      });

      // Build available criteria summary
      const availableCriteria: string[] = [];
      
      const statesSummary = Object.entries(stateStats)
        .map(([state, count]) => `${state} (${count} item${count !== 1 ? 's' : ''})`)
        .join(', ');
      availableCriteria.push(`States available: ${statesSummary}`);
      
      const typesSummary = Object.entries(typeStats)
        .map(([type, count]) => `${type} (${count} item${count !== 1 ? 's' : ''})`)
        .join(', ');
      availableCriteria.push(`Work item types: ${typesSummary}`);
      
      if (Object.keys(tagStats).length > 0) {
        const tagsSummary = Object.entries(tagStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([tag, count]) => `${tag} (${count} item${count !== 1 ? 's' : ''})`)
          .join(', ');
        availableCriteria.push(`Tags available: ${tagsSummary}`);
      }

      response.itemPreview = previewItems as unknown as JSONValue;
      response.availableSelectionCriteria = availableCriteria;
      response.selectionStats = {
        totalItems: queryData.workItemIds.length,
        byState: stateStats,
        byType: typeStats,
        byTags: tagStats
      };

      // Add selection hints
      response.selectionHints = [
        `Use index 0 to select the first item`,
        `Use [0, 2, 5] to select specific items by index`,
        `Use {states: ["Active"]} to select all Active items`,
        `Use {tags: ["critical"]} to select items tagged "critical"`,
        `Use {daysInactiveMin: 7} to select stale items (inactive 7+ days)`
      ];
      
      // Only include examples when explicitly requested
      if (includeExamples) {
        const totalItems = queryData.workItemIds.length;
        const exampleStates = Object.keys(stateStats).slice(0, 2);
        const exampleTags = Object.keys(tagStats).slice(0, 1);
        const hasStaleItems = queryData.itemContext.some(item => item.daysInactive && item.daysInactive >= 7);
        
        const selectionExamples: string[] = [
          `"all" - selects all ${totalItems} items`,
          `[0, 1, 2] - selects first 3 items`,
        ];
        
        if (exampleStates.length > 0) {
          const stateCount = stateStats[exampleStates[0]] || 0;
          selectionExamples.push(`{states: ["${exampleStates[0]}"]} - selects ${stateCount} ${exampleStates[0]} item${stateCount !== 1 ? 's' : ''}`);
        }
        
        if (exampleTags.length > 0) {
          const tagCount = tagStats[exampleTags[0]] || 0;
          selectionExamples.push(`{tags: ["${exampleTags[0]}"]} - selects ${tagCount} item${tagCount !== 1 ? 's' : ''} tagged "${exampleTags[0]}"`);
        }
        
        if (hasStaleItems) {
          const staleCount = queryData.itemContext.filter(item => item.daysInactive && item.daysInactive >= 7).length;
          selectionExamples.push(`{daysInactiveMin: 7} - selects ${staleCount} stale item${staleCount !== 1 ? 's' : ''}`);
        }

        response.exampleSelectors = selectionExamples;
      }
    }

    // Time until expiration (reuse 'now' from earlier - already declared at line 79)
    const timeUntilExpiration = queryData.expiresAt.getTime() - now.getTime();
    const minutesUntilExpiration = Math.floor(timeUntilExpiration / (1000 * 60));

    response.expiration_info = {
      expires_in_minutes: minutesUntilExpiration,
      expires_in_hours: (minutesUntilExpiration / 60).toFixed(1),
      is_expired: timeUntilExpiration <= 0
    };

    const warnings: string[] = [];
    if (minutesUntilExpiration < 10) {
      warnings.push(`Query handle expires in ${minutesUntilExpiration} minutes. Consider regenerating soon.`);
    }

    if (queryData.analysisMetadata?.failureCount && queryData.analysisMetadata.failureCount > 0) {
      warnings.push(`${queryData.analysisMetadata.failureCount} work items failed staleness analysis - they lack lastSubstantiveChangeDate/daysInactive fields`);
    }

    // Add detailed validation data if requested
    if (detailed) {
      response.validation = {
        valid: true,
        item_count: queryData.workItemIds.length,
        time_remaining_minutes: minutesUntilExpiration
      };

      // Fetch sample items from ADO API if requested
      if (includeSampleItems && queryData.workItemIds.length > 0) {
        const azValidation = validateAzureCLI();
        if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
          warnings.push('Azure CLI not available for fetching sample items');
        } else {
          const sampleIds = queryData.workItemIds.slice(0, 5);
          const cfg = loadConfiguration();
          const org = organization || cfg.azureDevOps.organization;
          const proj = project || cfg.azureDevOps.project;

          try {
            const httpClient = new ADOHttpClient(org, getTokenProvider());
            const sampleItems: WorkItemSample[] = [];

            for (const id of sampleIds) {
              try {
                const adoResponse = await httpClient.get<ADOWorkItem>(
                  `${proj}/_apis/wit/workitems/${id}?$expand=none&api-version=7.1`
                );

                if (adoResponse.data) {
                  sampleItems.push({
                    id: adoResponse.data.id,
                    title: adoResponse.data.fields?.['System.Title'],
                    type: adoResponse.data.fields?.['System.WorkItemType'],
                    state: adoResponse.data.fields?.['System.State']
                  });
                }
              } catch (err) {
                logger.warn(`Failed to fetch work item ${id}: ${err}`);
              }
            }

            response.validation.sample_items = sampleItems as unknown as JSONValue;
            if (queryData.workItemIds.length > 5) {
              response.validation.sample_note = `Showing first 5 of ${queryData.workItemIds.length} items`;
            }
          } catch (err) {
            logger.error(`Error fetching sample items: ${err}`);
            warnings.push('Failed to fetch sample items from Azure DevOps API');
          }
        }
      }
    }

    // Add selection analysis if itemSelector is provided and detailed mode is on
    if (detailed && itemSelector !== undefined) {
      const selectedWorkItemIds = queryHandleService.resolveItemSelector(queryHandle, itemSelector);
      
      if (!selectedWorkItemIds) {
        warnings.push('Failed to resolve item selector - selection analysis not included');
      } else {
        const totalItems = queryData.workItemIds.length;
        const selectedCount = selectedWorkItemIds.length;

        // Build preview of selected items
        const selectedPreviewItems = selectedWorkItemIds.slice(0, Math.min(previewCount, 50)).map((id: number) => {
          const context = queryData.itemContext.find(item => item.id === id);
          const workItemContext = queryData.workItemContext?.get(id);
          
          return {
            index: context?.index,
            id,
            title: context?.title || "No title",
            state: context?.state || "Unknown",
            type: context?.type || "Unknown",
            days_inactive: context?.daysInactive,
            assigned_to: workItemContext?.assignedTo || "Unassigned",
            tags: context?.tags
          };
        });

        // Analyze selection
        const selectionAnalysis: SelectionAnalysis = {
          selection_type: Array.isArray(itemSelector) ? 'index-based' : 
                         typeof itemSelector === 'string' ? 'all' : 'criteria-based',
          total_items_in_handle: totalItems,
          selected_items_count: selectedCount,
          selection_percentage: ((selectedCount / totalItems) * 100).toFixed(1) + '%',
          showing_preview: `${selectedPreviewItems.length} of ${selectedCount} selected items`
        };

        // Add criteria analysis if applicable
        if (typeof itemSelector === 'object' && !Array.isArray(itemSelector)) {
          const criteriaUsed = Object.keys(itemSelector).filter(key => 
            itemSelector[key as keyof typeof itemSelector] !== undefined
          );
          selectionAnalysis.criteria_used = criteriaUsed;
        }

        response.selection_analysis = {
          item_selector: itemSelector as JSONValue,
          analysis: selectionAnalysis as unknown as JSONValue,
          preview_items: selectedPreviewItems as unknown as JSONValue,
          summary: `Selected ${selectedCount} items out of ${totalItems} total items using ${selectionAnalysis.selection_type} selection`
        };

        if (selectedCount === 0) {
          warnings.push('No items matched the selection criteria');
        }
      }
    }

    return {
      success: true,
      data: response as unknown as ToolExecutionData,
      metadata: { 
        source: "query-handle-info",
        handle: queryHandle,
        detailed_mode: detailed,
        inspected_at: new Date().toISOString()
      },
      errors: [],
      warnings
    };

  } catch (error) {
    logger.error('Query handle info error:', error);
    return {
      success: false,
      data: null,
      metadata: { source: "query-handle-info" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
