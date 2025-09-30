import fs from "fs/promises";
import path from "path";
import type { Prompt, ParsedPrompt, PromptArgument } from "../types/index.js";
import { promptsDir } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

/**
 * Create template variables object from config
 */
function createTemplateVariables(config: any) {
  const now = new Date();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const semester = `Q${quarter}`;
  
  return {
    area_path: config.azureDevOps.areaPath || '',
    project: config.azureDevOps.project || '',
    project_name: config.azureDevOps.project || '',
    org_url: `https://dev.azure.com/${config.azureDevOps.organization}`,
    organization: config.azureDevOps.organization || '',
    iteration_path: config.azureDevOps.iterationPath || '',
    assigned_to: config.azureDevOps.defaultAssignedTo || '',
    semester: semester,
    max_age_days: 180,
    include_child_areas: true,
    max_items: 50,
    dry_run: true
  };
}

/**
 * Apply template substitutions to a string value
 */
function applyTemplateSubstitutions(value: string, templateVars: Record<string, any>): string {
  let result = value;
  result = result.replace(/{{area_path}}/g, templateVars.area_path);
  result = result.replace(/{{project}}/g, templateVars.project);
  result = result.replace(/{{project_name}}/g, templateVars.project_name);
  result = result.replace(/{{org_url}}/g, templateVars.org_url);
  result = result.replace(/{{organization}}/g, templateVars.organization);
  result = result.replace(/{{iteration_path}}/g, templateVars.iteration_path);
  result = result.replace(/{{assigned_to}}/g, templateVars.assigned_to);
  result = result.replace(/{{semester}}/g, templateVars.semester);
  return result;
}

/**
 * Parse a prompt file with YAML frontmatter
 */
