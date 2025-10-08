/**
 * Centralized sampling client for making AI requests
 */

import { logger } from "./logger.js";
import { loadSystemPrompt } from "./prompt-loader.js";
import type { MCPServer, MCPServerLike } from "../types/mcp.js";

export interface ModelPreferences {
  hints?: Array<{ name: string }>;
  costPriority?: number; // 0-1, higher = prefer cheaper models
  speedPriority?: number; // 0-1, higher = prefer faster models
  intelligencePriority?: number; // 0-1, higher = prefer more capable models
  [key: string]: unknown;
}

export interface SamplingRequest {
  systemPromptName: string;
  userContent: string;
  maxTokens?: number;
  temperature?: number;
  variables?: Record<string, string>;
  modelPreferences?: ModelPreferences;
}

export interface SamplingResponse {
  content: {
    text: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Check if the server supports sampling capabilities (standalone function)
 * @param server The MCP server instance or mock
 * @returns true if sampling is supported, false otherwise
 */
export function checkSamplingSupport(server: MCPServer | MCPServerLike | null): boolean {
  if (!server) {
    logger.debug("No server instance available for sampling");
    return false;
  }

  // Type guard: check if getClientCapabilities exists
  if (typeof server.getClientCapabilities !== "function") {
    logger.debug("Server instance does not have getClientCapabilities method");
    return false;
  }

  const clientCapabilities = server.getClientCapabilities();
  if (!clientCapabilities?.sampling) {
    logger.debug("Client does not support sampling capabilities");
    return false;
  }

  if (typeof server.createMessage !== "function") {
    logger.debug("Server instance does not have createMessage method");
    return false;
  }

  return true;
}

/**
 * Get default model preferences optimized for speed with FREE models only
 * These models have 0x token cost and no rate limits
 */
export function getDefaultModelPreferences(): ModelPreferences {
  return {
    hints: [
      { name: "gpt-4o-mini" }, // FREE: GPT-4o mini for speed (0x tokens)
      { name: "gpt-4.1" }, // FREE: GPT-4.1 balanced (0x tokens)
      { name: "gpt-4o" }, // FREE: GPT-4o general purpose (0x tokens)
      { name: "gpt-3.5" }, // FREE: GPT-3.5 fallback (0x tokens)
      { name: "mini" }, // Generic mini model fallback
    ],
    speedPriority: 0.9, // Speed is very important
    costPriority: 0.7, // Cost efficiency matters
    intelligencePriority: 0.5, // Moderate intelligence needed
  };
}

export class SamplingClient {
  constructor(private server: MCPServer | MCPServerLike) {}

  hasSamplingSupport(): boolean {
    return checkSamplingSupport(this.server);
  }

  async createMessage(request: SamplingRequest): Promise<SamplingResponse> {
    const systemPrompt = loadSystemPrompt(request.systemPromptName, request.variables);

    const samplingParams = {
      systemPrompt,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: request.userContent,
          },
        },
      ],
      maxTokens: request.maxTokens || 500,
      temperature: request.temperature || 0.3,
      modelPreferences: request.modelPreferences || getDefaultModelPreferences(),
    };

    // Type assertion needed since MCPServerLike is less specific than MCPServer
    // but we've already validated the server has createMessage in checkSamplingSupport
    return (await (this.server as MCPServer).createMessage(samplingParams)) as SamplingResponse;
  }

  extractResponseText(aiResult: SamplingResponse): string {
    return aiResult?.content?.text || JSON.stringify(aiResult) || "No analysis available";
  }
}
