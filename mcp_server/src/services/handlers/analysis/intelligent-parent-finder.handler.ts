/**
 * Handler for recommend-parent tool
 * 
 * AI-powered intelligent parent finder that prevents ID hallucination by:
 * 1. Accepting a QUERY HANDLE containing child work items (not raw IDs)
 * 2. For each child, searching for potential parent candidates IN THE SAME AREA PATH
 * 3. Using AI to rank candidates based on type hierarchy, scope, and semantic fit
 * 4. Returning recommendations with confidence scores
 * 5. Optionally creating a query handle for safe linking (disabled in dry run mode)
 * 
 * **CRITICAL SAFETY RULES:**
 * - Only recommends parents in the SAME area path as child (no cross-area linking)
 * - Only recommends valid parent types per Azure DevOps hierarchy
 * - Uses query handles throughout to prevent ID hallucination
 */

import { ToolConfig, ToolExecutionResult } from "@/types/index.js";
import { validateAzureCLI } from "../../../utils/azure-cli-validator.js";
import { getRequiredConfig } from "@/config/config.js";
import { queryWorkItemsByWiql } from "../../ado-work-item-service.js";
import { logger } from "@/utils/logger.js";
import { escapeAreaPath } from "@/utils/work-item-parser.js";
import { buildValidationErrorResponse, buildAzureCliErrorResponse, buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from "@/utils/response-builder.js";
import { queryHandleService } from "../../query-handle-service.js";
import type { SamplingService } from "../../sampling-service.js";
import { SamplingClient } from "@/utils/sampling-client.js";
import { ADOHttpClient } from "@/utils/ado-http-client.js";
import { getTokenProvider } from "@/utils/token-provider.js";
import type { ADOWorkItem } from "@/types/index.js";
import { formatForAI } from "@/utils/ai-helpers.js";

interface IntelligentParentFinderArgs {
  childQueryHandle: string;
  dryRun?: boolean;
  areaPath?: string;
  includeSubAreas?: boolean;
  maxParentCandidates?: number;
  maxRecommendations?: number;
  parentWorkItemTypes?: string[];
  searchScope?: 'area' | 'project' | 'iteration';
  iterationPath?: string;
  requireActiveParents?: boolean;
  confidenceThreshold?: number;
  organization?: string;
  project?: string;
}

interface ParentRecommendation {
  parentWorkItemId: number;
  parentTitle: string;
  parentType: string;
  parentState: string;
  parentAreaPath: string;
  confidence: number;
  reasoning: string;
  benefits: string[];
  potentialConcerns?: string[];
}

interface ChildAnalysisResult {
  childWorkItemId: number;
  childTitle: string;
  childType: string;
  childAreaPath: string;
  recommendations: ParentRecommendation[];
  warnings: string[];
  candidatesAnalyzed: number;
}

interface AIAnalysisResponse {
  recommendations: ParentRecommendation[];
  analysis: {
    childWorkItem: {
      id: number;
      title: string;
      type: string;
      appropriateParentTypes: string[];
    };
    candidatesAnalyzed: number;
    recommendationsReturned: number;
    rejectedDueToTypeIncompatibility: number;
    rejectedDueToPoorFit: number;
    searchScope: string;
    confidenceThreshold: number;
  };
  noGoodMatchReason: string | null;
}

/**
 * Map child work item types to their valid parent types (Azure DevOps hierarchy)
 */
const VALID_PARENT_TYPES_MAP: Record<string, string[]> = {
  'Epic': ['Key Result'],
  'Feature': ['Epic'],
  'Product Backlog Item': ['Feature'],
  'User Story': ['Feature'],
  'Task': ['Product Backlog Item', 'User Story'],
  'Bug': ['Product Backlog Item', 'User Story']
};

/**
 * Get appropriate parent types for a child work item type
 */
function getAppropriateParentTypes(childType: string): string[] {
  return VALID_PARENT_TYPES_MAP[childType] || [];
}

/**
 * Build WIQL query to find potential parent candidates
 * **ENFORCES SAME AREA PATH** when includeSubAreas is false
 */
function buildParentCandidateQuery(
  parentTypes: string[],
  childAreaPath: string,
  args: IntelligentParentFinderArgs
): string {
  const {
    searchScope = 'area',
    includeSubAreas = false,  // Default to FALSE for same area path requirement
    requireActiveParents = true,
    iterationPath
  } = args;

  const clauses: string[] = [];

  // Type filter - only valid parent types
  if (parentTypes.length > 0) {
    const typeList = parentTypes.map(t => `'${t}'`).join(', ');
    clauses.push(`[System.WorkItemType] IN (${typeList})`);
  }

  // **CRITICAL**: Area path filter - EXACT match by default for same area path requirement
  const escapedArea = escapeAreaPath(childAreaPath);
  if (searchScope === 'area') {
    const areaClause = includeSubAreas 
      ? `[System.AreaPath] UNDER '${escapedArea}'`  // Allow sub-areas if explicitly requested
      : `[System.AreaPath] = '${escapedArea}'`;      // EXACT match - same area only
    clauses.push(areaClause);
  } else if (searchScope === 'iteration' && iterationPath) {
    const escapedIteration = escapeAreaPath(iterationPath);
    clauses.push(`[System.IterationPath] UNDER '${escapedIteration}'`);
    // Still enforce area path match
    clauses.push(`[System.AreaPath] = '${escapedArea}'`);
  }
  // For 'project' scope, still enforce area path match
  else if (searchScope === 'project') {
    clauses.push(`[System.AreaPath] = '${escapedArea}'`);
  }

  // State filter
  if (requireActiveParents) {
    clauses.push(`[System.State] IN ('New', 'Active', 'Committed', 'In Progress', 'Proposed')`);
  } else {
    clauses.push(`[System.State] NOT IN ('Removed', 'Closed')`);
  }

  const whereClause = clauses.join(' AND ');
  
  return `SELECT [System.Id] FROM WorkItems WHERE ${whereClause} ORDER BY [System.ChangedDate] DESC`;
}

/**
 * Validate that a recommended parent matches the child's area path
 * Supports both exact match and hierarchical (UNDER) matching based on includeSubAreas flag
 */
function validateAreaPathMatch(childAreaPath: string, parentAreaPath: string, includeSubAreas: boolean = false): boolean {
  if (!childAreaPath || !parentAreaPath) {
    return false;
  }
  
  // Exact match
  if (childAreaPath === parentAreaPath) {
    return true;
  }
  
  // If includeSubAreas is enabled, check if parent is an ancestor of child
  // (parent path is a prefix of child path)
  if (includeSubAreas) {
    // Normalize paths (trim whitespace, handle backslashes)
    const normalizedChild = childAreaPath.trim();
    const normalizedParent = parentAreaPath.trim();
    
    // Check if child is under parent (parent is a prefix)
    if (normalizedChild.startsWith(normalizedParent + '\\')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate that a parent type is valid for the child type
 */
function validateParentChildTypeCompatibility(childType: string, parentType: string): boolean {
  const validParentTypes = getAppropriateParentTypes(childType);
  return validParentTypes.includes(parentType);
}

export async function handleIntelligentParentFinder(
  config: ToolConfig,
  args: unknown,
  samplingService?: SamplingService
): Promise<ToolExecutionResult> {
  let organization: string = '';
  let project: string = '';

  try {
    // Check sampling availability
    if (!samplingService) {
      return buildErrorResponse(
        new Error('This tool requires VS Code sampling support which is not currently available. Ensure you are using VS Code with Copilot enabled.'),
        { source: 'intelligent-parent-finder', requiresSampling: true }
      );
    }

    const azValidation = validateAzureCLI();
    if (!azValidation.isAvailable || !azValidation.isLoggedIn) {
      return buildAzureCliErrorResponse(azValidation);
    }

    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, 'intelligent-parent-finder');
    }

    const requiredConfig = getRequiredConfig();
    const validationArgs: IntelligentParentFinderArgs = {
      ...parsed.data,
      organization: parsed.data.organization || requiredConfig.organization,
      project: parsed.data.project || requiredConfig.project
    };

    const {
      childQueryHandle,
      dryRun = false,
      maxParentCandidates = 20,
      maxRecommendations = 3,
      parentWorkItemTypes,
      confidenceThreshold = 0.5
    } = validationArgs;

    organization = validationArgs.organization!;
    project = validationArgs.project!;

    logger.info(`Finding intelligent parents for items in query handle "${childQueryHandle}" (dryRun=${dryRun})`);

    // 1. Retrieve child work items from query handle
    const childItems = queryHandleService.getWorkItemIds(childQueryHandle);
    if (!childItems || childItems.length === 0) {
      return buildErrorResponse(
        new Error(`Query handle "${childQueryHandle}" is invalid, expired, or contains no work items`),
        { source: 'intelligent-parent-finder', queryHandle: childQueryHandle }
      );
    }

    logger.info(`Processing ${childItems.length} child work item(s) from query handle`);

    // 2. Initialize AI sampling client
    const samplingClient = new SamplingClient(samplingService.getServer());
    
    if (!samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    // 3. Process each child work item
    const httpClient = new ADOHttpClient(organization, getTokenProvider(), project);
    const allResults: ChildAnalysisResult[] = [];
    const allRecommendedParentIds: number[] = [];

    for (const childWorkItemId of childItems) {
      try {
        logger.info(`Analyzing child work item ${childWorkItemId}...`);

        // 3a. Fetch child work item details
        const response = await httpClient.get<ADOWorkItem>(
          `wit/workitems/${childWorkItemId}?$expand=all`
        );
        const childWorkItem = response.data;

        const childType = childWorkItem.fields['System.WorkItemType'] as string;
        const childTitle = childWorkItem.fields['System.Title'] as string;
        const childDescription = childWorkItem.fields['System.Description'] as string || '';
        const childState = childWorkItem.fields['System.State'] as string;
        const childTags = childWorkItem.fields['System.Tags'] as string || '';
        const childAreaPath = childWorkItem.fields['System.AreaPath'] as string;
        const childIterationPath = childWorkItem.fields['System.IterationPath'] as string;

        // 3b. Determine appropriate parent types
        const appropriateParentTypes = parentWorkItemTypes && parentWorkItemTypes.length > 0
          ? parentWorkItemTypes.filter(type => getAppropriateParentTypes(childType).includes(type))
          : getAppropriateParentTypes(childType);

        if (appropriateParentTypes.length === 0) {
          allResults.push({
            childWorkItemId,
            childTitle,
            childType,
            childAreaPath,
            recommendations: [],
            warnings: [`Work item type '${childType}' cannot have a parent (leaf node in hierarchy)`],
            candidatesAnalyzed: 0
          });
          continue;
        }

        // 3c. Query for parent candidates **IN SAME AREA PATH**
        const candidateQuery = buildParentCandidateQuery(
          appropriateParentTypes,
          childAreaPath,
          validationArgs
        );
        
        logger.info(`🔍 Parent candidate query for child ${childWorkItemId} (${childType} in '${childAreaPath}'):`);
        logger.info(`   Query: ${candidateQuery}`);
        logger.info(`   Looking for types: ${appropriateParentTypes.join(', ')}`);

        const candidatesResult = await queryWorkItemsByWiql({
          wiqlQuery: candidateQuery,
          organization,
          project,
          includeFields: [
            'System.Title',
            'System.Description',
            'System.WorkItemType',
            'System.State',
            'System.Tags',
            'System.AreaPath',
            'System.IterationPath',
            'System.Parent',
            'System.RelatedLinkCount'
          ],
          maxResults: maxParentCandidates
        });

        logger.info(`📊 Query returned ${candidatesResult.workItems.length} candidates (total in WIQL: ${candidatesResult.totalCount})`);

        if (candidatesResult.workItems.length === 0) {
          allResults.push({
            childWorkItemId,
            childTitle,
            childType,
            childAreaPath,
            recommendations: [],
            warnings: [
              `No parent candidates of type ${appropriateParentTypes.join(', ')} found in area path '${childAreaPath}'`
            ],
            candidatesAnalyzed: 0
          });
          continue;
        }

        logger.info(`✅ Found ${candidatesResult.workItems.length} parent candidates for child ${childWorkItemId}`);

        // 3d. Pre-filter candidates to ensure same area path (double-check WIQL results)
        const validCandidates = candidatesResult.workItems.filter(wi => {
          const candidateAreaPath = wi.additionalFields?.['System.AreaPath'] as string || '';
          const isMatch = validateAreaPathMatch(childAreaPath, candidateAreaPath, validationArgs.includeSubAreas);
          if (!isMatch) {
            logger.warn(`⚠️  Filtering out candidate ${wi.id} (${wi.title}): area path mismatch`);
            logger.warn(`    Child area: '${childAreaPath}'`);
            logger.warn(`    Candidate area: '${candidateAreaPath}'`);
          }
          return isMatch;
        });

        logger.info(`🔍 After area path validation: ${validCandidates.length}/${candidatesResult.workItems.length} candidates remain`);

        if (validCandidates.length === 0) {
          allResults.push({
            childWorkItemId,
            childTitle,
            childType,
            childAreaPath,
            recommendations: [],
            warnings: [
              `No matching parent candidates found in area path '${childAreaPath}'`
            ],
            candidatesAnalyzed: candidatesResult.workItems.length
          });
          continue;
        }

        // 3e. Prepare data for AI analysis
        const childWorkItemData = {
          id: childWorkItemId,
          title: childTitle,
          description: childDescription.substring(0, 1000), // Limit description length
          type: childType,
          state: childState,
          tags: childTags,
          areaPath: childAreaPath,
          iterationPath: childIterationPath
        };

        const parentCandidatesData = validCandidates.map(wi => ({
          id: wi.id,
          title: wi.title,
          description: (wi.additionalFields?.['System.Description'] as string || '').substring(0, 500),
          type: wi.type,
          state: wi.state,
          tags: wi.additionalFields?.['System.Tags'] as string || '',
          areaPath: wi.additionalFields?.['System.AreaPath'] as string || '',
          iterationPath: wi.additionalFields?.['System.IterationPath'] as string || '',
          hasParent: !!wi.additionalFields?.['System.Parent'],
          relatedLinkCount: wi.additionalFields?.['System.RelatedLinkCount'] as number || 0
        }));

        // 3f. Call AI sampling service for analysis
        const userContent = formatForAI({
          childWorkItem: childWorkItemData,
          parentCandidates: parentCandidatesData,
          analysisParameters: {
            maxRecommendations,
            confidenceThreshold,
            appropriateParentTypes,
            enforceSameAreaPath: true // Make it explicit to AI
          }
        });

        logger.debug(`Calling AI for parent analysis of child ${childWorkItemId}`);

        const aiResponse = await samplingClient.createMessage({
          systemPromptName: 'intelligent-parent-finder',
          userContent,
          maxTokens: 4000,
          temperature: 0.3 // Lower temperature for consistent/factual analysis
        });

        const responseText = samplingClient.extractResponseText(aiResponse);
        logger.debug(`AI response for ${childWorkItemId}: ${responseText.substring(0, 200)}...`);

        // 3g. Parse and validate AI response
        let analysisResult: AIAnalysisResponse;
        try {
          analysisResult = JSON.parse(responseText);
        } catch (error) {
          allResults.push({
            childWorkItemId,
            childTitle,
            childType,
            childAreaPath,
            recommendations: [],
            warnings: [`Failed to parse AI analysis: ${error instanceof Error ? error.message : String(error)}`],
            candidatesAnalyzed: validCandidates.length
          });
          continue;
        }

        // 3h. Post-validate AI recommendations (safety check)
        const validatedRecommendations = analysisResult.recommendations.filter(rec => {
          // Ensure parent type is valid for child type
          if (!validateParentChildTypeCompatibility(childType, rec.parentType)) {
            logger.warn(`AI recommended invalid parent type ${rec.parentType} for child type ${childType} - rejecting`);
            return false;
          }

          // Ensure area paths match
          if (!validateAreaPathMatch(childAreaPath, rec.parentAreaPath || '', validationArgs.includeSubAreas)) {
            logger.warn(`AI recommended parent ${rec.parentWorkItemId} in different area path - rejecting`);
            return false;
          }

          return true;
        });

        // 3i. Collect validated recommendations
        const resultWarnings: string[] = [];
        if (validatedRecommendations.length < analysisResult.recommendations.length) {
          resultWarnings.push(
            `${analysisResult.recommendations.length - validatedRecommendations.length} AI recommendations rejected due to safety validation`
          );
        }

        if (validatedRecommendations.length === 0 && analysisResult.noGoodMatchReason) {
          resultWarnings.push(analysisResult.noGoodMatchReason);
        }

        allResults.push({
          childWorkItemId,
          childTitle,
          childType,
          childAreaPath,
          recommendations: validatedRecommendations,
          warnings: resultWarnings,
          candidatesAnalyzed: validCandidates.length
        });

        // Collect parent IDs for query handle creation
        validatedRecommendations.forEach(rec => {
          if (!allRecommendedParentIds.includes(rec.parentWorkItemId)) {
            allRecommendedParentIds.push(rec.parentWorkItemId);
          }
        });

      } catch (error) {
        logger.error(`Error processing child ${childWorkItemId}:`, error);
        allResults.push({
          childWorkItemId,
          childTitle: 'Unknown',
          childType: 'Unknown',
          childAreaPath: 'Unknown',
          recommendations: [],
          warnings: [`Error: ${error instanceof Error ? error.message : String(error)}`],
          candidatesAnalyzed: 0
        });
      }
    }

    // 4. Create query handle for recommended parents (unless dry run)
    let parentQueryHandle: string | undefined;
    if (!dryRun && allRecommendedParentIds.length > 0) {
      parentQueryHandle = queryHandleService.storeQuery(
        allRecommendedParentIds,
        `Intelligent parent recommendations for ${childItems.length} child item(s) (handle: ${childQueryHandle})`,
        { 
          project,
          queryType: 'intelligent-parent-recommendations'
        }
      );
      logger.info(`Created parent query handle: ${parentQueryHandle} (${allRecommendedParentIds.length} parents)`);
    }

    // 5. Build response
    const totalRecommendations = allResults.reduce((sum, r) => sum + r.recommendations.length, 0);
    const totalCandidatesAnalyzed = allResults.reduce((sum, r) => sum + r.candidatesAnalyzed, 0);

    return buildSuccessResponse(
      {
        mode: dryRun ? 'dry-run' : 'live',
        childQueryHandle,
        parentQueryHandle,
        childrenAnalyzed: allResults.length,
        totalRecommendations,
        totalCandidatesAnalyzed,
        results: allResults.map(r => ({
          childWorkItemId: r.childWorkItemId,
          childTitle: r.childTitle,
          childType: r.childType,
          childAreaPath: r.childAreaPath,
          recommendations: r.recommendations.map(rec => ({
            parentWorkItemId: rec.parentWorkItemId,
            parentTitle: rec.parentTitle,
            parentType: rec.parentType,
            parentState: rec.parentState,
            parentAreaPath: rec.parentAreaPath,
            confidence: Math.round(rec.confidence * 100) / 100,
            reasoning: rec.reasoning,
            benefits: rec.benefits,
            potentialConcerns: rec.potentialConcerns
          })),
          warnings: r.warnings,
          candidatesAnalyzed: r.candidatesAnalyzed
        })),
        safetyValidation: {
          areaPathEnforced: true,
          validParentTypesOnly: true,
          'hallucinationPrevention': 'Query handles used throughout'
        },
        nextSteps: (() => {
          // Check if we have any recommendations at all
          if (totalRecommendations === 0) {
            // Determine if we had candidates but none were good enough, or no candidates at all
            const hadNoCandidates = allResults.every(r => 
              r.warnings.some(w => w.includes('No matching parent candidates found'))
            );
            
            if (hadNoCandidates) {
              return [
                'No parent candidates found in the specified area paths',
                'Consider widening search with includeSubAreas=true',
                'Or create new parent work items (Feature/Epic) in the same area path'
              ];
            } else {
              return [
                'No recommendations met confidence threshold',
                'Consider adjusting confidenceThreshold parameter (currently requires high confidence)',
                'Or create new parent work items that better match the child work items'
              ];
            }
          }
          
          // We have recommendations - provide appropriate next steps
          if (dryRun) {
            return [
              'Review recommendations and confidence scores',
              'Run again without dryRun=true to create parent query handle',
              'Use wit-link-work-items-by-query-handles to create parent-child links'
            ];
          } else if (parentQueryHandle) {
            return [
              'Review recommendations and confidence scores',
              `Use parent query handle "${parentQueryHandle}" with wit-link-work-items-by-query-handles`,
              `Link children (handle: ${childQueryHandle}) to recommended parents (handle: ${parentQueryHandle})`
            ];
          } else {
            return [
              'Parent query handle not created (unexpected state)',
              'Please review the results and try again'
            ];
          }
        })()
      },
      {
        source: 'intelligent-parent-finder',
        aiPowered: true,
        dryRun,
        childrenProcessed: allResults.length,
        recommendationsGenerated: totalRecommendations
      }
    );

  } catch (error) {
    logger.error('Intelligent parent finder error:', error);
    
    return buildErrorResponse(
      error as Error,
      { source: 'intelligent-parent-finder', organization, project }
    );
  }
}
