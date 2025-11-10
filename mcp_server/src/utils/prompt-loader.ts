import { readFileSync } from 'fs';
import { watch } from 'fs';
import { join } from 'path';
import { getPromptsDir, pathsReady } from './paths.js';
import { logger } from './logger.js';

/**
 * Cache for loaded prompts to avoid repeated file reads
 */
const promptCache = new Map<string, string>();

/**
 * File watcher for prompts directory
 */
let promptWatcher: ReturnType<typeof watch> | null = null;

/**
 * Callback to notify when prompts change
 */
let onPromptsChangedCallback: (() => void) | null = null;

/**
 * Load a system prompt from the prompts/system directory
 * @param promptName - Name of the prompt file (without .md extension)
 * @param variables - Optional variables to substitute in the prompt (e.g., {{VARIABLE_NAME}})
 * @returns The loaded prompt text with variables substituted
 */
export async function loadSystemPrompt(promptName: string, variables?: Record<string, string>): Promise<string> {
  // Wait for paths to be initialized in production
  await pathsReady;
  
  const cacheKey = promptName;
  
  // Disable caching in development mode to always reload prompts
  const disableCache = process.env.MCP_DEBUG === '1' || process.env.MCP_NO_CACHE === '1';
  
  // Check cache first (skip if cache disabled)
  if (!disableCache && !promptCache.has(cacheKey)) {
    try {
      const promptPath = join(getPromptsDir(), 'system', `${promptName}.md`);
      
      logger.debug(`Loading system prompt from: ${promptPath}`);
      
      const promptText = readFileSync(promptPath, 'utf-8');
      promptCache.set(cacheKey, promptText);
      
      logger.debug(`System prompt '${promptName}' loaded and cached`);
    } catch (error) {
      const promptPath = join(getPromptsDir(), 'system', `${promptName}.md`);
      logger.error(`Failed to load system prompt '${promptName}' from ${promptPath}:`, error);
      logger.error(`PromptsDir resolved to: ${getPromptsDir()}`);
      logger.error(`Please ensure the prompts directory is correctly copied during build.`);
      throw new Error(`Failed to load system prompt '${promptName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (disableCache) {
    // Force reload when cache is disabled
    try {
      const promptPath = join(getPromptsDir(), 'system', `${promptName}.md`);
      const promptText = readFileSync(promptPath, 'utf-8');
      promptCache.set(cacheKey, promptText);
      logger.debug(`System prompt '${promptName}' force-reloaded (cache disabled)`);
    } catch (error) {
      logger.error(`Failed to reload system prompt '${promptName}':`, error);
      throw new Error(`Failed to reload system prompt '${promptName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  let prompt = promptCache.get(cacheKey)!;
  
  // Substitute variables if provided
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    }
  }
  
  return prompt;
}

/**
 * Apply template substitutions to text using provided variables
 * @param text - Text containing {{variable}} placeholders
 * @param variables - Variables to substitute
 * @returns Text with all variables substituted
 */
export function applyTemplateVariables(text: string, variables: Record<string, any>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  return result;
}

/**
 * Clear the prompt cache (useful for development/testing)
 * This forces all prompts to be reloaded from disk on next access
 */
export function clearPromptCache(): void {
  promptCache.clear();
  logger.debug('Prompt cache cleared');
}

/**
 * Set callback for when prompts change
 */
export function setPromptsChangedCallback(callback: () => void): void {
  onPromptsChangedCallback = callback;
}

/**
 * Start watching the prompts directory for changes
 */
export async function startPromptWatcher(): Promise<void> {
  await pathsReady;
  
  if (promptWatcher) {
    logger.debug('Prompt watcher already running');
    return;
  }
  
  const promptsDir = getPromptsDir();
  
  try {
    // Watch the entire prompts directory recursively
    promptWatcher = watch(promptsDir, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) {
        return;
      }
      
      logger.info(`Prompt file changed: ${filename} (${eventType})`);
      
      // Clear cache to force reload
      clearPromptCache();
      
      // Notify callback if set
      if (onPromptsChangedCallback) {
        onPromptsChangedCallback();
      }
    });
    
    logger.info(`Started watching prompts directory: ${promptsDir}`);
  } catch (error) {
    logger.error('Failed to start prompt watcher:', error);
  }
}

/**
 * Stop watching the prompts directory
 */
export function stopPromptWatcher(): void {
  if (promptWatcher) {
    promptWatcher.close();
    promptWatcher = null;
    logger.info('Stopped watching prompts directory');
  }
}
