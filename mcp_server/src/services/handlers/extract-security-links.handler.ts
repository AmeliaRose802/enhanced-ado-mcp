/**
 * Handler for wit-extract-security-links tool
 * Extracts instruction links from security scan work items
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { extractSecurityInstructionLinks } from "../ado-work-item-service.js";
import { getRequiredConfig } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

export async function handleExtractSecurityLinks(config: ToolConfig, args: unknown): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        errors: [parsed.error.message],
        warnings: [],
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    const input = parsed.data as any;
    
    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();
    
    const extractArgs = {
      workItemId: input.workItemId,
      organization: input.organization || requiredConfig.organization,
      project: input.project || requiredConfig.project,
      scanType: input.scanType || 'All',
      includeWorkItemDetails: input.includeWorkItemDetails || false
    };

    logger.debug(`Extracting security links from work item ${extractArgs.workItemId}`);
    
    const result = await extractSecurityInstructionLinks(extractArgs);
    
    return {
      success: true,
      data: result,
      errors: [],
      warnings: [],
      metadata: {
        timestamp: new Date().toISOString(),
        tool: 'wit-extract-security-links'
      }
    };
  } catch (error) {
    logger.error('Failed to extract security links', error);
    return {
      success: false,
      data: null,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      metadata: { timestamp: new Date().toISOString() }
    };
  }
}
