/**
 * Handler: validate-custom-fields
 * 
 * Validate custom fields and identify issues:
 * - Inconsistent field naming (casing, typos)
 * - Unused fields
 * - Deprecated fields still in use
 * - Similar/duplicate field names
 * - Fields with no data
 */

import { logger } from '../../../utils/logger.js';
import { loadConfiguration } from '../../../config/config.js';
import { createFieldManagerService } from '../../field-manager-service.js';

export interface ValidateCustomFieldsArgs {
  organization?: string;
  project?: string;
  severityFilter?: 'error' | 'warning' | 'info' | 'all';
  focusOnCustomFields?: boolean;
}

export async function handleValidateCustomFields(args: ValidateCustomFieldsArgs) {
  const startTime = Date.now();
  
  try {
    const config = loadConfiguration();
    const organization = args.organization || config.azureDevOps.organization;
    const project = args.project || config.azureDevOps.project;
    const severityFilter = args.severityFilter || 'all';
    const focusOnCustomFields = args.focusOnCustomFields ?? true;

    logger.info(`[validate-custom-fields] Validating fields for ${organization}/${project}`);

    // Create field manager service
    const fieldManager = createFieldManagerService(organization, project);

    // Discover all fields and work item types
    const [allFields, workItemTypes] = await Promise.all([
      fieldManager.discoverFields(),
      fieldManager.getWorkItemTypes()
    ]);

    logger.debug(`[validate-custom-fields] Analyzing ${allFields.length} fields across ${workItemTypes.length} work item types`);

    // Build comprehensive field metadata
    const metadata = await fieldManager.buildFieldMetadata(allFields, workItemTypes);

    // Focus on custom fields if requested
    let fieldsToValidate = metadata;
    if (focusOnCustomFields) {
      fieldsToValidate = metadata.filter(f => f.fieldCategory === 'custom');
    }

    // Validate fields and identify issues
    const allIssues = fieldManager.validateFields(fieldsToValidate);

    // Filter by severity if specified
    let filteredIssues = allIssues;
    if (severityFilter !== 'all') {
      filteredIssues = allIssues.filter(issue => issue.severity === severityFilter);
    }

    // Calculate statistics
    const stats = fieldManager.calculateStats(metadata);

    // Group issues by severity
    const issuesBySeverity = {
      errors: filteredIssues.filter(i => i.severity === 'error').length,
      warnings: filteredIssues.filter(i => i.severity === 'warning').length,
      info: filteredIssues.filter(i => i.severity === 'info').length
    };

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        issues: filteredIssues,
        issue_summary: issuesBySeverity,
        field_statistics: stats,
        validation_scope: {
          total_fields_analyzed: fieldsToValidate.length,
          custom_fields_only: focusOnCustomFields
        },
        summary: `Found ${filteredIssues.length} field issues (${issuesBySeverity.errors} errors, ${issuesBySeverity.warnings} warnings, ${issuesBySeverity.info} info). ` +
                 `Analyzed ${fieldsToValidate.length} fields.`
      },
      metadata: {
        organization,
        project,
        execution_time_ms: executionTime,
        filters: {
          severity_filter: severityFilter,
          focus_on_custom_fields: focusOnCustomFields
        }
      },
      errors: [],
      warnings: filteredIssues.filter(i => i.severity === 'error').map(i => i.issue)
    };

  } catch (error) {
    logger.error(`[validate-custom-fields] Error: ${error instanceof Error ? error.message : String(error)}`);
    
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
