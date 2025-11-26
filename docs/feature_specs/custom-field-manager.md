# Custom Field Manager

**Feature Status:** ✅ Implemented  
**Last Updated:** 2025-11-18  
**Version:** 1.0.0

## Overview

The Custom Field Manager provides tools to discover, document, and validate custom fields in Azure DevOps projects. It helps teams understand field usage across work item types, identify issues with field naming and standardization, and export field schemas for documentation or migration purposes.

## Problem Statement

Azure DevOps projects often accumulate custom fields over time, leading to:
- Inconsistent field naming and casing
- Duplicate or similar fields serving the same purpose
- Unused or deprecated fields cluttering the project
- Lack of documentation about field usage and purpose
- Difficulty understanding which fields are available and how they're used

## Solution

The Custom Field Manager provides three MCP tools:
1. **discover-custom-fields** - Scan and inventory all fields in a project
2. **validate-custom-fields** - Identify field issues and inconsistencies
3. **export-field-schema** - Generate structured field documentation

## Tools

### 1. discover-custom-fields

Discover all custom fields in an Azure DevOps project with comprehensive metadata.

#### Input Parameters

**Optional:**
- `includeSystemFields` (boolean) - Include system fields (System.*) in results (default: false)
- `includeMicrosoftFields` (boolean) - Include Microsoft VSTS fields (Microsoft.*) in results (default: true)
- `includePicklistValues` (boolean) - Include allowed values for picklist fields (default: true)
- `organization` (string) - Azure DevOps organization (uses config default if not provided)
- `project` (string) - Azure DevOps project (uses config default if not provided)

#### Output Format

