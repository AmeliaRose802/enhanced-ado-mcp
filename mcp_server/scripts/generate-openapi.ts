#!/usr/bin/env tsx
/**
 * OpenAPI 3.0 Generation Script
 * 
 * Generates OpenAPI specification from Zod schemas for all MCP tools.
 * This provides automatic API documentation that stays synchronized with code.
 * 
 * Usage:
 *   npm run generate-openapi
 * 
 * Output:
 *   docs/api/openapi.json - OpenAPI 3.0 specification
 *   docs/api/schemas/ - Individual JSON schemas for each tool
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Import tool configs (which includes pre-built inputSchemas)
import { toolConfigs } from '../src/config/tool-configs/index.js';

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Extend Zod with OpenAPI metadata support
// extendZodWithOpenApi(z); // Not needed since we're using toolConfigs directly

/**
 * Schema metadata for better documentation - maps schema names to categories
 */
const schemaCategories: Record<string, { title: string; category: string; aiPowered?: boolean }> = {
  createNewItemSchema: { title: 'Create Work Item', category: 'Work Item Operations' },
  assignToCopilotSchema: { title: 'Assign to Copilot', category: 'Copilot Integration' },
  newCopilotItemSchema: { title: 'Create Copilot Work Item', category: 'Copilot Integration' },
  extractSecurityLinksSchema: { title: 'Extract Security Links', category: 'Security Analysis' },
  workItemIntelligenceSchema: { title: 'Work Item Intelligence', category: 'AI-Powered Analysis', aiPowered: true },
  aiAssignmentAnalyzerSchema: { title: 'AI Assignment Analyzer', category: 'AI-Powered Analysis', aiPowered: true },
  getConfigurationSchema: { title: 'Get Configuration', category: 'Configuration' },
  wiqlQuerySchema: { title: 'WIQL Query', category: 'Queries' },
  odataAnalyticsQuerySchema: { title: 'OData Analytics Query', category: 'Queries' },
  selectItemsFromQueryHandleSchema: { title: 'Select Items from Query Handle', category: 'Query Handles' },
  workItemContextPackageSchema: { title: 'Get Work Item Context Package', category: 'Context Retrieval' },
  getLastSubstantiveChangeSchema: { title: 'Get Last Substantive Change', category: 'Work Item Operations' },
  validateHierarchyFastSchema: { title: 'Validate Hierarchy', category: 'Validation' },
  bulkCommentByQueryHandleSchema: { title: 'Bulk Add Comments', category: 'Bulk Operations' },
  bulkUpdateByQueryHandleSchema: { title: 'Bulk Update Work Items', category: 'Bulk Operations' },
  bulkAssignByQueryHandleSchema: { title: 'Bulk Assign Work Items', category: 'Bulk Operations' },
  bulkRemoveByQueryHandleSchema: { title: 'Bulk Remove Work Items', category: 'Bulk Operations' },
  analyzeByQueryHandleSchema: { title: 'Analyze by Query Handle', category: 'AI-Powered Analysis', aiPowered: true },
  listQueryHandlesSchema: { title: 'List Query Handles', category: 'Query Handles' },
  bulkEnhanceDescriptionsByQueryHandleSchema: { title: 'Bulk Enhance Descriptions', category: 'Bulk Operations', aiPowered: true },
  bulkAssignStoryPointsByQueryHandleSchema: { title: 'Bulk Assign Story Points', category: 'Bulk Operations', aiPowered: true },
  bulkAddAcceptanceCriteriaByQueryHandleSchema: { title: 'Bulk Add Acceptance Criteria', category: 'Bulk Operations', aiPowered: true },
  generateWiqlQuerySchema: { title: 'Generate WIQL Query', category: 'AI-Powered Query Generation', aiPowered: true },
  generateODataQuerySchema: { title: 'Generate OData Query', category: 'AI-Powered Query Generation', aiPowered: true },
  toolDiscoverySchema: { title: 'Tool Discovery', category: 'Discovery' },
  personalWorkloadAnalyzerSchema: { title: 'Personal Workload Analyzer', category: 'AI-Powered Analysis', aiPowered: true },
  sprintPlanningAnalyzerSchema: { title: 'Sprint Planning Analyzer', category: 'AI-Powered Analysis', aiPowered: true }
};

