/**
 * Handler for wit-extract-security-links tool
 * Extracts instruction links from security scan work items
 */

import type { ToolConfig, ToolExecutionResult } from "../../types/index.js";
import { extractSecurityInstructionLinks } from "../ado-work-item-service.js";
import { getRequiredConfig } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

export async function handleExtractSecurityLinks(config: ToolConfig, args: any): Promise<ToolExecutionResult> {
  try {
    // Parse and validate input
    const parsed = config.schema.safeParse(args || {});
    if (!parsed.success) {
      return {
        success: false,
        data: null,
        errors: [parsed.error.message],
        warnings: [],
        raw: { stdout: '', stderr: parsed.error.message, exitCode: 1 },
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    const input = parsed.data as any;
    
    // Get configuration with auto-fill
    const requiredConfig = getRequiredConfig();
    
    const extractArgs = {
      WorkItemId: input.WorkItemId,
      Organization: input.Organization || requiredConfig.organization,
      Project: input.Project || requiredConfig.project,
      ScanType: input.ScanType || 'All',
      IncludeWorkItemDetails: input.IncludeWorkItemDetails || false
    };

    logger.debug(`Extracting security links from work item ${extractArgs.WorkItemId}`);
    
    const result = await extractSecurityInstructionLinks(extractArgs);
    
    return {
      success: true,
      data: result,
      errors: [],
      warnings: [],
      raw: { stdout: JSON.stringify(result), stderr: '', exitCode: 0 },
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
      raw: { stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 },
      metadata: { timestamp: new Date().toISOString() }
    };
  }
}
