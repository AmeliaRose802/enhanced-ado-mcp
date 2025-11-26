/**
 * Custom Field Manager Service
 * 
 * Service for discovering, documenting, and validating custom fields in Azure DevOps projects.
 * Helps teams understand and manage custom fields across work item types.
 */

import { logger } from '../utils/logger.js';
import { createADOHttpClient, ADOHttpClient } from '../utils/ado-http-client.js';
import { getTokenProvider } from '../utils/token-provider.js';
import { cacheService, CacheDataType } from './cache-service.js';
import type { ADOApiResponse } from '../types/index.js';

/**
 * Field definition from Azure DevOps API
 */
export interface ADOFieldDefinition {
  referenceName: string;
  name: string;
  type: string;
  description?: string;
  isIdentity?: boolean;
  isPicklist?: boolean;
  isQueryable?: boolean;
  isDeleted?: boolean;
  usage?: string;
  picklistId?: string;
  url?: string;
}

/**
 * Work item type definition
 */
interface ADOWorkItemType {
  name: string;
  referenceName: string;
  description?: string;
  color?: string;
  icon?: string;
  isDisabled?: boolean;
  url?: string;
  states?: Array<{ name: string; category: string; color?: string }>;
  fields?: ADOFieldDefinition[];
}

/**
 * Picklist item
 */
interface ADOPicklistItem {
  id: string;
  value: string;
  isDefault?: boolean;
  isSuggested?: boolean;
}

/**
 * Custom field metadata with usage information
 */
export interface CustomFieldMetadata {
  referenceName: string;
  displayName: string;
  type: string;
  description?: string;
  isPicklist: boolean;
  picklistValues?: string[];
  usedInWorkItemTypes: string[];
  isDeprecated: boolean;
  hasData: boolean;
  fieldCategory: 'custom' | 'microsoft' | 'system';
}

/**
 * Field validation issue
 */
export interface FieldValidationIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  issue: string;
  suggestion?: string;
  affectedWorkItemTypes?: string[];
}

/**
 * Field usage statistics
 */
export interface FieldUsageStats {
  totalFields: number;
  customFields: number;
  microsoftFields: number;
  systemFields: number;
  picklistFields: number;
  deprecatedFields: number;
  unusedFields: number;
}

/**
 * Custom Field Manager Service
 */
export class FieldManagerService {
  private httpClient: ADOHttpClient;
  private organization: string;
  private project: string;

  constructor(organization: string, project: string) {
    this.organization = organization;
    this.project = project;
    this.httpClient = createADOHttpClient(organization, getTokenProvider(), project);
  }

