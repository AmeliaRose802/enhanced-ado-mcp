/**
 * Handler for get-config tool
 */

import { ToolExecutionResult, asToolData } from "@/types/index.js";
import { loadConfiguration } from "@/config/config.js";

export async function handleGetConfiguration(args: unknown): Promise<ToolExecutionResult> {
  try {
    const cfg = loadConfiguration();
    
    // Type guard for args
    const parsedArgs = args as { Section?: string; IncludeSensitive?: boolean } | undefined;
    const section = parsedArgs?.Section || "all";
    const includeSensitive = parsedArgs?.IncludeSensitive || false;
    
    let configData: Record<string, unknown> = {};
    
    if (section === "all" || section === "azureDevOps") {
      configData.azureDevOps = cfg.azureDevOps;
    }
    if (section === "all" || section === "gitRepository") {
      configData.gitRepository = cfg.gitRepository;
    }
    if (section === "all" || section === "gitHubCopilot") {
      configData.gitHubCopilot = { 
        defaultGuid: cfg.gitHubCopilot.defaultGuid || null
      };
    }
    
    // Format area paths help text
    const areaPaths = cfg.azureDevOps.areaPaths || (cfg.azureDevOps.areaPath ? [cfg.azureDevOps.areaPath] : []);
    const areaPathHelp = areaPaths.length > 0
      ? areaPaths.length === 1
        ? `Default area path is configured as: ${areaPaths[0]}.`
        : `${areaPaths.length} area paths configured: ${areaPaths.join(', ')}.`
      : "No default area path configured.";
    
    return {
      success: true,
      data: asToolData({
        configuration: configData,
        helpText: {
          areaPath: areaPathHelp,
          iterationPath: cfg.azureDevOps.iterationPath
            ? `Default iteration path is configured as: ${cfg.azureDevOps.iterationPath}.` 
            : "No default iteration path configured.",
          gitHubCopilot: cfg.gitHubCopilot.defaultGuid 
            ? "GitHub Copilot GUID is configured for automatic assignment." 
            : "No GitHub Copilot GUID configured. Provide --copilot-guid parameter."
        }
      }),
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
