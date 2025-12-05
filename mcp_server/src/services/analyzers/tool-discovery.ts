/**
 * AI-Powered Tool Discovery Analyzer
 * 
 * Matches natural language intent to appropriate MCP server tools.
 * Uses AI sampling to understand user intent and recommend the best tools.
 */

import { ToolExecutionResult, asToolData } from '../../types/index.js';
import type { MCPServer, MCPServerLike } from '../../types/mcp.js';
import { logger, errorToContext } from '../../utils/logger.js';
import { SamplingClient } from '../../utils/sampling-client.js';
import { toolConfigs } from '../../config/tool-configs/index.js';

export interface ToolDiscoveryArgs {
  intent?: string;
  listAll?: boolean;
  context?: string;
  maxRecommendations?: number;
  includeExamples?: boolean;
  filterCategory?: 'creation' | 'analysis' | 'bulk-operations' | 'query' | 'ai-powered' | 'all';
}

interface ToolRecommendation {
  toolName: string;
  confidence: number;
  reasoning: string;
  exampleUsage?: string;
  requiredParameters: string[];
  optionalParameters: string[];
}

interface ToolDiscoveryResult {
  originalIntent: string;
  recommendations: ToolRecommendation[];
  alternativeApproaches?: string[];
  warnings?: string[];
  [key: string]: unknown; // Allow additional properties
}

export class ToolDiscoveryAnalyzer {
  private samplingClient: SamplingClient;

  constructor(server: MCPServer | MCPServerLike) {
    this.samplingClient = new SamplingClient(server);
  }

  async discover(args: ToolDiscoveryArgs): Promise<ToolExecutionResult> {
    try {
      // Auto-detect list all intent
      const shouldListAll = args.listAll || this.isListAllIntent(args.intent);
      
      // Handle listAll mode - simple tool inventory
      if (shouldListAll) {
        return this.listAllTools(args);
      }

      if (!args.intent) {
        return {
          success: false,
          errors: ['Intent is required when listAll is false'],
          warnings: [],
          metadata: {}
        };
      }

      logger.info('Starting AI-powered tool discovery', { intent: args.intent });

      // Check sampling support
      if (!this.samplingClient.hasSamplingSupport()) {
        return {
          success: false,
          errors: ['AI sampling not available - tool discovery requires VS Code language model access'],
          warnings: ['Falling back to keyword-based matching'],
          data: asToolData({
            originalIntent: args.intent,
            recommendations: this.fallbackRecommendations(args.intent),
            warnings: ['AI sampling not available - using basic keyword matching']
          }),
          metadata: { intent: args.intent, fallbackMode: true }
        };
      }

      const maxRecommendations = args.maxRecommendations || 3;
      const includeExamples = args.includeExamples ?? false;
      const filterCategory = args.filterCategory || 'all';

      // Filter tools by category if specified
      const availableTools = this.filterToolsByCategory(toolConfigs, filterCategory);

      // Build user content with tool list and intent
      const userPrompt = this.buildUserPrompt(
        args.intent,
        args.context,
        availableTools,
        maxRecommendations,
        includeExamples
      );

      // Call AI for analysis using system prompt from file
      const aiResult = await this.samplingClient.createMessage({
        systemPromptName: 'tool-discovery',
        userContent: userPrompt,
        maxTokens: 1000,
        temperature: 0.2
      });

      if (!aiResult) {
        return {
          success: false,
          errors: ['AI sampling failed to return a response'],
          warnings: [],
          metadata: { intent: args.intent }
        };
      }

      // Extract response text
      const aiResponse = this.samplingClient.extractResponseText(aiResult);

      // Parse AI response
      const result = this.parseAIResponse(aiResponse, args.intent);

      return {
        success: true,
        data: asToolData(result),
        metadata: {
          intent: args.intent,
          toolsAnalyzed: availableTools.length,
          recommendationCount: result.recommendations.length,
          filterCategory
        },
        errors: [],
        warnings: result.warnings || []
      };

    } catch (error: unknown) {
      logger.error('Tool discovery failed', errorToContext(error));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during tool discovery';
      return {
        success: false,
        errors: [errorMessage],
        warnings: [],
        metadata: { intent: args.intent }
      };
    }
  }

  /**
   * Detect if the intent is asking to list all tools rather than get recommendations
   */
  private isListAllIntent(intent?: string): boolean {
    if (!intent) return false;
    
    const lowerIntent = intent.toLowerCase();
    const listAllPhrases = [
      'list all tools',
      'show all tools',
      'show me all tools',
      'list available tools',
      'show available tools',
      'what tools are available',
      'all available tools',
      'see all tools',
      'view all tools',
      'get all tools',
      'display all tools'
    ];
    
    return listAllPhrases.some(phrase => lowerIntent.includes(phrase));
  }

