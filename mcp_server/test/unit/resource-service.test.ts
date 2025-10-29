/**
 * Resource Service Test
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { listResources, getResourceContent, resourceExists } from '../../src/services/resource-service';

describe('Resource Service', () => {
  describe('listResources', () => {
    it('should return all available resources', () => {
      const resources = listResources();
      
      expect(resources).toBeDefined();
      expect(resources.length).toBeGreaterThan(0);
      
      // Check that all resources have required properties
      resources.forEach(resource => {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBe('text/markdown');
      });
    });

    it('should include WIQL quick reference', () => {
      const resources = listResources();
      const wiqlResource = resources.find(r => r.uri === 'ado://docs/wiql-quick-reference');
      
      expect(wiqlResource).toBeDefined();
      expect(wiqlResource?.name).toContain('WIQL');
    });

    it('should include OData quick reference', () => {
      const resources = listResources();
      const odataResource = resources.find(r => r.uri === 'ado://docs/odata-quick-reference');
      
      expect(odataResource).toBeDefined();
      expect(odataResource?.name).toContain('OData');
    });

    it('should include hierarchy patterns', () => {
      const resources = listResources();
      const hierarchyResource = resources.find(r => r.uri === 'ado://docs/hierarchy-patterns');
      
      expect(hierarchyResource).toBeDefined();
      expect(hierarchyResource?.name).toContain('Hierarchy');
    });

    it('should include common workflows', () => {
      const resources = listResources();
      const workflowResource = resources.find(r => r.uri === 'ado://docs/common-workflows');
      
      expect(workflowResource).toBeDefined();
      expect(workflowResource?.name).toContain('Workflow');
    });

    it('should include tool selection guide', () => {
      const resources = listResources();
      const toolGuide = resources.find(r => r.uri === 'ado://docs/tool-selection-guide');
      
      expect(toolGuide).toBeDefined();
      expect(toolGuide?.name).toContain('Tool Selection');
    });
  });

  describe('resourceExists', () => {
    it('should return true for existing resources', () => {
      expect(resourceExists('ado://docs/wiql-quick-reference')).toBe(true);
      expect(resourceExists('ado://docs/odata-quick-reference')).toBe(true);
      expect(resourceExists('ado://docs/hierarchy-patterns')).toBe(true);
      expect(resourceExists('ado://docs/common-workflows')).toBe(true);
      expect(resourceExists('ado://docs/tool-selection-guide')).toBe(true);
    });

    it('should return false for non-existing resources', () => {
      expect(resourceExists('ado://docs/non-existent')).toBe(false);
      expect(resourceExists('invalid-uri')).toBe(false);
    });
  });

  describe('getResourceContent', () => {
    it('should throw error for non-existent resource', async () => {
      await expect(getResourceContent('ado://docs/non-existent'))
        .rejects.toThrow('Resource not found');
    });

    it('should return content for WIQL quick reference', async () => {
      const content = await getResourceContent('ado://docs/wiql-quick-reference');
      
      expect(content).toBeDefined();
      expect(content.uri).toBe('ado://docs/wiql-quick-reference');
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toBeDefined();
      expect(content.text).toContain('WIQL');
      expect(content.text).toContain('SELECT');
    });

    it('should return content for OData quick reference', async () => {
      const content = await getResourceContent('ado://docs/odata-quick-reference');
      
      expect(content).toBeDefined();
      expect(content.uri).toBe('ado://docs/odata-quick-reference');
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toBeDefined();
      expect(content.text).toContain('OData');
      expect(content.text).toContain('queryType');
    });

    it('should return content for hierarchy patterns', async () => {
      const content = await getResourceContent('ado://docs/hierarchy-patterns');
      
      expect(content).toBeDefined();
      expect(content.uri).toBe('ado://docs/hierarchy-patterns');
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toBeDefined();
      expect(content.text).toContain('hierarchy');
      expect(content.text).toContain('parent');
    });

    it('should return content for common workflows', async () => {
      const content = await getResourceContent('ado://docs/common-workflows');
      
      expect(content).toBeDefined();
      expect(content.uri).toBe('ado://docs/common-workflows');
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toBeDefined();
      expect(content.text).toContain('Workflow');
      expect(content.text).toContain('Step');
    });

    it('should return content for tool selection guide', async () => {
      const content = await getResourceContent('ado://docs/tool-selection-guide');
      
      expect(content).toBeDefined();
      expect(content.uri).toBe('ado://docs/tool-selection-guide');
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toBeDefined();
      expect(content.text).toContain('Tool');
      expect(content.text).toContain('wit-');
    });

    it('WIQL reference should contain essential query patterns', async () => {
      const content = await getResourceContent('ado://docs/wiql-quick-reference');
      
      expect(content.text).toContain('WHERE [System.Parent]');
      expect(content.text).toContain('ORDER BY');
      expect(content.text).toContain('WorkItemLinks');
      expect(content.text).toContain('AreaPath');
    });

    it('OData reference should contain query types', async () => {
      const content = await getResourceContent('ado://docs/odata-quick-reference');
      
      expect(content.text).toContain('workItemCount');
      expect(content.text).toContain('groupByState');
      expect(content.text).toContain('velocityMetrics');
      expect(content.text).toContain('cycleTimeMetrics');
    });

    it('tool selection guide should list all major tools', async () => {
      const content = await getResourceContent('ado://docs/tool-selection-guide');
      
      // Check for current tool names (tools have been updated/renamed)
      expect(content.text).toContain('wit-get-work-items-by-query-wiql');
      expect(content.text).toContain('wit-query-analytics-odata');
      expect(content.text).toContain('wit-create-new-item');
      expect(content.text).toContain('wit-ai-assignment-analyzer');
      expect(content.text).toContain('wit-validate-hierarchy');
    });
  });
});