export async function parsePromptFile(filePath: string): Promise<ParsedPrompt | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
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
      name: frontmatter.name || path.basename(filePath, '.md'),
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
    const files = await fs.readdir(promptsDir);
    const promptFiles = files.filter(f => f.endsWith('.md'));
    
    const prompts: Prompt[] = [];
    
    for (const file of promptFiles) {
      const filePath = path.join(promptsDir, file);
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
    const files = await fs.readdir(promptsDir);
    const promptFiles = files.filter(f => f.endsWith('.md'));
    
    for (const file of promptFiles) {
      const filePath = path.join(promptsDir, file);
      const parsed = await parsePromptFile(filePath);
      
      if (parsed && parsed.name === name) {
        let content = parsed.content;
        
        // Import config after prompt is found to avoid circular dependencies
        const { loadConfiguration } = await import('../config/config-manager.js');
        const config = loadConfiguration();

        // For zero-argument prompts, still provide all standard template variables
        const argsWithDefaults = { ...args };
        
        // Always provide comprehensive template variables for zero-config prompts
        if (Object.keys(parsed.arguments).length === 0 || Object.values(parsed.arguments).length === 0) {
          Object.assign(argsWithDefaults, createTemplateVariables(config));
        }

        // Apply argument defaults for prompts that still have arguments  
        for (const [argName, argDef] of Object.entries(parsed.arguments)) {
          if (!(argName in argsWithDefaults) && argDef.default !== undefined) {
            // If default contains template variables, resolve them
            if (typeof argDef.default === 'string' && argDef.default.includes('{{')) {
              let defaultValue = argDef.default;
              // Replace common template variables in defaults
              defaultValue = defaultValue.replace(/{{area_path}}/g, config.azureDevOps.areaPath || '');
              defaultValue = defaultValue.replace(/{{project}}/g, config.azureDevOps.project);
              defaultValue = defaultValue.replace(/{{project_name}}/g, config.azureDevOps.project);
              defaultValue = defaultValue.replace(/{{org_url}}/g, `https://dev.azure.com/${config.azureDevOps.organization}`);
              defaultValue = defaultValue.replace(/{{organization}}/g, config.azureDevOps.organization);
              defaultValue = defaultValue.replace(/{{iteration_path}}/g, config.azureDevOps.iterationPath || '');
              defaultValue = defaultValue.replace(/{{assigned_to}}/g, config.azureDevOps.defaultAssignedTo);
              // Simple semester calculation
              const now = new Date();
              const month = now.getMonth();
              const semester = month < 3 ? 'Kr' : month < 6 ? 'Br' : month < 9 ? 'Ar' : month < 11 ? 'Ca' : 'Sc';
              defaultValue = defaultValue.replace(/{{semester}}/g, semester);
              argsWithDefaults[argName] = defaultValue;
            } else {
              argsWithDefaults[argName] = argDef.default;
            }
          }
        }
        
        // Provide configuration defaults as template variables
        const configDefaults = {
          default_organization: config.azureDevOps.organization,
          default_project: config.azureDevOps.project,
          default_area_path: config.azureDevOps.areaPath || '',
          default_iteration_path: config.azureDevOps.iterationPath || '',
          default_work_item_type: config.azureDevOps.defaultWorkItemType,
          default_priority: config.azureDevOps.defaultPriority.toString(),
          default_assigned_to: config.azureDevOps.defaultAssignedTo,
          default_repository: config.gitRepository.defaultRepository || '',
          default_branch: config.gitRepository.defaultBranch
        };
        
        // Auto-fill common parameters from configuration if not provided
        const enhancedArgs = { ...argsWithDefaults };
        
        // Organization and project mapping
        if (!enhancedArgs.project && config.azureDevOps.project) {
          enhancedArgs.project = config.azureDevOps.project;
        }
        if (!enhancedArgs.project_name && config.azureDevOps.project) {
          enhancedArgs.project_name = config.azureDevOps.project;
        }
        if (!enhancedArgs.organization && config.azureDevOps.organization) {
          enhancedArgs.organization = config.azureDevOps.organization;
        }
        if (!enhancedArgs.org_url && config.azureDevOps.organization) {
          enhancedArgs.org_url = `https://dev.azure.com/${config.azureDevOps.organization}`;
        }
        
        // Area and iteration paths
        if (!enhancedArgs.area_path && config.azureDevOps.areaPath) {
          enhancedArgs.area_path = config.azureDevOps.areaPath;
        }
        if (!enhancedArgs.iteration_path && config.azureDevOps.iterationPath) {
          enhancedArgs.iteration_path = config.azureDevOps.iterationPath;
        }
        
        // Work item defaults
        if (!enhancedArgs.work_item_type && config.azureDevOps.defaultWorkItemType) {
          enhancedArgs.work_item_type = config.azureDevOps.defaultWorkItemType;
        }
        if (!enhancedArgs.priority && config.azureDevOps.defaultPriority) {
          enhancedArgs.priority = config.azureDevOps.defaultPriority.toString();
        }
        if (!enhancedArgs.assigned_to && config.azureDevOps.defaultAssignedTo) {
          enhancedArgs.assigned_to = config.azureDevOps.defaultAssignedTo;
        }
        
        // Git repository defaults
        if (!enhancedArgs.repository && config.gitRepository.defaultRepository) {
          enhancedArgs.repository = config.gitRepository.defaultRepository;
        }
        if (!enhancedArgs.branch && config.gitRepository.defaultBranch) {
          enhancedArgs.branch = config.gitRepository.defaultBranch;
        }
        
        // Merge user args with config defaults (user args take precedence)
        const allArgs = { ...configDefaults, ...enhancedArgs };
        
        // Replace template variables
        for (const [key, value] of Object.entries(allArgs)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          content = content.replace(regex, String(value || ''));
        }
        
        return content;
      }
    }
    
    throw new Error(`Prompt '${name}' not found`);
  } catch (error) {
    throw new Error(`Error getting prompt content: ${error instanceof Error ? error.message : String(error)}`);
  }
}