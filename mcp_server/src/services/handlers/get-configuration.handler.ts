/**
 * Handler for wit-get-configuration tool
 */

import type { ToolExecutionResult } from "../../types/index.js";
import { loadConfiguration } from "../../config/config.js";

export async function handleGetConfiguration(args: any): Promise<ToolExecutionResult> {
  try {
    const cfg = loadConfiguration();
    const section = args?.Section || "all";
    const includeSensitive = args?.IncludeSensitive || false;
    
    let configData: any = {};
    
    if (section === "all" || section === "azureDevOps") {
      configData.azureDevOps = cfg.azureDevOps;
    }
    if (section === "all" || section === "gitRepository") {
      configData.gitRepository = cfg.gitRepository;
    }
    if (section === "all" || section === "gitHubCopilot") {
      configData.gitHubCopilot = includeSensitive ? cfg.gitHubCopilot : { 
        defaultGuid: cfg.gitHubCopilot.defaultGuid ? "***" : ""
      };
    }
    
    return {
      success: true,
      data: {
        configuration: configData,
        helpText: {
          areaPath: cfg.azureDevOps.areaPath
            ? `Default area path is configured as: ${cfg.azureDevOps.areaPath}.` 
            : "No default area path configured.",
          iterationPath: cfg.azureDevOps.iterationPath
            ? `Default iteration path is configured as: ${cfg.azureDevOps.iterationPath}.` 
            : "No default iteration path configured.",
          gitHubCopilot: cfg.gitHubCopilot.defaultGuid 
            ? "GitHub Copilot GUID is configured for automatic assignment." 
            : "No GitHub Copilot GUID configured. Provide --copilot-guid parameter."
        }
      },
      metadata: { source: "internal", section },
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      metadata: { source: "internal" },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
