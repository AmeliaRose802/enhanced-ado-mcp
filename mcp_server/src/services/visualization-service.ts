/**
 * Visualization Service
 * 
 * Generates visual dependency graphs for work item relationships.
 * Supports DOT (Graphviz) and Mermaid diagram formats.
 */

import { logger } from '../utils/logger.js';
import type { ADOWorkItem, WorkItemRelation } from '../types/index.js';
import { createWorkItemRepository } from '../repositories/work-item.repository.js';

export type RelationType = 'all' | 'parent-child' | 'blocks' | 'related' | 'depends-on';
export type ExportFormat = 'dot' | 'mermaid';
export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT';

export interface VisualizationOptions {
  /** Format for the output */
  format: ExportFormat;
  /** Relationship types to include */
  relationTypes: RelationType[];
  /** Maximum depth to traverse (prevents huge graphs) */
  maxDepth?: number;
  /** Maximum number of nodes (stops at limit) */
  maxNodes?: number;
  /** Layout direction (LR=left-to-right, TB=top-to-bottom) */
  layoutDirection?: LayoutDirection;
  /** Group nodes by work item type */
  groupByType?: boolean;
  /** Include work item metadata in labels */
  includeMetadata?: boolean;
  /** Color nodes by state */
  colorByState?: boolean;
}

export interface GraphNode {
  id: number;
  title: string;
  type: string;
  state: string;
  url: string;
}

export interface GraphEdge {
  source: number;
  target: number;
  relationType: string;
  label: string;
}

export interface DependencyGraph {
  nodes: Map<number, GraphNode>;
  edges: GraphEdge[];
}

/**
 * Normalize relationship type from ADO relation name
 */
function normalizeRelationType(rel: string): string {
  if (rel.includes('Hierarchy-Forward')) return 'parent-child';
  if (rel.includes('Hierarchy-Reverse')) return 'child-parent';
  if (rel.includes('Dependency-Forward')) return 'depends-on';
  if (rel.includes('Dependency-Reverse')) return 'dependency-of';
  if (rel.includes('Related')) return 'related';
  if (rel.includes('Successor')) return 'successor';
  if (rel.includes('Predecessor')) return 'predecessor';
  return 'unknown';
}

/**
 * Check if relation matches filter
 */
function matchesRelationFilter(rel: string, filters: RelationType[]): boolean {
  if (filters.includes('all')) return true;
  
  const normalized = normalizeRelationType(rel);
  
  if (filters.includes('parent-child') && (normalized === 'parent-child' || normalized === 'child-parent')) {
    return true;
  }
  if (filters.includes('blocks') && (normalized === 'depends-on' || normalized === 'dependency-of')) {
    return true;
  }
  if (filters.includes('related') && normalized === 'related') {
    return true;
  }
  if (filters.includes('depends-on') && (normalized === 'depends-on' || normalized === 'dependency-of')) {
    return true;
  }
  
  return false;
}

/**
 * Extract work item ID from ADO URL
 */
