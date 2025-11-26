/**
 * Template Service
 * 
 * Manages work item templates for common patterns (bug reports, feature requests, etc.)
 * Templates are stored in .ado/templates/ directory and can pre-fill fields,
 * acceptance criteria, tags, and structure.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, parse } from "path";
import { logger } from "../utils/logger.js";
import YAML from 'yaml';
import { z } from 'zod';

/**
 * Template field mapping
 */
export interface TemplateField {
  [fieldPath: string]: string | number | boolean;
}

/**
 * Work item template definition
 */
export interface WorkItemTemplate {
  name: string;
  title: string;
  type: string;
  description?: string;
  tags?: string[];
  priority?: number;
  fields?: TemplateField;
  variables?: Record<string, string>;
  metadata?: {
    category?: string;
    description?: string;
    author?: string;
    version?: string;
  };
}

/**
 * Template validation schema
 */
const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  title: z.string().min(1, "Template title is required"),
  type: z.string().min(1, "Work item type is required"),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  variables: z.record(z.string(), z.string()).optional(),
  metadata: z.object({
    category: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    version: z.string().optional()
  }).optional()
});

/**
 * Template service class
 */
export class TemplateService {
  private templateCache: Map<string, WorkItemTemplate> = new Map();
  private cacheInitialized = false;

  /**
   * Get templates directory path
   */
  private getTemplatesDir(): string {
    // Default to .ado/templates in current working directory
    return join(process.cwd(), '.ado', 'templates');
  }

  /**
   * Load all templates from .ado/templates/ directory
   */
  async loadTemplates(): Promise<WorkItemTemplate[]> {
    if (this.cacheInitialized) {
      return Array.from(this.templateCache.values());
    }

    const templatesDir = this.getTemplatesDir();
    
    try {
      const dirStat = await stat(templatesDir);
      if (!dirStat.isDirectory()) {
        logger.debug(`Templates directory not found: ${templatesDir}`);
        return [];
      }
    } catch (error) {
      logger.debug(`Templates directory not found: ${templatesDir}`);
      return [];
    }

    try {
      const files = await readdir(templatesDir);
      const templateFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      
      logger.debug(`Found ${templateFiles.length} template files in ${templatesDir}`);

      const templates: WorkItemTemplate[] = [];
      
      for (const file of templateFiles) {
        try {
          const filePath = join(templatesDir, file);
          const template = await this.loadTemplateFile(filePath);
          
          if (template) {
            templates.push(template);
            this.templateCache.set(template.name, template);
          }
        } catch (error) {
          logger.warn(`Failed to load template ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      this.cacheInitialized = true;
      logger.debug(`Loaded ${templates.length} valid templates`);
      
      return templates;
    } catch (error) {
      logger.error(`Error loading templates: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Load a single template file
   */
  private async loadTemplateFile(filePath: string): Promise<WorkItemTemplate | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = YAML.parse(content);
      
      // Validate template structure
      const validation = templateSchema.safeParse(parsed);
      
      if (!validation.success) {
        logger.warn(`Template validation failed for ${filePath}: ${validation.error.message}`);
        return null;
      }

      return validation.data as WorkItemTemplate;
    } catch (error) {
      logger.error(`Error parsing template file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(name: string): Promise<WorkItemTemplate | null> {
    // Ensure templates are loaded
    if (!this.cacheInitialized) {
      await this.loadTemplates();
    }

    return this.templateCache.get(name) || null;
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<WorkItemTemplate[]> {
    return await this.loadTemplates();
  }

  /**
   * Apply variable substitution to template content
   * Supports {variable} syntax in strings
   */
  applyVariableSubstitution(content: string, variables: Record<string, string>): string {
    let result = content;
    
    // Apply user-provided variables
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(pattern, value);
    }

    // Apply default date variables
    const now = new Date();
    result = result.replace(/\{date\}/g, now.toISOString().split('T')[0]);
    result = result.replace(/\{datetime\}/g, now.toISOString());
    result = result.replace(/\{year\}/g, String(now.getFullYear()));
    result = result.replace(/\{month\}/g, String(now.getMonth() + 1).padStart(2, '0'));
    result = result.replace(/\{day\}/g, String(now.getDate()).padStart(2, '0'));

    return result;
  }

  /**
   * Merge template with user-provided values
   */
  async mergeTemplateWithArgs(templateName: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const template = await this.getTemplate(templateName);
    
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Start with template defaults
    const merged: Record<string, unknown> = {
      workItemType: template.type,
      priority: template.priority,
      tags: template.tags ? template.tags.join('; ') : undefined,
    };

    // Apply template title with variable substitution
    const variables = (args.variables as Record<string, string>) || template.variables || {};
    
    if (template.title) {
      merged.title = this.applyVariableSubstitution(template.title, variables);
    }

    // Apply template description with variable substitution
    if (template.description) {
      merged.description = this.applyVariableSubstitution(template.description, variables);
    }

    // Apply template fields with variable substitution
    if (template.fields) {
      for (const [fieldPath, value] of Object.entries(template.fields)) {
        if (typeof value === 'string') {
          merged[fieldPath] = this.applyVariableSubstitution(value, variables);
        } else {
          merged[fieldPath] = value;
        }
      }
    }

    // User-provided args override template defaults (except template name)
    const { template: _, variables: __, ...userArgs } = args;
    Object.assign(merged, userArgs);

    // If user provided title, apply variable substitution
    if (args.title && typeof args.title === 'string') {
      merged.title = this.applyVariableSubstitution(args.title, variables);
    }

    // If user provided description, apply variable substitution
    if (args.description && typeof args.description === 'string') {
      merged.description = this.applyVariableSubstitution(args.description, variables);
    }

    return merged;
  }

  /**
   * Validate a template
   */
  async validateTemplate(templateName: string): Promise<{ valid: boolean; errors: string[] }> {
    const template = await this.getTemplate(templateName);
    
    if (!template) {
      return {
        valid: false,
        errors: [`Template '${templateName}' not found`]
      };
    }

    const errors: string[] = [];

    // Check required fields
    if (!template.name) errors.push("Template name is required");
    if (!template.title) errors.push("Template title is required");
    if (!template.type) errors.push("Work item type is required");

    // Validate work item type (common ADO types)
    const validTypes = ['Bug', 'Task', 'User Story', 'Product Backlog Item', 'Feature', 'Epic', 'Issue', 'Test Case'];
    if (template.type && !validTypes.includes(template.type)) {
      errors.push(`Work item type '${template.type}' may not be valid. Common types: ${validTypes.join(', ')}`);
    }

    // Validate priority
    if (template.priority !== undefined && (template.priority < 1 || template.priority > 4)) {
      errors.push("Priority must be between 1 and 4");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.cacheInitialized = false;
  }
}

/**
 * Singleton instance
 */
export const templateService = new TemplateService();
