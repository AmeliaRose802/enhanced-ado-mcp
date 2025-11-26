import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
import type { Prompt, ParsedPrompt, PromptArgument } from "../types/index.js";
import { getPromptsDir } from "../utils/paths.js";
import { logger, errorToContext } from "../utils/logger.js";
import { applyTemplateVariables } from "../utils/prompt-loader.js";
import { escapeAreaPath, escapeAreaPathForOData } from "../utils/work-item-parser.js";

import type { MCPServerConfig } from "../config/config.js";

/**
 * Create template variables object from config
 */
function createTemplateVariables(config: MCPServerConfig, args: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const now = new Date();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const semester = `Q${quarter}`;
  
  // Calculate date ranges based on analysis_period_days OR lookback_days parameter
  // Different prompts use different names for the same concept
  const analysisPeriodDays = typeof args.analysis_period_days === 'number' 
    ? args.analysis_period_days 
    : typeof args.lookback_days === 'number'
    ? args.lookback_days
    : 90;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - analysisPeriodDays);
  
  // Staleness threshold for backlog cleanup (separate from analysis period)
  const stalenessThresholdDays = typeof args.stalenessThresholdDays === 'number'
    ? args.stalenessThresholdDays
    : 180;
  
  // Format dates as YYYY-MM-DD for WIQL queries and display
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };
  
  // Format dates as full ISO 8601 timestamp for OData queries (YYYY-MM-DDTHH:mm:ssZ)
  // OData requires full timestamp format for date comparisons
  const formatDateISO = (date: Date): string => {
    return date.toISOString();
  };
  
  // Get the primary area path (prefer singular areaPath, fallback to first in areaPaths array)
  const primaryAreaPath = config.azureDevOps.areaPath || 
    (config.azureDevOps.areaPaths && config.azureDevOps.areaPaths.length > 0 
      ? config.azureDevOps.areaPaths[0] 
      : '');
  
  // Extract area substring for OData contains() filtering
  // OData doesn't support eq/startswith/under operators, so we use contains() with a unique substring
  const extractAreaSubstring = (areaPath: string): string => {
    if (!areaPath) return '';
    // Get the last two segments of the area path for uniqueness
    // e.g., "One\\Azure Compute\\OneFleet Node\\Azure Host Agent" -> "OneFleet Node\\\\Azure Host Agent"
    const segments = areaPath.split('\\').filter(s => s.length > 0);
    if (segments.length >= 2) {
      // Use last 2 segments, double-escape backslashes for OData
      return segments.slice(-2).join('\\\\');
    }
    // If only one segment, use it as-is with double backslash escape
    return segments.join('\\\\');
  };
  
  // Extract simple area substring for OData contains() filtering without backslashes
  // Needed for specific OData queries that require unescaped area path segments
  const extractAreaSimpleSubstring = (areaPath: string): string => {
    if (!areaPath) return '';
    // Get the last meaningful segment without backslashes
    // e.g., "One\\Azure Compute\\OneFleet Node\\Azure Host" -> "Azure Host"
    const segments = areaPath.split('\\').filter(s => s.length > 0);
    if (segments.length >= 1) {
      // Return the last segment without any escaping
      return segments[segments.length - 1];
    }
    return '';
  };
  
  return {
    // Core config variables (escape area paths for use in WIQL/OData queries)
    // area_path is WIQL-escaped (for UNDER operator) - only single quotes doubled
    area_path: escapeAreaPath(primaryAreaPath),
    // area_path_odata is OData-escaped (for startswith function) - backslashes AND quotes doubled
    area_path_odata: escapeAreaPathForOData(primaryAreaPath),
    area_substring: extractAreaSubstring(primaryAreaPath),
    area_path_simple_substring: extractAreaSimpleSubstring(primaryAreaPath),
    project: config.azureDevOps.project || '',
    project_name: config.azureDevOps.project || '',
    org_url: `https://dev.azure.com/${config.azureDevOps.organization}`,
    organization: config.azureDevOps.organization || '',
    iteration_path: escapeAreaPath(config.azureDevOps.iterationPath || ''),
    assigned_to: config.azureDevOps.defaultAssignedTo || '',
    work_item_type: config.azureDevOps.defaultWorkItemType || '',
    priority: config.azureDevOps.defaultPriority?.toString() || '',
    branch: config.gitRepository.defaultBranch || '',
    
    // Config defaults with prefix
    default_organization: config.azureDevOps.organization,
    default_project: config.azureDevOps.project,
    default_area_path: escapeAreaPath(primaryAreaPath),
    default_iteration_path: escapeAreaPath(config.azureDevOps.iterationPath || ''),
    default_work_item_type: config.azureDevOps.defaultWorkItemType,
    default_priority: config.azureDevOps.defaultPriority?.toString(),
    default_assigned_to: config.azureDevOps.defaultAssignedTo,
    default_branch: config.gitRepository.defaultBranch,
    
    // Date range variables (auto-calculated)
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    start_date_iso: formatDateISO(startDate),
    end_date_iso: formatDateISO(endDate),
    today: formatDate(now),
    analysis_period_days: analysisPeriodDays,
    lookback_days: analysisPeriodDays,  // Alias for sprint_review prompt compatibility
    stalenessThresholdDays: stalenessThresholdDays,  // For backlog_cleanup prompt
    
    // Computed values
    semester: semester,
    max_age_days: 180,
    include_child_areas: true,
    max_items: 50,
    dry_run: true,
    
    // URL templates for work item links
    work_item_url_template: `https://dev.azure.com/${config.azureDevOps.organization}/${config.azureDevOps.project}/_workitems/edit/{id}`
  };
}

