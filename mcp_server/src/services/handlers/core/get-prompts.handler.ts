import type { ToolExecutionResult } from "@/types/index.js";
import { asToolData } from "@/types/index.js";
import type { z } from "zod";
import type { getPromptsSchema } from "@/config/schemas.js";
import { loadPrompts, getPromptContent } from "../../prompt-service.js";
import { logger } from "@/utils/logger.js";

/**
 * Prompt metadata structure for JSON serialization
 */
interface PromptMetadata {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  [key: string]: unknown;
}

/**
 * Prompt with optional content
 */
interface PromptWithContent extends PromptMetadata {
  content?: string;
  templateArgsUsed?: Record<string, unknown>;
}

/**
 * Handler for wit-get-prompts tool
 * 
 * Retrieves pre-filled prompt templates by name or lists all available prompts.
 * This tool is useful for:
 * - Testing prompt templates
 * - Debugging template variable substitution
 * - Agents that need direct access to prompt content for specialized workflows
 * 
 * @param args - Arguments containing optional promptName, includeContent flag, and template args
 * @returns ToolExecutionResult with prompt data
 */
export async function handleGetPrompts(
  args: Partial<z.infer<typeof getPromptsSchema>>
): Promise<ToolExecutionResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const { promptName, includeContent = true, args: templateArgs = {} } = args;

    // If specific prompt requested
    if (promptName) {
      try {
        // Load prompt metadata
        const allPrompts = await loadPrompts();
        const promptMeta = allPrompts.find(p => p.name === promptName);

        if (!promptMeta) {
          return {
            success: false,
            data: null,
            errors: [`Prompt '${promptName}' not found. Use wit-get-prompts without promptName to see available prompts.`],
            warnings: [],
            metadata: {
              tool: "wit-get-prompts",
              promptName,
              found: false
            }
          };
        }

        let content: string | undefined;
        if (includeContent) {
          try {
            content = await getPromptContent(promptName, templateArgs);
          } catch (error) {
            errors.push(`Failed to load prompt content: ${error instanceof Error ? error.message : String(error)}`);
            // Continue with metadata only
          }
        }

        // Create JSON-serializable prompt data
        const promptData: PromptWithContent = {
          name: promptMeta.name,
          description: promptMeta.description || "",
          arguments: (promptMeta.arguments || []).map(arg => ({
            name: arg.name,
            description: arg.description,
            required: arg.required
          })),
          content: content,
          templateArgsUsed: includeContent ? templateArgs : undefined
        };

        return {
          success: errors.length === 0,
          data: asToolData({
            prompt: promptData
          }),
          errors,
          warnings,
          metadata: {
            tool: "wit-get-prompts",
            promptName,
            contentIncluded: includeContent && !!content,
            templateArgsProvided: Object.keys(templateArgs).length
          }
        };
      } catch (error) {
        return {
          success: false,
          data: null,
          errors: [`Error retrieving prompt '${promptName}': ${error instanceof Error ? error.message : String(error)}`],
          warnings,
          metadata: {
            tool: "wit-get-prompts",
            promptName,
            error: true
          }
        };
      }
    }

    // List all prompts
    try {
      const allPrompts = await loadPrompts();
      
      // If includeContent is true, load content for all prompts
      const promptsWithContent: PromptWithContent[] = await Promise.all(
        allPrompts.map(async (prompt): Promise<PromptWithContent> => {
          let content: string | undefined;
          if (includeContent) {
            try {
              content = await getPromptContent(prompt.name, templateArgs);
            } catch (error) {
              warnings.push(`Failed to load content for prompt '${prompt.name}': ${error instanceof Error ? error.message : String(error)}`);
            }
          }

          return {
            name: prompt.name,
            description: prompt.description || "",
            arguments: (prompt.arguments || []).map(arg => ({
              name: arg.name,
              description: arg.description,
              required: arg.required
            })),
            content: content,
            templateArgsUsed: includeContent ? templateArgs : undefined
          };
        })
      );

      return {
        success: true,
        data: asToolData({
          prompts: promptsWithContent,
          totalCount: promptsWithContent.length
        }),
        errors: [],
        warnings,
        metadata: {
          tool: "wit-get-prompts",
          totalPrompts: allPrompts.length,
          contentIncluded: includeContent,
          templateArgsProvided: Object.keys(templateArgs).length
        }
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        errors: [`Error loading prompts: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
        metadata: {
          tool: "wit-get-prompts",
          error: true
        }
      };
    }
  } catch (error) {
    logger.error("Error in handleGetPrompts:", error);
    return {
      success: false,
      data: null,
      errors: [`Unexpected error: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
      metadata: {
        tool: "wit-get-prompts",
        error: true
      }
    };
  }
}
