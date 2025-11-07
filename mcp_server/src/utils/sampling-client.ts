/**
 * Centralized sampling client for making AI requests
 */

import { logger } from './logger.js';
import { loadSystemPrompt } from './prompt-loader.js';
import type { MCPServer, MCPServerLike } from '../types/mcp.js';

export interface ModelPreferences {
  hints?: Array<{ name: string }>;
  costPriority?: number;        // 0-1, higher = prefer cheaper models
  speedPriority?: number;       // 0-1, higher = prefer faster models
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
    logger.debug('No server instance available for sampling');
    return false;
  }
  
  // Type guard: check if getClientCapabilities exists
  if (typeof server.getClientCapabilities !== 'function') {
    logger.debug('Server instance does not have getClientCapabilities method');
    return false;
  }
  
  const clientCapabilities = server.getClientCapabilities();
  if (!clientCapabilities?.sampling) {
    logger.debug('Client does not support sampling capabilities');
    return false;
  }
  
  if (typeof server.createMessage !== 'function') {
    logger.debug('Server instance does not have createMessage method');
    return false;
  }
  
  return true;
}

/**
 * Get default model preferences optimized for FREE models only
 * 
 * This configuration is designed to work across different IDEs and adapt to model changes:
 * 
 * Strategy:
 * - HIGH cost priority (1.0) to strongly prefer free models (0x tokens)
 * - Generic pattern hints to match any free model names
 * - Speed priority to prefer fast models among free options
 * - No specific model names to avoid breaking when models change
 * 
 * The hints use substring matching to be compatible with:
 * - Different IDE implementations (VS Code, Cursor, etc.)
 * - Future model releases and naming changes
 * - Regional or variant model names
 * 
 * VS Code's model selection will:
 * 1. Filter to only 0x token models (costPriority: 1.0)
 * 2. Among free models, prefer "mini" variants (speedPriority: 0.9)
 * 3. Fall back to any available free GPT-4, GPT-5, or GPT-3 models
 */
export function getDefaultModelPreferences(): ModelPreferences {
  return {
    hints: [
      { name: 'mini' },              // PATTERN: Any "mini" model (GPT-5 mini, GPT-4o mini, etc.)
      { name: 'gpt-5' },             // PATTERN: Any GPT-5 variant (future-proof)
      { name: 'gpt-4' },             // PATTERN: Any GPT-4 variant (4.1, 4o, 4-turbo, etc.)
      { name: 'gpt-3' },             // PATTERN: Any GPT-3 variant (legacy support)
      { name: 'gpt' }                // PATTERN: Any GPT model (ultimate fallback)
    ],
    costPriority: 1.0,               // CRITICAL: Strongly prefer free models (0x tokens)
    speedPriority: 0.9,              // Speed is very important (prefer "mini" models)
    intelligencePriority: 0.3        // Lower priority - free fast models are sufficient
  };
}

export class SamplingClient {
  constructor(private server: MCPServer | MCPServerLike) {}

  hasSamplingSupport(): boolean {
    return checkSamplingSupport(this.server);
  }

  async createMessage(request: SamplingRequest): Promise<SamplingResponse> {
    const systemPrompt = await loadSystemPrompt(request.systemPromptName, request.variables);
    
    const samplingParams = {
      systemPrompt,
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: request.userContent
        }
      }],
      maxTokens: request.maxTokens || 500,
      temperature: request.temperature || 0.3,
      modelPreferences: request.modelPreferences || getDefaultModelPreferences()
    };
    
    // Type assertion needed since MCPServerLike is less specific than MCPServer
    // but we've already validated the server has createMessage in checkSamplingSupport
    return await (this.server as MCPServer).createMessage(samplingParams) as SamplingResponse;
  }

  extractResponseText(aiResult: SamplingResponse): string {
    return aiResult?.content?.text || JSON.stringify(aiResult) || 'No analysis available';
  }
}