function extractWorkItemId(url: string): number | null {
  const match = url.match(/workitems\/(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Build dependency graph from work items
 */
export async function buildDependencyGraph(
  workItemIds: number[],
  organization: string,
  project: string,
  options: VisualizationOptions
): Promise<DependencyGraph> {
  const repository = createWorkItemRepository(organization, project);
  
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: []
  };
  
  const visited = new Set<number>();
  const queue: Array<{ id: number; depth: number }> = workItemIds.map(id => ({ id, depth: 0 }));
  const maxDepth = options.maxDepth ?? 3;
  const maxNodes = options.maxNodes ?? 100;
  
  logger.debug(`[buildDependencyGraph] Starting with ${workItemIds.length} root items, maxDepth=${maxDepth}, maxNodes=${maxNodes}`);
  
  while (queue.length > 0 && graph.nodes.size < maxNodes) {
    const { id, depth } = queue.shift()!;
    
    if (visited.has(id) || depth > maxDepth) {
      continue;
    }
    
    visited.add(id);
    
    try {
      // Fetch work item with relations
      const workItem = await repository.getById(id, [
        'System.Id',
        'System.Title',
        'System.WorkItemType',
        'System.State'
      ]);
      
      // Add node
      graph.nodes.set(id, {
        id: workItem.id,
        title: workItem.fields['System.Title'] as string,
        type: workItem.fields['System.WorkItemType'] as string,
        state: workItem.fields['System.State'] as string,
        url: workItem.url || `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`
      });
      
      // Process relations
      if (workItem.relations) {
        for (const relation of workItem.relations) {
          if (!matchesRelationFilter(relation.rel, options.relationTypes)) {
            continue;
          }
          
          const relatedId = extractWorkItemId(relation.url);
          if (!relatedId) {
            continue;
          }
          
          const normalizedType = normalizeRelationType(relation.rel);
          
          // Add edge (handle directionality)
          if (normalizedType === 'parent-child') {
            // Forward: source is parent, target is child
            graph.edges.push({
              source: id,
              target: relatedId,
              relationType: normalizedType,
              label: 'parent-of'
            });
          } else if (normalizedType === 'child-parent') {
            // Reverse: source is child, target is parent
            graph.edges.push({
              source: relatedId,
              target: id,
              relationType: normalizedType,
              label: 'parent-of'
            });
          } else {
            graph.edges.push({
              source: id,
              target: relatedId,
              relationType: normalizedType,
              label: normalizedType
            });
          }
          
          // Queue related item if not visited
          if (!visited.has(relatedId) && depth < maxDepth) {
            queue.push({ id: relatedId, depth: depth + 1 });
          }
        }
      }
    } catch (error) {
      logger.warn(`[buildDependencyGraph] Failed to fetch work item ${id}:`, 
        error instanceof Error ? { message: error.message } : { error: String(error) });
    }
  }
  
  logger.debug(`[buildDependencyGraph] Graph built: ${graph.nodes.size} nodes, ${graph.edges.length} edges`);
  
  return graph;
}

/**
 * Get color for work item state
 */
function getStateColor(state: string): string {
  const stateLower = state.toLowerCase();
  
  if (stateLower === 'new' || stateLower === 'proposed') return '#87CEEB'; // Sky blue
  if (stateLower === 'active' || stateLower === 'in progress' || stateLower === 'committed') return '#FFD700'; // Gold
  if (stateLower === 'resolved' || stateLower === 'done' || stateLower === 'closed') return '#90EE90'; // Light green
  if (stateLower === 'removed' || stateLower === 'cut') return '#D3D3D3'; // Light gray
  
  return '#FFFFFF'; // White default
}

/**
 * Get color for work item type
 */
function getTypeColor(type: string): string {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('epic')) return '#8B4789'; // Purple
  if (typeLower.includes('feature')) return '#FF6B35'; // Orange
  if (typeLower.includes('story') || typeLower.includes('backlog')) return '#4A90E2'; // Blue
  if (typeLower.includes('task')) return '#50C878'; // Emerald
  if (typeLower.includes('bug')) return '#E63946'; // Red
  
  return '#6C757D'; // Gray default
}

/**
 * Get shape for work item type
 */
function getTypeShape(type: string): string {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('epic')) return 'doubleoctagon';
  if (typeLower.includes('feature')) return 'octagon';
  if (typeLower.includes('story') || typeLower.includes('backlog')) return 'box';
  if (typeLower.includes('task')) return 'ellipse';
  if (typeLower.includes('bug')) return 'diamond';
  
  return 'box';
}

/**
 * Export graph as Graphviz DOT format
 */
