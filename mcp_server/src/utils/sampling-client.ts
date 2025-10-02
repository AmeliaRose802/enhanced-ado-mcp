/**
 * Centralized sampling client for making AI requests
 */

import { logger } from './logger.js';
import { loadSystemPrompt } from './prompt-loader.js';

export interface ModelPreferences {
  hints?: Array<{ name: string }>;
  costPriority?: number;        // 0-1, higher = prefer cheaper models
  speedPriority?: number;       // 0-1, higher = prefer faster models
  intelligencePriority?: number; // 0-1, higher = prefer more capable models
}

export interface SamplingRequest {
  systemPromptName: string;
  userContent: string;
  maxTokens?: number;
  temperature?: number;
  variables?: Record<string, string>;
  modelPreferences?: ModelPreferences;
}

/**
 * Check if the server supports sampling capabilities (standalone function)
 * @param server The MCP server instance
 * @returns true if sampling is supported, false otherwise
 */
export function checkSamplingSupport(server: any): boolean {
  if (!server) {
    logger.debug('No server instance available for sampling');
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
 * Get default model preferences optimized for speed with mini models
 */
export function getDefaultModelPreferences(): ModelPreferences {
  return {
    hints: [
      { name: 'gpt-4o-mini' },      // Prefer GPT-4o mini for speed
      { name: 'o3-mini' },           // Fallback to o3-mini
      { name: 'gpt-3.5' },           // Fallback to GPT-3.5
      { name: 'mini' }               // Generic mini model fallback
    ],
    speedPriority: 0.9,              // Speed is very important
    costPriority: 0.7,               // Cost efficiency matters
    intelligencePriority: 0.5        // Moderate intelligence needed
  };
}

export class SamplingClient {
  constructor(private server: any) {}

  hasSamplingSupport(): boolean {
    return checkSamplingSupport(this.server);
  }

  async createMessage(request: SamplingRequest): Promise<any> {
    const systemPrompt = loadSystemPrompt(request.systemPromptName, request.variables);
    
    const samplingParams: any = {
      systemPrompt,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: request.userContent
        }
      }],
      maxTokens: request.maxTokens || 500,
      temperature: request.temperature || 0.3
    };

    // Add model preferences - use provided or default to fast mini models
    samplingParams.modelPreferences = request.modelPreferences || getDefaultModelPreferences();
    
    return await this.server.createMessage(samplingParams);
  }

  extractResponseText(aiResult: any): string {
    return aiResult?.content?.text || JSON.stringify(aiResult) || 'No analysis available';
  }
}
