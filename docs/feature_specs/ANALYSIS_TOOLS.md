# Analysis & Validation Tools

**Feature Category:** Work Item Analysis  
**Status:** ✅ Implemented  
**Version:** 1.5.0  
**Last Updated:** 2025-10-07

## Overview

The Enhanced ADO MCP Server provides comprehensive analysis and validation tools for work items:

1. **wit-get-work-items-by-query-wiql with filterByPatterns** - Identify common work item issues (replaces deprecated wit-analyze-patterns)
2. **wit-analyze-hierarchy** - Fast rule-based hierarchy validation
3. **wit-get-last-change** - Determine meaningful change dates
4. **wit-analyze-security** - Extract security scan instruction links
5. **wit-get-config** - View current MCP server configuration

These tools enable proactive issue detection and work item quality improvement.

## Purpose

Enable work item quality analysis with:
- Pattern detection for common issues
- Hierarchy validation (type and state consistency)
- Staleness analysis (filtering automated changes)
- Security scan link extraction
- Configuration discovery for agents

## Tools

### 1. Pattern Detection via WIQL Queries

**Note:** Pattern detection is now integrated into `wit-get-work-items-by-query-wiql` via the `filterByPatterns` parameter. The standalone `wit-analyze-patterns` tool has been deprecated.

Identify common work item issues using WIQL queries with pattern filters.

#### Using Pattern Detection

Use `wit-get-work-items-by-query-wiql` with the `filterByPatterns` parameter:

**Available Patterns:**
- `"duplicates"` - Duplicate titles (case-insensitive)
- `"placeholder_titles"` - Generic titles (TODO, TBD, test, temp, etc.)
- `"unassigned_committed"` - Unassigned items in Active/Committed/In Progress states
- `"stale_automation"` - Items only modified by automation
- `"missing_description"` - Empty description field
- `"missing_acceptance_criteria"` - Empty acceptance criteria field

**Example Query:**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team' AND [System.State] NOT IN ('Done', 'Closed')",
  "filterByPatterns": ["placeholder_titles", "missing_description"],
  "returnQueryHandle": true
}
```

#### Output Format

When using `filterByPatterns`, the WIQL query returns only matching items:

**Success Response:**
```json
{
  "success": true,
  "data": {
    "workItems": [
      {
        "id": 12347,
        "title": "TODO: Fix bug",
        "state": "New",
        "assignedTo": "user@company.com"
      },
      {
        "id": 12349,
        "title": "Implement feature X",
        "state": "Active",
        "assignedTo": null
      }
    ],
    "queryHandle": "qh_abc123...",
    "totalCount": 2,
    "metadata": {
      "patternsApplied": ["placeholder_titles", "missing_description"],
      "filteredCount": 2
    }
  },
  "errors": [],
  "warnings": []
}
```

Use the query handle with bulk operations to remediate issues.

#### Examples

**Example 1: Find Items with Quality Issues**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team' AND [System.State] NOT IN ('Done', 'Closed')",
  "filterByPatterns": ["placeholder_titles", "missing_description"],
  "returnQueryHandle": true
}
```

**Example 2: Find Duplicates and Stale Items**
```json
{
  "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team'",
  "filterByPatterns": ["duplicates", "stale_automation"],
  "returnQueryHandle": true
}
```

### 2. wit-analyze-hierarchy

Fast, rule-based validation of work item hierarchy.

#### Input Parameters

**Optional (provide one of: queryHandle, workItemIds, or areaPath):**
- `queryHandle` (string) - Query handle from `wit-wiql-query` with `returnQueryHandle=true`
- `workItemIds` (array of numbers) - Specific IDs to validate
- `areaPath` (string) - Area path to validate
- `organization` (string) - Azure DevOps organization
- `project` (string) - Azure DevOps project
- `maxResults` (number) - Max items when using areaPath (default 500)
- `includeSubAreas` (boolean) - Include child area paths (default true)
- `validateTypes` (boolean) - Validate parent-child type relationships (default true)
- `validateStates` (boolean) - Validate state consistency (default true)

**Note:** Query handles enable safe bulk validation without risk of ID hallucination. The handle must be obtained from a prior `wit-wiql-query` call with `returnQueryHandle=true`.

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

**Example 1: Validate Using Query Handle (Recommended)**
```json
{
  "queryHandle": "qh_abc123def456"
}
```

This approach:
- Prevents ID hallucination by using stored query results
- Works with any WIQL query result
- Safe for bulk hierarchy validation

**Example 2: Validate Area Hierarchy**
```json
{
  "areaPath": "Project\\Team",
  "validateTypes": true,
  "validateStates": true,
  "includeSubAreas": true
}
```

**Example 3: Validate Specific Work Items**
```json
{
  "workItemIds": [12345, 12346, 12347],
  "validateTypes": true,
  "validateStates": true
}
```

### 3. wit-get-last-change

Efficiently determine last meaningful change by filtering automated changes.

**Substantive Fields** - Changes to these fields are considered meaningful activity:
- `System.Title` - Work item title changes
- `System.Description` - Description updates
- `System.State` - State transitions (New → Active → Done)
- `System.AssignedTo` - Assignment changes
- `System.Tags` - Tag additions/removals
- `System.History` - Comments (human engagement)
- `Microsoft.VSTS.Common.Priority` - Priority changes
- `Microsoft.VSTS.Common.AcceptanceCriteria` - Acceptance criteria updates
- `Microsoft.VSTS.Common.Severity` - Bug severity assessment
- `Microsoft.VSTS.Common.ReproSteps` - Reproduction steps (bug investigation)
- `Microsoft.VSTS.Scheduling.StoryPoints` - Story point estimation
- `Microsoft.VSTS.Scheduling.RemainingWork` - Remaining work hours (active task tracking)
- `Microsoft.VSTS.Scheduling.CompletedWork` - Completed work hours (progress logging)
- `System.RelatedLinkCount` - Work item links (especially PR associations)
- `System.ExternalLinkCount` - External links (PR, commits, etc.)

**Automated Fields** - Changes to these fields are filtered out:
- `System.IterationPath` - Sprint reassignments (administrative)
- `System.AreaPath` - Area path changes (organizational)
- `Microsoft.VSTS.Common.StackRank` - Backlog reordering
- `Microsoft.VSTS.Common.BacklogPriority` - Priority ranking

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

### 4. wit-analyze-security

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

### 5. wit-get-config

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

- **filterByPatterns (via WIQL)**: 1 API call per 200 items (integrated into query)
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
  "tool": "wit-get-work-items-by-query-wiql",
  "arguments": {
    "wiqlQuery": "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team'",
    "filterByPatterns": ["duplicates", "placeholder_titles"],
    "returnQueryHandle": true
  }
}

# Test hierarchy validation
{
  "tool": "wit-analyze-hierarchy",
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
