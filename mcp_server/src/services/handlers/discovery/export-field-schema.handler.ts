/**
 * Handler: export-field-schema
 * 
 * Export field definitions as structured JSON or YAML schema.
 * Useful for documentation, migration, or template generation.
 */

import { logger } from '../../../utils/logger.js';
import { loadConfiguration } from '../../../config/config.js';
import { createFieldManagerService } from '../../field-manager-service.js';
import fs from 'fs/promises';
import path from 'path';

export interface ExportFieldSchemaArgs {
  organization?: string;
  project?: string;
  format?: 'json' | 'yaml';
  outputPath?: string;
  includeSystemFields?: boolean;
  includeMicrosoftFields?: boolean;
  includeUsageMetadata?: boolean;
  prettyPrint?: boolean;
}

export async function handleExportFieldSchema(args: ExportFieldSchemaArgs) {
  const startTime = Date.now();
  
  try {
    const config = loadConfiguration();
    const organization = args.organization || config.azureDevOps.organization;
    const project = args.project || config.azureDevOps.project;
    const format = args.format || 'json';
    const includeSystemFields = args.includeSystemFields ?? false;
    const includeMicrosoftFields = args.includeMicrosoftFields ?? true;
    const includeUsageMetadata = args.includeUsageMetadata ?? true;
    const prettyPrint = args.prettyPrint ?? true;

    logger.info(`[export-field-schema] Exporting field schema for ${organization}/${project} as ${format}`);

    // Create field manager service
    const fieldManager = createFieldManagerService(organization, project);

    // Discover all fields and work item types
    const [allFields, workItemTypes] = await Promise.all([
      fieldManager.discoverFields(),
      fieldManager.getWorkItemTypes()
    ]);

    logger.debug(`[export-field-schema] Processing ${allFields.length} fields`);

    // Build comprehensive field metadata
    const metadata = await fieldManager.buildFieldMetadata(allFields, workItemTypes);

    // Filter based on preferences
    let filteredMetadata = metadata;
    if (!includeSystemFields) {
      filteredMetadata = filteredMetadata.filter(f => f.fieldCategory !== 'system');
    }
    if (!includeMicrosoftFields) {
      filteredMetadata = filteredMetadata.filter(f => f.fieldCategory !== 'microsoft');
    }

    // Remove usage metadata if not requested
    const exportData = filteredMetadata.map(field => {
      const exportField: Record<string, unknown> = {
        referenceName: field.referenceName,
        displayName: field.displayName,
        type: field.type,
        description: field.description || '',
        category: field.fieldCategory,
        isPicklist: field.isPicklist
      };

      if (field.isPicklist && field.picklistValues) {
        exportField.picklistValues = field.picklistValues;
      }

      if (includeUsageMetadata) {
        exportField.usedInWorkItemTypes = field.usedInWorkItemTypes;
        exportField.isDeprecated = field.isDeprecated;
        exportField.hasData = field.hasData;
      }

      return exportField;
    });

    // Prepare schema export
    const schema = {
      metadata: {
        organization,
        project,
        exportDate: new Date().toISOString(),
        fieldCount: exportData.length,
        workItemTypes: workItemTypes.map(wit => wit.name)
      },
      fields: exportData
    };

    // Serialize based on format
    let serialized: string;
    if (format === 'yaml') {
      // Simple YAML serialization (basic implementation)
      serialized = convertToYAML(schema, prettyPrint);
    } else {
      serialized = prettyPrint 
        ? JSON.stringify(schema, null, 2)
        : JSON.stringify(schema);
    }

    // Write to file if output path specified
    let outputFile: string | null = null;
    if (args.outputPath) {
      const outputPath = path.isAbsolute(args.outputPath)
        ? args.outputPath
        : path.join(process.cwd(), args.outputPath);
      
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, serialized, 'utf-8');
      outputFile = outputPath;
      logger.info(`[export-field-schema] Exported schema to ${outputPath}`);
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        schema: prettyPrint ? serialized : JSON.parse(serialized), // Return parsed if not pretty
        field_count: exportData.length,
        output_file: outputFile,
        format,
        summary: `Exported ${exportData.length} field definitions to ${format.toUpperCase()} schema.` +
                 (outputFile ? ` Saved to: ${outputFile}` : '')
      },
      metadata: {
        organization,
        project,
        execution_time_ms: executionTime,
        export_options: {
          format,
          include_system_fields: includeSystemFields,
          include_microsoft_fields: includeMicrosoftFields,
          include_usage_metadata: includeUsageMetadata,
          pretty_print: prettyPrint
        }
      },
      errors: [],
      warnings: []
    };

  } catch (error) {
    logger.error(`[export-field-schema] Error: ${error instanceof Error ? error.message : String(error)}`);
    
    return {
      success: false,
      data: null,
      metadata: {
        execution_time_ms: Date.now() - startTime
      },
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}

/**
 * Simple YAML converter (basic implementation)
 */
function convertToYAML(obj: unknown, prettyPrint: boolean): string {
  const indent = prettyPrint ? '  ' : '';
  
  function toYAML(value: unknown, level = 0): string {
    const padding = indent.repeat(level);
    
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      // Escape strings with special characters
      if (value.includes('\n') || value.includes(':') || value.includes('#')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return '\n' + value.map(item => 
        `${padding}- ${toYAML(item, level + 1).trim()}`
      ).join('\n');
    }
    
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      
      return '\n' + entries.map(([key, val]) => {
        const yamlVal = toYAML(val, level + 1);
        if (yamlVal.startsWith('\n')) {
          return `${padding}${key}:${yamlVal}`;
        }
        return `${padding}${key}: ${yamlVal}`;
      }).join('\n');
    }
    
    return String(value);
  }
  
  return toYAML(obj).trim();
}
