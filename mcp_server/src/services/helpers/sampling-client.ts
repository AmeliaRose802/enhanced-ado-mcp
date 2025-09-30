/**
 * Centralized sampling client for making AI requests
 */

import { logger } from '../../utils/logger.js';
import { loadSystemPrompt } from '../../utils/prompt-loader.js';

export interface SamplingRequest {
  systemPromptName: string;
  userContent: string;
  maxTokens?: number;
  temperature?: number;
  variables?: Record<string, string>;
}

export class SamplingClient {
  constructor(private server: any) {}

  hasSamplingSupport(): boolean {
    if (!this.server) {
      logger.error('No server instance available for sampling');
      return false;
    }
    
    const clientCapabilities = this.server.getClientCapabilities();
    if (!clientCapabilities?.sampling) {
      logger.error('Client does not support sampling capabilities');
      return false;
    }
    
    if (typeof this.server.createMessage !== 'function') {
      logger.error('Server instance does not have createMessage method');
      return false;
    }
    
    return true;
  }

  async createMessage(request: SamplingRequest): Promise<any> {
    const systemPrompt = loadSystemPrompt(request.systemPromptName, request.variables);
    
    return await this.server.createMessage({
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
    });
  }

  extractResponseText(aiResult: any): string {
    return aiResult?.content?.text || JSON.stringify(aiResult) || 'No analysis available';
  }
}
