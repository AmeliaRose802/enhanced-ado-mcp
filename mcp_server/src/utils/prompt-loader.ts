import { readFileSync } from "fs";
import { join } from "path";
import { promptsDir } from "./paths.js";
import { logger } from "./logger.js";

/**
 * Cache for loaded prompts to avoid repeated file reads
 */
const promptCache = new Map<string, string>();

/**
 * Load a system prompt from the prompts/system directory
 * @param promptName - Name of the prompt file (without .md extension)
 * @param variables - Optional variables to substitute in the prompt (e.g., {{VARIABLE_NAME}})
 * @returns The loaded prompt text with variables substituted
 */
export function loadSystemPrompt(promptName: string, variables?: Record<string, string>): string {
  const cacheKey = promptName;

  // Check cache first
  if (!promptCache.has(cacheKey)) {
    try {
      const promptPath = join(promptsDir, "system", `${promptName}.md`);

      logger.debug(`Loading system prompt from: ${promptPath}`);

      const promptText = readFileSync(promptPath, "utf-8");
      promptCache.set(cacheKey, promptText);

      logger.debug(`System prompt '${promptName}' loaded and cached`);
    } catch (error) {
      logger.error(`Failed to load system prompt '${promptName}':`, error);
      throw new Error(
        `Failed to load system prompt '${promptName}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  let prompt = promptCache.get(cacheKey)!;

  // Substitute variables if provided
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      prompt = prompt.replace(new RegExp(placeholder, "g"), value);
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
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value || ""));
  }
  return result;
}
