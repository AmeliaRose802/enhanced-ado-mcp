/**
 * Visualize Dependencies Handler
 * 
 * Generates visual dependency graphs for work item relationships.
 * Supports DOT (Graphviz) and Mermaid diagram formats.
 */

import { logger } from '../../../utils/logger.js';
import type { ToolExecutionResult } from '../../../types/index.js';
import { loadConfiguration } from '../../../config/config.js';
import { queryHandleService } from '../../query-handle-service.js';
import {
  buildDependencyGraph,
  exportAsDot,
  exportAsMermaid,
  getRenderingInstructions,
  type RelationType,
  type ExportFormat,
  type LayoutDirection
} from '../../visualization-service.js';
import { z } from 'zod';

/**
 * Input schema for visualize-dependencies tool
 */
const visualizeDependenciesSchema = z.object({
  queryHandle: z.string().optional().describe('Query handle from query-wiql (optional if workItemIds provided)'),
  workItemIds: z.array(z.number()).optional().describe('Array of work item IDs to visualize (optional if queryHandle provided)'),
  format: z.enum(['dot', 'mermaid']).default('mermaid').describe('Export format: dot (Graphviz) or mermaid'),
  relationTypes: z.array(z.enum(['all', 'parent-child', 'blocks', 'related', 'depends-on'])).default(['all']).describe('Relationship types to include'),
  maxDepth: z.number().min(1).max(10).default(3).describe('Maximum depth to traverse (prevents huge graphs)'),
  maxNodes: z.number().min(10).max(500).default(100).describe('Maximum number of nodes to include'),
  layoutDirection: z.enum(['LR', 'TB', 'RL', 'BT']).default('LR').describe('Layout direction (LR=left-to-right, TB=top-to-bottom)'),
  groupByType: z.boolean().default(false).describe('Group nodes by work item type (DOT only)'),
  includeMetadata: z.boolean().default(true).describe('Include work item metadata (type, state) in labels'),
  colorByState: z.boolean().default(false).describe('Color nodes by state (default: color by type)'),
  organization: z.string().optional().describe('Azure DevOps organization name (uses config default if not provided)'),
  project: z.string().optional().describe('Azure DevOps project name (uses config default if not provided)')
});

type VisualizeDependenciesInput = z.infer<typeof visualizeDependenciesSchema>;

/**
 * Handle visualize-dependencies tool execution
 */
export async function handleVisualizeDependencies(args: unknown): Promise<ToolExecutionResult> {
  logger.debug('[handleVisualizeDependencies] Starting dependency visualization');
  
  try {
    // Parse and validate input
    const input = visualizeDependenciesSchema.parse(args);
    
    // Get configuration
    const config = loadConfiguration();
    const organization = input.organization || config.azureDevOps.organization;
    const project = input.project || config.azureDevOps.project;
    
    // Validate inputs
    if (!input.queryHandle && !input.workItemIds) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'visualize-dependencies',
          timestamp: new Date().toISOString()
        },
        errors: ['Either queryHandle or workItemIds must be provided'],
        warnings: []
      };
    }
    
    // Get work item IDs
    let workItemIds: number[];
    
    if (input.queryHandle) {
      logger.debug(`[handleVisualizeDependencies] Using query handle: ${input.queryHandle}`);
      
      const handleData = queryHandleService.getQueryData(input.queryHandle);
      if (!handleData) {
        return {
          success: false,
          data: null,
          metadata: {
            tool: 'visualize-dependencies',
            timestamp: new Date().toISOString()
          },
          errors: [`Invalid or expired query handle: ${input.queryHandle}`],
          warnings: []
        };
      }
      
      workItemIds = handleData.workItemIds;
    } else {
      workItemIds = input.workItemIds!;
    }
    
    if (workItemIds.length === 0) {
      return {
        success: false,
        data: null,
        metadata: {
          tool: 'visualize-dependencies',
          timestamp: new Date().toISOString()
        },
        errors: ['No work items found to visualize'],
        warnings: []
      };
    }
    
    logger.debug(`[handleVisualizeDependencies] Visualizing ${workItemIds.length} work items`);
    
    // Build dependency graph
    const graph = await buildDependencyGraph(workItemIds, organization, project, {
      format: input.format,
      relationTypes: input.relationTypes as RelationType[],
      maxDepth: input.maxDepth,
      maxNodes: input.maxNodes,
      layoutDirection: input.layoutDirection as LayoutDirection,
      groupByType: input.groupByType,
      includeMetadata: input.includeMetadata,
      colorByState: input.colorByState
    });
    
    // Export graph in requested format
    let diagram: string;
    if (input.format === 'dot') {
      diagram = exportAsDot(graph, {
        format: 'dot',
        relationTypes: input.relationTypes as RelationType[],
        layoutDirection: input.layoutDirection as LayoutDirection,
        groupByType: input.groupByType,
        includeMetadata: input.includeMetadata,
        colorByState: input.colorByState
      });
    } else {
      diagram = exportAsMermaid(graph, {
        format: 'mermaid',
        relationTypes: input.relationTypes as RelationType[],
        layoutDirection: input.layoutDirection as LayoutDirection,
        includeMetadata: input.includeMetadata,
        colorByState: input.colorByState
      });
    }
    
    // Get rendering instructions
    const renderingInstructions = getRenderingInstructions(input.format);
    
    // Build summary
    const nodesByType = new Map<string, number>();
    for (const node of graph.nodes.values()) {
      nodesByType.set(node.type, (nodesByType.get(node.type) || 0) + 1);
    }
    
    const edgesByType = new Map<string, number>();
    for (const edge of graph.edges) {
      edgesByType.set(edge.relationType, (edgesByType.get(edge.relationType) || 0) + 1);
    }
    
    const summary = {
      total_nodes: graph.nodes.size,
      total_edges: graph.edges.length,
      nodes_by_type: Object.fromEntries(nodesByType),
      edges_by_relation: Object.fromEntries(edgesByType),
      format: input.format,
      truncated: graph.nodes.size >= input.maxNodes
    };
    
    logger.debug(`[handleVisualizeDependencies] Generated ${input.format} diagram with ${graph.nodes.size} nodes and ${graph.edges.length} edges`);
    
    return {
      success: true,
      data: {
        diagram,
        format: input.format,
        summary,
        rendering_instructions: renderingInstructions,
        usage_hint: input.format === 'mermaid' 
          ? 'VS Code has built-in Mermaid support! Save this in a .md file inside a ```mermaid code block and use Markdown preview.'
          : 'Save as .dot file and use Graphviz to render: dot -Tpng file.dot -o file.png'
      },
      metadata: {
        tool: 'visualize-dependencies',
        timestamp: new Date().toISOString(),
        organization,
        project,
        input_work_items: workItemIds.length,
        output_nodes: graph.nodes.size,
        output_edges: graph.edges.length
      },
      errors: [],
      warnings: summary.truncated 
        ? [`Graph truncated at ${input.maxNodes} nodes. Consider filtering by relationship type or reducing maxDepth.`]
        : []
    };
    
  } catch (error) {
    logger.error('[handleVisualizeDependencies] Error generating visualization:', 
      error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) });
    
    return {
      success: false,
      data: null,
      metadata: {
        tool: 'visualize-dependencies',
        timestamp: new Date().toISOString()
      },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
