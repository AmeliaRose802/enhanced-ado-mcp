/**
 * Visualization Service
 * 
 * Generates visual dependency graphs for work item relationships.
 * Supports DOT (Graphviz) and Mermaid diagram formats.
 */

import { logger } from '../utils/logger.js';
import type { ADOWorkItem, WorkItemRelation } from '../types/index.js';
import { createWorkItemRepository } from '../repositories/work-item.repository.js';
import { createADOHttpClient } from '../utils/ado-http-client.js';
import { getTokenProvider } from '../utils/token-provider.js';

export type RelationType = 'all' | 'parent-child' | 'blocks' | 'related' | 'depends-on';
export type ExportFormat = 'dot' | 'mermaid';
export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT';
export type TraversalDirection = 'both' | 'children-only' | 'parents-only';

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
  /** Traversal direction: 'both' includes parents and children, 'children-only' excludes parents/ancestors */
  traversalDirection?: TraversalDirection;
  /** Group nodes by work item type */
  groupByType?: boolean;
  /** Group nodes by parent Epic */
  groupByEpic?: boolean;
  /** Work item states to exclude */
  excludeStates?: string[];
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
  epicId?: number;
  epicTitle?: string;
  hierarchyRank: number; // Ranking for hierarchy: 1=Epic, 2=Feature, 3=Story/PBI, 4=Task/Bug
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
 * 
 * In Azure DevOps hierarchy relationships:
 * - Hierarchy-Reverse: Links from child to parent (child has parent)
 * - Hierarchy-Forward: Links from parent to child (parent has child)
 * 
 * We normalize these to represent the ARROW DIRECTION we want (parent → child)
 */
function normalizeRelationType(rel: string): string {
  // Hierarchy-Reverse means current item IS THE CHILD (links to parent)
  // We want arrows parent→child, so when we see Reverse, related item is the parent
  if (rel.includes('Hierarchy-Reverse')) return 'child-parent';
  
  // Hierarchy-Forward means current item IS THE PARENT (links to child)
  // We want arrows parent→child, so when we see Forward, related item is the child
  if (rel.includes('Hierarchy-Forward')) return 'parent-child';
  
  if (rel.includes('Dependency-Forward')) return 'depends-on';
  if (rel.includes('Dependency-Reverse')) return 'dependency-of';
  if (rel.includes('Related')) return 'related';
  if (rel.includes('Successor')) return 'successor';
  if (rel.includes('Predecessor')) return 'predecessor';
  return 'unknown';
}

/**
 * Get hierarchy rank for work item type (lower number = higher in hierarchy)
 * This ensures proper vertical ordering in diagrams
 */
function getHierarchyRank(type: string): number {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('epic')) return 1;
  if (typeLower.includes('feature')) return 2;
  if (typeLower.includes('story') || typeLower.includes('backlog') || typeLower.includes('pbi') || typeLower.includes('product backlog item')) return 3;
  if (typeLower.includes('task') || typeLower.includes('bug')) return 4;
  
  return 3; // Default to story level for unknown types
}

/**
 * Check if relation matches filter
 * Simplified to only show parent-child relationships for clarity
 */