/**
 * Determine category and AI-powered status from tool description
 */
function getToolMetadata(tool: typeof toolConfigs[0]): { category: string; isAIPowered: boolean } {
  const desc = tool.description.toLowerCase();
  const isAIPowered = tool.description.includes('🤖 AI-POWERED');

  if (desc.includes('query handle') || tool.name.includes('query-handle')) {
    return { category: 'Query Handles', isAIPowered };
  } else if (desc.includes('bulk') && (desc.includes('update') || desc.includes('assign') || desc.includes('comment'))) {
    return { category: 'Bulk Operations', isAIPowered };
  } else if (isAIPowered && (desc.includes('generate') || desc.includes('wiql') || desc.includes('odata'))) {
    return { category: 'AI-Powered Query Generation', isAIPowered: true };
  } else if (isAIPowered || desc.includes('analyz') || desc.includes('intelligence')) {
    return { category: 'AI-Powered Analysis', isAIPowered: true };
  } else if (desc.includes('context') || desc.includes('batch')) {
    return { category: 'Context Retrieval', isAIPowered };
  } else if (desc.includes('copilot')) {
    return { category: 'Copilot Integration', isAIPowered };
  } else if (desc.includes('security')) {
    return { category: 'Security Analysis', isAIPowered };
  } else if (desc.includes('configuration') || tool.name.includes('config')) {
    return { category: 'Configuration', isAIPowered };
  } else if (desc.includes('discovery') || tool.name.includes('discovery')) {
    return { category: 'Discovery', isAIPowered };
  } else if (desc.includes('validate')) {
    return { category: 'Validation', isAIPowered };
  } else if (desc.includes('query') || desc.includes('wiql') || desc.includes('odata')) {
    return { category: 'Queries', isAIPowered };
  } else {
    return { category: 'Work Item Operations', isAIPowered };
  }
}

/**
 * Generate complete OpenAPI specification
 */
function generateOpenAPISpec(): any {

  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Enhanced ADO MCP Server API',
      version: '1.5.0',
      description: `
# Enhanced Azure DevOps MCP Server

AI-powered Azure DevOps work item management via Model Context Protocol.

## Features

- **Work Item Operations**: Create, update, and manage Azure DevOps work items
- **AI-Powered Analysis**: Intelligent work item analysis, decomposition, and enhancement
- **Query Generation**: Natural language to WIQL/OData query conversion
- **Bulk Operations**: Safe bulk updates using query handle pattern
- **Security Analysis**: Extract and analyze security findings
- **Sprint Planning**: AI-powered sprint planning and analysis
- **Context Retrieval**: Comprehensive work item context packages

## Authentication

This server uses Azure CLI authentication. Run \`az login\` before using any tools.

## Tool Categories

### Work Item Operations
Basic CRUD operations for Azure DevOps work items.

### AI-Powered Analysis
Tools that use LLM sampling for intelligent analysis and recommendations.
These require VS Code Language Model API access.

### Query Generation
Convert natural language descriptions to WIQL or OData queries with validation.

### Bulk Operations
Safe bulk updates using the query handle pattern to prevent ID hallucination.

### Query Handles
Manage query handles for safe bulk operations.

## Configuration

Tools automatically use configuration from \`.ado-mcp-config.json\` for:
- organization
- project
- areaPath
- iterationPath
- defaultWorkItemType
- defaultAssignedTo
- defaultPriority

Only provide these parameters to override defaults.
      `.trim(),
      contact: {
        name: 'Amelia Payne',
        url: 'https://github.com/AmeliaRose802'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'mcp://enhanced-ado-mcp',
        description: 'MCP Server'
      }
    ],
    tags: [
      { name: 'Work Item Operations', description: 'Basic CRUD operations for work items' },
      { name: 'AI-Powered Analysis', description: 'Intelligent analysis using LLM sampling' },
      { name: 'Query Generation', description: 'Natural language to WIQL/OData conversion' },
      { name: 'Bulk Operations', description: 'Safe bulk updates using query handles' },
      { name: 'Query Handles', description: 'Query handle management' },
      { name: 'Context Retrieval', description: 'Comprehensive work item context' },
      { name: 'Copilot Integration', description: 'GitHub Copilot integration' },
      { name: 'Security Analysis', description: 'Security findings extraction' },
      { name: 'Configuration', description: 'Server configuration' },
      { name: 'Discovery', description: 'Tool and resource discovery' },
      { name: 'Validation', description: 'Data validation tools' },
      { name: 'Queries', description: 'WIQL and OData queries' }
    ]
  };

  // Add paths for each tool from tool-configs
  spec.paths = {};
  toolConfigs.forEach((tool) => {
    const pathName = `/tools/${tool.name}`;
    const { category, isAIPowered } = getToolMetadata(tool);

    spec.paths[pathName] = {
      post: {
        summary: tool.name,
        description: tool.description,
        operationId: tool.name.replace(/-/g, '_'),
        tags: [category],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: tool.inputSchema
            }
          }
        },
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { 
                      type: 'object',
                      description: 'Result data (structure varies by tool)'
                    },
                    metadata: {
                      type: 'object',
                      description: 'Operation metadata'
                    },
                    errors: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Error messages if any'
                    },
                    warnings: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Warning messages if any'
                    }
                  },
                  required: ['success', 'errors', 'warnings']
                }
              }
            }
          },
          '400': {
            description: 'Invalid input parameters',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    errors: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    errors: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        'x-ai-powered': isAIPowered
      }
    };
  });

  return spec;
}

