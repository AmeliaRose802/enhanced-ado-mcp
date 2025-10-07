/**
 * Test for OpenAPI generation script
 * 
 * Verifies that the OpenAPI generation produces valid output
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('OpenAPI Generation', () => {
  let openapiSpec: any;
  let schemaIndex: any;

  beforeAll(() => {
    // Load generated files
    const openapiPath = join(__dirname, '../../docs/api/openapi.json');
    const indexPath = join(__dirname, '../../docs/api/schemas/index.json');

    const openapiContent = readFileSync(openapiPath, 'utf-8');
    const indexContent = readFileSync(indexPath, 'utf-8');

    openapiSpec = JSON.parse(openapiContent);
    schemaIndex = JSON.parse(indexContent);
  });

  describe('OpenAPI Specification', () => {
    it('should have OpenAPI 3.0.0 format', () => {
      expect(openapiSpec.openapi).toBe('3.0.0');
    });

    it('should have info section with title and version', () => {
      expect(openapiSpec.info).toBeDefined();
      expect(openapiSpec.info.title).toBe('Enhanced ADO MCP Server API');
      expect(openapiSpec.info.version).toBeDefined();
      expect(openapiSpec.info.description).toBeDefined();
    });

    it('should have contact information', () => {
      expect(openapiSpec.info.contact).toBeDefined();
      expect(openapiSpec.info.contact.name).toBe('Amelia Payne');
      expect(openapiSpec.info.contact.url).toBe('https://github.com/AmeliaRose802');
    });

    it('should have MIT license', () => {
      expect(openapiSpec.info.license).toBeDefined();
      expect(openapiSpec.info.license.name).toBe('MIT');
    });

    it('should have servers defined', () => {
      expect(openapiSpec.servers).toBeDefined();
      expect(Array.isArray(openapiSpec.servers)).toBe(true);
      expect(openapiSpec.servers.length).toBeGreaterThan(0);
    });

    it('should have tags for categorization', () => {
      expect(openapiSpec.tags).toBeDefined();
      expect(Array.isArray(openapiSpec.tags)).toBe(true);
      expect(openapiSpec.tags.length).toBeGreaterThan(0);

      // Check for key categories
      const tagNames = openapiSpec.tags.map((t: any) => t.name);
      expect(tagNames).toContain('Work Item Operations');
      expect(tagNames).toContain('AI-Powered Analysis');
      expect(tagNames).toContain('Bulk Operations');
      expect(tagNames).toContain('Query Handles');
    });

    it('should have paths for tools', () => {
      expect(openapiSpec.paths).toBeDefined();
      expect(Object.keys(openapiSpec.paths).length).toBeGreaterThan(0);
    });

    it('should have properly formatted tool paths', () => {
      const paths = Object.keys(openapiSpec.paths);
      
      // All paths should start with /tools/
      paths.forEach(path => {
        expect(path).toMatch(/^\/tools\//);
      });

      // Check for specific known tools
      expect(paths).toContain('/tools/wit-create-new-item');
      expect(paths).toContain('/tools/wit-generate-wiql-query');
    });

    it('should have POST operations for all tools', () => {
      Object.values(openapiSpec.paths).forEach((pathItem: any) => {
        expect(pathItem.post).toBeDefined();
        expect(pathItem.post.summary).toBeDefined();
        expect(pathItem.post.description).toBeDefined();
        expect(pathItem.post.operationId).toBeDefined();
        expect(pathItem.post.tags).toBeDefined();
      });
    });

    it('should have request body schemas', () => {
      Object.values(openapiSpec.paths).forEach((pathItem: any) => {
        expect(pathItem.post.requestBody).toBeDefined();
        expect(pathItem.post.requestBody.required).toBe(true);
        expect(pathItem.post.requestBody.content).toBeDefined();
        expect(pathItem.post.requestBody.content['application/json']).toBeDefined();
        expect(pathItem.post.requestBody.content['application/json'].schema).toBeDefined();
      });
    });

    it('should have response schemas', () => {
      Object.values(openapiSpec.paths).forEach((pathItem: any) => {
        expect(pathItem.post.responses).toBeDefined();
        expect(pathItem.post.responses['200']).toBeDefined();
        expect(pathItem.post.responses['400']).toBeDefined();
        expect(pathItem.post.responses['500']).toBeDefined();
      });
    });

    it('should mark AI-powered tools correctly', () => {
      const aiPoweredTools = Object.entries(openapiSpec.paths)
        .filter(([_, pathItem]: [string, any]) => pathItem.post['x-ai-powered'] === true);

      expect(aiPoweredTools.length).toBeGreaterThan(0);

      // Check for known AI-powered tools
      const aiToolPaths = aiPoweredTools.map(([path, _]) => path);
      expect(aiToolPaths).toContain('/tools/wit-generate-wiql-query');
      // wit-ai-assignment-analyzer might not be marked as AI-powered in description
      // so just check for query generation tools
    });
  });

  describe('Individual Schemas', () => {
    it('should have schema index', () => {
      expect(schemaIndex.schemas).toBeDefined();
      expect(Array.isArray(schemaIndex.schemas)).toBe(true);
      expect(schemaIndex.schemas.length).toBeGreaterThan(0);
    });

    it('should have generation metadata', () => {
      expect(schemaIndex.generated).toBeDefined();
      expect(schemaIndex.version).toBeDefined();
    });

    it('should have schema files for all tools', () => {
      // Should have at least 30 tools
      expect(schemaIndex.schemas.length).toBeGreaterThanOrEqual(30);

      // Check for known schemas
      expect(schemaIndex.schemas).toContain('wit-create-new-item.json');
      expect(schemaIndex.schemas).toContain('wit-generate-wiql-query.json');
    });
  });

  describe('Schema Consistency', () => {
    it('should have matching number of paths and schemas', () => {
      const pathCount = Object.keys(openapiSpec.paths).length;
      const toolSchemaCount = schemaIndex.schemas.length; // Number of tool schemas (not including index.json itself)

      // Should have same number of paths as tool schemas
      expect(pathCount).toBe(toolSchemaCount);
    });

    it('should have consistent tool names', () => {
      const pathToolNames = Object.keys(openapiSpec.paths)
        .map(path => path.replace('/tools/', ''));

      const schemaToolNames = schemaIndex.schemas
        .filter((s: string) => s !== 'index.json')
        .map((s: string) => s.replace('.json', ''));

      pathToolNames.forEach(toolName => {
        expect(schemaToolNames).toContain(toolName);
      });
    });
  });
});