  private listAllTools(args: ToolDiscoveryArgs): ToolExecutionResult {
    const filterCategory = args.filterCategory || 'all';
    const availableTools = this.filterToolsByCategory(toolConfigs, filterCategory);

    const toolList = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: this.inferCategory(tool.name),
      requiredParams: this.extractRequiredParams(tool),
      optionalParams: this.extractOptionalParams(tool)
    }));

    return {
      success: true,
      data: asToolData({
        tools: toolList,
        totalTools: toolList.length,
        filterCategory
      }),
      metadata: {
        listAll: true,
        filterCategory,
        toolCount: toolList.length
      },
      errors: [],
      warnings: []
    };
  }

  private inferCategory(toolName: string): string {
    const name = toolName.toLowerCase();
    if (name.includes('create') || name.includes('new') || name.includes('clone')) return 'creation';
    if (name.includes('analyze') || name.includes('intelligence') || name.includes('validate')) return 'analysis';
    if (name.includes('bulk')) return 'bulk-operations';
    if (name.includes('query') || name.includes('wiql') || name.includes('odata')) return 'query';
    if (name.includes('config') || name.includes('prompt') || name.includes('discover')) return 'configuration';
    if (name.includes('handle')) return 'query-handles';
    return 'other';
  }

  private filterToolsByCategory(tools: typeof toolConfigs, category: string): typeof toolConfigs {
    if (category === 'all') {
      return tools;
    }

    return tools.filter(tool => {
      const name = tool.name.toLowerCase();
      
      switch (category) {
        case 'creation':
          return name.includes('create') || name.includes('new');
        case 'analysis':
          return name.includes('analyze') || name.includes('intelligence') || 
                 name.includes('detect') || name.includes('validate');
        case 'bulk-operations':
          return name.includes('bulk');
        case 'query':
          return name.includes('query') || name.includes('wiql') || name.includes('odata');
        case 'ai-powered':
          return name.includes('intelligence') || name.includes('ai-') || 
                 name.includes('generate') || name.includes('enhance') || 
                 name.includes('bulk-enhance') || name.includes('bulk-assign-story') ||
                 name.includes('bulk-add-acceptance');
        default:
          return true;
      }
    });
  }

  private buildUserPrompt(
    intent: string,
    context: string | undefined,
    tools: typeof toolConfigs,
    maxRecommendations: number,
    includeExamples: boolean
  ): string {
    const toolList = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      requiredParams: this.extractRequiredParams(tool),
      optionalParams: this.extractOptionalParams(tool)
    }));

    return `## User Intent
${intent}

${context ? `## Additional Context\n${context}\n` : ''}

## Available Tools
${JSON.stringify(toolList, null, 2)}

## Analysis Parameters
- Maximum recommendations: ${maxRecommendations}
- Include examples: ${includeExamples}`;
  }

  private extractRequiredParams(tool: typeof toolConfigs[0]): string[] {
    const schema = tool.inputSchema;
    return schema.required || [];
  }

  private extractOptionalParams(tool: typeof toolConfigs[0]): string[] {
    const schema = tool.inputSchema;
    const allProps = Object.keys(schema.properties || {});
    const required = schema.required || [];
    return allProps.filter(prop => !required.includes(prop));
  }

  private parseAIResponse(aiResponse: string, originalIntent: string): ToolDiscoveryResult {
    try {
      // Extract JSON from potential markdown code blocks
      let jsonText = aiResponse.trim();
      
      // Remove markdown code blocks if present
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // Try to find JSON object boundaries
        const jsonStart = jsonText.indexOf('{');
        const jsonEnd = jsonText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        }
      }

      const parsed = JSON.parse(jsonText);

      return {
        originalIntent,
        recommendations: parsed.recommendations || [],
        alternativeApproaches: parsed.alternativeApproaches,
        warnings: parsed.warnings
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse AI response', { error: errorMessage, response: aiResponse });
      
      // Fallback: provide a basic recommendation based on keyword matching
      return {
        originalIntent,
        recommendations: this.fallbackRecommendations(originalIntent),
        warnings: ['AI parsing failed - using fallback keyword matching']
      };
    }
  }

  private fallbackRecommendations(intent: string): ToolRecommendation[] {
    const lowerIntent = intent.toLowerCase();
    const recommendations: ToolRecommendation[] = [];

    // Simple keyword-based fallback
    if (lowerIntent.includes('create') || lowerIntent.includes('new')) {
      recommendations.push({
        toolName: 'create-workitem',
        confidence: 60,
        reasoning: 'Keyword match: intent contains "create" or "new"',
        requiredParameters: ['title'],
        optionalParameters: ['description', 'parentWorkItemId', 'tags']
      });
    }

    if (lowerIntent.includes('query') || lowerIntent.includes('search') || lowerIntent.includes('find')) {
      recommendations.push({
        toolName: 'query-wiql',
        confidence: 60,
        reasoning: 'Keyword match: intent contains query/search/find terms',
        requiredParameters: ['wiqlQuery'],
        optionalParameters: ['maxResults', 'includeFields']
      });
    }

    if (lowerIntent.includes('bulk') || lowerIntent.includes('multiple')) {
      recommendations.push({
        toolName: 'execute-bulk-operations',
        confidence: 50,
        reasoning: 'Keyword match: intent suggests bulk operations',
        requiredParameters: ['queryHandle', 'updates'],
        optionalParameters: ['dryRun']
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        toolName: 'get-config',
        confidence: 30,
        reasoning: 'No clear match found - suggesting configuration tool to explore available options',
        requiredParameters: [],
        optionalParameters: ['section', 'includeSensitive']
      });
    }

    return recommendations;
  }
}