  /**
   * Discover all fields in the project
   */
  async discoverFields(): Promise<ADOFieldDefinition[]> {
    try {
      const cacheKey = `fields:${this.organization}:${this.project}:all`;
      const cached = cacheService.get<ADOFieldDefinition[]>(cacheKey);
      if (cached) {
        logger.debug(`[FieldManager] Using cached field definitions (${cached.length} fields)`);
        return cached;
      }

      logger.debug('[FieldManager] Fetching field definitions from Azure DevOps...');
      
      // Use Work Item Type Fields API to get all fields
      const response = await this.httpClient.get<ADOApiResponse<ADOFieldDefinition[]>>(
        'wit/fields'
      );

      const fields = response.data.value || [];
      logger.debug(`[FieldManager] Discovered ${fields.length} field definitions`);

      // Cache for 1 hour (fields don't change frequently)
      cacheService.set(cacheKey, fields, 60 * 60 * 1000, CacheDataType.FIELD_DEFINITIONS);

      return fields;
    } catch (error) {
      logger.error(`[FieldManager] Failed to discover fields: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to discover fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all work item types in the project
   */
  async getWorkItemTypes(): Promise<ADOWorkItemType[]> {
    try {
      const cacheKey = `wit-types:${this.organization}:${this.project}:all`;
      const cached = cacheService.get<ADOWorkItemType[]>(cacheKey);
      if (cached) {
        logger.debug(`[FieldManager] Using cached work item types (${cached.length} types)`);
        return cached;
      }

      logger.debug('[FieldManager] Fetching work item types from Azure DevOps...');
      
      const response = await this.httpClient.get<ADOApiResponse<ADOWorkItemType[]>>(
        'wit/workitemtypes'
      );

      const types = response.data.value || [];
      logger.debug(`[FieldManager] Discovered ${types.length} work item types`);

      // Cache for 1 hour
      cacheService.set(cacheKey, types, 60 * 60 * 1000, CacheDataType.WORK_ITEM_TYPES);

      return types;
    } catch (error) {
      logger.error(`[FieldManager] Failed to get work item types: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get work item types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get fields for a specific work item type
   */
  async getFieldsForWorkItemType(workItemType: string): Promise<ADOFieldDefinition[]> {
    try {
      const cacheKey = `wit-fields:${this.organization}:${this.project}:${workItemType}`;
      const cached = cacheService.get<ADOFieldDefinition[]>(cacheKey);
      if (cached) {
        logger.debug(`[FieldManager] Using cached fields for ${workItemType} (${cached.length} fields)`);
        return cached;
      }

      logger.debug(`[FieldManager] Fetching fields for work item type: ${workItemType}`);
      
      const encodedType = encodeURIComponent(workItemType);
      const response = await this.httpClient.get<ADOApiResponse<ADOFieldDefinition[]>>(
        `wit/workitemtypes/${encodedType}/fields`
      );

      const fields = response.data.value || [];
      logger.debug(`[FieldManager] Found ${fields.length} fields for ${workItemType}`);

      // Cache for 1 hour
      cacheService.set(cacheKey, fields, 60 * 60 * 1000, CacheDataType.FIELD_DEFINITIONS);

      return fields;
    } catch (error) {
      logger.error(`[FieldManager] Failed to get fields for ${workItemType}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get fields for work item type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get picklist values for a field
   */
  async getPicklistValues(picklistId: string): Promise<string[]> {
    try {
      const cacheKey = `picklist:${this.organization}:${this.project}:${picklistId}`;
      const cached = cacheService.get<string[]>(cacheKey);
      if (cached) {
        logger.debug(`[FieldManager] Using cached picklist values (${cached.length} items)`);
        return cached;
      }

      logger.debug(`[FieldManager] Fetching picklist values for: ${picklistId}`);
      
      // Picklists API endpoint
      const response = await this.httpClient.get<ADOApiResponse<ADOPicklistItem[]>>(
        `wit/picklists/${picklistId}`
      );

      const items = response.data.value || [];
      const values = items.map(item => item.value);
      
      logger.debug(`[FieldManager] Found ${values.length} picklist values`);

      // Cache for 1 hour
      cacheService.set(cacheKey, values, 60 * 60 * 1000, CacheDataType.PICKLISTS);

      return values;
    } catch (error) {
      logger.warn(`[FieldManager] Failed to get picklist values for ${picklistId}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Categorize a field by its reference name
   */
  categorizeField(referenceName: string): 'system' | 'microsoft' | 'custom' {
    if (referenceName.startsWith('System.')) {
      return 'system';
    } else if (referenceName.startsWith('Microsoft.')) {
      return 'microsoft';
    } else {
      return 'custom';
    }
  }

  /**
   * Build comprehensive field metadata with usage information
   */
  async buildFieldMetadata(fields: ADOFieldDefinition[], workItemTypes: ADOWorkItemType[]): Promise<CustomFieldMetadata[]> {
    const metadata: CustomFieldMetadata[] = [];

    for (const field of fields) {
      // Determine which work item types use this field
      const usedInTypes: string[] = [];
      for (const wit of workItemTypes) {
        try {
          const witFields = await this.getFieldsForWorkItemType(wit.name);
          if (witFields.some(f => f.referenceName === field.referenceName)) {
            usedInTypes.push(wit.name);
          }
        } catch {
          // Ignore errors for individual work item types
        }
      }

      // Get picklist values if applicable
      let picklistValues: string[] | undefined;
      if (field.isPicklist && field.picklistId) {
        picklistValues = await this.getPicklistValues(field.picklistId);
      }

      const fieldMeta: CustomFieldMetadata = {
        referenceName: field.referenceName,
        displayName: field.name,
        type: field.type,
        description: field.description,
        isPicklist: field.isPicklist || false,
        picklistValues,
        usedInWorkItemTypes: usedInTypes,
        isDeprecated: field.isDeleted || false,
        hasData: usedInTypes.length > 0, // Assume has data if used in any work item type
        fieldCategory: this.categorizeField(field.referenceName)
      };

      metadata.push(fieldMeta);
    }

    return metadata;
  }

  /**
   * Validate fields and identify issues
   */
  validateFields(metadata: CustomFieldMetadata[]): FieldValidationIssue[] {
    const issues: FieldValidationIssue[] = [];

    // Group fields by lowercase name to detect casing issues
    const fieldsByName = new Map<string, CustomFieldMetadata[]>();
    for (const field of metadata) {
      const lowerName = field.displayName.toLowerCase();
      const existing = fieldsByName.get(lowerName) || [];
      existing.push(field);
      fieldsByName.set(lowerName, existing);
    }

    // Check for inconsistent casing
    for (const [name, fields] of fieldsByName.entries()) {
      if (fields.length > 1) {
        const names = fields.map(f => f.displayName).join(', ');
        issues.push({
          severity: 'warning',
          field: name,
          issue: `Inconsistent field name casing: ${names}`,
          suggestion: 'Standardize field naming to use consistent casing',
          affectedWorkItemTypes: fields.flatMap(f => f.usedInWorkItemTypes)
        });
      }
    }

    // Check for unused fields
    for (const field of metadata) {
      if (!field.hasData && field.fieldCategory === 'custom') {
        issues.push({
          severity: 'info',
          field: field.referenceName,
          issue: 'Custom field appears to be unused',
          suggestion: 'Consider removing this field if it is no longer needed'
        });
      }
    }

    // Check for deprecated fields still in use
    for (const field of metadata) {
      if (field.isDeprecated && field.hasData) {
        issues.push({
          severity: 'warning',
          field: field.referenceName,
          issue: 'Deprecated field is still in use',
          suggestion: 'Migrate data to a new field and remove this field',
          affectedWorkItemTypes: field.usedInWorkItemTypes
        });
      }
    }

    // Check for similar field names (potential duplicates)
    const customFields = metadata.filter(f => f.fieldCategory === 'custom');
    for (let i = 0; i < customFields.length; i++) {
      for (let j = i + 1; j < customFields.length; j++) {
        const field1 = customFields[i];
        const field2 = customFields[j];
        
        // Simple similarity check (contains similar words)
        const name1Words = field1.displayName.toLowerCase().split(/\s+/);
        const name2Words = field2.displayName.toLowerCase().split(/\s+/);
        const commonWords = name1Words.filter(w => name2Words.includes(w));
        
        if (commonWords.length >= 2 || (commonWords.length === 1 && commonWords[0].length > 5)) {
          issues.push({
            severity: 'info',
            field: `${field1.referenceName}, ${field2.referenceName}`,
            issue: `Similar field names detected: "${field1.displayName}" and "${field2.displayName}"`,
            suggestion: 'Consider merging these fields if they serve the same purpose'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Calculate field usage statistics
   */
  calculateStats(metadata: CustomFieldMetadata[]): FieldUsageStats {
    return {
      totalFields: metadata.length,
      customFields: metadata.filter(f => f.fieldCategory === 'custom').length,
      microsoftFields: metadata.filter(f => f.fieldCategory === 'microsoft').length,
      systemFields: metadata.filter(f => f.fieldCategory === 'system').length,
      picklistFields: metadata.filter(f => f.isPicklist).length,
      deprecatedFields: metadata.filter(f => f.isDeprecated).length,
      unusedFields: metadata.filter(f => !f.hasData && f.fieldCategory === 'custom').length
    };
  }
}

/**
 * Create a field manager service instance
 */
export function createFieldManagerService(organization: string, project: string): FieldManagerService {
  return new FieldManagerService(organization, project);
}
