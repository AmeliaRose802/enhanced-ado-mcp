/**
 * Handler: discover-custom-fields
 * 
 * Discover all custom fields in an Azure DevOps project, including:
 * - Field metadata (name, type, description)
 * - Usage across work item types
 * - Picklist values for choice fields
 * - Field categories (system, microsoft, custom)
 */

import { logger } from '../../../utils/logger.js';
import { loadConfiguration } from '../../../config/config.js';
import { createFieldManagerService } from '../../field-manager-service.js';

export interface DiscoverCustomFieldsArgs {
  organization?: string;
  project?: string;
  includeSystemFields?: boolean;
  includeMicrosoftFields?: boolean;
  includePicklistValues?: boolean;
}

export async function handleDiscoverCustomFields(args: DiscoverCustomFieldsArgs) {
  const startTime = Date.now();
  
  try {
    const config = loadConfiguration();
    const organization = args.organization || config.azureDevOps.organization;
    const project = args.project || config.azureDevOps.project;
    const includeSystemFields = args.includeSystemFields ?? false;
    const includeMicrosoftFields = args.includeMicrosoftFields ?? true;
    const includePicklistValues = args.includePicklistValues ?? true;

    logger.info(`[discover-custom-fields] Discovering fields for ${organization}/${project}`);

    // Create field manager service
    const fieldManager = createFieldManagerService(organization, project);

    // Discover all fields and work item types
    const [allFields, workItemTypes] = await Promise.all([
      fieldManager.discoverFields(),
      fieldManager.getWorkItemTypes()
    ]);

    logger.debug(`[discover-custom-fields] Found ${allFields.length} total fields, ${workItemTypes.length} work item types`);

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

    // Optionally remove picklist values to reduce output size
    if (!includePicklistValues) {
      filteredMetadata.forEach(f => {
        delete f.picklistValues;
      });
    }

    // Calculate statistics
    const stats = fieldManager.calculateStats(metadata);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        fields: filteredMetadata,
        statistics: stats,
        work_item_types: workItemTypes.map(wit => ({
          name: wit.name,
          description: wit.description,
          is_disabled: wit.isDisabled || false
        })),
        summary: `Discovered ${filteredMetadata.length} fields across ${workItemTypes.length} work item types. ` +
                 `${stats.customFields} custom fields, ${stats.picklistFields} picklist fields, ${stats.unusedFields} unused fields.`
      },
      metadata: {
        organization,
        project,
        execution_time_ms: executionTime,
        filters: {
          include_system_fields: includeSystemFields,
          include_microsoft_fields: includeMicrosoftFields,
          include_picklist_values: includePicklistValues
        }
      },
      errors: [],
      warnings: []
    };

  } catch (error) {
    logger.error(`[discover-custom-fields] Error: ${error instanceof Error ? error.message : String(error)}`);
    
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
