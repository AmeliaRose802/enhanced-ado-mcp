# Analysis & Validation Tools

**Feature Category:** Work Item Analysis  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07

## Overview

The Enhanced ADO MCP Server provides comprehensive analysis and validation tools for work items:

1. **wit-detect-patterns** - Identify common work item issues
2. **wit-validate-hierarchy-fast** - Fast rule-based hierarchy validation
3. **wit-get-last-substantive-change** - Determine meaningful change dates
4. **wit-extract-security-links** - Extract security scan instruction links
5. **wit-get-configuration** - View current MCP server configuration

These tools enable proactive issue detection and work item quality improvement.

## Purpose

Enable work item quality analysis with:
- Pattern detection for common issues
- Hierarchy validation (type and state consistency)
- Staleness analysis (filtering automated changes)
- Security scan link extraction
- Configuration discovery for agents

## Tools

### 1. wit-detect-patterns

Identify common work item issues by severity.

#### Input Parameters

**Optional:**
- `workItemIds` (array of numbers) - Specific IDs to analyze
- `areaPath` (string) - Area path to search (if workItemIds not provided)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `patterns` (array of strings) - Patterns to detect:
  - `"duplicates"` - Duplicate titles
  - `"placeholder_titles"` - Generic titles (TODO, TBD, etc.)
  - `"orphaned_children"` - Children with removed/missing parents
  - `"unassigned_committed"` - Unassigned items in active sprints
  - `"stale_automation"` - Items not touched by humans
  - `"no_description"` - Missing descriptions
