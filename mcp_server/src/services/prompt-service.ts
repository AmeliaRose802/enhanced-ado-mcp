import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
import type { Prompt, ParsedPrompt, PromptArgument } from "../types/index.js";
import { promptsDir } from "../utils/paths.js";
import { logger } from "../utils/logger.js";
import { applyTemplateVariables } from "../utils/prompt-loader.js";

/**
 * Create template variables object from config
 */
function createTemplateVariables(config: any): Record<string, any> {
  const now = new Date();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const semester = `Q${quarter}`;
  
  return {
    // Core config variables
    area_path: config.azureDevOps.areaPath || '',
    project: config.azureDevOps.project || '',
    project_name: config.azureDevOps.project || '',
    org_url: `https://dev.azure.com/${config.azureDevOps.organization}`,
    organization: config.azureDevOps.organization || '',
    iteration_path: config.azureDevOps.iterationPath || '',
    assigned_to: config.azureDevOps.defaultAssignedTo || '',
    work_item_type: config.azureDevOps.defaultWorkItemType || '',
    priority: config.azureDevOps.defaultPriority?.toString() || '',
    branch: config.gitRepository.defaultBranch || '',
    
    // Config defaults with prefix
    default_organization: config.azureDevOps.organization,
    default_project: config.azureDevOps.project,
    default_area_path: config.azureDevOps.areaPath || '',
    default_iteration_path: config.azureDevOps.iterationPath || '',
    default_work_item_type: config.azureDevOps.defaultWorkItemType,
    default_priority: config.azureDevOps.defaultPriority?.toString(),
    default_assigned_to: config.azureDevOps.defaultAssignedTo,
    default_branch: config.gitRepository.defaultBranch,
    
    // Computed values
    semester: semester,
    max_age_days: 180,
    include_child_areas: true,
    max_items: 50,
    dry_run: true
  };
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
    const frontmatter: any = {};
    let inArguments = false;
    let argumentsObject: Record<string, PromptArgument> = {};
    
    for (const line of frontmatterLines) {
      const trimmed = line.trim();
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
          frontmatter[key] = value;
        }
      }
    }
    
    frontmatter.arguments = argumentsObject;
    
    // Get the prompt content (everything after frontmatter)
    const promptContent = lines.slice(frontmatterEnd + 1).join('\n');
    
    return {
      name: frontmatter.name || basename(filePath, '.md'),
      description: frontmatter.description || '',
      version: parseInt(frontmatter.version) || 1,
      arguments: argumentsObject,
      content: promptContent
    };
  } catch (error) {
    logger.warn(`Error parsing prompt file ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all prompts from the prompts directory
 */
export async function loadPrompts(): Promise<Prompt[]> {
  try {
    const files = await readdir(promptsDir);
    const promptFiles = files.filter((f: string) => f.endsWith('.md'));
    
    const prompts: Prompt[] = [];
    
    for (const file of promptFiles) {
      const filePath = join(promptsDir, file);
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
    logger.warn('Error loading prompts:', error);
    return [];
  }
}

/**
 * Get prompt content with template substitution
 */
export async function getPromptContent(name: string, args: Record<string, any> = {}): Promise<string> {
  try {
    const files = await readdir(promptsDir);
    const promptFiles = files.filter((f: string) => f.endsWith('.md'));
    
    for (const file of promptFiles) {
      const filePath = join(promptsDir, file);
      const parsed = await parsePromptFile(filePath);
      
      if (parsed && parsed.name === name) {
        let content = parsed.content;
        
        // Import config after prompt is found to avoid circular dependencies
        const { loadConfiguration } = await import('../config/config.js');
        const config = loadConfiguration();

        // Create comprehensive template variables from config
        const configVars = createTemplateVariables(config);
        
        // Merge with user-provided args (args override config defaults)
        const allVars = { ...configVars, ...args };
        
        // Apply argument defaults from prompt definition
        for (const [argName, argDef] of Object.entries(parsed.arguments)) {
          if (!(argName in allVars) && argDef.default !== undefined) {
            // If default contains template variables, resolve them first
            if (typeof argDef.default === 'string' && argDef.default.includes('{{')) {
              allVars[argName] = applyTemplateVariables(argDef.default, configVars);
            } else {
              allVars[argName] = argDef.default;
            }
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