export function exportAsDot(graph: DependencyGraph, options: VisualizationOptions): string {
  const direction = options.layoutDirection || 'LR';
  const lines: string[] = [
    'digraph dependencies {',
    `  rankdir=${direction};`,
    '  node [fontname="Arial", fontsize=10];',
    '  edge [fontname="Arial", fontsize=8];',
    ''
  ];
  
  // Group by type if requested
  if (options.groupByType) {
    const typeGroups = new Map<string, number[]>();
    
    for (const [id, node] of graph.nodes) {
      const type = node.type;
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(id);
    }
    
    for (const [type, ids] of typeGroups) {
      lines.push(`  subgraph cluster_${type.replace(/\s+/g, '_')} {`);
      lines.push(`    label="${type}";`);
      lines.push(`    style=filled;`);
      lines.push(`    color=lightgrey;`);
      
      for (const id of ids) {
        const node = graph.nodes.get(id)!;
        const label = options.includeMetadata 
          ? `${node.type}: ${node.title}\\n${node.state}`
          : node.title;
        
        const shape = getTypeShape(node.type);
        const color = options.colorByState ? getStateColor(node.state) : getTypeColor(node.type);
        
        lines.push(`    "${id}" [label="${escapeLabel(label)}", shape=${shape}, style=filled, fillcolor="${color}"];`);
      }
      
      lines.push('  }');
      lines.push('');
    }
  } else {
    // Add nodes without grouping
    for (const [id, node] of graph.nodes) {
      const label = options.includeMetadata 
        ? `${node.type}: ${node.title}\\n${node.state}`
        : node.title;
      
      const shape = getTypeShape(node.type);
      const color = options.colorByState ? getStateColor(node.state) : getTypeColor(node.type);
      
      lines.push(`  "${id}" [label="${escapeLabel(label)}", shape=${shape}, style=filled, fillcolor="${color}"];`);
    }
    lines.push('');
  }
  
  // Add edges
  for (const edge of graph.edges) {
    // Only add edge if both nodes exist
    if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
      lines.push(`  "${edge.source}" -> "${edge.target}" [label="${edge.label}"];`);
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Export graph as Mermaid diagram
 */
export function exportAsMermaid(graph: DependencyGraph, options: VisualizationOptions): string {
  const direction = options.layoutDirection || 'LR';
  const lines: string[] = [
    `graph ${direction}`
  ];
  
  // Add nodes
  for (const [id, node] of graph.nodes) {
    const label = options.includeMetadata 
      ? `${node.type}: ${node.title}<br/>${node.state}`
      : node.title;
    
    // Mermaid shape syntax based on type
    let nodeDefinition = '';
    const typeLower = node.type.toLowerCase();
    
    if (typeLower.includes('epic')) {
      nodeDefinition = `  ${id}[["${escapeMermaidLabel(label)}"]]`;
    } else if (typeLower.includes('feature')) {
      nodeDefinition = `  ${id}["${escapeMermaidLabel(label)}"]`;
    } else if (typeLower.includes('bug')) {
      nodeDefinition = `  ${id}{"${escapeMermaidLabel(label)}"}`;
    } else if (typeLower.includes('task')) {
      nodeDefinition = `  ${id}(("${escapeMermaidLabel(label)}"))`;
    } else {
      nodeDefinition = `  ${id}["${escapeMermaidLabel(label)}"]`;
    }
    
    lines.push(nodeDefinition);
  }
  
  lines.push('');
  
  // Add edges
  for (const edge of graph.edges) {
    // Only add edge if both nodes exist
    if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
      lines.push(`  ${edge.source} -->|${edge.label}| ${edge.target}`);
    }
  }
  
  // Add styling
  if (options.colorByState) {
    lines.push('');
    lines.push('%% Styling by state');
    
    const stateStyles = new Map<string, string>();
    stateStyles.set('new', 'fill:#87CEEB,stroke:#333,stroke-width:2px');
    stateStyles.set('active', 'fill:#FFD700,stroke:#333,stroke-width:2px');
    stateStyles.set('resolved', 'fill:#90EE90,stroke:#333,stroke-width:2px');
    stateStyles.set('removed', 'fill:#D3D3D3,stroke:#333,stroke-width:2px');
    
    for (const [id, node] of graph.nodes) {
      const stateLower = node.state.toLowerCase();
      for (const [state, style] of stateStyles) {
        if (stateLower.includes(state)) {
          lines.push(`  style ${id} ${style}`);
          break;
        }
      }
    }
  } else {
    // Color by type
    lines.push('');
    lines.push('%% Styling by type');
    
    for (const [id, node] of graph.nodes) {
      const color = getTypeColor(node.type);
      lines.push(`  style ${id} fill:${color},stroke:#333,stroke-width:2px`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Escape label for DOT format
 */
function escapeLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Escape label for Mermaid format
 */
function escapeMermaidLabel(label: string): string {
  return label
    .replace(/"/g, '#quot;')
    .replace(/\[/g, '#91;')
    .replace(/\]/g, '#93;')
    .replace(/\(/g, '#40;')
    .replace(/\)/g, '#41;');
}

/**
 * Generate rendering instructions based on format
 */
export function getRenderingInstructions(format: ExportFormat): string {
  if (format === 'dot') {
    return `
## Rendering DOT Files

### Option 1: Graphviz Command Line
\`\`\`bash
# Install Graphviz: https://graphviz.org/download/
# Render to PNG
dot -Tpng dependencies.dot -o dependencies.png

# Render to SVG
dot -Tsvg dependencies.dot -o dependencies.svg

# Render to PDF
dot -Tpdf dependencies.dot -o dependencies.pdf
\`\`\`

### Option 2: VS Code Extension
Install "Graphviz (dot) language support for Visual Studio Code" extension:
1. Open VS Code Extensions (Ctrl+Shift+X)
2. Search for "Graphviz Interactive Preview"
3. Open .dot file and use "Preview Graphviz / DOT" command

### Option 3: Online Viewers
- https://dreampuf.github.io/GraphvizOnline/
- https://edotor.net/
- https://viz-js.com/
`.trim();
  } else {
    return `
## Rendering Mermaid Diagrams

### Option 1: VS Code Built-in Support
VS Code has native Mermaid support:
1. Save the diagram in a .md file inside a \`\`\`mermaid code block
2. Use Markdown preview (Ctrl+Shift+V)
3. The diagram will render automatically

### Option 2: Mermaid Live Editor
- https://mermaid.live/
- Paste your diagram and export as PNG/SVG

### Option 3: GitHub/Azure DevOps
Both platforms support Mermaid diagrams natively in Markdown files.

### Option 4: Mermaid CLI
\`\`\`bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Render to PNG
mmdc -i dependencies.mmd -o dependencies.png

# Render to SVG
mmdc -i dependencies.mmd -o dependencies.svg
\`\`\`
`.trim();
  }
}