function matchesRelationFilter(rel: string, filters: RelationType[]): boolean {
  const normalized = normalizeRelationType(rel);
  
  // Always show only parent-child relationships for maximum clarity
  // This prevents cluttered diagrams with multiple relationship lines
  return normalized === 'parent-child' || normalized === 'child-parent';
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
  const httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: []
  };
  
  const visited = new Set<number>();
  const edgeKeys = new Set<string>(); // Track edges to prevent duplicates
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
      // Fetch work item with relations using $expand=relations
      // Note: Azure DevOps API requires $expand parameter to include relations field
      const response = await httpClient.get<ADOWorkItem>(
        `wit/workitems/${id}?$expand=relations`
      );
      const workItem = response.data;
      const state = workItem.fields['System.State'] as string || '';
      
      // Skip excluded states
      const excludeStates = options.excludeStates || ['Removed', 'Cut'];
      if (excludeStates.some(excludeState => state.toLowerCase() === excludeState.toLowerCase())) {
        logger.debug(`[buildDependencyGraph] Skipping excluded state work item ${id}: ${state}`);
        continue;
      }
      
      // Track epic parent for groupByEpic mode
      let epicId: number | undefined;
      let epicTitle: string | undefined;
      
      if (options.groupByEpic && workItem.relations) {
        const parentRel = workItem.relations.find(r => 
          r.rel.includes('Hierarchy-Reverse')
        );
        if (parentRel) {
          const parentId = extractWorkItemId(parentRel.url);
          if (parentId) {
            // Check if parent is an Epic
            try {
              const parentResponse = await httpClient.get<ADOWorkItem>(`wit/workitems/${parentId}`);
              const parentType = (parentResponse.data.fields['System.WorkItemType'] as string || '').toLowerCase();
              if (parentType.includes('epic')) {
                epicId = parentId;
                epicTitle = parentResponse.data.fields['System.Title'] as string;
              }
            } catch (err) {
              logger.debug(`[buildDependencyGraph] Could not fetch parent ${parentId} for epic grouping`);
            }
          }
        }
      }
      
      // Add node
      const workItemType = workItem.fields['System.WorkItemType'] as string;
      graph.nodes.set(id, {
        id: workItem.id,
        title: workItem.fields['System.Title'] as string,
        type: workItemType,
        state: workItem.fields['System.State'] as string,
        url: workItem.url || `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`,
        epicId,
        epicTitle,
        hierarchyRank: getHierarchyRank(workItemType)
      });
      
      logger.debug(`[buildDependencyGraph] Work item ${id} has ${workItem.relations?.length ?? 0} relations`);
      
      // Process relations
      if (workItem.relations) {
        const traversalDirection = options.traversalDirection ?? 'both';
        
        for (const relation of workItem.relations) {
          if (!matchesRelationFilter(relation.rel, options.relationTypes)) {
            continue;
          }
          
          const relatedId = extractWorkItemId(relation.url);
          if (!relatedId) {
            continue;
          }
          
          const normalizedType = normalizeRelationType(relation.rel);
          
          // Determine edge source/target - arrows should point FROM parent TO child
          // In ADO: Hierarchy-Forward = "has child", Hierarchy-Reverse = "has parent"
          let edgeSource: number;
          let edgeTarget: number;
          let isParentLink = false; // Track if this is a link to a parent
          
          if (normalizedType === 'parent-child') {
            // Hierarchy-Forward: current item HAS a child
            // Current item is the PARENT, related item is the CHILD
            // Arrow: parent → child
            edgeSource = id;
            edgeTarget = relatedId;
            isParentLink = false; // This is a child link
          } else if (normalizedType === 'child-parent') {
            // Hierarchy-Reverse: current item HAS a parent
            // Current item is the CHILD, related item is the PARENT
            // Arrow: parent → child (so related → current)
            edgeSource = relatedId;
            edgeTarget = id;
            isParentLink = true; // This is a parent link
          } else {
            // Should not happen with simplified filter, but handle gracefully
            continue;
          }
          
          // Apply traversal direction filter
          if (traversalDirection === 'children-only' && isParentLink) {
            // Skip parent links when only traversing children
            continue;
          } else if (traversalDirection === 'parents-only' && !isParentLink) {
            // Skip child links when only traversing parents
            continue;
          }
          
          // Only add edge if not already present (prevent duplicates)
          // Use canonical form: lower ID -> higher ID for deduplication
          const canonicalKey = edgeSource < edgeTarget 
            ? `${edgeSource}->${edgeTarget}`
            : `${edgeTarget}<-${edgeSource}`;
          
          if (!edgeKeys.has(canonicalKey)) {
            edgeKeys.add(canonicalKey);
            graph.edges.push({
              source: edgeSource,
              target: edgeTarget,
              relationType: 'parent-child',
              label: '' // No label needed - parent-child is implicit
            });
          }
          
          // Queue related item if not visited (and respecting traversal direction)
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
 * Colors chosen for maximum readability with dark text on colored backgrounds
 * All colors tested for WCAG AA contrast ratio (4.5:1) with black text
 */
function getTypeColor(type: string): string {
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('epic')) return '#E9D5FF'; // Light lavender (high contrast with black text)
  if (typeLower.includes('feature')) return '#A7F3D0'; // Light mint green (excellent contrast)
  if (typeLower.includes('story') || typeLower.includes('backlog')) return '#BFDBFE'; // Light blue (maximum readability)
  if (typeLower.includes('task')) return '#FED7AA'; // Light peach/orange (high contrast)
  if (typeLower.includes('bug')) return '#FECACA'; // Light coral/red (high visibility)
  
  return '#E5E5E5'; // Light gray default
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
  if (typeLower.includes('bug')) return 'box'; // Use box instead of diamond to prevent oversizing
  
  return 'box';
}

/**
 * Export graph as Graphviz DOT format
 */
export function exportAsDot(graph: DependencyGraph, options: VisualizationOptions): string {
  const direction = options.layoutDirection || 'TB';
  const lines: string[] = [
    'digraph dependencies {',
    `  rankdir=${direction};`,
    '  node [fontname="Arial", fontsize=10];',
    '  edge [fontname="Arial", fontsize=8];',
    '  ranksep=1.0;', // Increase separation between ranks for clarity
    '  nodesep=0.5;', // Horizontal spacing between nodes
    ''
  ];
  
  // Group by epic if requested (takes precedence over groupByType)
  if (options.groupByEpic) {
    const epicGroups = new Map<string, number[]>();
    const noEpicGroup: number[] = [];
    
    for (const [id, node] of graph.nodes) {
      if (node.epicId && node.epicTitle) {
        const epicKey = `${node.epicId}_${node.epicTitle}`;
        if (!epicGroups.has(epicKey)) {
          epicGroups.set(epicKey, []);
        }
        epicGroups.get(epicKey)!.push(id);
      } else {
        noEpicGroup.push(id);
      }
    }
    
    // Render epic groups
    for (const [epicKey, ids] of epicGroups) {
      const [epicId, ...epicTitleParts] = epicKey.split('_');
      const epicTitle = epicTitleParts.join('_');
      
      lines.push(`  subgraph cluster_epic_${epicId} {`);
      lines.push(`    label="Epic: ${escapeLabel(epicTitle)}";
    style=filled;`);
      lines.push(`    color="#C084FC";`);
      lines.push(`    fillcolor="#F3E8FF";`);
      
      for (const id of ids) {
        const node = graph.nodes.get(id)!;
        const label = options.includeMetadata 
          ? `[${id}] ${node.type}: ${node.title}\\n${node.state}`
          : `[${id}] ${node.title}`;
        
        const shape = getTypeShape(node.type);
        const color = options.colorByState ? getStateColor(node.state) : getTypeColor(node.type);
        
        lines.push(`    "${id}" [label="${escapeLabel(label)}", shape=${shape}, style=filled, fillcolor="${color}"];`);
      }
      
      lines.push('  }');
      lines.push('');
    }
    
    // Render items without epic
    if (noEpicGroup.length > 0) {
      lines.push(`  subgraph cluster_no_epic {`);
      lines.push(`    label="No Epic";
    style=filled;`);
      lines.push(`    color=lightgrey;`);
      
      for (const id of noEpicGroup) {
        const node = graph.nodes.get(id)!;
        const label = options.includeMetadata 
          ? `[${id}] ${node.type}: ${node.title}\\n${node.state}`
          : `[${id}] ${node.title}`;
        
        const shape = getTypeShape(node.type);
        const color = options.colorByState ? getStateColor(node.state) : getTypeColor(node.type);
        
        lines.push(`    "${id}" [label="${escapeLabel(label)}", shape=${shape}, style=filled, fillcolor="${color}"];`);
      }
      
      lines.push('  }');
      lines.push('');
    }
  } else if (options.groupByType) {
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
          ? `[${id}] ${node.type}: ${node.title}\\n${node.state}`
          : `[${id}] ${node.title}`;
        
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
        ? `[${id}] ${node.type}: ${node.title}\\n${node.state}`
        : `[${id}] ${node.title}`;
      
      const shape = getTypeShape(node.type);
      const color = options.colorByState ? getStateColor(node.state) : getTypeColor(node.type);
      
      lines.push(`  "${id}" [label="${escapeLabel(label)}", shape=${shape}, style=filled, fillcolor="${color}"];`);
    }
    lines.push('');
  }
  
  // Add rank constraints to enforce hierarchy (only in TB/BT layouts)
  if (direction === 'TB' || direction === 'BT') {
    const rankGroups = new Map<number, number[]>();
    
    // Group nodes by hierarchy rank
    for (const [id, node] of graph.nodes) {
      const rank = node.hierarchyRank;
      if (!rankGroups.has(rank)) {
        rankGroups.set(rank, []);
      }
      rankGroups.get(rank)!.push(id);
    }
    
    // Output same-rank groups to enforce proper hierarchy levels
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
    
    for (const rank of sortedRanks) {
      const nodeIds = rankGroups.get(rank)!;
      if (nodeIds.length > 1) {
        // Multiple nodes at same level - declare them as same rank
        lines.push(`  { rank=same; ${nodeIds.map(id => `"${id}"`).join('; ')}; }`);
      }
    }
    
    lines.push('');
  }
  
  // Add edges (parent-child relationships only, no labels for clarity)
  for (const edge of graph.edges) {
    // Only add edge if both nodes exist
    if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
      lines.push(`  "${edge.source}" -> "${edge.target}";`);
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Export graph as Mermaid diagram
 */
export function exportAsMermaid(graph: DependencyGraph, options: VisualizationOptions): string {
  const direction = options.layoutDirection || 'TB';
  const lines: string[] = [
    `graph ${direction}`
  ];
  
  // Sort nodes by hierarchy rank (Epic -> Feature -> Story -> Task/Bug)
  // This helps Mermaid render in the correct order
  const sortedNodes = Array.from(graph.nodes.entries())
    .sort((a, b) => a[1].hierarchyRank - b[1].hierarchyRank);
  
  // Add nodes in hierarchy order
  for (const [id, node] of sortedNodes) {
    const label = options.includeMetadata 
      ? `[${id}] ${node.type}: ${node.title}<br/>${node.state}`
      : `[${id}] ${node.title}`;
    
    // Mermaid shape syntax based on type
    let nodeDefinition = '';
    const typeLower = node.type.toLowerCase();
    
    if (typeLower.includes('epic')) {
      nodeDefinition = `  ${id}[["${escapeMermaidLabel(label)}"]]`;
    } else if (typeLower.includes('feature')) {
      nodeDefinition = `  ${id}["${escapeMermaidLabel(label)}"]`;
    } else if (typeLower.includes('bug')) {
      nodeDefinition = `  ${id}["${escapeMermaidLabel(label)}"]`; // Use box instead of diamond
    } else if (typeLower.includes('task')) {
      nodeDefinition = `  ${id}(("${escapeMermaidLabel(label)}"))`;
    } else {
      nodeDefinition = `  ${id}["${escapeMermaidLabel(label)}"]`;
    }
    
    lines.push(nodeDefinition);
  }
  
  lines.push('');
  
  // Add edges (parent-child relationships only, no labels for clarity)
  for (const edge of graph.edges) {
    // Only add edge if both nodes exist
    if (graph.nodes.has(edge.source) && graph.nodes.has(edge.target)) {
      lines.push(`  ${edge.source} --> ${edge.target}`);
    }
  }
  
  // Add styling
  lines.push('');
  lines.push('%% Styling');
  
  if (options.colorByState) {
    // Define state-based style classes
    lines.push('  classDef stateNew fill:#87CEEB,stroke:#1E3A8A,stroke-width:3px,color:#000');
    lines.push('  classDef stateActive fill:#FFD700,stroke:#92400E,stroke-width:3px,color:#000');
    lines.push('  classDef stateResolved fill:#90EE90,stroke:#166534,stroke-width:3px,color:#000');
    lines.push('  classDef stateRemoved fill:#D3D3D3,stroke:#374151,stroke-width:3px,color:#000');
    lines.push('');
    
    // Apply state-based classes
    for (const [id, node] of graph.nodes) {
      const stateLower = node.state.toLowerCase();
      if (stateLower === 'new' || stateLower === 'proposed') {
        lines.push(`  class ${id} stateNew`);
      } else if (stateLower === 'active' || stateLower.includes('progress') || stateLower === 'committed') {
        lines.push(`  class ${id} stateActive`);
      } else if (stateLower === 'resolved' || stateLower === 'done' || stateLower === 'closed') {
        lines.push(`  class ${id} stateResolved`);
      } else if (stateLower === 'removed' || stateLower === 'cut') {
        lines.push(`  class ${id} stateRemoved`);
      }
    }
  } else {
    // Define type-based style classes with more vibrant colors
    lines.push('  classDef typeEpic fill:#C084FC,stroke:#6B21A8,stroke-width:3px,color:#000');
    lines.push('  classDef typeFeature fill:#34D399,stroke:#065F46,stroke-width:3px,color:#000');
    lines.push('  classDef typeStory fill:#60A5FA,stroke:#1E40AF,stroke-width:3px,color:#000');
    lines.push('  classDef typeTask fill:#FB923C,stroke:#9A3412,stroke-width:3px,color:#000');
    lines.push('  classDef typeBug fill:#F87171,stroke:#991B1B,stroke-width:3px,color:#000');
    lines.push('  classDef typeDefault fill:#E5E7EB,stroke:#374151,stroke-width:3px,color:#000');
    lines.push('');
    
    // Apply type-based classes
    for (const [id, node] of graph.nodes) {
      const typeLower = node.type.toLowerCase();
      if (typeLower.includes('epic')) {
        lines.push(`  class ${id} typeEpic`);
      } else if (typeLower.includes('feature')) {
        lines.push(`  class ${id} typeFeature`);
      } else if (typeLower.includes('story') || typeLower.includes('backlog') || typeLower.includes('pbi')) {
        lines.push(`  class ${id} typeStory`);
      } else if (typeLower.includes('task')) {
        lines.push(`  class ${id} typeTask`);
      } else if (typeLower.includes('bug')) {
        lines.push(`  class ${id} typeBug`);
      } else {
        lines.push(`  class ${id} typeDefault`);
      }
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