```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "referenceName": "Custom.SecurityClassification",
        "displayName": "Security Classification",
        "type": "String",
        "description": "Security classification level for the work item",
        "isPicklist": true,
        "picklistValues": ["Public", "Internal", "Confidential", "Secret"],
        "usedInWorkItemTypes": ["Product Backlog Item", "Bug", "Task"],
        "isDeprecated": false,
        "hasData": true,
        "fieldCategory": "custom"
      }
    ],
    "statistics": {
      "totalFields": 120,
      "customFields": 15,
      "microsoftFields": 45,
      "systemFields": 60,
      "picklistFields": 8,
      "deprecatedFields": 2,
      "unusedFields": 3
    },
    "work_item_types": [
      {
        "name": "Product Backlog Item",
        "description": "User story or requirement",
        "is_disabled": false
      }
    ],
    "summary": "Discovered 60 fields across 8 work item types. 15 custom fields, 8 picklist fields, 3 unused fields."
  },
  "metadata": {
    "organization": "myorg",
    "project": "MyProject",
    "execution_time_ms": 2345,
    "filters": {
      "include_system_fields": false,
      "include_microsoft_fields": true,
      "include_picklist_values": true
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Field Metadata

Each field includes:
- **referenceName** - Internal field identifier (e.g., `Custom.FieldName`)
- **displayName** - Human-readable field name
- **type** - Data type (String, Integer, DateTime, Double, Boolean, Identity, PlainText, Html, TreePath, Guid)
- **description** - Field description (if defined)
- **isPicklist** - Whether the field is a picklist/choice field
- **picklistValues** - Allowed values for picklist fields
- **usedInWorkItemTypes** - Work item types that use this field
- **isDeprecated** - Whether the field is marked as deprecated
- **hasData** - Whether the field is actively used
- **fieldCategory** - Field category: `system`, `microsoft`, or `custom`

#### Examples

**Discover only custom fields:**
```json
{
  "includeSystemFields": false,
  "includeMicrosoftFields": false
}
```

**Full field inventory with picklist values:**
```json
{
  "includeSystemFields": true,
  "includeMicrosoftFields": true,
  "includePicklistValues": true
}
```

**Quick overview without picklist values:**
```json
{
  "includePicklistValues": false
}
```

---

### 2. validate-custom-fields

Validate custom fields and identify issues with naming, usage, and standardization.

#### Input Parameters

**Optional:**
- `severityFilter` (enum) - Filter issues by severity: `error`, `warning`, `info`, `all` (default: all)
- `focusOnCustomFields` (boolean) - Only validate custom fields (default: true)
- `organization` (string) - Azure DevOps organization (uses config default if not provided)
- `project` (string) - Azure DevOps project (uses config default if not provided)

#### Output Format

```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "severity": "warning",
        "field": "security classification",
        "issue": "Inconsistent field name casing: Security Classification, security classification",
        "suggestion": "Standardize field naming to use consistent casing",
        "affectedWorkItemTypes": ["Product Backlog Item", "Bug"]
      },
      {
        "severity": "info",
        "field": "Custom.OldPriority",
        "issue": "Custom field appears to be unused",
        "suggestion": "Consider removing this field if it is no longer needed"
      },
      {
        "severity": "warning",
        "field": "Custom.DeprecatedField",
        "issue": "Deprecated field is still in use",
        "suggestion": "Migrate data to a new field and remove this field",
        "affectedWorkItemTypes": ["Task"]
      },
      {
        "severity": "info",
        "field": "Custom.SecurityLevel, Custom.SecurityClassification",
        "issue": "Similar field names detected: \"Security Level\" and \"Security Classification\"",
        "suggestion": "Consider merging these fields if they serve the same purpose"
      }
    ],
    "issue_summary": {
      "errors": 0,
      "warnings": 2,
      "info": 2
    },
    "field_statistics": {
      "totalFields": 120,
      "customFields": 15,
      "microsoftFields": 45,
      "systemFields": 60,
      "picklistFields": 8,
      "deprecatedFields": 2,
      "unusedFields": 3
    },
    "validation_scope": {
      "total_fields_analyzed": 15,
      "custom_fields_only": true
    },
    "summary": "Found 4 field issues (0 errors, 2 warnings, 2 info). Analyzed 15 fields."
  },
  "metadata": {
    "organization": "myorg",
    "project": "MyProject",
    "execution_time_ms": 1823,
    "filters": {
      "severity_filter": "all",
      "focus_on_custom_fields": true
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Validation Rules

1. **Inconsistent Casing** - Detects fields with similar names but different casing
2. **Unused Fields** - Identifies custom fields not used in any work item type
3. **Deprecated Fields** - Finds deprecated fields still in active use
4. **Similar Names** - Detects potential duplicate fields with similar names

#### Examples

**Validate only custom fields (default):**
```json
{
  "focusOnCustomFields": true
}
```

**Show only errors and warnings:**
```json
{
  "severityFilter": "warning"
}
```

**Validate all fields including system/Microsoft:**
```json
{
  "focusOnCustomFields": false,
  "severityFilter": "all"
}
```

---

### 3. export-field-schema

Export field definitions as structured JSON or YAML schema for documentation or migration.

#### Input Parameters

**Optional:**
- `format` (enum) - Export format: `json` or `yaml` (default: json)
- `outputPath` (string) - File path to save exported schema (optional, returns in response if not provided)
- `includeSystemFields` (boolean) - Include system fields in export (default: false)
- `includeMicrosoftFields` (boolean) - Include Microsoft VSTS fields in export (default: true)
- `includeUsageMetadata` (boolean) - Include work item type usage metadata (default: true)
- `prettyPrint` (boolean) - Format output with indentation (default: true)
- `organization` (string) - Azure DevOps organization (uses config default if not provided)
- `project` (string) - Azure DevOps project (uses config default if not provided)

#### Output Format

```json
{
  "success": true,
  "data": {
    "schema": {
      "metadata": {
        "organization": "myorg",
        "project": "MyProject",
        "exportDate": "2025-11-18T12:00:00Z",
        "fieldCount": 60,
        "workItemTypes": ["Epic", "Feature", "Product Backlog Item", "Task", "Bug"]
      },
      "fields": [
        {
          "referenceName": "Custom.SecurityClassification",
          "displayName": "Security Classification",
          "type": "String",
          "description": "Security classification level",
          "category": "custom",
          "isPicklist": true,
          "picklistValues": ["Public", "Internal", "Confidential"],
          "usedInWorkItemTypes": ["Product Backlog Item", "Bug"],
          "isDeprecated": false,
          "hasData": true
        }
      ]
    },
    "field_count": 60,
    "output_file": "C:\\projects\\field-schema.json",
    "format": "json",
    "summary": "Exported 60 field definitions to JSON schema. Saved to: C:\\projects\\field-schema.json"
  },
  "metadata": {
    "organization": "myorg",
    "project": "MyProject",
    "execution_time_ms": 1456,
    "export_options": {
      "format": "json",
      "include_system_fields": false,
      "include_microsoft_fields": true,
      "include_usage_metadata": true,
      "pretty_print": true
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Schema Format

The exported schema includes:
- **metadata** - Export timestamp, organization, project, field count
- **fields** - Array of field definitions with full metadata

#### Examples

**Export custom fields as JSON:**
```json
{
  "format": "json",
  "outputPath": "./field-schema.json",
  "includeSystemFields": false,
  "includeMicrosoftFields": false
}
```

**Export all fields as YAML:**
```json
{
  "format": "yaml",
  "outputPath": "./field-schema.yaml",
  "includeSystemFields": true,
  "includeMicrosoftFields": true
}
```

**Get schema without saving to file:**
```json
{
  "format": "json",
  "prettyPrint": true
}
```

**Minimal export for migration:**
```json
{
  "format": "json",
  "includeUsageMetadata": false,
  "prettyPrint": false
}
```

---

## Use Cases

### 1. Field Audit

**Goal:** Understand all custom fields in a project

```
1. Run discover-custom-fields to get field inventory
2. Review field categories and usage
3. Identify fields with unclear purpose
4. Document field definitions
```

### 2. Field Cleanup

**Goal:** Remove unused or deprecated fields

```
1. Run validate-custom-fields to find unused fields
2. Verify fields are truly unused (check work item history)
3. Archive or remove unused fields
4. Update documentation
```

### 3. Field Standardization

**Goal:** Enforce consistent field naming

```
1. Run validate-custom-fields to find inconsistencies
2. Identify duplicate/similar fields
3. Consolidate fields where possible
4. Establish naming conventions
5. Migrate data to standardized fields
```

### 4. Project Documentation

**Goal:** Generate comprehensive field documentation

```
1. Run export-field-schema to get full schema
2. Generate documentation from schema
3. Share with team members
4. Update onboarding materials
```

### 5. Cross-Project Migration

**Goal:** Migrate fields between projects

```
1. Export source project schema
2. Compare with target project schema
3. Identify fields to migrate
4. Create fields in target project
5. Migrate work item data
```

### 6. Team Onboarding

**Goal:** Help new team members understand custom fields

```
1. Export field schema with usage metadata
2. Document field purposes and conventions
3. Show which work item types use which fields
4. Provide examples of proper field usage
```

---

## Performance & Caching

### Caching Strategy

Field metadata is cached with 60-minute TTL since fields change infrequently:
- **Field definitions** - Cached per project (60 min)
- **Work item types** - Cached per project (60 min)
- **Picklist values** - Cached per picklist (60 min)

### API Call Efficiency

The field manager minimizes API calls:
- **discover-custom-fields**: 2-10 API calls (depends on work item type count)
- **validate-custom-fields**: 2-10 API calls (same as discovery)
- **export-field-schema**: 2-10 API calls (same as discovery)

Subsequent calls within cache TTL use cached data.

---

## Error Handling

### Common Errors

1. **Project not found**
   - Verify organization and project names
   - Check Azure DevOps access permissions

2. **Permission denied**
   - Requires "View work items" permission
   - Requires "View project-level information" permission

3. **Invalid field reference**
   - Field may have been deleted
   - Field may not exist in this project

### Error Recovery

All tools return structured error responses:
```json
{
  "success": false,
  "data": null,
  "metadata": {
    "execution_time_ms": 123
  },
  "errors": ["Error message here"],
  "warnings": []
}
```

---

## Azure DevOps API

### Endpoints Used

- `GET _apis/wit/fields` - Get all field definitions
- `GET _apis/wit/workitemtypes` - Get work item types
- `GET _apis/wit/workitemtypes/{type}/fields` - Get fields for specific type
- `GET _apis/wit/picklists/{id}` - Get picklist values

### API Version

All endpoints use API version 7.1.

---

## Field Categories

### System Fields

**Prefix:** `System.*`  
**Examples:** `System.Id`, `System.Title`, `System.State`  
**Description:** Core Azure DevOps fields, present in all projects

### Microsoft Fields

**Prefix:** `Microsoft.*`  
**Examples:** `Microsoft.VSTS.Common.Priority`, `Microsoft.VSTS.Scheduling.StoryPoints`  
**Description:** Extended fields from Microsoft process templates (Agile, Scrum, CMMI)

### Custom Fields

**Prefix:** `Custom.*` or organization-specific  
**Examples:** `Custom.SecurityClassification`, `Contoso.ReleaseVersion`  
**Description:** Fields created by organization or project admins

---

## Field Types

Azure DevOps supports these field types:

- **String** - Text values (single line)
- **PlainText** - Multi-line text without formatting
- **Html** - Rich text with HTML formatting
- **Integer** - Whole numbers
- **Double** - Decimal numbers
- **DateTime** - Date and time values
- **Boolean** - True/false values
- **Identity** - User or group references
- **TreePath** - Hierarchical path values (Area Path, Iteration Path)
- **Guid** - Unique identifiers

---

## Best Practices

### Field Naming

1. Use consistent casing (PascalCase or camelCase)
2. Be descriptive but concise
3. Avoid abbreviations unless widely understood
4. Include units in numeric field names (e.g., "TimeInHours")

### Field Management

1. Document field purpose and usage
2. Remove unused fields to reduce clutter
3. Use picklists for fields with fixed values
4. Mark deprecated fields before removal
5. Test field changes in non-production first

### Validation Frequency

Run validation:
- **Monthly** - Regular field health check
- **Before migrations** - Ensure clean state
- **After process changes** - Verify field usage
- **During onboarding** - Document current state

---

## Limitations

1. **Cannot modify fields** - Discovery and validation only, no field CRUD operations
2. **Limited similarity detection** - Simple word-based comparison, not semantic
3. **No data analysis** - Doesn't analyze actual field values in work items
4. **Cache dependencies** - May not immediately reflect recent field changes

---

## Future Enhancements

Potential additions:
- Field usage analysis (query work items to see actual usage)
- Field value distribution statistics
- Automatic field standardization suggestions
- Field migration tools
- Integration with process template management
- Custom validation rules

---

## Related Features

- [Work Item Creation](./WORK_ITEM_CREATION.md) - Creating work items with custom fields
- [Query Tools](./QUERY_TOOLS.md) - Querying work items by custom fields
- [Bulk Operations](./BULK_OPERATIONS.md) - Updating custom fields in bulk

---

## References

- [Azure DevOps Work Item Fields API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/fields)
- [Azure DevOps Work Item Types API](https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-types)
- [Azure DevOps Picklists API](https://learn.microsoft.com/en-us/rest/api/azure/devops/processes/lists)
- [Customize Work Item Fields](https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/customize-process-field)

---

**Author:** Enhanced ADO MCP Team  
**Last Updated:** 2025-11-18