/**
 * Generate individual JSON schemas for each tool's input schema
 */
async function generateIndividualSchemas(outputDir: string): Promise<void> {
  const schemasDir = join(outputDir, 'schemas');
  await mkdir(schemasDir, { recursive: true });

  const schemaFiles: string[] = [];

  for (const tool of toolConfigs) {
    const { category, isAIPowered } = getToolMetadata(tool);
    
    // Create enhanced schema with metadata
    const enhancedSchema = {
      ...tool.inputSchema,
      $id: `#/components/schemas/${tool.name}`,
      title: tool.name,
      description: tool.description,
      category,
      aiPowered: isAIPowered
    };

    const filename = `${tool.name}.json`;
    const filepath = join(schemasDir, filename);
    await writeFile(filepath, JSON.stringify(enhancedSchema, null, 2));
    schemaFiles.push(filename);
    console.log(`✓ Generated schema: ${filename}`);
  }

  // Create index file
  const indexPath = join(schemasDir, 'index.json');
  await writeFile(indexPath, JSON.stringify({
    schemas: schemaFiles,
    generated: new Date().toISOString(),
    version: '1.5.0'
  }, null, 2));
  console.log(`✓ Generated schema index: index.json`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🚀 Generating OpenAPI specification...\n');

  try {
    // Create output directory
    const outputDir = join(projectRoot, 'docs', 'api');
    await mkdir(outputDir, { recursive: true });

    // Generate OpenAPI spec
    console.log('📝 Generating OpenAPI 3.0 specification...');
    const spec = generateOpenAPISpec();

    // Write OpenAPI spec
    const openapiPath = join(outputDir, 'openapi.json');
    await writeFile(openapiPath, JSON.stringify(spec, null, 2));
    console.log(`✓ Generated OpenAPI spec: ${openapiPath}\n`);

    // Generate individual schemas
    console.log('📦 Generating individual JSON schemas...');
    await generateIndividualSchemas(outputDir);

    // Summary
    console.log('\n✅ OpenAPI generation complete!');
    console.log(`\nGenerated files:`);
    console.log(`  - docs/api/openapi.json (${Object.keys(spec.paths || {}).length} endpoints)`);
    console.log(`  - docs/api/schemas/*.json (${toolConfigs.length} schemas)`);
    console.log(`\nYou can now use these files to:`);
    console.log(`  - Generate API clients`);
    console.log(`  - Create API documentation`);
    console.log(`  - Validate requests/responses`);
    console.log(`  - Import into tools like Swagger UI, Postman, etc.`);

  } catch (error) {
    console.error('❌ Error generating OpenAPI specification:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
