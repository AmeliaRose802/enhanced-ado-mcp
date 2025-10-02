import type { ToolExecutionResult } from '../../types/index.js';
import type { AIAssignmentAnalyzerArgs, AIAssignmentResult } from '../sampling-types.js';
import { logger } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { buildSuccessResponse, buildErrorResponse, buildSamplingUnavailableResponse } from '../../utils/response-builder.js';
import { extractJSON, formatForAI } from '../../utils/ai-helpers.js';
import { loadConfiguration } from '../../config/config.js';
import { execSync } from 'child_process';
import { AZURE_DEVOPS_RESOURCE_ID } from '../../config/config.js';

/**
 * Get Azure DevOps PAT token from Azure CLI
 */
function getAzureDevOpsToken(): string {
  try {
    const result = execSync(
      `az account get-access-token --resource ${AZURE_DEVOPS_RESOURCE_ID} --query accessToken -o tsv`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (error) {
    logger.error('Failed to get Azure DevOps token from Azure CLI', error);
    throw new Error('Failed to authenticate with Azure DevOps. Please ensure you are logged in with: az login');
  }
}

/**
 * Get work item details from Azure DevOps
 */
async function getWorkItem(
  organization: string,
  project: string,
  workItemId: number,
  token: string
): Promise<any> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  
  const curlCommand = `curl -s -H "Authorization: Bearer ${token}" "${url}"`;
  const response = execSync(curlCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return JSON.parse(response);
}

export class AIAssignmentAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: any) {
    this.samplingClient = new SamplingClient(server);
  }

  async analyze(args: AIAssignmentAnalyzerArgs): Promise<ToolExecutionResult> {
    if (!this.samplingClient.hasSamplingSupport()) {
      return buildSamplingUnavailableResponse();
    }

    try {
      // First, fetch the work item details from Azure DevOps
      const config = loadConfiguration();
      const org = args.organization || config.azureDevOps.organization;
      const project = args.project || config.azureDevOps.project;
      const token = getAzureDevOpsToken();
      
      logger.debug(`Fetching work item ${args.workItemId} for AI assignment analysis`);
      
      const workItem = await getWorkItem(org, project, args.workItemId, token);
      
      if (!workItem || !workItem.fields) {
        return buildErrorResponse(`Work item ${args.workItemId} not found`, { source: 'work-item-not-found' });
      }

      // Check if work item is in a completed state
      const completedStates = ['Done', 'Completed', 'Closed', 'Resolved', 'Removed'];
      if (completedStates.includes(workItem.fields['System.State'])) {
        return buildErrorResponse(
          `Work item ${args.workItemId} is in state '${workItem.fields['System.State']}'. ` +
          `Cannot analyze completed work items. Only active work items should be analyzed for AI assignment.`,
          { source: 'work-item-completed' }
        );
      }

      // Extract relevant fields for analysis
      const analysisInput = {
        work_item_id: args.workItemId,
        work_item_title: workItem.fields['System.Title'] || '',
        work_item_description: workItem.fields['System.Description'] || '',
        work_item_type: workItem.fields['System.WorkItemType'] || '',
        acceptance_criteria: workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
        priority: workItem.fields['Microsoft.VSTS.Common.Priority']?.toString() || '',
        state: workItem.fields['System.State'] || '',
        assigned_to: workItem.fields['System.AssignedTo']?.displayName || '',
        tags: workItem.fields['System.Tags'] || '',
        area_path: workItem.fields['System.AreaPath'] || '',
        iteration_path: workItem.fields['System.IterationPath'] || '',
        output_format: args.outputFormat || 'detailed'
      };

      const result = await this.performAnalysis(analysisInput);
      return buildSuccessResponse(result, { source: 'ai-assignment-analysis' });
    } catch (error) {
      return buildErrorResponse(`AI assignment analysis failed: ${error}`, { source: 'ai-assignment-failed' });
    }
  }

  private async performAnalysis(analysisInput: any): Promise<AIAssignmentResult> {
    // Add timeout wrapper to prevent hanging
    const timeoutMs = 30000; // 30 seconds (AI assignment should be fast)
    const aiResultPromise = this.samplingClient.createMessage({
      systemPromptName: 'ai-assignment-analyzer',
      userContent: formatForAI(analysisInput),
      maxTokens: 400,
      temperature: 0.2
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          'AI assignment analysis exceeded 30 second timeout. ' +
          'The AI model may be overloaded. Try again in a moment.'
        ));
      }, timeoutMs);
    });

    const aiResult = await Promise.race([aiResultPromise, timeoutPromise]);
    return this.parseResponse(aiResult);
  }

  private parseResponse(aiResult: any): AIAssignmentResult {
    const text = this.samplingClient.extractResponseText(aiResult);
    const json = extractJSON(text);
    
    if (!json) {
      throw new Error('Failed to parse AI response as JSON');
    }
    
    return this.buildResultFromJSON(json);
  }

  private buildResultFromJSON(json: any): AIAssignmentResult {
    if (!json.decision) {
      throw new Error('AI response missing required field: decision');
    }

    return {
      decision: json.decision,
      confidence: json.confidence ?? 0.5,
      riskScore: json.riskScore ?? 50,
      primaryReasons: json.reasons ?? json.primaryReasons ?? [],
      missingInfo: json.missingInfo ?? [],
      recommendedNextSteps: json.nextSteps ?? json.recommendedNextSteps ?? [],
      estimatedScope: {
        files: {
          min: json.scope?.filesMin ?? json.estimatedScope?.files?.min ?? 1,
          max: json.scope?.filesMax ?? json.estimatedScope?.files?.max ?? 5
        },
        complexity: json.scope?.complexity ?? json.estimatedScope?.complexity ?? "medium"
      },
      guardrails: {
        testsRequired: json.guardrails?.testsRequired ?? false,
        featureFlagOrToggle: json.guardrails?.featureFlag ?? json.guardrails?.featureFlagOrToggle ?? false,
        touchSensitiveAreas: json.guardrails?.touchesSensitive ?? json.guardrails?.touchSensitiveAreas ?? false,
        needsCodeReviewFromOwner: json.guardrails?.needsReview ?? json.guardrails?.needsCodeReviewFromOwner ?? false
      }
    };
  }
}