- `maxResults` (number) - Max results when using areaPath
- `includeSubAreas` (boolean) - Include sub-area paths

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "total_analyzed": 150,
    "issues_found": 45,
    "patterns": {
      "duplicates": {
        "count": 8,
        "severity": "medium",
        "matches": [
          {
            "ids": [12345, 12346],
            "title": "Implement authentication",
            "reason": "Exact title match"
          }
        ]
      },
      "placeholder_titles": {
        "count": 5,
        "severity": "high",
        "matches": [
          {
            "id": 12347,
            "title": "TODO: Fix bug",
            "reason": "Contains placeholder keyword: TODO"
          }
        ]
      },
      "orphaned_children": {
        "count": 3,
        "severity": "high",
        "matches": [
          {
            "id": 12348,
            "title": "Child task",
            "parent_id": 99999,
            "reason": "Parent work item 99999 is removed or not found"
          }
        ]
      },
      "no_description": {
        "count": 15,
        "severity": "low",
        "matches": [
          {
            "id": 12349,
            "title": "Implement feature X",
            "reason": "Description field is empty"
          }
        ]
      }
    },
    "recommendations": [
      "Merge or close duplicate work items",
      "Replace placeholder titles with descriptive names",
      "Fix orphaned children by removing parent links or restoring parents",
      "Add descriptions to work items for clarity"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example 1: Detect All Patterns in Area**
```json
{
  "areaPath": "Project\\Team",
  "patterns": ["duplicates", "placeholder_titles", "orphaned_children", "no_description"]
}
```

**Example 2: Detect Specific Issues**
```json
{
  "workItemIds": [12345, 12346, 12347, 12348],
  "patterns": ["duplicates", "placeholder_titles"]
}
```

### 2. wit-validate-hierarchy-fast

Fast, rule-based validation of work item hierarchy.

#### Input Parameters

**Optional:**
- `workItemIds` (array of numbers) - Specific IDs to validate
- `areaPath` (string) - Area path to validate (if workItemIds not provided)
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `maxResults` (number) - Max items when using areaPath (default 500)
- `includeSubAreas` (boolean) - Include child area paths (default true)
- `validateTypes` (boolean) - Validate parent-child type relationships (default true)
- `validateStates` (boolean) - Validate state consistency (default true)

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "total_validated": 150,
    "valid_items": 135,
    "invalid_items": 15,
    "type_violations": [
      {
        "child_id": 12345,
        "child_type": "Task",
        "child_title": "Implement feature",
        "parent_id": 12340,
        "parent_type": "Epic",
        "violation": "Task cannot be direct child of Epic. Expected: Feature -> PBI -> Task"
      }
    ],
    "state_violations": [
      {
        "child_id": 12346,
        "child_state": "Active",
        "child_title": "Design UI",
        "parent_id": 12341,
        "parent_state": "Closed",
        "violation": "Child is Active but parent is Closed"
      }
    ],
    "recommendations": [
      "Fix type hierarchy: Epic -> Feature -> PBI -> Task/Bug",
      "Close active children before closing parents",
      "Move tasks to appropriate parent types"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Validate Area Hierarchy**
```json
{
  "areaPath": "Project\\Team",
  "validateTypes": true,
  "validateStates": true,
  "includeSubAreas": true
}
```

### 3. wit-get-last-substantive-change

Efficiently determine last meaningful change by filtering automated changes.

#### Input Parameters

**Required:**
- `workItemId` (number) - Work item ID to analyze

**Optional:**
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `historyCount` (number) - Revisions to analyze (default 50)
- `automatedPatterns` (array of strings) - Custom automation account patterns to filter

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "work_item_id": 12345,
    "last_substantive_change": {
      "date": "2024-01-15T10:30:00Z",
      "revision": 42,
      "changed_by": "developer@company.com",
      "changed_fields": ["System.State", "System.Description"],
      "comment": "Updated requirements based on user feedback"
    },
    "days_inactive": 5,
    "revisions_analyzed": 50,
    "automated_revisions_filtered": 8
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Get Staleness Info**
```json
{
  "workItemId": 12345,
  "historyCount": 100
}
```

### 4. wit-extract-security-links

Extract instruction links from security scan work items.

#### Input Parameters

**Required:**
- `workItemId` (number) - Work item ID containing security findings

**Optional:**
- `scanType` (string) - Scanner type to filter:
  - `"BinSkim"` - Binary analysis
  - `"CodeQL"` - Code analysis
  - `"CredScan"` - Credential scanning
  - `"General"` - General security
  - `"All"` - All types
- `includeWorkItemDetails` (boolean) - Include work item details in response
- `extractFromComments` (boolean) - Also extract from comments
- `dryRun` (boolean) - Preview without API calls

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "work_item_id": 12345,
    "scan_type": "CodeQL",
    "instruction_links": [
      {
        "title": "SQL Injection Prevention",
        "url": "https://codeql.github.com/codeql-query-help/javascript/js-sql-injection/",
        "source": "description",
        "line_number": 15
      },
      {
        "title": "Cross-Site Scripting",
        "url": "https://codeql.github.com/codeql-query-help/javascript/js-xss/",
        "source": "comment",
        "comment_id": 123
      }
    ],
    "total_links_found": 2,
    "work_item_details": {
      "title": "CodeQL: SQL injection vulnerability",
      "state": "Active",
      "severity": "High"
    }
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Extract CodeQL Links**
```json
{
  "workItemId": 12345,
  "scanType": "CodeQL",
  "includeWorkItemDetails": true,
  "extractFromComments": true
}
```

### 5. wit-get-configuration

Get current MCP server configuration for agents.

#### Input Parameters

**Optional:**
- `includeSensitive` (boolean) - Include sensitive config values
- `section` (string) - Specific section:
  - `"all"` - All configuration
  - `"azureDevOps"` - Azure DevOps settings
  - `"gitRepository"` - Git repository settings
  - `"gitHubCopilot"` - GitHub Copilot settings

#### Output Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "azureDevOps": {
      "organization": "my-org",
      "project": "my-project",
      "defaultAreaPath": "Project\\Team",
      "defaultIterationPath": "Project\\Sprint 10",
      "defaultWorkItemType": "Task",
      "defaultPriority": 2,
      "defaultAssignedTo": "team@company.com"
    },
    "gitRepository": {
      "branch": "main",
      "defaultRepository": "frontend-app"
    },
    "gitHubCopilot": {
      "guid": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
      "enabled": true
    },
    "availableAreaPaths": [
      "Project\\Team",
      "Project\\Team\\Frontend",
      "Project\\Team\\Backend"
    ],
    "availableRepositories": [
      "frontend-app",
      "backend-api",
      "shared-lib"
    ]
  },
  "errors": [],
  "warnings": []
}
```

#### Examples

**Example: Get Full Configuration**
```json
{
  "section": "all"
}
```

## Configuration

Uses defaults from `.ado-mcp-config.json`.

## Error Handling

### Common Errors

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| "Work item not found" | Invalid ID | Verify ID exists |
| "Insufficient history" | Less than requested revisions | Reduce historyCount |
| "No links found" | No instruction URLs in item | Check work item has security findings |
| "Pattern not supported" | Invalid pattern name | Use supported pattern names |

### Error Recovery

- Returns partial results when some items fail
- Provides detailed error context
- Suggests corrective actions

## Performance Considerations

- **detect-patterns**: 1 API call per 200 items
- **validate-hierarchy-fast**: 1-2 API calls (items + relations)
- **get-last-substantive-change**: 1 API call (revisions)
- **extract-security-links**: 1-2 API calls (item + comments)
- **get-configuration**: 0 API calls (reads from memory)

## Implementation Details

### Key Components

- **Handlers:** `src/services/handlers/analysis/*.handler.ts`
- **Handler:** `src/services/handlers/core/get-configuration.handler.ts`
- **Schema:** `src/config/schemas.ts`
- **Service:** `src/services/ado-work-item-service.ts`

### Integration Points

- **Azure DevOps Work Items API** - Item retrieval
- **Azure DevOps Revisions API** - History analysis
- **Pattern Detection Logic** - Issue identification
- **Hierarchy Validation Logic** - Type and state rules

## Testing

### Test Files

- `test/unit/analysis/*.test.ts`
- `test/integration/analysis-tools.test.ts`

### Test Coverage

- [x] Pattern detection (all patterns)
- [x] Hierarchy validation (types and states)
- [x] Substantive change detection
- [x] Security link extraction
- [x] Configuration retrieval

### Manual Testing

```bash
# Test pattern detection
{
  "tool": "wit-detect-patterns",
  "arguments": {
    "areaPath": "Project\\Team",
    "patterns": ["duplicates", "placeholder_titles"]
  }
}

# Test hierarchy validation
{
  "tool": "wit-validate-hierarchy-fast",
  "arguments": {
    "areaPath": "Project\\Team"
  }
}
```

## Related Features

- [Query Tools](./QUERY_TOOLS.md) - Finding work items to analyze
- [Bulk Operations](./BULK_OPERATIONS.md) - Fixing detected issues
- [Work Item Context](./WORK_ITEM_CONTEXT.md) - Detailed item info

## References

- [Azure DevOps Work Item Types](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/guidance/)
- [Work Item State Workflow](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/workflow-and-state-categories)

---

**Last Updated:** 2025-10-07  
**Author:** Enhanced ADO MCP Team