/**
 * Frontmatter structure parsed from prompt files
 */
interface PromptFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  arguments?: Record<string, PromptArgument>;
}

/**
 * Parse a prompt file with YAML frontmatter
 */
export async function parsePromptFile(filePath: string): Promise<ParsedPrompt | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Check if it starts with YAML frontmatter
    if (!lines[0].trim().startsWith('---')) {
      return null;
    }
    
    // Find the end of frontmatter
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEnd = i;
        break;
      }
    }
    
    if (frontmatterEnd === -1) {
      return null;
    }
    
    // Parse frontmatter
    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const frontmatter: PromptFrontmatter = {};
    let inArguments = false;
    const argumentsObject: Record<string, PromptArgument> = {};
    let currentMultiLineKey: string | null = null;
    let multiLineValue: string[] = [];
    
    for (let i = 0; i < frontmatterLines.length; i++) {
      const line = frontmatterLines[i];
      const trimmed = line.trim();
      
      // Handle multi-line values (YAML folded/literal style)
      if (currentMultiLineKey) {
        // Check if this line is indented (continuation of multi-line value)
        if (line.startsWith('  ') && !line.match(/^\w+:/)) {
          multiLineValue.push(trimmed);
          continue;
        } else {
          // Multi-line value ended, store it
          const fullValue = multiLineValue.join(' ').trim();
          if (currentMultiLineKey === 'description') {
            frontmatter.description = fullValue;
          }
          currentMultiLineKey = null;
          multiLineValue = [];
          // Fall through to process current line
        }
      }
      
      if (!trimmed) continue;
      
      if (trimmed === 'arguments:') {
        inArguments = true;
        continue;
      }
      
      if (inArguments) {
        // Parse argument line like: "  item_title: { type: string, required: true, description: "..." }"
        const argMatch = trimmed.match(/^(\w+):\s*\{\s*(.+)\s*\}$/);
        if (argMatch) {
          const [, argName, argProps] = argMatch;
          const props: PromptArgument = { type: 'string', required: false };
          
          // Parse properties with proper quoted string handling
          let currentPos = 0;
          const propPairs: string[] = [];
          
          while (currentPos < argProps.length) {
            // Find the next key: value pair
            const nextComma = argProps.indexOf(',', currentPos);
            const nextColon = argProps.indexOf(':', currentPos);
            
            if (nextColon === -1) break;
            
            // Check if this is a description field with quotes
            if (argProps.substring(currentPos, nextColon).trim() === 'description') {
              // Find the quoted string
              const afterColon = argProps.substring(nextColon + 1).trim();
              if (afterColon.startsWith('"')) {
                // Find the closing quote
                let endQuote = afterColon.indexOf('"', 1);
                while (endQuote !== -1 && afterColon[endQuote - 1] === '\\') {
                  endQuote = afterColon.indexOf('"', endQuote + 1);
                }
                if (endQuote !== -1) {
                  const descValue = afterColon.substring(0, endQuote + 1);
                  propPairs.push(`description: ${descValue}`);
                  currentPos = nextColon + 1 + endQuote + 1;
                  if (argProps[currentPos] === ',') currentPos++;
                  continue;
                }
              }
            }
            
            // Regular property parsing
            if (nextComma === -1) {
              propPairs.push(argProps.substring(currentPos).trim());
              break;
            } else {
              propPairs.push(argProps.substring(currentPos, nextComma).trim());
              currentPos = nextComma + 1;
            }
          }
          
          // Process the parsed pairs  
          for (const pair of propPairs) {
            const colonIndex = pair.indexOf(':');
            if (colonIndex === -1) continue;
            
            const key = pair.substring(0, colonIndex).trim();
            const value = pair.substring(colonIndex + 1).trim();
            
            if (key === 'type') {
              props.type = value;
            } else if (key === 'required') {
              props.required = value === 'true';
            } else if (key === 'description') {
              props.description = value.replace(/^["']|["']$/g, '');
            } else if (key === 'default') {
              props.default = value.replace(/^["']|["']$/g, '');
            }
          }
          
          argumentsObject[argName] = props;
        }
      } else {
        // Parse regular key-value pairs
        const keyValueMatch = trimmed.match(/^(\w+):\s*(.+)$/);
        if (keyValueMatch) {
          const [, key, value] = keyValueMatch;
          // Check for multi-line YAML folded style (>- or >)
          if (value === '>-' || value === '>') {
            currentMultiLineKey = key;
            multiLineValue = [];
            continue;
          }
          // Explicitly handle known keys
          if (key === 'name') {
            frontmatter.name = value;
          } else if (key === 'description') {
            frontmatter.description = value;
          } else if (key === 'version') {
            frontmatter.version = value;
          }
        }
      }
    }
    
    // Handle case where multi-line value extends to end of frontmatter
    if (currentMultiLineKey && multiLineValue.length > 0) {
      const fullValue = multiLineValue.join(' ').trim();
      if (currentMultiLineKey === 'description') {
        frontmatter.description = fullValue;
      }
    }
    
    frontmatter.arguments = argumentsObject;
    
    // Get the prompt content (everything after frontmatter)
    const promptContent = lines.slice(frontmatterEnd + 1).join('\n');
    
    return {
      name: frontmatter.name || basename(filePath, '.md'),
      description: frontmatter.description || '',
      version: parseInt(frontmatter.version || '') || 1,
      arguments: argumentsObject,
      content: promptContent
    };
  } catch (error) {
    logger.warn(`Error parsing prompt file ${filePath}:`, errorToContext(error));
    return null;
  }
}

/**
 * Load all prompts from the prompts directory
 */
export async function loadPrompts(): Promise<Prompt[]> {
  try {
    // Import pathsReady and wait for paths to be initialized
    const { pathsReady } = await import('../utils/paths.js');
    await pathsReady;
    
    const files = await readdir(getPromptsDir());
    const promptFiles = files.filter((f: string) => f.endsWith('.md'));
    
    const prompts: Prompt[] = [];
    
    for (const file of promptFiles) {
      const filePath = join(getPromptsDir(), file);
      const parsed = await parsePromptFile(filePath);
      
      if (parsed) {
        const prompt: Prompt = {
          name: parsed.name,
          description: parsed.description,
          arguments: Object.keys(parsed.arguments).map(argName => ({
            name: argName,
            description: parsed.arguments[argName].description,
            required: parsed.arguments[argName].required
          }))
        };
        
        prompts.push(prompt);
      }
    }
    
    return prompts;
  } catch (error) {
    logger.warn('Error loading prompts:', errorToContext(error));
    return [];
  }
}

/**
 * Get prompt content with template substitution
 */
export async function getPromptContent(name: string, args: Record<string, unknown> = {}): Promise<string> {
  try {
    // Import pathsReady and wait for paths to be initialized
    const { pathsReady } = await import('../utils/paths.js');
    await pathsReady;
    
    const files = await readdir(getPromptsDir());
    const promptFiles = files.filter((f: string) => f.endsWith('.md'));
    
    for (const file of promptFiles) {
      const filePath = join(getPromptsDir(), file);
      const parsed = await parsePromptFile(filePath);
      
      if (parsed && parsed.name === name) {
        const content = parsed.content;
        
        // Import config after prompt is found to avoid circular dependencies
        const { loadConfiguration } = await import('../config/config.js');
        const config = loadConfiguration();

        // Apply argument defaults from prompt definition first
        const argsWithDefaults = { ...args };
        for (const [argName, argDef] of Object.entries(parsed.arguments)) {
          if (!(argName in argsWithDefaults) && argDef.default !== undefined) {
            argsWithDefaults[argName] = argDef.default;
          }
        }

        // Create comprehensive template variables from config (pass args for date calculation)
        const configVars = createTemplateVariables(config, argsWithDefaults);
        
        // Merge with user-provided args (args override config defaults)
        const allVars = { ...configVars, ...argsWithDefaults };
        
        // Apply template variables to defaults that contain template syntax
        for (const [argName, argDef] of Object.entries(parsed.arguments)) {
          if (argName in allVars && typeof allVars[argName] === 'string' && (allVars[argName] as string).includes('{{')) {
            allVars[argName] = applyTemplateVariables(allVars[argName] as string, configVars);
          }
        }
        
        // Apply all template substitutions
        return applyTemplateVariables(content, allVars);
      }
    }
    
    throw new Error(`Prompt '${name}' not found`);
  } catch (error) {
    throw new Error(`Error getting prompt content: ${error instanceof Error ? error.message : String(error)}`);
  }
}